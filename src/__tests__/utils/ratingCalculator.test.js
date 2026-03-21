import { describe, it, expect } from "vitest";
import {
  calculateCombinedRating,
  calculateMonthlyCompensation,
  checkBilateralFactor,
  calculateExactCombinedRating,
} from "../../utils/ratingCalculator";

describe("calculateCombinedRating", () => {
  it("returns 0 for empty array", () => {
    expect(calculateCombinedRating([])).toBe(0);
  });

  it("returns 0 for null input", () => {
    expect(calculateCombinedRating(null)).toBe(0);
  });

  it("returns single rating rounded to nearest 10", () => {
    expect(calculateCombinedRating([50])).toBe(50);
    expect(calculateCombinedRating([55])).toBe(60);
    expect(calculateCombinedRating([44])).toBe(40);
  });

  it("combines two ratings using VA formula", () => {
    // 60% + 40% = 60 + (40 * 40/100) = 60 + 16 = 76 → 80
    expect(calculateCombinedRating([60, 40])).toBe(80);
  });

  it("combines three ratings per 38 CFR § 4.25", () => {
    // 60, 40, 20 → should be 80
    expect(calculateCombinedRating([60, 40, 20])).toBe(80);
  });

  it("order does not matter", () => {
    expect(calculateCombinedRating([40, 60])).toBe(
      calculateCombinedRating([60, 40]),
    );
    expect(calculateCombinedRating([20, 40, 60])).toBe(
      calculateCombinedRating([60, 40, 20]),
    );
  });

  it("filters out invalid ratings", () => {
    expect(calculateCombinedRating([50, -10, "abc"])).toBe(50);
  });

  it("clamps result to 0-100", () => {
    const result = calculateCombinedRating([90, 90, 90]);
    expect(result).toBeLessThanOrEqual(100);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("applies bilateral factor", () => {
    // With bilateral: higher combined due to 10% bonus
    const withBilateral = calculateCombinedRating([30, 30], true);
    const without = calculateCombinedRating([30, 30], false);
    expect(withBilateral).toBeGreaterThanOrEqual(without);
  });
});

describe("checkBilateralFactor", () => {
  it("returns true for matching left/right pair", () => {
    expect(
      checkBilateralFactor([
        { name: "Knee (Left)", rating: 30 },
        { name: "Knee (Right)", rating: 30 },
      ]),
    ).toBe(true);
  });

  it("returns false for single-side condition", () => {
    expect(
      checkBilateralFactor([
        { name: "Knee (Left)", rating: 30 },
        { name: "Back Pain", rating: 20 },
      ]),
    ).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(checkBilateralFactor([])).toBe(false);
  });

  it("returns false if one side has 0 rating", () => {
    expect(
      checkBilateralFactor([
        { name: "Shoulder (Left)", rating: 30 },
        { name: "Shoulder (Right)", rating: 0 },
      ]),
    ).toBe(false);
  });

  it("detects bilateral for various body parts", () => {
    expect(
      checkBilateralFactor([
        { name: "Ankle Left", rating: 10 },
        { name: "Ankle Right", rating: 10 },
      ]),
    ).toBe(true);
  });
});

describe("calculateExactCombinedRating", () => {
  it("returns 0 for empty", () => {
    expect(calculateExactCombinedRating([])).toBe(0);
  });

  it("returns single rating as-is", () => {
    expect(calculateExactCombinedRating([50])).toBe(50);
  });

  it("returns unrounded combined value", () => {
    const exact = calculateExactCombinedRating([60, 40]);
    expect(exact).toBeGreaterThan(70);
    expect(exact).toBeLessThan(80);
  });
});

describe("calculateMonthlyCompensation", () => {
  it("returns 0 for 0% rating", () => {
    expect(calculateMonthlyCompensation(0)).toBe(0);
  });

  it("returns a positive value for 50% rating", () => {
    expect(calculateMonthlyCompensation(50)).toBeGreaterThan(0);
  });

  it("higher rating = higher compensation", () => {
    const comp50 = calculateMonthlyCompensation(50);
    const comp100 = calculateMonthlyCompensation(100);
    expect(comp100).toBeGreaterThan(comp50);
  });

  it("rounds rating to nearest 10", () => {
    const comp = calculateMonthlyCompensation(53);
    const compRound = calculateMonthlyCompensation(50);
    expect(comp).toBe(compRound);
  });
});
