/**
 * ADR-010 section 11: while a small-class on-device model is the one that
 * would answer, an open legal or claims question is not sent to it. The
 * veteran gets a fixed message instead. Rating questions are still answered
 * by the calculator, and every other model and route is unchanged.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { auditSpy, crisisSpy, swarmModel } = vi.hoisted(() => ({
  auditSpy: vi.fn().mockResolvedValue(undefined),
  crisisSpy: vi.fn().mockReturnValue({ shouldBlock: false }),
  swarmModel: { id: null },
}));

vi.mock("../../utils/diamondSwarm", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isSwarmReady: vi.fn().mockReturnValue(false),
    getSwarmStatus: vi.fn(() => ({ model: swarmModel.id })),
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
vi.mock("../../utils/deviceCapabilityDetector", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    detectDeviceCapabilities: vi.fn().mockResolvedValue({
      tier: "desktop-high",
      contextWindowSize: 12288,
      hasWebGPU: true,
      canUseWebLLM: true,
    }),
  };
});
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
} from "../../utils/unifiedAIService";
import * as diamondSwarm from "../../utils/diamondSwarm";
import { AI_DATA_CLASS } from "../../utils/aiDataClassPolicy";
import { OPEN_ADVICE_HELD_MESSAGE } from "../../utils/openAdviceHold";

const SMALL = "Qwen3.5-2B-q4f16_1-MLC";
const LARGER = "Qwen3.5-4B-q4f16_1-MLC";
const OPEN_QUESTION = "Can I file a supplemental claim after a denial?";

const assistantOptions = (overrides = {}) => ({
  dataClass: AI_DATA_CLASS.CONTEXT,
  skipFeatureCheck: true,
  useDKB: false,
  skipValidation: true,
  systemPrompt: "You are the Navigator.",
  taskType: "assistant",
  openAdvice: true,
  ...overrides,
});

const swarmWith = (modelId) => {
  swarmModel.id = modelId;
  registerSwarmEngine({}, true, false, "auditor");
  setAIMode(AI_MODES.SWARM);
};

beforeEach(async () => {
  localStorage.clear();
  vi.clearAllMocks();
  swarmModel.id = null;
  crisisSpy.mockReturnValue({ shouldBlock: false });
  resetAICircuitBreaker();
  registerSwarmEngine(null, false, false, null);
  registerLocalAIEngine(null, false, false, null, false);
  await checkLocalServer(true);
  vi.stubGlobal("fetch", vi.fn());
  diamondSwarm.generateWithSwarm.mockResolvedValue({ text: "A model answer." });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("an open question while a small-class model would answer", () => {
  it("is not sent to the model: the fixed message is returned", async () => {
    swarmWith(SMALL);
    const result = await generateAI(OPEN_QUESTION, assistantOptions());
    expect(diamondSwarm.generateWithSwarm).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(result).toEqual({
      text: OPEN_ADVICE_HELD_MESSAGE,
      openAdviceHeld: true,
      onDevice: true,
      modelCalled: false,
    });
    expect(auditSpy).not.toHaveBeenCalled();
  });

  it("still runs the crisis check on the question first", async () => {
    swarmWith(SMALL);
    crisisSpy.mockReturnValue({ shouldBlock: true });
    await expect(generateAI(OPEN_QUESTION, assistantOptions())).rejects.toThrow(
      "CRISIS_DETECTED",
    );
  });

  it("still answers a rating question from the calculator", async () => {
    swarmWith(SMALL);
    const result = await generateAI(
      "What is my combined rating with 50% PTSD and 30% migraines?",
      assistantOptions({ toolId: "rating-calculator" }),
    );
    expect(diamondSwarm.generateWithSwarm).not.toHaveBeenCalled();
    expect(result.calculatorLead).toEqual({ expected: 70 });
    expect(result.openAdviceHeld).toBeUndefined();
  });
});

describe("the hold does not reach anything else", () => {
  it("the larger on-device model answers an open question", async () => {
    swarmWith(LARGER);
    const result = await generateAI(OPEN_QUESTION, assistantOptions());
    expect(diamondSwarm.generateWithSwarm).toHaveBeenCalledTimes(1);
    expect(result.text).toBe("A model answer.");
    expect(result.openAdviceHeld).toBeUndefined();
  });

  it("the cloud model answers an open question, even with a small model cached", async () => {
    swarmModel.id = SMALL;
    localStorage.setItem(
      "vetrate_gemini_key",
      "AIzaSyValidKey12345678901234567890123",
    );
    setAIMode(AI_MODES.CLOUD);
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: { parts: [{ text: "A cloud answer." }] },
            finishReason: "STOP",
          },
        ],
      }),
    });
    const result = await generateAI(OPEN_QUESTION, assistantOptions());
    expect(fetch).toHaveBeenCalled();
    expect(result.text).toBe("A cloud answer.");
    expect(result.openAdviceHeld).toBeUndefined();
  });

  it("a call that is not open advice still reaches the small model", async () => {
    swarmWith(SMALL);
    const result = await generateAI(
      OPEN_QUESTION,
      assistantOptions({ openAdvice: undefined, toolId: "personal-statement" }),
    );
    expect(diamondSwarm.generateWithSwarm).toHaveBeenCalledTimes(1);
    expect(result.text).toBe("A model answer.");
  });
});

describe("the fixed message", () => {
  it("says what this device can do, what open advice needs, and how to reach a VSO", () => {
    expect(OPEN_ADVICE_HELD_MESSAGE).toBe(
      [
        "This device runs a small on-device AI model. In testing, that model gave wrong information too often on open questions about VA law and claims, so Vet-Rate does not use it to answer them.",
        [
          "On this device Vet-Rate can still:",
          "- Work out a combined rating, the bilateral factor and the TDIU percentage thresholds with its calculator. Ask here, or open the Rating Calculator.",
          "- Help you write a statement with the form and statement tools.",
          "- Read a decision letter with the Decision Decoder, using fixed rules instead of the AI model.",
          "- Search the regulations with Ask the Regs and show you the regulation text.",
        ].join("\n"),
        "An AI answer to an open question needs a larger device, such as a desktop computer, or the cloud AI option if you have set one up.",
        "A Veterans Service Officer can answer this question, free of charge. Use the VSO Finder in Vet-Rate, or VA's list of accredited representatives at va.gov/ogc/apps/accreditation.",
      ].join("\n\n"),
    );
  });

  it("uses no emoji and names no model", () => {
    expect(OPEN_ADVICE_HELD_MESSAGE).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(OPEN_ADVICE_HELD_MESSAGE).not.toMatch(/qwen|2B/i);
  });
});
