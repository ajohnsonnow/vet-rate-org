import { describe, it, expect } from "vitest";
import { formatSiloLabel, validateLabelFields } from "../../utils/vsoLabel";

// All values below are invented. The SSN-shaped and file-number-shaped
// strings are obviously fake placeholders.

const ACCEPTED = [
  ["single letter", "J", "CASE-1042"],
  ["four letters", "ABCD", "CASE-1042"],
  ["letters with periods", "J.D.", "CASE-1042"],
  ["three initials with periods", "J.D.S.", "2024-42"],
  ["lowercase initials", "jd", "A1"],
  ["accented initial", "É.L.", "A1"],
  ["accented Latin initials", "ÑÖ", "A1"],
  ["Latin Extended initials", "Ł.Ø.", "A1"],
  ["decomposed accent is normalised", "É", "A1"],
  ["mark with no precomposed form", "Q̈", "A1"],
  ["mark with no precomposed form and a period", "Q̈.D.", "A1"],
  ["base letter with two marks", "ệ", "A1"],
  ["hyphenated initials", "J.-P.", "A1"],
  ["hyphenated initials, second without period", "J.-P", "A1"],
  ["hyphenated accented initials", "É.-Q̈.", "A1"],
  ["hyphenated three initials", "J.-P.L.", "A1"],
  ["case ref with every allowed symbol", "JD", "A-b_c/d#e.f 1"],
  ["case ref at 24 characters", "JD", "A".repeat(24)],
  ["surrounding whitespace is trimmed", "  JD  ", "  CASE 7  "],
  ["6 digits in a row", "JD", "CASE 123456"],
  ["6 digits with separators", "JD", "12-34-56"],
  ["6 digits split by letters", "JD", "A123 B456"],
  ["year-sequence case number", "JD", "2024-42"],
  ["digits and a hash reference", "JD", "#12-34-56"],
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
  ["double hyphen in initials", "J.--P.", "CASE-1", "initials", "format"],
  ["leading hyphen in initials", "-J.", "CASE-1", "initials", "format"],
  ["trailing hyphen in initials", "J.-", "CASE-1", "initials", "format"],
  ["two hyphens in initials", "J.-P.-L.", "CASE-1", "initials", "format"],
  [
    "hyphen after a period, five letters",
    "J.-ABCD",
    "CASE-1",
    "initials",
    "format",
  ],
  ["combining mark first", "́J", "CASE-1", "initials", "format"],
  ["combining mark after a period", "J.́", "CASE-1", "initials", "format"],
  [
    "more than three marks left after composing",
    "é́́́́",
    "CASE-1",
    "initials",
    "format",
  ],
  ["a mark on a digit", "1́", "CASE-1", "initials", "format"],
  ["a mark on a CJK numeral", "一́", "CASE-1", "initials", "format"],
  ["a mark on a Cyrillic letter", "А́", "CASE-1", "initials", "format"],
  ["a mark on a Roman numeral code point", "ↀ́", "CASE-1", "initials", "format"],
  ["hyphenated non-Latin", "J.-А.", "CASE-1", "initials", "format"],
  ["five letters with marks", "ÁB́ĆD́É", "CASE-1", "initials", "format"],
  [
    "nine combining digits over three letters",
    "J\uA8E1\uA8E2\uA8E3D\uA8E4\uA8E5\uA8E6S\uA8E7\uA8E8\uA8E9",
    "CASE-1",
    "initials",
    "format",
  ],
  ["a combining Grantha digit", "J\u{11366}", "CASE-1", "initials", "format"],
  ["a combining Latin letter", "S\u036B", "CASE-1", "initials", "format"],
  ["a combining Cyrillic letter", "J\u2DE0", "CASE-1", "initials", "format"],
  ["an enclosing keycap", "J\u20E3", "CASE-1", "initials", "format"],
  ["an enclosing circle", "J\u20DD", "CASE-1", "initials", "format"],
  ["a variation selector", "J\uFE0F", "CASE-1", "initials", "format"],
  ["a grapheme joiner", "J\u034F", "CASE-1", "initials", "format"],
  ["a Greek combining mark", "J\u0345", "CASE-1", "initials", "format"],
  ["a Hebrew point", "J\u05B4", "CASE-1", "initials", "format"],
  ["a spacing mark", "J\u0903", "CASE-1", "initials", "format"],
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
  ["9-digit number", "JD", "000000000", "caseRef", "ssn"],
  [
    "C-prefixed 8-digit file number",
    "JD",
    "C12345678",
    "caseRef",
    "file-number",
  ],
  ["C-prefixed 9-digit number", "JD", "C123456789", "caseRef", "ssn"],
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
  ["SSN with hash separators", "JD", "123#45#6789", "caseRef", "ssn"],
  ["SSN with mixed separators 2", "JD", "123-45.6789", "caseRef", "ssn"],
  ["SSN with repeated separators", "JD", "123--45__6789", "caseRef", "ssn"],
  ["SSN with multiple spaces", "JD", "123   45   6789", "caseRef", "ssn"],
  ["SSN with every digit spaced", "JD", "1 2 3 4 5 6 7 8 9", "caseRef", "ssn"],
  ["SSN with every digit dotted", "JD", "1.2.3.4.5.6.7.8.9", "caseRef", "ssn"],
  ["SSN split by letters", "JD", "123 AB 45 CD 6789", "caseRef", "ssn"],
  [
    "SSN with surrounding whitespace",
    "  JD  ",
    "  123-45-6789  ",
    "caseRef",
    "ssn",
  ],
  ["SSN in fullwidth digits", "JD", "１２３-４５-６７８９", "caseRef", "ssn"],
  ["SSN in Arabic-Indic digits", "JD", "١٢٣٤٥٦٧٨٩", "caseRef", "ssn"],
  [
    "SSN with a zero-width space",
    "JD",
    "123\u200b45\u200b6789",
    "caseRef",
    "ssn",
  ],
  [
    "SSN with a zero-width space (format)",
    "JD",
    "123\u200b456789",
    "caseRef",
    "format",
  ],
  ["SSN with a soft hyphen", "JD", "123\u00ad45\u00ad6789", "caseRef", "ssn"],
  [
    "SSN with a no-break space",
    "JD",
    "123\u00a045\u00a06789",
    "caseRef",
    "ssn",
  ],
  ["file number with separators", "JD", "1234-5678", "caseRef", "file-number"],
  ["file number with dots", "JD", "12.34.56/78", "caseRef", "file-number"],
  [
    "C-prefixed file number with spaces",
    "JD",
    "C 1234 5678",
    "caseRef",
    "file-number",
  ],
  [
    "lowercase c-prefixed with hyphen",
    "JD",
    "c-1234-5678",
    "caseRef",
    "file-number",
  ],
  [
    "C-prefixed file number with slashes",
    "JD",
    "C/12/34/56/78",
    "caseRef",
    "file-number",
  ],
  ["8 digits as a date", "JD", "2024-12-31", "caseRef", "file-number"],
  [
    "identifier split across both fields",
    "JD1234",
    "5678",
    "caseRef",
    "file-number",
  ],
  ["7-digit file number", "JD", "1234567", "caseRef", "file-number"],
  [
    "C-prefixed 7-digit file number",
    "JD",
    "C1234567",
    "caseRef",
    "file-number",
  ],
  ["7 digits with hyphens", "JD", "123-45-67", "caseRef", "file-number"],
  ["7 digits with spaces", "JD", "123 45 67", "caseRef", "file-number"],
  ["7 digits with dots", "JD", "12.34.567", "caseRef", "file-number"],
  ["7 digits with slashes", "JD", "1/2/3/4/5/6/7", "caseRef", "file-number"],
  ["7 digits with underscores", "JD", "123_45_67", "caseRef", "file-number"],
  ["7 digits with hash", "JD", "123#45#67", "caseRef", "file-number"],
  ["7 digits split by letters", "JD", "A1234 B567", "caseRef", "file-number"],
  ["7 digits in fullwidth", "JD", "１２３４５６７", "caseRef", "file-number"],
  ["7 digits in Arabic-Indic", "JD", "١٢٣٤٥٦٧", "caseRef", "file-number"],
  [
    "7 digits with a zero-width space",
    "JD",
    "123\u200b4567",
    "caseRef",
    "file-number",
  ],
  [
    "7 digits with a soft hyphen",
    "JD",
    "123\u00ad45\u00ad67",
    "caseRef",
    "file-number",
  ],
  [
    "7 digits with a no-break space",
    "JD",
    "123\u00a045\u00a067",
    "caseRef",
    "file-number",
  ],
  ["7 digits across both fields", "JD123", "4567", "caseRef", "file-number"],
  [
    "7 digits, 6 in one field and 1 in the other",
    "JD1",
    "234567",
    "caseRef",
    "file-number",
  ],
  ["8 digits across both fields", "JD1234", "5678", "caseRef", "file-number"],
  ["9 digits across both fields", "JD12345", "6789", "caseRef", "ssn"],
  ["7 digits in initials", "C1234567", "CASE-1", "initials", "file-number"],
  ["initials: CJK numerals", "一二", "CASE-1", "initials", "format"],
  ["initials: CJK numeral three", "三", "CASE-1", "initials", "format"],
  ["initials: CJK numeral ten", "十", "CASE-1", "initials", "format"],
  [
    "initials: Roman numeral thousand",
    "\u2180",
    "CASE-1",
    "initials",
    "format",
  ],
  [
    "initials: Roman numeral five thousand",
    "\u2181",
    "CASE-1",
    "initials",
    "format",
  ],
  [
    "initials: Cyrillic look-alikes",
    "\u0410\u0412",
    "CASE-1",
    "initials",
    "format",
  ],
  [
    "initials: Greek look-alikes",
    "\u0391\u0392",
    "CASE-1",
    "initials",
    "format",
  ],
  [
    "initials: mixed Latin and Cyrillic",
    "J\u0410",
    "CASE-1",
    "initials",
    "format",
  ],
  ["initials: Hebrew letter", "\u05d0", "CASE-1", "initials", "format"],
  ["digit lookalike in initials", "１２３４", "56789012", "initials", "format"],
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

  it.each([
    ["null", null],
    ["a string", "JD"],
    ["a number", 7],
    ["an array", []],
  ])("returns required errors, not a TypeError, for %s", (_n, input) => {
    const result = validateLabelFields(input);
    expect(result.ok).toBe(false);
    expect(result.value).toBeNull();
    expect(result.errors.map((e) => e.code)).toEqual(["required", "required"]);
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
