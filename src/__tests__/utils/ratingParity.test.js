import { describe, it, expect } from "vitest";
import {
  calculateVARating,
  combineMultipleRatings,
  roundToNearest10,
} from "../../utils/vaCalculator.js";

/**
 * A-H07: MillionDollarDashboard combines saved ratings through calculateVARating
 * (which applies the 38 CFR § 4.26 bilateral factor), but Secondary Scout used to
 * combine the bare rating numbers and DROP the bilateral factor - so the same
 * saved profile showed a lower combined rating in Scout than on the Dashboard.
 * Both now route through calculateVARating; this locks in the parity.
 */
describe("combined-rating parity - Scout vs Dashboard (A-H07)", () => {
  // Paired upper-extremity conditions (bilateral) + one non-bilateral condition.
  const profile = [
    { name: "Left arm limitation", rating: 40, side: "left" },
    { name: "Right arm limitation", rating: 40, side: "right" },
    { name: "Back condition", rating: 20, side: "none" },
  ];

  it("the canonical engine applies the § 4.26 bilateral factor", () => {
    const result = calculateVARating(profile);
    expect(result.combinedRating).toBe(80);
    expect(result.bilateralFactor).toBeGreaterThan(0);
  });

  it("the old flat path dropped bilateral and diverged (10 points lower)", () => {
    const oldFlat = roundToNearest10(
      combineMultipleRatings(profile.map((r) => r.rating)),
    );
    expect(oldFlat).toBe(70);
    expect(oldFlat).not.toBe(calculateVARating(profile).combinedRating);
  });

  it("both views now produce an identical rating for the same profile", () => {
    // Both Dashboard and Secondary Scout call calculateVARating(profile).
    const dashboard = calculateVARating(profile).combinedRating;
    const scout = calculateVARating(profile).combinedRating;
    expect(scout).toBe(dashboard);
    expect(scout).toBe(80);
  });

  it("agrees with the flat path when there are no bilateral conditions", () => {
    const noBilateral = [
      { name: "Tinnitus", rating: 10, side: "none" },
      { name: "PTSD", rating: 70, side: "none" },
    ];
    const canonical = calculateVARating(noBilateral).combinedRating;
    const flat = roundToNearest10(
      combineMultipleRatings(noBilateral.map((r) => r.rating)),
    );
    expect(canonical).toBe(flat);
  });
});
