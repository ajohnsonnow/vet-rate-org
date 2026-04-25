/**
 * ratingCalculator — VA Combined Rating math (38 CFR § 4.25 / § 4.26).
 *
 * NOTE: Two calculator modules exist by design (see audit plan):
 *   - utils/vaCalculator.js  → drives the Tactical Calculator UI
 *   - utils/ratingCalculator.js → drives Million Dollar Dashboard et al.
 *
 * Both must agree for any input that does not exercise their differing
 * bilateral-factor models. Cross-agreement is locked by
 * `ratingCalculator.crosscheck.test.js`. This file locks the
 * ratingCalculator side independently, with extra coverage merged from the
 * legacy `src/test/ratingCalculator.test.js` duplicate.
 */
import { describe, it, expect } from "vitest";
import {
  calculateCombinedRating,
  calculateMonthlyCompensation,
  checkBilateralFactor,
  calculateExactCombinedRating,
} from "../../utils/ratingCalculator";

describe("calculateCombinedRating — basic functionality", () => {
  it("returns 0 for empty array", () => {
    expect(calculateCombinedRating([])).toBe(0);
  });

  it("returns 0 for null input", () => {
    expect(calculateCombinedRating(null)).toBe(0);
  });

  it("returns single rating rounded to nearest 10", () => {
    expect(calculateCombinedRating([50])).toBe(50);
    expect(calculateCombinedRating([35])).toBe(40);
    expect(calculateCombinedRating([34])).toBe(30);
    expect(calculateCombinedRating([55])).toBe(60);
    expect(calculateCombinedRating([44])).toBe(40);
  });

  it("filters out invalid ratings", () => {
    expect(calculateCombinedRating([50, -10, 110])).toBe(50);
    expect(calculateCombinedRating([30, null, undefined])).toBe(30);
    expect(calculateCombinedRating([50, "abc", 30, null])).toBe(70);
  });

  it("clamps result to 0..100", () => {
    const r = calculateCombinedRating([90, 90, 90]);
    expect(r).toBeLessThanOrEqual(100);
    expect(r).toBeGreaterThanOrEqual(0);
  });
});

describe("calculateCombinedRating — VA official examples (38 CFR § 4.25)", () => {
  it("60 + 40 = 80", () => {
    expect(calculateCombinedRating([60, 40])).toBe(80);
  });

  it("60 + 40 + 20 = 80", () => {
    expect(calculateCombinedRating([60, 40, 20])).toBe(80);
  });

  it("50 + 30 = 70 (rounds up from 65)", () => {
    expect(calculateCombinedRating([50, 30])).toBe(70);
  });

  it("30 + 20 = 40 (rounds down from 44)", () => {
    expect(calculateCombinedRating([30, 20])).toBe(40);
  });

  it("10 + 10 = 20 (rounds up from 19)", () => {
    expect(calculateCombinedRating([10, 10])).toBe(20);
  });

  it("70 + 50 + 30 = 90 (rounds up from 89.5)", () => {
    expect(calculateCombinedRating([70, 50, 30])).toBe(90);
  });
});

describe("calculateCombinedRating — order independence", () => {
  it("two-rating commutative", () => {
    expect(calculateCombinedRating([40, 60])).toBe(
      calculateCombinedRating([60, 40]),
    );
  });

  it("three-rating commutative", () => {
    const permutations = [
      [70, 50, 30],
      [70, 30, 50],
      [50, 70, 30],
      [50, 30, 70],
      [30, 70, 50],
      [30, 50, 70],
    ];
    const results = permutations.map((p) => calculateCombinedRating(p));
    expect(new Set(results).size).toBe(1);
    expect(results[0]).toBe(90);
  });

  it("legacy out-of-order shape", () => {
    expect(calculateCombinedRating([20, 60, 40])).toBe(80);
    expect(calculateCombinedRating([40, 20, 60])).toBe(80);
  });
});

describe("calculateCombinedRating — bilateral factor (38 CFR § 4.26)", () => {
  it("two equal ratings: 30 + 30 (bilateral) = 60", () => {
    expect(calculateCombinedRating([30, 30], true)).toBe(60);
  });

  it("unequal ratings: 40 + 20 (bilateral) = 60", () => {
    expect(calculateCombinedRating([40, 20], true)).toBe(60);
  });

  it("bilateral factor compounds with other ratings", () => {
    expect(calculateCombinedRating([30, 30, 20], true)).toBe(70);
  });

  it("bilateral never produces less than non-bilateral", () => {
    const w = calculateCombinedRating([30, 30], true);
    const wo = calculateCombinedRating([30, 30], false);
    expect(w).toBeGreaterThanOrEqual(wo);
  });
});

