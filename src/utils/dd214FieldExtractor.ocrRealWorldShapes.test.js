/**
 * D16-5: the local parser (dd214FieldExtractor.js) found no name in 5 real
 * OCR'd NGB-22/DD214 files, DOB in 1, home of record in 1 (as OCR junk), and
 * a WRONG SSN last-4 in 1 (from a fully-unanchored fallback pattern that
 * then overrode the model, since ssnLast4 only fills a gap the model left
 * empty). This file reproduces the OCR SHAPES that caused those failures
 * with GENERIC fixtures - no real veteran records - and proves each is
 * fixed without the parser ever emitting a wrong value.
 */
import { describe, it, expect } from "vitest";
import { extractDD214Fields } from "./dd214FieldExtractor";

describe("dd214FieldExtractor: label-on-one-row, value-on-the-next (row-split OCR)", () => {
  it("finds the SSN when the label line is garbled ('SOCIAL SECURITY.N' from a mangled 'NO.')", () => {
    const text = "3. SOCIAL SECURITY.N\n123-45-6789\n";
    const result = extractDD214Fields(text);
    expect(result.fields.ssnLast4).toBe("6789");
  });

  it("finds the DOB when the label and value are split across rows with no box number", () => {
    const text = "DATE OF BIRTH\n1985 06 21\n";
    const result = extractDD214Fields(text);
    expect(result.fields.dateOfBirth).toBe("1985-06-21");
  });

  it("finds home of record when the label and value are split across rows with no box number", () => {
    const text = "HOME OF RECORD\nRIVERTON, WYOMING\n8A. LAST DUTY: FORT X\n";
    const result = extractDD214Fields(text);
    expect(result.fields.homeOfRecord).toContain("RIVERTON");
  });

  it("finds the name when the label line ends in OCR noise instead of the printed hint", () => {
    const text = "1. NAME %%\nDOE, JANE, R\n2. DEPARTMENT: ARMY\n";
    const result = extractDD214Fields(text);
    expect(result.fields.fullName).toContain("DOE");
  });
});

describe("dd214FieldExtractor: boxes run together on one flattened OCR line", () => {
  const FLATTENED =
    "1. NAME DOE, JANE R 2. DEPARTMENT ARMY/ACTIVE 3. SOCIAL SECURITY NUMBER 123-45-6789 " +
    "5. DATE OF BIRTH 19850621 7B. HOME OF RECORD RIVERTON WYOMING 82501 8A. LAST DUTY FORT X";

  it("still finds name, SSN, DOB, and home of record with no newlines anywhere", () => {
    const result = extractDD214Fields(FLATTENED);
    expect(result.fields.fullName).toContain("DOE");
    expect(result.fields.ssnLast4).toBe("6789");
    expect(result.fields.dateOfBirth).toBe("1985-06-21");
    expect(result.fields.homeOfRecord).toContain("RIVERTON");
  });
});

describe("dd214FieldExtractor: LAST, FIRST MIDDLE with OCR noise", () => {
  it("accepts a name with no comma at all (OCR dropped the punctuation)", () => {
    const text = "1. NAME: DOE JANE R\n2. DEPARTMENT: ARMY\n";
    const result = extractDD214Fields(text);
    expect(result.fields.lastName).toBe("DOE");
    expect(result.fields.firstName).toBe("JANE");
  });

  it("accepts a name with stray table-border characters mixed into the value", () => {
    const text = "1. NAME: DOE, |JANE| R\n2. DEPARTMENT: ARMY\n";
    const result = extractDD214Fields(text);
    expect(result.fields.fullName).toContain("DOE");
    expect(result.fields.fullName).not.toMatch(/[|_]/);
  });

  it("does not turn a single garbled token into a fabricated name", () => {
    const text = "1. NAME: %\n2. DEPARTMENT: ARMY\n";
    const result = extractDD214Fields(text);
    expect(result.fields.fullName).toBeUndefined();
  });
});

describe("dd214FieldExtractor: DD-214 date formats", () => {
  it.each([
    ["YYYYMMDD", "5. DATE OF BIRTH: 19850621\n"],
    ["typewriter-era 'DD MMM YYYY'", "5. DATE OF BIRTH: 21 JUN 1985\n"],
    [
      "'DD MMM YYYY' with a period after the month abbreviation",
      "DATE OF BIRTH: 21 JUN. 1985\n",
    ],
  ])("parses %s", (_label, text) => {
    const result = extractDD214Fields(text);
    expect(result.fields.dateOfBirth).toBe("1985-06-21");
  });

  it("never guesses a century for a 2-digit-year month-name date", () => {
    const result = extractDD214Fields("5. DATE OF BIRTH: 21 JUN 85\n");
    expect(result.fields.dateOfBirth).toBeUndefined();
  });

  it("rejects an out-of-range day/month in month-name form rather than emitting a wrong date", () => {
    const result = extractDD214Fields("5. DATE OF BIRTH: 45 FOO 1985\n");
    expect(result.fields.dateOfBirth).toBeUndefined();
  });
});

