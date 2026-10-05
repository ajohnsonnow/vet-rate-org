/**
 * Contradiction rules for filing advice: a deadline put on a supplemental
 * claim, "new and material" given as today's standard, and an Intent to File
 * recommended for a claim that is already filed.
 */
import { describe, it, expect } from "vitest";
import {
  buildContradictionNote,
  findContradictions,
} from "../../utils/contradictionCheck";
import quotes from "../../data/verifiedQuotes.json";

const REVIEW = ["decision-review"];
const rules = (text, topics = REVIEW) =>
  findContradictions(text, { topics }).map((hit) => hit.rule);

describe("a deadline stated for a supplemental claim", () => {
  it.each([
    "You have one year from the date of this letter to file a Supplemental Claim.",
    "If you do not file a Supplemental Claim within one year, you will likely lose the opportunity to appeal the denial of the knee strain.",
    "A Supplemental Claim must be filed within 1 year of the decision.",
    "The deadline to file a Supplemental Claim is one year from the decision date.",
  ])("flags: %s", (sentence) => {
    expect(rules(sentence)).toEqual(["supplemental-claim-deadline"]);
  });

  it.each([
    "File a Supplemental Claim within one year to keep your effective date.",
    "File a Supplemental Claim (VA Form 20-0995) within one year of the decision date to ask for a new look at the knee.",
    "You have one year to request a Higher-Level Review or a Board Appeal; a Supplemental Claim can be filed at any time.",
    "You can file a Supplemental Claim (VA Form 20-0995) with the new nexus opinion.",
    "You have one year from the date of this letter to ask for a review of this decision.",
    "A Supplemental Claim filed more than one year after the decision can change the effective date.",
  ])("leaves alone: %s", (sentence) => {
    expect(rules(sentence)).toEqual([]);
  });

  it("quotes the sentence that sets no time limit", () => {
    const [hit] = findContradictions(
      "You have one year from the date of this letter to file a Supplemental Claim.",
      { topics: REVIEW },
    );
    expect(buildContradictionNote(hit)).toBe(
      `Vet-Rate check: this answer puts a deadline on filing a Supplemental Claim. 38 CFR § 3.2500(a)(2) says: "${quotes.corrections["supplemental-any-time"].text}" Check this point with a Veterans Service Officer before relying on it.`,
    );
    expect(quotes.corrections["supplemental-any-time"].text).toContain(
      "At any time after VA issues notice of a decision on an issue within a claim, a claimant may file a supplemental claim",
    );
  });
});

describe("new and material given as the current standard", () => {
  it.each([
    "Per 38 CFR § 3.156, if the veteran has new and material evidence that was not available at the time of the original decision, the veteran may be entitled to a new decision.",
    "You may need to file a Supplemental Claim (38 CFR § 3.156) with new and material evidence.",
    "A Supplemental Claim is only appropriate if you have new and material evidence that was not previously associated with your claim.",
    'Consider the "New and Material Evidence" Doctrine',
    "Under 38 CFR § 3.156, you have the right to submit new and material evidence to reopen a denied claim.",
  ])("flags: %s", (sentence) => {
    expect(rules(sentence, ["supplemental"])).toEqual([
      "new-and-material-standard",
    ]);
  });

  it.each([
    "The new and relevant standard is no higher than the previous new and material evidence standard.",
    'This is a lower bar than "new and material" evidence.',
    "The old new and material test was replaced by new and relevant evidence.",
    "A Supplemental Claim needs new and relevant evidence.",
    "Legacy claims used the new and material standard.",
  ])("leaves alone: %s", (sentence) => {
    expect(rules(sentence, ["supplemental"])).toEqual([]);
  });

  it("quotes the sentence that names the present standard", () => {
    const [hit] = findContradictions(
      "File a Supplemental Claim with new and material evidence.",
      { topics: ["supplemental"] },
    );
    expect(hit.correction).toBe("new-and-relevant");
    expect(quotes.corrections["new-and-relevant"].text).toContain(
      "The new and relevant standard will not impose a higher evidentiary threshold than the previous new and material evidence standard",
    );
  });
});

describe("an Intent to File recommended for a claim already filed", () => {
  const TOPICS = ["next-claim-step"];

  it.each([
    "If you have not yet filed an Intent to File (VA Form 21-0966) for any of your 5 pending claims, you should do so immediately.",
    "File an Intent to File (VA Form 21-0966) for any pending claims.",
    "Immediate Action: File an Intent to File (ITF) for Pending Claims",
    "Submit an ITF for the claims you have already filed.",
  ])("flags: %s", (sentence) => {
    expect(rules(sentence, TOPICS)).toEqual(["intent-to-file-for-filed-claim"]);
  });

  it.each([
    "If you need to file a new claim, first file an Intent to File (VA Form 21-0966) to protect your effective date.",
    "An Intent to File is not needed for your pending claims.",
    "Your pending claims are already filed; an Intent to File only helps a claim you have not filed yet.",
    "File an Intent to File before you file your first claim.",
  ])("leaves alone: %s", (sentence) => {
    expect(rules(sentence, TOPICS)).toEqual([]);
  });

  it("quotes what an intent to file is for", () => {
    const [hit] = findContradictions(
      "File an Intent to File for any pending claims.",
      { topics: TOPICS },
    );
    expect(hit.correction).toBe("intent-to-file-purpose");
    expect(quotes.corrections["intent-to-file-purpose"].text).toContain(
      "may indicate a claimant's desire to file a claim for benefits by submitting an intent to file a claim to VA",
    );
  });

  it("belongs to the intent-to-file, supplemental and decision-review topics too", () => {
    const sentence = "File an Intent to File for any pending claims.";
    for (const topic of ["intent-to-file", "supplemental", "decision-review"]) {
      expect(rules(sentence, [topic])).toEqual([
        "intent-to-file-for-filed-claim",
      ]);
    }
    expect(rules(sentence, ["tdiu"])).toEqual([]);
  });
});
