/**
 * Review round 2: DOB labels and formats the first pass missed, clinical rows
 * that are not SSNs, double-spaced SSNs, and audiogram wording being required
 * before a digit run is spared as an audiogram. Fixtures are synthetic.
 */
import { describe, it, expect } from "vitest";
import { scrubText } from "./piiScrubber";

describe("a labeled DOB is redacted in more label and date shapes", () => {
  it.each([
    "DOB: 15MAR1984",
    "birthdate 1984-03-15",
    "birthday March 15, 1984",
    "born in 1984-03-15",
    "D.O.B 1984/03/15",
    "born on the 15th of March 1984",
    "Birth date: 03/15/1984",
    "DOB 15 MAR 84",
  ])("%s", (text) => {
    const out = scrubText(`Veteran, ${text}, filed a claim.`);
    expect(out).toContain("[REDACTED_DOB]");
    expect(out).not.toMatch(/1984|MAR 84/i);
  });
});

describe("clinical number rows are not SSNs; double-spaced SSNs are", () => {
  it.each([
    "Platelets 250 45 1300 ref",
    "BP 140 90 2019 reading",
    "ROM flexion 110 45 2021 notes",
  ])("leaves %j alone", (row) => {
    expect(scrubText(row)).toBe(row);
  });

  it("redacts an SSN separated by two spaces", () => {
    expect(scrubText("number 123  45  6789 on file")).toBe(
      "number [REDACTED_SSN] on file",
    );
  });

  it("redacts an unlabeled spaced SSN even next to a clinical word", () => {
    expect(scrubText("BP note, SSN 123 45 6789")).toContain("[REDACTED_SSN]");
  });
});

describe("audiogram values are spared only with audiogram context", () => {
  it.each([
    ["a phone made of frequencies", "call me at 250-500-1000"],
    ["a parenthesised phone", "phone (500) 250-4000"],
    ["a spaced SSN made of thresholds", "my social is 100 05 2000"],
    ["a labeled social", "Social: 250 50 1000"],
  ])("redacts %s", (_label, text) => {
    expect(scrubText(text)).toMatch(/\[REDACTED_(?:PHONE|SSN)\]/);
  });

  it("redacts a mistyped card number on a line with audiogram wording", () => {
    expect(scrubText("claim 1234 5678 9012 3456 threshold exam")).toContain(
      "[REDACTED_CC]",
    );
  });

  it("still spares the standard frequency header and a left/right threshold row", () => {
    expect(scrubText("1000 2000 3000 4000")).toBe("1000 2000 3000 4000");
    expect(scrubText("LEFT 500-25-4000")).toBe("LEFT 500-25-4000");
  });
});
