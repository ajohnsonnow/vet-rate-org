/**
 * "The draft stated a combined rating that did not match" is only true when
 * a sentence explicitly presents a figure as the veteran's combined rating:
 * a subject ("your combined rating", "the final combined disability rating")
 * and a verb or label colon, with the figure right after it. A figure near
 * the word "combined" or "total" is not enough. Anything else that differs
 * from the calculator is different working, which has its own sentence.
 */
import { describe, it, expect } from "vitest";
import { calculateVARating } from "../../utils/vaCalculator";
import {
  buildReplacementNotice,
  checkRaterResponse,
  checkTdiuConclusion,
  failedRaterChecks,
  findAssertedCombinedRatings,
  mentionsUnemployability,
  RATER_CHECK_SENTENCES,
} from "../../utils/raterGrounding";
import {
  GOLDEN,
  allRaterAnswers,
  raterAnswers,
  stabilityRunBCase,
} from "./recordedAnswers";

const calcOf = (id) => calculateVARating(GOLDEN[id].conditions);
const knees = calcOf("a12");
const tdiuFour = calcOf("a13");
const asserted = (text, calc = knees) =>
  findAssertedCombinedRatings(text, calc).map((hit) => hit.value);

describe("run B of the stability grade", () => {
  it("a12: 100 was the first operand of a subtraction labelled Total Disability", () => {
    const record = stabilityRunBCase("a12");
    const draft = record.calculatorReplacement.draft;
    expect(record.calculatorReplacement.reason).toContain(
      "stated combined rating 100% but the calculator gives 50%",
    );
    expect(draft).toContain("*   Total Disability: 100% - 55.3% = **44.7%**");
    const check = checkRaterResponse(draft, knees);
    expect(check.stated).toEqual([50]);
    expect(check.wrongFigures).toEqual([]);
    expect(check.failed).toEqual(["reworked"]);
    expect(buildReplacementNotice(check)).toBe(
      "The AI's draft answer showed working that did not match Vet-Rate's calculator, so it is not shown. This is the calculator's working for the ratings you entered.",
    );
  });

  it("a13: 70 was the threshold in a sentence about not needing it", () => {
    const record = stabilityRunBCase("a13");
    const draft = record.calculatorReplacement.draft;
    expect(record.calculatorReplacement.reason).toContain(
      "stated combined rating 70% but the calculator gives 80%",
    );
    expect(draft).toContain(
      "you may be rated TDIU without needing a combined rating of 70%.",
    );
    const check = checkRaterResponse(draft, tdiuFour);
    expect(check.stated).toEqual([80]);
    expect(check.wrongFigures).toEqual([]);
    const tdiuCheck = checkTdiuConclusion(draft, tdiuFour);
    expect(failedRaterChecks(check, tdiuCheck)).not.toContain("wrongFigure");
    expect(buildReplacementNotice(check, tdiuCheck)).not.toContain(
      RATER_CHECK_SENTENCES.wrongFigure,
    );
  });
});

