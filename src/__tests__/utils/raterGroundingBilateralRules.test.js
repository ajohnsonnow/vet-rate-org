import { describe, it, expect } from "vitest";
import { calculateVARating } from "../../utils/vaCalculator";
import {
  buildCalculatorExplanation,
  buildComputedResultBlock,
  checkRaterResponse,
  findDeniedBilateralClaims,
  findInventedBilateralClaims,
  formatCalculatorWorking,
} from "../../utils/raterGrounding";

const c = (name, rating, side = "none", bodyPart = "other") => ({
  name,
  rating,
  side,
  bodyPart,
});

const LEFT_RIGHT = "one on the left and one on the right";

const FOUR_LIMBS = calculateVARating([
  c("Left shoulder", 20, "left", "shoulder"),
  c("Right shoulder", 20, "right", "shoulder"),
  c("Left knee", 10, "left", "knee"),
  c("Right knee", 10, "right", "knee"),
  c("Back", 30, "none", "back"),
]);
const BOTH_SIDES_WITH_LEG = calculateVARating([
  c("Left leg muscle damage", 20, "left", "leg"),
  c("Bilateral pes planus", 30, "bilateral", "foot"),
]);
const BOTH_SIDES_ALONE = calculateVARating([
  c("Bilateral pes planus", 30, "bilateral", "foot"),
  c("PTSD", 50, "none", "mental"),
]);
const ONE_REMOVED = calculateVARating([
  c("PTSD", 40, "none", "mental"),
  c("Back", 20, "none", "back"),
  c("Left knee", 30, "left", "knee"),
  c("Left ankle", 10, "left", "ankle"),
  c("Right knee", 10, "right", "knee"),
]);
const ALL_REMOVED = calculateVARating([
  c("PTSD", 90, "none", "mental"),
  c("Back", 30, "none", "back"),
  c("Left knee", 10, "left", "knee"),
  c("Right knee", 10, "right", "knee"),
]);
const LIMB_UNKNOWN = calculateVARating([
  c("Left knee", 10, "left", "knee"),
  c("Right knee", 10, "right", "knee"),
  c("Neuropathy", 20, "right", "other"),
]);

const TWO_LEFT_ONE_RIGHT = calculateVARating([
  c("Left knee", 30, "left", "knee"),
  c("Left ankle", 10, "left", "ankle"),
  c("Right hip", 20, "right", "hip"),
  c("Back", 40, "none", "back"),
]);
const TWO_BOTH_SIDES = calculateVARating([
  c("Bilateral pes planus", 30, "bilateral", "foot"),
  c("Bilateral shin splints", 20, "bilateral", "leg"),
]);

describe("explanation says what the group actually holds", () => {
  it("counts the sides of a left, left, right group", () => {
    const text = buildCalculatorExplanation(TWO_LEFT_ONE_RIGHT);
    expect(text).toContain(
      "compensable disabilities of both legs: 2 on the left and 1 on the right (38 CFR § 4.26)",
    );
    expect(text).not.toContain(LEFT_RIGHT);
  });

  it("names the separately rated disability that lets a both-sides evaluation take the factor", () => {
    const text = buildCalculatorExplanation(BOTH_SIDES_WITH_LEG);
    expect(text).toContain(
      "compensable disabilities of both legs: 1 on the left and 1 rated for both sides (38 CFR § 4.26)",
    );
    expect(text).toContain(
      "it takes the factor because Left leg muscle damage is rated separately",
    );
  });

  it("gives the real reason two both-sides evaluations of the same limbs take the factor", () => {
    const text = buildCalculatorExplanation(TWO_BOTH_SIDES);
    expect(text).toContain("2 rated for both sides");
    expect(text).toContain(
      "Vet-Rate treats two such evaluations of the same limbs as separately rated disabilities",
    );
    expect(text).not.toContain("because another disability in the group");
    expect(text).not.toMatch(/because .* (is|are) rated separately/);
  });
});

