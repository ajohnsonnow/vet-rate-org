import { describe, it, expect } from "vitest";
import {
  calculateVARating,
  calculateBilateralFactor,
  combineMultipleRatings,
  roundToNearest10,
} from "../../utils/vaCalculator";
import { calculateCombinedRating } from "../../utils/ratingCalculator";

// RT7-2 / PARSE-004: vaCalculator is the single source of truth for combined
// ratings. The bilateral 10% factor (38 CFR § 4.26) must apply to the actual
// paired (left/right) set - NOT to the two highest ratings. These tests pin the
// side-aware math and guard parity with the legacy flat engine at the VA-rounded
// level (38 CFR § 4.25).

const FIFTY_PLUS_BILATERAL_30 = [
  { name: "PTSD", rating: 50, side: "none" },
  { name: "Knee, Left", rating: 30, side: "left" },
  { name: "Knee, Right", rating: 30, side: "right" },
];

describe("RT7-2 - bilateral factor applies to the paired set, not the top two", () => {
  it("calculateBilateralFactor([30,30]) → 56 (51 combined, +10% = 56.1 → 56)", () => {
    expect(calculateBilateralFactor([30, 30])).toBe(56);
  });

  it("[50 non-bilateral, 30 left, 30 right] → 80 via VA math", () => {
    // 30 + 30 → 51 ; ×1.1 bilateral factor → 56 ; 56 + 50 → 78 ; round → 80
    const result = calculateVARating(FIFTY_PLUS_BILATERAL_30);
    expect(result.combinedRating).toBe(80);
    expect(result.bilateralGroupRating).toBe(56);
  });

  it("treats the 50 as non-bilateral, the two 30s as the paired set", () => {
    // If the factor were wrongly applied to the top two (50 & 30), the bilateral
    // group would be inflated. Confirm the split is by side, not by magnitude.
    const result = calculateVARating(FIFTY_PLUS_BILATERAL_30);
    expect(result.nonBilateralConditions.map((c) => c.rating)).toEqual([50]);
    expect(result.bilateralConditions.map((c) => c.rating)).toEqual([30, 30]);
  });
});

// MyPacket.jsx's "Combined Rating" summary (Ratings tab) used to combine the
// flat list of saved percentages via combineMultipleRatings, bypassing
// calculateVARating's §4.26 bilateral-factor grouping entirely (each saved
// rating's `side`, set by saveRatingDecisionToProfile from the condition
// name, was simply ignored). This fixture mirrors a veteran with several
// genuinely bilateral (paired left/right) lower-extremity ratings plus a
// couple of unrelated single-sided conditions - category/percentage/side
// only, no real names.
describe("RT-COMBINED-1 - Ratings tab must use the bilateral-aware engine", () => {
  const bilateralHeavyProfile = [
    { name: "mental-health condition", rating: 30, side: "none" },
    { name: "spine condition", rating: 20, side: "none" },
    { name: "sinus condition", rating: 0, side: "none" },
    { name: "nerve condition, left leg", rating: 20, side: "left" },
    { name: "hip condition, left", rating: 10, side: "left" },
    { name: "hip condition, right", rating: 10, side: "right" },
    { name: "hip condition variant, left", rating: 0, side: "left" },
    { name: "hip condition variant 2, left", rating: 0, side: "left" },
    { name: "hip condition variant, right", rating: 0, side: "right" },
    { name: "nerve condition, right leg", rating: 10, side: "right" },
    { name: "respiratory condition", rating: 0, side: "none" },
  ];

  it("the flat legacy combine understates this profile (68 raw -> 70, the observed bug)", () => {
    const flatRaw = combineMultipleRatings(
      bilateralHeavyProfile.map((c) => c.rating).filter((r) => r > 0),
    );
    expect(flatRaw).toBe(68);
    expect(roundToNearest10(flatRaw)).toBe(70);
  });

  it("calculateVARating groups the paired hip/leg ratings under one bilateral factor (70 raw -> 70)", () => {
    const result = calculateVARating(bilateralHeavyProfile);
    // The 0% entries are not of compensable degree, so they stay outside the
    // group (38 CFR § 4.26(c)); the arithmetic is the same either way.
    expect(result.bilateralConditions.map((c) => c.rating).sort()).toEqual(
      [10, 10, 10, 20].sort(),
    );
    expect(result.rawScore).toBe(70);
    expect(result.combinedRating).toBe(70);
  });

  it("with the bilateral group complete (both sides of every paired condition) and the mental-health rating current, combines to the VA-stated 80%", () => {
    // Ground truth from the veteran's own decision letter: this exact set of
    // current ratings (ratings + which ones are genuinely bilateral) is what
    // the letter's own combined-rating table resolves to.
    const completeProfile = [
      ...bilateralHeavyProfile,
      {
        name: "hip condition variant, right (missing from extraction today)",
        rating: 0,
        side: "right",
      },
    ].map((c) =>
      c.name === "mental-health condition" ? { ...c, rating: 50 } : c,
    );
    const result = calculateVARating(completeProfile);
    expect(result.combinedRating).toBe(80);
  });
});

describe("RT7-2 - engine parity at the VA-rounded level (non-bilateral)", () => {
  const cases = [
    [60, 40, 20],
    [70, 50, 30],
    [50, 30],
    [30, 20],
    [10, 10],
    [50, 50],
    [70, 10, 50],
    [70, 30, 10],
  ];

  it("vaCalculator and the legacy flat engine agree after rounding to 10", () => {
    for (const ratings of cases) {
      const va = roundToNearest10(combineMultipleRatings(ratings));
      const legacy = calculateCombinedRating(ratings);
      expect(va, `mismatch on [${ratings}]`).toBe(legacy);
    }
  });
});
