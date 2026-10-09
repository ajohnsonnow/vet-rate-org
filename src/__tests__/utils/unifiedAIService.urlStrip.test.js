/**
 * RT-4 / PI-01 integration test: prove the production generateAI() return path
 * actually strips non-allow-listed URLs from model output (the audit found
 * stripUntrustedUrls was defined + unit-tested but never wired into generateAI,
 * and the red-team test "called the filter itself", manufacturing coverage).
 *
 * Drives the real generateAI → Warrant Council (swarm) path with the engine mocked
 * to emit an attacker URL, and asserts the URL is replaced with [link removed] while
 * an allow-listed gov link survives - and that JSON-only calls opt out.
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

import {
  generateAI,
  setAIMode,
  AI_MODES,
  registerSwarmEngine,
} from "../../utils/unifiedAIService";
import { generateWithSwarm } from "../../utils/diamondSwarm";

const BASE_OPTS = {
  systemPrompt: "TEST", // skip buildSystemPrompt
  useDKB: false, // skip DKB fetch
  skipValidation: true,
  skipHallucinationCheck: true,
  scrubPIIEnabled: false,
};

describe("generateAI - PI-01 URL stripping", () => {
  beforeEach(() => {
    localStorage.clear();
    registerSwarmEngine({}, true, false, "auditor");
    setAIMode(AI_MODES.SWARM);
    generateWithSwarm.mockReset();
  });

  it("strips non-allow-listed URLs and keeps gov links", async () => {
    generateWithSwarm.mockResolvedValue({
      text: "Update your records at https://evil.example.com/login or see https://www.va.gov/disability.",
    });
    const result = await generateAI("analyze my claim", BASE_OPTS);
    expect(result.text).toContain("[link removed]");
    expect(result.text).not.toContain("evil.example.com");
    expect(result.text).toContain("https://www.va.gov/disability");
  });

  it("does NOT strip when expectJSON (opt-out so JSON isn't corrupted)", async () => {
    generateWithSwarm.mockResolvedValue({
      text: '{"source":"https://evil.example.com/x"}',
    });
    const result = await generateAI("extract", {
      ...BASE_OPTS,
      expectJSON: true,
    });
    expect(result.text).toContain("evil.example.com");
  });

  it("does NOT strip when skipUrlStrip is set", async () => {
    generateWithSwarm.mockResolvedValue({
      text: "ref https://evil.example.com/y",
    });
    const result = await generateAI("x", { ...BASE_OPTS, skipUrlStrip: true });
    expect(result.text).toContain("evil.example.com");
  });
});
