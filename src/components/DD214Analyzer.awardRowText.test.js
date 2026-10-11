/**
 * The awards row on the DD-214 review screen shows what will be saved: the
 * award name plus the award number and devices the document printed. The
 * parser splits those off the name into deviceCount and devices, and the
 * saved award keeps them, so the row must too - without readmitting the
 * caption text or the next box that the parser guards removed. All award
 * lists here are invented.
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

import { _listImportText } from "./DD214Analyzer.jsx";
import { extractDD214Fields } from "../utils/dd214FieldExtractor";
import { sanitizeParserFields } from "../utils/dd214ParserTextGuards";

const printedForm = (awardsText) => `
DD FORM 214 CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY
12A. DATE ENTERED ACTIVE DUTY THIS PERIOD: 20020305
12B. SEPARATION DATE THIS PERIOD: 20100615
13. DECORATIONS, MEDALS, BADGES, CITATIONS AND CAMPAIGN RIBBONS AWARDED OR AUTHORIZED (ALL PERIODS OF SERVICE): ${awardsText}
14. MILITARY EDUCATION: SAMPLE BASIC COURSE
24. CHARACTER OF SERVICE: HONORABLE
`;

describe("_listImportText awards row", () => {
  it("keeps the award number and devices the saved awards keep", () => {
    const awards = [
      { name: "Sample Service Medal", deviceCount: 2, devices: [] },
      { name: "Sample Flight Medal", deviceCount: 0, devices: ["M Device"] },
      {
        name: "Sample Campaign Medal",
        deviceCount: 0,
        devices: ["Bronze Service Star", "Bronze Service Star"],
      },
      { name: "Sample Conduct Medal", deviceCount: 0, devices: [] },
    ];

    expect(_listImportText({ awards }).awards).toBe(
      [
        "Sample Service Medal (2nd award)",
        "Sample Flight Medal with M Device",
        "Sample Campaign Medal with 2 Bronze Service Star",
        "Sample Conduct Medal",
      ].join("; "),
    );
  });

  it("leaves the row out when no award has a name", () => {
    expect(_listImportText({ awards: [{ deviceCount: 2 }] })).toEqual({});
  });

  it("shows, for a printed list, exactly the name, number and devices the parser saved", () => {
    const parsed = extractDD214Fields(
      printedForm(
        "Sample Service Medal (2nd award)//Sample Flight Medal w/ M Device//Sample Campaign Medal w/ 2 Bronze Service Star//Sample Conduct Medal//Sample Unit Citation-3",
      ),
    );
    const awards = sanitizeParserFields(parsed.fields).awards;

    const row = _listImportText({ awards }).awards;

    expect(row).toBe(
      [
        "SAMPLE SERVICE MEDAL (2nd award)",
        "SAMPLE FLIGHT MEDAL with M Device",
        "SAMPLE CAMPAIGN MEDAL with 2 Bronze Service Star",
        "SAMPLE CONDUCT MEDAL",
        "SAMPLE UNIT CITATION (3rd award)",
      ].join("; "),
    );
  });

  it("does not readmit the box label or the next box's text", () => {
    const parsed = extractDD214Fields(
      printedForm("Sample Service Medal (2nd award)//Sample Flight Medal"),
    );
    const awards = sanitizeParserFields(parsed.fields).awards;

    const row = _listImportText({ awards }).awards;

    expect(row).toBe("SAMPLE SERVICE MEDAL (2nd award); SAMPLE FLIGHT MEDAL");
    expect(row).not.toMatch(
      /DECORATIONS|CAMPAIGN RIBBONS|EDUCATION|BASIC COURSE|CHARACTER/i,
    );
  });
});
