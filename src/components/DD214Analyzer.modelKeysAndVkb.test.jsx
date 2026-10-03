/**
 * Decision (F), review round 2: model-invented identifiers under keys the
 * schema never asked for are dropped (allowlist, not denylist), and the
 * Knowledge Base receives an identifier only when the veteran ticked its
 * import box. Fixture values are synthetic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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
const addDocumentToVKB = vi.fn().mockResolvedValue({ documentId: "doc_1" });
const mergeDD214IntoVKB = vi.fn();
vi.mock("../utils/veteranKnowledgeBase", async (importOriginal) => ({
  ...(await importOriginal()),
  addDocumentToVKB: (...args) => addDocumentToVKB(...args),
  mergeDD214IntoVKB: (...args) => mergeDD214IntoVKB(...args),
  loadVKB: vi.fn().mockResolvedValue({ personal: {} }),
  saveVKB: vi.fn().mockResolvedValue(undefined),
}));

import {
  _parseDd214Json,
  _applyRegexSafetyNet,
  _saveDd214ToVkb,
} from "./DD214Analyzer.jsx";

const t = (_ns, key) => key;

const PLANTED = {
  SSN: "987-65-4322",
  socialSecurityNumber: "987-65-4323",
  DOB: "1971-07-08",
  veteranName: "ALIASNAME, PLANTED",
  personal: { fullName: "NESTEDNAME, PLANTED", ssn: "111-22-3333" },
  member: { name: "NESTEDMEMBER, PLANTED" },
};

describe("(F): a model identifier under any key is never kept", () => {
  it("_parseDd214Json keeps schema fields and drops every unlisted key", () => {
    const parsed = _parseDd214Json(
      JSON.stringify({ branch: "Army", mos: "11B", ...PLANTED }),
      t,
    );
    expect(parsed.branch).toBe("Army");
    expect(parsed.mos).toBe("11B");
    expect(JSON.stringify(parsed)).not.toMatch(
      /PLANTED|987-65|1971-07-08|111-22-3333/,
    );
  });

  it("_applyRegexSafetyNet drops unlisted keys on data that skipped the parser", () => {
    let result;
    _applyRegexSafetyNet(
      { branch: "Army", ...PLANTED },
      "1. NAME\nNOTHING USEFUL HERE",
      (value) => {
        result = value;
      },
    );
    expect(result.branch).toBe("Army");
    expect(JSON.stringify(result)).not.toMatch(
      /PLANTED|987-65|1971-07-08|111-22-3333/,
    );
  });
});

describe("(F): the Knowledge Base only receives identifiers the veteran ticked", () => {
  const analysis = {
    fullName: "FAKETON, JORDAN ALEX",
    lastName: "FAKETON",
    firstName: "JORDAN",
    ssnLast4: "6789",
    dateOfBirth: "1984-03-15",
    homeAddress: "123 MAIN ST, ANYTOWN TX 75001",
    branch: "Army",
  };

  beforeEach(() => {
    addDocumentToVKB.mockClear();
    mergeDD214IntoVKB.mockClear();
  });

  it("with every identifier box unticked, no identifier reaches the merge or the document", async () => {
    await _saveDd214ToVkb(analysis, "text", [], { branch: "Army" });

    const merged = mergeDD214IntoVKB.mock.calls[0][1];
    const filed = addDocumentToVKB.mock.calls[0][0].extractedData;
    [merged, filed].forEach((data) => {
      expect(data.branch).toBe("Army");
      expect(JSON.stringify(data)).not.toMatch(
        /FAKETON|6789|1984-03-15|MAIN ST/,
      );
    });
  });

  it("a ticked identifier is passed through, an unticked one is not", async () => {
    await _saveDd214ToVkb(analysis, "text", [], { dateOfBirth: "1984-03-15" });

    const merged = mergeDD214IntoVKB.mock.calls[0][1];
    expect(merged.dateOfBirth).toBe("1984-03-15");
    expect(JSON.stringify(merged)).not.toMatch(/FAKETON|6789|MAIN ST/);
  });
});
