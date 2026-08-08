/**
 * Johnson 80% ground-truth test — Sprint S10 C-File Audit
 *
 * Condition names, diagnostic codes, and ratings are NOT PII and are safe
 * to commit. All personal identifiers (name, SSN, file#, DOB) remain in
 * E:\Johnson_C-FIle, which is never committed.
 *
 * Combined rating derivation (38 CFR § 4.25, whole-person efficiency):
 *   50→60→68→71→74→77→79→81→83 (each step: Math.round(prev + rating × remaining / 100))
 *   83% → rounds to 80% (nearest 10 per 38 CFR § 4.25)
 */

import { describe, it, expect } from "vitest";
import {
  calculateCombinedRating,
  calculateExactCombinedRating,
  checkBilateralFactor,
} from "../../utils/ratingCalculator";
import {
  combineMultipleRatings,
  VA_PAY_RATES_2026,
} from "../../utils/vaCalculator";

// 9-condition set; sorted descending as VA requires
const JOHNSON_RATINGS = [50, 20, 20, 10, 10, 10, 10, 10, 10];

const JOHNSON_CONDITIONS = [
  { name: "Post-Traumatic Stress Disorder (PTSD)", rating: 50 },
  { name: "Lumbosacral Strain", rating: 20 },
  { name: "Radiculopathy, Lower Extremity, Left", rating: 20 },
  { name: "Radiculopathy, Lower Extremity, Right", rating: 10 },
  { name: "Hip, Limitation of Motion, Left", rating: 10 },
  { name: "Hip, Limitation of Motion, Right", rating: 10 },
  { name: "Knee, Limitation of Flexion, Left", rating: 10 },
  { name: "Pes Planus, Bilateral", rating: 10 },
  { name: "Tinnitus", rating: 10 },
];

describe("Johnson 80% — ratingCalculator.js (38 CFR § 4.25)", () => {
  it("calculateCombinedRating → 80%", () => {
    expect(calculateCombinedRating(JOHNSON_RATINGS)).toBe(80);
  });

  it("calculateExactCombinedRating → ~82.99 (no final rounding)", () => {
    const exact = calculateExactCombinedRating(JOHNSON_RATINGS);
    expect(exact).toBeGreaterThanOrEqual(82);
    expect(exact).toBeLessThan(84);
  });

  it("nearest-10 rounding of exact result → 80%", () => {
    const exact = calculateExactCombinedRating(JOHNSON_RATINGS);
    expect(Math.round(exact / 10) * 10).toBe(80);
  });
});

describe("Johnson 80% — vaCalculator.js (38 CFR § 4.25)", () => {
  it("combineMultipleRatings → 83 (intermediate-rounded integer)", () => {
    expect(combineMultipleRatings(JOHNSON_RATINGS)).toBe(83);
  });

  it("nearest-10 rounding of 83 → 80%", () => {
    expect(Math.round(83 / 10) * 10).toBe(80);
  });

  it("both calculators agree — combined rating = 80%", () => {
    const fromRatingCalc = calculateCombinedRating(JOHNSON_RATINGS);
    const fromVaCalc =
      Math.round(combineMultipleRatings(JOHNSON_RATINGS) / 10) * 10;
    expect(fromRatingCalc).toBe(80);
    expect(fromVaCalc).toBe(80);
  });
});

describe("Johnson bilateral detection — checkBilateralFactor (38 CFR § 4.26)", () => {
  it("detects bilateral hip pair in full Johnson condition set", () => {
    expect(checkBilateralFactor(JOHNSON_CONDITIONS)).toBe(true);
  });

  it("detects L/R radiculopathy pair ('radiculopathy' in bilateral list)", () => {
    const radOnly = [
      { name: "Radiculopathy, Lower Extremity, Left", rating: 20 },
      { name: "Radiculopathy, Lower Extremity, Right", rating: 10 },
    ];
    expect(checkBilateralFactor(radOnly)).toBe(true);
  });

  it("detects abbreviated 'L Hip' / 'R Hip' names", () => {
    const abbreviated = [
      { name: "L Hip", rating: 10 },
      { name: "R Hip", rating: 10 },
    ];
    expect(checkBilateralFactor(abbreviated)).toBe(true);
  });

  it("rejects single-sided hip (no bilateral pair)", () => {
    const singleSide = [
      { name: "Hip, Limitation of Motion, Left", rating: 10 },
      { name: "PTSD", rating: 50 },
    ];
    expect(checkBilateralFactor(singleSide)).toBe(false);
  });

  it("rejects bilateral pair where one side has 0% rating", () => {
    const zeroRated = [
      { name: "Hip, Limitation of Motion, Left", rating: 10 },
      { name: "Hip, Limitation of Motion, Right", rating: 0 },
    ];
    expect(checkBilateralFactor(zeroRated)).toBe(false);
  });
});

describe("2026 VA pay rates — spot-check (38 CFR § 3.460, 2.8% COLA)", () => {
  it("solo[100] = $3938.58", () => {
    expect(VA_PAY_RATES_2026.solo[100]).toBe(3938.58);
  });

  it("solo[50] = $1132.90", () => {
    expect(VA_PAY_RATES_2026.solo[50]).toBe(1132.9);
  });

  it("solo rates are monotonically increasing", () => {
    const steps = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    for (let i = 1; i < steps.length; i++) {
      expect(VA_PAY_RATES_2026.solo[steps[i]]).toBeGreaterThan(
        VA_PAY_RATES_2026.solo[steps[i - 1]],
      );
    }
  });

  it("solo[80] rate is between solo[70] and solo[90]", () => {
    expect(VA_PAY_RATES_2026.solo[80]).toBeGreaterThan(
      VA_PAY_RATES_2026.solo[70],
    );
    expect(VA_PAY_RATES_2026.solo[80]).toBeLessThan(VA_PAY_RATES_2026.solo[90]);
  });
});
