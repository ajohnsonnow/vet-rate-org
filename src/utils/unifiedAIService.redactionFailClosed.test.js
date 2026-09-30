/**
 * D19-1 part 2: `_redactPiecesForSend` (the ADR-008 single enforcement
 * point, see unifiedAIService.adr008Redaction.test.js) used to fail OPEN -
 * `catch { return pieces; }` - so a VKB/profile load failure sent the raw,
 * un-redacted prompt straight to whichever backend was dispatched, off-device
 * included. It must fail CLOSED: on a loader error, fall back to the full
 * aggressive pattern scrubber (which doesn't need the profile at all) so a
 * pattern-detectable identifier (SSN, DOB, address, ...) still never reaches
 * an off-device backend un-redacted.
 *
 * Same mocking conventions as unifiedAIService.documentRouting.test.js
 * (mock localServerClient, stub global fetch, real generateAI) plus a
 * partial mock of veteranKnowledgeBase so `loadVKB` can be forced to throw
 * without touching this codebase's real IndexedDB-backed implementation.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const FAKE_SSN = "123-45-6789";

vi.mock("./localServerClient", () => ({
  checkServerHealth: vi.fn().mockResolvedValue({ available: false }),
  chatCompletion: vi.fn().mockResolvedValue("local server response"),
  getServerConfig: vi.fn(() => ({ host: "localhost", port: 8080 })),
}));

vi.mock("./veteranKnowledgeBase", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadVKB: vi.fn().mockRejectedValue(new Error("VKB load failed")),
  };
});

const { generateAI, setAIMode, AI_MODES, resetAICircuitBreaker } =
  await import("./unifiedAIService.js");
const { AI_DATA_CLASS } = await import("./aiDataClassPolicy.js");

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  resetAICircuitBreaker();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("_redactPiecesForSend fails CLOSED when the VKB/profile loader throws", () => {
  it("still strips a pattern-detectable SSN from a CONTEXT-classed call reaching Cloud, and warns instead of silently passing it through", async () => {
    setAIMode(AI_MODES.CLOUD);
    localStorage.setItem(
      "vetrate_gemini_key",
      "AIzaSyValidKey12345678901234567890123",
    );
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "ok" }] } }],
      }),
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await generateAI(`Veteran SSN is ${FAKE_SSN}, please review.`, {
      dataClass: AI_DATA_CLASS.CONTEXT,
      systemPrompt: "You are a helpful assistant.",
      skipCrisisCheck: true,
      skipFeatureCheck: true,
      skipHallucinationCheck: true,
      skipValidation: true,
      useDKB: false,
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetch.mock.calls[0];
    expect(requestInit.body).not.toContain(FAKE_SSN);
    expect(requestInit.body).toContain("[REDACTED_SSN]");
    expect(
      warnSpy.mock.calls.some((args) =>
        String(args[0]).includes("_redactPiecesForSend"),
      ),
    ).toBe(true);

    warnSpy.mockRestore();
  });
});
