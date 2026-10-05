import { describe, it, expect } from "vitest";
import { calculateVARating, calculateWhatIf } from "../../utils/vaCalculator";

const c = (name, rating, side = "none", bodyPart = "other", extra = {}) => ({
  name,
  rating,
  side,
  bodyPart,
  ...extra,
});

const names = (list) => list.map((x) => x.name);

describe("38 CFR 4.26 worked example", () => {
  it("60, 20 and a bilateral 10 + 10 order as 60, 21, 20 and give 68, 74, then 70", () => {
    const result = calculateVARating([
      c("PTSD", 60, "none", "mental"),
      c("Back", 20, "none", "back"),
      c("Left knee", 10, "left", "knee"),
      c("Right knee", 10, "right", "knee"),
    ]);
    expect(result.bilateralGroupRating).toBe(21);
    expect(result.combineSteps).toEqual([
      { stage: "bilateral", from: 10, with: 10, result: 19 },
      { stage: "all", from: 60, with: 21, result: 68 },
      { stage: "all", from: 68, with: 20, result: 74 },
    ]);
    expect(result.combinedRating).toBe(70);
    expect(result.bilateralLimbs).toEqual(["lower"]);
  });
});

describe("38 CFR 4.26(a): the pair is both arms or both legs", () => {
  it("a right shoulder and a left knee are not a pair: 40, 40, 20 give 64, 71, then 70", () => {
    const result = calculateVARating([
      c("Right shoulder", 40, "right", "shoulder"),
      c("Left knee", 40, "left", "knee"),
      c("Back", 20, "none", "back"),
    ]);
    expect(result.bilateralConditions).toEqual([]);
    expect(result.bilateralFactor).toBe(0);
    expect(result.rawScore).toBe(71);
    expect(result.combinedRating).toBe(70);
    expect(result.bilateralIssues).toEqual([]);
  });

  it("a right ear and a left eye are not a pair: 30, 30, 10 give 51, 56, then 60", () => {
    const result = calculateVARating([
      c("Right ear", 30, "right", "ear"),
      c("Left eye", 30, "left", "eye"),
      c("Back", 10, "none", "back"),
    ]);
    expect(result.bilateralConditions).toEqual([]);
    expect(result.bilateralFactor).toBe(0);
    expect(result.rawScore).toBe(56);
    expect(result.combinedRating).toBe(60);
    expect(result.bilateralIssues).toEqual([]);
  });

  it("a right thigh and a left foot are a pair: 40 + 10 give 46, plus 4.6 is 51, then 50", () => {
    const result = calculateVARating([
      c("Right thigh amputation", 40, "right", "thigh"),
      c("Left pes planus", 10, "left", "foot"),
    ]);
    expect(names(result.bilateralConditions)).toEqual([
      "Right thigh amputation",
      "Left pes planus",
    ]);
    expect(result.bilateralFactor).toBeCloseTo(4.6, 5);
    expect(result.rawScore).toBe(51);
    expect(result.combinedRating).toBe(50);
  });

  it("two conditions of the same leg are not a pair: 30 + 20 give 44, then 40", () => {
    const result = calculateVARating([
      c("Left knee", 30, "left", "knee"),
      c("Left ankle", 20, "left", "ankle"),
    ]);
    expect(result.bilateralFactor).toBe(0);
    expect(result.rawScore).toBe(44);
    expect(result.combinedRating).toBe(40);
  });

  it("every disability of the paired limbs joins the group: 30, 20, 10 legs give 50 + 5 = 55, with 40 gives 73, then 70", () => {
    const result = calculateVARating([
      c("Left knee", 30, "left", "knee"),
      c("Left ankle", 10, "left", "ankle"),
      c("Right hip", 20, "right", "hip"),
      c("Back", 40, "none", "back"),
    ]);
    expect(result.bilateralConditions).toHaveLength(3);
    expect(result.bilateralGroupRating).toBe(55);
    expect(result.rawScore).toBe(73);
    expect(result.combinedRating).toBe(70);
  });
});

describe("38 CFR 4.26(c): each side must be of compensable degree", () => {
  it("a 0% left knee does not pair with a 30% right knee: 30 + 20 give 44, then 40", () => {
    const result = calculateVARating([
      c("Left knee", 0, "left", "knee"),
      c("Right knee", 30, "right", "knee"),
      c("Back", 20, "none", "back"),
    ]);
    expect(result.bilateralConditions).toEqual([]);
    expect(result.bilateralFactor).toBe(0);
    expect(result.rawScore).toBe(44);
    expect(result.combinedRating).toBe(40);
  });

  it("a 0% entry stays out of a group formed by the compensable ones: 20 + 20 give 36, plus 3.6 is 40", () => {
    const result = calculateVARating([
      c("Left knee", 20, "left", "knee"),
      c("Left ankle", 0, "left", "ankle"),
      c("Right knee", 20, "right", "knee"),
    ]);
    expect(names(result.bilateralConditions)).toEqual([
      "Left knee",
      "Right knee",
    ]);
    expect(names(result.nonBilateralConditions)).toEqual(["Left ankle"]);
    expect(result.bilateralGroupRating).toBe(40);
    expect(result.combinedRating).toBe(40);
  });
});

