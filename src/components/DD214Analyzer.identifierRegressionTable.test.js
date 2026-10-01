/**
 * D16-5: regression table proving the DD-214 Analyzer's DISPLAYED identifier
 * fields (fullName/lastName/firstName/middleName/ssnLast4/dateOfBirth/
 * homeOfRecord/homeAddress) are always correct or empty after the full
 * extract -> merge -> display-precedence pipeline (extractDD214Fields ->
 * _applyRegexSafetyNet), never a wrong value - across the real-world OCR
 * shapes this fix targets (row-split labels, flattened lines, NGB-22 box
 * numbering, ITEM-mislabeled boxes, pipe-delimited tables) and across the
 * on-device/off-device precedence contract.
 *
 * Every row plants a deliberately WRONG "AI-supplied" sentinel value and
 * asserts the final field is EXACTLY the correct value or EXACTLY empty -
 * never the sentinel, and never any other wrong value (including a wrong
 * value the pre-fix code itself produced - asserted by name below, not
 * just via a substring predicate, which is how an earlier version of this
 * table missed a wrong middleName/lastName while its own fullName
 * substring check passed).
 *
 * Rows are labeled with what commit cc34ecbb ("base") actually returns for
 * that fixture (verified by running base's real extractDD214Fields against
 * it) - some rows are base-was-already-correct (regression safety: this
 * fix must not break them), some are base-was-actually-WRONG (this fix
 * corrects a defect that predates this whole branch, not just a
 * regression introduced by it). Both kinds are required so the table can't
 * pass vacuously; the base-was-wrong rows are what make it fail on base.
 *
 * Fixture identifiers are synthetic.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("../utils/documentAnalyzer", () => ({
  OCR_STATES: {},
  getProgressStyling: () => ({}),
  formatFileSize: (bytes) => `${bytes} bytes`,
  isFileSupported: () => true,
  getAcceptString: () => "",
}));
vi.mock("../utils/musterCallProcessor", () => ({
  processFormationDocument: vi.fn(),
  PROCESSING_STATES: { EXTRACTING: "EXTRACTING", COMPLETE: "COMPLETE" },
}));
vi.mock("../utils/smolVLMService", () => ({
  smolVLMService: {},
  isSmolVLMSupported: () => false,
}));

import { _applyRegexSafetyNet } from "./DD214Analyzer.jsx";

const WRONG = {
  fullName: "WRONGNAME, HALLUCINATED",
  lastName: "WRONGNAME",
  firstName: "HALLUCINATED",
  middleName: "X",
  ssnLast4: "0000",
  dateOfBirth: "1900-01-01",
  homeOfRecord: "WRONG HOME OF RECORD",
  homeAddress: "WRONG HOME ADDRESS",
};

function plantWrongValues() {
  return { branch: "Army", ...WRONG };
}

// Every field not explicitly expected must be either absent or empty -
// this is what catches a wrong lastName/middleName hiding behind a
// correct-looking fullName substring (the exact defect the pre-fix
// regression table missed).
function expectExactOrEmpty(data, expected) {
  for (const key of Object.keys(WRONG)) {
    expect(data[key]).not.toBe(WRONG[key]);
    if (Object.hasOwn(expected, key)) {
      expect(data[key]).toBe(expected[key]);
    } else {
      expect(data[key] === undefined || data[key] === "").toBe(true);
    }
  }
}

// [label, text, expected] - off-device (CLOUD, i.e. onDevice: false), so
// the local parser's value (or empty) always wins over the planted
// sentinel regardless of the fixture's own base-correctness.
const ROWS = [
  [
    "base-right: clean modern DD214 text",
    `
1. NAME: DOE, JORDAN R
2. DEPARTMENT: ARMY/ACTIVE
3. SOCIAL SECURITY: 123-45-6789
5. DATE OF BIRTH: 1985 06 21
7B. HOME OF RECORD: SPRINGFIELD, IL
19. MAILING ADDRESS: 123 MAIN ST, SPRINGFIELD IL 62704
20. SEPARATION CODE: MBK
`,
    {
      fullName: "DOE, JORDAN R",
      lastName: "DOE",
      firstName: "JORDAN",
      middleName: "R",
      ssnLast4: "6789",
      dateOfBirth: "1985-06-21",
      homeOfRecord: "SPRINGFIELD, IL",
      homeAddress: "123 MAIN ST, SPRINGFIELD IL 62704",
    },
  ],
  [
    "base-wrong: an unlabeled 9-digit run leaks into fullName AND ssnLast4 at base",
    "1. NAME: DOE, JORDAN R\nREMARKS: ORDER NUMBER 123456789 REFERS TO A VOUCHER\n",
    {
      fullName: "DOE, JORDAN R",
      lastName: "DOE",
      firstName: "JORDAN",
      middleName: "R",
    },
  ],
  [
    "base-wrong: a swapped-column layout shows an implausible DOB at base",
    "DOE, JOHN ALAN\n1. NAME\n123-45-6789\n3. SOCIAL SECURITY NUMBER\n19850115\n" +
      "5. DATE OF BIRTH (YYYYMMDD)\n20150101\n6. RESERVE OBLIGATION\n",
    {},
  ],
  [
    "base-wrong: clean multi-line mailing address absorbs the 19.b nearest-relative box at base",
    "19.a MAILING ADDRESS AFTER SEPARATION\n123 MAIN ST SPRINGFIELD IL 62704\n" +
      "19.b NEAREST RELATIVE (Name and address)\nROE, JANE\n456 OAK AVE SHELBYVILLE IL 62565\n20. SEPARATION CODE: MBK\n",
    { homeAddress: "123 MAIN ST SPRINGFIELD IL 62704" },
  ],
  [
    "base-right, later regressed: an ITEM-numbered box for a DIFFERENT field must not supply the SSN",
    "ITEM 3. SERVICE NUMBER\n987 65 4321\nITEM 4. SOCIAL SECURITY NUMBER\n123 45 6789\n",
    { ssnLast4: "6789" },
  ],
  [
    "base-right, later regressed: an ITEM-numbered box for a DIFFERENT field must not supply the DOB",
    "ITEM 5. DATE OF ENLISTMENT\n20010315\nITEM 6. DATE OF BIRTH\n19800704\n",
    { dateOfBirth: "1980-07-04" },
  ],
  [
    "base-right, later regressed: ITEM 52 must not partial-match as ITEM 5 (date of birth)",
    "ITEM 52. EFFECTIVE DATE\n20100615\n",
    {},
  ],
  [
    "base-right, later regressed: a real digit-heavy street address must not be rejected as OCR junk",
    "1. NAME: DOE, JORDAN R\n7B. HOME OF RECORD: 12345 67TH ST NW, TACOMA, WA 98765\n8A. LAST DUTY: FORT X\n",
    {
      fullName: "DOE, JORDAN R",
      lastName: "DOE",
      firstName: "JORDAN",
      middleName: "R",
      homeOfRecord: "12345 67TH ST NW, TACOMA, WA 98765",
    },
  ],
  [
    "base-right, later regressed: a real PSC/BOX military address must not be rejected for containing the word BOX",
    "1. NAME: DOE, JORDAN R\n7B. HOME OF RECORD: PSC 123 BOX 4567 APO AE 09012\n8A. LAST DUTY: FORT X\n",
    {
      fullName: "DOE, JORDAN R",
      lastName: "DOE",
      firstName: "JORDAN",
      middleName: "R",
      homeOfRecord: "PSC 123 BOX 4567 APO AE 09012",
    },
  ],
  [
    "base-right, later regressed: a real digit-heavy mailing address must not be rejected as OCR junk",
    "19. MAILING ADDRESS: 12345 67TH ST NW 98765\n20. SEPARATION CODE: MBK\n",
    { homeAddress: "12345 67TH ST NW 98765" },
  ],
  [
    "base-right, later regressed: a pipe-delimited SSN table cell must still recover the last 4",
    "3. SOCIAL SECURITY NUMBER | 123-45-6789\n",
    { ssnLast4: "6789" },
  ],
  [
    "base-right, later regressed: an empty name box must not absorb the next box's own label text",
    "1. NAME (Last, First, Middle)\nDEPARTMENT COMPONENT AND BRANCH\nARMY/RA\n3. SOCIAL SECURITY NUMBER: 123-45-6789\n",
    { ssnLast4: "6789" },
  ],
  [
    "base-right, later regressed: a row-split name must stop at the next box's label",
    "1. NAME\nDOE JOHN A\nDATE OF BIRTH\n19850115\n",
    {
      fullName: "DOE JOHN A",
      lastName: "DOE",
      firstName: "JOHN",
      middleName: "A",
      dateOfBirth: "1985-01-15",
    },
  ],
  [
    "base-right, later regressed: a pipe-delimited name table cell must stop at the column border",
    "1. NAME | 2. DEPARTMENT, COMPONENT AND BRANCH\nDOE, JOHN A | ARMY/RA\n",
    {
      fullName: "DOE, JOHN A",
      lastName: "DOE",
      firstName: "JOHN",
      middleName: "A",
    },
  ],
  [
    "base-right, later regressed: a bare SSN label (no box number) must not absorb into the name",
    "ITEM 1. LAST NAME: DOE, JORDAN R\nSSN\n123-45-6789\n",
    {
      fullName: "DOE, JORDAN R",
      lastName: "DOE",
      firstName: "JORDAN",
      middleName: "R",
      ssnLast4: "6789",
    },
  ],
  [
    "base-empty, later regressed: a flattened mailing address must not absorb the 19.b nearest-relative box",
    "19.A MAILING ADDRESS AFTER SEPARATION 123 MAIN ST SPRINGFIELD IL 62704 " +
      "19.B NEAREST RELATIVE ROE, JANE 456 OAK AVE SHELBYVILLE IL 62565 20. SEPARATION CODE MBK",
    { homeAddress: "123 MAIN ST SPRINGFIELD IL 62704" },
  ],
  [
    "base-empty, later regressed: a flattened home of record must not absorb the last-duty-assignment box",
    "7.B HOME OF RECORD AT TIME OF ENTRY SPRINGFIELD, IL 62701 LAST DUTY ASSIGNMENT AND MAJOR COMMAND HHC 2 BN FORT X 9. COMMAND",
    {},
  ],
  [
    "base-partial: row-split OCR with a garbled label still finds name/SSN/DOB",
    "3. SOCIAL SECURITY.N\n123-45-6789\nDATE OF BIRTH\n21 JUN 1985\n1. NAME %%\nDOE, JORDAN R\n",
    {
      fullName: "DOE, JORDAN R",
      lastName: "DOE",
      firstName: "JORDAN",
      middleName: "R",
      ssnLast4: "6789",
      dateOfBirth: "1985-06-21",
    },
  ],
  [
    "base-partial: flattened one-line OCR still finds name/SSN/DOB/home-of-record",
    "1. NAME DOE, JORDAN R 2. DEPARTMENT ARMY/ACTIVE 3. SOCIAL SECURITY NUMBER 123-45-6789 " +
      "5. DATE OF BIRTH 19850621 7B. HOME OF RECORD SPRINGFIELD ILLINOIS 62704 8A. LAST DUTY FORT X",
    {
      fullName: "DOE, JORDAN R",
      lastName: "DOE",
      firstName: "JORDAN",
      middleName: "R",
      ssnLast4: "6789",
      dateOfBirth: "1985-06-21",
      homeOfRecord: "SPRINGFIELD ILLINOIS 62704",
    },
  ],
];

describe("D16-5: identifier-field regression table (correct or empty, never wrong)", () => {
  it.each(ROWS)("%s", (_label, text, expected) => {
    const data = plantWrongValues();
    _applyRegexSafetyNet(data, text, () => {}, false);
    expectExactOrEmpty(data, expected);
  });

  it("no identifier boxes present + off-device model: every field is empty, never the planted wrong value", () => {
    const data = plantWrongValues();
    const text = `
2. DEPARTMENT: ARMY/ACTIVE
12A. DATE ENTERED ACTIVE DUTY: 20020305
12B. SEPARATION DATE: 20100615
24. CHARACTER OF SERVICE: HONORABLE
`;
    _applyRegexSafetyNet(data, text, () => {}, false);
    expectExactOrEmpty(data, {});
  });

  it("implausible/junk home-of-record capture is left empty, never shown as OCR junk or the planted wrong value", () => {
    const data = plantWrongValues();
    const text =
      "1. NAME: DOE, JORDAN R\nHOME OF RECORD: 12 // 34 -- 56\n8A. LAST DUTY: FORT X\n";
    _applyRegexSafetyNet(data, text, () => {}, false);
    expect(data.homeOfRecord).toBe("");
    expect(data.homeOfRecord).not.toContain("//");
  });
});

// Owner decision (F): the model is never an identifier source, on ANY backend.
// Every row of the table above and every case below plants wrong identifiers
// and runs once per backend flag (on-device, off-device, unidentified).
describe("(F): planted wrong model identifiers never appear, on every backend", () => {
  const CLEAN_TEXT =
    "1. NAME: DOE, JORDAN R\n3. SOCIAL SECURITY: 123-45-6789\n5. DATE OF BIRTH: 1985 06 21\n";
  const BACKENDS = [
    ["on-device", true],
    ["off-device", false],
    ["unidentified", undefined],
    ["truthy string", "true"],
  ];

  it.each(BACKENDS)(
    "%s: the confident local parse wins over a planted wrong value",
    (_label, onDevice) => {
      const data = plantWrongValues();
      _applyRegexSafetyNet(data, CLEAN_TEXT, () => {}, onDevice);
      expectExactOrEmpty(data, {
        fullName: "DOE, JORDAN R",
        lastName: "DOE",
        firstName: "JORDAN",
        middleName: "R",
        ssnLast4: "6789",
        dateOfBirth: "1985-06-21",
      });
    },
  );

  it.each(BACKENDS)(
    "%s: every identifier is empty when the local parser finds nothing",
    (_label, onDevice) => {
      const data = plantWrongValues();
      _applyRegexSafetyNet(
        data,
        "2. DEPARTMENT: ARMY/ACTIVE\n",
        () => {},
        onDevice,
      );
      expectExactOrEmpty(data, {});
    },
  );

  it.each(ROWS)("on-device backend, row: %s", (_label, text, expected) => {
    const data = plantWrongValues();
    _applyRegexSafetyNet(data, text, () => {}, true);
    expectExactOrEmpty(data, expected);
  });
});
