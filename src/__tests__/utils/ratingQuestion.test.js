/**
 * Rating arithmetic never comes from a model. A question that asks for a
 * combined rating, a bilateral factor result or the TDIU percentage
 * thresholds is answered from the calculator when its ratings can be read
 * with certainty, and otherwise by a fixed answer that asks for them.
 */
import { describe, it, expect } from "vitest";
import {
  NEEDS_RATINGS_LEAD,
  answerRatingQuestion,
  asksRatingArithmetic,
  buildNeedsRatingsAnswer,
  describeQuestionRatings,
  parseRatingsFromQuestion,
} from "../../utils/ratingQuestion";
import { TDIU_REGULATION_QUOTES } from "../../utils/raterGrounding";
import { GOLDEN, recordedCases } from "./recordedAnswers";

const read = (question) => {
  const parsed = parseRatingsFromQuestion(question);
  return parsed && parsed.conditions.map((c) => [c.name, c.rating]);
};
const sides = (question) =>
  parseRatingsFromQuestion(question).conditions.map((c) => c.side);

describe("asksRatingArithmetic", () => {
  it.each([
    "What is my combined rating?",
    "How does the bilateral factor change my total rating?",
    "Can you explain VA math for my overall disability rating?",
    "How do my ratings combine?",
    "Do I qualify for TDIU?",
    "Am I entitled to unemployability?",
    "Do my ratings meet the TDIU thresholds?",
    "Analyze my 80% combined rating and explain how the math works.",
  ])("recognises: %s", (question) => {
    expect(asksRatingArithmetic(question)).toBe(true);
  });

  it.each([
    "How do I file a supplemental claim?",
    "How do I increase my PTSD rating?",
    "How do I apply for TDIU?",
    "Which form do I use for TDIU?",
    "Skip the calculation and write me a personal statement for my back claim instead.",
    "Help me plan my next round of claims given my current 70% rating.",
    "",
  ])("does not recognise: %s", (question) => {
    expect(asksRatingArithmetic(question)).toBe(false);
  });
});

const READ = [
  [
    "Calculate my combined rating for: 50% PTSD, 30% tinnitus, 20% back, 10% knee.",
    [
      ["PTSD", 50],
      ["tinnitus", 30],
      ["back", 20],
      ["knee", 10],
    ],
  ],
  ["Calculate my combined rating: just 100% PTSD.", [["PTSD", 100]]],
  [
    "Can I qualify for TDIU with only one 60% mental health rating?",
    [["mental health", 60]],
  ],
  [
    "What is my combined rating with 50% PTSD, 30% migraines and 10% tinnitus?",
    [
      ["PTSD", 50],
      ["migraines", 30],
      ["tinnitus", 10],
    ],
  ],
  [
    "My ratings are PTSD 50%, back 20% and tinnitus 10%. What is my combined rating?",
    [
      ["PTSD", 50],
      ["back", 20],
      ["tinnitus", 10],
    ],
  ],
  [
    "I have PTSD at 70% and a back condition rated 20%, what is my combined rating?",
    [
      ["PTSD", 70],
      ["back", 20],
    ],
  ],
  [
    "Combined rating for 50 percent PTSD plus 30 percent sleep apnea?",
    [
      ["PTSD", 50],
      ["sleep apnea", 30],
    ],
  ],
  [
    "What is my combined rating: left knee 10%, right knee 10%, back 30%",
    [
      ["left knee", 10],
      ["right knee", 10],
      ["back", 30],
    ],
  ],
  [
    "Do I meet the TDIU thresholds with 40% for my back and 30% for migraines?",
    [
      ["back", 40],
      ["migraines", 30],
    ],
  ],
];

