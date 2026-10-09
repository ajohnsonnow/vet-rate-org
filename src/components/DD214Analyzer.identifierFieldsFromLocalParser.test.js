/**
 * Owner decision (F), 2026-10-01 (ADR-009): the AI is NEVER the source of an
 * identifier field. On the test scans the on-device model filled identifier
 * fields it could not read, some wrongly, some with values that appear nowhere
 * in the document. Name parts, DOB, SSN (any part), service number, home of record
 * and mailing address shown or saved by the DD-214 Analyzer come only from
 * dd214FieldExtractor when it is confident; otherwise the field is empty.
 *
 * This supersedes D15-1d (never the model), D16-5 and D19-1 (on-device model
 * allowed), which let an on-device value through.
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
  _parseDd214Json,
} from "./DD214Analyzer.jsx";

const FAKE_LAST = "Faketon";
const FAKE_FIRST = "Jordan";

const FIXTURE_DD214_TEXT = `
DD FORM 214 CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY
1. NAME: ${FAKE_LAST.toUpperCase()}, ${FAKE_FIRST.toUpperCase()}
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY/ACTIVE
3. SOCIAL SECURITY: 123 45 6789
5. DATE OF BIRTH: 1984 03 15
7B. HOME OF RECORD: ANYTOWN, ANYCOUNTY, TX
8A. LAST DUTY ASSIGNMENT: FORT EXAMPLE
12A. DATE ENTERED ACTIVE DUTY THIS PERIOD: 20020305
12B. SEPARATION DATE THIS PERIOD: 20100615
19. MAILING ADDRESS: 123 MAIN ST, ANYTOWN TX 12345
20. SEPARATION CODE: KND
24. CHARACTER OF SERVICE: HONORABLE
`;

const NO_IDENTIFIER_BOXES_TEXT = `
DD FORM 214 CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY/ACTIVE
12A. DATE ENTERED ACTIVE DUTY THIS PERIOD: 20020305
12B. SEPARATION DATE THIS PERIOD: 20100615
24. CHARACTER OF SERVICE: HONORABLE
`;

const IDENTIFIER_SCHEMA_KEYS = [
  "fullName",
  "lastName",
  "firstName",
  "middleName",
  "ssnLast4",
  "ssn",
  "serviceNumber",
  "dateOfBirth",
  "homeOfRecord",
  "homeAddress",
  "mailingAddress",
];

describe("(F): no DD-214 AI prompt asks for an identifier field", () => {
  it.each([
    ["local/on-device", DD214_ANALYSIS_SYSTEM_PROMPT_LOCAL],
    ["cloud", DD214_ANALYSIS_SYSTEM_PROMPT],
  ])("the %s prompt schema has no identifier key", (_label, prompt) => {
    IDENTIFIER_SCHEMA_KEYS.forEach((key) => {
      expect(prompt).not.toContain(`"${key}"`);
    });
  });

  it("the on-device prompt no longer has an identifier-extraction section", () => {
    expect(DD214_ANALYSIS_SYSTEM_PROMPT_LOCAL).not.toMatch(
      /IDENTIFIER FIELDS|extract these too|Block 1: Full Name|Block 3: SSN|Block 5: Date of Birth|Block 7: Home of Record/,
    );
  });

  it("neither prompt requests placeOfBirth (identifier-bearing under decision F)", () => {
    expect(DD214_ANALYSIS_SYSTEM_PROMPT_LOCAL).not.toContain("placeOfBirth");
    expect(DD214_ANALYSIS_SYSTEM_PROMPT).not.toContain("placeOfBirth");
  });

  it("non-identifier extraction stays in the on-device prompt", () => {
    [
      "entryDate",
      "separationDate",
      "characterOfService",
      "mos",
      "awards",
    ].forEach((key) =>
      expect(DD214_ANALYSIS_SYSTEM_PROMPT_LOCAL).toContain(`"${key}"`),
    );
  });
});

describe("(F): a model's identifier output is dropped when the response is parsed", () => {
  const t = () => "parse error";

  it("drops every identifier key and alias a model returns, keeps the rest", () => {
    const content = JSON.stringify({
      branch: "Army",
      characterOfService: "Honorable",
      fullName: "MODEL, INVENTED",
      lastName: "MODEL",
      firstName: "INVENTED",
      middleName: "X",
      ssnLast4: "0000",
      ssn: "000-00-0000",
      serviceNumber: "RA00000000",
      dateOfBirth: "1900-01-01",
      dob: "1900-01-01",
      homeOfRecord: "NOWHERE, ZZ",
      homeAddress: "1 FAKE ST",
      mailingAddress: "2 FAKE ST",
      name: "MODEL, ALIAS",
    });
    const data = _parseDd214Json(content, t);
    expect(data).toEqual({ branch: "Army", characterOfService: "Honorable" });
  });
});

describe("(F): _applyRegexSafetyNet takes identifier fields only from the local parser", () => {
  it("fills name/SSN-last-4/DOB/home of record from the local parser when confident", () => {
    const data = { branch: "Army" };
    _applyRegexSafetyNet(data, FIXTURE_DD214_TEXT, () => {});

    expect(data.fullName).toContain(FAKE_LAST.toUpperCase());
    expect(data.lastName).toBe(FAKE_LAST.toUpperCase());
    expect(data.firstName).toBe(FAKE_FIRST.toUpperCase());
    expect(data.ssnLast4).toBe("6789");
    expect(data.ssn).toBeUndefined();
    expect(data.dateOfBirth).toBe("1984-03-15");
    expect(data.homeOfRecord).toContain("ANYTOWN");
  });

  it("bridges the homeAddress / mailingAddress naming mismatch", () => {
    const data = { branch: "Army" };
    _applyRegexSafetyNet(data, FIXTURE_DD214_TEXT, () => {});
    expect(data.homeAddress).toContain("123 MAIN ST");
  });

  it("overwrites a model-supplied identifier with the local parser's value", () => {
    const data = {
      branch: "Army",
      fullName: "AI GUESS, WRONG",
      dateOfBirth: "1900-01-01",
      homeAddress: "AI-reported address",
    };
    _applyRegexSafetyNet(data, FIXTURE_DD214_TEXT, () => {});
    expect(data.fullName).toContain(FAKE_LAST.toUpperCase());
    expect(data.dateOfBirth).toBe("1984-03-15");
    expect(data.homeAddress).toContain("123 MAIN ST");
  });

  it.each(
    IDENTIFIER_SCHEMA_KEYS.filter(
      (k) => !["ssn", "serviceNumber", "mailingAddress"].includes(k),
    ),
  )(
    "leaves %s empty when the local parser finds nothing, whatever the model returned",
    (key) => {
      const data = { branch: "Army", [key]: "PLANTED MODEL VALUE 1234" };
      _applyRegexSafetyNet(data, NO_IDENTIFIER_BOXES_TEXT, () => {});
      expect(data[key]).toBe("");
    },
  );

  it("removes alias identifier keys (name/ssn/serviceNumber/dob/mailingAddress)", () => {
    const data = {
      branch: "Army",
      name: "MODEL, ALIAS",
      ssn: "999-99-9999",
      serviceNumber: "RA99999999",
      dob: "1900-01-01",
      mailingAddress: "1 FAKE ST",
    };
    _applyRegexSafetyNet(data, NO_IDENTIFIER_BOXES_TEXT, () => {});
    ["name", "ssn", "serviceNumber", "dob", "mailingAddress"].forEach((key) =>
      expect(data[key]).toBeUndefined(),
    );
  });

  it("ignores any legacy onDevice flag - an on-device model's value is not kept", () => {
    const data = { branch: "Army", fullName: "ON-DEVICE MODEL, ANSWER" };
    _applyRegexSafetyNet(data, NO_IDENTIFIER_BOXES_TEXT, () => {}, true);
    expect(data.fullName).toBe("");
  });

  it("still clears model identifiers when the combatService merge step throws", () => {
    const data = {
      branch: "Army",
      fullName: "MODEL, WRONG",
      combatService: "not-an-object",
    };
    const text =
      "1. NAME: DOE, JORDAN R\n13. DECORATIONS: COMBAT INFANTRYMAN BADGE\n14. MILITARY EDUCATION: NONE\n";
    _applyRegexSafetyNet(data, text, () => {});
    expect(data.fullName).toBe("DOE, JORDAN R");
  });
});
