import { describe, it, expect } from "vitest";
import {
  calculateVARating,
  checkBilateralFactorCompliance,
} from "../../utils/vaCalculator";

const named = (name, rating, side) => ({ name, rating, side });
const sideIn = (name) => (/\bright\b/i.test(name) ? "right" : "left");
const opposite = (side) => (side === "left" ? "right" : "left");
const partner = (side, bodyPart) => ({
  name: "Paired limb",
  rating: 20,
  side,
  bodyPart,
});

const NOT_A_LIMB_RATING = [
  ["Insomnia because of right knee pain", "knee"],
  ["Lumbosacral strain with sciatica, right leg", "knee"],
  ["Cervical strain with pain radiating to left arm", "elbow"],
  ["Chronic pain syndrome related to left ankle injury", "knee"],
  ["Somatic symptom disorder with right shoulder pain", "elbow"],
  ["Hyperhidrosis, left hand", "wrist"],
  ["Plantar wart, left foot", "knee"],
  ["Melanoma, right forearm", "wrist"],
  ["Right leg cellulitis", "knee"],
  ["Callus, left foot", "knee"],
  ["Lipoma, left thigh", "knee"],
  ["Left wrist ganglion cyst", "hand"],
  ["Left femoral head avascular necrosis", "knee"],
  ["Major depressive disorder associated with left knee strain", "knee"],
  ["Scar, left knee, painful", "knee"],
  ["Eczema of the left arm", "elbow"],
  ["Athlete's foot, left", "knee"],
  ["left ear infection after knee surgery", "knee"],
  ["left-hand dominant migraine", "wrist"],
  ["Left arm-rest injury", "wrist"],
  ["PTSD secondary to left leg amputation", "knee"],
  ["Headaches due to left shoulder pain", "elbow"],
  ["Left knee, status post surgery", "knee"],
  ["Tinea pedis of the left foot", "knee"],
  ["Left arm and leg weakness", "knee"],
  ["Left knee and ankle strain", "knee"],
];

const A_LIMB_RATING = [
  ["Left knee strain", "knee"],
  ["Knee, Left", "knee"],
  ["Left arm limitation", "elbow"],
  ["Radiculopathy, left lower extremity", "foot"],
  ["Residuals of right knee replacement", "knee"],
  ["Right ankle fracture residuals", "knee"],
  ["Pes planus, left", "foot"],
  ["Carpal tunnel syndrome, left wrist", "hand"],
  ["Left knee strain with limitation of flexion", "ankle"],
  ["Degenerative joint disease of the right shoulder", "elbow"],
  ["Plantar fasciitis, left foot", "knee"],
  ["Left-knee meniscal residuals", "knee"],
];

describe("a limb is read from a name only when every word is on the allowlist", () => {
  it.each(NOT_A_LIMB_RATING)(
    "%s takes no factor and is flagged: 20 + 20 give 36",
    (name, bodyPart) => {
      const side = sideIn(name);
      const list = [named(name, 20, side), partner(opposite(side), bodyPart)];
      const result = calculateVARating(list);
      expect(result.bilateralFactor).toBe(0);
      expect(result.rawScore).toBe(36);
      expect(result.bilateralIssues).toEqual([
        expect.objectContaining({ reason: "limb-unknown", name }),
      ]);
      expect(checkBilateralFactorCompliance(list).applicable).toBe(false);
    },
  );

  it.each(A_LIMB_RATING)(
    "%s pairs with the opposite limb: 20 + 20 give 36, plus 3.6 is 40",
    (name, bodyPart) => {
      const side = sideIn(name);
      const list = [named(name, 20, side), partner(opposite(side), bodyPart)];
      const result = calculateVARating(list);
      expect(result.bilateralGroupRating).toBe(40);
      expect(result.bilateralIssues).toEqual([]);
      expect(checkBilateralFactorCompliance(list).applicable).toBe(true);
    },
  );
});

describe("a name with letters outside a-z, or digits, gives no limb", () => {
  it.each([
    ["Left knee 관련 우울증"],
    ["Депрессия, left knee strain"],
    ["Left knee straín"],
    ["Left knee strain 2"],
    ["Left knee strain うつ"],
    ["Left knee strain ñ"],
  ])("%s 30 + right knee strain 20 give 44, then 40 (not 50)", (name) => {
    const list = [
      { name, rating: 30, side: "left", bodyPart: "other" },
      {
        name: "Right knee strain",
        rating: 20,
        side: "right",
        bodyPart: "other",
      },
    ];
    const result = calculateVARating(list);
    expect(result.bilateralFactor).toBe(0);
    expect(result.rawScore).toBe(44);
    expect(result.combinedRating).toBe(40);
    expect(result.bilateralIssues).toEqual([
      expect.objectContaining({ reason: "limb-unknown", name }),
    ]);
    expect(checkBilateralFactorCompliance(list).applicable).toBe(false);
  });
});

describe("repros from QA", () => {
  it("sciatica of the right leg 20 + left knee strain 10 + PTSD 50 give 60, 64, then 60 (not 70)", () => {
    const list = [
      named("Lumbosacral strain with sciatica, right leg", 20, "right"),
      named("Left knee strain", 10, "left"),
      { name: "PTSD", rating: 50, side: "none", bodyPart: "mental" },
    ];
    const result = calculateVARating(list);
    expect(result.bilateralFactor).toBe(0);
    expect(result.rawScore).toBe(64);
    expect(result.combinedRating).toBe(60);
    expect(checkBilateralFactorCompliance(list).applicable).toBe(false);
  });

  it("insomnia because of right knee pain 30 + left knee strain 10 + tinnitus 10 give 37, 43, then 40 (not 50)", () => {
    const list = [
      named("Insomnia because of right knee pain", 30, "right"),
      named("Left knee strain", 10, "left"),
      { name: "Tinnitus", rating: 10, side: "none", bodyPart: "ear" },
    ];
    const result = calculateVARating(list);
    expect(result.bilateralFactor).toBe(0);
    expect(result.rawScore).toBe(43);
    expect(result.combinedRating).toBe(40);
    expect(checkBilateralFactorCompliance(list).applicable).toBe(false);
  });

  it("depression associated with a left knee 30 + right knee 20 give 44, with no factor", () => {
    const result = calculateVARating([
      named(
        "Major depressive disorder associated with left knee strain",
        30,
        "left",
      ),
      partner("right", "knee"),
    ]);
    expect(result.bilateralFactor).toBe(0);
    expect(result.rawScore).toBe(44);
  });

  it("still reads hearing loss as not a limb, with nothing to report: knees 21, with 10 gives 29", () => {
    const result = calculateVARating([
      { name: "Left knee", rating: 10, side: "left", bodyPart: "knee" },
      { name: "Right knee", rating: 10, side: "right", bodyPart: "knee" },
      named("Bilateral hearing loss", 10, "bilateral"),
    ]);
    expect(result.rawScore).toBe(29);
    expect(result.bilateralIssues).toEqual([]);
  });
});