describe("what counts as stating the combined rating", () => {
  it.each([
    ["Your combined rating is 40%.", [40]],
    ["Your combined disability rating is **0%**.", [0]],
    ["Therefore, the final combined disability rating is **70%**.", [70]],
    [
      "The correct combined rating, considering the bilateral pairings, is **70%**.",
      [70],
    ],
    ["**Final Combined Rating: 60%**", [60]],
    ["Overall rating: **40%**", [40]],
    [String.raw`\[ \text{Final Combined Rating} = 58\% \]`, [58]],
    ["Your combined rating is approximately 99%, which qualifies you.", [99]],
    ["The veteran's overall rating would be 70%.", [70]],
    ["These conditions result in a total combined rating of 60%.", [60]],
    ["That gives you a combined rating of 40%.", [40]],
    [
      "Given that the combined rating calculation results in 100%, you qualify.",
      [100],
    ],
  ])("states it: %s", (text, values) => {
    expect(asserted(text)).toEqual(values);
  });

  it.each([
    ["an operand of a sum", "Total Disability: 100% - 55.3% = **44.7%**"],
    ["a label that is not a rating", "**Total:** 44.7%"],
    ["a bare total", "Bilateral adds 10%. Total 30%."],
    [
      "a threshold that is not needed",
      "You may be rated TDIU without needing a combined rating of 70%.",
    ],
    ["a threshold", "The test requires a combined rating of 70% or more."],
    ["a bound", "Two or more disabilities, one >=40%, combined >=70%."],
    ["at least", "You need a combined rating of at least 70%."],
    [
      "a what-if",
      "If you had another condition, your combined rating would be 70%.",
    ],
    ["an example", "For example, a combined rating of 70% pays more."],
    ["a cap", "The maximum combined rating is 100%."],
    [
      "a pair's subtotal",
      "The left knee and right knee are both rated at 10%, so their combined rating is 20% (not 21%).",
    ],
    ["a group rating", "The combined rating for the bilateral group is 22%."],
    [
      "a rating being combined",
      "The two conditions are combined in order of severity (highest first): 30% combined with the bilateral group rating of 21%.",
    ],
    [
      "an entered rating",
      "Your back's rating is 30%, and the combined rating is 30% of the picture.",
    ],
    ["the calculator's own step", "The combined value before rounding is 45%."],
    [
      "the calculator's unrounded step",
      "Combined rating before rounding: 44.7%.",
    ],
    [
      "a list of ratings",
      "The combined ratings are 10% for Left knee and 10% for Right knee.",
    ],
    ["a bare label, as often a subtotal", "- Combined Rating: 20%"],
    [
      "a figure that belongs to a later clause",
      "The combined rating is lower than the plain sum, which is 60%.",
    ],
    ["the right rating", "Your combined rating is 50%."],
  ])("does not: %s", (_name, text) => {
    expect(asserted(text).filter((v) => v !== 50)).toEqual([]);
    expect(checkRaterResponse(text, knees).wrongFigures).toEqual([]);
  });

  it("quotes the sentence it read each figure from", () => {
    expect(
      findAssertedCombinedRatings("Fine.\nYour combined rating is 40%.", knees),
    ).toEqual([{ value: 40, sentence: "Your combined rating is 40%." }]);
  });
});

describe("the two loosely true cases in the labelled runs", () => {
  const find = (run, id) =>
    raterAnswers().find((a) => a.run === run && a.id === id);

  it.each([
    ["2026-10-05_123216", "a12", "Total 30%."],
    ["2026-10-05_201248", "a12", "so their combined rating is 20% (not 21%)"],
  ])("%s %s no longer gets the stated-rating sentence", (run, id, phrase) => {
    const answer = find(run, id);
    expect(answer.text).toContain(phrase);
    const check = checkRaterResponse(answer.text, answer.calc);
    expect(check.wrongFigures).toEqual([]);
    expect(check.failed).not.toContain("wrongFigure");
  });
});

describe("stated-rating findings over the 17 labelled runs", () => {
  it("every one is an explicit statement of a rating the calculator does not give", () => {
    const found = raterAnswers()
      .map((a) => {
        const check = checkRaterResponse(a.text, a.calc);
        return [`${a.run} ${a.id}`, check.wrongFigures];
      })
      .filter(([, wrong]) => wrong.length > 0);
    expect(found).toEqual([
      ["2026-10-05_071859 a11", [70]],
      ["2026-10-05_074624 a11", [70]],
      ["2026-10-05_074624 a12", [58]],
      ["2026-10-05_074624 a13", [99]],
      ["2026-10-05_081228 a11", [0]],
      ["2026-10-05_081228 a12", [60]],
      ["2026-10-05_090513 a12", [52]],
      ["2026-10-05_094601 a12", [52]],
      ["2026-10-05_201248 a11", [70]],
    ]);
  });
});

describe("every run on disk", () => {
  it("no draft that reaches the right rating and names no other is told it stated a wrong one", () => {
    for (const a of allRaterAnswers()) {
      const check = checkRaterResponse(a.text, a.calc);
      const tdiuCheck = mentionsUnemployability(a.input)
        ? checkTdiuConclusion(a.text, a.calc)
        : null;
      const notice = buildReplacementNotice(check, tdiuCheck);
      expect(notice.includes(RATER_CHECK_SENTENCES.wrongFigure)).toBe(
        check.wrongFigures.length > 0,
      );
      for (const value of check.wrongFigures) {
        expect(value).not.toBe(a.calc.combinedRating);
      }
    }
  });
});
