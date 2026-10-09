/**
 * The bilateral working shows, in the order 38 CFR § 4.26's own example
 * does, the combined value of the pair, the 10 percent added to it, and the
 * result.
 */
import { describe, it, expect } from "vitest";
import { calculateVARating } from "../../utils/vaCalculator";
import { formatCalculatorWorking } from "../../utils/raterGrounding";
import { GOLDEN } from "./recordedAnswers";

const c = (name, rating, side, bodyPart) => ({ name, rating, side, bodyPart });
const groupLines = (conditions) => {
  const lines = formatCalculatorWorking(calculateVARating(conditions));
  const end = lines.findIndex(
    (line) => !line.startsWith("  ") && line !== lines[0],
  );
  return lines.slice(0, end);
};

describe("the bilateral group working", () => {
  it("a12: 10 and 10 give 19, 1.9 is added to make 20.9, which rounds to 21", () => {
    expect(groupLines(GOLDEN.a12.conditions)).toEqual([
      "Bilateral group (Left knee and Right knee, 38 CFR § 4.26):",
      "  10% combined with 10% = 19%",
      "  Bilateral factor: 10% of 19 = 1.9, added to the 19: 19 + 1.9 = 20.9",
      "  Group rating: 20.9 rounds to 21%",
    ]);
  });

  it("rounds a sum below the half down", () => {
    expect(
      groupLines([
        c("Left knee", 30, "left", "knee"),
        c("Right knee", 20, "right", "knee"),
      ]).slice(1),
    ).toEqual([
      "  30% combined with 20% = 44%",
      "  Bilateral factor: 10% of 44 = 4.4, added to the 44: 44 + 4.4 = 48.4",
      "  Group rating: 48.4 rounds to 48%",
    ]);
  });

  it("says nothing about rounding when the sum is a whole number", () => {
    expect(
      groupLines([
        c("Left knee", 50, "left", "knee"),
        c("Right knee", 20, "right", "knee"),
      ]).slice(1),
    ).toEqual([
      "  50% combined with 20% = 60%",
      "  Bilateral factor: 10% of 60 = 6, added to the 60: 60 + 6 = 66",
      "  Group rating: 66%",
    ]);
  });

  it("shows the sum and then the 100% limit when the factor would pass it", () => {
    expect(
      groupLines([
        c("Left knee", 90, "left", "knee"),
        c("Right knee", 50, "right", "knee"),
      ]).slice(1),
    ).toEqual([
      "  90% combined with 50% = 95%",
      "  Bilateral factor: 10% of 95 = 9.5, added to the 95: 95 + 9.5 = 104.5",
      "  Group rating: a rating cannot exceed 100%, so the group rating is 100%",
    ]);
  });
});
