/**
 * The guard every correction rule passes through first. A rule may fire only
 * on a sentence that puts the claim to the reader as true. A question, a
 * myth label, a list of common mistakes, a warning against the claim,
 * something someone else said, the veteran's own history and the law as it
 * used to be all use the same words and are not that.
 */
import { describe, it, expect } from "vitest";
import {
  addressesTheReader,
  claimAsserted,
  isDenyingHeading,
  withoutDenyingClauses,
} from "../../utils/assertionGuard";

const mentions = (pattern) => (text) => pattern.test(text);
const ADDED = mentions(
  /\badd(?:s|ed|ing)?\b[^.]*\bratings\b|\bratings are added\b/i,
);
const NEW_AND_MATERIAL = mentions(/\bnew and material\b/i);
const asserted = (sentence, matches = ADDED, around = {}) =>
  claimAsserted(sentence, {}, matches, around);

describe("a plain assertion", () => {
  it.each([
    "VA adds the ratings together.",
    "The table adds the ratings of the two conditions.",
    "I can explain the rule: the table adds the ratings of the two conditions.",
    "A claimant or his or her representative should know VA adds the ratings.",
  ])("passes: %s", (sentence) => {
    expect(asserted(sentence)).toBe(true);
  });

  it("does not pass when the rule itself does not match", () => {
    expect(asserted("File the form today.")).toBe(false);
  });
});

describe("a question", () => {
  it.each([
    "Does VA add the ratings together?",
    'Did they say "ratings are added together"?',
  ])("is stopped: %s", (sentence) => {
    expect(asserted(sentence)).toBe(false);
  });
});

describe("a sentence framed as a myth or a mistake", () => {
  it.each([
    "Myth: your ratings are added together.",
    "False: ratings are added together.",
    "A common mistake is believing your ratings are added together.",
    "It is a misconception that VA works by adding the ratings.",
    "It is false that ratings are added together.",
    "It is not true that ratings are added together.",
    "It is not the case that ratings are added together.",
    "Neither is it true that ratings are added together.",
    "The idea that ratings are added together is mistaken.",
    "Far from being simple addition, where ratings are added together, VA math is stepwise.",
    "Ratings are added together only in the popular imagination; VA combines them.",
    "Adding the ratings is the classic error.",
    "Some guides wrongly state that ratings are added together.",
  ])("is not an assertion, label and all: %s", (sentence) => {
    expect(ADDED(sentence)).toBe(true);
    expect(asserted(sentence)).toBe(false);
    expect(claimAsserted(sentence, { readsDenialItself: true }, ADDED)).toBe(
      false,
    );
  });

  it("does not take 'clear and unmistakable error' for a label", () => {
    expect(
      addressesTheReader(
        "Without clear and unmistakable error, VA adds the ratings together.",
      ),
    ).toBe(true);
  });
});

describe("a sentence under a heading of things not to do", () => {
  it.each([
    "Common mistakes:",
    "Myths:",
    "What not to do:",
    "Things to avoid:",
    "Frequent errors:",
  ])("recognises the heading: %s", (line) => {
    expect(isDenyingHeading(line)).toBe(true);
  });

  it.each([
    "Next steps:",
    "What to file:",
    "Common mistakes are easy to make.",
  ])("does not take this for one: %s", (line) => {
    expect(isDenyingHeading(line)).toBe(false);
  });

  it("is not asserted", () => {
    expect(
      asserted("- Assuming ratings are added together", ADDED, {
        underDenyingHeading: true,
      }),
    ).toBe(false);
  });
});

describe("a statement of what is excluded", () => {
  it.each([
    "A review that adds the ratings is closed to this method.",
    "The table excludes any step that adds the ratings.",
    "VA skips the step that adds the ratings.",
  ])("is not an assertion: %s", (sentence) => {
    expect(asserted(sentence)).toBe(false);
  });
});

describe("a claim attributed to someone else", () => {
  it.each([
    "My representative told me VA adds the ratings together.",
    "The clerk said VA adds the ratings together.",
    "A lot of veterans assume VA adds the ratings together.",
    "Some say VA adds the ratings together.",
    "Some forums still talk about adding the ratings.",
    "People often think VA adds the ratings together.",
    "If someone tells you that ratings are added together, ask them to read 38 CFR 4.25.",
    "You may have heard that the ratings are added together.",
    "You heard from another veteran that ratings are added together.",
    "It is often claimed that ratings are added together.",
    "Your earlier VSO advised that VA adds the ratings together.",
    "The letter says the ratings are added together.",
    "I thought the ratings are added together until I read the letter.",
    "He was told VA adds the ratings together.",
  ])("is stopped for every rule: %s", (sentence) => {
    expect(asserted(sentence)).toBe(false);
    expect(claimAsserted(sentence, { readsDenialItself: true }, ADDED)).toBe(
      false,
    );
  });

  it.each([
    "As I said, ratings are added together.",
    "VA told Congress it would keep the rule simple: ratings are added together.",
    "It turned out to be simple: ratings are added together.",
    "Ratings are added together, which is what he should have told you.",
    "Ratings are added together, as I have told many veterans.",
  ])(
    "is not stopped by a 'said' or 'told' that attributes nothing: %s",
    (sentence) => {
      expect(asserted(sentence)).toBe(true);
    },
  );
});

