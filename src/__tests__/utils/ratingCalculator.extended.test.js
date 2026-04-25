/**
 * Extra § 4.25 / § 4.26 corner cases beyond what
 * `ratingCalculator.test.js` covers — kept separate so the main file stays
 * tightly focused on the published VA examples.
 */
import { describe, it, expect } from "vitest";
import { calculateCombinedRating } from "../../utils/ratingCalculator";

describe("calculateCombinedRating — VA textbook examples", () => {
  it("60 + 40 + 20 = 80", () => {
    expect(calculateCombinedRating([60, 40, 20])).toBe(80);
  });

  it("single 50% = 50", () => {
    expect(calculateCombinedRating([50])).toBe(50);
  });

  it("two 50% ratings = 80 (NOT 100)", () => {
    expect(calculateCombinedRating([50, 50])).toBe(80);
  });

  it("three 30% ratings rounds to 60-70 band", () => {
    const result = calculateCombinedRating([30, 30, 30]);
    expect(result).toBeGreaterThanOrEqual(60);
    expect(result).toBeLessThanOrEqual(70);
  });

  it("100% always stays 100% even with extras", () => {
    expect(calculateCombinedRating([100])).toBe(100);
    expect(calculateCombinedRating([100, 50])).toBe(100);
  });

  it("three 10% ratings round to 20-30 band", () => {
    const result = calculateCombinedRating([10, 10, 10]);
    expect(result).toBeGreaterThanOrEqual(20);
    expect(result).toBeLessThanOrEqual(30);
  });
});

describe("calculateCombinedRating — defensive defaults", () => {
  it("[] = 0", () => {
    expect(calculateCombinedRating([])).toBe(0);
  });

  it("null = 0", () => {
    expect(calculateCombinedRating(null)).toBe(0);
  });

  it("undefined = 0", () => {
    expect(calculateCombinedRating(undefined)).toBe(0);
  });

  it("strips out-of-range values", () => {
    expect(calculateCombinedRating([-10, 50, 200])).toBe(50);
  });

  it("[0] = 0", () => {
    expect(calculateCombinedRating([0])).toBe(0);
  });

  it("result is always a multiple of 10", () => {
    expect(calculateCombinedRating([45, 35, 25]) % 10).toBe(0);
  });
});

describe("calculateCombinedRating — bilateral factor", () => {
  it("bilateral never reduces the result vs non-bilateral", () => {
    const w = calculateCombinedRating([30, 30], true);
    const wo = calculateCombinedRating([30, 30], false);
    expect(w).toBeGreaterThanOrEqual(wo);
  });

  it("30 + 30 (bilateral) = 60", () => {
    expect(calculateCombinedRating([30, 30], true)).toBe(60);
  });
});
