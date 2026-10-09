/**
 * Synthetic 70% ground-truth test - Sprint S10 C-File Audit
 *
 * The condition set below is synthetic: invented names, diagnostic codes
 * and ratings, not drawn from any real person's record.
 *
 * Combined rating derivation (38 CFR § 4.25, whole-person efficiency):
 *   40→52→57→61→65→69→72 (each step: Math.round(prev + rating × remaining / 100))
 *   72% → rounds to 70% (nearest 10 per 38 CFR § 4.25)
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

// Rated conditions of the 9-condition set (two are 0%); sorted descending as VA requires
const SAMPLE_RATINGS = [40, 20, 10, 10, 10, 10, 10];

const SAMPLE_CONDITIONS = [
  { name: "Migraine Headaches", rating: 40 },
  { name: "Cervical Strain", rating: 10 },
  { name: "Neuropathy, Upper Extremity, Left", rating: 10 },
  { name: "Neuropathy, Upper Extremity, Right", rating: 20 },
  { name: "Shoulder, Limitation of Motion, Left", rating: 10 },
  { name: "Shoulder, Limitation of Motion, Right", rating: 10 },
  { name: "Knee, Limitation of Extension, Left", rating: 0 },
  { name: "Hammer Toe, Bilateral", rating: 0 },
  { name: "Irritable Bowel Syndrome", rating: 10 },
];

describe("Synthetic 70% - ratingCalculator.js (38 CFR § 4.25)", () => {
  it("calculateCombinedRating → 70%", () => {
    expect(calculateCombinedRating(SAMPLE_RATINGS)).toBe(70);
  });

  it("calculateExactCombinedRating → ~71.7 (no final rounding)", () => {
    const exact = calculateExactCombinedRating(SAMPLE_RATINGS);
    expect(exact).toBeGreaterThanOrEqual(71);
    expect(exact).toBeLessThan(73);
  });

  it("nearest-10 rounding of exact result → 70%", () => {
    const exact = calculateExactCombinedRating(SAMPLE_RATINGS);
    expect(Math.round(exact / 10) * 10).toBe(70);
  });
});

describe("Synthetic 70% - vaCalculator.js (38 CFR § 4.25)", () => {
  it("combineMultipleRatings → 72 (intermediate-rounded integer)", () => {
    expect(combineMultipleRatings(SAMPLE_RATINGS)).toBe(72);
  });

  it("nearest-10 rounding of 72 → 70%", () => {
    expect(Math.round(72 / 10) * 10).toBe(70);
  });

  it("both calculators agree - combined rating = 70%", () => {
    const fromRatingCalc = calculateCombinedRating(SAMPLE_RATINGS);
    const fromVaCalc =
      Math.round(combineMultipleRatings(SAMPLE_RATINGS) / 10) * 10;
    expect(fromRatingCalc).toBe(70);
    expect(fromVaCalc).toBe(70);
  });
});

describe("Synthetic bilateral detection - checkBilateralFactor (38 CFR § 4.26)", () => {
  it("detects bilateral shoulder pair in full synthetic condition set", () => {
    expect(checkBilateralFactor(SAMPLE_CONDITIONS)).toBe(true);
  });

  it("detects L/R radiculopathy pair ('radiculopathy' in bilateral list)", () => {
    const radOnly = [
      { name: "Radiculopathy, Upper Extremity, Left", rating: 30 },
      { name: "Radiculopathy, Upper Extremity, Right", rating: 30 },
    ];
    expect(checkBilateralFactor(radOnly)).toBe(true);
  });

  it("detects abbreviated 'L Shoulder' / 'R Shoulder' names", () => {
    const abbreviated = [
      { name: "L Shoulder", rating: 10 },
      { name: "R Shoulder", rating: 10 },
    ];
    expect(checkBilateralFactor(abbreviated)).toBe(true);
  });

  it("rejects single-sided shoulder (no bilateral pair)", () => {
    const singleSide = [
      { name: "Shoulder, Limitation of Motion, Left", rating: 10 },
      { name: "Migraine Headaches", rating: 40 },
    ];
    expect(checkBilateralFactor(singleSide)).toBe(false);
  });

  it("rejects bilateral pair where one side has 0% rating", () => {
    const zeroRated = [
      { name: "Shoulder, Limitation of Motion, Left", rating: 10 },
      { name: "Shoulder, Limitation of Motion, Right", rating: 0 },
    ];
    expect(checkBilateralFactor(zeroRated)).toBe(false);
  });
});

describe("2026 VA pay rates - spot-check (38 CFR § 3.460, 2.8% COLA)", () => {
  it("solo[100] = $3938.58", () => {
    expect(Math.round(VA_PAY_RATES_2026.solo[100] * 100)).toBe(393858);
  });

  it("solo[50] = $1132.90", () => {
    expect(Math.round(VA_PAY_RATES_2026.solo[50] * 100)).toBe(113290);
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