describe("the veteran's own past, or a witness's", () => {
  it.each([
    "I asked the clerk and VA adds the ratings together.",
    "I filed in March and my ratings are added together.",
    "She was rated twice and VA adds the ratings together.",
    "My claim was decided by adding the ratings.",
  ])("is stopped: %s", (sentence) => {
    expect(asserted(sentence)).toBe(false);
  });

  it.each([
    "Let me be clear: ratings are added together.",
    "In my experience, ratings are added together.",
    "Ratings are added together, and I have checked.",
    "I was able to confirm that ratings are added together.",
    "If a veteran has two conditions, he will find VA adds the ratings together.",
    "A veteran and her spouse should know ratings are added together.",
    "Ratings are added together, and that is my final answer.",
  ])("is not stopped by an incidental pronoun: %s", (sentence) => {
    expect(asserted(sentence)).toBe(true);
  });
});

describe("the law as it used to be", () => {
  it.each([
    "Letters from before the Appeals Modernization Act use new and material evidence.",
    "Back then the test was new and material evidence.",
    "The rating decision of March 2016 found new and material evidence.",
    "In 2014 a reopened claim needed new and material evidence.",
    "New and material evidence was the pre-2019 phrase.",
  ])("is stopped: %s", (sentence) => {
    expect(asserted(sentence, NEW_AND_MATERIAL)).toBe(false);
  });

  it("is not what 'since 2015 the rule has been' describes", () => {
    expect(
      asserted(
        "Since 2015 the rule has been simple: you need new and material evidence.",
        NEW_AND_MATERIAL,
      ),
    ).toBe(true);
  });

  it("does not stop a rule about dates on a dated year", () => {
    const sentence = "Iraq is covered from September 11 of 2001.";
    expect(addressesTheReader(sentence)).toBe(false);
    expect(addressesTheReader(sentence, { datedClaim: true })).toBe(true);
  });
});

describe("the answer saying what it lacks", () => {
  // Run 2026-10-05 12:56 a13: a request for details, which the bilateral rule
  // read as a statement once a bare "me" stopped silencing it.
  it("is a request, not a rule", () => {
    expect(
      addressesTheReader(
        "I do not have your specific medical records, current diagnoses, or the specific body parts (e.g., which fingers are involved, or if the hands are on the same side) that would allow me to determine if you are eligible for a Bilateral Pair rating.",
      ),
    ).toBe(false);
  });
});

describe("a sentence that is corrected straight away", () => {
  it("is not asserted when the next sentence gives the right rule", () => {
    expect(
      asserted("Ratings are added together.", ADDED, {
        next: "In fact VA combines them.",
      }),
    ).toBe(false);
    expect(
      asserted("Ratings are added together.", ADDED, {
        next: "Then file the form.",
      }),
    ).toBe(true);
  });

  it("is not asserted when it gives the right rule itself", () => {
    expect(
      asserted("Adding the ratings gives 80; the real answer is 65."),
    ).toBe(false);
  });
});

describe("a denial inside the sentence, read clause by clause", () => {
  it.each([
    ["VA does not add ratings together.", ADDED],
    ["VA never adds the ratings together.", ADDED],
    ["VA combines them rather than adding the ratings.", ADDED],
    ["You don't need new and material evidence.", NEW_AND_MATERIAL],
    [
      "You do not need new and material evidence anymore; other evidence is enough.",
      NEW_AND_MATERIAL,
    ],
  ])(
    "stops the claim that sits in the denying clause: %s",
    (sentence, matches) => {
      expect(asserted(sentence, matches)).toBe(false);
    },
  );

  it.each([
    [
      "The combined rating is found by adding the individual ratings, with exceptions for conditions that cannot be combined.",
      mentions(/\badding the individual ratings\b/i),
    ],
    [
      "You do not need to file anything unless you have new and material evidence to reopen the claim.",
      NEW_AND_MATERIAL,
    ],
    [
      "If no other letters exist, you need new and material evidence.",
      NEW_AND_MATERIAL,
    ],
  ])("passes the claim that stands outside it: %s", (sentence, matches) => {
    expect(asserted(sentence, matches)).toBe(true);
  });

  it("shows what is left once the denying clauses are out", () => {
    expect(
      withoutDenyingClauses(
        "Ratings are added, with exceptions for conditions that cannot be combined.",
      ),
    ).toBe("Ratings are added, with exceptions for conditions");
    expect(withoutDenyingClauses("VA does not add ratings together.")).toBe("");
  });

  it("removes examiner wording until none is left, not just one pass of it", () => {
    // One pass over "not not previously" removes the second "not " and
    // leaves "not previously", which is the wording it was meant to remove.
    expect(withoutDenyingClauses("It was not not previously rated.")).toBe(
      "It was previously rated.",
    );
    expect(withoutDenyingClauses("It was not previously rated.")).toBe(
      "It was previously rated.",
    );
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

describe("empty input", () => {
  it("asserts nothing", () => {
    expect(claimAsserted("")).toBe(false);
    expect(claimAsserted(null)).toBe(false);
  });
});
