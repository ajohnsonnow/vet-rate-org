import { describe, it, expect } from "vitest";
import { calculateVARating } from "../../utils/vaCalculator";
import {
  buildCalculatorExplanation,
  buildReplacementNotice,
  checkRaterResponse,
  describeMismatch,
  findCalculatorDisputes,
  findReworkedFigures,
} from "../../utils/raterGrounding";
import { enforceCalculatorOnResult } from "../../utils/unifiedAIService";
import { GOLDEN, raterAnswers } from "./recordedAnswers";

const knees = calculateVARating(GOLDEN.a12.conditions);
const four = calculateVARating(GOLDEN.a11.conditions);
const tdiuSet = calculateVARating(GOLDEN.a13.conditions);

describe("findCalculatorDisputes", () => {
  it.each([
    'The prompt says "10% combined with 10% = 19%". This is mathematically incorrect for the standard VA formula.',
    'This seems to be an error in the provided "Computed Result" block (which should be 80%).',
    "Discrepancy Note: The provided computed result states the bilateral group rating is 21%.",
    "The calculator is wrong here: the knees add to 20%.",
  ])("finds: %s", (text) => {
    expect(findCalculatorDisputes(text)).not.toHaveLength(0);
  });

  it.each([
    "The computed result gives a combined rating of 50%.",
    "There is no error in the computed result: the combined rating is 50%.",
    "A common but incorrect idea is that VA adds ratings together.",
    "Vet-Rate's calculator rounds once, at the end.",
  ])("leaves alone: %s", (text) => {
    expect(findCalculatorDisputes(text)).toEqual([]);
  });
});

describe("findReworkedFigures", () => {
  it.each([
    ["a plain sum of the knees", "Left knee (10%) + Right knee (10%) = 20%"],
    ["a ten percent bonus on that sum", "Total group rating: 20% + 2% = 22%"],
    ["LaTeX working", String.raw`$20\% \times 1.10 = 22\%$`],
    [
      "ratings added where the calculator combines them",
      "30% (Back) + 21% (Bilateral Group) = **51%**.",
    ],
    ["a total over 100", String.raw`\[ \text{Combined Rating} = 111 \]`],
  ])("finds %s", (_name, text) => {
    expect(findReworkedFigures(text, knees)).not.toHaveLength(0);
  });

  it.each([
    ["the calculator's own step", "Step 1: 30% combined with 21% = 45%"],
    [
      "the formula written out with the calculator's values",
      String.raw`$30 + (21 \times 0.70) = 30 + 14.7 = 44.7\%$`,
    ],
    ["the bilateral group", "10 + 9 = 19%, and 19 + 1.9 = 20.9%, so 21%"],
    ["the remaining efficiency", "90% of 90% = 81% remaining, so 19%"],
    ["a comparison", "Your combined rating is >= 50%."],
    [
      "an example about other ratings",
      "For example, 50% + 30% = 80% is not how VA combines ratings.",
    ],
    [
      "a hypothetical",
      "If VA simply added them, 30% + 21% = 51%, but it does not.",
    ],
    ["a monthly payment", "Monthly payment = $1,075.16"],
  ])("leaves alone %s", (_name, text) => {
    expect(findReworkedFigures(text, knees)).toEqual([]);
  });

  it("accepts the subtraction form of each combining step", () => {
    const text = [
      "Calculation: $50 + 30 - 15 = 65$",
      "Calculation: $65 + 20 - 13 = 72$",
      "Calculation: $72 + 10 - 7.2 = 74.8$",
      "50% + 30% = 65%; 65% + 20% = 72%; 72% + 10% = 74.8%.",
    ].join("\n");
    expect(findReworkedFigures(text, four)).toEqual([]);
  });

  it("flags ratings added when the sum happens to be the combined rating", () => {
    expect(
      findReworkedFigures(
        "1. Combine the two highest: 60% + 20% = 80%",
        tdiuSet,
      ),
    ).toHaveLength(1);
  });
});

describe("checkRaterResponse with a disputed or re-derived answer", () => {
  const disputed =
    "Final Combined Rating: 50%\n10% + 10% = 20%\nThe computed result says 19%, which is mathematically incorrect.";

  it("is not ok although the final figure is right", () => {
    const check = checkRaterResponse(disputed, knees);
    expect(check.stated).toEqual([50]);
    expect(check.wrongFigures).toEqual([]);
    expect(check.reworked).toEqual(["10% + 10% = 20%"]);
    expect(check.disputes).toHaveLength(1);
    expect(check.ok).toBe(false);
  });

  it("the notice names the working and the dispute, not the combined rating", () => {
    const notice = buildReplacementNotice(checkRaterResponse(disputed, knees));
    expect(notice).toContain(
      "showed working that did not match Vet-Rate's calculator",
    );
    expect(notice).toContain(
      "questioned the result from Vet-Rate's calculator",
    );
    expect(notice).not.toContain("stated a combined rating");
  });

  it("the recorded reason quotes the line and the sentence", () => {
    const reason = describeMismatch(checkRaterResponse(disputed, knees));
    expect(reason).toContain(
      'showed working the calculator did not produce (from: "10% + 10% = 20%")',
    );
    expect(reason).toContain("disputed the computed result (from: ");
  });

  it("enforceCalculatorOnResult replaces it with the calculator's working", () => {
    const out = enforceCalculatorOnResult(
      { text: disputed },
      { conditions: GOLDEN.a12.conditions },
      GOLDEN.a12.input,
    );
    expect(out.text).toContain("30% combined with 21% = 45%");
    expect(out.text).not.toContain("mathematically incorrect");
    expect(out.calculatorReplacement.draft).toBe(disputed);
    expect(out.calculatorReplacement.reworked).toEqual(["10% + 10% = 20%"]);
    expect(out.calculatorReplacement.disputes).toHaveLength(1);
  });

  it.each(["a11", "a12", "a13", "a24", "a25"])(
    "the calculator's own explanation for %s passes the check",
    (id) => {
      const calc = calculateVARating(GOLDEN[id].conditions);
      const text = buildCalculatorExplanation(calc, { tdiu: true });
      const check = checkRaterResponse(text, calc);
      expect(check.reworked).toEqual([]);
      expect(check.disputes).toEqual([]);
      expect(check.ok).toBe(true);
    },
  );
});

