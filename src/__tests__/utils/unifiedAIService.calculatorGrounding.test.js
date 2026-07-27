/**
 * injectCalculatorForRater — grounds the Rater agent's bilateral-factor math
 * in the deterministic vaCalculator.js engine instead of letting the LLM
 * freehand the arithmetic. This was the confirmed root cause of the swarm's
 * bilateral-pairing hallucinations (see llm-compiler v3-v5 retrain history):
 * the model repeatedly paired the two highest-rated conditions instead of
 * checking body part + side.
 */
import { describe, it, expect, vi } from "vitest";

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
  initializeWllama: vi.fn().mockResolvedValue(false),
  isWllamaAvailable: vi.fn().mockReturnValue(false),
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

import { injectCalculatorForRater } from "../../utils/unifiedAIService";

describe("injectCalculatorForRater", () => {
  it("passes the prompt through unchanged when no conditions are supplied", () => {
    const prompt = "What's my combined rating with a 50% knee and 30% back?";
    expect(injectCalculatorForRater(prompt, {})).toBe(prompt);
    expect(injectCalculatorForRater(prompt, { conditions: [] })).toBe(prompt);
  });

  it("computes the bilateral pair from structured conditions, not the two highest ratings", () => {
    // Deliberately shaped like the failure mode: a non-bilateral condition
    // outranks both bilateral conditions, so a rank-based shortcut would
    // wrongly pair the back with one knee.
    const conditions = [
      { name: "Lumbar strain", rating: 40, side: "none", bodyPart: "back" },
      { name: "Left knee strain", rating: 30, side: "left", bodyPart: "knee" },
      {
        name: "Right knee strain",
        rating: 20,
        side: "right",
        bodyPart: "knee",
      },
    ];

    const prompt = "Calculate my combined rating.";
    const grounded = injectCalculatorForRater(prompt, { conditions });

    expect(grounded).toContain(prompt);
    expect(grounded).toContain("COMPUTED RESULT");
    expect(grounded).toContain("Left knee strain (left, 30%)");
    expect(grounded).toContain("Right knee strain (right, 20%)");
    expect(grounded).not.toContain("Lumbar strain (");
    expect(grounded).toContain("do not recompute");
  });

  it("reports no bilateral pair when conditions don't form one", () => {
    const conditions = [
      { name: "Tinnitus", rating: 10, side: "none", bodyPart: "ear" },
      { name: "PTSD", rating: 50, side: "none", bodyPart: "mental" },
    ];

    const grounded = injectCalculatorForRater("Calculate my rating.", {
      conditions,
    });

    expect(grounded).toContain("Bilateral pair: none");
  });
});
