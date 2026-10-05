import { describe, it, expect } from "vitest";
import {
  calculateVARating,
  checkBilateralFactorCompliance,
  sideFromName,
} from "../../utils/vaCalculator";
import { buildCalculatorExplanation } from "../../utils/raterGrounding";

const c = (name, rating, side, bodyPart) => ({ name, rating, side, bodyPart });

describe("a non-limb body part with a name that names a limb", () => {
  it("is flagged instead of silently read as not a limb: 20, 20, 10 give 36, 42, then 40", () => {
    const result = calculateVARating([
      c("Left leg radiculopathy", 20, "left", "back"),
      c("Right leg radiculopathy", 20, "right"),
      c("Tinnitus", 10, "none", "ear"),
    ]);
    expect(result.bilateralFactor).toBe(0);
    expect(result.rawScore).toBe(42);
    expect(result.combinedRating).toBe(40);
    expect(result.bilateralIssues).toEqual([
      expect.objectContaining({
        reason: "separate-entry",
        name: "Left leg radiculopathy",
      }),
    ]);
  });

  it("stays not a limb, with nothing to report, when the name agrees: knees 21, with 10 gives 29", () => {
    const result = calculateVARating([
      c("Left knee", 10, "left", "knee"),
      c("Right knee", 10, "right", "knee"),
      c("Left ear hearing loss", 10, "left", "ear"),
    ]);
    expect(result.rawScore).toBe(29);
    expect(result.bilateralIssues).toEqual([]);
  });
});

describe("side is normalised before pairing", () => {
  it("ignores case and spaces: ' Left ' and 'RIGHT' knees at 20 give 36, plus 3.6 is 40", () => {
    const result = calculateVARating([
      c("Knee A", 20, " Left ", "knee"),
      c("Knee B", 20, "RIGHT", "knee"),
    ]);
    expect(result.bilateralGroupRating).toBe(40);
    expect(result.bilateralConditions.map((x) => x.side)).toEqual([
      "left",
      "right",
    ]);
  });

  it("reads 'both' as a both-sides evaluation: 30 + 20 give 44, plus 4.4 is 48", () => {
    const result = calculateVARating([
      c("Left leg muscle damage", 20, "left", "leg"),
      c("Pes planus", 30, "Both", "foot"),
    ]);
    expect(result.rawScore).toBe(48);
  });

  it("treats a missing or empty side as none: 20 + 20 give 36, and asks for the side of the two knees", () => {
    const result = calculateVARating([
      c("Knee A", 20, "", "knee"),
      c("Knee B", 20, undefined, "knee"),
      c("Knee C", 0, null, "knee"),
    ]);
    expect(result.rawScore).toBe(36);
    expect(result.bilateralIssues.map((i) => [i.name, i.reason])).toEqual([
      ["Knee A", "side-unspecified"],
      ["Knee B", "side-unspecified"],
    ]);
  });

  it("flags an unrecognised side on a limb entry instead of dropping it: 20 + 20 give 36", () => {
    const list = [
      c("Knee A", 20, "lft", "knee"),
      c("Knee B", 20, "right", "knee"),
    ];
    const result = calculateVARating(list);
    expect(result.bilateralFactor).toBe(0);
    expect(result.rawScore).toBe(36);
    expect(result.bilateralIssues).toEqual([
      expect.objectContaining({ reason: "side-unknown", name: "Knee A" }),
    ]);
    expect(buildCalculatorExplanation(result)).toContain(
      "did not recognise the side entered for Knee A",
    );
    const check = checkBilateralFactorCompliance(list);
    expect(check.applicable).toBe(false);
    expect(check.message).toContain("Knee A");
  });

  it("does not flag an unrecognised side on an entry that is not a limb: 50 + 20 give 60", () => {
    const result = calculateVARating([
      c("PTSD", 50, "n/a", "mental"),
      c("Knee B", 20, "right", "knee"),
    ]);
    expect(result.rawScore).toBe(60);
    expect(result.bilateralIssues).toEqual([]);
  });
});

describe("sideFromName", () => {
  it.each([
    ["Left knee strain", "left"],
    ["Knee, Right", "right"],
    ["Bilateral pes planus", "bilateral"],
    ["Pes planus, both feet", "bilateral"],
    ["Rt. knee strain", "right"],
    ["Lt knee strain", "left"],
    ["LLE radiculopathy", "left"],
    ["RUE neuritis", "right"],
    ["Tinnitus", "none"],
    ["Left and right knee strain", "none"],
    ["Copyright claim", "none"],
    ["Hodgkin lymphoma s/p RT", "none"],
    ["LT nerve paralysis, shoulder", "none"],
    ["Sciatic neuritis, Rt", "right"],
    ["Knee strain, Lt", "left"],
    ["Lt. arthritis, knee", "left"],
    [null, "none"],
  ])("%j gives %s", (name, side) => {
    expect(sideFromName(name)).toBe(side);
  });
});

describe("a name that states a side on an entry with no side set", () => {
  const pasted = (name, rating) => ({
    name,
    rating,
    side: "none",
    bodyPart: "other",
  });

  it("is reported, with no factor: pasted left and right knee strain 10 + 10 with 30 give 37, 43, then 40", () => {
    const list = [
      pasted("Left knee strain", 10),
      pasted("Right knee strain", 10),
      pasted("PTSD", 30),
    ];
    const result = calculateVARating(list);
    expect(result.bilateralFactor).toBe(0);
    expect(result.rawScore).toBe(43);
    expect(result.combinedRating).toBe(40);
    expect(result.bilateralIssues).toEqual([
      expect.objectContaining({
        reason: "side-not-set",
        name: "Left knee strain",
      }),
      expect.objectContaining({
        reason: "side-not-set",
        name: "Right knee strain",
      }),
    ]);
    expect(buildCalculatorExplanation(result)).toContain(
      "Left knee strain and Right knee strain name a side, but no side is set",
    );
    const check = checkBilateralFactorCompliance(list);
    expect(check.applicable).toBe(false);
    expect(check.message).toContain("no side is set");
  });

  it("is reported when the entry has no side field at all: 10 + 10 give 19", () => {
    const result = calculateVARating([
      { name: "Left knee strain", rating: 10 },
      c("Right knee", 10, "right", "knee"),
    ]);
    expect(result.rawScore).toBe(19);
    expect(result.bilateralIssues).toEqual([
      expect.objectContaining({
        reason: "side-not-set",
        name: "Left knee strain",
      }),
    ]);
  });

  it.each([
    [
      "nothing to pair with",
      [pasted("Left knee strain", 10), pasted("PTSD", 30)],
    ],
    [
      "only the same side",
      [pasted("Left knee strain", 10), pasted("Left ankle sprain", 10)],
    ],
    [
      "the other limb",
      [pasted("Left knee strain", 10), pasted("Right shoulder strain", 10)],
    ],
  ])("is not reported with %s", (_label, list) => {
    expect(calculateVARating(list).bilateralIssues).toEqual([]);
  });

  it("an unrecognised side on an entry of unknown limb is reported next to a sided limb: 20 + 20 give 36", () => {
    const result = calculateVARating([
      c("Condition A", 20, "lft", "other"),
      c("Right knee", 20, "right", "knee"),
    ]);
    expect(result.rawScore).toBe(36);
    expect(result.bilateralIssues).toEqual([
      expect.objectContaining({ reason: "side-unknown", name: "Condition A" }),
    ]);
  });
});
