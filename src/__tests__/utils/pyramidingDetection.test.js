import { describe, it, expect } from "vitest";
import { detectPyramiding } from "../../utils/vaCalculator";

// Regression coverage for a bug found during an independent QA pass on a
// large AI-recommendations refactor: _detectBodyPartPyramiding grouped
// conditions by an exact `side` string match, so a condition with an
// unspecified or bilateral side (which genuinely can't be ruled out as
// overlapping a left/right entry of the same body part) silently escaped
// detection, while _detectNervePyramiding in the same file correctly used
// the shared _sidesMayOverlap() overlap check for the same scenario.

function condition(name, bodyPart, side) {
  return { name, bodyPart, side };
}

describe("detectPyramiding: body-part side-overlap detection", () => {
  it("does not flag a genuine left/right pair (no overlap)", () => {
    const result = detectPyramiding([
      condition("Left Knee Strain", "knee", "left"),
      condition("Right Knee Strain", "knee", "right"),
    ]);
    expect(result.hasPotentialPyramiding).toBe(false);
  });

  it("flags a left-side condition against an unspecified-side condition of the same body part", () => {
    const result = detectPyramiding([
      condition("Left Knee Strain", "knee", "left"),
      condition("Knee Arthritis", "knee", undefined),
    ]);
    expect(result.hasPotentialPyramiding).toBe(true);
    expect(result.warnings[0].type).toBe("potential_pyramiding");
  });

  it("flags a bilateral condition against a left-side condition of the same body part", () => {
    const result = detectPyramiding([
      condition("Bilateral Knee DJD", "knee", "bilateral"),
      condition("Left Knee Instability", "knee", "left"),
    ]);
    expect(result.hasPotentialPyramiding).toBe(true);
  });

  it("pulls a genuine left/right pair into one warning through an unspecified-side third condition", () => {
    const result = detectPyramiding([
      condition("Left Knee Strain", "knee", "left"),
      condition("Right Knee Strain", "knee", "right"),
      condition("Knee Arthritis", "knee", undefined),
    ]);
    expect(result.hasPotentialPyramiding).toBe(true);
    const warning = result.warnings.find((w) => w.bodyPart === "knee");
    expect(warning.conditions).toHaveLength(3);
  });

  it("still flags two unqualified conditions of the same body part", () => {
    const result = detectPyramiding([
      condition("Cervical Strain", "neck", undefined),
      condition("Cervical Arthritis", "neck", undefined),
    ]);
    expect(result.hasPotentialPyramiding).toBe(true);
  });
});
