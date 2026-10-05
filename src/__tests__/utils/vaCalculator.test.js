import { describe, it, expect } from "vitest";
import {
  calculatePaymentEffectiveDate,
  calculateBackpayMonths,
  calculateVARating,
  VA_PAY_RATES_2026,
} from "../../utils/vaCalculator";

describe("calculatePaymentEffectiveDate", () => {
  it("moves to first of next month", () => {
    const result = calculatePaymentEffectiveDate("2025-12-03");
    expect(result.getMonth()).toBe(0); // January
    expect(result.getDate()).toBe(1);
    expect(result.getFullYear()).toBe(2026);
  });

  it("handles last day of month", () => {
    const result = calculatePaymentEffectiveDate("2024-06-30");
    expect(result.getMonth()).toBe(6); // July
    expect(result.getDate()).toBe(1);
  });

  it("handles mid-month date", () => {
    const result = calculatePaymentEffectiveDate("2023-03-15");
    expect(result.getMonth()).toBe(3); // April
    expect(result.getDate()).toBe(1);
  });
});

describe("calculateBackpayMonths", () => {
  it("calculates correct months", () => {
    const result = calculateBackpayMonths("2025-01-15", "2025-07-15");
    expect(result.totalMonths).toBe(5); // Feb-Jun = 5 months
  });

  it("returns 0 for future effective date", () => {
    const result = calculateBackpayMonths("2026-12-01", "2026-01-01");
    expect(result.totalMonths).toBe(0);
  });

  it("includes explanation about 38 CFR", () => {
    const result = calculateBackpayMonths("2025-01-01");
    expect(result.explanation).toContain("38 CFR");
  });
});

describe("VA_PAY_RATES_2026", () => {
  it("has solo rates for 0-100", () => {
    expect(VA_PAY_RATES_2026.solo[0]).toBe(0);
    expect(VA_PAY_RATES_2026.solo[100]).toBeGreaterThan(0);
    expect(VA_PAY_RATES_2026.solo[50]).toBeGreaterThan(0);
  });

  it("100% rate is highest", () => {
    const rates = VA_PAY_RATES_2026.solo;
    expect(rates[100]).toBeGreaterThan(rates[90]);
    expect(rates[90]).toBeGreaterThan(rates[80]);
  });
});

describe("calculateVARating combineSteps (the per-step working)", () => {
  const cond = (name, rating, side = "none") => ({
    name,
    rating,
    side,
    bodyPart: name.toLowerCase(),
  });

  it("records each whole-number combining step for 50/30/20/10 and still returns 80", () => {
    const result = calculateVARating([
      cond("A", 10),
      cond("B", 50),
      cond("C", 20),
      cond("D", 30),
    ]);
    expect(result.combineSteps).toEqual([
      { stage: "all", from: 50, with: 30, result: 65 },
      { stage: "all", from: 65, with: 20, result: 72 },
      { stage: "all", from: 72, with: 10, result: 75 },
    ]);
    expect(result.rawScore).toBe(75);
    expect(result.combinedRating).toBe(80);
  });

  it("matches the 38 CFR 4.25 worked example: 60, 40, 20 give 76, then 81, then 80", () => {
    const result = calculateVARating([
      cond("A", 60),
      cond("B", 40),
      cond("C", 20),
    ]);
    expect(result.combineSteps.map((s) => s.result)).toEqual([76, 81]);
    expect(result.combinedRating).toBe(80);
  });

  it("records the bilateral combining separately from the final combining", () => {
    const result = calculateVARating([
      cond("Lumbar strain", 40),
      cond("Left knee", 30, "left"),
      cond("Right knee", 20, "right"),
    ]);
    expect(result.combineSteps).toEqual([
      { stage: "bilateral", from: 30, with: 20, result: 44 },
      { stage: "all", from: 48, with: 40, result: 69 },
    ]);
    expect(result.bilateralGroupRating).toBe(48);
    expect(result.combinedRating).toBe(70);
  });

  it("has no steps for a single rating or no conditions", () => {
    expect(calculateVARating([cond("A", 60)]).combineSteps).toEqual([]);
    expect(calculateVARating([]).combineSteps).toEqual([]);
  });

  it("leaves every pre-existing field unchanged", () => {
    const result = calculateVARating([cond("A", 50), cond("B", 30)]);
    const { combineSteps: _steps, ...rest } = result;
    expect(Object.keys(rest).sort()).toEqual(
      [
        "bilateralConditions",
        "bilateralFactor",
        "bilateralGroupRating",
        "bilateralExcludedConditions",
        "bilateralIssues",
        "bilateralLimbs",
        "calculationSteps",
        "combinedRating",
        "currentEfficiency",
        "gapToNext10",
        "nextTier",
        "nonBilateralConditions",
        "ratingNeededFor100",
        "rawScore",
      ].sort(),
    );
    expect(rest.combinedRating).toBe(70);
    expect(rest.calculationSteps).toHaveLength(3);
  });
});
