/**
 * Run L3 (2026-10-06 04:58, 2B) a17, a Red Team answer with no verified
 * reference and so no topic. It gave "new and material" as the test, said
 * the table adds ratings, put the bilateral factor on one side of the body,
 * and said only clear and unmistakable error overturns a denial. Rules whose
 * sentence names its own subject can run with no topic; the others cannot.
 */
import { describe, it, expect } from "vitest";
import { findContradictions } from "../../utils/contradictionCheck";
import quotes from "../../data/verifiedQuotes.json";

const NO_TOPIC = [];
const rules = (text) =>
  findContradictions(text, { topics: NO_TOPIC }).map((hit) => hit.rule);

const L3_A17 = {
  newAndMaterial:
    "38 CFR § 3.105: If a decision was made in a previous year, the veteran must have new and material evidence to reopen the claim.",
  ratingsAdded:
    '38 CFR § 4.25: To determine a combined rating, the VA uses a specific table (often referred to as the "VA Math" or "Combined Rating Table") that adds the percentage ratings of the two conditions.',
  sameSide:
    '38 CFR § 4.26: If a veteran has two conditions on the same side of the body (e.g., both arms or both legs), a "bilateral factor" is applied, which adds 10% to the combined rating.',
  clearError:
    'If a claim is denied, the VA must have provided a "clear and unmistakable error" (CUE) to overturn it.',
};

describe("new and material, with no topic", () => {
  // The rule is back behind the review topics. With no topic it met too
  // many sentences that only recount an older decision.
  it.each([
    L3_A17.newAndMaterial,
    "A Supplemental Claim is only appropriate if you have new and material evidence that was not previously associated with your claim.",
    "- Order: New and material evidence having been received, the application to reopen the previously denied claim for service connection for bilateral flatfoot (pes planus) is granted.",
    "The Board found that new and material evidence had been submitted.",
    "The old new and material test was replaced by new and relevant evidence.",
  ])("does not run: %s", (sentence) => {
    expect(rules(sentence)).toEqual([]);
  });
});

describe("new and material, on a review question", () => {
  it("reads 'a previous year' as a time, not as the previous standard", () => {
    expect(
      findContradictions(L3_A17.newAndMaterial, {
        topics: ["decision-review"],
      }).map((hit) => hit.rule),
    ).toEqual(["new-and-material-standard"]);
  });

  it("is flagged as before, with or without a word to the reader", () => {
    expect(
      findContradictions('Consider the "New and Material Evidence" Doctrine', {
        topics: ["supplemental"],
      }).map((hit) => hit.rule),
    ).toEqual(["new-and-material-standard"]);
  });
});

describe("a form given to the wrong filing, with no topic", () => {
  it("is corrected from the forms table", () => {
    expect(
      rules(
        "You can submit a supplemental claim (Form 22-0966) to have your tinnitus rated.",
      ),
    ).toEqual(["form-for-another-filing"]);
    expect(rules("File a Supplemental Claim (VA Form 20-0995).")).toEqual([]);
  });
});

describe("the table said to add ratings", () => {
  it("is caught by the ratings rule", () => {
    expect(rules(L3_A17.ratingsAdded)).toEqual(["ratings-added-together"]);
  });

  it.each([
    "VA does not add ratings together.",
    "The table combines the ratings; it never adds the ratings.",
    "Combine the bilateral pair, then the calculator adds the bilateral factor.",
    "Dependents are different: the pay table adds the ratings-based dependent amount at 30 percent and above.",
  ])("leaves alone: %s", (sentence) => {
    expect(rules(sentence)).toEqual([]);
  });
});

describe("the bilateral factor put on one side of the body", () => {
  const RULE = "bilateral-same-side";

  it.each([
    L3_A17.sameSide,
    "Under 38 CFR § 4.26, a bilateral pair of conditions on the same side (like two thumbs) receives a 10% bilateral factor on top of your combined rating.",
    "This would be a valid bilateral pair as both affect different body parts on the same side.",
  ])("flags: %s", (sentence) => {
    expect(rules(sentence)).toEqual([RULE]);
  });

  it.each([
    "38 CFR § 4.26: Applies the bilateral factor (10% boost) only to paired extremities (both arms or both legs), not conditions on the same side.",
    "Two conditions on the same side are NOT bilateral.",
    "The bilateral factor applies to both arms or both legs.",
    "Both knees are on the same side of this question as the hips.",
  ])("leaves alone: %s", (sentence) => {
    expect(rules(sentence)).toEqual([]);
  });

  it("quotes the opening of 38 CFR 4.26", () => {
    const [hit] = findContradictions(L3_A17.sameSide);
    expect(hit.says).toBe(
      "puts the bilateral factor on conditions on the same side of the body, but it is for the right and left sides together",
    );
    expect(quotes.corrections[hit.correction]).toMatchObject({
      citation: "38 CFR § 4.26",
    });
    expect(quotes.corrections[hit.correction].text).toContain(
      "both arms, or of both legs, or of paired skeletal muscles, the ratings for the disabilities of the right and left sides will be combined as usual, and 10 percent of this value will be added",
    );
  });
});

describe("known miss: clear and unmistakable error", () => {
  // "Final unless there is clear and unmistakable error" is true of a decision
  // that has become final, and the sentence does not say which kind it means.
  it.each([
    L3_A17.clearError,
    'Regulation: Per 38 CFR § 3.105, a decision is final unless there is a "Clear and Unmistakable Error" (CUE).',
  ])("no rule fires on: %s", (sentence) => {
    expect(
      findContradictions(sentence, {
        topics: ["decision-review", "supplemental", "next-claim-step"],
      }),
    ).toEqual([]);
  });
});
