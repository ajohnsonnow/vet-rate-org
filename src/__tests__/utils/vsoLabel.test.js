import { describe, it, expect } from "vitest";
import { formatSiloLabel, validateLabelFields } from "../../utils/vsoLabel";

// All values below are invented. The SSN-shaped and file-number-shaped
// strings are obviously fake placeholders.

const ACCEPTED = [
  ["single letter", "J", "CASE-1042"],
  ["four letters", "ABCD", "CASE-1042"],
  ["letters with periods", "J.D.", "CASE-1042"],
  ["three initials with periods", "J.D.S.", "2024-0042"],
  ["lowercase initials", "jd", "A1"],
  ["accented initial", "É.L.", "A1"],
  ["decomposed accent is normalised", "É", "A1"],
  ["case ref with every allowed symbol", "JD", "A-b_c/d#e.f 1"],
  ["case ref at 24 characters", "JD", "A".repeat(24)],
  ["surrounding whitespace is trimmed", "  JD  ", "  CASE 7  "],
  ["7 digits in a row", "JD", "CASE 1234567"],
  ["digit groups too short for an SSN", "JD", "12-34-567"],
  ["year-sequence case number", "JD", "2024-0042"],
];

const REJECTED = [
  ["empty initials", "", "CASE-1", "initials", "required"],
  ["whitespace-only initials", "   ", "CASE-1", "initials", "required"],
  ["missing initials", undefined, "CASE-1", "initials", "required"],
  ["null initials", null, "CASE-1", "initials", "required"],
  ["numeric initials value", 42, "CASE-1", "initials", "required"],
  ["five letters", "ABCDE", "CASE-1", "initials", "format"],
  ["five letters with periods", "A.B.C.D.E.", "CASE-1", "initials", "format"],
  ["digit in initials", "J1", "CASE-1", "initials", "format"],
  ["space inside initials", "J D", "CASE-1", "initials", "format"],
  ["hyphen in initials", "J-D", "CASE-1", "initials", "format"],
  ["period first", ".J", "CASE-1", "initials", "format"],
  ["double period", "J..D", "CASE-1", "initials", "format"],
  ["only a period", ".", "CASE-1", "initials", "format"],
  ["empty case reference", "JD", "", "caseRef", "required"],
  ["missing case reference", "JD", undefined, "caseRef", "required"],
  ["case ref over 24 characters", "JD", "A".repeat(25), "caseRef", "format"],
  ["disallowed symbol @", "JD", "CASE@1", "caseRef", "format"],
  ["disallowed apostrophe", "JD", "O'NEIL 1", "caseRef", "format"],
  ["disallowed accent in case ref", "JD", "CASE-é", "caseRef", "format"],
  ["newline in case ref", "JD", "CASE\n1", "caseRef", "format"],
  ["SSN with hyphens", "JD", "123-45-6789", "caseRef", "ssn"],
  ["SSN with spaces", "JD", "123 45 6789", "caseRef", "ssn"],
  ["SSN with no separators", "JD", "123456789", "caseRef", "ssn"],
  ["SSN with mixed separators", "JD", "123-45 6789", "caseRef", "ssn"],
  ["SSN with dots", "JD", "123.45.6789", "caseRef", "ssn"],
  ["SSN with slashes", "JD", "123/45/6789", "caseRef", "ssn"],
  ["SSN with underscores", "JD", "123_45_6789", "caseRef", "ssn"],
  ["SSN inside other text", "JD", "CASE 000-00-0000 A", "caseRef", "ssn"],
  ["SSN-shaped value in initials", "123-45-6789", "CASE-1", "initials", "ssn"],
  ["8-digit file number", "JD", "12345678", "caseRef", "file-number"],
  ["9-digit file number", "JD", "000000000", "caseRef", "file-number"],
  [
    "C-prefixed 8-digit file number",
    "JD",
    "C12345678",
    "caseRef",
    "file-number",
  ],
  [
    "C-prefixed 9-digit file number",
    "JD",
    "C123456789",
    "caseRef",
    "file-number",
  ],
  [
    "lowercase c-prefixed file number",
    "JD",
    "c12345678",
    "caseRef",
    "file-number",
  ],
  [
    "file number inside other text",
    "JD",
    "VA C12345678",
    "caseRef",
    "file-number",
  ],
  ["file number in initials", "C12345678", "CASE-1", "initials", "file-number"],
];

