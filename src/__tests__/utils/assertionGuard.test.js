/**
 * The guard every correction rule passes through first. A rule may fire only
 * on a sentence that puts the claim to the reader as true. A question, a
 * warning against the claim, something someone else said, the veteran's own
 * history and the law as it used to be all use the same words and are not
 * that.
 */
import { describe, it, expect } from "vitest";
import {
  addressesTheReader,
  claimAsserted,
  withoutDenyingClauses,
} from "../../utils/assertionGuard";

const mentions = (pattern) => (text) => pattern.test(text);
const ADDED = mentions(
  /\badd(?:s|ed|ing)?\b[^.]*\bratings\b|\bratings are added\b/i,
);
const NEW_AND_MATERIAL = mentions(/\bnew and material\b/i);
const NEW_EVIDENCE_IN_REVIEW = mentions(
  /\bhigher-level review\b[^.]*\bnew (?:medical opinion|evidence)\b/i,
);

describe("a plain assertion", () => {
  it.each([
    ["VA adds the ratings together.", ADDED],
    ["The table adds the ratings of the two conditions.", ADDED],
    ["You need new and material evidence to reopen it.", NEW_AND_MATERIAL],
    [
      "I can explain the rule: the table adds the ratings of the two conditions.",
      ADDED,
    ],
    [
      "A claimant or his or her representative needs new and material evidence.",
      NEW_AND_MATERIAL,
    ],
  ])("passes: %s", (sentence, matches) => {
    expect(claimAsserted(sentence, {}, matches)).toBe(true);
  });

  it("does not pass when the rule itself does not match", () => {
    expect(claimAsserted("File the form today.", {}, ADDED)).toBe(false);
  });
});

describe("a question", () => {
  it.each([
    "Does VA add the ratings together?",
    'Did they say "ratings are added together"?',
  ])("is stopped: %s", (sentence) => {
    expect(addressesTheReader(sentence)).toBe(false);
    expect(claimAsserted(sentence, {}, ADDED)).toBe(false);
  });
});

describe("a denial or a warning", () => {
  it.each([
    ["VA does not add ratings together.", ADDED],
    ["VA never adds the ratings together.", ADDED],
    ["VA combines them rather than adding the ratings.", ADDED],
    ["You don't need new and material evidence.", NEW_AND_MATERIAL],
    ["New and material is the wrong phrase now.", NEW_AND_MATERIAL],
    [
      "You do not need new and material evidence anymore; new and relevant evidence is enough.",
      NEW_AND_MATERIAL,
    ],
    [
      "The standard you must meet today is new and relevant, which is no higher than new and material.",
      NEW_AND_MATERIAL,
    ],
    [
      "After a decision is final you need new and relevant evidence, not new and material evidence, to have it readjudicated.",
      NEW_AND_MATERIAL,
    ],
    [
      "A Higher-Level Review is the wrong lane for new evidence.",
      NEW_EVIDENCE_IN_REVIEW,
    ],
  ])(
    "is stopped where the claim sits in the clause that denies it: %s",
    (sentence, matches) => {
      expect(matches(sentence)).toBe(true);
      expect(claimAsserted(sentence, {}, matches)).toBe(false);
    },
  );

  it.each([
    [
      "The combined rating is found by adding the individual ratings, with exceptions for conditions that cannot be combined.",
      mentions(/\badding the individual ratings\b/i),
    ],
    [
      "In the Higher-Level Review, argue that the examiner's 'less likely than not' opinion is not the only valid one and submit a new medical opinion from a private provider.",
      mentions(/\bhigher-level review\b[^.]*\bsubmit a new medical opinion\b/i),
    ],
    [
      "You do not need to file anything unless you have new and material evidence to reopen the claim.",
      NEW_AND_MATERIAL,
    ],
    [
      "A Supplemental Claim is only appropriate with new and material evidence that was not previously associated with your claim.",
      NEW_AND_MATERIAL,
    ],
    [
      "If no other letters exist, you need new and material evidence.",
      NEW_AND_MATERIAL,
    ],
  ])(
    "is passed where the claim stands outside the denying clause: %s",
    (sentence, matches) => {
      expect(claimAsserted(sentence, {}, matches)).toBe(true);
    },
  );
});

