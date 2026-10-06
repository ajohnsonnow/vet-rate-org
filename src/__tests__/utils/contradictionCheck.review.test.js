/**
 * Review-lane rules the Decision Decoder needed in the three stability runs:
 * new evidence and a hearing put inside a Higher-Level Review, and a review
 * period counted from today.
 */
import { describe, it, expect } from "vitest";
import { findContradictions } from "../../utils/contradictionCheck";
import { withVerifiedReviewOptions } from "../../utils/reviewOptions";
import quotes from "../../data/verifiedQuotes.json";

const REVIEW = ["decision-review"];
const rules = (text) =>
  findContradictions(text, { topics: REVIEW }).map((hit) => hit.rule);

const RUN_B_STEP_2 =
  "Step 2: In the Higher-Level Review, specifically request a Board hearing (VA Form 10182) for the knee issue to submit additional evidence and argue against the VA examiner's 'less likely than not' opinion.";

describe("new evidence with a higher-level review", () => {
  it("is not hidden by the 'not' inside 'less likely than not'", () => {
    expect(rules(RUN_B_STEP_2)).toContain("higher-level-review-new-evidence");
    expect(
      rules(
        "Request a Higher-Level Review and add new evidence that it is at least as likely as not related to service.",
      ),
    ).toContain("higher-level-review-new-evidence");
  });

  it("still leaves a sentence that says no new evidence is taken", () => {
    expect(
      rules("A Higher-Level Review does not accept new evidence."),
    ).toEqual([]);
  });
});

const RUN_D2_STEP_2 =
  "In the Higher-Level Review, argue that the VA examiner's 'less likely than not' opinion is not the only valid medical opinion and submit a new medical opinion from a qualified provider (VA or private) that clearly links the current knee strain to the service training march.";

describe("anything new submitted in or with a higher-level review", () => {
  it.each([
    RUN_D2_STEP_2,
    "With your Higher-Level Review, include a nexus letter from your doctor.",
    "As part of the Higher-Level Review, provide updated treatment records.",
    "In the HLR, attach a buddy statement about the march.",
    "During the Higher-Level Review, send in your new MRI results.",
    "Submit a new medical opinion with your Higher-Level Review request.",
  ])("flags: %s", (sentence) => {
    expect(rules(sentence)).toContain("higher-level-review-new-evidence");
  });

  it.each([
    "In a Higher-Level Review you cannot submit a new medical opinion.",
    "In the Higher-Level Review, the reviewer does not accept a nexus letter or any new records.",
    "If you want to submit a new medical opinion, a Higher-Level Review is not the right choice.",
    "File a Supplemental Claim instead of a Higher-Level Review to submit a new medical opinion.",
    "In the Higher-Level Review, argue that the examiner ignored the medical opinion already in your file.",
    "In the Higher-Level Review, submit a written argument identifying the error.",
    "With a Higher-Level Review, a senior reviewer looks at the same records.",
    "If filing a Board Appeal (Notice of Disagreement on VA Form 10182) instead, ensure the Notice of Disagreement specifically requests an opportunity to submit additional evidence (the new medical opinion).",
    "Gather and submit a new medical opinion from a qualified provider.",
  ])("leaves alone: %s", (sentence) => {
    expect(rules(sentence)).not.toContain("higher-level-review-new-evidence");
  });

  it("corrects run D2's plan beside the plan", () => {
    const out = withVerifiedReviewOptions({
      action_plan: [
        "File a Higher-Level Review (VA Form 20-0996) within one year of the decision date to request a review by a higher-level adjudicator.",
        RUN_D2_STEP_2,
      ],
    });
    expect(out.review_corrections.map((c) => [c.field, c.rule])).toEqual([
      ["action_plan", "higher-level-review-new-evidence"],
    ]);
    expect(out.review_corrections[0].note).toContain(
      "the higher-level adjudicator may not consider additional evidence",
    );
  });
});

