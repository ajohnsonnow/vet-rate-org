import { describe, it, expect } from "vitest";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const { parseRatingDecision } = await import("./musterCallProcessor");

// The "Your Benefit Information" notification format carries every
// condition and rating but matches neither the header-first parser's
// DECISION/EVIDENCE/REASONS sections nor the legacy "CONDITION - NN%" shape.
describe("musterCallProcessor: parseRatingDecision on the notification-letter format", () => {
  it("fills conditions from per-issue decisions and reads the combined-rating table", async () => {
    const text =
      "Your Benefit Information: " +
      "l Service connection for tinnitus is granted with an evaluation of 10 percent effective November 1, 2025. " +
      "l Evaluation of knee strain, which is currently 10 percent disabling, is increased to 20 percent effective November 1, 2025. " +
      "l Service connection for sleep apnea is denied. " +
      "Your combined rating evaluation is: Combined Rating Evaluation Effective Date 20% Feb 3, 2010 30% Nov 1, 2025";
    const result = await parseRatingDecision(text);

    expect(result.type).toBe("rating_decision");
    expect(result.conditions.map((c) => [c.name, c.rating])).toEqual([
      ["tinnitus", 10],
      ["knee strain", 20],
    ]);
    expect(result.conditions[1].priorRating).toBe(10);
    expect(result.deniedConditions).toEqual(["sleep apnea"]);
    expect(result.combinedRating).toBe(30);
    expect(result.combinedRatingHistory).toHaveLength(2);
    expect(result.decisions).toHaveLength(3);
    // No "DECISION DATE:" label and no letterhead date in this format -
    // falls back to the newest effective date the letter states (the
    // per-issue decisions are checked before the combined-rating history,
    // so the full-month form wins the tie over the table's abbreviated one).
    expect(result.decisionDate).toBe("November 1, 2025");
  });
});
