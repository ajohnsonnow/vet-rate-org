/**
 * TDIU (38 CFR § 4.16(a)) and SMC-S (38 U.S.C. § 1114(s)) detection tests.
 * Synthetic ground-truth set: 9 conditions, combined 70%, highest single 40%
 * - schedular TDIU eligible via the 70/40 prong.
 */

import { describe, it, expect } from "vitest";
import {
  checkTDIUEligibility,
  evaluateTdiuThresholds,
  checkSMCSHousebound,
} from "../../utils/smcDetector";

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

describe("evaluateTdiuThresholds - 38 CFR § 4.16(a)", () => {
  it.each([
    [60, 60, true, "single60"],
    [60, 100, true, "single60"],
    [59, 70, true, "combined70"],
    [59, 60, false, null],
    [40, 70, true, "combined70"],
    [50, 80, true, "combined70"],
    [40, 60, false, null],
    [30, 90, false, null],
    [0, 0, false, null],
  ])("highest %i, combined %i", (highest, combined, eligible, basis) => {
    expect(evaluateTdiuThresholds(highest, combined)).toEqual({
      eligible,
      basis,
    });
  });

  it("checkTDIUEligibility reports the same verdict as the shared thresholds", () => {
    const out = checkTDIUEligibility([
      { rating: 50 },
      { rating: 30 },
      { rating: 20 },
    ]);
    expect(out).toMatchObject(
      evaluateTdiuThresholds(out.highest, out.combined),
    );
  });
});

describe("checkTDIUEligibility - 38 CFR § 4.16(a)", () => {
  it("Synthetic 9-condition set → eligible via 70/40 prong (combined 70, highest 40)", () => {
    const result = checkTDIUEligibility(SAMPLE_CONDITIONS);
    expect(result.eligible).toBe(true);
    expect(result.basis).toBe("combined70");
    expect(result.combined).toBe(70);
    expect(result.highest).toBe(40);
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
    expect(result.basis).toBeNull();
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

describe("checkSMCSHousebound - 38 U.S.C. § 1114(s)", () => {
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