describe("parseRatingsFromQuestion: ratings it reads", () => {
  it.each(READ)("%s", (question, expected) => {
    expect(read(question)).toEqual(expected);
  });

  it("reads ratings listed without conditions and numbers them", () => {
    expect(
      read("Am I eligible for TDIU with one 60% rating and three 20% ratings?"),
    ).toEqual([
      ["The first rating listed", 60],
      ["The second rating listed", 20],
      ["The third rating listed", 20],
      ["The fourth rating listed", 20],
    ]);
    expect(read("What is the combined rating for 50% and 30%?")).toEqual([
      ["The first rating listed", 50],
      ["The second rating listed", 30],
    ]);
    expect(
      read("My ratings are 50%, 30% and 10%, what do they combine to?"),
    ).toEqual([
      ["The first rating listed", 50],
      ["The second rating listed", 30],
      ["The third rating listed", 10],
    ]);
  });

  it("takes a side only from the word left or right in the condition", () => {
    expect(
      sides("Combined rating: left knee 10%, right knee 10%, back 30%"),
    ).toEqual(["left", "right", undefined]);
    expect(
      parseRatingsFromQuestion("Combined rating for 50% PTSD and 30% back?")
        .sidesGiven,
    ).toBe(false);
    expect(
      parseRatingsFromQuestion(
        "Combined rating: left knee 10%, right knee 10%, back 30%",
      ).sidesGiven,
    ).toBe(true);
  });
});

const NOT_READ = [
  ["no figures", "What is my combined rating?"],
  [
    "a combined figure, not a rating",
    "Analyze my 80% combined rating and explain how the math works.",
  ],
  [
    "a combined figure stated",
    "My combined rating is 80%, how does the VA math work?",
  ],
  [
    "one rating shared between two conditions",
    "Calculate combined rating with bilateral factor for both knees at 10% each plus 30% back.",
  ],
  [
    "a change of rating",
    "What would my combined rating be if my PTSD went from 50% to 70%?",
  ],
  [
    "a hypothetical",
    "What if I got 70% for PTSD and 20% for my back, what is my combined rating?",
  ],
  [
    "a rating hoped for",
    "I have 50% PTSD and expect 30% for sleep apnea, what is my combined rating?",
  ],
  ["a threshold", "Does a combined rating of 70% qualify for TDIU?"],
  ["a threshold with a bound", "Do I need 60% or more for TDIU eligibility?"],
  ["the factor itself", "Is the bilateral factor 10%?"],
  [
    "an example",
    "For example 50% PTSD and 30% back, how are ratings combined?",
  ],
  [
    "a rating that is not a multiple of 10",
    "Combined rating for 45% PTSD and 30% back?",
  ],
  ["a rating above 100", "Combined rating for 50% PTSD and 110% back?"],
  ["a decimal", "Combined rating for 12.5% PTSD and 30% back?"],
  [
    "a number with no percent sign beside listed ratings",
    "Combined rating for 50% PTSD, back 20, knee 10?",
  ],
  [
    "a percentage that is not a rating",
    "50% PTSD, 30% back, will my combined rating mean a 10% raise in pay?",
  ],
  [
    "text run on after the last rating",
    "50% PTSD and 30% back what is my combined rating",
  ],
  ["a single figure with no condition", "Do I qualify for TDIU with 60%?"],
  [
    "several ratings for one named condition",
    "Combined rating with two 10% knee ratings and 30% back?",
  ],
  ["an alternative", "Combined rating for 50% PTSD or 30% back?"],
  ["a denied condition", "Combined rating: denied 50% PTSD, 30% back"],
  [
    "a condition said not to be service connected",
    "Combined rating for 50% PTSD and 30% not service connected back?",
  ],
  [
    "a negation",
    "I don't have 50% PTSD, 30% back, what is my combined rating?",
  ],
  [
    "a rating VA might give",
    "If VA rates my PTSD 70% and my back 20%, what is my combined rating?",
  ],
  [
    "another person's rating beside the veteran's",
    "My wife is 50% PTSD and I'm 30% back, what's our combined rating?",
  ],
  [
    "a stated combined figure beside listed ratings",
    "VA says 60% combined: 50% PTSD, 10% tinnitus. Is the combined rating right?",
  ],
  [
    "ratings run together with no separator",
    "combined rating 50% ptsd 30% back 10% tinnitus",
  ],
  [
    "one evaluation for both sides",
    "Combined rating with 30% bilateral knees and 10% tinnitus?",
  ],
  ["a range", "Combined rating for PTSD between 50% and 70%?"],
];

