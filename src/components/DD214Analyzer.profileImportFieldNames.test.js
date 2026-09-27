/**
 * DD214Analyzer's manual/auto profile-import prep sent entryDate/
 * separationDate through updateVeteranProfile, whose VALID_PROFILE_FIELDS
 * whitelist (veteranProfile.js) only recognizes serviceStartDate/
 * serviceEndDate - the whitelist silently dropped both fields on save, so a
 * DD214Analyzer-only veteran's profile/dossier service span showed "? - ?"
 * even though the analyzer had extracted real dates. Fixture values are
 * synthetic, not any real veteran's data.
 */
import { describe, it, expect, vi } from "vitest";

// DD214Analyzer.jsx pulls in documentAnalyzer.js -> ocr.js -> pdfjs-dist,
// which needs DOMMatrix (unavailable in jsdom) - stub the module, matching
// DocumentIntelligenceBriefing's own test-file pattern for the same
// transitive dependency. Only OCR_STATES/getProgressStyling need real
// shapes; the two functions under test never touch them.
vi.mock("../utils/documentAnalyzer", () => ({
  OCR_STATES: {},
  getProgressStyling: () => ({}),
  formatFileSize: (bytes) => `${bytes} bytes`,
  isFileSupported: () => true,
  getAcceptString: () => "",
}));

// musterCallProcessor.js -> pdfExtractor.js -> pdfjs-dist, same DOMMatrix
// problem as above.
vi.mock("../utils/musterCallProcessor", () => ({
  processFormationDocument: vi.fn(),
  PROCESSING_STATES: { EXTRACTING: "EXTRACTING", COMPLETE: "COMPLETE" },
}));

// smolVLMService.js -> florencePdfUtils.js -> pdfjs-dist, same problem.
vi.mock("../utils/smolVLMService", () => ({
  smolVLMService: {},
  isSmolVLMSupported: () => false,
}));

import {
  _prepareAndShowProfileImport,
  _prepareManualProfileImport,
} from "./DD214Analyzer.jsx";

describe("DD214Analyzer: profile import uses the whitelisted field names", () => {
  it("_prepareAndShowProfileImport sends serviceStartDate/serviceEndDate, not entryDate/separationDate", () => {
    let captured = null;
    _prepareAndShowProfileImport(
      {
        fullName: "Jordan Sample",
        entryDate: "2002-03-05",
        separationDate: "2010-06-15",
      },
      (data) => {
        captured = data;
      },
      () => {},
    );

    expect(captured.serviceStartDate).toBe("2002-03-05");
    expect(captured.serviceStartDateDerived).toBe(false);
    expect(captured.serviceEndDate).toBe("2010-06-15");
    expect(captured.entryDate).toBeUndefined();
    expect(captured.separationDate).toBeUndefined();
  });

  it("_prepareManualProfileImport sends serviceStartDate/serviceEndDate, not entryDate/separationDate", () => {
    let captured = null;
    _prepareManualProfileImport(
      {
        branch: "Army",
        entryDate: "2002-03-05",
        separationDate: "2010-06-15",
      },
      (data) => {
        captured = data;
      },
      () => {},
      () => {},
      () => "",
    );

    expect(captured.serviceStartDate).toBe("2002-03-05");
    expect(captured.serviceStartDateDerived).toBe(false);
    expect(captured.serviceEndDate).toBe("2010-06-15");
    expect(captured.entryDate).toBeUndefined();
    expect(captured.separationDate).toBeUndefined();
  });
});
