/**
 * D15-1 (final15 QA review, 2026-09-28): the veteran's mailing city/state/
 * ZIP reaches cloud AI request bodies from raw claim-letter text, because
 * the address is never stored anywhere the app can compare against (so
 * `redactKnownValues` has nothing to match) AND `scrubPII`'s pattern-based
 * `address` regex only ever matched the street line, never the "CITY, ST
 * 12345" line, an APO/FPO/DPO form, or a bare ZIP+4.
 *
 * Covers:
 *  - D15-1a: the full US address block (street incl. APT/UNIT/PO Box,
 *    city/state/ZIP with/without comma and 2-letter-or-full state name,
 *    APO/FPO/DPO, bare ZIP+4).
 *  - D15-1b: label-anchored first-mention protection for DD-214/NGB-22 box
 *    labels and a VA letter's addressee block + file/claim number line -
 *    protects a value the app has never seen before (no known-value match
 *    possible), unlike redactKnownValues.
 *  - D15-1c: "C"-prefixed VA file numbers with internal digit-grouping
 *    separators, and accent-insensitive known-name-token matching.
 *
 * Fixture identifiers are synthetic.
 */
import { describe, it, expect } from "vitest";
import {
  scrubPII,
  scrubText,
  redactLabeledBoxValues,
  redactLetterAddresseeBlock,
  redactKnownValues,
} from "./piiScrubber";

describe("D15-1a: full US address block redaction (aggressive)", () => {
  it.each([
    [
      "city/state/ZIP with a comma and 2-letter state",
      "Mail to: Anytown, CA 90210 please.",
      ["Anytown", "90210"],
    ],
    [
      "city/state/ZIP without a comma",
      "Springfield IL 62704 is the mailing city.",
      ["Springfield", "62704"],
    ],
    [
      "city/state/ZIP with a full state name and ZIP+4",
      "Anytown, California 90210-1234 on file.",
      ["Anytown", "90210"],
    ],
    [
      "a multi-word full state name (New York)",
      "Buffalo, New York 14201 mailing address.",
      ["Buffalo", "14201"],
    ],
    [
      "a street line with an APT/UNIT suffix as one block",
      "123 Main St, Apt 4B is the address.",
      ["Main St", "4B"],
    ],
    [
      "a military overseas address (APO/FPO/DPO)",
      "Unit 2100 Box 4100, APO AE 09001 was the duty address.",
      ["09001"],
    ],
    [
      "a bare ZIP+4 with no surrounding city/state text",
      "ZIP on file: 20500-0003.",
      ["20500-0003"],
    ],
  ])("redacts %s", (_label, text, mustNotContain) => {
    const { scrubbedText } = scrubPII(text, { aggressive: true });
    mustNotContain.forEach((token) =>
      expect(scrubbedText).not.toContain(token),
    );
  });

  it("uses the [REDACTED_ADDRESS] marker for the city/state/ZIP case", () => {
    const { scrubbedText } = scrubPII("Mail to: Anytown, CA 90210 please.", {
      aggressive: true,
    });
    expect(scrubbedText).toContain("[REDACTED_ADDRESS]");
  });

  it("scrubText (the egress-boundary helper) forces aggressive and catches the city/state/ZIP line", () => {
    const scrubbed = scrubText("Anytown, CA 90210");
    expect(scrubbed).not.toContain("Anytown");
    expect(scrubbed).not.toContain("90210");
  });

  it("also redacts the address block in non-aggressive mode (owner decision D / ADR-008 §2.6: the address is protected regardless of provider, unlike the bare-DOB/bare-SSN catchalls, which stay aggressive-only to preserve on-device service/exam dates)", () => {
    const text = "Anytown, CA 90210";
    const { scrubbedText } = scrubPII(text, { aggressive: false });
    expect(scrubbedText).not.toContain("Anytown");
    expect(scrubbedText).not.toContain("90210");
    expect(scrubbedText).toContain("[REDACTED_ADDRESS]");
  });
});

describe("D15-1b: label-anchored first-mention protection (no known-value match required)", () => {
  it.each([
    [
      "Block 1 NAME",
      "1. NAME (Last, First, Middle): SMITH, JOHN Q\n2. DEPARTMENT: ARMY",
      "SMITH, JOHN Q",
      "1. NAME",
    ],
    [
      "Block 3 SSN",
      "3. SOCIAL SECURITY NUMBER: 123-45-6789",
      "123-45-6789",
      "3. SOCIAL SECURITY NUMBER",
    ],
    [
      "Block 5 DATE OF BIRTH",
      "5. DATE OF BIRTH: 1984-03-15",
      "1984-03-15",
      "5. DATE OF BIRTH",
    ],
    [
      "Block 7B HOME OF RECORD",
      "7B. HOME OF RECORD AT TIME OF ENTRY: ANYTOWN, CA",
      "ANYTOWN, CA",
      "HOME OF RECORD",
    ],
  ])(
    "redacts a DD-214 %s value, keeping the label",
    (_label, text, value, label) => {
      const redacted = redactLabeledBoxValues(text);
      expect(redacted).not.toContain(value);
      expect(redacted).toContain(label);
    },
  );

  it("redacts a mailing address value under either Block 19 or Block 30 numbering", () => {
    const t19 =
      "BLOCK 19. MAILING ADDRESS AFTER SEPARATION: 123 MAIN ST, ANYTOWN CA 90210";
    const t30 = "30. HOME ADDRESS: 123 MAIN ST, ANYTOWN CA 90210";
    expect(redactLabeledBoxValues(t19)).not.toContain("123 MAIN ST");
    expect(redactLabeledBoxValues(t30)).not.toContain("123 MAIN ST");
  });

  it("redacts a VA FILE NUMBER / CLAIM NUMBER labeled value, keeping the label", () => {
    const text = "VA FILE NUMBER: C12345678\nCLAIM NUMBER: 987654321";
    const redacted = redactLabeledBoxValues(text);
    expect(redacted).not.toContain("C12345678");
    expect(redacted).not.toContain("987654321");
    expect(redacted).toContain("VA FILE NUMBER");
    expect(redacted).toContain("CLAIM NUMBER");
  });

  it("is a safe no-op on text with no recognized label", () => {
    const text = "This document has no box labels at all.";
    expect(redactLabeledBoxValues(text)).toBe(text);
  });

  it("scrubPII applies label-anchored redaction unconditionally (not aggressive-gated)", () => {
    const text = "1. NAME: DOE, JANE";
    const { scrubbedText, piiFound } = scrubPII(text, { aggressive: false });
    expect(scrubbedText).not.toContain("DOE, JANE");
    expect(piiFound).toBe(true);
  });
});

