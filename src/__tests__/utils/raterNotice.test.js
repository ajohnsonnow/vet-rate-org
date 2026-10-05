/**
 * The replacement notice is a direct rendering of the checks that failed: one
 * fixed sentence per check, nothing else. A draft that failed no check gets
 * no notice at all, whatever else happens to it.
 */
import { describe, it, expect } from "vitest";
import { calculateVARating } from "../../utils/vaCalculator";
import {
  RATER_CHECK_SENTENCES,
  buildCalculatorExplanation,
  buildReplacementNotice,
  checkRaterResponse,
  checkTdiuConclusion,
  describeMismatch,
  failedRaterChecks,
  mentionsUnemployability,
} from "../../utils/raterGrounding";
import { enforceCalculatorOnResult } from "../../utils/unifiedAIService";
import { GOLDEN, allRaterAnswers, gradedFinalCase } from "./recordedAnswers";

const CHECK_IDS = Object.keys(RATER_CHECK_SENTENCES);
const SENTENCES = Object.values(RATER_CHECK_SENTENCES);

/** A check result in which exactly the listed checks failed. */
function resultFailing(ids) {
  const has = (id) => (ids.includes(id) ? ["evidence"] : []);
  const check = {
    expected: 50,
    stated: [50],
    wrongFigures: ids.includes("wrongFigure") ? [40] : [],
    wrongFigureSentences: has("wrongFigure"),
    inventedPairs: has("inventedPair"),
    deniedPairs: has("deniedPair"),
    reworked: has("reworked"),
    disputes: has("dispute"),
  };
  const tdiuCheck = ids.includes("tdiuConclusion")
    ? {
        contradicted: true,
        direction: "denies",
        sentences: ["evidence"],
        thresholds: { eligible: true, highest: 60, combined: 60 },
      }
    : null;
  return { check, tdiuCheck };
}

const subsets = (items) =>
  items.reduce(
    (all, item) => [...all, ...all.map((set) => [...set, item])],
    [[]],
  );

describe("one fixed sentence per check", () => {
  it("covers exactly the six checks a rater draft can fail", () => {
    expect(CHECK_IDS).toEqual([
      "wrongFigure",
      "inventedPair",
      "deniedPair",
      "reworked",
      "dispute",
      "tdiuConclusion",
    ]);
    expect(new Set(SENTENCES).size).toBe(6);
  });

  it.each(subsets(CHECK_IDS).map((ids) => [ids.join(" + ") || "nothing", ids]))(
    "when %s failed, the notice holds those sentences and no other",
    (_name, ids) => {
      const { check, tdiuCheck } = resultFailing(ids);
      expect(failedRaterChecks(check, tdiuCheck)).toEqual(ids);
      const notice = buildReplacementNotice(check, tdiuCheck);
      for (const id of CHECK_IDS) {
        expect(notice.includes(RATER_CHECK_SENTENCES[id])).toBe(
          ids.includes(id),
        );
      }
      if (ids.length === 0) {
        expect(notice).toBe("");
      } else {
        expect(notice).toBe(
          `The AI's draft answer ${ids
            .map((id) => RATER_CHECK_SENTENCES[id])
            .join(
              " and ",
            )}, so it is not shown. This is the calculator's working for the ratings you entered.`,
        );
      }
    },
  );

  it("with no check result there is no notice, and no default reason", () => {
    expect(buildReplacementNotice()).toBe("");
    expect(buildReplacementNotice(null, null)).toBe("");
    const calc = calculateVARating(GOLDEN.a11.conditions);
    expect(
      buildCalculatorExplanation(calc).startsWith("Your combined rating is"),
    ).toBe(true);
  });

  it("the recorded reason is built from the same list", () => {
    const { check, tdiuCheck } = resultFailing(["reworked", "dispute"]);
    const reason = describeMismatch(check, tdiuCheck);
    expect(reason).toContain("showed working the calculator did not produce");
    expect(reason).toContain("disputed the computed result");
    expect(reason).not.toContain("stated combined rating");
    expect(describeMismatch(resultFailing([]).check)).toBe("");
  });

  it("checkRaterResponse is ok exactly when it lists no failed check", () => {
    const calc = calculateVARating(GOLDEN.a12.conditions);
    const good = checkRaterResponse("Your combined rating is 50%.", calc);
    expect(good.failed).toEqual([]);
    expect(good.ok).toBe(true);
    const bad = checkRaterResponse("Your combined rating is 40%.", calc);
    expect(bad.failed).toEqual(["wrongFigure"]);
    expect(bad.ok).toBe(false);
  });
});