describe("parseRatingsFromQuestion: questions it will not read ratings from", () => {
  it.each(NOT_READ)("%s: %s", (_name, question) => {
    expect(parseRatingsFromQuestion(question)).toBeNull();
  });

  it.each([null, undefined, "", 42])("returns null for %j", (value) => {
    expect(parseRatingsFromQuestion(value)).toBeNull();
  });
});

describe("describeQuestionRatings", () => {
  it("names each rating read, and says no side or body part was given", () => {
    expect(
      describeQuestionRatings(
        parseRatingsFromQuestion(
          "Combined rating for 50% PTSD, 30% migraines and 10% tinnitus?",
        ),
      ),
    ).toBe(
      "This uses the ratings read from your question: PTSD 50%, migraines 30% and tinnitus 10%. Your question gave no side or body part for them, so no bilateral factor was applied.",
    );
  });

  it("lists bare ratings as figures", () => {
    expect(
      describeQuestionRatings(
        parseRatingsFromQuestion("Combined rating for 50% and 30%?"),
      ),
    ).toBe(
      "This uses the ratings read from your question: 50% and 30%. Your question gave no side or body part for them, so no bilateral factor was applied.",
    );
  });

  it("leaves the bilateral factor to the calculator's notes when a side was given", () => {
    expect(
      describeQuestionRatings(
        parseRatingsFromQuestion(
          "Combined rating: left knee 10%, right knee 10%, back 30%",
        ),
      ),
    ).toBe(
      "This uses the ratings read from your question: left knee 10%, right knee 10% and back 30%. Sides were taken from the words left and right; your question gave no body part, so Vet-Rate read it from the condition's name.",
    );
  });
});

describe("buildNeedsRatingsAnswer", () => {
  it("explains the method, asks for the ratings and points to the calculator", () => {
    const text = buildNeedsRatingsAnswer("What is my combined rating?");
    expect(text.startsWith(NEEDS_RATINGS_LEAD)).toBe(true);
    expect(NEEDS_RATINGS_LEAD).toBe(
      "Vet-Rate works out combined ratings, the bilateral factor and the TDIU percentage thresholds with its calculator, not with the AI, so the figures are computed the same way every time. To answer this it needs your ratings, and it could not read a clear list of them in your question.",
    );
    expect(text).toContain("Open the Rating Calculator");
    expect(text).toContain('"50% PTSD, 30% migraines and 10% tinnitus"');
    expect(text).toContain("My Ratings");
    expect(text).toContain(
      "VA does not add ratings together. It combines them one at a time",
    );
    expect(text).not.toContain("% combined with");
    expect(text).not.toContain("4.16");
  });

  it("quotes the 38 CFR 4.16(a) thresholds for a TDIU question, with no verdict", () => {
    const text = buildNeedsRatingsAnswer("Do I qualify for TDIU?");
    expect(text).toContain(TDIU_REGULATION_QUOTES.thresholds);
    expect(text).toContain(TDIU_REGULATION_QUOTES.unable);
    expect(text).not.toContain("are met");
    expect(text).not.toContain("are not met");
  });
});

