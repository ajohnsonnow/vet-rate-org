/**
 * ADR-009 decision E (2026-09-29): "On-device document calls MAY include
 * identifiers (nothing leaves the computer), so on-device extraction of
 * name/DOB/address/home of record is allowed."
 *
 * Before this fix, generateAIInternal ran the ADR-008 known-value redaction
 * (_redactPiecesForSend) on EVERY call regardless of dataClass/backend, and
 * each on-device backend then ALSO ran its own pattern scrub
 * (scrubPromptForWarrantCouncil, Wllama's scrubPII) - so an on-device model
 * never saw the identifiers a DD-214/C-File extraction needs. Separately,
 * a document-classed call with Cloud preferred always attempted CLOUD
 * first (refused by the per-backend guard) before falling back to an
 * on-device backend chosen from a fallback picker that only ever offered
 * SWARM or legacy LOCAL - so a ready WLLAMA-only or loopback-LOCAL_SERVER-only
 * setup was refused outright even though an on-device engine WAS ready.
 *
 * Same mocking conventions as unifiedAIService.documentRouting.test.js.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const FAKE_NAME_MARKER = "NAME (Last, First, Middle): Faketon, Jordan Q";
const FAKE_SSN_MARKER = "SSN 123-45-6789";

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

vi.mock("./wllamaService", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    initializeWllama: vi.fn(),
    chatCompletion: vi.fn(),
  };
});

vi.mock("./deviceCapabilityDetector", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    detectDeviceCapabilities: vi
      .fn()
      .mockResolvedValue({ canUseWebLLM: true, tier: "desktop-high" }),
  };
});

const localServerClient = await import("./localServerClient.js");
const diamondSwarm = await import("./diamondSwarm.js");
const wllamaService = await import("./wllamaService.js");
const {
  generateAI,
  setAIMode,
  AI_MODES,
  registerSwarmEngine,
  registerLocalAIEngine,
  resetAICircuitBreaker,
  checkLocalServer,
  initializeWllama,
} = await import("./unifiedAIService.js");
const { AI_DATA_CLASS } = await import("./aiDataClassPolicy.js");

const DOCUMENT_TEXT = `Analyze this DD214.\n${FAKE_NAME_MARKER}\n${FAKE_SSN_MARKER}\nREMARKS served honorably.`;

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
  localServerClient.checkServerHealth.mockResolvedValue({ available: false });
  await checkLocalServer(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ADR-009 decision E: SWARM sees on-device document identifiers unredacted", () => {
  it("forwards the real name and SSN to generateWithSwarm, with no [REDACTED] tokens", async () => {
    registerSwarmEngine({}, true, false, "auditor");
    setAIMode(AI_MODES.SWARM);
    diamondSwarm.generateWithSwarm.mockResolvedValue({ text: "ok" });

    const result = await generateAI(DOCUMENT_TEXT, documentOptions());

    expect(diamondSwarm.generateWithSwarm).toHaveBeenCalledTimes(1);
    const [sentPrompt] = diamondSwarm.generateWithSwarm.mock.calls[0];
    expect(sentPrompt).toContain("Faketon");
    expect(sentPrompt).toContain("123-45-6789");
    expect(sentPrompt).not.toContain("[REDACTED");
    expect(result.onDevice).toBe(true);
  });

  it("a CONTEXT-classed call on the same SWARM backend is still redacted", async () => {
    registerSwarmEngine({}, true, false, "auditor");
    setAIMode(AI_MODES.SWARM);
    diamondSwarm.generateWithSwarm.mockResolvedValue({ text: "ok" });

    await generateAI(DOCUMENT_TEXT, {
      ...documentOptions(),
      dataClass: AI_DATA_CLASS.CONTEXT,
    });

    const [sentPrompt] = diamondSwarm.generateWithSwarm.mock.calls[0];
    expect(sentPrompt).not.toContain("123-45-6789");
  });
});

describe("ADR-009 decision E: a Cloud-preferred user with an on-device engine loaded routes a document call DIRECTLY on-device", () => {
  it("never attempts Cloud first when SWARM is ready, and makes zero network requests", async () => {
    registerSwarmEngine({}, true, false, "auditor");
    setAIMode(AI_MODES.CLOUD);
    localStorage.setItem(
      "vetrate_gemini_key",
      "AIzaSyValidKey12345678901234567890123",
    );
    diamondSwarm.generateWithSwarm.mockResolvedValue({ text: "ok" });

    const result = await generateAI(DOCUMENT_TEXT, documentOptions());

    expect(diamondSwarm.generateWithSwarm).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(result.mode).toBe(AI_MODES.SWARM);
    expect(result.onDevice).toBe(true);
    const [sentPrompt] = diamondSwarm.generateWithSwarm.mock.calls[0];
    expect(sentPrompt).toContain("Faketon");
  });

  it("never attempts a non-loopback LOCAL_SERVER first when SWARM is ready, and never calls chatCompletion", async () => {
    // eslint-disable-next-line sonarjs/no-hardcoded-ip -- test fixture, not real infra
    localServerConfig.host = "192.168.1.50";
    localServerClient.checkServerHealth.mockResolvedValue({ available: true });
    registerSwarmEngine({}, true, false, "auditor");
    setAIMode(AI_MODES.LOCAL_SERVER);
    await checkLocalServer(true);
    diamondSwarm.generateWithSwarm.mockResolvedValue({ text: "ok" });

    const result = await generateAI(DOCUMENT_TEXT, documentOptions());

    expect(localServerClient.chatCompletion).not.toHaveBeenCalled();
    expect(diamondSwarm.generateWithSwarm).toHaveBeenCalledTimes(1);
    expect(result.onDevice).toBe(true);
  });
});

describe("ADR-009 decision E: a loopback LOCAL_SERVER sees on-device document identifiers unredacted", () => {
  it("forwards the real name and SSN to the local server, with no [REDACTED] tokens", async () => {
    localServerConfig.host = "localhost";
    localServerClient.checkServerHealth.mockResolvedValue({ available: true });
    setAIMode(AI_MODES.LOCAL_SERVER);
    await checkLocalServer(true);
    localServerClient.chatCompletion.mockResolvedValue("ok");

    const result = await generateAI(DOCUMENT_TEXT, documentOptions());

    expect(localServerClient.chatCompletion).toHaveBeenCalledTimes(1);
    const [messages] = localServerClient.chatCompletion.mock.calls[0];
    const sentContent = messages[0].content;
    expect(sentContent).toContain("Faketon");
    expect(sentContent).toContain("123-45-6789");
    expect(sentContent).not.toContain("[REDACTED");
    expect(result.onDevice).toBe(true);
  });

  it("a CONTEXT-classed call on the same loopback LOCAL_SERVER backend is still redacted", async () => {
    localServerConfig.host = "localhost";
    localServerClient.checkServerHealth.mockResolvedValue({ available: true });
    setAIMode(AI_MODES.LOCAL_SERVER);
    await checkLocalServer(true);
    localServerClient.chatCompletion.mockResolvedValue("ok");

    await generateAI(DOCUMENT_TEXT, {
      ...documentOptions(),
      dataClass: AI_DATA_CLASS.CONTEXT,
    });

    const [messages] = localServerClient.chatCompletion.mock.calls[0];
    expect(messages[0].content).not.toContain("123-45-6789");
  });
});

describe("ADR-009 decision E: legacy LOCAL (in-page WebLLM) sees on-device document identifiers unredacted", () => {
  it("forwards the real name and SSN to the local engine, with no [REDACTED] tokens", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
    });
    registerLocalAIEngine(
      { chat: { completions: { create } } },
      true,
      false,
      "test-model",
      false,
    );
    // registerLocalAIEngine(ready=true) auto-maps the model to a Diamond
    // Swarm agent and marks Swarm ready too (see its own "Map legacy model
    // to closest Diamond Swarm agent" step) - override back to not-ready so
    // this test actually exercises generateWithLocalAI, not Warrant Council.
    registerSwarmEngine(null, false, false, null);
    setAIMode(AI_MODES.LOCAL);

    const result = await generateAI(DOCUMENT_TEXT, documentOptions());

    expect(create).toHaveBeenCalledTimes(1);
    const sentMessages = create.mock.calls[0][0].messages;
    const sentContent = sentMessages.map((m) => m.content).join("\n");
    expect(sentContent).toContain("Faketon");
    expect(sentContent).toContain("123-45-6789");
    expect(sentContent).not.toContain("[REDACTED");
    expect(result.onDevice).toBe(true);
  });

  it("a CONTEXT-classed call on the same legacy LOCAL backend is still redacted", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
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

    await generateAI(DOCUMENT_TEXT, {
      ...documentOptions(),
      dataClass: AI_DATA_CLASS.CONTEXT,
    });

    const sentMessages = create.mock.calls[0][0].messages;
    const sentContent = sentMessages.map((m) => m.content).join("\n");
    expect(sentContent).not.toContain("123-45-6789");
  });
});

describe("ADR-009 decision E: a ready on-device engine is used even when it isn't SWARM or legacy LOCAL", () => {
  it("Cloud preferred + key configured + ONLY Wllama ready: routes to Wllama, not blocked", async () => {
    setAIMode(AI_MODES.CLOUD);
    localStorage.setItem(
      "vetrate_gemini_key",
      "AIzaSyValidKey12345678901234567890123",
    );
    wllamaService.initializeWllama.mockResolvedValue(true);
    await initializeWllama("auditor");
    wllamaService.chatCompletion.mockResolvedValue({
      success: true,
      text: "wllama response",
    });

    const result = await generateAI(DOCUMENT_TEXT, documentOptions());

    expect(wllamaService.chatCompletion).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(result.text).toBe("wllama response");
    expect(result.onDevice).toBe(true);
  });
});
