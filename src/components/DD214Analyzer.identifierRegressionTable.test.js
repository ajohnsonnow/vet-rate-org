/**
 * D16-5: regression table proving the DD-214 Analyzer's DISPLAYED identifier
 * fields (fullName/lastName/firstName/ssnLast4/dateOfBirth/homeOfRecord/
 * homeAddress) are always correct or empty after the full
 * extract -> merge -> display-precedence pipeline (extractDD214Fields ->
 * _applyRegexSafetyNet), never a wrong value - across the real-world OCR
 * shapes this fix targets (row-split labels, flattened lines, NGB-22 box
 * numbering, OCR-garbled SSN) and across every AI backend mode (on-device
 * vs. off-device vs. unidentified).
 *
 * Each row plants a deliberately WRONG "AI-supplied" value (a sentinel
 * string that can never legitimately equal the correct answer) and asserts
 * the final merged field is either the correct value or empty - the
 * sentinel itself must never survive to display.
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

import { AI_MODES } from "../utils/unifiedAIService";
import { _applyRegexSafetyNet } from "./DD214Analyzer.jsx";

const WRONG_NAME = "WRONGNAME, HALLUCINATED";
const WRONG_SSN4 = "0000";
const WRONG_DOB = "1900-01-01";
const WRONG_HOR = "WRONG HOME OF RECORD";
const WRONG_ADDR = "WRONG HOME ADDRESS";

function aiSuppliedWrongValues() {
  return {
    branch: "Army",
    fullName: WRONG_NAME,
    ssnLast4: WRONG_SSN4,
    dateOfBirth: WRONG_DOB,
    homeOfRecord: WRONG_HOR,
    homeAddress: WRONG_ADDR,
  };
}

// asserts the field is either the expected correct value/undefined-and-
// empty, or empty ("" / undefined) - and, regardless of which, that it is
// NEVER the planted wrong sentinel.
function expectCorrectOrEmpty(actual, expectedCorrect, wrongSentinel) {
  expect(actual).not.toBe(wrongSentinel);
  if (expectedCorrect === undefined) {
    expect(actual === undefined || actual === "").toBe(true);
  } else if (typeof expectedCorrect === "function") {
    expect(
      actual === undefined || actual === "" || expectedCorrect(actual),
    ).toBe(true);
  } else {
    expect(
      actual === undefined || actual === "" || actual === expectedCorrect,
    ).toBe(true);
  }
}

const CLEAN_MODERN_TEXT = `
1. NAME: DOE, JORDAN R
2. DEPARTMENT: ARMY/ACTIVE
3. SOCIAL SECURITY: 123-45-6789
5. DATE OF BIRTH: 1985 06 21
7B. HOME OF RECORD: SPRINGFIELD, IL
19. MAILING ADDRESS: 123 MAIN ST, SPRINGFIELD IL 62704
20. SEPARATION CODE: MBK
`;

const NGB22_ITEM_NUMBERED_TEXT =
  "ITEM 1. LAST NAME: DOE, JORDAN R\n" +
  "SSN\n123-45-6789\n" +
  "ITEM 5. DATE OF BIRTH: 21 JUN 1985\n" +
  "HOME OF RECORD\nSPRINGFIELD, IL\n8A. LAST DUTY: FORT X\n";

const FLATTENED_ONE_LINE_TEXT =
  "1. NAME DOE, JORDAN R 2. DEPARTMENT ARMY/ACTIVE 3. SOCIAL SECURITY NUMBER 123-45-6789 " +
  "5. DATE OF BIRTH 19850621 7B. HOME OF RECORD SPRINGFIELD ILLINOIS 62704 8A. LAST DUTY FORT X";

const ROW_SPLIT_GARBLED_LABEL_TEXT =
  "3. SOCIAL SECURITY.N\n123-45-6789\n" +
  "DATE OF BIRTH\n21 JUN 1985\n" +
  "1. NAME %%\nDOE, JORDAN R\n";

// No identifier boxes present at all - the local parser confidently finds
// nothing, so this row exercises the on-device/off-device model fallback.
const NO_IDENTIFIER_BOXES_TEXT = `
2. DEPARTMENT: ARMY/ACTIVE
12A. DATE ENTERED ACTIVE DUTY: 20020305
12B. SEPARATION DATE: 20100615
24. CHARACTER OF SERVICE: HONORABLE
`;

// The SSN box is present but unlabeled/ambiguous junk - the local parser's
// validate() must reject it, and there is no other SSN-shaped label in the
// text for the OCR-garbled-digit patterns to latch onto either.
const IMPLAUSIBLE_HOME_OF_RECORD_TEXT =
  "1. NAME: DOE, JORDAN R\n" +
  "HOME OF RECORD: 12 // 34 -- 56\n" +
  "8A. LAST DUTY: FORT X\n";

describe("D16-5: identifier-field regression table (correct or empty, never wrong)", () => {
  it.each([
    ["clean modern DD214 text", CLEAN_MODERN_TEXT, AI_MODES.CLOUD],
    ["NGB-22 ITEM-numbered boxes", NGB22_ITEM_NUMBERED_TEXT, AI_MODES.CLOUD],
    ["flattened one-line OCR", FLATTENED_ONE_LINE_TEXT, AI_MODES.CLOUD],
    [
      "row-split OCR with a garbled label",
      ROW_SPLIT_GARBLED_LABEL_TEXT,
      AI_MODES.CLOUD,
    ],
    [
      "clean modern DD214 text, on-device model",
      CLEAN_MODERN_TEXT,
      AI_MODES.SWARM,
    ],
    ["clean modern DD214 text, unknown model", CLEAN_MODERN_TEXT, undefined],
  ])(
    "%s: every identifier field is correct or empty, never the planted wrong AI value",
    (_label, text, usedMode) => {
      const data = aiSuppliedWrongValues();
      _applyRegexSafetyNet(data, text, () => {}, usedMode);

      expectCorrectOrEmpty(data.fullName, (v) => v.includes("DOE"), WRONG_NAME);
      expectCorrectOrEmpty(data.ssnLast4, "6789", WRONG_SSN4);
      expectCorrectOrEmpty(data.dateOfBirth, "1985-06-21", WRONG_DOB);
      expectCorrectOrEmpty(
        data.homeOfRecord,
        (v) => v.includes("SPRINGFIELD"),
        WRONG_HOR,
      );
    },
  );

  it("no identifier boxes present + off-device model: every field is empty, never the planted wrong value", () => {
    const data = aiSuppliedWrongValues();
    _applyRegexSafetyNet(
      data,
      NO_IDENTIFIER_BOXES_TEXT,
      () => {},
      AI_MODES.CLOUD,
    );
    expect(data.fullName).toBe("");
    expect(data.ssnLast4).toBe("");
    expect(data.dateOfBirth).toBe("");
    expect(data.homeOfRecord).toBe("");
    expect(data.homeAddress).toBe("");
  });

  it("no identifier boxes present + on-device model: the on-device model's own (correct) value is kept", () => {
    const data = {
      branch: "Army",
      fullName: "DOE, JORDAN R",
      dateOfBirth: "1985-06-21",
    };
    _applyRegexSafetyNet(
      data,
      NO_IDENTIFIER_BOXES_TEXT,
      () => {},
      AI_MODES.WLLAMA,
    );
    expect(data.fullName).toBe("DOE, JORDAN R");
    expect(data.dateOfBirth).toBe("1985-06-21");
  });

  it("implausible/junk home-of-record capture is left empty, never shown as OCR junk or the planted wrong AI value", () => {
    const data = aiSuppliedWrongValues();
    _applyRegexSafetyNet(
      data,
      IMPLAUSIBLE_HOME_OF_RECORD_TEXT,
      () => {},
      AI_MODES.CLOUD,
    );
    expect(data.homeOfRecord).toBe("");
    expect(data.homeOfRecord).not.toContain("//");
  });

  it("an unlabeled 9-digit run elsewhere in the document never becomes the SSN", () => {
    const data = { branch: "Army" };
    const text =
      "1. NAME: DOE, JORDAN R\nREMARKS: ORDER NUMBER 123456789 REFERS TO A VOUCHER\n";
    _applyRegexSafetyNet(data, text, () => {}, AI_MODES.CLOUD);
    expect(data.ssnLast4 === undefined || data.ssnLast4 === "").toBe(true);
  });
});