describe("one evaluation that already covers both sides (M21-1 V.iv.1.C.4.b)", () => {
  it("gets no factor by itself: bilateral pes planus 50 stays 50", () => {
    const result = calculateVARating([
      c("Bilateral pes planus", 50, "bilateral", "foot"),
    ]);
    expect(result.bilateralConditions).toEqual([]);
    expect(result.bilateralFactor).toBe(0);
    expect(result.rawScore).toBe(50);
    expect(result.combinedRating).toBe(50);
    expect(result.bilateralIssues).toEqual([
      expect.objectContaining({
        reason: "single-bilateral-evaluation",
        name: "Bilateral pes planus",
      }),
    ]);
  });

  it("gets no factor next to unrelated conditions: 50 + 30 give 65, then 70", () => {
    const result = calculateVARating([
      c("Bilateral pes planus", 30, "bilateral", "foot"),
      c("PTSD", 50, "none", "mental"),
    ]);
    expect(result.bilateralFactor).toBe(0);
    expect(result.rawScore).toBe(65);
    expect(result.combinedRating).toBe(70);
  });

  it("gets the factor with a separately rated leg condition: 30 + 20 give 44, plus 4.4 is 48, then 50", () => {
    const result = calculateVARating([
      c("Left leg muscle damage", 20, "left", "leg"),
      c("Bilateral pes planus", 30, "bilateral", "foot"),
    ]);
    expect(result.bilateralConditions).toHaveLength(2);
    expect(result.bilateralFactor).toBeCloseTo(4.4, 5);
    expect(result.rawScore).toBe(48);
    expect(result.combinedRating).toBe(50);
    expect(result.bilateralIssues).toEqual([]);
  });

  it("joins a pair of the other limbs: shoulders 20 + 20 and pes planus 30 give 44, 55, plus 5.5 is 61, then 60", () => {
    const result = calculateVARating([
      c("Right shoulder", 20, "right", "shoulder"),
      c("Left shoulder", 20, "left", "shoulder"),
      c("Bilateral pes planus", 30, "bilateral", "foot"),
    ]);
    expect(result.bilateralConditions).toHaveLength(3);
    expect(result.bilateralGroupRating).toBe(61);
    expect(result.rawScore).toBe(61);
    expect(result.combinedRating).toBe(60);
    expect(result.bilateralLimbs).toEqual(["upper", "lower"]);
  });

  it("two such evaluations of the same limbs count as separately rated: 30 + 20 give 44, plus 4.4 is 48, then 50", () => {
    const result = calculateVARating([
      c("Bilateral pes planus", 30, "bilateral", "foot"),
      c("Bilateral shin splints", 20, "bilateral", "leg"),
    ]);
    expect(result.bilateralConditions).toHaveLength(2);
    expect(result.rawScore).toBe(48);
    expect(result.combinedRating).toBe(50);
  });
});

describe("a both-sides evaluation with nothing of those limbs to pair with", () => {
  it("does not pair with a single arm condition: 30 + 20 give 44, then 40", () => {
    const result = calculateVARating([
      c("Right shoulder", 20, "right", "shoulder"),
      c("Bilateral pes planus", 30, "bilateral", "foot"),
    ]);
    expect(result.bilateralFactor).toBe(0);
    expect(result.rawScore).toBe(44);
    expect(result.combinedRating).toBe(40);
  });

  it("two such evaluations, one for the arms and one for the legs, get no factor: 30 + 20 give 44, then 40", () => {
    const result = calculateVARating([
      c("Bilateral hand tremor", 20, "bilateral", "hand"),
      c("Bilateral pes planus", 30, "bilateral", "foot"),
    ]);
    expect(result.bilateralFactor).toBe(0);
    expect(result.rawScore).toBe(44);
    expect(result.bilateralIssues).toHaveLength(2);
  });

  it("a both-sides entry for a part that is not a limb never gets the factor: 30 + 10 give 37", () => {
    const result = calculateVARating([
      c("Hearing loss", 30, "bilateral", "ear"),
      c("Left knee", 10, "left", "knee"),
    ]);
    expect(result.bilateralFactor).toBe(0);
    expect(result.rawScore).toBe(37);
    expect(result.bilateralIssues).toEqual([]);
  });
});

