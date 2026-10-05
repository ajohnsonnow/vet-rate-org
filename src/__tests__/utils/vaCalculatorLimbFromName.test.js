import { describe, it, expect } from "vitest";
import {
  calculateVARating,
  checkBilateralFactorCompliance,
} from "../../utils/vaCalculator";

const named = (name, rating, side) => ({ name, rating, side });
const sideIn = (name) =>
  /\b(?:right|rt|rle|rue)\b/i.test(name) ? "right" : "left";
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
  ["Strain with pain of the left leg", "knee"],
  ["Pain syndrome of the left leg", "knee"],
  ["Chronic left knee pain", "knee"],
  ["Left knee disorder", "knee"],
  ["Left knee syndrome", "knee"],
  ["Sciatic nerve paralysis, left arm", "elbow"],
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
  ["Left knee pain", "knee"],
  ["Diabetic peripheral neuropathy, left lower extremity", "foot"],
  ["Paralysis of the sciatic nerve, left leg", "knee"],
  ["LLE radiculopathy", "knee"],
  ["RUE neuritis", "elbow"],
  ["Rt. knee strain", "knee"],
  ["Lt knee condition", "knee"],
  ["Left knee injury", "knee"],
  ["Traumatic arthritis, right ankle", "knee"],
  ["Chondromalacia, left knee", "knee"],
  ["Patellofemoral pain syndrome, left knee", "knee"],
  ["Left shoulder impingement syndrome", "elbow"],
  ["Sciatic neuralgia, left", "knee"],
  ["Degenerative arthritis of the left hip", "knee"],
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

describe("a limb named only after 'with' belongs to a secondary finding", () => {
  it("degenerative joint disease with left leg radiculopathy 40 + right knee strain 10 give 46, then 50, with no factor", () => {
    const list = [
      named(
        "Degenerative joint disease with left leg radiculopathy",
        40,
        "left",
      ),
      named("Right knee strain", 10, "right"),
    ];
    const result = calculateVARating(list);
    expect(result.bilateralFactor).toBe(0);
    expect(result.rawScore).toBe(46);
    expect(result.combinedRating).toBe(50);
    expect(checkBilateralFactorCompliance(list).applicable).toBe(false);
  });

  it.each([
    ["Strain with radiculopathy of the left leg", "knee"],
    ["Arthritis with radiculopathy, left arm", "elbow"],
    ["Strain with limitation of flexion, left knee", "knee"],
    ["Knee strain with instability, left", "knee"],
  ])("%s takes no factor and is flagged: 20 + 20 give 36", (name, bodyPart) => {
    const result = calculateVARating([
      named(name, 20, "left"),
      partner("right", bodyPart),
    ]);
    expect(result.bilateralFactor).toBe(0);
    expect(result.rawScore).toBe(36);
    expect(result.bilateralIssues).toEqual([
      expect.objectContaining({ reason: "limb-unknown", name }),
    ]);
  });
});

describe("a name with a symbol outside ordinary punctuation gives no limb", () => {
  it.each([
    ["\u24C5\u24E3\u24E2\u24D3, left arm amputation"],
    ["\u2605 left arm amputation"],
    ["Left arm amputation\u2122"],
    ["Left arm amputation \u{1F600}"],
    ["Left arm amputation #2"],
    ["Left_arm amputation"],
    ["Left arm amputation + PTSD".replace(" PTSD", "")],
    ["\u00A7 left arm amputation"],
  ])("%s 20 + right shoulder 20 give 36, flagged", (name) => {
    const result = calculateVARating([
      { name, rating: 20, side: "left", bodyPart: "other" },
      {
        name: "Right shoulder",
        rating: 20,
        side: "right",
        bodyPart: "shoulder",
      },
    ]);
    expect(result.bilateralFactor).toBe(0);
    expect(result.rawScore).toBe(36);
    expect(result.bilateralIssues).toEqual([
      expect.objectContaining({ reason: "limb-unknown", name }),
    ]);
  });

  it.each([
    ["Le\u00ADft knee strain", "soft hyphen"],
    ["Left\u200B knee strain", "zero-width space"],
    ["\uFEFFLeft knee\u200D strain", "byte-order mark and joiner"],
    ["Knee strain (left); 10%".replace("; 10%", ""), "parentheses"],
    ["Left knee: strain", "colon"],
    ["Left knee strain.", "full stop"],
  ])(
    "%j (%s) still reads as the left knee: 20 + 20 give 36, plus 3.6 is 40",
    (name) => {
      const result = calculateVARating([
        { name, rating: 20, side: "left", bodyPart: "other" },
        { name: "Right knee", rating: 20, side: "right", bodyPart: "knee" },
      ]);
      expect(result.bilateralGroupRating).toBe(40);
      expect(result.bilateralIssues).toEqual([]);
    },
  );
});

describe("punctuation and 'and' break a name the way 'with' does", () => {
  it("degenerative arthritis; left leg radiculopathy 40 + right knee strain 10 give 46, then 50, with no factor", () => {
    const result = calculateVARating([
      named("Degenerative arthritis; left leg radiculopathy", 40, "left"),
      named("Right knee strain", 10, "right"),
    ]);
    expect(result.bilateralFactor).toBe(0);
    expect(result.rawScore).toBe(46);
    expect(result.combinedRating).toBe(50);
  });

  it.each([
    ["Degenerative arthritis / left leg radiculopathy"],
    ["Degenerative arthritis & left leg radiculopathy"],
    ["Degenerative arthritis and left leg radiculopathy"],
    ["Degenerative arthritis (left leg radiculopathy)"],
    ["Arthritis/left knee"],
    ["Strain (left knee)"],
    ["Knee strain; left"],
  ])("%s takes no factor and is flagged: 20 + 20 give 36", (name) => {
    const result = calculateVARating([
      named(name, 20, "left"),
      partner("right", "knee"),
    ]);
    expect(result.bilateralFactor).toBe(0);
    expect(result.rawScore).toBe(36);
    expect(result.bilateralIssues).toEqual([
      expect.objectContaining({ reason: "limb-unknown", name }),
    ]);
  });

  it.each([
    ["Knee strain (Left)"],
    ["Pes planus (bilateral)".replace("bilateral", "left")],
    ["Left knee strain and instability"],
    ["Left knee strain/instability"],
    ["Left knee strain (limitation of flexion)"],
    ["Left knee strain; limitation of extension"],
  ])(
    "%s still reads as the left leg: 20 + 20 give 36, plus 3.6 is 40",
    (name) => {
      const result = calculateVARating([
        named(name, 20, "left"),
        partner("right", "knee"),
      ]);
      expect(result.bilateralGroupRating).toBe(40);
      expect(result.bilateralIssues).toEqual([]);
    },
  );
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
