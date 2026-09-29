/**
 * D16-5: defense-in-depth for the shapes the verifier saw leak past
 * piiScrubber.js on the way to an off-device provider - label-on-one-row/
 * value-on-the-next-row (with OCR garbling), OCR-garbled SSNs and emails,
 * all-caps/spelled-out/no-ZIP city-state-zip lines, labeled City:/State:/
 * Zip code: blocks, "Patient: NAME (NNNN)", VA-letter page footers, and
 * salutations with no courtesy title / embedded in a flattened OCR page.
 *
 * Fixture identifiers are synthetic.
 */
import { describe, it, expect } from "vitest";
import {
  scrubText,
  redactSalutationNames,
  redactLetterFooter,
} from "./piiScrubber";

describe("D16-5: label-on-one-row, value-on-the-next (row-split OCR)", () => {
  it.each([
    [
      "SOCIAL SECURITY with a garbled 'NO.' suffix",
      "3. SOCIAL SECURITY.N\n123-45-6789",
      "123-45-6789",
    ],
    [
      "a bare 'SSN' label with no box number",
      "SSN\n123-45-6789",
      "123-45-6789",
    ],
    ["a bare 'DOB' label with no box number", "DOB\n03/15/1984", "03/15/1984"],
    [
      "a bare 'HOME OF RECORD' label with no box number",
      "HOME OF RECORD\nSpringfield, IL",
      "Springfield",
    ],
  ])("redacts the value when %s", (_label, text, valueFragment) => {
    const result = scrubText(text);
    expect(result).not.toContain(valueFragment);
  });
});

describe("D16-5: OCR-garbled SSNs", () => {
  it.each([
    ["O for 0 in the first group", "SSN: O23-45-6789"],
    ["l for 1 across two groups", "SSN: 12l-45-678l"],
  ])("redacts an SSN garbled with %s", (_label, text) => {
    const result = scrubText(text);
    expect(result).toContain("[REDACTED_SSN]");
  });

  it("does not redact an ordinary short alphanumeric run that merely falls into a 3-2-4 shape", () => {
    const text = "The oil-to-fuel ratio was measured across three trials.";
    const result = scrubText(text);
    expect(result).toBe(text);
  });
});

describe("D16-5: OCR-garbled emails", () => {
  it("redacts an email with spaces around @ and the domain dot", () => {
    const result = scrubText("Contact john.smith @ gmail . com for records.");
    expect(result).toContain("[REDACTED_EMAIL]");
    expect(result).not.toContain("gmail");
  });

  it("still redacts a normally-formatted email", () => {
    const result = scrubText("Contact john.smith@gmail.com for records.");
    expect(result).toContain("[REDACTED_EMAIL]");
  });
});

describe("D16-5: cityStateZip is case-insensitive for spelled-out states and tolerates no ZIP", () => {
  it.each([
    [
      "all-caps spelled-out state with ZIP",
      "Mail to ANYTOWN, CALIFORNIA 90210 please.",
    ],
    [
      "lowercase spelled-out state with ZIP",
      "Mail to anytown, california 90210 please.",
    ],
    [
      "spelled-out state with no ZIP at all",
      "He now lives in Anytown, California, near the base.",
    ],
    [
      "2-letter abbreviation with no ZIP",
      "He now lives in Anytown, CA, near the base.",
    ],
  ])("redacts %s", (_label, text) => {
    const result = scrubText(text);
    expect(result).not.toContain("Anytown");
    expect(result).not.toMatch(/anytown/i);
  });

  it("does not redact ordinary prose using a lowercase word that collides with a state abbreviation, when there is no comma/ZIP anchor", () => {
    const text =
      "The results were consistent in or around the treatment window.";
    const result = scrubText(text);
    expect(result).toBe(text);
  });
});

describe("D16-5: labeled City:/State:/Zip code: blocks", () => {
  it("redacts each labeled field independently", () => {
    const text = "City: Springfield\nState: Illinois\nZip code: 62704";
    const result = scrubText(text);
    expect(result).not.toContain("Springfield");
    expect(result).not.toContain("Illinois");
    expect(result).not.toContain("62704");
  });

  it("redacts a partial block (City only, no State/Zip lines)", () => {
    const result = scrubText("City: Springfield\n");
    expect(result).not.toContain("Springfield");
  });
});

describe("D16-5: 'Patient: NAME (NNNN)'", () => {
  it("redacts a patient header line", () => {
    const result = scrubText(
      "Patient: Doe, Jane (4821) presented for follow-up.",
    );
    expect(result).toContain("[REDACTED_PATIENT]");
    expect(result).not.toContain("Doe");
  });
});

describe("D16-5: VA-letter page footers", () => {
  it("redacts the file-number-and-name span but keeps 'Page N'", () => {
    const text = "File Number: 12345678  DOE, JOHN M  Page 2";
    const result = redactLetterFooter(text);
    expect(result).not.toContain("DOE");
    expect(result).not.toContain("12345678");
    expect(result).toContain("Page 2");
  });
});

describe("D16-5: salutations without a courtesy title", () => {
  it("redacts 'Dear FIRST LAST:' with no title", () => {
    const result = redactSalutationNames(
      "Dear John Smith:\n\nWe are writing...",
    );
    expect(result).not.toContain("John Smith");
    expect(result).toContain("Dear ");
  });

  it("does not redact a generic templated greeting with no title", () => {
    const result = redactSalutationNames("Dear Veteran:\n\nWe are writing...");
    expect(result).toBe("Dear Veteran:\n\nWe are writing...");
  });

  it("does not redact 'Dear Sir or Madam:'", () => {
    const text = "Dear Sir or Madam:\n\nWe are writing...";
    const result = redactSalutationNames(text);
    expect(result).toBe(text);
  });
});

describe("D16-5: salutations inside a flattened one-line OCR page", () => {
  it("redacts a titled salutation embedded mid-line with no surrounding newlines", () => {
    const text =
      "DEPARTMENT OF VETERANS AFFAIRS March 15 2024 Dear Mr. Faketon: We have reviewed your claim Sincerely";
    const result = redactSalutationNames(text);
    expect(result).not.toContain("Faketon");
  });

  it("redacts a no-title salutation embedded mid-line with no surrounding newlines", () => {
    const text =
      "DEPARTMENT OF VETERANS AFFAIRS March 15 2024 Dear Jordan Faketon we have reviewed your claim Sincerely";
    const result = redactSalutationNames(text);
    expect(result).not.toContain("Jordan Faketon");
  });
});

describe("D16-5: over-redaction guard - realistic medical/legal text survives", () => {
  it.each([
    [
      "a condition name and body part",
      "The veteran reports chronic lumbar spine pain with radiculopathy to the left leg.",
    ],
    ["a diagnostic code", "Tinnitus is rated under Diagnostic Code 6260."],
    [
      "a disability percentage",
      "The combined evaluation is 70% effective the date of claim.",
    ],
    [
      "an effective date",
      "The effective date of the increase is January 15, 2024.",
    ],
    [
      "a CFR citation",
      "This decision is made under 38 CFR § 4.130 and 38 U.S.C. § 1110.",
    ],
    [
      "a body part list",
      "Examination noted limited motion of the right shoulder and left knee.",
    ],
  ])("leaves %s untouched", (_label, text) => {
    const result = scrubText(text);
    expect(result).toBe(text);
  });
});
