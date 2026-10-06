/**
 * An answer the engine stopped for length ends mid-sentence. For prose it is
 * trimmed to its last complete sentence and one plain line says it was cut
 * short. Structured output is left for its parser.
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
  checkLocalServer,
  CUT_SHORT_NOTICE,
  REPEATED_NOTICE,
} from "../../utils/unifiedAIService";
import * as diamondSwarm from "../../utils/diamondSwarm";
import { AI_DATA_CLASS } from "../../utils/aiDataClassPolicy";
import { trimToLastSentence } from "../../utils/outputCleanup";
import { GOLDEN, gradedIntegratedCase } from "./recordedAnswers";

const callOptions = (overrides = {}) => ({
  dataClass: AI_DATA_CLASS.CONTEXT,
  skipCrisisCheck: true,
  skipFeatureCheck: true,
  skipHallucinationCheck: true,
  skipValidation: true,
  useDKB: false,
  ...overrides,
});

describe("trimToLastSentence", () => {
  it.each([
    [
      "a sentence cut mid-way",
      "File the form first. Then gather your rec",
      "File the form first.",
    ],
    [
      "a dangling bold marker (a26)",
      'This is a higher bar than "new and relevant" evidence.\n\n**',
      'This is a higher bar than "new and relevant" evidence.',
    ],
    [
      "a list item left as a bare number",
      "Do this first.\n\n2.",
      "Do this first.",
    ],
    [
      "a half-written heading (a11)",
      "Your rating is unchanged.\n\n**Restatement of Final Result",
      "Your rating is unchanged.",
    ],
    [
      "a decimal at the cut",
      "The value is settled. The next figure is 74.",
      "The value is settled.",
    ],
    [
      "a closing quote and bracket",
      'He said "stop." (This matters.) And th',
      'He said "stop." (This matters.)',
    ],
    [
      "an abbreviation before the cut",
      "Bring records. See e.g. the DD-214 and",
      "Bring records.",
    ],
    ["a question", "Is it filed? If so, the da", "Is it filed?"],
  ])("%s", (_name, text, kept) => {
    expect(trimToLastSentence(text)).toBe(kept);
  });

  it("leaves text with no complete sentence as it is", () => {
    expect(trimToLastSentence("Based on the information you")).toBe(
      "Based on the information you",
    );
  });

  it("leaves a complete answer alone", () => {
    const text = "File the form. Then wait.";
    expect(trimToLastSentence(text)).toBe(text);
  });

  it("trims the recorded a26 answer to its last full sentence", () => {
    const shown = gradedIntegratedCase("a26").response.split(
      "\n\nVet-Rate could not verify",
    )[0];
    expect(shown.endsWith("**")).toBe(true);
    const kept = trimToLastSentence(shown);
    expect(kept.endsWith('"new and relevant" evidence.')).toBe(true);
    expect(shown.startsWith(kept)).toBe(true);
  });
});

const CUT = "File an Intent to File first. Then gather your rec";
const swarmReplies = (reply) => {
  registerSwarmEngine({}, true, false, "auditor");
  setAIMode(AI_MODES.SWARM);
  diamondSwarm.generateWithSwarm.mockResolvedValue(reply);
};

beforeEach(async () => {
  localStorage.clear();
  vi.clearAllMocks();
  resetAICircuitBreaker();
  registerSwarmEngine(null, false, false, null);
  registerLocalAIEngine(null, false, false, null, false);
  await checkLocalServer(true);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("generateAI when the swarm stopped for length", () => {
  it("the notice is one plain line", () => {
    expect(CUT_SHORT_NOTICE).toBe(
      "This answer was cut short because it reached the length limit. Ask for the rest if you need it.",
    );
  });

  it("swarm: trims to the last sentence and says the answer was cut short", async () => {
    swarmReplies({ text: CUT, truncated: true });
    const result = await generateAI("How do I start a claim?", callOptions());
    expect(result.text).toBe(
      `File an Intent to File first.\n\n${CUT_SHORT_NOTICE}`,
    );
    expect(result.truncated).toBe(true);
  });

  it("swarm: when the cut removed a repetition, says it started repeating and suggests rephrasing", async () => {
    const trimmed = { kind: "block", copies: 4, removedChars: 3000 };
    swarmReplies({
      text: CUT,
      truncated: true,
      outputCleanup: { echoRemoved: false, trimmed },
    });
    const result = await generateAI("How do I start a claim?", callOptions());
    expect(result.text).toBe(
      `File an Intent to File first.

${REPEATED_NOTICE}`,
    );
    expect(result.text).not.toMatch(/length limit|Ask for the rest/);
    expect(result.truncated).toBe(true);
  });

  it("the repetition notice is one plain line", () => {
    expect(REPEATED_NOTICE).toBe(
      "This answer started repeating itself and was stopped. Try rephrasing your question.",
    );
  });

  it("swarm: a clean-up that only removed a wrapper echo keeps the length note", async () => {
    swarmReplies({
      text: CUT,
      truncated: true,
      outputCleanup: { echoRemoved: true, trimmed: null },
    });
    const result = await generateAI("How do I start a claim?", callOptions());
    expect(result.text).toBe(
      `File an Intent to File first.

${CUT_SHORT_NOTICE}`,
    );
  });

  it("swarm: the repetition flag of one call does not leak into the next", async () => {
    const trimmed = { kind: "block", copies: 4, removedChars: 3000 };
    swarmReplies({ text: CUT, truncated: true, outputCleanup: { trimmed } });
    await generateAI("How do I start a claim?", callOptions());
    swarmReplies({ text: CUT, truncated: true });
    const second = await generateAI("How do I start a claim?", callOptions());
    expect(second.text).toBe(
      `File an Intent to File first.

${CUT_SHORT_NOTICE}`,
    );
  });

  it("swarm: an answer that finished on its own is untouched", async () => {
    swarmReplies({ text: CUT, truncated: false });
    const result = await generateAI("How do I start a claim?", callOptions());
    expect(result.text).toBe(CUT);
    expect(result.truncated).toBeUndefined();
  });

  it.each([
    ["JSON text", '{"summary": "File an Intent to F', {}],
    ["a caller that expects JSON", CUT, { expectJSON: true }],
    ["a response format", CUT, { responseFormat: { type: "object" } }],
  ])(
    "structured output (%s) is not trimmed and gets no notice",
    async (_n, text, extra) => {
      swarmReplies({ text, truncated: true });
      const result = await generateAI("Summarise this.", callOptions(extra));
      expect(result.text).toBe(text);
      expect(result.truncated).toBe(true);
    },
  );
});

describe("the other engines and the rating answer", () => {
  it("legacy local engine: finish_reason length is read", async () => {
    registerLocalAIEngine(
      {
        chat: {
          completions: {
            create: vi.fn(async () => ({
              choices: [{ message: { content: CUT }, finish_reason: "length" }],
            })),
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
    const result = await generateAI("How do I start a claim?", callOptions());
    expect(result.text).toBe(
      `File an Intent to File first.\n\n${CUT_SHORT_NOTICE}`,
    );
  });

  it("cloud: MAX_TOKENS is read, with the same line and no symbol", async () => {
    localStorage.setItem(
      "vetrate_gemini_key",
      "AIzaSyValidKey12345678901234567890123",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            { content: { parts: [{ text: CUT }] }, finishReason: "MAX_TOKENS" },
          ],
        }),
      }),
    );
    setAIMode(AI_MODES.CLOUD);
    const result = await generateAI("How do I start a claim?", callOptions());
    expect(result.text).toBe(
      `File an Intent to File first.\n\n${CUT_SHORT_NOTICE}`,
    );
    expect(result.text).not.toContain("[This response was cut off");
  });

  it("a rating answer cut short keeps the calculator's working and drops the commentary", async () => {
    swarmReplies({
      text: "The order of the ratings does not matter. The largest ra",
      truncated: true,
    });
    const result = await generateAI(
      "What is my combined rating?",
      callOptions({
        toolId: "rating-calculator",
        conditions: GOLDEN.a11.conditions,
      }),
    );
    expect(result.text.startsWith("Your combined rating is 80%.")).toBe(true);
    expect(result.text).not.toContain("The largest ra");
    expect(result.text).not.toContain(CUT_SHORT_NOTICE);
    expect(result.calculatorLead).toEqual({
      expected: 80,
      commentaryKept: false,
      commentaryDropped: ["cut short"],
    });
  });
});

describe("the evaluation's frequency penalty reaches the swarm", () => {
  it("is passed through when generateAI is given one, and absent otherwise", async () => {
    swarmReplies({ text: CUT, truncated: false });
    await generateAI("How do I start a claim?", callOptions());
    expect(
      diamondSwarm.generateWithSwarm.mock.calls.at(-1)[1],
    ).not.toHaveProperty("frequencyPenalty");
    await generateAI(
      "How do I start a claim?",
      callOptions({ frequencyPenalty: 0.6 }),
    );
    expect(diamondSwarm.generateWithSwarm.mock.calls.at(-1)[1]).toMatchObject({
      frequencyPenalty: 0.6,
    });
  });
});
