/**
 * DD214Analyzer's manual/auto profile-import prep sent entryDate/
 * separationDate through updateVeteranProfile, whose VALID_PROFILE_FIELDS
 * whitelist (veteranProfile.js) only recognizes serviceStartDate/
 * serviceEndDate - the whitelist silently dropped both fields on save, so a
 * DD214Analyzer-only veteran's profile/dossier service span showed "? - ?"
 * even though the analyzer had extracted real dates.
 *
 * [F9] ADR-007: neither payload carries serviceStartDateDerived anymore -
 * that provenance now belongs entirely to the projection/chokepoint, not
 * to this import-prep step (the old `false` here used to survive straight
 * through to the flat profile field regardless of whether a period ever
 * backed the entry). Fixture values are synthetic, not any real veteran's
 * data.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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
  _saveDd214ToProfile,
} from "./DD214Analyzer.jsx";
import {
  getServicePeriods,
  getServiceEntry,
  upsertServicePeriod,
} from "../utils/veteranProfile.js";

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
    expect(captured.serviceStartDateDerived).toBeUndefined();
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
    expect(captured.serviceStartDateDerived).toBeUndefined();
    expect(captured.serviceEndDate).toBe("2010-06-15");
    expect(captured.entryDate).toBeUndefined();
    expect(captured.separationDate).toBeUndefined();
  });
});

describe("[DR-3] _saveDd214ToProfile creates a canonical period for a single DD-214", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      "vet_rate_veteran_profile",
      JSON.stringify({ fullName: "Jordan Sample" }),
    );
  });

  it("writes a printed period with derived false; a modal edit becomes a veteran correction", () => {
    const analysisResult = {
      dd214Count: 1,
      entryDate: "2002-03-05",
      separationDate: "2010-06-15",
      branch: "Army",
      formType: "DD214",
    };
    _saveDd214ToProfile(analysisResult, "combined text", {}, {}, [
      { filename: "dd214-synthetic.pdf" },
    ]);

    const periods = getServicePeriods();
    expect(periods).toHaveLength(1);
    expect(periods[0]).toMatchObject({
      serviceStartDate: "2002-03-05",
      serviceStartDateDerived: false,
      serviceStartDateSource: "printed",
    });

    // A modal edit (meta.serviceStartDateEdited) becomes a veteran
    // correction on that same canonical period.
    _saveDd214ToProfile(
      analysisResult,
      "combined text",
      { serviceStartDate: "2001-11-01" },
      { serviceStartDateEdited: true },
      [{ filename: "dd214-synthetic.pdf" }],
    );
    expect(getServiceEntry()).toMatchObject({
      date: "2001-11-01",
      derived: false,
      source: "veteran",
    });
  });

  it("[G2] a multi-DD214 import creates no period and records a conflict against an existing period-backed entry", () => {
    // An earlier, single DD-214 already backs the entry with a period.
    _saveDd214ToProfile(
      {
        dd214Count: 1,
        entryDate: "1998-01-05",
        separationDate: "2001-12-20",
        branch: "Army",
      },
      "combined text",
      {},
      {},
      [{ filename: "dd214-synthetic.pdf" }],
    );
    expect(getServicePeriods()).toHaveLength(1);

    // A second analysis result covering multiple DD-214s never creates a
    // second period - it can only disagree, never silently overwrite.
    _saveDd214ToProfile(
      {
        dd214Count: 2,
        entryDate: "2002-03-05",
        separationDate: "2010-06-15",
        branch: "Army",
      },
      "combined text",
      {},
      {},
      [{ filename: "multi-dd214-synthetic.pdf" }],
    );

    expect(getServicePeriods()).toHaveLength(1);
    const period = getServicePeriods()[0];
    expect(
      period.fieldConflicts.some(
        (c) =>
          c.field === "serviceStartDate" && c.conflictingValue === "2002-03-05",
      ),
    ).toBe(true);
    expect(getServiceEntry()).toMatchObject({ date: "1998-01-05" });
  });
});

describe("_saveDd214ToProfile: an edit with no eligible period must not target an unrelated enlistment", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      "vet_rate_veteran_profile",
      JSON.stringify({ fullName: "Jordan Sample" }),
    );
  });

  it("a multi-DD-214 import's edited start date does not overwrite an unrelated existing enlistment", () => {
    // An existing NGB-22 enlistment already backs the entry - no period
    // is eligible for creation from a multi-DD-214 result (dd214Count: 2).
    upsertServicePeriod(
      {
        serviceStartDate: "2002-03-05",
        serviceStartDateDerived: true,
        serviceEndDate: "2010-06-15",
        formType: "NGB22",
      },
      { sourceDocument: "ngb22-synthetic.pdf", confidence: 60 },
    );

    _saveDd214ToProfile(
      {
        dd214Count: 2,
        entryDate: "2004-01-10",
        separationDate: "2005-03-15",
        branch: "Army",
      },
      "combined text",
      { serviceStartDate: "2004-01-01" },
      { serviceStartDateEdited: true },
      [{ filename: "two-dd214s-synthetic.pdf" }],
    );

    expect(getServicePeriods()).toHaveLength(1);
    const ngbPeriod = getServicePeriods()[0];
    expect(ngbPeriod.serviceStartDate).toBe("2002-03-05");
    expect(ngbPeriod.serviceStartDateSource).toBe("calculated");
    expect(ngbPeriod.startDateCorrection).toBeNull();
  });
});
