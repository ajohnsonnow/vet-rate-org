/**
 * C-H06 integration test: prove the production generateAI() path actually records
 * every call in the tamper-evident audit log. The audit found logModelCall* was
 * fully built + tested but never imported by unifiedAIService, so every real AI
 * call was invisible to the hash chain. Drives the real generateAI → swarm path
 * with the audit log mocked and asserts it is called with digest-friendly args.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../utils/diamondSwarm", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isSwarmReady: vi.fn().mockReturnValue(false),
    generateWithSwarm: vi.fn(),
    initializeSwarm: vi.fn(),
    switchAgent: vi.fn(),
    unloadSwarm: vi.fn(),
  };
});
vi.mock("../../utils/wllamaService", () => ({
  initializeWllama: vi.fn().mockResolvedValue({ success: false }),
  isWllamaAvailable: vi.fn().mockReturnValue(false),
  generateWithModel: vi.fn(),
  getWllamaStatus: vi.fn().mockReturnValue({ ready: false }),
  unloadWllama: vi.fn(),
  WLLAMA_MODELS: {},
}));
vi.mock("../../utils/localServerClient", () => ({
  checkServerHealth: vi.fn().mockResolvedValue({ available: false }),
  generateWithLocalServer: vi.fn(),
  getServerStatus: vi.fn().mockReturnValue({ available: false }),
}));
vi.mock("../../utils/crisisInterceptor", () => ({
  interceptBeforeAICall: vi.fn().mockResolvedValue({ shouldBlock: false }),
}));
vi.mock("../../utils/featureFlags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}));
vi.mock("../../utils/aiAuditLog", () => ({
  logModelCallWithDigests: vi.fn().mockResolvedValue({ seq: 1, hash: "h" }),
}));

import {
  generateAI,
  setAIMode,
  AI_MODES,
  registerSwarmEngine,
} from "../../utils/unifiedAIService";
import { generateWithSwarm } from "../../utils/diamondSwarm";
import { logModelCallWithDigests } from "../../utils/aiAuditLog";

const BASE_OPTS = {
  systemPrompt: "TEST",
  useDKB: false,
  skipValidation: true,
  skipHallucinationCheck: true,
  scrubPIIEnabled: false,
};

describe("generateAI - audit-log wiring (C-H06)", () => {
  beforeEach(() => {
    localStorage.clear();
    registerSwarmEngine({}, true, false, "auditor");
    setAIMode(AI_MODES.SWARM);
    generateWithSwarm.mockReset();
    logModelCallWithDigests.mockClear();
  });

  it("records every successful production AI call", async () => {
    generateWithSwarm.mockResolvedValue({ text: "the answer" });
    await generateAI("my question", BASE_OPTS);
    expect(logModelCallWithDigests).toHaveBeenCalledTimes(1);
    const entry = logModelCallWithDigests.mock.calls[0][0];
    expect(entry.prompt).toContain("my question");
    expect(entry.output).toBe("the answer");
    expect(typeof entry.durationMs).toBe("number");
  });
});
