/**
 * An empty or whitespace-only prompt never reaches a model, on any backend:
 * generateAI answers with a short request to say what the veteran needs. Seen
 * in the golden set (a22), where an empty message made the model print the
 * app's own system context until the token cap.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
  // A roomy stand-in window: these tests are about what is sent, not about
  // fitting wllama's real 4,096 tokens (unifiedAIService.wllamaFit.test.js).
  WLLAMA_MODELS: {
    auditor: { contextSize: 16384, systemPrompt: "" },
    rater: { contextSize: 16384, systemPrompt: "" },
  },
}));
vi.mock("../../utils/deviceCapabilityDetector", () => ({
  detectDeviceCapabilities: vi.fn().mockResolvedValue({
    tier: "desktop",
    hasWebGPU: true,
    canUseWebLLM: true,
  }),
}));
vi.mock("../../utils/localServerClient", () => ({
  checkServerHealth: vi.fn().mockResolvedValue({ available: true }),
  chatCompletion: vi.fn().mockResolvedValue("local server response"),
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
  EMPTY_PROMPT_REPLY,
  registerSwarmEngine,
  registerLocalAIEngine,
  resetAICircuitBreaker,
  checkLocalServer,
  initializeWllama,
} from "../../utils/unifiedAIService";
import * as diamondSwarm from "../../utils/diamondSwarm";
import * as wllamaService from "../../utils/wllamaService";
import * as localServerClient from "../../utils/localServerClient";
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

const localCreate = vi.fn(async () => ({
  choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
}));

const BACKENDS = {
  swarm: {
    mode: AI_MODES.SWARM,
    onDevice: true,
    setup: () => {
      registerSwarmEngine({}, true, false, "auditor");
      setAIMode(AI_MODES.SWARM);
      diamondSwarm.generateWithSwarm.mockResolvedValue({ text: "ok" });
    },
    calls: () => diamondSwarm.generateWithSwarm.mock.calls.length,
  },
  local: {
    mode: AI_MODES.LOCAL,
    onDevice: true,
    setup: () => {
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
    calls: () => localCreate.mock.calls.length,
  },
  wllama: {
    mode: AI_MODES.WLLAMA,
    onDevice: true,
    setup: async () => {
      await initializeWllama("auditor");
      setAIMode(AI_MODES.WLLAMA);
      wllamaService.chatCompletion.mockResolvedValue({
        success: true,
        text: "ok",
      });
    },
    calls: () => wllamaService.chatCompletion.mock.calls.length,
  },
  "local server": {
    mode: AI_MODES.LOCAL_SERVER,
    onDevice: true,
    setup: async () => {
      await checkLocalServer(true);
      setAIMode(AI_MODES.LOCAL_SERVER);
    },
    calls: () => localServerClient.chatCompletion.mock.calls.length,
  },
  cloud: {
    mode: AI_MODES.CLOUD,
    onDevice: false,
    setup: () => {
      localStorage.setItem(
        "vetrate_gemini_key",
        "AIzaSyValidKey12345678901234567890123",
      );
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "ok" }] } }],
        }),
      });
      setAIMode(AI_MODES.CLOUD);
    },
    calls: () => fetch.mock.calls.length,
  },
};

const EMPTY_PROMPTS = [
  ["empty string", ""],
  ["spaces", "   "],
  ["newlines and tabs", "\n\t \r\n"],
  ["undefined", undefined],
  ["null", null],
];

beforeEach(async () => {
  localStorage.clear();
  vi.clearAllMocks();
  resetAICircuitBreaker();
  registerSwarmEngine(null, false, false, null);
  registerLocalAIEngine(null, false, false, null, false);
  vi.stubGlobal("fetch", vi.fn());
  localServerClient.checkServerHealth.mockResolvedValue({ available: false });
  await checkLocalServer(true);
  localServerClient.checkServerHealth.mockResolvedValue({ available: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("generateAI with an empty prompt", () => {
  describe.each(Object.entries(BACKENDS))("%s backend", (_name, backend) => {
    it.each(EMPTY_PROMPTS)(
      "answers with the request and reaches no backend: %s",
      async (_label, prompt) => {
        await backend.setup();
        const result = await generateAI(prompt, callOptions());

        expect(result).toEqual({
          text: EMPTY_PROMPT_REPLY,
          mode: backend.mode,
          onDevice: backend.onDevice,
        });
        expect(backend.calls()).toBe(0);
      },
    );

    it("still sends a real prompt", async () => {
      await backend.setup();
      const result = await generateAI(
        "What is my combined rating?",
        callOptions(),
      );
      expect(backend.calls()).toBe(1);
      expect(result.text).not.toBe(EMPTY_PROMPT_REPLY);
      expect(Object.keys(result)).toEqual(
        expect.arrayContaining(["text", "mode", "onDevice"]),
      );
    });
  });

  it("gives the same answer when a caller systemPrompt is supplied, because no caller sends all its content there", async () => {
    await BACKENDS.swarm.setup();
    const result = await generateAI(
      "  ",
      callOptions({ systemPrompt: "You are a helper." }),
    );
    expect(result.text).toBe(EMPTY_PROMPT_REPLY);
    expect(BACKENDS.swarm.calls()).toBe(0);
  });

  it("answers when the configured backend is not ready", async () => {
    setAIMode(AI_MODES.SWARM);
    const result = await generateAI("", callOptions());
    expect(result.text).toBe(EMPTY_PROMPT_REPLY);
    expect(diamondSwarm.generateWithSwarm).not.toHaveBeenCalled();
  });

  it("answers while the circuit breaker is open, when a real prompt is refused", async () => {
    await BACKENDS.swarm.setup();
    diamondSwarm.generateWithSwarm.mockRejectedValue(
      new Error("engine failed"),
    );
    for (let i = 0; i < 3; i++) {
      await expect(
        generateAI("a real question", callOptions()),
      ).rejects.toThrow();
    }
    await expect(generateAI("a real question", callOptions())).rejects.toThrow(
      /AI_CIRCUIT_OPEN/,
    );
    const result = await generateAI("", callOptions());
    expect(result.text).toBe(EMPTY_PROMPT_REPLY);
  });

  it("runs ahead of the rater route: an empty prompt with conditions still reaches no model", async () => {
    await BACKENDS.swarm.setup();
    const result = await generateAI(
      "",
      callOptions({
        toolId: "rating-calculator",
        conditions: [
          { name: "PTSD", rating: 50, side: "none", bodyPart: "mental" },
        ],
      }),
    );
    expect(result.text).toBe(EMPTY_PROMPT_REPLY);
    expect(BACKENDS.swarm.calls()).toBe(0);
  });
});

describe("EMPTY_PROMPT_REPLY", () => {
  it("asks the veteran what they need, in plain language, without the app's own context", () => {
    expect(EMPTY_PROMPT_REPLY).toMatch(/what you need help with/);
    expect(EMPTY_PROMPT_REPLY).not.toMatch(
      /You are an AI assistant|Vet-Rate\.org|system prompt/i,
    );
    expect(EMPTY_PROMPT_REPLY.length).toBeLessThan(250);
  });
});
