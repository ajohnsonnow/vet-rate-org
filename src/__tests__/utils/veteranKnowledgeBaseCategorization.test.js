/**
 * Regression: musterCallProcessor.js passes result.classification.type — the
 * raw DOCUMENT_TYPES enum value from documentClassifier.js (e.g. "CLAIM_LETTER",
 * "RATING_DECISION") — straight into addDocumentToVKB. categorizeDocument's
 * switch only matched lowercase/snake_case labels ("claim_letter",
 * "rating_decision"), the convention used by DD214Analyzer/BlueButtonXRay's
 * hardcoded call sites. Every Muster Call document except DD214 (an
 * accidental case-match) silently fell through to the "otherEvidence"
 * default — rating decisions and claim letters never reached documentation.cFiles.
 */
import { describe, it, expect } from "vitest";
import { categorizeDocument } from "../../utils/veteranKnowledgeBase";
import { DOCUMENT_TYPES } from "../../utils/documentClassifier";

describe("categorizeDocument", () => {
  it("routes DOCUMENT_TYPES enum values from documentClassifier (Muster Call) to the correct VKB bucket", () => {
    expect(categorizeDocument(DOCUMENT_TYPES.DD214)).toBe("dd214s");
    expect(categorizeDocument(DOCUMENT_TYPES.DD215)).toBe("dd214s");
    expect(categorizeDocument(DOCUMENT_TYPES.NGB22)).toBe("dd214s");
    expect(categorizeDocument(DOCUMENT_TYPES.RATING_DECISION)).toBe("cFiles");
    expect(categorizeDocument(DOCUMENT_TYPES.CLAIM_LETTER)).toBe("cFiles");
    expect(categorizeDocument(DOCUMENT_TYPES.C_FILE_MEDICAL)).toBe("cFiles");
    expect(categorizeDocument(DOCUMENT_TYPES.VA_CORRESPONDENCE)).toBe("cFiles");
    expect(categorizeDocument(DOCUMENT_TYPES.DBQ)).toBe("cFiles");
    expect(categorizeDocument(DOCUMENT_TYPES.EXAM_REPORT)).toBe("cFiles");
    expect(categorizeDocument(DOCUMENT_TYPES.NEXUS_LETTER)).toBe(
      "privateRecords",
    );
    expect(categorizeDocument(DOCUMENT_TYPES.PERSONAL_STATEMENT)).toBe(
      "privateRecords",
    );
    expect(categorizeDocument(DOCUMENT_TYPES.MEDICAL_RECORD)).toBe(
      "blueButtonReports",
    );
    expect(categorizeDocument(DOCUMENT_TYPES.UNKNOWN)).toBe("otherEvidence");
  });

  it("still routes the legacy lowercase labels used by DD214Analyzer/BlueButtonXRay's hardcoded call sites", () => {
    expect(categorizeDocument("DD214")).toBe("dd214s");
    expect(categorizeDocument("blue_button")).toBe("blueButtonReports");
    expect(categorizeDocument("rating_decision")).toBe("cFiles");
    expect(categorizeDocument("claim_letter")).toBe("cFiles");
    expect(categorizeDocument("nexus_letter")).toBe("privateRecords");
  });
});
