import { describe, it, expect } from "vitest";
import {
  calculateVARating,
  checkBilateralFactorCompliance,
} from "../../utils/vaCalculator";

const pasted = (name, rating) => ({
  name,
  rating,
  side: "none",
  bodyPart: "other",
});
const entry = (name, rating, side, bodyPart = "other") => ({
  name,
  rating,
  side,
  bodyPart,
});
const reasons = (result) =>
  result.bilateralIssues.map((issue) => [issue.name, issue.reason]);
const FLAT = "No bilateral factor applies to these ratings";

const expectReported = (list, expected) => {
  const result = calculateVARating(list);
  expect(result.bilateralFactor).toBe(0);
  expect(reasons(result)).toEqual(expected);
  const check = checkBilateralFactorCompliance(list);
  expect(check.applicable).toBe(false);
  expect(check.message).not.toContain(FLAT);
  expect(check.message).toContain("could not");
  expect(check.message).toMatch(/check/i);
  for (const [name] of expected) expect(check.message).toContain(name);
  return result;
};

describe("pasted entries with no side set are reported even when the name is not on the allowlist", () => {
  it("pasted left and right knee pain 10 + 10 with PTSD 30 give 37, 43, then 40, both reported", () => {
    const result = expectReported(
      [
        pasted("Left knee pain", 10),
        pasted("Right knee pain", 10),
        pasted("PTSD", 30),
      ],
      [
        ["Left knee pain", "side-not-set"],
        ["Right knee pain", "side-not-set"],
      ],
    );
    expect(result.rawScore).toBe(43);
    expect(result.combinedRating).toBe(40);
  });

  it("pasted diabetic neuropathy of each leg 20 + 20 with diabetes 20 give 36, 49, then 50, both reported", () => {
    const result = expectReported(
      [
        pasted("Diabetic peripheral neuropathy, left lower extremity", 20),
        pasted("Diabetic peripheral neuropathy, right lower extremity", 20),
        pasted("Diabetes mellitus type II", 20),
      ],
      [
        [
          "Diabetic peripheral neuropathy, left lower extremity",
          "side-not-set",
        ],
        [
          "Diabetic peripheral neuropathy, right lower extremity",
          "side-not-set",
        ],
      ],
    );
    expect(result.rawScore).toBe(49);
  });

  it("a sided left knee next to a pasted right knee strain: 10 + 10 give 19, the pasted one reported", () => {
    const result = expectReported(
      [entry("Left knee pain", 10, "left"), pasted("Right knee strain", 10)],
      [["Right knee strain", "side-not-set"]],
    );
    expect(result.rawScore).toBe(19);
  });

  it("a form entry (Knee, left) next to a pasted right knee: 10 + 10 give 19, the pasted one reported", () => {
    const result = expectReported(
      [
        entry("Left knee pain", 10, "left", "knee"),
        pasted("Right knee strain", 10),
      ],
      [["Right knee strain", "side-not-set"]],
    );
    expect(result.rawScore).toBe(19);
  });

  it("a name the allowlist rejects is still reported when no side is set: 10 + 10 give 19", () => {
    const result = expectReported(
      [
        pasted("Chronic left knee instability with giving way", 10),
        entry("Right knee", 10, "right", "knee"),
      ],
      [["Chronic left knee instability with giving way", "side-not-set"]],
    );
    expect(result.rawScore).toBe(19);
  });
});

describe("sided entries whose limb the calculator would not read are reported", () => {
  it("body part Back with a name that names the left leg, next to a right knee: 20 + 20 give 36", () => {
    const result = expectReported(
      [
        entry("Left leg radiculopathy", 20, "left", "back"),
        entry("Right knee", 20, "right", "knee"),
      ],
      [["Left leg radiculopathy", "limb-unknown"]],
    );
    expect(result.rawScore).toBe(36);
  });

  it("body part Skin with a name that names the left knee, next to a right knee: 20 + 20 give 36", () => {
    const result = expectReported(
      [
        entry("Scar, left knee", 20, "left", "skin"),
        entry("Right knee", 20, "right", "knee"),
      ],
      [["Scar, left knee", "limb-unknown"]],
    );
    expect(result.rawScore).toBe(36);
  });

  it("a name in another language with a side set, next to a right knee: 20 + 20 give 36", () => {
    const result = expectReported(
      [
        entry("Rodilla izquierda, esguince", 20, "left"),
        entry("Right knee", 20, "right", "knee"),
      ],
      [["Rodilla izquierda, esguince", "limb-unknown"]],
    );
    expect(result.rawScore).toBe(36);
  });
});

describe("entries that could not pair are not reported", () => {
  it.each([
    ["nothing else", [pasted("Left knee pain", 10), pasted("PTSD", 30)]],
    [
      "only the same side",
      [pasted("Left knee pain", 10), pasted("Left ankle pain", 10)],
    ],
    [
      "only the other limb",
      [pasted("Left knee pain", 10), pasted("Right shoulder pain", 10)],
    ],
    [
      "a non-compensable partner",
      [pasted("Left knee pain", 10), pasted("Right knee pain", 0)],
    ],
    [
      "an explicit not-a-limb",
      [
        { ...entry("Scar, left knee", 20, "left"), limb: "none" },
        entry("Right knee", 20, "right", "knee"),
      ],
    ],
    [
      "no limb word and a non-limb body part",
      [
        entry("Left ear hearing loss", 10, "left", "ear"),
        entry("Right knee", 20, "right", "knee"),
      ],
    ],
  ])("%s", (_label, list) => {
    expect(calculateVARating(list).bilateralIssues).toEqual([]);
  });

  it("a formed pair is not reported: form entry left knee + form entry right knee give 19, plus 1.9 is 21", () => {
    const result = calculateVARating([
      entry("Left knee pain", 10, "left", "knee"),
      entry("Right knee", 10, "right", "knee"),
    ]);
    expect(result.bilateralGroupRating).toBe(21);
    expect(result.bilateralIssues).toEqual([]);
  });
});

describe("the compliance check with reported entries", () => {
  it("lists every reported entry, whatever its reason", () => {
    const check = checkBilateralFactorCompliance([
      pasted("Left knee pain", 10),
      entry("Right knee, odd side", 10, "rgt", "knee"),
      entry("Rodilla izquierda", 10, "left"),
      entry("Right ankle", 10, "right", "ankle"),
    ]);
    expect(check.applicable).toBe(false);
    expect(check.message).not.toContain(FLAT);
    for (const name of [
      "Left knee pain",
      "Right knee, odd side",
      "Rodilla izquierda",
    ]) {
      expect(check.message).toContain(name);
    }
  });

  it("keeps the flat message when nothing is reported", () => {
    const check = checkBilateralFactorCompliance([pasted("PTSD", 50)]);
    expect(check.message).toContain(FLAT);
  });
});
