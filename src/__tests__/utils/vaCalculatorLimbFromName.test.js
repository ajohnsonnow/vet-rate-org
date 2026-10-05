import { describe, it, expect } from "vitest";
import { calculateVARating } from "../../utils/vaCalculator";

const named = (name, rating, side) => ({ name, rating, side });
const rightKnee = (rating = 10) => ({
  name: "Right knee",
  rating,
  side: "right",
  bodyPart: "knee",
});
const other = (rating = 10) => ({
  name: "Other",
  rating,
  side: "none",
  bodyPart: "back",
});

describe("a limb is not read from a name that points somewhere else", () => {
  it("depression associated with a knee is not a leg disability: 30, 10, 10 give 37, 43, then 40", () => {
    const result = calculateVARating([
      named(
        "Major depressive disorder associated with left knee strain",
        30,
        "left",
      ),
      rightKnee(),
      other(),
    ]);
    expect(result.bilateralFactor).toBe(0);
    expect(result.rawScore).toBe(43);
    expect(result.combinedRating).toBe(40);
    expect(result.bilateralIssues).toEqual([
      expect.objectContaining({ reason: "limb-unknown" }),
    ]);
  });

  it("a knee scar is not read as a leg disability: 10, 10, 10, 10 give 19, 27, 34, then 30", () => {
    const result = calculateVARating([
      named("Scar, left knee, painful", 10, "left"),
      rightKnee(),
      other(),
      other(),
    ]);
    expect(result.bilateralFactor).toBe(0);
    expect(result.rawScore).toBe(34);
    expect(result.combinedRating).toBe(30);
    expect(result.bilateralIssues).toEqual([
      expect.objectContaining({ reason: "limb-unknown" }),
    ]);
  });

  it.each([
    ["Eczema of the left arm", "right", "elbow"],
    ["Athlete's foot, left", "right", "knee"],
    ["left ear infection after knee surgery", "right", "knee"],
    ["left-hand dominant migraine", "right", "wrist"],
    ["Left arm-rest injury", "right", "wrist"],
    ["PTSD secondary to left leg amputation", "right", "knee"],
    ["Headaches due to left shoulder pain", "right", "elbow"],
    ["Left knee, status post surgery", "right", "knee"],
    ["Tinea pedis of the left foot", "right", "knee"],
  ])(
    "%s takes no factor and is flagged: 20 + 20 give 36",
    (name, side, bodyPart) => {
      const result = calculateVARating([
        named(name, 20, "left"),
        { name: "Paired limb", rating: 20, side, bodyPart },
      ]);
      expect(result.bilateralFactor).toBe(0);
      expect(result.rawScore).toBe(36);
      expect(result.bilateralIssues).toEqual([
        expect.objectContaining({ reason: "limb-unknown", name }),
      ]);
    },
  );
});

describe("plain limb names from decision letters still give a limb", () => {
  it.each([
    ["Radiculopathy, left lower extremity", "knee"],
    ["Left knee strain", "knee"],
    ["Knee, Left", "knee"],
    ["Left arm limitation", "elbow"],
    ["Diabetic peripheral neuropathy, left lower extremity", "foot"],
    ["Left knee strain with limitation of flexion", "ankle"],
    ["Pes planus, left", "foot"],
    ["Carpal tunnel syndrome, left wrist", "hand"],
  ])(
    "%s pairs with the opposite limb: 20 + 20 give 36, plus 3.6 is 40",
    (name, bodyPart) => {
      const result = calculateVARating([
        named(name, 20, "left"),
        { name: "Paired limb", rating: 20, side: "right", bodyPart },
      ]);
      expect(result.bilateralGroupRating).toBe(40);
      expect(result.bilateralIssues).toEqual([]);
    },
  );

  it("still reads hearing loss as not a limb, with nothing to report: knees 21, with 10 gives 29", () => {
    const result = calculateVARating([
      { name: "Left knee", rating: 10, side: "left", bodyPart: "knee" },
      rightKnee(),
      named("Bilateral hearing loss", 10, "bilateral"),
    ]);
    expect(result.rawScore).toBe(29);
    expect(result.bilateralIssues).toEqual([]);
  });
});
