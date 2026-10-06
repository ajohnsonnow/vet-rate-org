import { describe, it, expect } from "vitest";
import {
  describeSavedRatings,
  ratingQuestionGrounding,
} from "../../utils/savedRatingsGrounding";

const SAVED = [
  {
    id: "rating_1",
    name: "PTSD",
    bodyPart: "mental",
    rating: 50,
    side: "none",
    effectiveDate: "2020-03-01",
  },
  {
    id: "rating_2",
    name: "Left knee",
    bodyPart: "knee",
    rating: 10,
    side: "left",
    effectiveDate: null,
  },
];

describe("ratingQuestionGrounding with saved ratings", () => {
  it.each([
    "What is my combined rating?",
    "How does the bilateral factor change my total rating?",
    "Can you explain VA math for my overall disability rating?",
  ])("grounds a combined-rating question: %s", (question) => {
    expect(ratingQuestionGrounding(question, SAVED)).toEqual({
      toolId: "rating-calculator",
      conditions: [
        { name: "PTSD", rating: 50, side: "none", bodyPart: "mental" },
        { name: "Left knee", rating: 10, side: "left", bodyPart: "knee" },
      ],
    });
  });

  it.each(["Do I qualify for TDIU?", "Am I entitled to unemployability?"])(
    "routes a TDIU question to the TDIU tool: %s",
    (question) => {
      expect(ratingQuestionGrounding(question, SAVED).toolId).toBe(
        "tdiu-builder",
      );
    },
  );

  it("passes only what the calculator needs, never the id or the effective date", () => {
    const { conditions } = ratingQuestionGrounding("combined rating?", SAVED);
    for (const condition of conditions) {
      expect(Object.keys(condition).sort()).toEqual([
        "bodyPart",
        "name",
        "rating",
        "side",
      ]);
    }
  });

  it.each([
    ["a question about something else", "How do I file a supplemental claim?"],
    [
      "a question about raising one rating",
      "How do I increase my PTSD rating?",
    ],
    ["how to apply for TDIU", "How do I apply for TDIU?"],
  ])("does not ground %s", (_name, question) => {
    expect(ratingQuestionGrounding(question, SAVED)).toBeNull();
    expect(ratingQuestionGrounding(question, [])).toBeNull();
  });

  it.each([
    "What is the combined rating for 50% and 30%?",
    "Combined rating for 50 percent and 30 percent?",
    "What would my combined rating be if my PTSD went to 70%?",
  ])(
    "leaves the saved ratings out when the question has its own figures: %s",
    (question) => {
      expect(ratingQuestionGrounding(question, SAVED)).toEqual({
        toolId: "rating-calculator",
      });
    },
  );

  it("still routes a rating question to the calculator when nothing is saved", () => {
    expect(ratingQuestionGrounding("What is my combined rating?", [])).toEqual({
      toolId: "rating-calculator",
    });
    expect(ratingQuestionGrounding("Do I qualify for TDIU?", null)).toEqual({
      toolId: "tdiu-builder",
    });
  });

  it("skips entries with no usable rating", () => {
    const out = ratingQuestionGrounding("What is my combined rating?", [
      ...SAVED,
      { name: "Sinusitis", rating: "n/a", side: "none", bodyPart: "other" },
      { name: "", rating: 30, side: "none", bodyPart: "other" },
    ]);
    expect(out.conditions.map((c) => c.name)).toEqual(["PTSD", "Left knee"]);
  });
});

describe("describeSavedRatings", () => {
  it("names each saved rating so the veteran can see what was used", () => {
    const { conditions } = ratingQuestionGrounding("combined rating?", SAVED);
    expect(describeSavedRatings(conditions)).toBe(
      "This uses the ratings saved in My Ratings: PTSD 50%, Left knee 10% (left).",
    );
  });
});