describe("case a12 on the final build", () => {
  const record = gradedFinalCase("a12");
  const draft = record.calculatorReplacement.draft;
  const calc = calculateVARating(GOLDEN.a12.conditions);

  it("the run told the veteran the draft stated a rating that did not match; it stated 50% three times", () => {
    expect(
      record.response.startsWith(
        "The AI's draft answer stated a combined rating that did not match Vet-Rate's calculator, so it is not shown.",
      ),
    ).toBe(true);
    expect(draft.match(/50%/g).length).toBeGreaterThanOrEqual(3);
    expect(draft).toContain("**Final Combined Rating: 50%**");
  });

  it("an entered rating being combined is not the draft's stated rating", () => {
    expect(draft).toContain(
      "combined in order of severity (highest first): 30% combined with the bilateral group rating of 21%",
    );
    const check = checkRaterResponse(draft, calc);
    expect(check.wrongFigures).toEqual([]);
    expect(check.failed).toEqual([]);
    expect(buildReplacementNotice(check)).toBe("");
  });

  it("the draft is still not shown, because it has arithmetic of its own, and there is no notice", () => {
    const out = enforceCalculatorOnResult(
      { text: draft },
      { conditions: GOLDEN.a12.conditions },
      GOLDEN.a12.input,
    );
    expect(
      out.text.startsWith("Your combined rating is 50%.\n\nVA does not add"),
    ).toBe(true);
    expect(out.text).not.toContain("draft answer");
    expect(out.text).not.toContain("did not match");
    expect(out.text).not.toContain("44.7");
    expect(out.calculatorReplacement).toBeUndefined();
    expect(out.calculatorLead).toEqual({
      expected: 50,
      commentaryKept: false,
      commentaryDropped: [
        "decimal",
        "rounding",
        "equation",
        "figure",
        "result",
      ],
    });
  });

  it.each([
    [
      "a different rating beside the right one",
      "Your combined rating is 50%. Overall: 40%.",
      [40],
    ],
    [
      "an entered rating given as the only answer",
      "Your combined rating is 30%.",
      [30],
    ],
  ])("still reports %s", (_name, text, wrong) => {
    expect(checkRaterResponse(text, calc).wrongFigures).toEqual(wrong);
  });
});

describe("a bound is not a stated rating", () => {
  const calc = calculateVARating(GOLDEN.a13.conditions);

  it.each([
    "Explain that the 80% combined rating meets the second TDIU threshold (2+ disabilities, one >=40%, combined >=70%).",
    "Your combined rating is 80%, and the test needs a combined rating of at least 70%.",
  ])("%s", (text) => {
    const check = checkRaterResponse(text, calc);
    expect(check.stated).not.toContain(70);
    expect(check.wrongFigures).toEqual([]);
    expect(check.failed).toEqual([]);
  });
});

describe("every recorded rater answer, in every run on disk", () => {
  const answers = allRaterAnswers();

  it("a notice only ever contains sentences for checks that failed", () => {
    expect(answers.length).toBeGreaterThan(90);
    for (const a of answers) {
      const check = checkRaterResponse(a.text, a.calc);
      const tdiuCheck = mentionsUnemployability(a.input)
        ? checkTdiuConclusion(a.text, a.calc)
        : null;
      const failed = failedRaterChecks(check, tdiuCheck);
      const notice = buildReplacementNotice(check, tdiuCheck);
      const shown = CHECK_IDS.filter((id) =>
        notice.includes(RATER_CHECK_SENTENCES[id]),
      );
      expect(shown).toEqual(failed);
      expect(notice === "").toBe(failed.length === 0);
    }
  });
});