/**
 * Every Rater answer in the results folder that questions the computed block
 * or shows working the calculator did not produce, labelled by reading each
 * one. `acceptedBefore` marks those the earlier check let through.
 */
const DISPUTED_OR_REWORKED = [
  ["2026-10-05_071859", "a11", false],
  ["2026-10-05_071859", "a12", true],
  ["2026-10-05_071859", "a13", false],
  ["2026-10-05_074624", "a11", false],
  ["2026-10-05_074624", "a12", false],
  ["2026-10-05_074624", "a13", false],
  ["2026-10-05_081228", "a11", false],
  ["2026-10-05_081228", "a12", false],
  ["2026-10-05_081228", "a13", true],
  ["2026-10-05_090513", "a12", false],
  ["2026-10-05_090513", "a13", true],
  ["2026-10-05_094601", "a12", false],
  ["2026-10-05_105010", "a12", true],
  ["2026-10-05_105010", "a13", true],
  ["2026-10-05_110822", "a12", true],
  ["2026-10-05_110822", "a13", true],
  ["2026-10-05_122217", "a12", true],
  ["2026-10-05_123216", "a12", false],
  ["2026-10-05_124154", "a11", true],
  ["2026-10-05_135040", "a12", true],
  ["2026-10-05_135908", "a11", true],
  ["2026-10-05_135908", "a12", true],
  ["2026-10-05_135908", "a13", true],
  ["2026-10-05_201248", "a11", false],
  ["2026-10-05_201248", "a12", false],
  ["2026-10-05_201248", "a13", true],
];

describe("recorded Rater answers that dispute or re-derive the computed block", () => {
  const answers = raterAnswers();
  const keyOf = (a) => `${a.run} ${a.id}`;
  const labelled = new Map(
    DISPUTED_OR_REWORKED.map(([run, id, accepted]) => [
      `${run} ${id}`,
      accepted,
    ]),
  );
  const figuresAndPairsOk = (check) =>
    check.wrongFigures.length === 0 &&
    check.inventedPairs.length === 0 &&
    check.deniedPairs.length === 0;

  it("covers the 83 recorded answers to the five cases with structured conditions", () => {
    expect(answers).toHaveLength(83);
    for (const key of labelled.keys()) {
      expect(answers.some((a) => keyOf(a) === key)).toBe(true);
    }
  });

  it("before: 14 of the 26 were accepted on figures and pairs alone", () => {
    const accepted = answers.filter(
      (a) =>
        labelled.has(keyOf(a)) &&
        figuresAndPairsOk(checkRaterResponse(a.text, a.calc)),
    );
    expect(accepted.map(keyOf).sort()).toEqual(
      [...labelled]
        .filter(([, was]) => was)
        .map(([key]) => key)
        .sort(),
    );
    expect(accepted).toHaveLength(14);
  });

  // The one it misses writes its sums in words ("which equals 38%"); that
  // answer already fails on the combined figures it states.
  const IN_PROSE = "2026-10-05_201248 a12";

  it("after: 25 of the 26 are caught, none accepted, and no other answer is caught", () => {
    const caught = answers.filter((a) => {
      const check = checkRaterResponse(a.text, a.calc);
      return check.reworked.length > 0 || check.disputes.length > 0;
    });
    expect(caught.map(keyOf).sort()).toEqual(
      [...labelled.keys()].filter((key) => key !== IN_PROSE).sort(),
    );
    const accepted = answers.filter(
      (a) => labelled.has(keyOf(a)) && checkRaterResponse(a.text, a.calc).ok,
    );
    expect(accepted).toEqual([]);
  });

  it("case a12 in run 135040 lands on 50% and is now replaced", () => {
    const a12 = answers.find(
      (a) => a.run === "2026-10-05_135040" && a.id === "a12",
    );
    const check = checkRaterResponse(a12.text, a12.calc);
    expect(check.stated).toEqual([50]);
    expect(check.ok).toBe(false);
    expect(check.reworked).toContain(
      "*   10% (Left Knee) + 10% (Right Knee) = **20%**.",
    );
  });
});
