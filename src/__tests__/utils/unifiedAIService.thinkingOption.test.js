/**
 * generateAI hands the `thinking` option to the swarm, and a calculator
 * replacement keeps the draft it replaced on the result (a diagnostic field;
 * the user-visible text is the calculator's working).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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
  initializeWllama: vi.fn().mockResolvedValue(true),
  isWllamaAvailable: vi.fn().mockReturnValue(false),
  chatCompletion: vi.fn(),
  generateWithModel: vi.fn(),
  getWllamaStatus: vi.fn().mockReturnValue({ ready: false }),
  unloadWllama: vi.fn(),
  WLLAMA_MODELS: {},
}));
vi.mock("../../utils/deviceCapabilityDetector", () => ({
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
  AI_MODES,
  generateAI,
  registerSwarmEngine,
  resetAICircuitBreaker,
  setAIMode,
} from "../../utils/unifiedAIService";
import * as diamondSwarm from "../../utils/diamondSwarm";
import { AI_DATA_CLASS } from "../../utils/aiDataClassPolicy";

const base = {
  dataClass: AI_DATA_CLASS.CONTEXT,
  skipCrisisCheck: true,
  skipFeatureCheck: true,
  skipHallucinationCheck: true,
  skipValidation: true,
  useDKB: false,
};

const FOUR = [
  { name: "PTSD", rating: 50, side: "none", bodyPart: "mental" },
  { name: "Tinnitus", rating: 30, side: "none", bodyPart: "ear" },
  { name: "Back", rating: 20, side: "none", bodyPart: "back" },
  { name: "Knee", rating: 10, side: "none", bodyPart: "knee" },
];

beforeEach(() => {
  vi.clearAllMocks();
  resetAICircuitBreaker();
  registerSwarmEngine({}, true, false, "auditor");
  setAIMode(AI_MODES.SWARM);
  diamondSwarm.generateWithSwarm.mockResolvedValue({ text: "ok" });
});

describe("thinking option passthrough", () => {
  it("forwards an explicit true and an explicit false to generateWithSwarm", async () => {
    await generateAI("q", { ...base, thinking: true });
    expect(diamondSwarm.generateWithSwarm.mock.calls[0][1].thinking).toBe(true);
    await generateAI("q", { ...base, thinking: false });
    expect(diamondSwarm.generateWithSwarm.mock.calls[1][1].thinking).toBe(
      false,
    );
  });

  it("leaves the option absent when the caller gave none, so the swarm default (off) applies", async () => {
    await generateAI("q", base);
    expect(diamondSwarm.generateWithSwarm.mock.calls[0][1]).not.toHaveProperty(
      "thinking",
    );
  });
});

describe("calculator replacement keeps the replaced draft", () => {
  const ask = (text) => {
    diamondSwarm.generateWithSwarm.mockResolvedValue({ text });
    return generateAI("What is my combined rating?", {
      ...base,
      toolId: "rating-calculator",
      conditions: FOUR,
    });
  };

  it("records the draft next to the reason, and shows the user the calculator's text", async () => {
    const draft = "The final combined disability rating is 70%.";
    const result = await ask(draft);
    expect(result.calculatorReplacement.draft).toBe(draft);
    expect(result.calculatorReplacement.reason).toEqual(expect.any(String));
    expect(result.text).not.toContain("70%.");
    expect(result.text).toContain("Step 3: 72% combined with 10% = 75%");
  });

  it("adds nothing when the response agrees with the calculator", async () => {
    const result = await ask("Your combined rating is 80%.");
    expect(result.calculatorReplacement).toBeUndefined();
  });
});
