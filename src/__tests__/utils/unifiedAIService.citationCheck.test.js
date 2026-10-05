/**
 * The citation check runs on what generateAI returns: an answer that cites a
 * 38 CFR section that does not exist gets a notice under it and a marker on
 * the result.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../utils/aiSystemPrompts", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, buildDKBContext: vi.fn().mockResolvedValue("") };
});
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
vi.mock("../../utils/localServerClient", () => ({
  checkServerHealth: vi.fn().mockResolvedValue({ available: false }),
  chatCompletion: vi.fn(),
  getServerConfig: vi.fn(() => ({ host: "localhost", port: 8080 })),
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
  resetAICircuitBreaker,
} from "../../utils/unifiedAIService";
import * as diamondSwarm from "../../utils/diamondSwarm";
import { AI_DATA_CLASS } from "../../utils/aiDataClassPolicy";
import { buildCitationNotice } from "../../utils/citationCheck";

const callOptions = (overrides = {}) => ({
  dataClass: AI_DATA_CLASS.CONTEXT,
  skipCrisisCheck: true,
  skipFeatureCheck: true,
  skipHallucinationCheck: true,
  skipValidation: true,
  ...overrides,
});

const modelSays = (text) =>
  diamondSwarm.generateWithSwarm.mockResolvedValue({ text });

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  resetAICircuitBreaker();
  registerSwarmEngine({}, true, false, "auditor");
  setAIMode(AI_MODES.SWARM);
});

afterEach(() => {
  localStorage.clear();
});

describe("generateAI citation check", () => {
  it("adds the notice and marker when the answer cites a section that does not exist", async () => {
    const answer =
      "Sleep apnea cannot be service connected secondary to PTSD under 38 CFR § 4.37.";
    modelSays(answer);

    const result = await generateAI("Explain my denial", callOptions());

    expect(result.text).toBe(`${answer}\n\n${buildCitationNotice(["4.37"])}`);
    expect(result.citationsUnverified).toEqual({ sections: ["4.37"] });
    expect(result.validationWarnings).toContain(
      "Answer cites 38 CFR sections that could not be verified: 4.37",
    );
  });

  it("returns an answer with real citations as the model wrote it", async () => {
    const answer =
      "Secondary service connection is governed by 38 CFR § 3.310(a).";
    modelSays(answer);

    const result = await generateAI("Explain my denial", callOptions());

    expect(result.text).toBe(answer);
    expect(result.citationsUnverified).toBeUndefined();
  });

  it("does not touch output the caller asked for as JSON", async () => {
    const json = '{"basis":"38 CFR § 4.37"}';
    modelSays(json);

    const result = await generateAI(
      "Explain my denial",
      callOptions({ responseFormat: { type: "json_object" } }),
    );

    expect(result.text).toBe(json);
    expect(result.citationsUnverified).toBeUndefined();
  });

  it("checks a rater answer after the calculator guard has run", async () => {
    modelSays(
      "Your combined rating is 50%. The table is in 38 CFR § 4.25 and 38 CFR § 4.99.",
    );

    const result = await generateAI(
      "Calculate my combined rating.",
      callOptions({
        toolId: "rating-calculator",
        useDKB: false,
        conditions: [
          { name: "PTSD", rating: 50, side: "none", bodyPart: "mental" },
        ],
      }),
    );

    expect(result.citationsUnverified).toEqual({ sections: ["4.99"] });
    expect(result.text).toContain("Your combined rating is 50%.");
    expect(result.text.endsWith(buildCitationNotice(["4.99"]))).toBe(true);
  });
});
