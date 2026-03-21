import { describe, it, expect } from "vitest";
import { calculateCombinedRating } from "../utils/ratingCalculator";

describe("calculateCombinedRating - VA Official Examples", () => {
  // 38 CFR § 4.25 examples

  it("60+40+20 = 80 (VA textbook example)", () => {
    expect(calculateCombinedRating([60, 40, 20])).toBe(80);
  });

  it("single 50% = 50", () => {
    expect(calculateCombinedRating([50])).toBe(50);
  });

  it("two 50% ratings = 80 (not 100)", () => {
    // 50 + (50 * 0.5) = 75, rounds to 80
    expect(calculateCombinedRating([50, 50])).toBe(80);
  });

  it("three 30% ratings", () => {
    // 30 + (30 * 0.7) = 51 + (30 * 0.49) ≈ 51 + 15 = 66 → rounds to 70
    const result = calculateCombinedRating([30, 30, 30]);
    expect(result).toBeGreaterThanOrEqual(60);
    expect(result).toBeLessThanOrEqual(70);
  });

  it("100% always stays 100%", () => {
    expect(calculateCombinedRating([100])).toBe(100);
    expect(calculateCombinedRating([100, 50])).toBe(100);
  });

  it("all 10% ratings", () => {
    const result = calculateCombinedRating([10, 10, 10]);
    expect(result).toBeGreaterThanOrEqual(20);
    expect(result).toBeLessThanOrEqual(30);
  });
});

describe("calculateCombinedRating - Edge Cases", () => {
  it("empty array = 0", () => {
    expect(calculateCombinedRating([])).toBe(0);
  });

  it("null = 0", () => {
    expect(calculateCombinedRating(null)).toBe(0);
  });

  it("undefined = 0", () => {
    expect(calculateCombinedRating(undefined)).toBe(0);
  });

  it("filters invalid ratings", () => {
    expect(calculateCombinedRating([-10, 50, 200])).toBe(50);
  });

  it("single 0% = 0", () => {
    expect(calculateCombinedRating([0])).toBe(0);
  });

  it("rounds to nearest 10", () => {
    // Result should always be a multiple of 10
    const result = calculateCombinedRating([45, 35, 25]);
    expect(result % 10).toBe(0);
  });
});

describe("calculateCombinedRating - Bilateral Factor", () => {
  it("bilateral adds 10% boost to paired ratings", () => {
    const withBilateral = calculateCombinedRating([30, 30], true);
    const without = calculateCombinedRating([30, 30], false);
    expect(withBilateral).toBeGreaterThanOrEqual(without);
  });

  it("bilateral factor with 30+30 = 60", () => {
    // (30 + (30*0.7)) * 1.1 = 51 * 1.1 = 56.1 → rounds to 60
    expect(calculateCombinedRating([30, 30], true)).toBe(60);
  });
});
