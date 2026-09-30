/**
 * D15-1d (final15 QA review, 2026-09-28): DD214Analyzer's AI prompt schema
 * asked the model to extract the veteran's name/SSN-last-4/service number/
 * DOB/home-of-record/home-address directly from the just-uploaded DD-214's
 * raw OCR/pasted text - identifiers ADR-008 said a model must never be
 * asked to extract, even though `extractDD214Fields` (dd214FieldExtractor.js)
 * already parses every one of these fields locally via regex, box-label-
 * anchored, with zero AI involvement.
 *
 * D16-5 (owner decision, 2026-09-29, final) SUPERSEDES D15-1d's strict
 * "local parser only, never the model" rule: raw documents stay on the
 * device, so an ON-DEVICE model may now supply an identifier field too
 * (nothing left the computer). Display precedence is veteran-entered >
 * confident local parse = on-device model > empty; an OFF-DEVICE (cloud)
 * model still never supplies one. In practice this only changes behavior
 * when the local parser found NOTHING for a field - when it did (every
 * fixture below), the parser's value still wins, matching both the old and
 * new rule.
 *
 * D19-1 (2026-09-30) finishes wiring D16-5 through: the LOCAL/on-device
 * prompt's JSON schema had never actually been updated to ASK for these
 * fields (it still told the model "DO NOT extract or return" them), so an
 * on-device model had nowhere to put an identifier even though the merge
 * logic above was ready to accept one. The cloud prompt is untouched - it
 * still omits every identifier field, since cloud never receives document
 * text at all (see ADR-009) but stays identifier-free as defense in depth.
 *
 * Covers:
 *  - The LOCAL/on-device prompt's JSON schema now requests the composite
 *    identifier fields; the cloud prompt still omits them. Neither prompt
 *    requests a name sub-field or serviceNumber (see below).
 *  - `_applyRegexSafetyNet` still produces every one of those fields on the
 *    final merged result when the local parser finds them - sourced from
 *    the local regex parser instead of the model - so the veteran-visible
 *    result does not lose a field it showed before D15-1d.
 *  - The `homeAddress` (AI schema's Block-30 name) / `mailingAddress`
 *    (dd214FieldExtractor's Block-19 name) naming mismatch is bridged.
 *  - The NEW on-device/off-device precedence for the case the local parser
 *    finds nothing: an on-device model's own value is kept, an off-device
 *    (or unidentified) model's value is cleared rather than shown.
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

// D19-1 (2026-09-30) supersedes this describe block's original D15-1d
// claim for the LOCAL/on-device prompt only: since raw documents never
// leave an on-device engine (ADR-009), that prompt now asks for the
// composite identifier fields the on-device model CAN help extract
// (fullName/ssnLast4/dateOfBirth/homeOfRecord/homeAddress) - the OFF-DEVICE
// cloud prompt is untouched and still omits every one of them (cloud never
// even receives document text at all, but the prompt itself stays
// identifier-free as defense in depth). Neither prompt asks for the
// name SUB-fields (lastName/firstName/middleName come from
// `_applyRegexSafetyNet`'s own `parseName` split of `fullName`, not the
// model) or `serviceNumber` (no local-parser counterpart - see this file's
// header comment).
describe("D19-1: the AI prompt schema's identifier fields are on-device only", () => {
  const NAME_SUBFIELD_AND_SERVICE_NUMBER_LABELS = [
    '"lastName"',
    '"firstName"',
    '"middleName"',
    '"serviceNumber"',
  ];
  const ON_DEVICE_IDENTIFIER_LABELS = [
    '"fullName"',
    '"ssnLast4"',
    '"dateOfBirth"',
    '"homeOfRecord"',
    '"homeAddress"',
  ];

  it.each([
    ["local/on-device", DD214_ANALYSIS_SYSTEM_PROMPT_LOCAL],
    ["cloud", DD214_ANALYSIS_SYSTEM_PROMPT],
  ])(
    "the %s system prompt never requests a name sub-field or serviceNumber",
    (_label, prompt) => {
      NAME_SUBFIELD_AND_SERVICE_NUMBER_LABELS.forEach((label) => {
        expect(prompt).not.toContain(label);
      });
    },
  );

  it("the local/on-device prompt's JSON schema DOES request the composite identifier fields", () => {
    ON_DEVICE_IDENTIFIER_LABELS.forEach((label) => {
      expect(DD214_ANALYSIS_SYSTEM_PROMPT_LOCAL).toContain(label);
    });
  });

  it("the cloud prompt's JSON schema still omits every identifier field (defense in depth)", () => {
    ON_DEVICE_IDENTIFIER_LABELS.forEach((label) => {
      expect(DD214_ANALYSIS_SYSTEM_PROMPT).not.toContain(label);
    });
  });

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

  it("overwrites an AI-supplied homeAddress with the local regex value (owner decision D: identifier fields come from the local parser, never the model, even if one slips past the schema)", () => {
    const data = { branch: "Army", homeAddress: "AI-reported address" };
    _applyRegexSafetyNet(data, FIXTURE_DD214_TEXT, () => {});
    expect(data.homeAddress).toContain("123 MAIN ST");
    expect(data.homeAddress).not.toBe("AI-reported address");
  });

  it("overwrites an AI-supplied fullName/dateOfBirth with the local regex value the same way", () => {
    const data = {
      branch: "Army",
      fullName: "AI GUESS, WRONG",
      dateOfBirth: "1900-01-01",
    };
    _applyRegexSafetyNet(data, FIXTURE_DD214_TEXT, () => {});
    expect(data.fullName).toContain(FAKE_LAST.toUpperCase());
    expect(data.dateOfBirth).toBe("1984-03-15");
  });
});

// D16-5: text with NONE of the local parser's identifier boxes present, so
// `regexResult.fields` has nothing for any identifier field - the only way
// to exercise the on-device/off-device precedence, since every fixture
// above gives the local parser a confident value that wins regardless.
const NO_IDENTIFIER_BOXES_TEXT = `
DD FORM 214 CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY/ACTIVE
12A. DATE ENTERED ACTIVE DUTY THIS PERIOD: 20020305
12B. SEPARATION DATE THIS PERIOD: 20100615
24. CHARACTER OF SERVICE: HONORABLE
`;

describe("D16-5: on-device/off-device precedence when the local parser finds nothing", () => {
  it("keeps an on-device model's own identifier value (onDevice: true)", () => {
    const data = { branch: "Army", fullName: "ON-DEVICE MODEL, ANSWER" };
    _applyRegexSafetyNet(data, NO_IDENTIFIER_BOXES_TEXT, () => {}, true);
    expect(data.fullName).toBe("ON-DEVICE MODEL, ANSWER");
  });

  it("clears an off-device model's identifier value rather than showing it (onDevice: false)", () => {
    const data = { branch: "Army", fullName: "CLOUD MODEL, ANSWER" };
    _applyRegexSafetyNet(data, NO_IDENTIFIER_BOXES_TEXT, () => {}, false);
    expect(data.fullName).toBe("");
  });

  it("clears an identifier value when onDevice is undefined (fails closed)", () => {
    const data = { branch: "Army", homeOfRecord: "UNKNOWN-MODE ANSWER" };
    _applyRegexSafetyNet(data, NO_IDENTIFIER_BOXES_TEXT, () => {}, undefined);
    expect(data.homeOfRecord).toBe("");
  });

  it("clears an identifier value when onDevice is truthy but not strictly true (fails closed)", () => {
    const data = { branch: "Army", fullName: "TRUTHY-STRING MODE ANSWER" };
    _applyRegexSafetyNet(data, NO_IDENTIFIER_BOXES_TEXT, () => {}, "true");
    expect(data.fullName).toBe("");
  });

  it("clears homeAddress (the AI schema's Block-30 name) the same way when off-device", () => {
    const data = { branch: "Army", homeAddress: "CLOUD MODEL ADDRESS" };
    _applyRegexSafetyNet(data, NO_IDENTIFIER_BOXES_TEXT, () => {}, false);
    expect(data.homeAddress).toBe("");
  });

  it("clears alias identifier keys (name/ssn/serviceNumber) off-device even though the local parser never produces them", () => {
    const data = {
      branch: "Army",
      name: "CLOUD MODEL, ALIAS",
      ssn: "999-99-9999",
      serviceNumber: "RA99999999",
    };
    _applyRegexSafetyNet(data, NO_IDENTIFIER_BOXES_TEXT, () => {}, false);
    expect(data.name).toBe("");
    expect(data.ssn).toBe("");
    expect(data.serviceNumber).toBe("");
  });

  it("leaves alias identifier keys alone when onDevice is true", () => {
    const data = {
      branch: "Army",
      name: "ON-DEVICE MODEL, ALIAS",
      ssn: "111-22-3333",
      serviceNumber: "RA11112222",
    };
    _applyRegexSafetyNet(data, NO_IDENTIFIER_BOXES_TEXT, () => {}, true);
    expect(data.name).toBe("ON-DEVICE MODEL, ALIAS");
    expect(data.ssn).toBe("111-22-3333");
    expect(data.serviceNumber).toBe("RA11112222");
  });

  // A non-array combatService (e.g. a model emitting the string "Yes"
  // instead of the schema's object shape) makes mergeCombatServiceIndicators
  // throw when the document has a real combat decoration - identifier
  // clearing must still run (fail-closed), never be skipped because this
  // unrelated merge step threw. Confirmed via a temporary base-commit
  // (cc34ecbb) snapshot that this exact scenario leaked the planted
  // sentinel there.
  it("clears an off-device identifier even when the combatService merge step throws", () => {
    const data = {
      branch: "Army",
      fullName: "CLOUD MODEL, WRONG",
      combatService: "not-an-object",
    };
    const text =
      "1. NAME: DOE, JORDAN R\n13. DECORATIONS: COMBAT INFANTRYMAN BADGE\n14. MILITARY EDUCATION: NONE\n";
    _applyRegexSafetyNet(data, text, () => {}, false);
    expect(data.fullName).not.toBe("CLOUD MODEL, WRONG");
    expect(data.fullName).toBe("DOE, JORDAN R");
  });
});
