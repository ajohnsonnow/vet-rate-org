/**
 * ADR-009: the fail-closed document-routing boundary, exercised through the
 * real `generateAI` against each backend in turn. Proves - per backend -
 * that a "document"-classed call (and an undeclared call, which fails
 * closed to "document") can never reach an off-device transport, and that
 * the same document IS allowed through to a genuinely on-device transport
 * (including a local server correctly identified as on-device via real
 * loopback-host parsing, not a cached flag).
 *
 * Same mocking conventions as unifiedAIService.doubleSystemPrompt.test.js /
 * unifiedAIService.adr008Redaction.test.js (this codebase's established
 * pattern: mock localServerClient + diamondSwarm, stub global fetch, real
 * generateAI).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const DOCUMENT_MARKER = "UNIQUE_DOCUMENT_TEXT_MARKER_7f3a";

const localServerConfig = { host: "localhost", port: 8080 };

vi.mock("./localServerClient", () => ({
  checkServerHealth: vi.fn().mockResolvedValue({ available: true }),
  chatCompletion: vi.fn().mockResolvedValue("local server response"),
  getServerConfig: vi.fn(() => localServerConfig),
}));

vi.mock("./diamondSwarm", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateWithSwarm: vi.fn(),
  };
});

const localServerClient = await import("./localServerClient.js");
const diamondSwarm = await import("./diamondSwarm.js");
const {
  generateAI,
  setAIMode,
  AI_MODES,
  registerSwarmEngine,
  registerLocalAIEngine,
  resetAICircuitBreaker,
  checkLocalServer,
} = await import("./unifiedAIService.js");
const { AI_DATA_CLASS, DocumentOffDeviceBlockedError } =
  await import("./aiDataClassPolicy.js");

function documentOptions(overrides = {}) {
  return {
    dataClass: AI_DATA_CLASS.DOCUMENT,
    skipCrisisCheck: true,
    skipFeatureCheck: true,
    skipHallucinationCheck: true,
    skipValidation: true,
    useDKB: false,
    ...overrides,
  };
}

beforeEach(async () => {
  localStorage.clear();
  vi.clearAllMocks();
  resetAICircuitBreaker();
  registerSwarmEngine(null, false, false, null);
  registerLocalAIEngine(null, false, false, null, false);
  localServerConfig.host = "localhost";
  localServerConfig.port = 8080;
  vi.stubGlobal("fetch", vi.fn());
  // Local-server availability is module-level state that otherwise leaks
  // across tests in this file (unlike the mock call-history vi.clearAllMocks
  // resets) - force it back to "not available" by default; the LOCAL_SERVER
  // describe block below re-checks it true for its own tests only.
  localServerClient.checkServerHealth.mockResolvedValue({ available: false });
  await checkLocalServer(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ADR-009: CLOUD backend never receives a document-classed call", () => {
  it("throws DocumentOffDeviceBlockedError and makes zero network requests", async () => {
    setAIMode(AI_MODES.CLOUD);
    localStorage.setItem(
      "vetrate_gemini_key",
      "AIzaSyValidKey12345678901234567890123",
    );

    await expect(
      generateAI(DOCUMENT_MARKER, documentOptions()),
    ).rejects.toThrow(DocumentOffDeviceBlockedError);

    expect(fetch).not.toHaveBeenCalled();
  });

  it("also blocks a call with NO dataClass declared at all (fail closed, not fail open)", async () => {
    setAIMode(AI_MODES.CLOUD);
    localStorage.setItem(
      "vetrate_gemini_key",
      "AIzaSyValidKey12345678901234567890123",
    );

    await expect(
      generateAI(DOCUMENT_MARKER, {
        skipCrisisCheck: true,
        skipFeatureCheck: true,
        skipHallucinationCheck: true,
        skipValidation: true,
        useDKB: false,
      }),
    ).rejects.toThrow(DocumentOffDeviceBlockedError);

    expect(fetch).not.toHaveBeenCalled();
  });

  it("a CONTEXT-classed call on the same setup IS allowed to reach cloud (sanity check the boundary isn't over-blocking), and its response carries onDevice: false", async () => {
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

    const result = await generateAI(
      "a context question",
      documentOptions({ dataClass: AI_DATA_CLASS.CONTEXT }),
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.onDevice).toBe(false);
  });
});

describe("ADR-009: LOCAL_SERVER backend never receives a document-classed call on a non-loopback host", () => {
  it("throws DocumentOffDeviceBlockedError and never calls chatCompletion when the configured host is a lookalike domain", async () => {
    localServerConfig.host = "localhost.evil.com";
    localServerClient.checkServerHealth.mockResolvedValue({ available: true });
    setAIMode(AI_MODES.LOCAL_SERVER);
    await checkLocalServer(true);

    await expect(
      generateAI(DOCUMENT_MARKER, documentOptions()),
    ).rejects.toThrow(DocumentOffDeviceBlockedError);

    expect(localServerClient.chatCompletion).not.toHaveBeenCalled();
  });

  it("throws DocumentOffDeviceBlockedError for a lookalike IP-suffix domain too", async () => {
    localServerConfig.host = "127.0.0.1.nip.io";
    localServerClient.checkServerHealth.mockResolvedValue({ available: true });
    setAIMode(AI_MODES.LOCAL_SERVER);
    await checkLocalServer(true);

    await expect(
      generateAI(DOCUMENT_MARKER, documentOptions()),
    ).rejects.toThrow(DocumentOffDeviceBlockedError);

    expect(localServerClient.chatCompletion).not.toHaveBeenCalled();
  });

  it("ALLOWS a document-classed call through when the configured host really is loopback, and marks the response onDevice: true", async () => {
    localServerConfig.host = "127.0.0.1";
    localServerClient.checkServerHealth.mockResolvedValue({ available: true });
    setAIMode(AI_MODES.LOCAL_SERVER);
    await checkLocalServer(true);

    const result = await generateAI(DOCUMENT_MARKER, documentOptions());

    expect(localServerClient.chatCompletion).toHaveBeenCalledTimes(1);
    expect(result.text).toBe("local server response");
    expect(result.onDevice).toBe(true);
  });
});

describe("ADR-009: on-device backends (Warrant Council, legacy local) always accept a document-classed call", () => {
  it("SWARM: never blocked, since it can never reach an off-device transport, and marks onDevice: true", async () => {
    registerSwarmEngine({}, true, false, "auditor");
    setAIMode(AI_MODES.SWARM);
    diamondSwarm.generateWithSwarm.mockResolvedValue({
      text: "swarm response",
    });

    const result = await generateAI(DOCUMENT_MARKER, documentOptions());

    expect(diamondSwarm.generateWithSwarm).toHaveBeenCalledTimes(1);
    expect(result.text).toBe("swarm response");
    expect(result.onDevice).toBe(true);
  });

  it("LEGACY LOCAL: never blocked, since it can never reach an off-device transport, and marks onDevice: true", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [
        { message: { content: "legacy response" }, finish_reason: "stop" },
      ],
    });
    registerLocalAIEngine(
      { chat: { completions: { create } } },
      true,
      false,
      "test-model",
      false,
    );
    registerSwarmEngine(null, false, false, null);
    setAIMode(AI_MODES.LOCAL);

    const result = await generateAI(DOCUMENT_MARKER, documentOptions());

    expect(create).toHaveBeenCalledTimes(1);
    expect(result.text).toBe("legacy response");
    expect(result.onDevice).toBe(true);
  });
});

describe("ADR-009: the general (non-overflow) fallback chain never crosses a document call to an off-device mode", () => {
  it("LOCAL AI ready but a document overflows its context window, with Cloud ALSO configured: the original overflow error surfaces unwrapped, and Cloud is never touched", async () => {
    const create = vi
      .fn()
      .mockRejectedValue(new Error("prompt tokens exceed context window"));
    registerLocalAIEngine(
      { chat: { completions: { create } } },
      true,
      false,
      "test-model",
      false,
    );
    registerSwarmEngine(null, false, false, null);
    setAIMode(AI_MODES.LOCAL);
    localStorage.setItem(
      "vetrate_gemini_key",
      "AIzaSyValidKey12345678901234567890123",
    );

    await expect(
      generateAI(DOCUMENT_MARKER, documentOptions()),
    ).rejects.toThrow(/context window/i);

    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("ADR-009: no on-device backend at all - fails closed with the typed error, zero network calls", () => {
  it("throws DocumentOffDeviceBlockedError when only cloud is configured and never touches fetch", async () => {
    setAIMode(AI_MODES.SWARM); // preferred mode irrelevant - nothing is ready
    localStorage.setItem(
      "vetrate_gemini_key",
      "AIzaSyValidKey12345678901234567890123",
    );

    await expect(
      generateAI(DOCUMENT_MARKER, documentOptions()),
    ).rejects.toThrow(DocumentOffDeviceBlockedError);

    expect(fetch).not.toHaveBeenCalled();
  });

  it("throws when NOTHING is configured at all (no AI available)", async () => {
    setAIMode(AI_MODES.SWARM);

    await expect(
      generateAI(DOCUMENT_MARKER, documentOptions()),
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
