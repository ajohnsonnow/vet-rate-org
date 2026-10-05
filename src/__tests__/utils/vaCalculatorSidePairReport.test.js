import { describe, it, expect } from "vitest";
import {
  calculateVARating,
  checkBilateralFactorCompliance,
} from "../../utils/vaCalculator";

const pasted = (name, rating = 20) => ({
  name,
  rating,
  side: "none",
  bodyPart: "other",
});
const imported = (name, side, rating = 20) => ({
  name,
  rating,
  side,
  bodyPart: "other",
});
const form = (name, side, bodyPart, rating = 20) => ({
  name,
  rating,
  side,
  bodyPart,
});
const reported = (result) =>
  result.bilateralIssues.map((issue) => [issue.name, issue.reason]);
const FLAT = "No bilateral factor applies to these ratings";

const PASTED_PAIRS = [
  ["Left meniscal tear", "Right meniscal tear"],
  ["Left rotator cuff tear", "Right rotator cuff tear"],
  ["Left Achilles tendonitis", "Right hallux valgus"],
  ["Left knee strain", "Right hamstring strain"],
  ["Left sciatica", "Right sciatica"],
  ["Left shin splints", "Right shin splints"],
  ["Left tibia fracture residuals", "Right fibula fracture residuals"],
  ["Left cubital tunnel syndrome", "Right lateral epicondylitis"],
  ["Left ACL tear", "Right ACL tear"],
  ["Peripheral neuropathy, feet", "Left knee strain"],
  ["Flat feet", "Right ankle sprain"],
  ["Hip pain, L>R", "Left knee strain"],
  ["L knee strain", "R knee strain"],
];

describe("a left entry and a right entry outside the group are reported without a limb word list", () => {
  it.each(PASTED_PAIRS)(
    "pasted %s 20 + %s 20 give 36, then 40, both reported and no flat message",
    (first, second) => {
      const list = [pasted(first), pasted(second)];
      const result = calculateVARating(list);
      expect(result.bilateralFactor).toBe(0);
      expect(result.rawScore).toBe(36);
      expect(result.combinedRating).toBe(40);
      expect(reported(result)).toEqual([
        [first, "side-not-set"],
        [second, "side-not-set"],
      ]);
      const check = checkBilateralFactorCompliance(list);
      expect(check.applicable).toBe(false);
      expect(check.message).not.toContain(FLAT);
      expect(check.message).toContain(first);
      expect(check.message).toContain(second);
    },
  );

  it("an imported left knee strain beside a pasted right meniscal tear: 20 + 20 give 36, the pasted one reported", () => {
    const result = calculateVARating([
      imported("Left knee strain", "left"),
      pasted("Right meniscal tear"),
    ]);
    expect(result.rawScore).toBe(36);
    expect(reported(result)).toEqual([["Right meniscal tear", "side-not-set"]]);
  });

  it("a pasted left meniscal tear beside a formed knee pair is reported: knees 36 + 3.6 = 40, with 20 gives 52", () => {
    const result = calculateVARating([
      form("Knee (Left)", "left", "knee"),
      form("Knee (Right)", "right", "knee"),
      pasted("Left meniscal tear"),
    ]);
    expect(result.bilateralGroupRating).toBe(40);
    expect(result.rawScore).toBe(52);
    expect(reported(result)).toEqual([["Left meniscal tear", "side-not-set"]]);
  });
});

describe("form entries with a limb body part and no side", () => {
  it("two knees with no side entered are asked for a side: 20 + 20 give 36", () => {
    const result = calculateVARating([
      form("Knee", "none", "knee"),
      form("Knee strain", "none", "knee"),
    ]);
    expect(result.rawScore).toBe(36);
    expect(reported(result)).toEqual([
      ["Knee", "side-unspecified"],
      ["Knee strain", "side-unspecified"],
    ]);
  });

  it("a knee with no side beside a right knee: 20 + 20 give 36, the unsided one reported", () => {
    const result = calculateVARating([
      form("Knee", "none", "knee"),
      form("Knee (Right)", "right", "knee"),
    ]);
    expect(result.rawScore).toBe(36);
    expect(reported(result)).toEqual([["Knee", "side-unspecified"]]);
  });

  it("an ankle with no side beside a hip with no side is reported; a knee beside a shoulder is not", () => {
    expect(
      reported(
        calculateVARating([
          form("Ankle", "none", "ankle"),
          form("Hip", "none", "hip"),
        ]),
      ),
    ).toEqual([
      ["Ankle", "side-unspecified"],
      ["Hip", "side-unspecified"],
    ]);
    expect(
      calculateVARating([
        form("Knee", "none", "knee"),
        form("Shoulder", "none", "shoulder"),
      ]).bilateralIssues,
    ).toEqual([]);
  });
});

describe("pairs that are not reported", () => {
  it.each([
    ["a lone sided entry", [pasted("Left meniscal tear"), pasted("PTSD")]],
    [
      "two on the same side",
      [pasted("Left meniscal tear"), pasted("Left ACL tear")],
    ],
    [
      "a knee and a shoulder",
      [pasted("Left knee pain"), pasted("Right shoulder pain")],
    ],
    [
      "ear names",
      [pasted("Left ear hearing loss"), pasted("Right ear hearing loss")],
    ],
    [
      "an eye and a knee",
      [pasted("Left eye cataract"), pasted("Right knee strain")],
    ],
    [
      "testicle names",
      [pasted("Left testicle atrophy"), pasted("Right testicle atrophy")],
    ],
    [
      "a 0% partner",
      [pasted("Left meniscal tear"), pasted("Right meniscal tear", 0)],
    ],
    [
      "a lone form knee with no side",
      [form("Knee", "none", "knee"), form("Back", "none", "back")],
    ],
    [
      "a non-limb body part with a stray side and no limb in the name",
      [
        form("PTSD", "n/a", "mental", 50),
        form("Knee (Right)", "right", "knee"),
      ],
    ],
  ])("%s", (_label, list) => {
    expect(calculateVARating(list).bilateralIssues).toEqual([]);
  });
});