describe("explanation of the group the calculator formed", () => {
  it("says all four extremities take one factor under 38 CFR 4.26(b)", () => {
    const text = buildCalculatorExplanation(FOUR_LIMBS);
    expect(text).toContain("both arms and both legs");
    expect(text).toContain("38 CFR § 4.26(b)");
    expect(text).not.toContain(LEFT_RIGHT);
  });

  it("says why an evaluation covering both sides is in the group", () => {
    const text = buildCalculatorExplanation(BOTH_SIDES_WITH_LEG);
    expect(text).toContain(
      "Bilateral pes planus is one evaluation that covers both sides",
    );
    expect(text).toContain("M21-1, V.iv.1.C.4.b");
    expect(text).not.toContain(LEFT_RIGHT);
  });

  it("says why an evaluation covering both sides got no factor by itself", () => {
    const text = buildCalculatorExplanation(BOTH_SIDES_ALONE);
    expect(text).toContain("No bilateral pair applies");
    expect(text).toContain(
      "Bilateral pes planus is one evaluation that covers both sides, and by itself it takes no bilateral factor",
    );
    expect(buildComputedResultBlock(BOTH_SIDES_ALONE)).toContain(
      "by itself it takes no bilateral factor",
    );
  });

  it("names an entry whose limb it could not determine", () => {
    const text = buildCalculatorExplanation(LIMB_UNKNOWN);
    expect(text).toContain(
      "Vet-Rate could not tell whether Neuropathy is an arm or a leg condition",
    );
    expect(buildComputedResultBlock(LIMB_UNKNOWN)).toContain(
      "could not tell whether Neuropathy",
    );
  });
});

describe("38 CFR 4.26(d) in the working and the explanation", () => {
  it("shows the disability left out of the group and why", () => {
    const working = formatCalculatorWorking(ONE_REMOVED).join("\n");
    expect(working).toContain("Bilateral group (Left knee and Right knee");
    expect(working).toContain("Left ankle (10%)");
    expect(working).toContain("38 CFR § 4.26(d)");
    expect(working).toContain("Step 3: 72% combined with 10% = 75%");
    const text = buildCalculatorExplanation(ONE_REMOVED);
    expect(text).toContain("Your combined rating is 80%.");
    expect(text).toContain("38 CFR § 4.26(d)");
  });

  it("does not say no pair exists when every bilateral disability was left out", () => {
    const text = buildCalculatorExplanation(ALL_REMOVED);
    expect(text).toContain("Your combined rating is 100%.");
    expect(text).not.toContain("No bilateral pair applies");
    expect(text).toContain("Left knee (10%) and Right knee (10%)");
    expect(text).toContain("38 CFR § 4.26(d)");
    const block = buildComputedResultBlock(ALL_REMOVED);
    expect(block).toContain("Bilateral pair: none");
    expect(block).toContain("38 CFR § 4.26(d)");
  });

  it("does not treat a disability left out under (d) as an invented pairing", () => {
    expect(
      findInventedBilateralClaims(
        "Left knee, Left ankle and Right knee are bilateral disabilities.",
        ONE_REMOVED,
      ),
    ).toEqual([]);
    expect(
      findInventedBilateralClaims(
        "Left knee and Right knee are a bilateral pair.",
        ALL_REMOVED,
      ),
    ).toEqual([]);
    expect(
      findInventedBilateralClaims(
        "Back and Left knee are a bilateral pair.",
        ALL_REMOVED,
      ),
    ).toHaveLength(1);
  });

  it("does not call it a denial when the answer says no factor applies after (d) removed it", () => {
    expect(
      findDeniedBilateralClaims(
        "The bilateral factor does not apply.",
        ALL_REMOVED,
      ),
    ).toEqual([]);
  });
});

describe("the calculator's own explanation passes its own check", () => {
  it.each([
    ["four extremities", FOUR_LIMBS],
    ["both-sides evaluation with a leg", BOTH_SIDES_WITH_LEG],
    ["both-sides evaluation alone", BOTH_SIDES_ALONE],
    ["one disability removed under (d)", ONE_REMOVED],
    ["every disability removed under (d)", ALL_REMOVED],
    ["an entry of unknown limb", LIMB_UNKNOWN],
    ["two on the left and one on the right", TWO_LEFT_ONE_RIGHT],
    ["two both-sides evaluations", TWO_BOTH_SIDES],
  ])("%s", (_label, calc) => {
    const check = checkRaterResponse(buildCalculatorExplanation(calc), calc);
    expect(check).toMatchObject({
      ok: true,
      wrongFigures: [],
      inventedPairs: [],
      deniedPairs: [],
    });
  });
});
