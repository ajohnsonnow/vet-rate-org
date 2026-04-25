/**
 * vaCalculator — VA_PAY_RATES_2026 + calculateCompensation
 *
 * These tests lock the 2026 VA disability compensation rate table against
 * the values published by VA on
 *   https://www.va.gov/disability/compensation-rates/veteran-rates/
 *   (Effective Dec 1, 2025)
 *
 * Why this matters:
 *   `calculateCompensation` produces the dollar figures every veteran sees
 *   in the Tactical Calculator, the Million Dollar Dashboard, and the
 *   Retro Pay Hunter. A silent typo in the rate table is a "veteran picks
 *   the wrong fight" bug. These assertions are deliberately exact so a
 *   COLA bump cannot be merged without updating the test in lockstep.
 *
 *   When the 2027 COLA rates land, update both the table and these tests
 *   in the same commit.
 */

import { describe, it, expect } from "vitest";
import {
  VA_PAY_RATES_2026,
  calculateCompensation,
} from "../../utils/vaCalculator";

describe("VA_PAY_RATES_2026 — solo veteran (no dependents)", () => {
  // Source: va.gov 2026 published rates
  const expected = {
    0: 0,
    10: 180.42,
    20: 356.66,
    30: 552.47,
    40: 795.84,
    50: 1132.9,
    60: 1435.02,
    70: 1808.45,
    80: 2102.15,
    90: 2362.3,
    100: 3938.58,
  };

  Object.entries(expected).forEach(([rating, dollars]) => {
    it(`${rating}% solo = $${dollars}`, () => {
      expect(VA_PAY_RATES_2026.solo[rating]).toBe(dollars);
    });
  });
});

describe("VA_PAY_RATES_2026 — dependent additions", () => {
  it("100% with spouse adds $219.59", () => {
    expect(VA_PAY_RATES_2026.spouse[100]).toBe(219.59);
  });

  it("100% spouse aid + attendance adds $201.41", () => {
    expect(VA_PAY_RATES_2026.spouseAidAttendance[100]).toBe(201.41);
  });

  it("100% per child under 18 adds $109.11", () => {
    expect(VA_PAY_RATES_2026.childUnder18[100]).toBe(109.11);
  });

  it("100% per child in qualifying school program adds $352.45", () => {
    expect(VA_PAY_RATES_2026.childSchool[100]).toBe(352.45);
  });

  it("100% one dependent parent adds $176.24", () => {
    expect(VA_PAY_RATES_2026.parentOne[100]).toBe(176.24);
  });

  it("100% two dependent parents adds $352.48", () => {
    expect(VA_PAY_RATES_2026.parentTwo[100]).toBe(352.48);
  });

  it("dependent additions only exist for 30%+", () => {
    // Per 38 CFR § 3.4(b)(2): dependents only payable at 30%+
    [10, 20].forEach((rating) => {
      expect(VA_PAY_RATES_2026.spouse[rating]).toBeUndefined();
      expect(VA_PAY_RATES_2026.childUnder18[rating]).toBeUndefined();
    });
  });
});

describe("calculateCompensation — solo veteran", () => {
  it("0% rating → $0/mo", () => {
    const r = calculateCompensation(0);
    expect(r.monthlyTotal).toBe(0);
    expect(r.annualTotal).toBe(0);
  });

  it("100% solo → $3,938.58/mo, $47,262.96/yr", () => {
    const r = calculateCompensation(100);
    expect(r.monthlyTotal).toBe(3938.58);
    expect(r.annualTotal).toBeCloseTo(3938.58 * 12, 2);
  });

  it("50% solo → $1,132.90/mo", () => {
    const r = calculateCompensation(50);
    expect(r.monthlyTotal).toBe(1132.9);
  });

  it("ignores dependents below 30%", () => {
    const r = calculateCompensation(20, {
      married: true,
      childrenUnder18: 2,
      dependentParents: 2,
    });
    expect(r.monthlyTotal).toBe(VA_PAY_RATES_2026.solo[20]);
    expect(r.qualifiesForDependents).toBe(false);
  });
});

describe("calculateCompensation — with spouse", () => {
  it("70% married = solo + spouse addition", () => {
    const r = calculateCompensation(70, { married: true });
    expect(r.monthlyTotal).toBe(
      VA_PAY_RATES_2026.solo[70] + VA_PAY_RATES_2026.spouse[70],
    );
    expect(r.breakdown.spouseAddition).toBe(VA_PAY_RATES_2026.spouse[70]);
  });

  it("100% married + spouse A&A = solo + spouse + A&A", () => {
    const r = calculateCompensation(100, {
      married: true,
      spouseAidAttendance: true,
    });
    const expected =
      VA_PAY_RATES_2026.solo[100] +
      VA_PAY_RATES_2026.spouse[100] +
      VA_PAY_RATES_2026.spouseAidAttendance[100];
    expect(r.monthlyTotal).toBe(Math.round(expected * 100) / 100);
  });
});

describe("calculateCompensation — children", () => {
  it("100% + 1 child under 18", () => {
    const r = calculateCompensation(100, { childrenUnder18: 1 });
    expect(r.breakdown.childrenUnder18Addition).toBe(
      VA_PAY_RATES_2026.childUnder18[100],
    );
  });

  it("100% + 3 children under 18 (additive)", () => {
    const r = calculateCompensation(100, { childrenUnder18: 3 });
    expect(r.breakdown.childrenUnder18Addition).toBe(
      VA_PAY_RATES_2026.childUnder18[100] * 3,
    );
  });

  it("100% + 1 child in school", () => {
    const r = calculateCompensation(100, { childrenSchool: 1 });
    expect(r.breakdown.childrenSchoolAddition).toBe(
      VA_PAY_RATES_2026.childSchool[100],
    );
  });
});

describe("calculateCompensation — dependent parents", () => {
  it("70% + 1 parent uses parentOne table", () => {
    const r = calculateCompensation(70, { dependentParents: 1 });
    expect(r.breakdown.parentsAddition).toBe(VA_PAY_RATES_2026.parentOne[70]);
  });

  it("70% + 2 parents uses parentTwo table", () => {
    const r = calculateCompensation(70, { dependentParents: 2 });
    expect(r.breakdown.parentsAddition).toBe(VA_PAY_RATES_2026.parentTwo[70]);
  });

  it("70% + 3 parents still uses parentTwo (max table)", () => {
    const r = calculateCompensation(70, { dependentParents: 3 });
    expect(r.breakdown.parentsAddition).toBe(VA_PAY_RATES_2026.parentTwo[70]);
  });
});

describe("calculateCompensation — full family example", () => {
  it("100% married + A&A + 2 kids u18 + 1 in school + 2 parents", () => {
    const r = calculateCompensation(100, {
      married: true,
      spouseAidAttendance: true,
      childrenUnder18: 2,
      childrenSchool: 1,
      dependentParents: 2,
    });

    const expected =
      VA_PAY_RATES_2026.solo[100] +
      VA_PAY_RATES_2026.spouse[100] +
      VA_PAY_RATES_2026.spouseAidAttendance[100] +
      VA_PAY_RATES_2026.childUnder18[100] * 2 +
      VA_PAY_RATES_2026.childSchool[100] +
      VA_PAY_RATES_2026.parentTwo[100];

    expect(r.monthlyTotal).toBeCloseTo(expected, 2);
    expect(r.qualifiesForDependents).toBe(true);
  });
});