describe("validateLabelFields", () => {
  it("covers at least 20 cases", () => {
    expect(ACCEPTED.length + REJECTED.length).toBeGreaterThanOrEqual(20);
  });

  it.each(ACCEPTED)("accepts: %s", (_name, initials, caseRef) => {
    const result = validateLabelFields({ initials, caseRef });
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({
      initials: initials.normalize("NFC").trim(),
      caseRef: caseRef.trim(),
    });
  });

  it.each(REJECTED)("rejects: %s", (_name, initials, caseRef, field, code) => {
    const result = validateLabelFields({ initials, caseRef });
    expect(result.ok).toBe(false);
    expect(result.value).toBeNull();
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field, code }),
    );
  });

  it("reports an SSN-shaped case reference as both ssn and format only when the format is also wrong", () => {
    const hyphenated = validateLabelFields({
      initials: "JD",
      caseRef: "123-45-6789",
    });
    expect(hyphenated.errors.map((e) => e.code)).toEqual(["ssn"]);

    const withBadSymbol = validateLabelFields({
      initials: "JD",
      caseRef: "123-45-6789@",
    });
    expect(withBadSymbol.errors.map((e) => e.code).sort()).toEqual([
      "format",
      "ssn",
    ]);
  });

  it("reports problems in both fields at once", () => {
    const result = validateLabelFields({ initials: "", caseRef: "123456789" });
    expect(result.errors.map((e) => `${e.field}:${e.code}`)).toEqual([
      "initials:required",
      "caseRef:ssn",
      "caseRef:file-number",
    ]);
  });

  it("never echoes the entered text in a message", () => {
    const secrets = ["123-45-6789", "C12345678", "Jane Quincy Roe", "J1@"];
    for (const secret of secrets) {
      for (const input of [
        { initials: secret, caseRef: "CASE-1" },
        { initials: "JD", caseRef: secret },
      ]) {
        const result = validateLabelFields(input);
        for (const entry of [...result.errors, ...result.warnings]) {
          expect(entry.message).not.toContain(secret);
        }
      }
    }
  });

  it("explains why an SSN-shaped value is blocked", () => {
    const { errors } = validateLabelFields({
      initials: "JD",
      caseRef: "123-45-6789",
    });
    expect(errors[0].message).toMatch(/Social Security number/);
    expect(errors[0].message).toMatch(/case number/);
  });

  it("explains why a file-number-shaped value is blocked", () => {
    const { errors } = validateLabelFields({
      initials: "JD",
      caseRef: "C12345678",
    });
    expect(errors[0].message).toMatch(/VA file number/);
  });
});

describe("validateLabelFields name-like warnings", () => {
  it.each([
    ["two capitalised words", "Jane Roe"],
    ["three capitalised words", "Jane Quincy Roe"],
    ["a name beside a number", "Jane Roe 12"],
    ["extra spacing", "Jane   Roe"],
    ["a name after other text", "A1 Jane Roe"],
  ])("warns, without blocking, on a name-like reference: %s", (_n, caseRef) => {
    const result = validateLabelFields({ initials: "JR", caseRef });
    expect(result.ok).toBe(true);
    expect(result.value.caseRef).toBe(caseRef);
    expect(result.warnings).toEqual([
      expect.objectContaining({ field: "caseRef", code: "name-like" }),
    ]);
    expect(result.warnings[0].message).toMatch(/Don't use full names/);
  });

  it.each([
    ["a single capitalised word", "Alpha"],
    ["words separated by a number", "Alpha 12 Beta"],
    ["all-caps words", "TEAM ALPHA"],
    ["lowercase words", "team alpha"],
    ["a case number", "CASE-1042"],
    ["a capital with digits", "Alpha1 Beta2"],
  ])("does not warn on %s", (_n, caseRef) => {
    const result = validateLabelFields({ initials: "JR", caseRef });
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("does not warn when the reference is already rejected", () => {
    const result = validateLabelFields({
      initials: "JR",
      caseRef: "Jane Roe @",
    });
    expect(result.ok).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  it("tolerates being called with no argument", () => {
    const result = validateLabelFields();
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.code)).toEqual(["required", "required"]);
  });
});

describe("formatSiloLabel", () => {
  it("joins initials and case reference with a middle dot", () => {
    expect(formatSiloLabel({ initials: "J.D.", caseRef: "CASE-1" })).toBe(
      "J.D. · CASE-1",
    );
  });
});