describe("dd214FieldExtractor: NGB-22 box numbering (ITEM, not BLOCK/BOX)", () => {
  it("finds the name under an 'ITEM 1' label", () => {
    const result = extractDD214Fields("ITEM 1. LAST NAME: DOE, JANE R\n");
    expect(result.fields.fullName).toContain("DOE");
  });

  it("finds the SSN under a bare 'SSN' label with no box number at all", () => {
    const result = extractDD214Fields("SSN\n123-45-6789\n");
    expect(result.fields.ssnLast4).toBe("6789");
  });

  it("finds the DOB under an 'ITEM 5' label", () => {
    const result = extractDD214Fields("ITEM 5. DATE OF BIRTH: 1985 06 21\n");
    expect(result.fields.dateOfBirth).toBe("1985-06-21");
  });
});

describe("dd214FieldExtractor: never emits a wrong SSN from an unlabeled digit run", () => {
  it("does not treat an unrelated 9-digit run as the SSN when there is no SSN label anywhere", () => {
    const text =
      "REMARKS: ORDER NUMBER 123456789 REFERS TO A SEPARATE TRAVEL VOUCHER\n";
    const result = extractDD214Fields(text);
    expect(result.fields.ssnLast4).toBeUndefined();
  });

  it("does not let an unrelated digit run masquerade as the SSN even next to a real label for a different field", () => {
    const text = "8A. LAST DUTY ASSIGNMENT: UNIT 123456789\n";
    const result = extractDD214Fields(text);
    expect(result.fields.ssnLast4).toBeUndefined();
  });
});

describe("dd214FieldExtractor: never emits home-of-record/mailing-address OCR junk", () => {
  it("leaves home of record empty rather than a mostly-numeric/symbol capture", () => {
    const text = "HOME OF RECORD: 12 // 34 -- 56\n8A. LAST DUTY: FORT X\n";
    const result = extractDD214Fields(text);
    expect(result.fields.homeOfRecord).toBeUndefined();
  });

  it("leaves home of record empty when the captured text is just another box's label", () => {
    const text = "HOME OF RECORD: BLOCK 8A\n8A. LAST DUTY: FORT X\n";
    const result = extractDD214Fields(text);
    expect(result.fields.homeOfRecord).toBeUndefined();
  });

  it("still accepts a short, legitimate city/state home of record", () => {
    const text = "HOME OF RECORD: SPRINGFIELD, IL\n8A. LAST DUTY: FORT X\n";
    const result = extractDD214Fields(text);
    expect(result.fields.homeOfRecord).toContain("SPRINGFIELD");
  });

  it("still accepts a legitimate mailing address with a street number and ZIP", () => {
    const text =
      "19. MAILING ADDRESS: 123 MAIN ST, SPRINGFIELD IL 62704\n20. SEPARATION CODE: MBK\n";
    const result = extractDD214Fields(text);
    expect(result.fields.mailingAddress).toContain("MAIN ST");
  });
});

describe("dd214FieldExtractor: fullName never absorbs a neighbouring box's own label", () => {
  it("leaves the name empty rather than capturing the next box's label when the name box is empty", () => {
    const text =
      "1. NAME (Last, First, Middle)\nDEPARTMENT COMPONENT AND BRANCH\nARMY/RA\n3. SOCIAL SECURITY NUMBER: 123-45-6789\n";
    const result = extractDD214Fields(text);
    expect(result.fields.fullName).toBeUndefined();
    expect(result.fields.ssnLast4).toBe("6789");
  });

  it("stops a row-split name capture at the next box's label instead of running through it", () => {
    const text = "1. NAME\nDOE JOHN A\nDATE OF BIRTH\n19850115\n";
    const result = extractDD214Fields(text);
    expect(result.fields.fullName).toBe("DOE JOHN A");
    expect(result.fields.middleName).toBe("A");
  });

  it("stops a pipe-delimited name column at the table border instead of absorbing the next column", () => {
    const text =
      "1. NAME | 2. DEPARTMENT, COMPONENT AND BRANCH\nDOE, JOHN A | ARMY/RA\n";
    const result = extractDD214Fields(text);
    expect(result.fields.fullName).toBe("DOE, JOHN A");
  });

  it("stops a bare SSN label (no box number) from being absorbed into the name", () => {
    const text = "ITEM 1. LAST NAME: DOE, JORDAN R\nSSN\n123-45-6789\n";
    const result = extractDD214Fields(text);
    expect(result.fields.fullName).toBe("DOE, JORDAN R");
  });
});

describe("dd214FieldExtractor: an ITEM/BLOCK/BOX number alone must not stand in for the printed label", () => {
  it("does not let a re-numbered SSN box borrow a different field's value", () => {
    const text =
      "ITEM 3. SERVICE NUMBER\n987 65 4321\nITEM 4. SOCIAL SECURITY NUMBER\n123 45 6789\n";
    const result = extractDD214Fields(text);
    expect(result.fields.ssnLast4).toBe("6789");
  });

  it("does not let a re-numbered DOB box borrow a different field's date", () => {
    const text =
      "ITEM 5. DATE OF ENLISTMENT\n20010315\nITEM 6. DATE OF BIRTH\n19800704\n";
    const result = extractDD214Fields(text);
    expect(result.fields.dateOfBirth).toBe("1980-07-04");
  });

  it("does not let 'ITEM 52' partial-match as box 5 (date of birth)", () => {
    const result = extractDD214Fields("ITEM 52. EFFECTIVE DATE\n20100615\n");
    expect(result.fields.dateOfBirth).toBeUndefined();
  });
});

