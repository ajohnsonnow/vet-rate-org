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
// paired (left/right) set — NOT to the two highest ratings. These tests pin the
// side-aware math and guard parity with the legacy flat engine at the VA-rounded
// level (38 CFR § 4.25).

const FIFTY_PLUS_BILATERAL_30 = [
  { name: "PTSD", rating: 50, side: "none" },
  { name: "Knee, Left", rating: 30, side: "left" },
  { name: "Knee, Right", rating: 30, side: "right" },
];

describe("RT7-2 — bilateral factor applies to the paired set, not the top two", () => {
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

describe("RT7-2 — engine parity at the VA-rounded level (non-bilateral)", () => {
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
