import { describe, it, expect } from "vitest";
import { calculateCombinedRating } from "../../utils/ratingCalculator";

describe("ratingCalculator - additional edge cases", () => {
  it("filters out negative ratings", () => {
    expect(calculateCombinedRating([-10, 50])).toBe(50);
  });

  it("filters out ratings above 100", () => {
    expect(calculateCombinedRating([150, 50])).toBe(50);
  });

  it("handles all zeros", () => {
    expect(calculateCombinedRating([0, 0, 0])).toBe(0);
  });

  it("handles single 100% rating", () => {
    expect(calculateCombinedRating([100])).toBe(100);
  });

  it("handles mixed valid and invalid", () => {
    const result = calculateCombinedRating([50, "abc", null, 30]);
    expect(result).toBeGreaterThan(0);
  });

  it("bilateral factor produces higher result", () => {
    const without = calculateCombinedRating([30, 30], false);
    const withBilateral = calculateCombinedRating([30, 30], true);
    expect(withBilateral).toBeGreaterThanOrEqual(without);
  });

  it("VA example: 60+40+20 = 80", () => {
    expect(calculateCombinedRating([60, 40, 20])).toBe(80);
  });
});
