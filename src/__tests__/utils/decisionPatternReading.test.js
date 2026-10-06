/**
 * The Decision Decoder's rule-based reading states only what the text
 * establishes. It says which kinds of outcome a letter appears to hold and
 * never how many issues: a first small-model run showed "2 issue(s) granted
 * or increased, and 1 issue(s) denied" for a letter that grants one and
 * denies one, because "is granted" appears twice about the same issue.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  patternMatchDenial,
  smallModelReading,
} from "../../utils/decisionPatternReading";
import {
  ALL_DENIED,
  ALL_GRANTED,
  CONTINUED_AND_DENIED,
  ONE_DEFERRED,
  RATING_CONTINUED,
} from "./fixtures/fictionalDecisionLetters";

const GOLDEN_LETTER = readFileSync(
  "src/__tests__/agentic/fixtures/fictional-decision-letter.txt",
  "utf8",
);
const LETTERS = {
  "one granted, one denied (the golden letter)": GOLDEN_LETTER,
  "all granted": ALL_GRANTED,
  "all denied": ALL_DENIED,
  "one granted, one deferred": ONE_DEFERRED,
  "a rating continued": RATING_CONTINUED,
  "one continued, one denied": CONTINUED_AND_DENIED,
};
const everyString = (reading) =>
  Object.values(reading)
    .flat()
    .filter((value) => typeof value === "string");

const REVIEW_LINE =
  "If you disagree with an issue that was denied or continued, you can ask for a review of just that issue. The three review options are set out below.";

describe("no letter is given a count of issues", () => {
  it.each(Object.entries(LETTERS))("%s", (_name, letter) => {
    for (const text of everyString(patternMatchDenial(letter))) {
      expect(text).not.toMatch(/\d issue/);
      expect(text).not.toContain("issue(s)");
    }
  });
});

describe("the golden letter: one issue granted, one denied", () => {
  const reading = patternMatchDenial(GOLDEN_LETTER);

  it("says it grants at least one issue and denies at least one", () => {
    expect(reading.decision_type).toBe("Mixed Decision");
    expect(reading.plain_english).toBe(
      "This decision appears to do more than one thing: it grants or increases at least one issue and denies at least one issue. The built-in reader cannot count the issues or tell you which is which, so read each numbered item in your letter. You do not need to ask for a review of anything that was granted.",
    );
  });

  it("points to the review options instead of naming two of the three", () => {
    expect(reading.action_plan).toEqual([
      "Confirm the rating and effective date for each issue that was granted or increased",
      "For a denied issue, note the evidence the letter says is missing",
      REVIEW_LINE,
      "Contact a VSO to confirm which parts of the decision are final and which can be reviewed",
    ]);
    expect(reading.action_plan.join(" ")).not.toMatch(
      /Supplemental Claim or Higher-Level Review/,
    );
  });

  it("gives the one-year period for a review", () => {
    expect(reading.deadline_warning).toBe(
      "You have 1 year from the date of this decision to ask for a review of an issue that was denied or continued while keeping your effective date.",
    );
  });

  it("finds a denial whose words are split across a line break", () => {
    const split = GOLDEN_LETTER.replace(
      "2. Service connection for a left knee strain is denied.",
      "2. Service connection for a left knee strain is under review.",
    );
    expect(split).toMatch(/Service connection is\ndenied/);
    expect(split).not.toMatch(/is denied/);
    expect(patternMatchDenial(split).decision_type).toBe("Mixed Decision");
    expect(patternMatchDenial(split).plain_english).toContain(
      "denies at least one issue",
    );
  });
});

describe("other letter shapes", () => {
  it("all granted: a grant, and nothing about a denial", () => {
    const reading = patternMatchDenial(ALL_GRANTED);
    expect(reading.decision_type).toBe("Granted");
    expect(everyString(reading).join(" ")).not.toMatch(/denie[ds]/i);
  });

  it("all denied, with one denial split across a line: a denial", () => {
    const reading = patternMatchDenial(ALL_DENIED);
    expect(reading.decision_type).toBe("Full Denial");
    expect(everyString(reading).join(" ")).not.toMatch(/grants|granted/i);
  });

  it("one granted, one deferred: says both, and that no decision was made on the deferred issue", () => {
    const reading = patternMatchDenial(ONE_DEFERRED);
    expect(reading.decision_type).toBe("Mixed Decision");
    expect(reading.plain_english).toContain(
      "it grants or increases at least one issue and defers at least one issue",
    );
    expect(reading.plain_english).not.toMatch(/denies/);
    expect(reading.action_plan).toContain(
      "For a deferred issue, attend any examination VA schedules and send what it asks for. No decision has been made on that issue yet",
    );
    expect(reading.action_plan).not.toContain(REVIEW_LINE);
    expect(reading.deadline_warning).toBeNull();
  });

  it("a rating continued: not called a denial or a grant", () => {
    const reading = patternMatchDenial(RATING_CONTINUED);
    expect(reading.decision_type).toBe("Rating Continued");
    expect(reading.plain_english).toBe(
      "This decision appears to continue at least one rating at its current level: VA did not raise it or lower it. The built-in reader cannot tell you the reasons, so read the Reasons for Decision section of your letter.",
    );
    expect(reading.action_plan).toContain(REVIEW_LINE);
    expect(everyString(reading).join(" ")).not.toMatch(
      /denied your claim|approved|Congratulations/,
    );
  });

  it("one continued, one denied: a continued rating is not counted as granted", () => {
    const reading = patternMatchDenial(CONTINUED_AND_DENIED);
    expect(reading.decision_type).toBe("Mixed Decision");
    expect(reading.plain_english).toContain(
      "it continues at least one rating at its current level and denies at least one issue",
    );
    expect(reading.plain_english).not.toMatch(/grants/);
    expect(reading.action_plan).not.toContain(
      "Confirm the rating and effective date for each issue that was granted or increased",
    );
  });
});

describe("text that is not a decision", () => {
  it("is still not read as one", () => {
    expect(patternMatchDenial("Nothing of the kind here.")).toBeNull();
  });
});

describe("a reading shown because the small model was held back", () => {
  const POINTS_AT_THE_MODEL = /Warrant Council|load AI|AI analysis|Load the/i;

  it("does not tell the veteran to load the AI that was just held back", () => {
    const reading = smallModelReading(ALL_DENIED);
    expect(reading._fallbackReason).toBe("small_model");
    expect(reading.decision_type).toBe("Full Denial");
    expect(reading.plain_english).toBe(
      "The VA denied your claim. The built-in reader cannot tell you the specific reasons, so read the Reasons for Decision section of your letter. A Veterans Service Officer can go through it with you at no cost, and the review options are set out below.",
    );
    expect(reading.va_reasoning).toBe(
      "Pattern matching identified a denial but could not determine the specific reason.",
    );
    expect(reading.missing_elements).toEqual([
      "Specific denial reason not detected - the Reasons for Decision section of your letter gives it",
    ]);
    expect(reading.action_plan).toEqual([
      "Ask a Veterans Service Officer to go through the letter with you; their help is free",
      "Request a copy of your C-File to understand what evidence VA used",
      "If you disagree, you can ask for a review. The three review options are set out below",
      "You have 1 year from this decision to file an appeal",
    ]);
  });

  it.each(Object.entries(LETTERS))(
    "%s: no line points at the AI model",
    (_name, letter) => {
      for (const text of everyString(smallModelReading(letter))) {
        if (text === smallModelReading(letter)._fallbackNote) continue;
        expect(text).not.toMatch(POINTS_AT_THE_MODEL);
      }
    },
  );

  it("keeps the pointer to the AI when no model was held back", () => {
    const reading = patternMatchDenial(ALL_DENIED);
    expect(reading.plain_english).toBe(
      "The VA denied your claim. Load the Warrant Council AI for a detailed analysis of the specific reasons.",
    );
    expect(reading.action_plan[0]).toBe(
      "Load the Warrant Council AI (button above) for a full plain-English translation",
    );
  });
});
