/**
 * The WebAssembly (wllama) backend has a 4,096-token window and always sends
 * the model's persona ahead of the assembled prompt. The same fit logic as
 * the swarm applies; a request that cannot fit fails with an accurate plain
 * message instead of being sent. Also: a fallback result gets the same
 * validation, block handling and citation check as a primary one.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { buildDKBContextSpy } = vi.hoisted(() => ({
  buildDKBContextSpy: vi.fn(),
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
  WLLAMA_MODELS: {
    auditor: { contextSize: 4096, systemPrompt: "p".repeat(2906) },
  },
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
  initializeWllama,
  BLOCKED_RESPONSE_MESSAGE,
} from "../../utils/unifiedAIService";
import * as wllamaService from "../../utils/wllamaService";
import { AI_DATA_CLASS } from "../../utils/aiDataClassPolicy";

const QUESTION =
  "Can sleep apnea be service connected as secondary to my PTSD?";
const PERSONA_CHARS = 2906;
const SHORT_SYSTEM = "You are the Navigator. Answer plainly. ".repeat(20);

const callOptions = (overrides = {}) => ({
  dataClass: AI_DATA_CLASS.CONTEXT,
  skipCrisisCheck: true,
  skipFeatureCheck: true,
  skipHallucinationCheck: true,
  skipValidation: true,
  ...overrides,
});

const cloudReplies = (text) => {
  localStorage.setItem(
    "vetrate_gemini_key",
    "AIzaSyValidKey12345678901234567890123",
  );
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
    }),
  );
};

const sentToWllama = () => wllamaService.chatCompletion.mock.calls[0];

beforeEach(async () => {
  localStorage.clear();
  vi.clearAllMocks();
  resetAICircuitBreaker();
  registerSwarmEngine(null, false, false, null);
  registerLocalAIEngine(null, false, false, null, false);
  buildDKBContextSpy.mockImplementation(
    async (_q, { maxChars }) =>
      `\n\n=== KEYWORD ${"k".repeat(maxChars - 20)}\n`,
  );
  wllamaService.chatCompletion.mockResolvedValue({ success: true, text: "ok" });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  await initializeWllama("auditor");
  setAIMode(AI_MODES.WLLAMA);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("wllama: a request whose built-in instructions cannot fit 4,096 tokens", () => {
  it("is not sent, and fails with a plain message that says why and what to do", async () => {
    const failure = await generateAI(QUESTION, callOptions()).catch((e) => e);
    expect(wllamaService.chatCompletion).not.toHaveBeenCalled();
    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).toBe(
      "The AI model loaded on this device cannot take this request. Its context window (4,096 tokens) is too small for Vet-Rate's built-in instructions. Use a device with WebGPU, or add a Gemini API key in Settings to use Cloud AI.",
    );
    expect(failure.message).not.toMatch(/4096 token limit|Document/);
    expect(failure.message).toMatch(/^[\x20-\x7E]+$/);
  });

  it("goes to Cloud AI instead when a key is set, with an accurate note", async () => {
    cloudReplies("Cloud answer.");
    const result = await generateAI(QUESTION, callOptions());
    expect(wllamaService.chatCompletion).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      text: "Cloud answer.",
      mode: AI_MODES.CLOUD,
      fallback: true,
      fallbackReason: "context_overflow",
      note: "This request was too long for the AI model on this device, so Cloud AI answered instead.",
    });
  });

  it("a document-classed request never goes to cloud; the plain message is the error", async () => {
    cloudReplies("Cloud answer.");
    const failure = await generateAI(
      QUESTION,
      callOptions({ dataClass: AI_DATA_CLASS.DOCUMENT }),
    ).catch((e) => e);
    expect(fetch).not.toHaveBeenCalled();
    expect(failure.message).toContain("is too small for Vet-Rate's built-in");
  });
});

describe("wllama: a request that can fit is sized to the window", () => {
  const tokensSent = () =>
    Math.ceil((PERSONA_CHARS + sentToWllama()[0].length) / 3);

  it("sizes reference material to what 4,096 tokens leave", async () => {
    await generateAI(
      QUESTION,
      callOptions({ systemPrompt: SHORT_SYSTEM, maxTokens: 1024 }),
    );
    const [prompt, opts] = sentToWllama();
    expect(prompt).toContain(QUESTION);
    expect(opts.maxTokens).toBe(1024);
    expect(tokensSent() + 1024).toBeLessThanOrEqual(4096);
    expect(buildDKBContextSpy.mock.calls[0][1].maxChars).toBeLessThan(4000);
  });

  it("drops reference material and lowers the output limit when 2,048 tokens cannot be left", async () => {
    await generateAI(
      QUESTION,
      callOptions({ systemPrompt: "s".repeat(4000), maxTokens: 2048 }),
    );
    const [prompt, opts] = sentToWllama();
    expect(prompt).not.toContain("=== KEYWORD");
    expect(prompt).not.toContain("=== VERIFIED REFERENCE ===");
    expect(opts.maxTokens).toBeLessThan(2048);
    expect(opts.maxTokens).toBeGreaterThanOrEqual(256);
    expect(tokensSent() + opts.maxTokens).toBeLessThanOrEqual(4096);
  });

  it("refuses a caller prompt too long to leave any useful output, naming the request", async () => {
    const failure = await generateAI(
      QUESTION,
      callOptions({ systemPrompt: "s".repeat(12000) }),
    ).catch((e) => e);
    expect(wllamaService.chatCompletion).not.toHaveBeenCalled();
    expect(failure.message).toBe(
      "This request is too long for the AI model loaded on this device (context window 4,096 tokens). Shorten your question or the text you pasted and try again, or add a Gemini API key in Settings so longer requests can use Cloud AI.",
    );
  });
});

describe("a fallback result is checked like a primary one", () => {
  const BLOCKED = "As a doctor, I diagnose you with sleep apnea.";
  const failingLocal = () => {
    registerLocalAIEngine(
      {
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue(new Error("GPU lost")),
          },
        },
      },
      true,
      false,
      "test-model",
      false,
    );
    registerSwarmEngine(null, false, false, null);
    setAIMode(AI_MODES.LOCAL);
  };
  const validated = (extra = {}) =>
    callOptions({ skipValidation: false, useDKB: false, ...extra });

  it("a blocked answer from the fallback backend is replaced by the message", async () => {
    cloudReplies(BLOCKED);
    failingLocal();
    const result = await generateAI(QUESTION, validated());
    expect(result).toMatchObject({
      mode: AI_MODES.CLOUD,
      fallback: true,
      text: BLOCKED_RESPONSE_MESSAGE,
      blocked: true,
      blockedText: BLOCKED,
    });
  });

  it("a clean fallback answer is returned with its fallback fields", async () => {
    cloudReplies("Sleep apnea can be claimed as secondary to PTSD.");
    failingLocal();
    const result = await generateAI(QUESTION, validated());
    expect(result.text).toBe(
      "Sleep apnea can be claimed as secondary to PTSD.",
    );
    expect(result.fallback).toBe(true);
    expect(result.blocked).toBeUndefined();
  });

  it("an unverifiable citation in a fallback answer gets the notice", async () => {
    cloudReplies("See 38 CFR § 4.9999 for the rule.");
    failingLocal();
    const result = await generateAI(QUESTION, validated());
    expect(result.citationsUnverified).toEqual({ sections: ["4.9999"] });
    expect(result.text).toContain("Vet-Rate could not verify a citation");
  });

  it("a blocked answer from the context-overflow fallback is replaced too", async () => {
    cloudReplies(BLOCKED);
    const result = await generateAI(QUESTION, validated());
    expect(result).toMatchObject({
      fallbackReason: "context_overflow",
      text: BLOCKED_RESPONSE_MESSAGE,
      blocked: true,
    });
  });

  it("skipValidation still skips it on a fallback", async () => {
    cloudReplies(BLOCKED);
    failingLocal();
    const result = await generateAI(QUESTION, callOptions({ useDKB: false }));
    expect(result.text).toBe(BLOCKED);
  });
});
