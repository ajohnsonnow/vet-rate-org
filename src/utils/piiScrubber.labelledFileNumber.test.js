/**
 * A labelled VA file or claim number of 7 to 9 digits is scrubbed whatever
 * the label's spelling, the separator, the line break between label and
 * number, or the "C" prefix style. The rule stays anchored to the label: a
 * bare 7-digit run, an amount, a phone fragment, a citation, a date, a page
 * or form number is never taken for a file number.
 *
 * Fixture identifiers are synthetic.
 */
import { describe, it, expect } from "vitest";
import { scrubPII } from "./piiScrubber";

const DIGITS = ["1234567", "23456789", "345678901"];
const MODES = [false, true];

const LABELS = [
  "File No.",
  "File No",
  "File #",
  "File Number",
  "Claim No.",
  "Claim #",
  "Claim Number",
  "C-File",
  "C-File No.",
  "C File",
  "VA File No",
  "VA File Number",
  "In reply refer to",
  "In Reply Refer To",
  "FILE NO.",
  "FILE NUMBER",
  "CLAIM NUMBER",
];

const SEPARATORS = [
  " ",
  "  ",
  ": ",
  " : ",
  " :",
  ":",
  "- ",
  " - ",
  " -",
  "= ",
  " = ",
  "=",
  "\n",
  "\r\n",
  "\n\n",
  "\r\n\r\n",
  " \n",
  ":\n",
  ":\r\n",
  ": \r\n\r\n",
  "\n  ",
];

const C_PREFIXES = ["C", "C ", "C  ", "C-", "C–", "C—", "C.", "C - ", "c-"];

function scrubbed(text, aggressive) {
  return scrubPII(text, { aggressive });
}

