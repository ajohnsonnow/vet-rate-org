/**
 * On a rating answer the calculator's working is the answer. The model's text
 * is kept below it only when it adds words, not arithmetic: no decimals, no
 * rounding, no equations, no figure the working does not contain, and no
 * second statement of the result.
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
vi.mock("../../utils/deviceCapabilityDetector", () => ({
  detectDeviceCapabilities: vi.fn().mockResolvedValue({
    tier: "desktop-high",
    contextWindowSize: 12288,
    hasWebGPU: true,
    canUseWebLLM: true,
  }),
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
  CALCULATOR_COMMENTARY_LEAD,
} from "../../utils/unifiedAIService";
import * as diamondSwarm from "../../utils/diamondSwarm";
import { AI_DATA_CLASS } from "../../utils/aiDataClassPolicy";
import { calculateVARating } from "../../utils/vaCalculator";
import { findCommentaryArithmetic } from "../../utils/raterGrounding";
import { GOLDEN, commentaryOf, gradedIntegratedCase } from "./recordedAnswers";

const four = calculateVARating(GOLDEN.a11.conditions);
const single = calculateVARating(GOLDEN.a24.conditions);
const reasons = (text, calc = four, options) =>
  findCommentaryArithmetic(text, calc, options);

describe("findCommentaryArithmetic", () => {
  it.each([
    [
      "a decimal figure",
      "The last step comes to 74.8 before rounding up.",
      "decimal",
    ],
    ["a decimal percentage", "That is 74.8%.", "decimal"],
    ["rounding talk", "It is then rounded to the nearest ten.", "rounding"],
    ["an equation", "50 + 30 - 15 = 65", "equation"],
    [
      "arithmetic with no equals sign",
      "Take 50% + 30% and remove the overlap.",
      "equation",
    ],
    [
      "a figure the working does not contain",
      "The interim value is 70%.",
      "figure",
    ],
    ["a figure in words", "That gives 85 percent overall.", "figure"],
    [
      "the result said again",
      "Your combined disability rating is 80%.",
      "result",
    ],
    ["the result as a heading", "**Combined Rating: 80%**", "result"],
    [
      "a refusal under working that just answered",
      "I cannot calculate your combined rating without your records.",
      "refusal",
    ],
    [
      "a request for what was already given",
      "Please provide your ratings.",
      "refusal",
    ],
  ])("finds %s", (_name, text, reason) => {
    expect(reasons(text)).toContain(reason);
  });

  it.each([
    [
      "words about the method",
      "VA starts with the largest rating and works down, so the order you list them in does not matter.",
    ],
    [
      "a regulation cited by section",
      "38 CFR § 4.25 and § 4.26(c) govern this; see also 38 CFR 3.310.",
    ],
    [
      "the ratings entered",
      "You entered PTSD at 50%, tinnitus at 30%, back at 20% and knee at 10%.",
    ],
    [
      "a step value the working contains",
      "The 65% after the first step is why the total is not a simple sum.",
    ],
    [
      "the ten percent bilateral factor and the 100 percent cap",
      "The 10% bilateral factor applies only to paired limbs, and no rating exceeds 100%.",
    ],
    [
      "next steps",
      "A Veterans Service Officer can check these figures with you.",
    ],
    ["nothing at all", ""],
  ])("allows %s", (_name, text) => {
    expect(reasons(text)).toEqual([]);
  });

  it("allows the 4.16(a) threshold figures only for a TDIU question", () => {
    const text =
      "The thresholds are 60 percent for one condition, or 70 percent with one at 40 percent.";
    expect(reasons(text, single, { tdiu: true })).toEqual([]);
    expect(reasons(text, single)).toContain("figure");
  });
});

describe("the two kept commentaries in the graded integrated run", () => {
  it("a11: argues its way to 74.8 and 70%, and is dropped", () => {
    const commentary = commentaryOf(
      gradedIntegratedCase("a11"),
      CALCULATOR_COMMENTARY_LEAD,
    );
    expect(commentary).toContain("74.8 rounded to the nearest 10 is **70%**");
    expect(reasons(commentary)).toEqual(
      expect.arrayContaining([
        "decimal",
        "rounding",
        "equation",
        "figure",
        "result",
      ]),
    );
  });

  it("a24: only says the answer a second time, and is dropped", () => {
    const commentary = commentaryOf(
      gradedIntegratedCase("a24"),
      CALCULATOR_COMMENTARY_LEAD,
    );
    expect(commentary).toContain("**Combined Rating: 100%**");
    expect(reasons(commentary, single)).toEqual(["result"]);
  });
});

describe("generateAI on a rater route with conditions", () => {
  const ask = (text) => {
    diamondSwarm.generateWithSwarm.mockResolvedValue({ text });
    return generateAI("What is my combined rating?", {
      dataClass: AI_DATA_CLASS.CONTEXT,
      skipCrisisCheck: true,
      skipFeatureCheck: true,
      skipHallucinationCheck: true,
      skipValidation: true,
      useDKB: false,
      toolId: "rating-calculator",
      conditions: GOLDEN.a11.conditions,
    });
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    resetAICircuitBreaker();
    registerSwarmEngine({}, true, false, "auditor");
    setAIMode(AI_MODES.SWARM);
  });

  it("shows the working alone, with no notice and no heading, when the commentary has its own arithmetic", async () => {
    const commentary = commentaryOf(
      gradedIntegratedCase("a11"),
      CALCULATOR_COMMENTARY_LEAD,
    );
    const result = await ask(commentary);
    expect(result.text.startsWith("Your combined rating is 80%.")).toBe(true);
    expect(result.text).not.toContain("74.8");
    expect(result.text).not.toContain(CALCULATOR_COMMENTARY_LEAD);
    expect(result.text).not.toContain("draft answer");
    expect(result.text.match(/combined rating is 80%/gi)).toHaveLength(1);
    expect(result.calculatorLead).toEqual({
      expected: 80,
      commentaryKept: false,
      commentaryDropped: [
        "decimal",
        "rounding",
        "equation",
        "figure",
        "result",
      ],
    });
    expect(result.calculatorReplacement).toBeUndefined();
  });

  it("keeps commentary that adds words and no arithmetic", async () => {
    const text =
      "VA starts with the largest rating and works down, so the order you list them in does not matter.";
    const result = await ask(text);
    expect(
      result.text.endsWith(`${CALCULATOR_COMMENTARY_LEAD}\n\n${text}`),
    ).toBe(true);
    expect(result.calculatorLead).toEqual({
      expected: 80,
      commentaryKept: true,
    });
  });
});