describe("dd214FieldExtractor: recovers a label-anchored SSN last-4 that isn't immediately adjacent", () => {
  it("finds the SSN when it's at the end of a shared value row with other fields' values", () => {
    const text =
      "1. NAME 2. DEPARTMENT 3. SOCIAL SECURITY NUMBER\nDOE, JOHN ALAN ARMY/RA 123 45 6789\n";
    const result = extractDD214Fields(text);
    expect(result.fields.ssnLast4).toBe("6789");
  });

  it("finds the SSN in a pipe-delimited table cell that isn't immediately after the label", () => {
    const result = extractDD214Fields(
      "3. SOCIAL SECURITY NUMBER | 123-45-6789\n",
    );
    expect(result.fields.ssnLast4).toBe("6789");
  });
});

describe("dd214FieldExtractor: home-of-record/mailing-address validate() no longer rejects real addresses", () => {
  it("accepts a real street address even though it's mostly digits", () => {
    const text =
      "7B. HOME OF RECORD: 12345 67TH ST NW, TACOMA, WA 98765\n8A. LAST DUTY: FORT X\n";
    const result = extractDD214Fields(text);
    expect(result.fields.homeOfRecord).toBe(
      "12345 67TH ST NW, TACOMA, WA 98765",
    );
  });

  it("accepts a real military PSC/BOX address instead of rejecting it for containing the word BOX", () => {
    const text =
      "7B. HOME OF RECORD: PSC 123 BOX 4567 APO AE 09012\n8A. LAST DUTY: FORT X\n";
    const result = extractDD214Fields(text);
    expect(result.fields.homeOfRecord).toBe("PSC 123 BOX 4567 APO AE 09012");
  });

  it("accepts a real digit-heavy mailing address", () => {
    const text =
      "19. MAILING ADDRESS: 12345 67TH ST NW 98765\n20. SEPARATION CODE: MBK\n";
    const result = extractDD214Fields(text);
    expect(result.fields.mailingAddress).toBe("12345 67TH ST NW 98765");
  });
});

describe("dd214FieldExtractor: mailing address/home of record never absorb a neighbouring box", () => {
  it("stops a clean multi-line mailing address at the 19.b nearest-relative box", () => {
    const text =
      "19.a MAILING ADDRESS AFTER SEPARATION\n123 MAIN ST SPRINGFIELD IL 62704\n" +
      "19.b NEAREST RELATIVE (Name and address)\nROE, JANE\n456 OAK AVE SHELBYVILLE IL 62565\n20. SEPARATION CODE: MBK\n";
    const result = extractDD214Fields(text);
    expect(result.fields.mailingAddress).toBe(
      "123 MAIN ST SPRINGFIELD IL 62704",
    );
  });

  it("stops a flattened one-line mailing address at the 19.b nearest-relative box", () => {
    const text =
      "19.A MAILING ADDRESS AFTER SEPARATION 123 MAIN ST SPRINGFIELD IL 62704 " +
      "19.B NEAREST RELATIVE ROE, JANE 456 OAK AVE SHELBYVILLE IL 62565 20. SEPARATION CODE MBK";
    const result = extractDD214Fields(text);
    expect(result.fields.mailingAddress).toBe(
      "123 MAIN ST SPRINGFIELD IL 62704",
    );
  });

  it("leaves a flattened home of record empty rather than absorbing the last-duty-assignment box", () => {
    const text =
      "7.B HOME OF RECORD AT TIME OF ENTRY SPRINGFIELD, IL 62701 LAST DUTY ASSIGNMENT AND MAJOR COMMAND HHC 2 BN FORT X 9. COMMAND";
    const result = extractDD214Fields(text);
    expect(result.fields.homeOfRecord).toBeUndefined();
  });
});

describe("dd214FieldExtractor: date of birth is never an implausible age", () => {
  it("rejects a swapped-column value that would make the veteran an implausible age, rather than showing it", () => {
    const text =
      "DOE, JOHN ALAN\n1. NAME\n123-45-6789\n3. SOCIAL SECURITY NUMBER\n19850115\n" +
      "5. DATE OF BIRTH (YYYYMMDD)\n20150101\n6. RESERVE OBLIGATION\n";
    const result = extractDD214Fields(text);
    expect(result.fields.dateOfBirth).toBeUndefined();
  });

  it("still accepts a plausible birth year for an older veteran", () => {
    const result = extractDD214Fields("5. DATE OF BIRTH: 1945 03 12\n");
    expect(result.fields.dateOfBirth).toBe("1945-03-12");
  });
});
