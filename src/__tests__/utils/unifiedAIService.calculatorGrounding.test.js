/**
 * injectCalculatorForRater — grounds the Rater agent's bilateral-factor math
 * in the deterministic vaCalculator.js engine instead of letting the LLM
 * freehand the arithmetic. This was the confirmed root cause of the swarm's
 * bilateral-pairing hallucinations (see llm-compiler v3-v5 retrain history):
 * the model repeatedly paired the two highest-rated conditions instead of
 * checking body part + side.
 *
 * The injection happens at one point (_buildFullPrompt, before the ADR-008
 * redaction), so these tests drive the real generateAI against each backend.
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
  injectCalculatorForRater,
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
import * as localServerClient from "../../utils/localServerClient";
import { calculateVARating } from "../../utils/vaCalculator";
import { AI_DATA_CLASS } from "../../utils/aiDataClassPolicy";

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

const BLOCK_MARKER = "=== COMPUTED RESULT";
const countBlocks = (text) => text.split(BLOCK_MARKER).length - 1;

const BILATERAL_CONDITIONS = [
  { name: "Lumbar strain", rating: 40, side: "none", bodyPart: "back" },
  { name: "Left knee strain", rating: 30, side: "left", bodyPart: "knee" },
  { name: "Right knee strain", rating: 20, side: "right", bodyPart: "knee" },
];

const callOptions = (overrides = {}) => ({
  dataClass: AI_DATA_CLASS.CONTEXT,
  skipCrisisCheck: true,
  skipFeatureCheck: true,
  skipHallucinationCheck: true,
  skipValidation: true,
  useDKB: false,
  conditions: BILATERAL_CONDITIONS,
  ...overrides,
});

const RATER_ROUTES = [
  ["toolId rating-calculator", { toolId: "rating-calculator" }],
  ["toolId tdiu-builder", { toolId: "tdiu-builder" }],
  ["taskType rating", { taskType: "rating" }],
  ["taskType calculator", { taskType: "calculator" }],
];

const NON_RATER_ROUTES = [
  ["toolId cfile-analyzer (auditor)", { toolId: "cfile-analyzer" }],
  ["toolId nexus-builder (writer)", { toolId: "nexus-builder" }],
  ["taskType cfile (auditor)", { taskType: "cfile" }],
  ["taskType statement (writer)", { taskType: "statement" }],
  ["no route", {}],
];

const localEngineCalls = [];

const BACKENDS = {
  swarm: {
    setup: () => {
      registerSwarmEngine({}, true, false, "auditor");
      setAIMode(AI_MODES.SWARM);
      diamondSwarm.generateWithSwarm.mockResolvedValue({ text: "ok" });
    },
    sent: () => {
      const [prompt, opts] = diamondSwarm.generateWithSwarm.mock.calls[0];
      return `${opts.systemPrompt || ""}\n${prompt}`;
    },
  },
  local: {
    setup: () => {
      registerLocalAIEngine(
        {
          chat: {
            completions: {
              create: vi.fn(async (config) => {
                localEngineCalls.push(config);
                return {
                  choices: [
                    { message: { content: "ok" }, finish_reason: "stop" },
                  ],
                };
              }),
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
    },
    sent: () => localEngineCalls[0].messages.map((m) => m.content).join("\n"),
  },
  "local server": {
    setup: async () => {
      await checkLocalServer(true);
      setAIMode(AI_MODES.LOCAL_SERVER);
    },
    sent: () =>
      localServerClient.chatCompletion.mock.calls[0][0]
        .map((m) => m.content)
        .join("\n"),
  },
  cloud: {
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
    sent: () =>
      JSON.parse(fetch.mock.calls[0][1].body).contents[0].parts[0].text,
  },
};

beforeEach(async () => {
  localStorage.clear();
  vi.clearAllMocks();
  resetAICircuitBreaker();
  registerSwarmEngine(null, false, false, null);
  registerLocalAIEngine(null, false, false, null, false);
  localEngineCalls.length = 0;
  vi.stubGlobal("fetch", vi.fn());
  localServerClient.checkServerHealth.mockResolvedValue({ available: false });
  await checkLocalServer(true);
  localServerClient.checkServerHealth.mockResolvedValue({ available: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("rater-routed generateAI calls are grounded exactly once per backend", () => {
  describe.each(Object.entries(BACKENDS))("%s backend", (_name, backend) => {
    it.each(RATER_ROUTES)(
      "appends the computed block once for %s",
      async (_label, route) => {
        await backend.setup();
        await generateAI("What is my combined rating?", callOptions(route));

        const sent = backend.sent();
        expect(countBlocks(sent)).toBe(1);

        const expected = calculateVARating(BILATERAL_CONDITIONS);
        expect(sent).toContain(
          `Bilateral group rating: ${expected.bilateralGroupRating}`,
        );
        expect(sent).toContain(`Combined rating: ${expected.combinedRating}%`);
        expect(sent).toContain("Left knee strain (left, 30%)");
        expect(sent).toContain("Right knee strain (right, 20%)");
      },
    );

    it.each(NON_RATER_ROUTES)(
      "does not append the block for %s",
      async (_label, route) => {
        await backend.setup();
        await generateAI("What is my combined rating?", callOptions(route));

        expect(countBlocks(backend.sent())).toBe(0);
      },
    );

    it("passes the prompt through unchanged when a rater route has no conditions", async () => {
      await backend.setup();
      await generateAI(
        "What is my combined rating?",
        callOptions({ toolId: "rating-calculator", conditions: undefined }),
      );

      expect(countBlocks(backend.sent())).toBe(0);
    });
  });
});

describe("rater grounding: calculator parity, redaction and wllama", () => {
  it("matches calculateVARating for the bilateral case (48 bilateral group, 70 combined)", async () => {
    await BACKENDS.swarm.setup();
    await generateAI(
      "What is my combined rating?",
      callOptions({ toolId: "rating-calculator" }),
    );

    const expected = calculateVARating(BILATERAL_CONDITIONS);
    expect(expected.bilateralGroupRating).toBe(48);
    expect(expected.combinedRating).toBe(70);
    const sent = BACKENDS.swarm.sent();
    expect(sent).toContain("Bilateral group rating: 48");
    expect(sent).toContain("Combined rating: 70%");
  });

  it("passes the injected block through the same redaction as the rest of the prompt", async () => {
    await BACKENDS.cloud.setup();
    const conditions = [
      {
        name: "Left knee 123-45-6789",
        rating: 30,
        side: "left",
        bodyPart: "knee",
      },
      { name: "Right knee", rating: 20, side: "right", bodyPart: "knee" },
    ];
    await generateAI(
      "What is my combined rating?",
      callOptions({ toolId: "rating-calculator", conditions }),
    );

    const sent = BACKENDS.cloud.sent();
    expect(countBlocks(sent)).toBe(1);
    expect(sent).not.toContain("123-45-6789");
  });

  it("wllama backend: appends the block once for a rater route and not for an auditor route", async () => {
    await initializeWllama("auditor");
    setAIMode(AI_MODES.WLLAMA);
    wllamaService.chatCompletion.mockResolvedValue({
      success: true,
      text: "ok",
    });

    await generateAI(
      "What is my combined rating?",
      callOptions({ toolId: "rating-calculator" }),
    );
    expect(wllamaService.chatCompletion).toHaveBeenCalledTimes(1);
    expect(countBlocks(wllamaService.chatCompletion.mock.calls[0][0])).toBe(1);

    await generateAI(
      "What is my combined rating?",
      callOptions({ toolId: "cfile-analyzer" }),
    );
    expect(countBlocks(wllamaService.chatCompletion.mock.calls[1][0])).toBe(0);
  });

  it("wllama backend: a loaded rater model still grounds a call with conditions and no route", async () => {
    await initializeWllama("rater");
    setAIMode(AI_MODES.WLLAMA);
    wllamaService.chatCompletion.mockResolvedValue({
      success: true,
      text: "ok",
    });

    await generateAI("What is my combined rating?", callOptions());

    expect(countBlocks(wllamaService.chatCompletion.mock.calls[0][0])).toBe(1);
  });
});

describe("rater grounding: the computed block carries the full working", () => {
  it("lists each combining step, the raw value and the single final rounding", async () => {
    await BACKENDS.swarm.setup();
    await generateAI(
      "What is my combined rating?",
      callOptions({
        toolId: "rating-calculator",
        conditions: [
          { name: "PTSD", rating: 50, side: "none", bodyPart: "mental" },
          { name: "Tinnitus", rating: 30, side: "none", bodyPart: "ear" },
          { name: "Back", rating: 20, side: "none", bodyPart: "back" },
          { name: "Knee", rating: 10, side: "none", bodyPart: "knee" },
        ],
      }),
    );

    const sent = BACKENDS.swarm.sent();
    expect(sent).toContain("Step 1: 50% combined with 30% = 65%");
    expect(sent).toContain("Step 2: 65% combined with 20% = 72%");
    expect(sent).toContain("Step 3: 72% combined with 10% = 75%");
    expect(sent).toContain("Combined value before final rounding: 75%");
    expect(sent).toContain("Combined rating: 80%");
    expect(sent).toContain("Bilateral pair: none");
  });
});

const FOUR = [
  { name: "PTSD", rating: 50, side: "none", bodyPart: "mental" },
  { name: "Tinnitus", rating: 30, side: "none", bodyPart: "ear" },
  { name: "Back", rating: 20, side: "none", bodyPart: "back" },
  { name: "Knee", rating: 10, side: "none", bodyPart: "knee" },
];
const ask = (text, extra = {}) => {
  diamondSwarm.generateWithSwarm.mockResolvedValue({ text });
  return generateAI(
    "What is my combined rating?",
    callOptions({ toolId: "rating-calculator", conditions: FOUR, ...extra }),
  );
};

describe("rater grounding: a response that contradicts the calculator is replaced", () => {
  beforeEach(async () => {
    await BACKENDS.swarm.setup();
  });

  it("leaves a response that restates the calculator's figure untouched", async () => {
    const result = await ask("Your combined rating is 80%. Hope that helps.");
    expect(result.text).toBe("Your combined rating is 80%. Hope that helps.");
    expect(result.calculatorReplacement).toBeUndefined();
    expect(result.validationWarnings).toBeUndefined();
  });

  it("replaces a different final rating with the calculator's working and records it", async () => {
    const result = await ask(
      "Your combined rating is 80%. On reflection, the final combined disability rating is 70%.",
    );
    expect(result.text).toContain("Your combined rating is 80%.");
    expect(result.text).toContain("Step 3: 72% combined with 10% = 75%");
    expect(result.text).not.toContain("On reflection");
    expect(result.calculatorReplacement).toMatchObject({
      expected: 80,
      stated: [80, 70],
    });
    expect(result.validationWarnings).toEqual([
      expect.stringContaining("replaced with the calculator's working"),
    ]);
  });

  it("replaces a response that invents a bilateral pair the calculator did not find", async () => {
    const result = await ask(
      "Your combined rating is 80%.\nPTSD (Left Brain) + Tinnitus (Right Ear) is a valid bilateral pair.",
    );
    expect(result.text).toContain("No bilateral pair applies");
    expect(result.calculatorReplacement.inventedPairs).toHaveLength(1);
    expect(result.validationWarnings[0]).toContain("bilateral pair");
  });

  it("records the replacement in validationWarnings when response validation is on", async () => {
    const result = await ask("The final combined rating is 100%.", {
      skipValidation: false,
      loadedRegulations: [],
    });
    expect(result.calculatorReplacement.expected).toBe(80);
    expect(Array.isArray(result.validationWarnings)).toBe(true);
    expect(
      result.validationWarnings.some((w) => w.includes("calculator's working")),
    ).toBe(true);
  });

  it("does not touch a non-rater route even when the figure is wrong", async () => {
    const result = await ask("The final combined rating is 70%.", {
      toolId: "cfile-analyzer",
    });
    expect(result.text).toBe("The final combined rating is 70%.");
    expect(result.calculatorReplacement).toBeUndefined();
  });

  it("does not touch a rater route that has no structured conditions", async () => {
    const result = await ask("The final combined rating is 70%.", {
      conditions: undefined,
    });
    expect(result.text).toBe("The final combined rating is 70%.");
  });
});

describe("rater grounding: an answer with no combined figure gets the calculator's line", () => {
  beforeEach(async () => {
    await BACKENDS.swarm.setup();
  });

  it("appends the calculator's line to an answer that never states the combined rating", async () => {
    const draft = "Here is how VA combines ratings, largest first.";
    const result = await ask(draft);
    expect(result.text).toBe(
      `${draft}

Vet-Rate's calculator result for the ratings you entered: your combined rating is 80% (38 CFR § 4.25).`,
    );
    expect(result.calculatorAppended).toEqual({ expected: 80 });
    expect(result.calculatorReplacement).toBeUndefined();
  });

  it("appends the line when the only figures stated are individual condition ratings", async () => {
    const result = await ask(
      "You have a 50% PTSD rating and a 30% tinnitus rating.",
    );
    expect(result.text).toMatch(/your combined rating is 80% \(38 CFR/);
    expect(result.calculatorAppended).toEqual({ expected: 80 });
  });

  it("appends the line when the answer states only a working value, not the final rating", async () => {
    const result = await ask("The combined value before rounding is 75%.");
    expect(result.text).toContain("your combined rating is 80%");
    expect(result.calculatorAppended).toEqual({ expected: 80 });
  });

  it("returns only the calculator's line when the draft is empty", async () => {
    const result = await ask("");
    expect(result.text).toBe(
      "Vet-Rate's calculator result for the ratings you entered: your combined rating is 80% (38 CFR § 4.25).",
    );
  });

  it("does not append the line to a non-rater route", async () => {
    const result = await ask("No figure here.", { toolId: "cfile-analyzer" });
    expect(result.text).toBe("No figure here.");
    expect(result.calculatorAppended).toBeUndefined();
  });
});

const SIXTY = [
  { name: "Mental health", rating: 60, side: "none", bodyPart: "mental" },
];
const askWith = (prompt, text, conditions) => {
  diamondSwarm.generateWithSwarm.mockResolvedValue({ text });
  return generateAI(
    prompt,
    callOptions({ toolId: "tdiu-builder", conditions }),
  );
};

describe("rater grounding: a replaced answer still answers a TDIU question", () => {
  beforeEach(async () => {
    await BACKENDS.swarm.setup();
  });

  it("adds the 38 CFR § 4.16(a) threshold paragraph to a replaced answer when the prompt mentions TDIU", async () => {
    const result = await askWith(
      "Can I qualify for TDIU with only one 60% mental health rating?",
      "Your combined rating is 70%.",
      SIXTY,
    );
    expect(result.calculatorReplacement).toBeDefined();
    expect(result.text).toContain("Your combined rating is 60%.");
    expect(result.text).toContain(
      "About your question on individual unemployability (TDIU):",
    );
    expect(result.text).toContain(
      "Mental health is rated 60 percent, which meets the threshold for a single disability.",
    );
    expect(result.text).toContain("The percentage is only one part.");
    expect(result.text).toContain("Vet-Rate cannot determine that.");
  });

  it("recognises unemployability worded without the TDIU acronym", async () => {
    const result = await askWith(
      "Am I entitled to individual unemployability?",
      "Your combined rating is 70%.",
      SIXTY,
    );
    expect(result.text).toContain(
      "About your question on individual unemployability",
    );
  });

  it("does not add the paragraph when the prompt does not mention TDIU", async () => {
    const result = await askWith(
      "Calculate my combined rating.",
      "Your combined rating is 70%.",
      SIXTY,
    );
    expect(result.calculatorReplacement).toBeDefined();
    expect(result.text).not.toContain("unemployability");
  });
});

describe("rater grounding: a kept answer to a TDIU question gets the threshold paragraph", () => {
  beforeEach(async () => {
    await BACKENDS.swarm.setup();
  });

  it("appends the paragraph to a kept answer when the prompt mentions TDIU", async () => {
    const result = await askWith(
      "Can I qualify for TDIU with only one 60% mental health rating?",
      "Your combined rating is 60%.",
      SIXTY,
    );
    expect(result.calculatorReplacement).toBeUndefined();
    expect(result.tdiuParagraphAppended).toBe(true);
    expect(result.text.startsWith("Your combined rating is 60%.\n\n")).toBe(
      true,
    );
    expect(result.text).toContain(
      "About your question on individual unemployability (TDIU):",
    );
    expect(result.text).toContain(
      "Mental health is rated 60 percent, which meets the threshold for a single disability.",
    );
    expect(
      result.text.match(/About your question on individual/g),
    ).toHaveLength(1);
  });

  it("appends both the calculator line and the paragraph when the kept answer states no combined rating", async () => {
    const result = await askWith(
      "Can I qualify for TDIU with only one 60% mental health rating?",
      "Yes, the single 60 percent rating meets the TDIU percentage test.",
      SIXTY,
    );
    expect(result.calculatorAppended).toEqual({ expected: 60 });
    expect(result.tdiuParagraphAppended).toBe(true);
    const line = result.text.indexOf("your combined rating is 60%");
    const paragraph = result.text.indexOf("About your question on individual");
    expect(line).toBeGreaterThan(0);
    expect(paragraph).toBeGreaterThan(line);
  });

  it("leaves a kept answer alone when the prompt does not mention TDIU", async () => {
    const result = await askWith(
      "Calculate my combined rating.",
      "Your combined rating is 60%.",
      SIXTY,
    );
    expect(result.text).toBe("Your combined rating is 60%.");
    expect(result.tdiuParagraphAppended).toBeUndefined();
  });
});

describe("rater grounding: a TDIU conclusion that contradicts the thresholds is replaced", () => {
  beforeEach(async () => {
    await BACKENDS.swarm.setup();
  });

  it("replaces an answer that says not eligible when the thresholds are met, and says why", async () => {
    const FOUR_TDIU = [
      { name: "Condition 1", rating: 60, side: "none", bodyPart: "other" },
      { name: "Condition 2", rating: 20, side: "none", bodyPart: "other" },
      { name: "Condition 3", rating: 20, side: "none", bodyPart: "other" },
      { name: "Condition 4", rating: 20, side: "none", bodyPart: "other" },
    ];
    const draft =
      "**TDIU Eligibility Status: NOT ELIGIBLE**\n\nYour combined rating is 80%.";
    const result = await askWith(
      "Am I eligible for TDIU with one 60% rating and three 20% ratings?",
      draft,
      FOUR_TDIU,
    );
    expect(result.text).toContain(
      "gave a TDIU conclusion that did not match the percentage thresholds of 38 CFR § 4.16(a)",
    );
    expect(result.text).not.toContain("stated a combined rating");
    expect(result.text).not.toContain("did not match Vet-Rate's calculator");
    expect(result.text).toContain("Your combined rating is 80%.");
    expect(result.text).toContain(
      "About your question on individual unemployability (TDIU):",
    );
    expect(result.calculatorReplacement.draft).toBe(draft);
    expect(result.calculatorReplacement.reason).toBe(
      "said the 38 CFR § 4.16(a) percentage thresholds are not met but they are met (highest rating 60%, combined 80%)",
    );
    expect(result.calculatorReplacement.tdiuConclusion).toEqual([
      "TDIU Eligibility Status: NOT ELIGIBLE",
    ]);
    expect(result.validationWarnings).toEqual([
      expect.stringContaining("thresholds are not met but they are met"),
    ]);
  });

  it("replaces an answer that says eligible when the thresholds are not met", async () => {
    const result = await askWith(
      "Am I eligible for TDIU with two 30% ratings?",
      "You are eligible for TDIU. Your combined rating is 50%.",
      [
        { name: "Condition 1", rating: 30, side: "none", bodyPart: "other" },
        { name: "Condition 2", rating: 30, side: "none", bodyPart: "other" },
      ],
    );
    expect(result.calculatorReplacement.reason).toContain(
      "said the 38 CFR § 4.16(a) percentage thresholds are met but they are not met",
    );
    expect(result.text).toContain("neither threshold is met");
    expect(result.text).not.toContain("You are eligible for TDIU");
  });

  it("a replacement caused only by the combined figure does not claim a TDIU reason", async () => {
    const result = await askWith(
      "Can I qualify for TDIU with only one 60% mental health rating?",
      "Your combined rating is 70%.",
      SIXTY,
    );
    expect(result.text).toContain(
      "stated a combined rating that did not match Vet-Rate's calculator",
    );
    expect(result.text).not.toContain("gave a TDIU conclusion");
  });

  it("keeps a hedged answer that depends on unemployability and appends the paragraph", async () => {
    const result = await askWith(
      "Can I qualify for TDIU with only one 60% mental health rating?",
      "Your combined rating is 60%. If you are capable of working, you are not eligible for TDIU.",
      SIXTY,
    );
    expect(result.calculatorReplacement).toBeUndefined();
    expect(result.tdiuParagraphAppended).toBe(true);
  });
});
