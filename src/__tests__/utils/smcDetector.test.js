/**
 * TDIU (38 CFR § 4.16(a)) and SMC-S (38 U.S.C. § 1114(s)) detection tests.
 * Williams ground-truth set: 9 conditions, combined 80%, highest single 50%
 * — schedular TDIU eligible via the 70/40 prong.
 */

import { describe, it, expect } from "vitest";
import {
  checkTDIUEligibility,
  checkSMCSHousebound,
} from "../../utils/smcDetector";

const WILLIAMS_CONDITIONS = [
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

describe("checkTDIUEligibility — 38 CFR § 4.16(a)", () => {
  it("Williams 9-condition set → eligible via 70/40 prong (combined 80, highest 50)", () => {
    const result = checkTDIUEligibility(WILLIAMS_CONDITIONS);
    expect(result.eligible).toBe(true);
    expect(result.basis).toBe("combined70");
    expect(result.combined).toBe(80);
    expect(result.highest).toBe(50);
  });

  it("single 60% alone → eligible via single-60 prong", () => {
    const result = checkTDIUEligibility([{ name: "Back", rating: 60 }]);
    expect(result.eligible).toBe(true);
    expect(result.basis).toBe("single60");
    expect(result.highest).toBe(60);
  });

  it("combined 60% with highest 30% → not eligible", () => {
    const result = checkTDIUEligibility([
      { rating: 30 },
      { rating: 30 },
      { rating: 20 },
    ]);
    expect(result.combined).toBe(60);
    expect(result.highest).toBe(30);
    expect(result.eligible).toBe(false);
    expect(result.basis).toBe(null);
  });

  it("accepts a plain ratings array", () => {
    expect(checkTDIUEligibility([70, 40]).eligible).toBe(true);
  });

  it("empty array → not eligible, zeroed", () => {
    expect(checkTDIUEligibility([])).toEqual({
      eligible: false,
      basis: null,
      combined: 0,
      highest: 0,
    });
  });

  it("tolerates null/invalid input", () => {
    expect(checkTDIUEligibility(null).eligible).toBe(false);
    expect(checkTDIUEligibility(undefined).eligible).toBe(false);
    expect(
      checkTDIUEligibility([{ rating: 200 }, null, "junk", { rating: "50" }])
        .eligible,
    ).toBe(false);
  });
});

describe("checkSMCSHousebound — 38 U.S.C. § 1114(s)", () => {
  it("100% plus separate 60% → potentially eligible", () => {
    const result = checkSMCSHousebound([{ rating: 100 }, { rating: 60 }]);
    expect(result.potentiallyEligible).toBe(true);
  });

  it("100% single only → not eligible", () => {
    const result = checkSMCSHousebound([{ rating: 100 }]);
    expect(result.potentiallyEligible).toBe(false);
  });

  it("100% plus separate ratings combining below 60% → not eligible", () => {
    const result = checkSMCSHousebound([
      { rating: 100 },
      { rating: 30 },
      { rating: 10 },
    ]);
    expect(result.potentiallyEligible).toBe(false);
  });

  it("no 100% rating → not eligible even at combined 100", () => {
    const result = checkSMCSHousebound([{ rating: 90 }, { rating: 90 }]);
    expect(result.potentiallyEligible).toBe(false);
  });

  it("tolerates empty/invalid input", () => {
    expect(checkSMCSHousebound([]).potentiallyEligible).toBe(false);
    expect(checkSMCSHousebound(null).potentiallyEligible).toBe(false);
  });
});
