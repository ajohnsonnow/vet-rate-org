import { describe, it, expect } from "vitest";
import { calculateCompensation } from "../../utils/vaCalculator";

// Characterization + correctness coverage for calculateCompensation, added
// while splitting it into _applySpouseAdditions / _applyChildAdditions /
// _applyParentAdditions to satisfy sonarjs/cognitive-complexity. Expected
// values are hand-derived from the 2026 rate table (38 CFR § 3.460), not
// copied from the implementation's output.
describe("calculateCompensation - base rate and single dependent categories", () => {
  it("below 30% pays only the solo base rate, dependents ignored", () => {
    const result = calculateCompensation(20, {
      married: true,
      childrenUnder18: 2,
    });
    expect(result.qualifiesForDependents).toBe(false);
    expect(result.monthlyTotal).toBeCloseTo(356.66, 5);
    expect(result.breakdown.spouseAddition).toBe(0);
    expect(result.breakdown.childrenUnder18Addition).toBe(0);
  });

  it("adds the spouse rate at 30%+", () => {
    const result = calculateCompensation(30, { married: true });
    expect(result.monthlyTotal).toBeCloseTo(617.47, 5);
    expect(result.breakdown.spouseAddition).toBe(65);
  });

  it("adds spouse Aid & Attendance on top of the spouse rate", () => {
    const result = calculateCompensation(30, {
      married: true,
      spouseAidAttendance: true,
    });
    expect(result.monthlyTotal).toBeCloseTo(678.47, 5);
    expect(result.breakdown.spouseAidAttendanceAddition).toBe(61);
  });

  it("adds the one-parent rate", () => {
    const result = calculateCompensation(30, { dependentParents: 1 });
    expect(result.monthlyTotal).toBeCloseTo(604.47, 5);
    expect(result.breakdown.parentsAddition).toBe(52);
  });

  it("adds the two-parent rate", () => {
    const result = calculateCompensation(30, { dependentParents: 2 });
    expect(result.monthlyTotal).toBeCloseTo(656.47, 5);
    expect(result.breakdown.parentsAddition).toBe(104);
  });
});

describe("calculateCompensation - child dependent edge cases and combined totals", () => {
  it("one child under 18 gets only the first-child rate, not the per-child rate", () => {
    const result = calculateCompensation(30, { childrenUnder18: 1 });
    expect(result.monthlyTotal).toBeCloseTo(596.47, 5);
    expect(result.breakdown.firstChildAddition).toBe(44);
    expect(result.breakdown.childrenUnder18Addition).toBe(0);
  });

  it("second child under 18 gets the first-child rate plus the per-child rate", () => {
    const result = calculateCompensation(30, { childrenUnder18: 2 });
    expect(result.monthlyTotal).toBeCloseTo(628.47, 5);
    expect(result.breakdown.firstChildAddition).toBe(44);
    expect(result.breakdown.childrenUnder18Addition).toBe(32);
  });

  it("an under-18 child and a school child: first-child rate absorbs the under-18 child only", () => {
    const result = calculateCompensation(30, {
      childrenUnder18: 1,
      childrenSchool: 1,
    });
    expect(result.monthlyTotal).toBeCloseTo(701.47, 5);
    expect(result.breakdown.childrenUnder18Addition).toBe(0);
    expect(result.breakdown.childrenSchoolAddition).toBe(105);
  });

  it("a single school child (no under-18 child) is absorbed by the first-child rate", () => {
    const result = calculateCompensation(30, { childrenSchool: 1 });
    expect(result.monthlyTotal).toBeCloseTo(596.47, 5);
    expect(result.breakdown.firstChildAddition).toBe(44);
    expect(result.breakdown.childrenSchoolAddition).toBe(0);
  });

  it("combines every dependent category and computes the annual total", () => {
    const result = calculateCompensation(70, {
      married: true,
      spouseAidAttendance: true,
      childrenUnder18: 2,
      childrenSchool: 1,
      dependentParents: 2,
    });
    expect(result.monthlyTotal).toBeCloseTo(2772.45, 5);
    expect(result.annualTotal).toBeCloseTo(2772.45 * 12, 5);
    expect(result.breakdown).toEqual({
      baseRate: 1808.45,
      spouseAddition: 153,
      spouseAidAttendanceAddition: 141,
      firstChildAddition: 102,
      childrenUnder18Addition: 76,
      childrenSchoolAddition: 246,
      parentsAddition: 246,
    });
  });
});
