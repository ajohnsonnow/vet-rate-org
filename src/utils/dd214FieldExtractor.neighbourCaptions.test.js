/**
 * D20-3 follow-up: another box's printed caption landing under an identifier
 * label is rejected (empty, never a wrong value), and a correct home of record
 * with a dotted or old-style state abbreviation is still found. Generic
 * fixtures only.
 */
import { describe, it, expect } from "vitest";
import { extractDD214Fields } from "./dd214FieldExtractor";

describe("a neighbouring box's caption is never an identifier", () => {
  it.each([
    [
      "homeOfRecord",
      "7b. HOME OF RECORD AT TIME OF ENTRY\nSTATION WHERE SEPARATED AT\n",
    ],
    [
      "homeOfRecord",
      "7b. HOME OF RECORD AT TIME OF ENTRY\nENTRY INTO ACTIVE DUTY IN\n",
    ],
    [
      "homeOfRecord",
      "7b. HOME OF RECORD AT TIME OF ENTRY\nPAY GRADE E4 DATE OF RANK ON\n",
    ],
    [
      "fullName",
      "1. NAME (Last, First, Middle)\nGRADE RATE OR RANK\n3. SOCIAL SECURITY NUMBER\n",
    ],
    [
      "mailingAddress",
      "19a. MAILING ADDRESS AFTER SEPARATION (Include ZIP Code)\nMEMBER REQUESTS COPY 6 BE SENT TO DIRECTOR OF VETERANS AFFAIRS\n",
    ],
    [
      "mailingAddress",
      "19a. MAILING ADDRESS AFTER SEPARATION (Include ZIP Code)\nYES X NO 21. SIGNATURE OF MEMBER BEING SEPARATED 22\n",
    ],
  ])("%s stays empty for %j", (field, text) => {
    expect(extractDD214Fields(text).fields[field]).toBeUndefined();
  });
});

describe("a correct home of record with an older state abbreviation is kept", () => {
  it.each([
    "BROOKLYN, N.Y.",
    "LOS ANGELES, CALIF",
    "BOSTON, MASS.",
    "SPRINGFIELD, IL.",
    "RALEIGH, N.C.",
    "WASHINGTON, D.C.",
    "PAGO PAGO, AMERICAN SAMOA",
    "CHARLOTTE AMALIE, VIRGIN ISLANDS",
  ])("%s", (value) => {
    const { fields } = extractDD214Fields(
      `7b. HOME OF RECORD AT TIME OF ENTRY\n${value}\n8a. LAST DUTY ASSIGNMENT\n`,
    );
    expect(fields.homeOfRecord).toBe(value);
  });

  it("still finds a real street address with digits", () => {
    const { fields } = extractDD214Fields(
      "19a. MAILING ADDRESS AFTER SEPARATION (Include ZIP Code)\n123 MAIN ST, ANYTOWN TX 75001\n20. SEPARATION CODE\n",
    );
    expect(fields.mailingAddress).toBe("123 MAIN ST, ANYTOWN TX 75001");
  });
});
