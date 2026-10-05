import { describe, it, expect } from "vitest";
import {
  calculateVARating,
  checkBilateralFactorCompliance,
} from "../../utils/vaCalculator";
import { buildCalculatorExplanation } from "../../utils/raterGrounding";

const c = (name, rating, side, bodyPart) => ({ name, rating, side, bodyPart });

describe("a non-limb body part with a name that names a limb", () => {
  it("is flagged instead of silently read as not a limb: 20, 20, 10 give 36, 42, then 40", () => {
    const result = calculateVARating([
      c("Left leg radiculopathy", 20, "left", "back"),
      c("Right leg radiculopathy", 20, "right"),
      c("Tinnitus", 10, "none", "ear"),
    ]);
    expect(result.bilateralFactor).toBe(0);
    expect(result.rawScore).toBe(42);
    expect(result.combinedRating).toBe(40);
    expect(result.bilateralIssues).toEqual([
      expect.objectContaining({
        reason: "limb-unknown",
        name: "Left leg radiculopathy",
      }),
    ]);
  });

  it("stays not a limb, with nothing to report, when the name agrees: knees 21, with 10 gives 29", () => {
    const result = calculateVARating([
      c("Left knee", 10, "left", "knee"),
      c("Right knee", 10, "right", "knee"),
      c("Left ear hearing loss", 10, "left", "ear"),
    ]);
    expect(result.rawScore).toBe(29);
    expect(result.bilateralIssues).toEqual([]);
  });
});

describe("side is normalised before pairing", () => {
  it("ignores case and spaces: ' Left ' and 'RIGHT' knees at 20 give 36, plus 3.6 is 40", () => {
    const result = calculateVARating([
      c("Knee A", 20, " Left ", "knee"),
      c("Knee B", 20, "RIGHT", "knee"),
    ]);
    expect(result.bilateralGroupRating).toBe(40);
    expect(result.bilateralConditions.map((x) => x.side)).toEqual([
      "left",
      "right",
    ]);
  });

  it("reads 'both' as a both-sides evaluation: 30 + 20 give 44, plus 4.4 is 48", () => {
    const result = calculateVARating([
      c("Left leg muscle damage", 20, "left", "leg"),
      c("Pes planus", 30, "Both", "foot"),
    ]);
    expect(result.rawScore).toBe(48);
  });

  it("treats a missing or empty side as none, with nothing to report: 20 + 20 give 36", () => {
    const result = calculateVARating([
      c("Knee A", 20, "", "knee"),
      c("Knee B", 20, undefined, "knee"),
      c("Knee C", 0, null, "knee"),
    ]);
    expect(result.rawScore).toBe(36);
    expect(result.bilateralIssues).toEqual([]);
  });

  it("flags an unrecognised side on a limb entry instead of dropping it: 20 + 20 give 36", () => {
    const list = [
      c("Knee A", 20, "lft", "knee"),
      c("Knee B", 20, "right", "knee"),
    ];
    const result = calculateVARating(list);
    expect(result.bilateralFactor).toBe(0);
    expect(result.rawScore).toBe(36);
    expect(result.bilateralIssues).toEqual([
      expect.objectContaining({ reason: "side-unknown", name: "Knee A" }),
    ]);
    expect(buildCalculatorExplanation(result)).toContain(
      "did not recognise the side entered for Knee A",
    );
    const check = checkBilateralFactorCompliance(list);
    expect(check.applicable).toBe(false);
    expect(check.message).toContain("Knee A");
  });

  it("does not flag an unrecognised side on an entry that is not a limb: 50 + 20 give 60", () => {
    const result = calculateVARating([
      c("PTSD", 50, "n/a", "mental"),
      c("Knee B", 20, "right", "knee"),
    ]);
    expect(result.rawScore).toBe(60);
    expect(result.bilateralIssues).toEqual([]);
  });
});
