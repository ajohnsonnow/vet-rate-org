import { describe, it, expect } from "vitest";
import {
  appYearFor,
  crossValidate,
} from "../../scripts/legal-ingestion/apply-smc-rates.mjs";

describe("appYearFor", () => {
  it("maps a December effective date to the following app rate year", () => {
    expect(appYearFor("12/01/2025")).toBe(2026);
    expect(appYearFor("12/1/2019")).toBe(2020);
  });

  it("maps a non-December effective date to its own year", () => {
    expect(appYearFor("06/15/2024")).toBe(2024);
  });

  it("returns null for an unparseable date", () => {
    expect(appYearFor("not a date")).toBeNull();
    expect(appYearFor(null)).toBeNull();
  });
});

describe("crossValidate", () => {
  const existingYearData = {
    solo: { 30: 552.47, 100: 3938.58 },
    spouse: { 30: 65.0, 100: 219.59 },
    childUnder18: { 30: 32.0 },
    childSchool: { 30: 105.0 },
    parentOne: { 30: 52.0 },
    parentTwo: { 30: 104.0 },
  };

  const cleanParsed = {
    veteran: { 30: 552.47, 100: 3938.58 },
    spouse: { 30: 617.47, 100: 4158.17 },
    childUnder18: { 30: 32.0 },
    childSchool: { 30: 105.0 },
    parentOne: { 30: 604.47 },
    parentTwo: { 30: 656.47 },
  };

  it("returns no mismatches when parsed deltas exactly match existing data", () => {
    expect(crossValidate(cleanParsed, existingYearData)).toEqual([]);
  });

  it("flags a real discrepancy instead of silently accepting it", () => {
    const drifted = {
      ...cleanParsed,
      spouse: { ...cleanParsed.spouse, 30: 618.47 }, // off by $1
    };
    const mismatches = crossValidate(drifted, existingYearData);
    expect(mismatches.some((m) => m.startsWith("spouse[30]"))).toBe(true);
  });

  it("does not flag the trivial 0%-disability row (not published in the source table)", () => {
    const mismatches = crossValidate(cleanParsed, {
      ...existingYearData,
      solo: { ...existingYearData.solo, 0: 0 },
    });
    expect(mismatches).toEqual([]);
  });
});
