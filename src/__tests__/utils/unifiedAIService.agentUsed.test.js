/**
 * The agent reported on a Warrant Council result is the persona that
 * answered that call, not whichever agent the engine happened to load last.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../utils/diamondSwarm", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isSwarmReady: vi.fn().mockReturnValue(false),
    generateWithSwarm: vi.fn(actual.generateWithSwarm),
    getCurrentAgent: vi.fn(() => "rater"),
    initializeSwarm: vi.fn(),
    switchAgent: vi.fn(),
    unloadSwarm: vi.fn(),
  };
});
vi.mock("../../utils/wllamaService", () => ({
  initializeWllama: vi.fn().mockResolvedValue(true),
  isWllamaAvailable: vi.fn().mockReturnValue(false),
  chatCompletion: vi.fn(),
  generateWithModel: vi.fn(),
  getWllamaStatus: vi.fn().mockReturnValue({ ready: false }),
  unloadWllama: vi.fn(),
  WLLAMA_MODELS: {},
}));
vi.mock("../../utils/deviceCapabilityDetector", async (importOriginal) => ({
  ...(await importOriginal()),
  detectDeviceCapabilities: vi.fn().mockResolvedValue({
    tier: "desktop",
    hasWebGPU: true,
    canUseWebLLM: true,
  }),
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
  registerLocalAIEngine,
  resetAICircuitBreaker,
  checkLocalServer,
} from "../../utils/unifiedAIService";
import * as diamondSwarm from "../../utils/diamondSwarm";
import { AI_DATA_CLASS } from "../../utils/aiDataClassPolicy";

const callOptions = (overrides = {}) => ({
  dataClass: AI_DATA_CLASS.CONTEXT,
  skipCrisisCheck: true,
  skipFeatureCheck: true,
  skipHallucinationCheck: true,
  skipValidation: true,
  useDKB: false,
  ...overrides,
});

beforeEach(async () => {
  localStorage.clear();
  vi.clearAllMocks();
  resetAICircuitBreaker();
  registerLocalAIEngine(null, false, false, null, false);
  await checkLocalServer(true);
  registerSwarmEngine({}, true, false, "rater");
  setAIMode(AI_MODES.SWARM);
});

describe("generateAI reports the persona that answered", () => {
  it.each([
    ["toolId personal-statement", { toolId: "personal-statement" }, "writer"],
    ["toolId buddy-statement", { toolId: "buddy-statement" }, "writer"],
    ["toolId tdiu-narrative", { toolId: "tdiu-narrative" }, "writer"],
    ["toolId rating-calculator", { toolId: "rating-calculator" }, "rater"],
    ["toolId dd214-analyzer", { toolId: "dd214-analyzer" }, "auditor"],
    ["taskType statement", { taskType: "statement" }, "writer"],
    ["taskType general", { taskType: "general" }, "auditor"],
    ["no route", {}, "auditor"],
  ])("%s answers as %s", async (_label, route, expected) => {
    const result = await generateAI("Question", callOptions(route));

    expect(result.agent).toBe(expected);
  });

  it("ignores the last-loaded agent: a writer call after a rater load reports writer", async () => {
    expect(diamondSwarm.getCurrentAgent()).toBe("rater");

    const result = await generateAI(
      "Draft this",
      callOptions({ toolId: "personal-statement" }),
    );

    expect(result.agent).toBe("writer");
  });

  it("falls back to the routed persona when the swarm result carries no agent id", async () => {
    diamondSwarm.generateWithSwarm.mockResolvedValueOnce({ text: "ok" });

    const result = await generateAI(
      "Draft this",
      callOptions({ toolId: "buddy-statement" }),
    );

    expect(result.agent).toBe("writer");
  });

  it("reports the persona the swarm says answered", async () => {
    diamondSwarm.generateWithSwarm.mockResolvedValueOnce({
      text: "ok",
      agent: "auditor",
    });

    const result = await generateAI(
      "Review this",
      callOptions({ toolId: "cfile-analyzer" }),
    );

    expect(result.agent).toBe("auditor");
  });

  it("document-class calls report the routed persona too", async () => {
    const result = await generateAI(
      "Extract this",
      callOptions({
        dataClass: AI_DATA_CLASS.DOCUMENT,
        toolId: "dd214-analyzer",
      }),
    );

    expect(result.agent).toBe("auditor");
    expect(result.onDevice).toBe(true);
  });
});