describe("D15-1b: VA letter addressee block redaction", () => {
  it("redacts the name/address lines between the letter date and the salutation", () => {
    const text = [
      "DEPARTMENT OF VETERANS AFFAIRS",
      "In Reply Refer To: 211/21",
      "March 15, 2024",
      "",
      "JOHN Q PUBLIC",
      "123 MAIN ST",
      "ANYTOWN ST 12345",
      "",
      "Dear Veteran:",
      "",
      "This letter is about your claim.",
    ].join("\n");

    const redacted = redactLetterAddresseeBlock(text);
    expect(redacted).not.toContain("JOHN Q PUBLIC");
    expect(redacted).not.toContain("123 MAIN ST");
    expect(redacted).not.toContain("ANYTOWN ST 12345");
    expect(redacted).toContain("March 15, 2024");
    expect(redacted).toContain("Dear Veteran:");
    expect(redacted).toContain("This letter is about your claim.");
  });

  it("falls back to the 'In Reply Refer To' line when no date line is found", () => {
    const text = [
      "In Reply Refer To: 211/21",
      "JOHN Q PUBLIC",
      "123 MAIN ST",
      "Dear Veteran:",
    ].join("\n");
    const redacted = redactLetterAddresseeBlock(text);
    expect(redacted).not.toContain("JOHN Q PUBLIC");
    expect(redacted).not.toContain("123 MAIN ST");
    expect(redacted).toContain("In Reply Refer To: 211/21");
  });

  it("is a safe no-op when no salutation is found", () => {
    const text =
      "March 15, 2024\nJOHN Q PUBLIC\n123 MAIN ST\nNo salutation here.";
    expect(redactLetterAddresseeBlock(text)).toBe(text);
  });

  it("is a safe no-op when the span between anchor and salutation is implausibly long", () => {
    const longBody = "Lorem ipsum filler text. ".repeat(30);
    const text = `March 15, 2024\n${longBody}\nDear Veteran:`;
    expect(redactLetterAddresseeBlock(text)).toBe(text);
  });
});

describe("D15-1c: VA file number digit-grouping variants (pattern-based, always on)", () => {
  // Text is deliberately unlabeled prose (not "File Number: ...") so this
  // exercises ONLY the pattern-based `vaFile` regex - D15-1b's separate
  // label-anchored layer is covered on its own above and would otherwise
  // also fire here, masking which layer actually caught the value.
  it.each([["C12345678"], ["C-12345678"], ["C 12 345 678"]])(
    "redacts %s",
    (form) => {
      const text = `The veteran's number is ${form} per the record.`;
      const { scrubbedText, piiFound, details } = scrubPII(text);
      expect(scrubbedText).not.toContain(form);
      expect(scrubbedText).toContain("[REDACTED_VAFILE]");
      expect(piiFound).toBe(true);
      expect(details.some((d) => d.type === "VA File")).toBe(true);
    },
  );
});

describe("D15-1c: accent-insensitive known-name-token matching", () => {
  it("redacts an unaccented OCR variant of a stored accented name", () => {
    const redacted = redactKnownValues("Patient Jose Martinez reports pain.", [
      { value: "José", accentFold: true },
    ]);
    expect(redacted).not.toContain("Jose");
    expect(redacted).toContain("[REDACTED]");
  });

  it("redacts an accented variant of a stored unaccented name", () => {
    const redacted = redactKnownValues("Patient José Martinez reports pain.", [
      { value: "Jose", accentFold: true },
    ]);
    expect(redacted).not.toContain("José");
    expect(redacted).toContain("[REDACTED]");
  });

  it("still redacts an exact match with no accent difference", () => {
    const redacted = redactKnownValues("Patient Jose Martinez reports pain.", [
      { value: "Jose", accentFold: true },
    ]);
    expect(redacted).not.toContain("Jose");
  });

  it("does not over-redact an unrelated word merely sharing letters", () => {
    const redacted = redactKnownValues("The dose was measured carefully.", [
      { value: "Jose", accentFold: true },
    ]);
    expect(redacted).toContain("dose");
    expect(redacted).not.toContain("[REDACTED]");
  });
});
