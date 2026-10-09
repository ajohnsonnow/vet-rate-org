import { describe, it, expect } from "vitest";
import { calculateVARating, combineTwoRatings } from "../../utils/vaCalculator";

const c = (name, rating, side = "none", bodyPart = "other") => ({
  name,
  rating,
  side,
  bodyPart,
});

// Rows copied from 38 CFR 4.25 Table I as held in the eCFR legal index
// (public/legal-index/v0.1.0/chunks/ecfr.jsonl, id ecfr_38_CFR_§_4.25_3).
// Columns are the second rating: 10, 20, 30, 40, 50, 60, 70, 80, 90.
const TABLE_I_ROWS = {
  19: [27, 35, 43, 51, 60, 68, 76, 84, 92],
  25: [33, 40, 48, 55, 63, 70, 78, 85, 93],
  35: [42, 48, 55, 61, 68, 74, 81, 87, 94],
  45: [51, 56, 62, 67, 73, 78, 84, 89, 95],
  55: [60, 64, 69, 73, 78, 82, 87, 91, 96],
  57: [61, 66, 70, 74, 79, 83, 87, 91, 96],
  65: [69, 72, 76, 79, 83, 86, 90, 93, 97],
  75: [78, 80, 83, 85, 88, 90, 93, 95, 98],
  85: [87, 88, 90, 91, 93, 94, 96, 97, 99],
  94: [95, 95, 96, 96, 97, 98, 98, 99, 99],
};

const integerReference = (a, b) =>
  Number((BigInt(a) * 100n + BigInt(b) * BigInt(100 - a) + 50n) / 100n);

describe("combineTwoRatings matches 38 CFR 4.25 Table I", () => {
  it("57 combined with 50 is 79, not 78", () => {
    expect(combineTwoRatings(57, 50)).toBe(79);
  });

  it("reproduces the rows of Table I in the legal index", () => {
    for (const [row, cells] of Object.entries(TABLE_I_ROWS)) {
      cells.forEach((expected, i) => {
        expect([
          row,
          (i + 1) * 10,
          combineTwoRatings(Number(row), (i + 1) * 10),
        ]).toEqual([row, (i + 1) * 10, expected]);
      });
    }
  });

  it("equals exact integer arithmetic, half rounded up, for every whole a and b from 0 to 100", () => {
    const wrong = [];
    for (let a = 0; a <= 100; a++) {
      for (let b = 0; b <= 100; b++) {
        const got = combineTwoRatings(a, b);
        if (got !== integerReference(a, b)) wrong.push([a, b, got]);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("L knee 40 + R knee 20 give 52, plus 5.2 is 57; with 50, 20, 10 gives 79, 83, 85, then 90", () => {
    const result = calculateVARating([
      c("Left knee", 40, "left", "knee"),
      c("Right knee", 20, "right", "knee"),
      c("PTSD", 50, "none", "mental"),
      c("Back", 20, "none", "back"),
      c("Tinnitus", 10, "none", "ear"),
    ]);
    expect(result.bilateralGroupRating).toBe(57);
    expect(result.combineSteps.map((s) => s.result)).toEqual([52, 79, 83, 85]);
    expect(result.combinedRating).toBe(90);
  });
});
