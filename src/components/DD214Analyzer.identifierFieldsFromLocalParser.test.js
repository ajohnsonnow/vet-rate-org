/**
 * D15-1d (final15 QA review, 2026-09-28): DD214Analyzer's AI prompt schema
 * asked the model to extract the veteran's name/SSN-last-4/service number/
 * DOB/home-of-record/home-address directly from the just-uploaded DD-214's
 * raw OCR/pasted text - identifiers ADR-008 says a model must never be
 * asked to extract, even though `extractDD214Fields` (dd214FieldExtractor.js)
 * already parses every one of these fields locally via regex, box-label-
 * anchored, with zero AI involvement.
 *
 * Covers:
 *  - Neither system prompt (local or cloud) requests a direct identifier
 *    field in its JSON schema.
 *  - `_applyRegexSafetyNet` still produces every one of those fields on the
 *    final merged result - sourced from the local regex parser instead of
 *    the model - so the veteran-visible result does not lose a field it
 *    showed before D15-1d.
 *  - The `homeAddress` (AI schema's Block-30 name) / `mailingAddress`
 *    (dd214FieldExtractor's Block-19 name) naming mismatch is bridged.
 *
 * `serviceNumber` has no local regex parser (confirmed by grep on
 * dd214FieldExtractor.js) - flagged in openIssues rather than silently
 * re-adding it to the AI schema; this suite documents that it is simply
 * absent from the merged result now; it does not have a name-mismatch to
 * bridge either.
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

import {
  DD214_ANALYSIS_SYSTEM_PROMPT_LOCAL,
  DD214_ANALYSIS_SYSTEM_PROMPT,
  _applyRegexSafetyNet,
} from "./DD214Analyzer.jsx";

const FAKE_LAST = "Faketon";
const FAKE_FIRST = "Jordan";

// A minimal but realistic DD-214 text block covering the boxes
// dd214FieldExtractor.js parses locally for these fields.
const FIXTURE_DD214_TEXT = `
DD FORM 214 CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY
1. NAME: ${FAKE_LAST.toUpperCase()}, ${FAKE_FIRST.toUpperCase()}
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY/ACTIVE
3. SOCIAL SECURITY: 123 45 6789
5. DATE OF BIRTH: 1984 03 15
7B. HOME OF RECORD: ANYTOWN, ANYCOUNTY, ST
8A. LAST DUTY ASSIGNMENT: FORT EXAMPLE
12A. DATE ENTERED ACTIVE DUTY THIS PERIOD: 20020305
12B. SEPARATION DATE THIS PERIOD: 20100615
19. MAILING ADDRESS: 123 MAIN ST, ANYTOWN ST 12345
20. SEPARATION CODE: MBK
24. CHARACTER OF SERVICE: HONORABLE
`;

describe("D15-1d: the AI prompt schema never requests a direct identifier", () => {
  const IDENTIFIER_FIELD_LABELS = [
    '"fullName"',
    '"lastName"',
    '"firstName"',
    '"middleName"',
    '"ssnLast4"',
    '"serviceNumber"',
    '"dateOfBirth"',
    '"homeOfRecord"',
    '"homeAddress"',
  ];

  it.each([
    ["local/on-device", DD214_ANALYSIS_SYSTEM_PROMPT_LOCAL],
    ["cloud", DD214_ANALYSIS_SYSTEM_PROMPT],
  ])(
    "the %s system prompt's JSON schema omits every identifier field",
    (_label, prompt) => {
      IDENTIFIER_FIELD_LABELS.forEach((label) => {
        expect(prompt).not.toContain(label);
      });
    },
  );

  it("both prompts still request placeOfBirth (not an ADR-008-listed identifier)", () => {
    expect(DD214_ANALYSIS_SYSTEM_PROMPT_LOCAL).toContain('"placeOfBirth"');
    expect(DD214_ANALYSIS_SYSTEM_PROMPT).toContain('"placeOfBirth"');
  });
});

describe("D15-1d: _applyRegexSafetyNet backfills every identifier field the model no longer provides", () => {
  it("fills fullName/lastName/firstName/ssnLast4/dateOfBirth/homeOfRecord from the local parser", () => {
    // Simulates the AI response after D15-1d - none of these fields are
    // present, matching the new (identifier-free) schema.
    const data = {
      branch: "Army",
      entryDate: "2002-03-05",
      separationDate: "2010-06-15",
    };

    _applyRegexSafetyNet(data, FIXTURE_DD214_TEXT, () => {});

    expect(data.fullName).toContain(FAKE_LAST.toUpperCase());
    expect(data.lastName).toBe(FAKE_LAST.toUpperCase());
    expect(data.firstName).toBe(FAKE_FIRST.toUpperCase());
    expect(data.ssnLast4).toBe("6789");
    expect(data.ssn).toBeUndefined();
    expect(data.dateOfBirth).toBe("1984-03-15");
    expect(data.homeOfRecord).toContain("ANYTOWN");
  });

  it("bridges the homeAddress (AI schema name) / mailingAddress (regex extractor name) mismatch", () => {
    const data = { branch: "Army" };
    _applyRegexSafetyNet(data, FIXTURE_DD214_TEXT, () => {});
    expect(data.homeAddress).toContain("123 MAIN ST");
  });

  it("does not overwrite an AI-supplied homeAddress with the regex value", () => {
    const data = { branch: "Army", homeAddress: "AI-reported address" };
    _applyRegexSafetyNet(data, FIXTURE_DD214_TEXT, () => {});
    expect(data.homeAddress).toBe("AI-reported address");
  });
});
