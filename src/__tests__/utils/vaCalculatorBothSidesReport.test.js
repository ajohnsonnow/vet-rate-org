import { describe, it, expect } from "vitest";
import { calculateVARating, sideFromName } from "../../utils/vaCalculator";

const imported = (name, rating) => ({
  name,
  rating,
  side: sideFromName(name),
  bodyPart: "other",
});
const pasted = (name, rating) => ({
  name,
  rating,
  side: "none",
  bodyPart: "other",
});
const form = (name, rating, side, bodyPart) => ({
  name,
  rating,
  side,
  bodyPart,
});
const reported = (result) => result.bilateralIssues.map((i) => i.name);

describe("a both-sides entry outside the group is reported when another limb pair forms the group", () => {
  it("imported bilateral knee strain 40 beside shoulders 20 + 20: shoulders give 36, plus 3.6 is 40; 40 and 40 give 64, then 60, with the knee entry reported", () => {
    const name = "Bilateral knee strain, left worse than right";
    const result = calculateVARating([
      imported(name, 40),
      imported("Left shoulder strain", 20),
      imported("Right shoulder strain", 20),
    ]);
    expect(result.bilateralConditions.map((c) => c.name)).toEqual([
      "Left shoulder strain",
      "Right shoulder strain",
    ]);
    expect(result.rawScore).toBe(64);
    expect(result.combinedRating).toBe(60);
    expect(reported(result)).toEqual([name]);
  });

  it("imported 'Left and right knee strain' 40 beside the same shoulders is reported: 64, then 60", () => {
    const result = calculateVARating([
      imported("Left and right knee strain", 40),
      imported("Left shoulder strain", 20),
      imported("Right shoulder strain", 20),
    ]);
    expect(result.rawScore).toBe(64);
    expect(reported(result)).toEqual(["Left and right knee strain"]);
  });

  it("pasted 'Bilateral knee strain' 40 beside form-entered shoulders is reported: 64, then 60", () => {
    const result = calculateVARating([
      pasted("Bilateral knee strain", 40),
      form("Shoulder (Left)", 20, "left", "shoulder"),
      form("Shoulder (Right)", 20, "right", "shoulder"),
    ]);
    expect(result.rawScore).toBe(64);
    expect(reported(result)).toEqual(["Bilateral knee strain"]);
  });

  it("is reported beside any other sided entry even when no group forms: 40 + 20 give 52", () => {
    const result = calculateVARating([
      pasted("Left and right knee strain", 40),
      form("Shoulder (Left)", 20, "left", "shoulder"),
    ]);
    expect(result.rawScore).toBe(52);
    expect(reported(result)).toEqual(["Left and right knee strain"]);
  });

  it("is not reported alone, or when it is not a limb: 40 + 30 give 58", () => {
    const lone = calculateVARating([
      pasted("Bilateral knee strain", 40),
      pasted("PTSD", 30),
    ]);
    expect(lone.rawScore).toBe(58);
    expect(lone.bilateralIssues).toEqual([]);
    const hearing = calculateVARating([
      pasted("Bilateral hearing loss", 10),
      form("Shoulder (Left)", 20, "left", "shoulder"),
      form("Shoulder (Right)", 20, "right", "shoulder"),
    ]);
    expect(hearing.bilateralIssues).toEqual([]);
  });
});

describe("sideFromName reads a name that says bilateral as bilateral", () => {
  it.each([
    ["Bilateral knee strain, left worse than right", "bilateral"],
    ["Bilateral pes planus", "bilateral"],
    ["Left and right knee strain", "none"],
  ])("%s gives %s", (name, side) => {
    expect(sideFromName(name)).toBe(side);
  });
});
