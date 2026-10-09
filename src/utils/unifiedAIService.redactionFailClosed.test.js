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
 * D19 follow-up: a reviewer proved the SSN assertion below passes on base
 * too - generateWithCloudAI's own downstream scrubCloudPromptPII already
 * redacts a pattern-detectable SSN regardless of what _redactPiecesForSend
 * itself did, so only the console.warn spy actually tells base and fix
 * apart. The real gap the SSN case can't expose: a KNOWN-VALUE identifier
 * with no generic shape (the veteran's own name) has nothing to catch it
 * downstream either. Added a name-based case (using the last successfully
 * loaded profile, closing that gap for a transient post-success failure)
 * plus an explicit case documenting the still-open cold-start limit (no
 * profile has ever loaded successfully this session).
 *
 * Same mocking conventions as unifiedAIService.documentRouting.test.js
 * (mock localServerClient, stub global fetch, real generateAI) plus a
 * partial mock of veteranKnowledgeBase so `loadVKB` can be forced to throw
 * without touching this codebase's real IndexedDB-backed implementation.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const FAKE_SSN = "123-45-6789";
const FAKE_NAME = "Jordan Faketon";

const loadVKBMock = vi.fn();

vi.mock("./localServerClient", () => ({
  checkServerHealth: vi.fn().mockResolvedValue({ available: false }),
  chatCompletion: vi.fn().mockResolvedValue("local server response"),
  getServerConfig: vi.fn(() => ({ host: "localhost", port: 8080 })),
}));

vi.mock("./veteranKnowledgeBase", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadVKB: loadVKBMock,
  };
});

const {
  generateAI,
  setAIMode,
  AI_MODES,
  resetAICircuitBreaker,
  resetLastKnownGoodRedactionProfile,
} = await import("./unifiedAIService.js");
const { AI_DATA_CLASS } = await import("./aiDataClassPolicy.js");

function mockCloudFetchOk() {
  fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: "ok" }] } }],
    }),
  });
}

async function sendContextCall(text) {
  await generateAI(text, {
    dataClass: AI_DATA_CLASS.CONTEXT,
    systemPrompt: "You are a helpful assistant.",
    skipCrisisCheck: true,
    skipFeatureCheck: true,
    skipHallucinationCheck: true,
    skipValidation: true,
    useDKB: false,
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  resetAICircuitBreaker();
  resetLastKnownGoodRedactionProfile();
  vi.stubGlobal("fetch", vi.fn());
  setAIMode(AI_MODES.CLOUD);
  localStorage.setItem(
    "vetrate_gemini_key",
    "AIzaSyValidKey12345678901234567890123",
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("_redactPiecesForSend fails CLOSED when the VKB/profile loader throws", () => {
  it("still strips a pattern-detectable SSN from a CONTEXT-classed call reaching Cloud, and warns instead of silently passing it through", async () => {
    loadVKBMock.mockRejectedValue(new Error("VKB load failed"));
    mockCloudFetchOk();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await sendContextCall(`Veteran SSN is ${FAKE_SSN}, please review.`);

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

  it("still strips a known-value name (no generic pattern) when the loader fails AFTER an earlier successful load this session", async () => {
    loadVKBMock.mockResolvedValue({
      personal: { fullName: FAKE_NAME },
      vaClaimsHistory: { claims: [] },
    });
    mockCloudFetchOk();

    // First call succeeds and caches the profile.
    await sendContextCall("What are my options for my upcoming appeal?");

    // Second call: the loader now fails, but the name was already cached.
    loadVKBMock.mockRejectedValue(new Error("VKB load failed"));
    await sendContextCall(`My name is ${FAKE_NAME}, please review my case.`);

    expect(fetch).toHaveBeenCalledTimes(2);
    const [, secondRequestInit] = fetch.mock.calls[1];
    expect(secondRequestInit.body).not.toContain(FAKE_NAME);
  });

  it("documents the still-open cold-start limit: a known-value name leaks when the loader has never once succeeded this session", async () => {
    // No prior successful call, so there is nothing cached to redact
    // against - only the generic pattern scrubber runs, which has no
    // shape for a bare name. This is a structural limit (there is no
    // profile to compare against when the very load that would provide
    // one has failed), not a regression - see the header comment.
    loadVKBMock.mockRejectedValue(new Error("VKB load failed"));
    mockCloudFetchOk();

    await sendContextCall(`My name is ${FAKE_NAME}, please review my case.`);

    const [, requestInit] = fetch.mock.calls[0];
    expect(requestInit.body).toContain(FAKE_NAME);
  });
});
