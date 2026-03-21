import { describe, it, expect } from "vitest";
import { calculateMigraineRating } from "../../utils/capSimulatorLogic";

describe("calculateMigraineRating", () => {
  it("returns 0 for non-prostrating attacks", () => {
    const result = calculateMigraineRating({
      q1: "no",
      q2: "monthly",
      q3: "no",
      q4: "hours",
    });
    expect(result.predictedRating).toBe(0);
    expect(result.gaps.length).toBeGreaterThan(0);
  });

  it("returns 50 for very frequent, completely prostrating, prolonged, economically severe", () => {
    const result = calculateMigraineRating({
      q1: "yes_always",
      q2: "very_frequent",
      q3: "yes_severe",
      q4: "days",
    });
    expect(result.predictedRating).toBe(50);
  });

  it("returns 30 for monthly prostrating attacks", () => {
    const result = calculateMigraineRating({
      q1: "yes_always",
      q2: "monthly",
      q3: "no",
      q4: "hours",
    });
    expect(result.predictedRating).toBe(30);
  });

  it("includes action items in result", () => {
    const result = calculateMigraineRating({
      q1: "yes_always",
      q2: "monthly",
      q3: "no",
      q4: "hours",
    });
    expect(result.actionItems.length).toBeGreaterThan(0);
  });

  it("returns result object with expected shape", () => {
    const result = calculateMigraineRating({ q1: "no" });
    expect(result).toHaveProperty("predictedRating");
    expect(result).toHaveProperty("ratingRationale");
    expect(result).toHaveProperty("gaps");
    expect(result).toHaveProperty("actionItems");
    expect(result).toHaveProperty("warnings");
  });
});
