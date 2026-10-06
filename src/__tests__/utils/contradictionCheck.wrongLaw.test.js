/**
 * Three narrow rules from the closing runs, where the laptop model stated
 * wrong law and nothing fired: the TDIU percentage for one disability, the
 * intent-to-file paragraph cited for a Supplemental Claim, and "the higher
 * of the two" given as how ratings combine.
 */
import { describe, it, expect } from "vitest";
import { findContradictions } from "../../utils/contradictionCheck";
import quotes from "../../data/verifiedQuotes.json";

const rules = (text, topics = []) =>
  findContradictions(text, { topics }).map((hit) => hit.rule);

describe("the TDIU percentage for one disability", () => {
  const RULE = "tdiu-wrong-single-threshold";

  it.each([
    "Current Disability Status: Confirm if you have one disability rated at 70% or two or more disabilities rated at 40% or higher.",
    "If you have only one disability rated at 70% or two disabilities where one is rated at 40% or more and the combined total is 70% or more, you meet the threshold for TDIU benefits.",
    "TDIU needs a single disability ratable at 50 percent or more, or two or more with a combined 70 percent.",
  ])("flags: %s", (sentence) => {
    expect(rules(sentence, ["tdiu"])).toEqual([RULE]);
  });

  it.each([
    "TDIU applies if you have one disability ratable at 60% or more, or two or more with at least one ratable at 40% or more and a combined rating of 70% or more.",
    "One disability rated at 60% or more, OR",
    "You have one disability rated at 70%.",
    "You have one disability rated at 70% or two rated at 40%; which is it?",
    "there shall be at least one disability ratable at 40 percent or more, and sufficient additional disability to bring the combined rating to 70 percent or more.",
  ])("leaves alone: %s", (sentence) => {
    expect(rules(sentence, ["tdiu"])).toEqual([]);
  });

  it("names the figure and quotes 38 CFR 4.16(a)", () => {
    const [hit] = findContradictions(
      "Confirm if you have one disability rated at 70% or two or more disabilities rated at 40% or higher.",
      { topics: ["tdiu"] },
    );
    expect(hit.says).toBe(
      "gives 70 percent as the rating one disability needs for TDIU",
    );
    expect(hit.correction).toBe("tdiu-judgment");
    expect(quotes.corrections["tdiu-judgment"].text).toContain(
      "if there is only one such disability, this disability shall be ratable at 60 percent or more",
    );
  });

  it("is a TDIU rule only", () => {
    expect(
      rules(
        "Confirm if you have one disability rated at 70% or two or more disabilities rated at 40% or higher.",
        ["secondary"],
      ),
    ).toEqual([]);
  });
});

describe("the TDIU percentages with the 40 percent condition left out", () => {
  const RULE = "tdiu-threshold-omits-forty";
  // Run L3 (2026-10-06 04:58, 2B) a21, on the calculator route, no topic.
  const RUN_L3_A21 =
    "If you are looking for a statement of unemployability (TDIU), that requires a current rating of 60% or more, or a combined rating of 70% or more, along with proof of inability to secure substantially gainful employment.";

  it("flags it on any route, since the sentence names TDIU itself", () => {
    expect(rules(RUN_L3_A21)).toEqual([RULE]);
    expect(
      rules(
        "TDIU needs 60 percent or higher, or a combined rating of 70 percent.",
      ),
    ).toEqual([RULE]);
  });

  it.each([
    'With a 70% combined rating, you might qualify for TDIU if you meet the "one disability at 60%+" or "two disabilities at 40%+ with a combined 70%+" rule.',
    "TDIU requires one disability at 60% or more, or a combined rating of 70% or more with one disability at 40% or more.",
    "The schedule gives 60% or more, or a combined rating of 70% or more, for that condition.",
    "TDIU does not simply require 60% or more, or a combined rating of 70% or more.",
  ])("leaves alone: %s", (sentence) => {
    expect(rules(sentence)).toEqual([]);
  });

  it("says what was left out and quotes 38 CFR 4.16(a)", () => {
    const [hit] = findContradictions(RUN_L3_A21);
    expect(hit.says).toBe(
      "gives a combined 70 percent for TDIU and leaves out that one disability must be ratable at 40 percent or more",
    );
    expect(hit.correction).toBe("tdiu-judgment");
    expect(quotes.corrections["tdiu-judgment"].text).toContain(
      "there shall be at least one disability ratable at 40 percent or more, and sufficient additional disability to bring the combined rating to 70 percent or more",
    );
  });
});

