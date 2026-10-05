import { describe, it, expect } from "vitest";
import { checkBilateralFactorCompliance } from "../../utils/vaCalculator";

const c = (name, rating, side = "none", bodyPart = "other") => ({
  name,
  rating,
  side,
  bodyPart,
});

describe("checkBilateralFactorCompliance follows the calculator's 38 CFR 4.26 group", () => {
  it("names the group and its arithmetic: knees 10 + 10 give 19, plus 1.9 is 21", () => {
    const check = checkBilateralFactorCompliance([
      c("Left knee", 10, "left", "knee"),
      c("Right knee", 10, "right", "knee"),
      c("Back", 30, "none", "back"),
    ]);
    expect(check.applicable).toBe(true);
    expect(check.pairedParts).toEqual(["Left knee", "Right knee"]);
    expect(check.message).toContain("Left knee and Right knee");
    expect(check.message).toContain("38 CFR § 4.26");
    expect(check.potentialBonus).toContain("19%");
    expect(check.potentialBonus).toContain("1.9");
    expect(check.potentialBonus).toContain("21%");
  });

  it("pairs different parts of opposite legs: right thigh 40 and left foot 10", () => {
    const check = checkBilateralFactorCompliance([
      c("Right thigh amputation", 40, "right", "thigh"),
      c("Left pes planus", 10, "left", "foot"),
    ]);
    expect(check.applicable).toBe(true);
    expect(check.pairedParts).toEqual([
      "Right thigh amputation",
      "Left pes planus",
    ]);
  });

  it.each([
    [
      "an arm and a leg",
      [
        c("Right shoulder", 20, "right", "shoulder"),
        c("Left knee", 20, "left", "knee"),
      ],
    ],
    [
      "a 0% side",
      [c("Left knee", 0, "left", "knee"), c("Right knee", 30, "right", "knee")],
    ],
    [
      "a both-sides rating of a part that is not a limb",
      [
        c("Hearing loss", 30, "bilateral", "ear"),
        c("Left knee", 10, "left", "knee"),
      ],
    ],
    [
      "one both-sides rating by itself",
      [
        c("Bilateral pes planus", 30, "bilateral", "foot"),
        c("Right shoulder", 20, "right", "shoulder"),
      ],
    ],
  ])("does not ask the veteran to verify a factor for %s", (_label, list) => {
    const check = checkBilateralFactorCompliance(list);
    expect(check.applicable).toBe(false);
    expect(check.pairedParts).toEqual([]);
    expect(check.potentialBonus).toBeUndefined();
  });
});

describe("checkBilateralFactorCompliance when it cannot ask for a check", () => {
  it("says no factor is expected when leaving the pair out gives a higher rating (4.26(d))", () => {
    const check = checkBilateralFactorCompliance([
      c("PTSD", 90, "none", "mental"),
      c("Back", 30, "none", "back"),
      c("Left knee", 10, "left", "knee"),
      c("Right knee", 10, "right", "knee"),
    ]);
    expect(check.applicable).toBe(false);
    expect(check.message).toContain("Left knee and Right knee");
    expect(check.message).toContain("38 CFR § 4.26(d)");
  });

  it("says which conditions it could not classify instead of guessing", () => {
    const check = checkBilateralFactorCompliance([
      c("Condition A", 20, "left"),
      c("Condition B", 20, "right"),
    ]);
    expect(check.applicable).toBe(false);
    expect(check.message).toContain("Condition A and Condition B");
    expect(check.message).toMatch(/arm or (a )?leg/);
  });

  it("handles an empty list", () => {
    expect(checkBilateralFactorCompliance([]).applicable).toBe(false);
  });
});