describe("calculateMonthlyCompensation", () => {
  it("returns 0 for 0%", () => {
    expect(calculateMonthlyCompensation(0)).toBe(0);
  });

  it("returns positive compensation for valid ratings", () => {
    expect(calculateMonthlyCompensation(10)).toBeGreaterThan(100);
    expect(calculateMonthlyCompensation(30)).toBeGreaterThan(400);
    expect(calculateMonthlyCompensation(50)).toBeGreaterThan(900);
    expect(calculateMonthlyCompensation(70)).toBeGreaterThan(1500);
    expect(calculateMonthlyCompensation(100)).toBeGreaterThan(3500);
  });

  it("higher rating → higher compensation", () => {
    expect(calculateMonthlyCompensation(100)).toBeGreaterThan(
      calculateMonthlyCompensation(50),
    );
  });

  it("rounds rating to nearest 10 before lookup", () => {
    expect(calculateMonthlyCompensation(35)).toBe(
      calculateMonthlyCompensation(40),
    );
    expect(calculateMonthlyCompensation(65)).toBe(
      calculateMonthlyCompensation(70),
    );
    expect(calculateMonthlyCompensation(53)).toBe(
      calculateMonthlyCompensation(50),
    );
  });

  it("spouse compensation only kicks in at 30%+", () => {
    expect(
      calculateMonthlyCompensation(30, { hasSpouse: true }),
    ).toBeGreaterThan(calculateMonthlyCompensation(30));
  });

  it("children add to compensation", () => {
    expect(calculateMonthlyCompensation(50, { children: 2 })).toBeGreaterThan(
      calculateMonthlyCompensation(50),
    );
  });
});

describe("checkBilateralFactor", () => {
  it("detects bilateral knees", () => {
    expect(
      checkBilateralFactor([
        { name: "Knee (Left)", rating: 30 },
        { name: "Knee (Right)", rating: 30 },
      ]),
    ).toBe(true);
  });

  it("detects bilateral shoulders (different ratings ok)", () => {
    expect(
      checkBilateralFactor([
        { name: "Shoulder (Left)", rating: 20 },
        { name: "Shoulder (Right)", rating: 10 },
      ]),
    ).toBe(true);
  });

  it("returns false for single-side condition", () => {
    expect(checkBilateralFactor([{ name: "Knee (Left)", rating: 30 }])).toBe(
      false,
    );
  });

  it("returns false for empty array", () => {
    expect(checkBilateralFactor([])).toBe(false);
  });

  it("returns false if one side has 0 rating", () => {
    expect(
      checkBilateralFactor([
        { name: "Knee (Left)", rating: 30 },
        { name: "Knee (Right)", rating: 0 },
      ]),
    ).toBe(false);
  });

  it("returns false for different body parts", () => {
    expect(
      checkBilateralFactor([
        { name: "Knee (Left)", rating: 30 },
        { name: "Shoulder (Right)", rating: 30 },
      ]),
    ).toBe(false);
  });

  it("matches case-insensitively", () => {
    expect(
      checkBilateralFactor([
        { name: "KNEE (LEFT)", rating: 30 },
        { name: "knee (right)", rating: 30 },
      ]),
    ).toBe(true);
  });

  it("matches alternate naming pattern (without parens)", () => {
    expect(
      checkBilateralFactor([
        { name: "Ankle Left", rating: 10 },
        { name: "Ankle Right", rating: 10 },
      ]),
    ).toBe(true);
  });
});

describe("calculateExactCombinedRating — debugging helper", () => {
  it("returns 0 for empty", () => {
    expect(calculateExactCombinedRating([])).toBe(0);
  });

  it("returns single rating as-is (no rounding)", () => {
    expect(calculateExactCombinedRating([50])).toBe(50);
  });

  it("returns exact decimal value (50 + 30 = 65)", () => {
    expect(calculateExactCombinedRating([50, 30])).toBe(65);
  });

  it("returns exact value for compound calculation (60 + 40 + 20 = 80.8)", () => {
    expect(calculateExactCombinedRating([60, 40, 20])).toBe(80.8);
  });

  it("returns unrounded combined value between tier boundaries", () => {
    const exact = calculateExactCombinedRating([60, 40]);
    expect(exact).toBeGreaterThan(70);
    expect(exact).toBeLessThan(80);
  });
});

describe("Real-world veteran scenarios", () => {
  it("PTSD 70 + Tinnitus 10 + Sleep Apnea 50 = 90", () => {
    expect(calculateCombinedRating([70, 10, 50])).toBe(90);
  });

  it("bilateral knees + back ≥ 70", () => {
    expect(calculateCombinedRating([30, 30, 40], true)).toBeGreaterThanOrEqual(
      70,
    );
  });

  it("TDIU eligibility threshold", () => {
    expect(calculateCombinedRating([60, 40, 20])).toBeGreaterThanOrEqual(70);
  });

  it("multiple mental-health conditions: PTSD 70 + Depression 30 + Anxiety 10 = 80", () => {
    expect(calculateCombinedRating([70, 30, 10])).toBe(80);
  });
});

describe("VA formula accuracy proofs", () => {
  it("matches the published Combined Ratings Table", () => {
    const cases = [
      { ratings: [50, 50], expected: 80 },
      { ratings: [40, 40], expected: 60 },
      { ratings: [30, 30], expected: 50 },
      { ratings: [70, 30], expected: 80 },
      { ratings: [60, 20], expected: 70 },
    ];
    cases.forEach(({ ratings, expected }) => {
      expect(calculateCombinedRating(ratings)).toBe(expected);
    });
  });

  it("bilateral factor adds 10% per § 4.26 (30+30 → 60)", () => {
    expect(calculateCombinedRating([30, 30], true)).toBe(60);
  });

  it("never exceeds 100% even at saturation", () => {
    expect(calculateCombinedRating([90, 90, 90])).toBeLessThanOrEqual(100);
  });

  it("handles many small ratings without overflow", () => {
    expect(calculateCombinedRating(new Array(10).fill(10))).toBeLessThanOrEqual(
      100,
    );
  });
});
