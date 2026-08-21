import { describe, it, expect } from "vitest";

import disabilityData from "../data/disabilityData.json";
import dbqLogicMap from "../data/dbq_logic_map.json";

// S35 coverage floor: every rated diagnostic code carries structured (not
// prose-only) rating criteria, and the DBQ logic map covers the full DBQ list.
// Guards against the 176-code gap S35 closed silently reopening.

const disabilities = disabilityData.disabilities;

describe("disabilityData rating-criteria coverage (S35)", () => {
  it("every disability entry has a ratingCriteria object", () => {
    const missing = disabilities
      .filter((e) => e.ratingCriteria == null)
      .map((e) => e.diagnosticCode);
    expect(missing).toEqual([]);
  });

  it("every ratingCriteria is structured - a type plus ratings, ratedUnder, or formula", () => {
    const unstructured = disabilities
      .filter((e) => {
        const rc = e.ratingCriteria;
        if (!rc || typeof rc.type !== "string") return true;
        const hasRatings = rc.ratings && Object.keys(rc.ratings).length > 0;
        return !hasRatings && !rc.ratedUnder && !rc.formula;
      })
      .map((e) => e.diagnosticCode);
    expect(unstructured).toEqual([]);
  });

  it('no ratings map uses a non-numeric placeholder key (e.g. "varies")', () => {
    const bad = [];
    for (const e of disabilities) {
      const ratings = e.ratingCriteria?.ratings;
      if (!ratings) continue;
      for (const key of Object.keys(ratings)) {
        if (!/^\d{1,3}$/.test(key)) bad.push(`${e.diagnosticCode}:${key}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("DBQ logic map coverage (S35)", () => {
  const entries = Object.entries(dbqLogicMap);
  const validCodes = new Set(disabilities.map((e) => e.diagnosticCode));

  it("covers at least 70 conditions", () => {
    expect(entries.length).toBeGreaterThanOrEqual(70);
  });

  it("every entry maps to a diagnostic code that exists in disabilityData", () => {
    const orphaned = entries
      .filter(([, v]) => !validCodes.has(String(v.diagnostic_code)))
      .map(([k]) => k);
    expect(orphaned).toEqual([]);
  });

  it("diagnostic codes are unique so lookup-by-code is unambiguous", () => {
    const seen = new Map();
    for (const [key, v] of entries) {
      const code = String(v.diagnostic_code);
      expect(seen.has(code), `duplicate diagnostic_code ${code}`).toBe(false);
      seen.set(code, key);
    }
  });
});
