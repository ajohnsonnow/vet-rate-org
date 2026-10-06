/**
 * Prompt assembly against the context window the on-device engine was loaded
 * with: reference material is sized to what the window has left, the keyword
 * block gives way before the verified block, and the output limit sent always
 * fits beside the prompt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { buildDKBContextSpy, deviceProfile } = vi.hoisted(() => ({
  buildDKBContextSpy: vi.fn(),
  deviceProfile: { contextWindowSize: 8192 },
}));

vi.mock("../../utils/aiSystemPrompts", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, buildDKBContext: buildDKBContextSpy };
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
  detectDeviceCapabilities: vi.fn(async () => ({
    tier: "test",
    hasWebGPU: true,
    canUseWebLLM: true,
    ...deviceProfile,
  })),
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
import { CHARS_PER_TOKEN } from "../../utils/promptBudget";

const VERIFIED = "=== VERIFIED REFERENCE ===";
const KEYWORD = "=== REFERENCE MATERIAL ===";
const PERSONA_CHARS = 2906;

const SECONDARY_QUESTION =
  "Can sleep apnea be service connected as secondary to my PTSD?";
const TDIU_QUESTION = "Can I qualify for TDIU with only one 60% rating?";

const callOptions = (overrides = {}) => ({
  dataClass: AI_DATA_CLASS.CONTEXT,
  skipCrisisCheck: true,
  skipFeatureCheck: true,
  skipHallucinationCheck: true,
  skipValidation: true,
  ...overrides,
});

const swarmCall = () => {
  const [prompt, opts] = diamondSwarm.generateWithSwarm.mock.calls[0];
  return { prompt, opts, text: `${opts.systemPrompt || ""}\n${prompt}` };
};
const sentTokens = () => {
  const { prompt, opts } = swarmCall();
  const system = opts.systemPrompt ? opts.systemPrompt.length : PERSONA_CHARS;
  return Math.ceil((system + prompt.length) / CHARS_PER_TOKEN);
};
const keywordBudget = () => buildDKBContextSpy.mock.calls[0]?.[1].maxChars;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  resetAICircuitBreaker();
  deviceProfile.contextWindowSize = 8192;
  buildDKBContextSpy.mockImplementation(
    async (_query, { maxChars }) =>
      `\n\n${KEYWORD}\n${"k".repeat(Math.max(0, maxChars - 60))}\n=== END REFERENCE MATERIAL ===\n`,
  );
  registerSwarmEngine({}, true, false, "auditor");
  setAIMode(AI_MODES.SWARM);
  diamondSwarm.generateWithSwarm.mockResolvedValue({ text: "ok" });
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("reference material is sized to the window", () => {
  it("12,288 tokens: the keyword block gets the full 4,000-character budget", async () => {
    deviceProfile.contextWindowSize = 12288;
    await generateAI("How do I claim sleep apnea?", callOptions());
    expect(keywordBudget()).toBe(4000);
    expect(swarmCall().text).toContain(KEYWORD);
  });

  it("8,192 tokens with the default 2,048 output: the keyword block gets what is left, about 3,000 characters", async () => {
    await generateAI("How do I claim sleep apnea?", callOptions());
    expect(keywordBudget()).toBe(2976);
    expect(sentTokens() + 2048).toBeLessThanOrEqual(8192);
  });

  it("8,192 tokens with 1,024 output (the evaluation setting): the full budget again", async () => {
    await generateAI(
      "How do I claim sleep apnea?",
      callOptions({ maxTokens: 1024 }),
    );
    expect(keywordBudget()).toBe(4000);
    expect(sentTokens() + 1024).toBeLessThanOrEqual(8192);
  });

  it("an unknown window is treated as 8,192, as the swarm guard does", async () => {
    deviceProfile.contextWindowSize = undefined;
    await generateAI("How do I claim sleep apnea?", callOptions());
    expect(keywordBudget()).toBe(2976);
  });
});

describe("what gives way first", () => {
  it("the keyword block goes before the verified block", async () => {
    await generateAI(TDIU_QUESTION, callOptions({ toolId: "tdiu-builder" }));
    const { text } = swarmCall();
    expect(text).toContain(VERIFIED);
    expect(text).not.toContain(KEYWORD);
    expect(sentTokens() + 2048).toBeLessThanOrEqual(8192);
  });

  it("the verified block goes next, and the question is always sent", async () => {
    deviceProfile.contextWindowSize = 7150;
    await generateAI(TDIU_QUESTION, callOptions({ toolId: "tdiu-builder" }));
    const { text, prompt } = swarmCall();
    expect(text).not.toContain(VERIFIED);
    expect(text).not.toContain(KEYWORD);
    expect(prompt.endsWith(TDIU_QUESTION)).toBe(true);
  });
});

describe("the output limit sent fits beside the prompt", () => {
  it("leaves a request alone when it fits", async () => {
    await generateAI(SECONDARY_QUESTION, callOptions({ maxTokens: 1024 }));
    expect(swarmCall().opts.maxTokens).toBe(1024);
  });

  it("lowers a 4,096-token request on an 8,192 window to what the prompt leaves", async () => {
    await generateAI(SECONDARY_QUESTION, callOptions({ maxTokens: 4096 }));
    const { opts } = swarmCall();
    expect(opts.maxTokens).toBeLessThan(4096);
    expect(opts.maxTokens).toBeGreaterThanOrEqual(2048);
    expect(sentTokens() + opts.maxTokens).toBeLessThanOrEqual(8192);
  });

  it.each([
    [12288, 2048],
    [12288, 1024],
    [8192, 2048],
    [8192, 1024],
    [8192, 768],
  ])(
    "window %i, output %i: prompt plus output fit for the heaviest question",
    async (contextWindow, maxTokens) => {
      deviceProfile.contextWindowSize = contextWindow;
      await generateAI(
        TDIU_QUESTION,
        callOptions({
          toolId: "tdiu-builder",
          maxTokens,
        }),
      );
      expect(sentTokens() + swarmCall().opts.maxTokens).toBeLessThanOrEqual(
        contextWindow,
      );
    },
  );
});

describe("a caller's own system prompt", () => {
  it("is the system message, and reference material is sized around it", async () => {
    const systemPrompt = "You are the Navigator. ".repeat(40);
    await generateAI(SECONDARY_QUESTION, callOptions({ systemPrompt }));
    const { opts } = swarmCall();
    expect(opts.systemPrompt.startsWith(systemPrompt)).toBe(true);
    expect(opts.systemPrompt).toContain(VERIFIED);
    expect(sentTokens() + 2048).toBeLessThanOrEqual(8192);
  });
});

describe("other backends are not resized", () => {
  it("cloud keeps its own budget whatever the device profile says", async () => {
    deviceProfile.contextWindowSize = 4096;
    registerSwarmEngine(null, false, false, null);
    localStorage.setItem(
      "vetrate_gemini_key",
      "AIzaSyValidKey12345678901234567890123",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "ok" }] } }],
        }),
      }),
    );
    setAIMode(AI_MODES.CLOUD);
    await generateAI("How do I claim sleep apnea?", callOptions());
    expect(keywordBudget()).toBe(8000);
  });
});
