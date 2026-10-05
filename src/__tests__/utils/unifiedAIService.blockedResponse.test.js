/**
 * What generateAI returns when the response validator blocks an answer: a
 * plain message, never the blocked text, which stays on a diagnostic field.
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
  resetAICircuitBreaker,
  BLOCKED_RESPONSE_MESSAGE,
  CALCULATOR_COMMENTARY_LEAD,
} from "../../utils/unifiedAIService";
import * as diamondSwarm from "../../utils/diamondSwarm";
import { AI_DATA_CLASS } from "../../utils/aiDataClassPolicy";
import { validateAIResponse } from "../../utils/aiSystemPrompts";

const BLOCKED_DRAFT =
  "As a physician, I diagnose this as sleep apnea caused by your service.";
const BLOCK_ERROR = "BLOCKED: Response contains forbidden medical roleplay";

const ask = (text, extra = {}) => {
  diamondSwarm.generateWithSwarm.mockResolvedValue({ text });
  return generateAI("Is my sleep apnea service connected?", {
    dataClass: AI_DATA_CLASS.CONTEXT,
    skipCrisisCheck: true,
    skipFeatureCheck: true,
    skipHallucinationCheck: true,
    useDKB: false,
    ...extra,
  });
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  resetAICircuitBreaker();
  registerSwarmEngine({}, true, false, "auditor");
  setAIMode(AI_MODES.SWARM);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("a blocked answer", () => {
  it("is replaced by a plain message; the blocked text is kept only for diagnosis", async () => {
    const result = await ask(BLOCKED_DRAFT);
    expect(result.text).toBe(BLOCKED_RESPONSE_MESSAGE);
    expect(result.text).not.toContain("diagnose");
    expect(result.blocked).toBe(true);
    expect(result.blockedText).toBe(BLOCKED_DRAFT);
    expect(result.validationErrors).toContain(BLOCK_ERROR);
  });

  it("the message is plain text with no symbols, and says what to do next", () => {
    expect(BLOCKED_RESPONSE_MESSAGE).toMatch(/^[\x20-\x7E]+$/);
    expect(BLOCKED_RESPONSE_MESSAGE).toContain("is not shown");
    expect(BLOCKED_RESPONSE_MESSAGE).toContain("Veterans Service Officer");
    expect(validateAIResponse(BLOCKED_RESPONSE_MESSAGE).isValid).toBe(true);
  });

  it("an answer that passes is returned as it was", async () => {
    const text = "Sleep apnea can be claimed as secondary to PTSD.";
    const result = await ask(text);
    expect(result.text).toBe(text);
    expect(result.blocked).toBeUndefined();
    expect(result.blockedText).toBeUndefined();
  });

  it("skipValidation leaves the text alone, as before", async () => {
    const result = await ask(BLOCKED_DRAFT, { skipValidation: true });
    expect(result.text).toBe(BLOCKED_DRAFT);
    expect(result.blocked).toBeUndefined();
  });

  it.each([
    ["JSON text", `{"summary": "${BLOCKED_DRAFT}"}`, {}],
    ["a fenced block", `\`\`\`json\n{"s": "${BLOCKED_DRAFT}"}\n\`\`\``, {}],
    ["a caller that expects JSON", BLOCKED_DRAFT, { expectJSON: true }],
    [
      "a response format",
      BLOCKED_DRAFT,
      { responseFormat: { type: "object" } },
    ],
  ])(
    "structured output (%s) is still returned for the caller to parse, with the errors",
    async (_name, text, extra) => {
      const result = await ask(text, extra);
      expect(result.text).toBe(text);
      expect(result.blocked).toBeUndefined();
      expect(result.validationErrors).toContain(BLOCK_ERROR);
    },
  );

  it("on a rating question the calculator's working still leads, followed by the message", async () => {
    const result = await ask(BLOCKED_DRAFT, {
      toolId: "rating-calculator",
      conditions: [
        { name: "PTSD", rating: 50, side: "none", bodyPart: "mental" },
        { name: "Tinnitus", rating: 10, side: "none", bodyPart: "ear" },
      ],
    });
    expect(result.text.startsWith("Your combined rating is 60%.")).toBe(true);
    expect(result.text.endsWith(BLOCKED_RESPONSE_MESSAGE)).toBe(true);
    expect(result.text).not.toContain(CALCULATOR_COMMENTARY_LEAD);
    expect(result.text).not.toContain("diagnose");
    expect(result.blockedText).toBe(BLOCKED_DRAFT);
    expect(result.calculatorLead.commentaryKept).toBe(false);
  });
});