describe("labelled 7 to 9 digit file numbers are scrubbed", () => {
  it.each(LABELS)("label %j with every separator and length", (label) => {
    for (const aggressive of MODES) {
      for (const sep of SEPARATORS) {
        for (const digits of DIGITS) {
          const input = `Details\n${label}${sep}${digits}\nEnd of record.`;
          const result = scrubbed(input, aggressive);
          expect(result.scrubbedText, JSON.stringify(input)).not.toContain(
            digits,
          );
          expect(result.piiFound, JSON.stringify(input)).toBe(true);
        }
      }
    }
  });

  it.each(["File No.", "Claim #", "C-File No.", "In reply refer to"])(
    "label %j with every C prefix style",
    (label) => {
      for (const aggressive of MODES) {
        for (const prefix of C_PREFIXES) {
          for (const digits of DIGITS) {
            const input = `${label}: ${prefix}${digits} filed.`;
            const result = scrubbed(input, aggressive);
            expect(result.scrubbedText, JSON.stringify(input)).not.toContain(
              digits,
            );
          }
        }
      }
    },
  );

  it("keeps the label so the line still reads as a field", () => {
    const { scrubbedText } = scrubbed("File #: 1234567", false);
    expect(scrubbedText).toMatch(/^File #:\s*\[REDACTED/);
  });

  it("scrubs the number on the line after a CRLF label line", () => {
    const { scrubbedText } = scrubbed(
      "Claim No.\r\n\r\n 1234567\r\nNext",
      false,
    );
    expect(scrubbedText).not.toContain("1234567");
    expect(scrubbedText).toContain("Next");
  });

  it("scrubs a re-grouped 8 or 9 digit number after a new label", () => {
    for (const text of ["File #: 12 345 678", "Claim No. 123-456-789"]) {
      expect(scrubbed(text, false).scrubbedText).not.toMatch(/\d{2}[ -]\d/);
    }
  });
});

describe("labelled-number rules stay anchored to the label", () => {
  it.each([
    "Reference 1234567.",
    "Awarded $1234567 in back pay",
    "Total of 1234567 records",
    "Page 1234567",
    "Page 1234567 of 9999999",
    "Pub. L. 117-168 section 1234567",
    "Call the clinic at 555-1234 today",
    "Call 555 1234567 x",
    "38 CFR 4.130, diagnostic code 9411",
    "Rated under DC 9411 from 2019-03-15",
    "Seen on 2019-03-15 and again 2020-04-16",
    "See VA Form 21-526EZ and VA Form 21-0966",
    "VA Form 21-526EZ 1234567",
    "File 13 is where the old paperwork went",
    "File 1234567 was moved",
    "He chose to file now rather than later",
    "The file no longer applies",
    "Claim number of conditions: 3",
    "File No. of pages: 12",
    "Claim # of items 4",
    "The C-file 1234 pages long",
    "C-File shows 2019 entries",
    "Please refer to the attached 1234567",
    "In reply refer to the attached letter 1234567",
    "In reply refer to the letter",
    "PROFILE NO. is not a label",
    "Claim #1234567890123",
  ])("leaves %j intact", (text) => {
    for (const aggressive of MODES) {
      expect(scrubbed(text, aggressive).scrubbedText).toBe(text);
    }
  });

  it("does not scrub the digits of a longer run after a label", () => {
    const { scrubbedText } = scrubbed("File #: 12345678901234", false);
    expect(scrubbedText).toContain("12345678901234");
  });
});

describe("a C before 7 digits is not taken for a file number after an obvious non-identifier", () => {
  it.each([
    "Vitamin C 1234567 units",
    "vitamin c 1234567 units",
    "Hepatitis C 1234567 copies",
    "Hepatitis-C 1234567 copies",
    "Genotype C 1234567",
    "Group C 1234567",
    "Class C 1234567",
  ])("leaves %j intact", (text) => {
    for (const aggressive of MODES) {
      expect(scrubbed(text, aggressive).scrubbedText).toBe(text);
    }
  });

  it("leaves a C and 8 digits after Vitamin alone outside aggressive mode", () => {
    const text = "Vitamin C 23456789 units";
    expect(scrubbed(text, false).scrubbedText).toBe(text);
  });

  it.each([
    "Hepatitis C23456789 on file",
    "Hepatitis C 23 456 789",
    "Type C-345678901",
    "Part C 345 678 901",
    "vit C23456789",
  ])("aggressive mode still scrubs 8 and 9 digits in %j", (text) => {
    expect(scrubbed(text, true).scrubbedText).not.toMatch(/\d{2}/);
  });

  it.each([
    "Your file is C1234567 as of today",
    "Veteran C-1234567 appeared",
    "Vitamin D and then C1234567",
    "Seen for hepatitis. C1234567 is the file.",
    "Hepatitis\nC 1234567",
  ])("still scrubs a real file number in %j", (text) => {
    expect(scrubbed(text, false).scrubbedText).not.toContain("1234567");
  });
});

describe("label rules stay linear on pathological input", () => {
  const long = 50000;
  it.each([
    ["repeated labels", "File No. ".repeat(long / 9)],
    ["label then spaces", `File No.${" ".repeat(long)}1`],
    ["label then newlines", `Claim #${"\n".repeat(long)}1234567`],
    ["label then blank CRLF lines", `Claim #${"\r\n".repeat(long / 2)}1234567`],
    ["label, space-newline pairs", `File #${" \n".repeat(long / 2)}1234567`],
    ["C-File repeated", "C-File ".repeat(long / 7)],
    ["Cs", "C".repeat(long)],
    ["C then dashes", `File #: C${"-".repeat(long)}1234567`],
    ["C then spaces", `File #: C${" ".repeat(long)}1234567`],
    ["digits and spaces", `File #: ${"1 ".repeat(long / 2)}`],
    ["In reply repeated", "In reply refer to: ".repeat(long / 19)],
    ["VA repeated", "VA ".repeat(long / 3) + "File No."],
    ["Vitamin C repeated", "Vitamin C ".repeat(long / 10)],
    ["Vitamin spaces C digits", `Vitamin${" ".repeat(long)}C 1234567`],
    ["many file numbers on one line", "C1234567 ".repeat(40000)],
    ["many Vitamin C numbers on one line", "Vitamin C 1234567 ".repeat(20000)],
  ])("%s", (_name, input) => {
    const start = performance.now();
    scrubPII(input);
    scrubPII(input, { aggressive: true });
    expect(performance.now() - start).toBeLessThan(2000);
  });
});
