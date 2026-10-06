import { describe, it, expect } from "vitest";
import {
  describeSavedRatings,
  savedRatingsGrounding,
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

describe("savedRatingsGrounding", () => {
  it.each([
    "What is my combined rating?",
    "How does the bilateral factor change my total rating?",
    "Can you explain VA math for my overall disability rating?",
  ])("grounds a combined-rating question: %s", (question) => {
    expect(savedRatingsGrounding(question, SAVED)).toEqual({
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
      expect(savedRatingsGrounding(question, SAVED).toolId).toBe(
        "tdiu-builder",
      );
    },
  );

  it("passes only what the calculator needs, never the id or the effective date", () => {
    const { conditions } = savedRatingsGrounding("combined rating?", SAVED);
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
    [
      "a question that brings its own figures",
      "What is the combined rating for 50% and 30%?",
    ],
    [
      "its own figures in words",
      "Combined rating for 50 percent and 30 percent?",
    ],
  ])("does not ground %s", (_name, question) => {
    expect(savedRatingsGrounding(question, SAVED)).toBeNull();
  });

  it("does not ground anything when no rating is saved", () => {
    expect(savedRatingsGrounding("What is my combined rating?", [])).toBeNull();
  });

  it("skips entries with no usable rating", () => {
    const out = savedRatingsGrounding("What is my combined rating?", [
      ...SAVED,
      { name: "Sinusitis", rating: "n/a", side: "none", bodyPart: "other" },
      { name: "", rating: 30, side: "none", bodyPart: "other" },
    ]);
    expect(out.conditions.map((c) => c.name)).toEqual(["PTSD", "Left knee"]);
  });
});

describe("describeSavedRatings", () => {
  it("names each saved rating so the veteran can see what was used", () => {
    const { conditions } = savedRatingsGrounding("combined rating?", SAVED);
    expect(describeSavedRatings(conditions)).toBe(
      "This uses the ratings saved in My Ratings: PTSD 50%, Left knee 10% (left).",
    );
  });
});