describe("38 CFR 4.26(b): four affected extremities take one factor", () => {
  it("shoulders 20 + 20 and knees 10 + 10 give 36, 42, 48, plus 4.8 is 53; with 30 gives 67, then 70", () => {
    const result = calculateVARating([
      c("Left shoulder", 20, "left", "shoulder"),
      c("Right shoulder", 20, "right", "shoulder"),
      c("Left knee", 10, "left", "knee"),
      c("Right knee", 10, "right", "knee"),
      c("Back", 30, "none", "back"),
    ]);
    expect(result.bilateralConditions).toHaveLength(4);
    expect(result.combineSteps).toEqual([
      { stage: "bilateral", from: 20, with: 20, result: 36 },
      { stage: "bilateral", from: 36, with: 10, result: 42 },
      { stage: "bilateral", from: 42, with: 10, result: 48 },
      { stage: "all", from: 53, with: 30, result: 67 },
    ]);
    expect(result.bilateralFactor).toBeCloseTo(4.8, 5);
    expect(result.bilateralGroupRating).toBe(53);
    expect(result.combinedRating).toBe(70);
    expect(result.bilateralLimbs).toEqual(["upper", "lower"]);
  });
});

describe("limb type of a sided entry", () => {
  it("reads the limb from the name when the body part is not given: 30 + 30 give 51, plus 5.1 is 56", () => {
    const result = calculateVARating([
      { name: "Radiculopathy, left lower extremity", rating: 30, side: "left" },
      c("Right knee strain", 30, "right", "other"),
    ]);
    expect(result.bilateralGroupRating).toBe(56);
    expect(result.bilateralLimbs).toEqual(["lower"]);
    expect(result.bilateralIssues).toEqual([]);
  });

  it("an explicit limb wins over the body part and the name: 30 + 30 give 56 with the factor, 51 without", () => {
    const result = calculateVARating([
      c("Muscle group XIV", 30, "left", "other", { limb: "lower" }),
      c("Right knee", 30, "right", "knee"),
    ]);
    expect(result.bilateralGroupRating).toBe(56);
    const none = calculateVARating([
      c("Left knee scar", 30, "left", "knee", { limb: "none" }),
      c("Right knee", 30, "right", "knee"),
    ]);
    expect(none.bilateralFactor).toBe(0);
    expect(none.rawScore).toBe(51);
  });

  it("applies no factor and says so when the limb cannot be determined: 20 + 20 give 36, then 40", () => {
    const result = calculateVARating([
      c("Condition A", 20, "left", "other", { id: "a" }),
      c("Condition B", 20, "right", "other", { id: "b" }),
    ]);
    expect(result.bilateralConditions).toEqual([]);
    expect(result.bilateralFactor).toBe(0);
    expect(result.rawScore).toBe(36);
    expect(result.combinedRating).toBe(40);
    expect(result.bilateralIssues).toEqual([
      expect.objectContaining({ reason: "limb-unknown", id: "a" }),
      expect.objectContaining({ reason: "limb-unknown", id: "b" }),
    ]);
  });

  it("leaves an undetermined entry out of a pair the others form, and reports it: knees 21, with 20 gives 37", () => {
    const result = calculateVARating([
      c("Left knee", 10, "left", "knee"),
      c("Right knee", 10, "right", "knee"),
      c("Neuropathy", 20, "right", "other"),
    ]);
    expect(names(result.bilateralConditions)).toEqual([
      "Left knee",
      "Right knee",
    ]);
    expect(result.bilateralGroupRating).toBe(21);
    expect(result.rawScore).toBe(37);
    expect(result.bilateralIssues).toEqual([
      expect.objectContaining({ reason: "limb-unknown", name: "Neuropathy" }),
    ]);
  });

  it("does not report an undetermined entry that could not pair with anything: 50 + 20 give 60", () => {
    const result = calculateVARating([
      c("Condition A", 20, "left", "other"),
      c("PTSD", 50, "none", "mental"),
    ]);
    expect(result.bilateralIssues).toEqual([]);
    expect(result.rawScore).toBe(60);
  });

  it("a name that points at both an arm and a leg is undetermined: 20 + 20 give 36", () => {
    const result = calculateVARating([
      c("Left arm and leg weakness", 20, "left", "other"),
      c("Right knee", 20, "right", "knee"),
    ]);
    expect(result.bilateralFactor).toBe(0);
    expect(result.rawScore).toBe(36);
    expect(result.bilateralIssues).toEqual([
      expect.objectContaining({ reason: "limb-unknown" }),
    ]);
  });
});

describe("calculateWhatIf with a both-sides proposed condition", () => {
  it("adds the factor only when a leg condition is already rated: 30 + 20 give 44, plus 4.4 is 48; with 50 alone, 65", () => {
    const withLeg = calculateWhatIf(
      [c("Left knee", 20, "left", "knee")],
      30,
      true,
    );
    expect(withLeg.newRaw).toBe(48);
    const alone = calculateWhatIf([c("PTSD", 50, "none", "mental")], 30, true);
    expect(alone.newRaw).toBe(65);
  });
});

describe("result shape", () => {
  it("adds the bilateral fields without renaming the existing ones", () => {
    const empty = calculateVARating([]);
    const one = calculateVARating([c("PTSD", 50, "none", "mental")]);
    for (const result of [empty, one]) {
      expect(result.bilateralIssues).toEqual([]);
      expect(result.bilateralLimbs).toEqual([]);
      expect(result.bilateralConditions).toEqual([]);
      expect(result.combineSteps).toEqual([]);
    }
  });
});
