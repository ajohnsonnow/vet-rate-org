/**
 * Cross-check: vaCalculator vs ratingCalculator must agree
 *
 * The codebase has two parallel implementations of VA Combined Rating math
 * (see audit plan PR6 + ADR for the rationale):
 *   - utils/vaCalculator.js → drives the Tactical Calculator UI
 *   - utils/ratingCalculator.js → drives Million Dollar Dashboard, Retro
 *     Pay Hunter, and TDIU Builder
 *
 * They use slightly different bilateral-factor implementations (see § 4.26
 * notes in each file), but for *non-bilateral* inputs they MUST produce
 * identical results. If they ever diverge, a veteran will see two different
 * rating predictions in two parts of the same app — a credibility-killer.
 *
 * This file pins that contract until the calculators are unified.
 */
import { describe, it, expect } from "vitest";
import { calculateCombinedRating as combineRC } from "../../utils/ratingCalculator";
import { calculateVARating } from "../../utils/vaCalculator";

const asConditions = (ratings) =>
  ratings.map((rating, i) => ({
    name: `c${i}`,
    rating,
    side: "none",
    bodyPart: "other",
  }));

const cases = [
  [50],
  [100],
  [60, 40],
  [60, 40, 20],
  [50, 30],
  [30, 20],
  [10, 10],
  [70, 50, 30],
  [50, 50],
  [70, 30, 10],
  [40, 40],
  [30, 30, 30],
  [10, 10, 10],
  [10, 10, 10, 10],
  [70, 10, 50],
];

describe("cross-check — calculateCombinedRating ≡ calculateVARating (non-bilateral)", () => {
  it.each(cases)("agree on %j", (...ratings) => {
    const flat = Array.isArray(ratings[0]) ? ratings[0] : ratings;
    const rc = combineRC(flat);
    const va = calculateVARating(asConditions(flat)).combinedRating;
    expect(va).toBe(rc);
  });
});

describe("cross-check — empty / null guards agree", () => {
  it("[] → 0", () => {
    expect(combineRC([])).toBe(0);
    expect(calculateVARating(asConditions([])).combinedRating).toBe(0);
  });

  it("null/undefined → 0", () => {
    expect(combineRC(null)).toBe(0);
    expect(calculateVARating([]).combinedRating).toBe(0);
  });
});
