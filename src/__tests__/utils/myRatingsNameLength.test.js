/**
 * VA decision letters re-characterize a condition with both a rename
 * and a "(claimed as ...)" qualifier ("cervical strain, degenerative
 * disc disease ... (previously rated as neck sprain) (claimed as ...)"), and
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

const LONG_NAME =
  "Plantar fasciitis with calcaneal spur formation (not heel contusion), right foot, previously claimed as right heel pain, right foot strain, and right foot bursitis, all evaluated together as one disability under 38 CFR 4.71a";

describe("saveMyRatings / addRating: rating name length", () => {
  it("keeps a long re-characterized condition name intact (regression D11)", () => {
    expect(LONG_NAME.length).toBeGreaterThan(200);
    saveMyRatings([
      { name: LONG_NAME, bodyPart: "other", rating: 0, side: "right" },
    ]);
    expect(getMyRatings()[0].name).toBe(LONG_NAME);
  });

  it("keeps a long name intact via addRating too", () => {
    addRating({ name: LONG_NAME, bodyPart: "other", rating: 0 });
    expect(getMyRatings()[0].name).toBe(LONG_NAME);
  });

  it("still caps an unrealistically long name rather than storing it unbounded", () => {
    const huge = "A".repeat(1000);
    saveMyRatings([{ name: huge, bodyPart: "other", rating: 0 }]);
    expect(getMyRatings()[0].name).toHaveLength(400);
  });
});
