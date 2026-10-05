import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { calculateVARating } from "../../utils/vaCalculator";
import {
  buildCalculatorExplanation,
  buildReplacementNotice,
  buildTdiuThresholdParagraph,
  checkRaterResponse,
  checkTdiuConclusion,
  describeMismatch,
  tdiuThresholdsFor,
} from "../../utils/raterGrounding";

import { raterAnswers } from "./recordedAnswers";

const here = dirname(fileURLToPath(import.meta.url));
const evalDir = join(here, "..", "agentic", "eval", "fixtures");
const FIXTURE = JSON.parse(
  readFileSync(join(evalDir, "tdiuConclusions.json"), "utf8"),
);
const GOLDEN = Object.fromEntries(
  readFileSync(join(here, "..", "agentic", "golden-set.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .map((c) => [c.id, c]),
);

const set = (...ratings) =>
  ratings.map((rating, i) => ({
    name: `Condition ${i + 1}`,
    rating,
    side: "none",
    bodyPart: "other",
  }));
const calcOf = (...ratings) => calculateVARating(set(...ratings));

describe("tdiuThresholdsFor", () => {
  it.each([
    [[60, 20, 20, 20], true, "single60", 60, 80],
    [[60], true, "single60", 60, 60],
    [[50, 50], true, "combined70", 50, 80],
    [[40, 20], false, null, 40, 50],
    [[30, 30], false, null, 30, 50],
  ])("%j", (ratings, eligible, basis, highest, combined) => {
    const out = tdiuThresholdsFor(calcOf(...ratings));
    expect(out.eligible).toBe(eligible);
    expect(out.basis).toBe(basis);
    expect(out.highest).toBe(highest);
    expect(out.combined).toBe(combined);
  });
});

describe("a13 and a25 answers recorded in every transcript", () => {
  it("covers every a13 and a25 response and replaced draft in the results folder", () => {
    expect(FIXTURE).toHaveLength(27);
    expect(new Set(FIXTURE.map((e) => e.caseId))).toEqual(
      new Set(["a13", "a25"]),
    );
    expect(FIXTURE.filter((e) => e.kind === "replaced draft")).toHaveLength(3);
    expect(new Set(FIXTURE.map((e) => e.label))).toEqual(
      new Set(["contradicts", "consistent", "none"]),
    );
  });

  it("every one of those cases meets the thresholds through a single condition at 60", () => {
    for (const id of ["a13", "a25"]) {
      const t = tdiuThresholdsFor(calculateVARating(GOLDEN[id].conditions));
      expect(t).toMatchObject({ eligible: true, basis: "single60" });
    }
  });

  it.each(FIXTURE)("$transcript $caseId $kind ($label): $why", (entry) => {
    const calc = calculateVARating(GOLDEN[entry.caseId].conditions);
    const out = checkTdiuConclusion(entry.text, calc);
    expect(out.contradicted).toBe(entry.label === "contradicts");
    if (entry.label === "contradicts") expect(out.direction).toBe("denies");
  });
});

describe("checkTdiuConclusion when the thresholds are met", () => {
  const met = calcOf(60, 20, 20, 20);

  it.each([
    ["a bold status line", "**TDIU Eligibility Status: NOT ELIGIBLE**"],
    [
      "a plain refusal",
      "No, you cannot qualify for TDIU with only one 60% rating.",
    ],
    [
      "does not meet",
      "You do not meet the thresholds for TDIU under 38 CFR § 4.16(a).",
    ],
    [
      "ineligible",
      "On these ratings you are ineligible for unemployability benefits.",
    ],
    [
      "fails to meet",
      "The veteran fails to meet the TDIU percentage standard.",
    ],
  ])("flags %s", (_name, text) => {
    expect(checkTdiuConclusion(text, met).contradicted).toBe(true);
  });

  it.each([
    [
      "a conclusion that rests on being able to work",
      "If you are capable of working, you are not eligible for TDIU.",
    ],
    [
      "the rating alone is not enough",
      "The 60% rating alone does not qualify you for TDIU automatically.",
    ],
    [
      "a statement about the second test only",
      "You do not meet the combined 70 percent test for TDIU, but the single 60 percent test is met.",
    ],
    [
      "I cannot determine",
      "I cannot determine whether you qualify for TDIU without your employment history.",
    ],
    [
      "a refusal about calculating",
      "I cannot calculate a TDIU rating without your occupational status.",
    ],
    [
      "a sentence about another benefit",
      "You are not eligible for SMC at these ratings.",
    ],
    [
      "an affirmative conclusion",
      "You meet the threshold for TDIU through the single 60 percent rating.",
    ],
    [
      "no conclusion",
      "TDIU also requires that you are unable to secure or follow a substantially gainful occupation.",
    ],
  ])("does not flag %s", (_name, text) => {
    expect(checkTdiuConclusion(text, met).contradicted).toBe(false);
  });
});

describe("checkTdiuConclusion when the thresholds are not met", () => {
  const notMet = calcOf(30, 30);

  it.each([
    ["eligible", "You are eligible for TDIU."],
    ["qualifies", "**Eligibility Determination: YES**"],
    [
      "yes you can qualify",
      "Yes, you can qualify for TDIU with these ratings.",
    ],
    ["meets", "Your 30 percent rating meets the TDIU threshold."],
  ])("flags an answer that says %s", (_name, text) => {
    const out = checkTdiuConclusion(text, notMet);
    expect(out.contradicted).toBe(true);
    expect(out.direction).toBe("asserts");
  });

  it.each([
    ["not eligible", "You do not meet the percentage thresholds for TDIU."],
    [
      "a conditional",
      "You would be eligible for TDIU if your combined rating reached 70 percent.",
    ],
    [
      "consideration",
      "You may be eligible for TDIU consideration under paragraph (b).",
    ],
  ])("does not flag %s", (_name, text) => {
    expect(checkTdiuConclusion(text, notMet).contradicted).toBe(false);
  });

  it("does not flag a statement about one test when the other carried the result", () => {
    const viaCombined = calcOf(50, 50);
    expect(
      checkTdiuConclusion(
        "You do not meet the single 60 percent test for TDIU.",
        viaCombined,
      ).contradicted,
    ).toBe(false);
    expect(
      checkTdiuConclusion("You are not eligible for TDIU.", viaCombined)
        .contradicted,
    ).toBe(true);
  });
});

describe("hedged conclusions about the percentage thresholds", () => {
  const met = calcOf(60, 20, 20, 20);
  const single = calcOf(60);

  it.each([
    ["may not meet", "You may not meet the percentage thresholds for TDIU."],
    [
      "likely does not qualify",
      "The veteran likely does not qualify for TDIU.",
    ],
    ["appears not met", "It appears the thresholds are not met."],
    [
      "unlikely to qualify",
      "You are unlikely to qualify for TDIU on these ratings.",
    ],
    ["would not qualify", "On these ratings you would not qualify for TDIU."],
  ])("flags %s when the thresholds are met", (_name, text) => {
    const out = checkTdiuConclusion(text, met);
    expect(out.contradicted).toBe(true);
    expect(out.direction).toBe("denies");
  });

  it("flags a denial of the threshold that rests on the single rating 'alone' (135908 a25)", () => {
    const text =
      "Since your current combined rating is 60%, you do not meet the standard statutory threshold for TDIU based on this single rating alone.";
    expect(checkTdiuConclusion(text, single).contradicted).toBe(true);
  });

  it("flags a denial that cites the combined rating when both tests are met (141236 a13)", () => {
    const text =
      "You are not eligible for TDIU (Total Disability Based on Unemployability) with a combined rating of 80% under the standard VA rating schedule.";
    expect(checkTdiuConclusion(text, met).contradicted).toBe(true);
  });

  it.each([
    [
      "a possibility that rests on being able to work",
      "You may not qualify for TDIU if you are able to work.",
      met,
    ],
    [
      "a possibility about overall eligibility",
      "You might not be eligible for TDIU, because it also depends on your work history.",
      met,
    ],
    [
      "a true statement about the test that is not met",
      "The threshold for two or more disabilities is not met.",
      calcOf(60, 10),
    ],
    [
      "a true statement naming the 70 percent figure",
      "A single 60% rating does not meet the 70% threshold.",
      single,
    ],
    [
      "a contrast that gets both tests right",
      "While you meet the threshold for the first option (one disability at 60%), you do not meet the threshold for the second option (combined rating of 70%).",
      single,
    ],
    [
      "the wording of paragraph (b)",
      "Paragraph (b) covers veterans who fail to meet the percentage standards of paragraph (a).",
      met,
    ],
    [
      "one rating alone below 60 when the combined test carries the result",
      "The 50% rating alone does not meet the threshold.",
      calcOf(50, 50),
    ],
  ])("does not flag %s", (_name, text, calc) => {
    expect(checkTdiuConclusion(text, calc).contradicted).toBe(false);
  });
});

describe("hedged claims that the thresholds are met when they are not", () => {
  const notMet = calcOf(30, 30);

  it.each([
    ["likely meet", "You likely meet the percentage thresholds for TDIU."],
    ["appears met", "It appears the thresholds are met."],
    ["probably qualify", "You probably qualify for TDIU."],
    ["may meet", "You may meet the thresholds."],
  ])("flags %s when the thresholds are not met", (_name, text) => {
    const out = checkTdiuConclusion(text, notMet);
    expect(out.contradicted).toBe(true);
    expect(out.direction).toBe("asserts");
  });

  it("flags a claim about the combined test when neither test is met", () => {
    const text = "You meet the combined 70 percent threshold for TDIU.";
    expect(checkTdiuConclusion(text, calcOf(40, 20)).contradicted).toBe(true);
  });

  it.each([
    ["neither is met", "Neither threshold is met."],
    [
      "no condition meets",
      "No single condition meets the 60 percent TDIU threshold.",
    ],
    [
      "the extra-schedular route",
      "You may be eligible for TDIU on an extra-schedular basis under paragraph (b).",
    ],
    ["a bare possibility", "You may qualify for TDIU."],
    [
      "a condition",
      "The thresholds are met only if your combined rating reaches 70 percent.",
    ],
  ])("does not flag %s when the thresholds are not met", (_name, text) => {
    expect(checkTdiuConclusion(text, notMet).contradicted).toBe(false);
  });

  it.each([
    [[60]],
    [[60, 20, 20, 20]],
    [[60, 10]],
    [[50, 30, 20]],
    [[50, 50]],
    [[40, 30]],
    [[30, 30, 30, 30]],
  ])("never flags the calculator's own paragraph for %j", (ratings) => {
    const calc = calcOf(...ratings);
    const out = checkTdiuConclusion(buildTdiuThresholdParagraph(calc), calc);
    expect(out.sentences).toEqual([]);
  });
});

describe("wrong threshold conclusions in every recorded a13 and a25 answer", () => {
  const WRONG = [
    "2026-10-05_071859 a25",
    "2026-10-05_105010 a25",
    "2026-10-05_123216 a13",
    "2026-10-05_135040 a25",
    "2026-10-05_135908 a25",
    "2026-10-05_141236 a13",
    "2026-10-05_201248 a25",
  ];
  const MISSED_BEFORE = ["2026-10-05_135908 a25", "2026-10-05_141236 a13"];
  const answers = raterAnswers().filter((a) => ["a13", "a25"].includes(a.id));

  it("covers 33 answers, all on ratings that meet the thresholds", () => {
    expect(answers).toHaveLength(33);
  });

  it("after: all 7 that deny the thresholds are caught (before: 5) and no other answer is", () => {
    const caught = answers
      .filter((a) => checkTdiuConclusion(a.text, a.calc).contradicted)
      .map((a) => `${a.run} ${a.id}`);
    expect(caught.sort()).toEqual(WRONG);
    expect(WRONG.filter((key) => !MISSED_BEFORE.includes(key))).toHaveLength(5);
  });
});

describe("the notice and the recorded reason say what fired", () => {
  const calc = calcOf(60, 20, 20, 20);
  const okCheck = checkRaterResponse("Your combined rating is 80%.", calc);
  const wrongFigure = checkRaterResponse(
    "The final combined rating is 70%.",
    calc,
  );
  const tdiuCheck = checkTdiuConclusion(
    "TDIU Eligibility Status: NOT ELIGIBLE",
    calc,
  );

  it("a TDIU-only replacement does not claim a combined-rating mismatch", () => {
    const text = buildCalculatorExplanation(calc, {
      tdiu: true,
      check: okCheck,
      tdiuCheck,
    });
    const notice = buildReplacementNotice(okCheck, tdiuCheck);
    expect(text.startsWith(notice)).toBe(true);
    expect(notice).toContain(
      "TDIU conclusion that did not match the percentage thresholds of 38 CFR § 4.16(a)",
    );
    expect(notice).not.toMatch(/combined rating that did not match/);
    expect(notice).not.toMatch(/bilateral/);
  });

  it("a figure-only replacement does not mention TDIU", () => {
    const notice = buildReplacementNotice(wrongFigure, null);
    expect(notice).toContain(
      "stated a combined rating that did not match Vet-Rate's calculator",
    );
    expect(notice).not.toMatch(/TDIU/);
  });

  it("a replacement with both reasons names both", () => {
    const notice = buildReplacementNotice(wrongFigure, tdiuCheck);
    expect(notice).toMatch(
      /combined rating that did not match Vet-Rate's calculator and gave a TDIU conclusion/,
    );
  });

  it("the recorded reason states what the answer said and what the thresholds are", () => {
    expect(describeMismatch(okCheck, tdiuCheck)).toBe(
      "said the 38 CFR § 4.16(a) percentage thresholds are not met but they are met (highest rating 60%, combined 80%)",
    );
    expect(describeMismatch(wrongFigure, tdiuCheck)).toMatch(
      /^stated combined rating 70% but the calculator gives 80% \(from: "The final combined rating is 70%\."\); said the 38 CFR § 4\.16\(a\)/,
    );
    const notMet = calcOf(30, 30);
    const asserts = checkTdiuConclusion("You are eligible for TDIU.", notMet);
    expect(
      describeMismatch(
        checkRaterResponse("Your combined rating is 50%.", notMet),
        asserts,
      ),
    ).toBe(
      "said the 38 CFR § 4.16(a) percentage thresholds are met but they are not met (highest rating 30%, combined 50%)",
    );
  });

  it("with no check supplied there is no notice", () => {
    expect(buildReplacementNotice()).toBe("");
  });
});
