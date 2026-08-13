import { describe, it, expect } from "vitest";
import { isConditionAlreadyRated } from "../../utils/secondaryClaimsEngine";

// Regression coverage for a bug found during an independent QA pass on a
// large AI-recommendations refactor: bidirectional substring matching let a
// short, already-rated condition name swallow any longer, distinct
// condition name that happened to contain it as a word (e.g. "Hypertension"
// silently made "Pulmonary Hypertension" -- a different condition -- look
// already-rated, since "hypertension" is a literal substring of "pulmonary
// hypertension").

describe("isConditionAlreadyRated", () => {
  it("does not treat a distinct compound condition as already rated just because it contains a shorter rated condition's name", () => {
    expect(
      isConditionAlreadyRated("Pulmonary Hypertension", ["Hypertension"]),
    ).toBe(false);
  });

  it("still matches when the veteran's saved condition is the exact same compound name", () => {
    expect(
      isConditionAlreadyRated("Pulmonary Hypertension", [
        "Pulmonary Hypertension",
      ]),
    ).toBe(true);
  });

  it("matches across a stripped side qualifier", () => {
    expect(
      isConditionAlreadyRated("Hip Degenerative Arthritis (Bilateral)", [
        "Left Hip Degenerative Arthritis",
      ]),
    ).toBe(true);
  });

  it("matches one alternative of a slash-compound DB entry", () => {
    expect(
      isConditionAlreadyRated("Radiculopathy/Sciatica", ["Sciatica"]),
    ).toBe(true);
  });

  it("does not match an unrelated condition", () => {
    expect(isConditionAlreadyRated("Tinnitus", ["Hypertension"])).toBe(false);
  });
});