describe("the intent-to-file paragraph cited for a Supplemental Claim", () => {
  const RULE = "intent-paragraph-for-supplemental-claim";
  const FILING = ["next-claim-step"];

  it.each([
    "Per 38 CFR § 3.155(b), if you have a pending claim and a denial, you should file a supplemental claim to address the denial.",
    "Regulation: Per 38 CFR § 3.155(b), a supplemental claim is required for benefits not previously granted, such as TDIU.",
  ])("flags: %s", (sentence) => {
    expect(rules(sentence, FILING)).toEqual([RULE]);
  });

  it.each([
    "Note: Under 38 CFR § 3.155(b), filing an Intent to File protects your effective date; filing a supplemental claim allows VA to readjudicate based on new evidence.",
    "38 CFR § 3.155(b) does not apply to supplemental claims, so you should file a supplemental claim directly.",
    "Under 38 CFR § 3.2501, you should file a supplemental claim with new and relevant evidence.",
    "Per 38 CFR § 3.155(b), an intent to file holds your date for one year.",
  ])("leaves alone: %s", (sentence) => {
    expect(rules(sentence, FILING)).toEqual([]);
  });

  it("quotes the sentence of 38 CFR 3.155 that excludes supplemental claims", () => {
    const [hit] = findContradictions(
      "Per 38 CFR § 3.155(b), a supplemental claim is required for TDIU.",
      { topics: FILING },
    );
    expect(hit.says).toBe(
      "cites 38 CFR 3.155(b), the intent-to-file paragraph, as the rule for a Supplemental Claim",
    );
    expect(quotes.corrections[hit.correction]).toMatchObject({
      citation: "38 CFR § 3.155",
      text: "The provisions of this section are applicable to all claims governed by part 3, with the exception that paragraph (b) of this section, regarding intent to file a claim, does not apply to supplemental claims.",
    });
  });
});

describe("the higher of two ratings given as the combined rating", () => {
  const RULE = "ratings-higher-of-two";

  it.each([
    '38 CFR § 4.1 states that when a veteran has two or more disabilities, the rating is determined by the "higher of two evaluations."',
    "If both conditions are rated at 40% or more: The veteran receives the higher of the two percentages (e.g., if one is 40% and the other is 50%, the veteran receives 50%).",
    'They define how to calculate combined ratings using the "higher of two" rule (if one is rated at 100%, the other gets a boost).',
  ])("flags on any route: %s", (sentence) => {
    expect(rules(sentence)).toEqual([RULE]);
  });

  it.each([
    "38 CFR § 4.7: Higher of two evaluations when between ratings.",
    "- A is the higher of the two ratings.",
    "The combined rating is not the higher of the two; the ratings are combined under 38 CFR § 4.25.",
    "Where there is a question as to which of two evaluations shall be applied to one disability, the higher of two evaluations will be assigned.",
  ])("leaves alone: %s", (sentence) => {
    expect(rules(sentence)).toEqual([]);
  });

  it("quotes 38 CFR 4.25", () => {
    const [hit] = findContradictions(
      "The veteran receives the higher of the two percentages.",
    );
    expect(hit.says).toBe(
      "takes the higher of two ratings as the combined rating",
    );
    expect(hit.correction).toBe("ratings-combined");
  });
});