describe("a hearing put inside a higher-level review", () => {
  it.each([
    RUN_B_STEP_2,
    "Ask for a hearing as part of your Higher-Level Review.",
    "During the Higher-Level Review you will get a hearing before a judge.",
  ])("flags: %s", (sentence) => {
    expect(rules(sentence)).toContain("higher-level-review-hearing");
  });

  it.each([
    "You can request a Higher-Level Review, or appeal to the Board and request a hearing.",
    "A Higher-Level Review has no hearing; you may ask for an informal conference.",
    "A Higher-Level Review does not include a hearing.",
    "Request a Board hearing with your Notice of Disagreement (VA Form 10182).",
    "With a Higher-Level Review you may request an informal conference.",
  ])("leaves alone: %s", (sentence) => {
    expect(rules(sentence)).not.toContain("higher-level-review-hearing");
  });

  it("says only what 38 CFR 3.2601(h) supports: an informal conference", () => {
    const hit = findContradictions(RUN_B_STEP_2, { topics: REVIEW }).find(
      (h) => h.rule === "higher-level-review-hearing",
    );
    expect(hit.says).toBe(
      "asks for a hearing in a higher-level review, where the regulation provides for an informal conference",
    );
    const quote = quotes.corrections["higher-level-review-conference"];
    expect(quote.citation).toBe("38 CFR § 3.2601(h)");
    expect(quote.text).toContain(
      "may include a request for an informal conference with a request for higher-level review",
    );
    expect(quote.text).toContain(
      "for the sole purpose of allowing the claimant or representative to identify any errors of law or fact in a prior decision based on the record at the time the decision was issued",
    );
    expect(quote.text).not.toMatch(/\bhearing\b/);
  });
});

describe("a review period counted from the wrong day", () => {
  it.each([
    "You have one year from today to ask for a review of this decision.",
    "You have 1 year from now to file a Higher-Level Review.",
    "The Board appeal must be filed within one year from today.",
  ])("flags: %s", (sentence) => {
    expect(rules(sentence)).toEqual(["review-period-from-wrong-day"]);
  });

  it.each([
    "You have one year from the date of this letter to ask for a review of this decision.",
    "File within one year of the decision date.",
    "You have one year from the date VA mailed the notice of the decision.",
    "From today, gather your records and call your VSO.",
  ])("leaves alone: %s", (sentence) => {
    expect(rules(sentence)).toEqual([]);
  });

  it("quotes 38 CFR 3.2500(a)(1) for when the year starts", () => {
    const [hit] = findContradictions(
      "You have one year from today to ask for a review of this decision.",
      { topics: REVIEW },
    );
    expect(hit.correction).toBe("review-period-start");
    expect(quotes.corrections["review-period-start"]).toMatchObject({
      citation: "38 CFR § 3.2500(a)(1)",
    });
    expect(quotes.corrections["review-period-start"].text).toContain(
      "Within one year from the date on which the agency of original jurisdiction issues a notice of a decision",
    );
  });
});

describe("the Decision Decoder fields from runs B and C", () => {
  it("corrects run B's plan beside the plan", () => {
    const out = withVerifiedReviewOptions({
      action_plan: [
        "Step 1: File a Higher-Level Review (VA Form 20-0996) within one year of the decision date to request a review of the tinnitus grant and the knee denial.",
        RUN_B_STEP_2,
        "Step 3: Gather and submit a new medical opinion from a qualified provider.",
      ],
    });
    expect(out.review_corrections.map((c) => [c.field, c.rule])).toEqual([
      ["action_plan", "higher-level-review-new-evidence"],
      ["action_plan", "higher-level-review-hearing"],
    ]);
  });

  it("corrects run C's deadline beside the deadline", () => {
    const out = withVerifiedReviewOptions({
      deadline_warning:
        "You have one year from today to ask for a review of this decision. Check your decision letter for specific deadlines regarding when you must file this request.",
    });
    expect(out.review_corrections.map((c) => [c.field, c.rule])).toEqual([
      ["deadline_warning", "review-period-from-wrong-day"],
    ]);
  });
});
