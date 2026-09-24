/**
 * Real VA decision letters re-characterize a condition with both a rename
 * and a "(claimed as ...)" qualifier ("lumbosacral strain, degenerative
 * disc disease ... (previously rated as lumbago) (claimed as ...)"), and
 * saveMyRatings/addRating used to truncate the saved name at 200 chars mid-
 * word (regression D11).
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  saveMyRatings,
  addRating,
  getMyRatings,
  clearMyRatings,
} from "../../utils/veteranProfile";

afterEach(clearMyRatings);

const REAL_LONG_NAME =
  "Iliotibial band syndrome Greater trochanteric pain syndrome (not bursitis), left hip, previously claimed as left hip pain, left hip strain, and left hip bursitis, all evaluated together as one disability under 38 CFR 4.71a";

describe("saveMyRatings / addRating: rating name length", () => {
  it("keeps a real, long re-characterized condition name intact (regression D11)", () => {
    expect(REAL_LONG_NAME.length).toBeGreaterThan(200);
    saveMyRatings([
      { name: REAL_LONG_NAME, bodyPart: "other", rating: 0, side: "left" },
    ]);
    expect(getMyRatings()[0].name).toBe(REAL_LONG_NAME);
  });

  it("keeps a real, long name intact via addRating too", () => {
    addRating({ name: REAL_LONG_NAME, bodyPart: "other", rating: 0 });
    expect(getMyRatings()[0].name).toBe(REAL_LONG_NAME);
  });

  it("still caps an unrealistically long name rather than storing it unbounded", () => {
    const huge = "A".repeat(1000);
    saveMyRatings([{ name: huge, bodyPart: "other", rating: 0 }]);
    expect(getMyRatings()[0].name).toHaveLength(400);
  });
});
