import { describe, it, expect } from "vitest";
import {
  calculateVARating,
  checkBilateralFactorCompliance,
} from "../../utils/vaCalculator";
import {
  buildCalculatorExplanation,
  buildComputedResultBlock,
  formatCalculatorWorking,
} from "../../utils/raterGrounding";

const c = (name, rating, side = "none", bodyPart = "other") => ({
  name,
  rating,
  side,
  bodyPart,
});

describe("the bilateral group with its factor never exceeds 100", () => {
  const calc = calculateVARating([
    c("Left knee", 90, "left", "knee"),
    c("Right knee", 50, "right", "knee"),
  ]);

  it("L knee 90 + R knee 50 give 95; 10% would be 9.5, but the group stops at 100", () => {
    expect(calc.combineSteps).toEqual([
      { stage: "bilateral", from: 90, with: 50, result: 95 },
    ]);
    expect(calc.bilateralGroupRating).toBe(100);
    expect(calc.bilateralFactor).toBe(5);
    expect(calc.rawScore).toBe(100);
    expect(calc.combinedRating).toBe(100);
    const group = calc.calculationSteps.find(
      (s) => s.bilateralGroupRating !== undefined,
    );
    expect(group.bilateralGroupRating).toBe(100);
  });

  it("never prints a value above 100%", () => {
    const texts = [
      formatCalculatorWorking(calc).join("\n"),
      buildComputedResultBlock(calc),
      buildCalculatorExplanation(calc),
    ];
    for (const text of texts) {
      expect(text).not.toMatch(/10[1-9]%|1[1-9]\d%/);
      expect(text).not.toContain("105");
    }
    expect(texts[0]).toContain("cannot exceed 100%");
    expect(texts[0]).toContain("group rating is 100%");
  });

  it("the compliance check does not describe a group above 100%", () => {
    const check = checkBilateralFactorCompliance([
      c("Left knee", 90, "left", "knee"),
      c("Right knee", 50, "right", "knee"),
    ]);
    expect(check.potentialBonus).toContain("95%");
    expect(check.potentialBonus).toContain("100%");
    expect(check.potentialBonus).not.toContain("105");
  });

  it("carries the capped group into later steps: knees 90 + 50 with a 30 stay 100", () => {
    const withMore = calculateVARating([
      c("Left knee", 90, "left", "knee"),
      c("Right knee", 50, "right", "knee"),
      c("Back", 30, "none", "back"),
    ]);
    expect(withMore.combineSteps.at(-1)).toEqual({
      stage: "all",
      from: 100,
      with: 30,
      result: 100,
    });
    expect(withMore.combinedRating).toBe(100);
  });
});

describe("38 CFR 4.26(c): compensable means rated 10 percent or more", () => {
  it("a 5% side does not make a pair: 30, 20, 5 give 44, 47, then 50, with no factor", () => {
    const result = calculateVARating([
      c("Left knee", 5, "left", "knee"),
      c("Right knee", 30, "right", "knee"),
      c("Back", 20, "none", "back"),
    ]);
    expect(result.bilateralConditions).toEqual([]);
    expect(result.bilateralFactor).toBe(0);
    expect(result.rawScore).toBe(47);
    expect(result.combinedRating).toBe(50);
  });

  it("a 10% side does: 30 + 10 give 37, plus 3.7 is 41", () => {
    const result = calculateVARating([
      c("Left knee", 10, "left", "knee"),
      c("Right knee", 30, "right", "knee"),
    ]);
    expect(result.bilateralGroupRating).toBe(41);
  });
});

describe("calculateVARating input handling", () => {
  it("reads numeric strings as numbers: '50' and '30' give 65, then 70", () => {
    const result = calculateVARating([
      c("PTSD", "50", "none", "mental"),
      c("Back", " 30% ", "none", "back"),
    ]);
    expect(result.rawScore).toBe(65);
    expect(result.combinedRating).toBe(70);
    expect(result.nonBilateralConditions.map((x) => x.rating)).toEqual([
      50, 30,
    ]);
  });

  it("pairs knees entered as strings: '10' + '10' give 19, plus 1.9 is 21", () => {
    const result = calculateVARating([
      c("Left knee", "10", "left", "knee"),
      c("Right knee", "10", "right", "knee"),
    ]);
    expect(result.bilateralGroupRating).toBe(21);
  });

  it("ignores entries with no usable rating instead of returning NaN or throwing: 50 + 30 give 65", () => {
    const result = calculateVARating([
      c("PTSD", 50, "none", "mental"),
      c("Not a number", Number.NaN),
      c("Negative", -10),
      c("Null rating", null),
      c("Missing rating"),
      c("Words", "severe"),
      c("Infinite", Number.POSITIVE_INFINITY),
      null,
      undefined,
      "50",
      42,
      c("Back", 30, "none", "back"),
    ]);
    expect(result.rawScore).toBe(65);
    expect(result.combinedRating).toBe(70);
    expect(result.nonBilateralConditions.map((x) => x.name)).toEqual([
      "PTSD",
      "Back",
    ]);
  });

  it("caps a rating above 100: 150 counts as 100", () => {
    const result = calculateVARating([
      c("PTSD", 150, "none", "mental"),
      c("Back", 30, "none", "back"),
    ]);
    expect(result.rawScore).toBe(100);
    expect(result.combinedRating).toBe(100);
    expect(result.nonBilateralConditions[0].rating).toBe(100);
  });

  it.each([[null], [undefined], ["50"], [{}], [[null, "x", c("Bad", "n/a")]]])(
    "returns the zero result for %j",
    (input) => {
      const result = calculateVARating(input);
      expect(result.combinedRating).toBe(0);
      expect(result.rawScore).toBe(0);
      expect(result.combineSteps).toEqual([]);
      expect(result.bilateralIssues).toEqual([]);
    },
  );
});
