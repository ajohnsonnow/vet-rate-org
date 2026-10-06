/**
 * A rating question with usable structured conditions is answered by the
 * calculator. No engine is called, on-device or cloud: the model's text was
 * never shown on these routes, so there is nothing for it to write.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { auditSpy, crisisSpy } = vi.hoisted(() => ({
  auditSpy: vi.fn().mockResolvedValue(undefined),
  crisisSpy: vi.fn().mockReturnValue({ shouldBlock: false }),
}));

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
  WLLAMA_MODELS: { auditor: { contextSize: 16384, systemPrompt: "" } },
}));
vi.mock("../../utils/deviceCapabilityDetector", () => ({
  detectDeviceCapabilities: vi.fn().mockResolvedValue({
    tier: "desktop-high",
    contextWindowSize: 12288,
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
  interceptBeforeAICall: crisisSpy,
}));
vi.mock("../../utils/featureFlags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}));
vi.mock("../../utils/aiAuditLog", () => ({
  logModelCallWithDigests: auditSpy,
}));

import {
  generateAI,
  setAIMode,
  AI_MODES,
  registerSwarmEngine,
  registerLocalAIEngine,
  resetAICircuitBreaker,
  checkLocalServer,
  initializeWllama,
} from "../../utils/unifiedAIService";
import * as diamondSwarm from "../../utils/diamondSwarm";
import * as wllamaService from "../../utils/wllamaService";
import { AI_DATA_CLASS } from "../../utils/aiDataClassPolicy";
import { calculateVARating } from "../../utils/vaCalculator";
import {
  buildCalculatorExplanation,
  ASK_SEPARATELY_SENTENCE,
} from "../../utils/raterGrounding";
import { savedRatingsGrounding } from "../../utils/savedRatingsGrounding";
import { GOLDEN } from "./recordedAnswers";

const QUESTION = "What is my combined rating?";
const callOptions = (overrides = {}) => ({
  dataClass: AI_DATA_CLASS.CONTEXT,
  skipFeatureCheck: true,
  toolId: "rating-calculator",
  conditions: GOLDEN.a12.conditions,
  ...overrides,
});
const localCreate = vi.fn();
const noEngineWasCalled = () => {
  expect(diamondSwarm.generateWithSwarm).not.toHaveBeenCalled();
  expect(wllamaService.chatCompletion).not.toHaveBeenCalled();
  expect(localCreate).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
};

const BACKENDS = {
  "no AI available at all": () => setAIMode(AI_MODES.SWARM),
  swarm: () => {
    registerSwarmEngine({}, true, false, "auditor");
    setAIMode(AI_MODES.SWARM);
  },
  "legacy local": () => {
    registerLocalAIEngine(
      { chat: { completions: { create: localCreate } } },
      true,
      false,
      "test-model",
      false,
    );
    registerSwarmEngine(null, false, false, null);
    setAIMode(AI_MODES.LOCAL);
  },
  wllama: async () => {
    await initializeWllama("auditor");
    setAIMode(AI_MODES.WLLAMA);
  },
  cloud: () => {
    localStorage.setItem(
      "vetrate_gemini_key",
      "AIzaSyValidKey12345678901234567890123",
    );
    setAIMode(AI_MODES.CLOUD);
  },
};

beforeEach(async () => {
  localStorage.clear();
  vi.clearAllMocks();
  crisisSpy.mockReturnValue({ shouldBlock: false });
  resetAICircuitBreaker();
  registerSwarmEngine(null, false, false, null);
  registerLocalAIEngine(null, false, false, null, false);
  await checkLocalServer(true);
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a rating question with structured conditions", () => {
  it.each(Object.keys(BACKENDS))(
    "is answered by the calculator with no engine call (%s)",
    async (name) => {
      await BACKENDS[name]();
      const result = await generateAI(QUESTION, callOptions());
      noEngineWasCalled();
      const calc = calculateVARating(GOLDEN.a12.conditions);
      expect(
        result.text.startsWith(
          buildCalculatorExplanation(calc, { question: QUESTION }),
        ),
      ).toBe(true);
      expect(result.text.startsWith("Your combined rating is 50%.")).toBe(true);
      expect(result.text).toContain("30% combined with 21% = 45%");
      expect(result.text).toContain(
        "The bilateral factor applies to Left knee",
      );
      expect(result.calculatorLead).toEqual({ expected: 50 });
      expect(result.modelCalled).toBe(false);
    },
  );

  it("carries nothing that labels the text as written by an AI model", async () => {
    BACKENDS.swarm();
    const result = await generateAI(QUESTION, callOptions());
    expect(result.mode).toBeUndefined();
    expect(result.agent).toBeUndefined();
    expect(result.onDevice).toBe(true);
    expect(result.text).not.toMatch(/\bAI\b|draft|model/);
    expect(auditSpy).not.toHaveBeenCalled();
  });
});

describe("what the calculator's answer covers", () => {
  it("answers a TDIU question with the threshold paragraph right after the rating", async () => {
    BACKENDS.swarm();
    const result = await generateAI(
      GOLDEN.a13.input,
      callOptions({
        toolId: "tdiu-builder",
        conditions: GOLDEN.a13.conditions,
      }),
    );
    noEngineWasCalled();
    expect(
      result.text.startsWith(
        "Your combined rating is 80%.\n\nAbout your question on individual unemployability (TDIU):",
      ),
    ).toBe(true);
    expect(result.text).toContain("Vet-Rate cannot determine that.");
    expect(result.text).not.toContain("No bilateral pair applies");
  });

  it("says which entries were left out when a rating could not be read", async () => {
    BACKENDS.swarm();
    const result = await generateAI(
      QUESTION,
      callOptions({
        conditions: [
          ...GOLDEN.a11.conditions,
          { name: "Sinusitis", rating: "unknown", side: "none" },
        ],
      }),
    );
    expect(result.text).toContain(
      "Vet-Rate could not read the rating entered for Sinusitis",
    );
    expect(result.calculatorLead).toEqual({ expected: 80 });
  });

  it.each([
    ["a plain rating question", QUESTION],
    [
      "a question that also asks about pay and filing",
      "What is my combined rating, what will I be paid each month, and how do I file?",
    ],
  ])(
    "ends by inviting any other part as a separate question (%s)",
    async (_name, question) => {
      BACKENDS.swarm();
      const result = await generateAI(question, callOptions());
      noEngineWasCalled();
      expect(ASK_SEPARATELY_SENTENCE).toBe(
        "This answer covers the rating calculation only. If you also asked about something else, such as monthly pay or how to file, please ask it as a separate question.",
      );
      expect(result.text.endsWith(`\n\n${ASK_SEPARATELY_SENTENCE}`)).toBe(true);
      expect(result.text.split(ASK_SEPARATELY_SENTENCE)).toHaveLength(2);
    },
  );

  it("still runs the crisis check on the question", async () => {
    BACKENDS.swarm();
    crisisSpy.mockReturnValue({ shouldBlock: true });
    await expect(generateAI(QUESTION, callOptions())).rejects.toThrow(
      "CRISIS_DETECTED",
    );
  });

  it("is what the assistant's saved-ratings grounding gets, at once", async () => {
    BACKENDS.swarm();
    const grounding = savedRatingsGrounding(QUESTION, GOLDEN.a12.conditions);
    const result = await generateAI(QUESTION, {
      ...grounding,
      dataClass: AI_DATA_CLASS.CONTEXT,
      skipFeatureCheck: true,
      systemPrompt: "You are the Navigator.",
      taskType: "assistant",
    });
    noEngineWasCalled();
    expect(result.modelCalled).toBe(false);
    expect(result.text.startsWith("Your combined rating is 50%.")).toBe(true);
  });
});

describe("calls the calculator cannot answer still go to the model", () => {
  beforeEach(() => {
    BACKENDS.swarm();
    diamondSwarm.generateWithSwarm.mockResolvedValue({
      text: "A model answer.",
    });
  });

  it.each([
    ["no conditions", { conditions: undefined }],
    ["an empty list", { conditions: [] }],
    [
      "no entry with a readable rating",
      { conditions: [{ name: "Sinusitis", rating: "unknown", side: "none" }] },
    ],
    ["a route that is not the rater's", { toolId: "cfile-analyzer" }],
  ])("%s", async (_name, overrides) => {
    const result = await generateAI(
      QUESTION,
      callOptions({ useDKB: false, skipValidation: true, ...overrides }),
    );
    expect(diamondSwarm.generateWithSwarm).toHaveBeenCalledTimes(1);
    expect(result.text).toBe("A model answer.");
    expect(result.modelCalled).toBeUndefined();
    expect(result.calculatorLead).toBeUndefined();
    const [sent] = diamondSwarm.generateWithSwarm.mock.calls[0];
    expect(sent).not.toContain("=== COMPUTED RESULT");
    expect(sent).not.toContain(ASK_SEPARATELY_SENTENCE);
    expect(result.text).not.toContain(ASK_SEPARATELY_SENTENCE);
  });
});
