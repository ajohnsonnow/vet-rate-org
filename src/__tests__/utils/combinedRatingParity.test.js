import { describe, it, expect } from "vitest";
import {
  calculateVARating,
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
// name, was simply ignored). This invented profile has paired left/right
// upper- and lower-extremity ratings plus a few unrelated single-sided
// conditions.
describe("RT-COMBINED-1 - Ratings tab must use the bilateral-aware engine", () => {
  const bilateralHeavyProfile = [
    { name: "cardiovascular condition", rating: 40, side: "none" },
    { name: "skin condition", rating: 10, side: "none" },
    { name: "digestive condition", rating: 0, side: "none" },
    { name: "shoulder condition, left", rating: 30, side: "left" },
    { name: "shoulder condition, right", rating: 20, side: "right" },
    { name: "elbow condition, left", rating: 10, side: "left" },
    { name: "knee condition, left", rating: 20, side: "left" },
    { name: "knee condition, right", rating: 10, side: "right" },
    { name: "ankle condition, right", rating: 0, side: "right" },
  ];

  it("the flat legacy combine understates this profile (80 raw vs 84 bilateral-aware)", () => {
    const flatRaw = combineMultipleRatings(
      bilateralHeavyProfile.map((c) => c.rating).filter((r) => r > 0),
    );
    expect(flatRaw).toBe(80);
    expect(roundToNearest10(flatRaw)).toBe(80);
  });

  it("calculateVARating groups the paired arm/leg ratings under one bilateral factor (84 raw -> 80)", () => {
    // Paired set 30,20,20,10,10 (the 0% ankle stays out, §4.26(c)): 30+20=44 ; 44+20=55 ;
    // 55+10=60 ; 60+10=64 ; +10% factor (6.4) = 70.4 -> 70. Then 70,40,10: 70+40=82 ;
    // 82+10=84 -> rounds to 80.
    const result = calculateVARating(bilateralHeavyProfile);
    // The 0% entries are not of compensable degree, so they stay outside the
    // group (38 CFR § 4.26(c)); the arithmetic is the same either way.
    expect(result.bilateralConditions.map((c) => c.rating).sort()).toEqual(
      [10, 10, 20, 20, 30].sort(),
    );
    expect(result.bilateralGroupRating).toBe(70);
    expect(result.rawScore).toBe(84);
    expect(result.combinedRating).toBe(80);
  });

  it("with the bilateral group complete (both sides of every paired condition) and the cardiovascular rating raised, combines to 90%", () => {
    // Paired set 30,20,20,10,10,10: 44 ; 55 ; 60 ; 64 ; 64+10=68 ;
    // +10% factor (6.8) = 74.8 -> 75. Then 75,60,10: 75+60=90 ; 90+10=91 ->
    // rounds to 90.
    const completeProfile = [
      ...bilateralHeavyProfile,
      {
        name: "elbow condition, right",
        rating: 10,
        side: "right",
      },
    ].map((c) =>
      c.name === "cardiovascular condition" ? { ...c, rating: 60 } : c,
    );
    const result = calculateVARating(completeProfile);
    expect(result.bilateralGroupRating).toBe(75);
    expect(result.combinedRating).toBe(90);
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