describe("answerRatingQuestion", () => {
  const supplied = GOLDEN.a12.conditions;

  it("uses supplied conditions first, whatever the question says", () => {
    const out = answerRatingQuestion(GOLDEN.a11.input, supplied, {
      recognise: true,
    });
    expect(out.calculatorLead).toEqual({ expected: 50 });
    expect(out.ratingsSource).toBe("supplied");
    expect(out.text.startsWith("Your combined rating is 50%.")).toBe(true);
  });

  it("reads the ratings from the question when none are supplied", () => {
    const out = answerRatingQuestion(GOLDEN.a11.input, undefined, {
      recognise: true,
    });
    expect(out.calculatorLead).toEqual({ expected: 80 });
    expect(out.ratingsSource).toBe("question");
    expect(
      out.text.startsWith(
        "This uses the ratings read from your question: PTSD 50%, tinnitus 30%, back 20% and knee 10%. Your question gave no side or body part for them, so no bilateral factor was applied.\n\nYour combined rating is 80%.",
      ),
    ).toBe(true);
    expect(out.text).toContain("Step 3: 72% combined with 10% = 75%");
  });

  it("applies the bilateral factor when the question names left and right", () => {
    const out = answerRatingQuestion(
      "What is my combined rating: left knee 10%, right knee 10%, back 30%",
      undefined,
      { recognise: true },
    );
    expect(out.calculatorLead).toEqual({ expected: 50 });
    expect(out.text).toContain("Group rating: 20.9 rounds to 21%");
  });

  it("asks for the ratings when the question gives none it can read", () => {
    for (const question of [GOLDEN.a14.input, "What is my combined rating?"]) {
      const out = answerRatingQuestion(question, undefined, {
        recognise: true,
      });
      expect(out).toEqual({
        text: buildNeedsRatingsAnswer(question),
        needsRatings: true,
      });
    }
  });

  it("asks for the ratings when the supplied ones cannot be read", () => {
    const out = answerRatingQuestion(
      "What is my combined rating?",
      [{ name: "Sinusitis", rating: "unknown", side: "none" }],
      { recognise: true },
    );
    expect(out.needsRatings).toBe(true);
  });

  it("leaves a question that is not a calculation alone", () => {
    expect(
      answerRatingQuestion(GOLDEN.a21.input, undefined, { recognise: true }),
    ).toBeNull();
  });

  it("only uses supplied conditions when told not to recognise questions", () => {
    expect(
      answerRatingQuestion(GOLDEN.a11.input, undefined, { recognise: false }),
    ).toBeNull();
    expect(
      answerRatingQuestion("Anything", supplied, { recognise: false })
        .calculatorLead,
    ).toEqual({ expected: 50 });
  });
});

/*
 * Every question in the golden set, and every input the recorded runs sent on
 * the rater route, with what happens to it when no ratings are supplied.
 * "model" means it is not recognised as a calculation.
 */
const RATER_TOOLS = new Set([
  "calculator",
  "rating-calculator",
  "tdiu-builder",
  "rating-analyzer",
]);
const outcomeOf = (question) => {
  if (!asksRatingArithmetic(question)) return "model";
  const parsed = read(question);
  return parsed ? parsed.map(([, rating]) => rating).join("/") : "needs";
};

describe("the golden set and the recorded rater inputs", () => {
  const EXPECTED = {
    a11: "50/30/20/10",
    a12: "needs",
    a13: "60/20/20/20",
    a14: "needs",
    a20: "needs",
    a24: "100",
    a25: "60",
  };

  it("every golden question has the pinned outcome", () => {
    const actual = Object.fromEntries(
      Object.values(GOLDEN)
        .map((c) => [c.id, outcomeOf(c.input)])
        .filter(([, outcome]) => outcome !== "model"),
    );
    expect(actual).toEqual(EXPECTED);
  });

  it("what it reads matches the golden set's own structured ratings", () => {
    for (const id of ["a11", "a13", "a24", "a25"]) {
      const structured = GOLDEN[id].conditions
        .map((c) => Number(c.rating))
        .sort((a, b) => b - a);
      const parsed = read(GOLDEN[id].input)
        .map(([, rating]) => rating)
        .sort((a, b) => b - a);
      expect(parsed, id).toEqual(structured);
    }
  });

  it("every rater-route input in the labelled runs is one of those questions", () => {
    const inputs = new Set(
      recordedCases()
        .filter((record) => RATER_TOOLS.has(record.toolId))
        .map((record) => record.input),
    );
    const golden = new Set(Object.values(GOLDEN).map((c) => c.input));
    expect(inputs.size).toBeGreaterThan(0);
    for (const input of inputs) expect(golden.has(input), input).toBe(true);
  });
});