describe("a denial, read clause by clause", () => {
  it("shows what is left once the denying clauses are out", () => {
    expect(
      withoutDenyingClauses(
        "Ratings are added, with exceptions for conditions that cannot be combined.",
      ),
    ).toBe("Ratings are added, with exceptions for conditions");
    expect(withoutDenyingClauses("VA does not add ratings together.")).toBe("");
  });

  it("treats 'not yet', 'not just' and 'less likely than not' as no denial", () => {
    expect(
      claimAsserted(
        "If you have not yet filed, VA adds the ratings together.",
        {},
        mentions(/not yet filed, VA adds the ratings/i),
      ),
    ).toBe(true);
  });

  it("is left to a rule whose error is itself a denial", () => {
    const sentence = "You cannot appeal the denial without new evidence.";
    const matches = mentions(/cannot appeal/i);
    expect(claimAsserted(sentence, {}, matches)).toBe(false);
    expect(claimAsserted(sentence, { readsDenialItself: true }, matches)).toBe(
      true,
    );
  });
});

describe("what someone else said or believed", () => {
  it.each([
    "My representative told me VA adds the ratings together.",
    "The clerk said VA adds the ratings together.",
    "A lot of veterans assume VA adds the ratings together.",
    "Many people thought the ratings are added together.",
    "The letter says the ratings are added together.",
    "The VSO wrote that VA adds the ratings together.",
    "The advice that VA adds the ratings together turned out to be mistaken.",
  ])("is stopped for every rule: %s", (sentence) => {
    expect(claimAsserted(sentence, {}, ADDED)).toBe(false);
    expect(claimAsserted(sentence, { readsDenialItself: true }, ADDED)).toBe(
      false,
    );
  });
});

describe("the veteran's own account, or a witness's", () => {
  it.each([
    "I have bilateral knee pain, and the hip pain is on the same side.",
    "My mother receives the higher of the two survivor benefits.",
    "I deployed to Kuwait three weeks after September 11, 2001.",
    "He has bilateral plantar fasciitis and limps toward the same side.",
    "My husband left for Kuwait two weeks after September 11, 2001.",
    "I asked for a Higher-Level Review using VA Form 20-0996.",
    "She was rated under both codes and receives the higher of the two.",
  ])("is stopped for every rule: %s", (sentence) => {
    expect(addressesTheReader(sentence, { datedClaim: true })).toBe(false);
    expect(claimAsserted(sentence, { readsDenialItself: true })).toBe(false);
  });

  it("is not the assistant speaking for itself", () => {
    expect(
      addressesTheReader("I cannot generate a nexus letter for that pair."),
    ).toBe(true);
  });
});

describe("the law as it used to be", () => {
  it.each([
    "Letters from before the Appeals Modernization Act use new and material evidence.",
    "Back then the test was new and material evidence.",
    "The rating decision of March 2016 found new and material evidence.",
    "In 2014 a reopened claim needed new and material evidence.",
  ])("is stopped: %s", (sentence) => {
    expect(claimAsserted(sentence, {}, NEW_AND_MATERIAL)).toBe(false);
  });

  it("does not stop a rule about dates on an older year", () => {
    const sentence = "Iraq is covered on or after September 11, 2001.";
    expect(addressesTheReader(sentence)).toBe(false);
    expect(addressesTheReader(sentence, { datedClaim: true })).toBe(true);
  });
});

describe("empty input", () => {
  it("asserts nothing", () => {
    expect(claimAsserted("")).toBe(false);
    expect(claimAsserted(null)).toBe(false);
  });
});
