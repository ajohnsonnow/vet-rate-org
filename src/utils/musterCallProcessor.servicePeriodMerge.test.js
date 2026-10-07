/**
 * S46 QA follow-up, item 5 (2026-09-24): two gaps in how musterCallProcessor
 * writes service periods -
 *  - the NGB-22 Box 18 activation-breakdown periods (_saveNGB22AdditionalPeriods)
 *    never carried the DD214's own rank, so every AD/IADT period showed no
 *    rank at all;
 *  - a code sheet upserting onto an already-NGB22-sourced period left that
 *    period's stale formType: "NGB22" in place, so VA's own authoritative
 *    record was mislabeled "(NGB22)" in the UI.
 * Fixture values are synthetic.
 */
import { describe, it, expect, beforeEach } from "vitest";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const {
  parseServiceRecord,
  saveServiceRecordToProfile,
  saveCodeSheetServicePeriodsToProfile,
} = await import("./musterCallProcessor");
const {
  getServicePeriods,
  getUnmatchedServiceRecords,
  getServiceHistory,
  upsertServicePeriod,
  setServiceEntryDate,
} = await import("./veteranProfile");
const { periodDisplayFormType } = await import("./veteranKnowledgeBase");

const REALISTIC_NGB22 = `
1. NAME (Last, First, Middle): DOE, JOHN ROBERT
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY
4a. GRADE, RATE OR RANK: SGT
4b. PAY GRADE: E-5
5. DATE OF BIRTH: 01/15/1980
7a. PLACE OF ENTRY: PORTLAND OR
11. PRIMARY SPECIALTY: 92Y UNIT SUPPLY SPECIALIST
12a. DATE ENTERED AD THIS PERIOD: 06/22/2004
12b. DATE OF SEPARATION: 08/27/2005
13. DECORATIONS, MEDALS, BADGES: ARMY ACHIEVEMENT MEDAL
14. MILITARY EDUCATION: PRIMARY LEADERSHIP DEVELOPMENT COURSE
18. REMARKS: IADT: 20040101-20040301//AD: 20040622-20050827//NOTHING FOLLOWS
23. TYPE OF SEPARATION: RELEASE FROM ACTIVE DUTY
24. CHARACTER OF SERVICE: HONORABLE
25. SEPARATION AUTHORITY: AR 635-200
26. SEPARATION CODE: MBK
27. REENTRY CODE: RE-1
28. NARRATIVE REASON: COMPLETION OF REQUIRED ACTIVE SERVICE
`;

describe("saveServiceRecordToProfile: NGB-22 additional-period rank attachment", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("attaches the DD214's rank to the AD period matching its own separation date, not the earlier IADT period", async () => {
    const extractedData = await parseServiceRecord(REALISTIC_NGB22, "NGB22");
    saveServiceRecordToProfile({ name: "ngb22.pdf" }, { extractedData });

    const periods = getServicePeriods();
    // REALISTIC_NGB22's Box-18 AD window shares its dates with the primary
    // 12a/12b period (the Box-18 window demotion fixture, final15 QA
    // review) - scoped to periodScope === "window" so this specifically
    // exercises the AD WINDOW's own terminal-AD rank attachment
    // (_saveNGB22AdditionalPeriods), not the primary period that happens
    // to share its dates (which gets its rank from Box 4a directly, a
    // different code path entirely).
    const ad = periods.find(
      (p) =>
        p.serviceStartDate === "2004-06-22" &&
        p.serviceEndDate === "2005-08-27" &&
        p.periodScope === "window",
    );
    const iadt = periods.find(
      (p) =>
        p.serviceStartDate === "2004-01-01" &&
        p.serviceEndDate === "2004-03-01",
    );

    expect(ad).toBeDefined();
    expect(ad.rank).toBe("SGT");
    expect(iadt).toBeDefined();
    expect(iadt.rank).toBe("");

    // The primary/enlistment period is a separate row, never demoted to
    // periodScope "window" by its own coinciding Box-18 sub-period.
    const primary = periods.find(
      (p) =>
        p.serviceStartDate === "2004-06-22" &&
        p.serviceEndDate === "2005-08-27" &&
        p.periodScope !== "window",
    );
    expect(primary).toBeDefined();
    expect(primary.rank).toBe("SGT");
  });
});

// D11-4 (final11 QA, 2026-09-27): candidate.separationDate (Box 12b) isn't
// always extracted from an NGB-22. D-2 (final7 QA, 2026-09-24) used to fall
// back to stamping the rank onto "the sole/latest Active Duty period" as a
// proxy in that case - reverted, because that's still a guess: without an
// extracted separation date, nothing on the document proves the rank field
// applies to that specific window at all. No rank is attached via this path
// until a document (this one, or a later DD214 for that same window)
// actually proves the link.
const NGB22_NO_SEPARATION_DATE = `
1. NAME (Last, First, Middle): DOE, JOHN ROBERT
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY
4a. GRADE, RATE OR RANK: SGT
4b. PAY GRADE: E-5
7a. PLACE OF ENTRY: PORTLAND OR
18. REMARKS: IADT: 20040101-20040301//AD: 20040622-20050827//NOTHING FOLLOWS
23. TYPE OF SEPARATION: RELEASE FROM ACTIVE DUTY
24. CHARACTER OF SERVICE: HONORABLE
25. SEPARATION AUTHORITY: AR 635-200
26. SEPARATION CODE: MBK
27. REENTRY CODE: RE-1
28. NARRATIVE REASON: COMPLETION OF REQUIRED ACTIVE SERVICE
`;

describe("saveServiceRecordToProfile: NGB-22 rank attachment without a Box 12b date", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not guess rank onto the sole Active Duty period when the document's own separation date wasn't extracted", async () => {
    const extractedData = await parseServiceRecord(
      NGB22_NO_SEPARATION_DATE,
      "NGB22",
    );
    expect(extractedData.serviceEndDate).toBeFalsy();
    saveServiceRecordToProfile({ name: "ngb22_no_sep.pdf" }, { extractedData });

    const periods = getServicePeriods();
    const ad = periods.find(
      (p) =>
        p.serviceStartDate === "2004-06-22" &&
        p.serviceEndDate === "2005-08-27",
    );
    const iadt = periods.find(
      (p) =>
        p.serviceStartDate === "2004-01-01" &&
        p.serviceEndDate === "2004-03-01",
    );

    expect(ad).toBeDefined();
    expect(ad.rank).toBe("");
    expect(iadt).toBeDefined();
    expect(iadt.rank).toBe("");
  });

  it("attaches rank to that same Active Duty period once a later document supplies its own separation date proving the link", async () => {
    const extractedData = await parseServiceRecord(
      NGB22_NO_SEPARATION_DATE,
      "NGB22",
    );
    saveServiceRecordToProfile({ name: "ngb22_no_sep.pdf" }, { extractedData });

    // Precondition, not a duplicate of the sibling test above: without this
    // assertion, a reintroduced guess-the-rank fallback would still leave
    // this test green, since the upsertServicePeriod below overwrites
    // whatever rank was already there with the same value either way.
    const before = getServicePeriods().find(
      (p) =>
        p.serviceStartDate === "2004-06-22" &&
        p.serviceEndDate === "2005-08-27",
    );
    expect(before.rank).toBe("");

    upsertServicePeriod(
      {
        serviceStartDate: "2004-06-22",
        serviceEndDate: "2005-08-27",
        rank: "SGT",
      },
      { sourceDocument: "dd214_ad_window.pdf", confidence: 90 },
    );

    const ad = getServicePeriods().find(
      (p) =>
        p.serviceStartDate === "2004-06-22" &&
        p.serviceEndDate === "2005-08-27",
    );
    expect(ad.rank).toBe("SGT");
  });
});

// Observation 1 (final10 QA, 2026-09-25) computed the terminal-AD rank
// fallback unconditionally so a separation date that does NOT equal the
// terminal AD window's own end date (routine for a Guard member, whose
// overall discharge post-dates their last individual activation by years
// of ordinary drilling) would still attach the NGB-22's own rank to
// whichever AD window happened to be chronologically last. Reverted in
// final10 QA's correctness re-review (2026-09-26): that stamps the rank
// AS OF THE 2007 SEPARATION onto a window that ended in 2005, with
// nothing on the document proving the veteran held that rank two years
// earlier - the standing data rule ("never guess a link") means no rank
// on that window is the honest result until a real DD214 for it supplies
// one. Same REMARKS windows as REALISTIC_NGB22 above; only Box 12b's date
// changes to one that post-dates the AD window's own end.
const NGB22_SEPARATION_DATE_AFTER_LAST_AD_WINDOW = `
1. NAME (Last, First, Middle): DOE, JOHN ROBERT
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY
4a. GRADE, RATE OR RANK: SGT
4b. PAY GRADE: E-5
5. DATE OF BIRTH: 01/15/1980
7a. PLACE OF ENTRY: PORTLAND OR
11. PRIMARY SPECIALTY: 92Y UNIT SUPPLY SPECIALIST
12a. DATE ENTERED AD THIS PERIOD: 06/22/2004
12b. DATE OF SEPARATION: 08/27/2007
13. DECORATIONS, MEDALS, BADGES: ARMY ACHIEVEMENT MEDAL
14. MILITARY EDUCATION: PRIMARY LEADERSHIP DEVELOPMENT COURSE
18. REMARKS: IADT: 20040101-20040301//AD: 20040622-20050827//NOTHING FOLLOWS
23. TYPE OF SEPARATION: RELEASE FROM ACTIVE DUTY
24. CHARACTER OF SERVICE: HONORABLE
25. SEPARATION AUTHORITY: AR 635-200
26. SEPARATION CODE: MBK
27. REENTRY CODE: RE-1
28. NARRATIVE REASON: COMPLETION OF REQUIRED ACTIVE SERVICE
`;

describe("Observation 1 regression (final10 QA correctness re-review, 2026-09-26): rank must not attach without a proven link", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not attach rank to an AD window when the document's separation date belongs to a later, undocumented window", async () => {
    const extractedData = await parseServiceRecord(
      NGB22_SEPARATION_DATE_AFTER_LAST_AD_WINDOW,
      "NGB22",
    );
    expect(extractedData.serviceEndDate).toBe("08/27/2007");
    saveServiceRecordToProfile(
      { name: "ngb22_late_separation.pdf" },
      { extractedData },
    );

    const periods = getServicePeriods();
    const ad = periods.find(
      (p) =>
        p.serviceStartDate === "2004-06-22" &&
        p.serviceEndDate === "2005-08-27",
    );
    const iadt = periods.find(
      (p) =>
        p.serviceStartDate === "2004-01-01" &&
        p.serviceEndDate === "2004-03-01",
    );

    expect(ad).toBeDefined();
    expect(ad.rank).toBe("");
    expect(iadt).toBeDefined();
    expect(iadt.rank).toBe("");
  });

  it("lets a real DD214 for that window supply its own rank afterward, unblocked by any guessed rank", async () => {
    const extractedData = await parseServiceRecord(
      NGB22_SEPARATION_DATE_AFTER_LAST_AD_WINDOW,
      "NGB22",
    );
    saveServiceRecordToProfile(
      { name: "ngb22_late_separation.pdf" },
      { extractedData },
    );

    upsertServicePeriod(
      {
        serviceStartDate: "2004-06-22",
        serviceEndDate: "2005-08-27",
        rank: "SPC",
      },
      { sourceDocument: "dd214_ad_window.pdf", confidence: 90 },
    );

    const ad = getServicePeriods().find(
      (p) =>
        p.serviceStartDate === "2004-06-22" &&
        p.serviceEndDate === "2005-08-27",
    );
    expect(ad.rank).toBe("SPC");
  });
});

describe("saveCodeSheetServicePeriodsToProfile: labels its own source correctly", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // REALISTIC_NGB22's Box-18 AD window shares its dates with the primary
  // 12a/12b period (the Box-18 window demotion fixture, final15 QA review)
  // - both are real, separate rows at the same dates once the demotion fix
  // lands, so every query here is scoped to periodScope !== "window" to
  // land on the primary/enlistment row specifically, not whichever of the
  // two `.find()` happens to hit first.
  it("relabels an NGB-22-sourced period as Code Sheet once VA's own record confirms it, instead of keeping the stale NGB22 label", async () => {
    const extractedData = await parseServiceRecord(REALISTIC_NGB22, "NGB22");
    saveServiceRecordToProfile({ name: "ngb22.pdf" }, { extractedData });
    const primaryBefore = getServicePeriods().find(
      (p) => p.serviceStartDate === "2004-06-22" && p.periodScope !== "window",
    );
    expect(primaryBefore).toBeDefined();
    expect(primaryBefore.formType).toBe("NGB22");

    saveCodeSheetServicePeriodsToProfile(
      { name: "cfile_codesheet.pdf" },
      {
        extractedData: {
          ratingSource: "code_sheet",
          servicePeriods: [
            {
              entryDate: "2004-06-22",
              separationDate: "2005-08-27",
              branch: "Army",
              characterOfDischarge: "Honorable",
            },
          ],
        },
      },
    );

    const period = getServicePeriods().find(
      (p) => p.serviceStartDate === "2004-06-22" && p.periodScope !== "window",
    );
    expect(period.formType).toBe("Code Sheet");
    expect(period.characterOfService).toBe("Honorable");

    // The Box-18 window at the SAME dates is a separate row, untouched by
    // the code sheet's update to the primary.
    const window = getServicePeriods().find(
      (p) => p.serviceStartDate === "2004-06-22" && p.periodScope === "window",
    );
    expect(window).toBeDefined();
    expect(window.formType).toBe("NGB22");
  });
});

// Same shape as REALISTIC_NGB22 but with no Item 18 Box-18 breakdown.
// Historical note (superseded by the Box-18 window demotion fix, final15
// QA review): this fixture used to be REQUIRED for item 4's correction
// test below, because a Box-18 window sharing dates with the primary
// period used to merge onto it and permanently lock periodScope to
// "window" (excluded from setServiceEntryDate's correction path). That
// demotion no longer happens - a coinciding window now stays its own
// separate row (see _scopeCompatible/_isOwnSiblingWindow) - but this
// simpler no-Box-18 fixture is kept as-is since item 4 doesn't need a
// window at all to exercise the correction/re-import behavior it tests.
const NGB22_NO_BOX18 = `
1. NAME (Last, First, Middle): DOE, JOHN ROBERT
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY
4a. GRADE, RATE OR RANK: SGT
4b. PAY GRADE: E-5
5. DATE OF BIRTH: 01/15/1980
7a. PLACE OF ENTRY: PORTLAND OR
11. PRIMARY SPECIALTY: 92Y UNIT SUPPLY SPECIALIST
12a. DATE ENTERED AD THIS PERIOD: 06/22/2004
12b. DATE OF SEPARATION: 08/27/2005
13. DECORATIONS, MEDALS, BADGES: ARMY ACHIEVEMENT MEDAL
14. MILITARY EDUCATION: PRIMARY LEADERSHIP DEVELOPMENT COURSE
23. TYPE OF SEPARATION: RELEASE FROM ACTIVE DUTY
24. CHARACTER OF SERVICE: HONORABLE
25. SEPARATION AUTHORITY: AR 635-200
26. SEPARATION CODE: MBK
27. REENTRY CODE: RE-1
28. NARRATIVE REASON: COMPLETION OF REQUIRED ACTIVE SERVICE
`;

const CODE_SHEET_RESULT = {
  extractedData: {
    ratingSource: "code_sheet",
    servicePeriods: [
      {
        entryDate: "2004-06-22",
        separationDate: "2005-08-27",
        branch: "Army",
        characterOfDischarge: "Honorable",
      },
    ],
  },
};

// Item 3 (final14 QA, "what you see is what was imported"): a genuine
// NGB-22 enlistment period's DISPLAY label must read "NGB22" regardless of
// which order the NGB-22/code sheet arrived in - the raw STORED formType is
// allowed to legitimately relabel to "Code Sheet" (the test above pins that
// intent, unchanged), but periodDisplayFormType is the order-independent
// label every human/AI-facing surface (Service tab, My Packet, AI context)
// must use instead.
describe("periodDisplayFormType: order-independent document label (item 3)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reads NGB22 when the NGB-22 is imported BEFORE the code sheet", async () => {
    const extractedData = await parseServiceRecord(REALISTIC_NGB22, "NGB22");
    saveServiceRecordToProfile({ name: "ngb22.pdf" }, { extractedData });
    saveCodeSheetServicePeriodsToProfile(
      { name: "cfile_codesheet.pdf" },
      CODE_SHEET_RESULT,
    );

    const period = getServicePeriods().find(
      (p) => p.serviceStartDate === "2004-06-22",
    );
    expect(periodDisplayFormType(period)).toBe("NGB22");
  });

  it("still reads NGB22 when the code sheet is imported BEFORE the NGB-22 (the import-order-dependent case this item fixes)", async () => {
    saveCodeSheetServicePeriodsToProfile(
      { name: "cfile_codesheet.pdf" },
      CODE_SHEET_RESULT,
    );
    const extractedData = await parseServiceRecord(REALISTIC_NGB22, "NGB22");
    saveServiceRecordToProfile({ name: "ngb22.pdf" }, { extractedData });

    const period = getServicePeriods().find(
      (p) => p.serviceStartDate === "2004-06-22",
    );
    expect(periodDisplayFormType(period)).toBe("NGB22");
  });
});

// Item 4 (final14 QA, flagged as implicit): re-processing the SAME code
// sheet a second time, after a veteran correction has already locked this
// period's formType/sourceDocument, must not create a duplicate period,
// must not revert the correction, and must not lose provenance.
describe("code-sheet re-import after a veteran correction (item 4)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("re-processing the same code sheet twice after a correction: no duplicate period, correction kept, provenance kept", async () => {
    const extractedData = await parseServiceRecord(NGB22_NO_BOX18, "NGB22");
    saveServiceRecordToProfile({ name: "ngb22.pdf" }, { extractedData });
    saveCodeSheetServicePeriodsToProfile(
      { name: "cfile_codesheet.pdf" },
      CODE_SHEET_RESULT,
    );

    const beforeCorrection = getServicePeriods().find(
      (p) => p.serviceStartDate === "2004-06-22",
    );
    expect(beforeCorrection).toBeDefined();
    expect(beforeCorrection.periodScope).not.toBe("window");

    const correctionResult = setServiceEntryDate({
      date: "2004-06-25",
      via: "my_packet",
      periodId: beforeCorrection.id,
    });
    expect(correctionResult.ok).toBe(true);

    const totalPeriodsBeforeReimport = getServicePeriods().length;

    // Re-process the identical code sheet TWICE more (e.g. the veteran
    // re-uploads the same C-File on two separate occasions) - a duplicate
    // that only appeared on a later re-import would slip past a single
    // re-import.
    saveCodeSheetServicePeriodsToProfile(
      { name: "cfile_codesheet.pdf" },
      CODE_SHEET_RESULT,
    );
    saveCodeSheetServicePeriodsToProfile(
      { name: "cfile_codesheet.pdf" },
      CODE_SHEET_RESULT,
    );

    // No duplicate period AT ALL - not just none at the corrected date. A
    // regression that re-creates a period at the code sheet's own
    // (uncorrected) date instead of merging into the corrected one would
    // pass a check scoped only to serviceStartDate === "2004-06-25".
    expect(getServicePeriods()).toHaveLength(totalPeriodsBeforeReimport);
    expect(
      getServicePeriods().some((p) => p.serviceStartDate === "2004-06-22"),
    ).toBe(false);

    const periodsAtCorrectedDate = getServicePeriods().filter(
      (p) => p.serviceStartDate === "2004-06-25",
    );
    expect(periodsAtCorrectedDate).toHaveLength(1);
    const period = periodsAtCorrectedDate[0];
    // Correction kept - the re-import never moved the date back.
    expect(period.serviceStartDate).toBe("2004-06-25");
    expect(period.serviceStartDateSource).toBe("veteran");
    // Provenance kept - both documents are still recorded as sources. The
    // raw formType/sourceDocument follow whichever document most recently
    // contributed (the re-imported code sheet) - periodDisplayFormType is
    // the order-independent, sticky label a UI must read instead (see
    // MyPacket.jsx's DD214PeriodDetailCard).
    expect(period.formType).toBe("Code Sheet");
    expect(period.sourceDocument).toBe("cfile_codesheet.pdf");
    expect(periodDisplayFormType(period)).toBe("NGB22");
    expect(
      (period.sources || []).some(
        (s) => s.sourceDocument === "cfile_codesheet.pdf",
      ),
    ).toBe(true);
    expect(
      (period.sources || []).some((s) => s.sourceDocument === "ngb22.pdf"),
    ).toBe(true);
  });
});

// N9c (final9 QA, 2026-09-25): a real NGB-22 never carries a DD-214-style
// Box 12a/12b "date entered"/"separation date" pair - only Item 8's own
// separation date and Item 10's "NET SERVICE THIS PERIOD" duration, which
// that separation date counts back from. Fixture values are synthetic.
const NGB22_WITH_NET_SERVICE = `
1. LAST NAME - FIRST NAME - MIDDLE NAME    2. DEPARTMENT, COMPONENT AND BRANCH
SAMPLE JORDAN TAYLOR                        ARNGUS/CAARNG

5a. RANK
SSG

8a. STATION OR INSTALLATION AT WHICH EFFECTED   YR MO DA
HHC 1-100 IN, ANYTOWN, ST 00000                 DATE 2010 | 06 | 15

9. COMMAND TO WHICH TRANSFERRED    10. RECORD OF SERVICE   YRS MOS DAYS
(a) NET SERVICE THIS PERIOD   08 | 03 | 10

18. REMARKS: IADT: 20030601-20031015//AD: 20090101-20091231//NOTHING FOLLOWS

24. CHARACTER OF SERVICE
HONORABLE
`;

const NGB22_WITHOUT_NET_SERVICE = `
1. LAST NAME - FIRST NAME - MIDDLE NAME    2. DEPARTMENT, COMPONENT AND BRANCH
SAMPLE JORDAN TAYLOR                        ARNGUS/CAARNG

5a. RANK
SSG

8a. STATION OR INSTALLATION AT WHICH EFFECTED   YR MO DA
HHC 1-100 IN, ANYTOWN, ST 00000                 DATE 2010 | 06 | 15

18. REMARKS: IADT: 20030601-20031015//AD: 20090101-20091231//NOTHING FOLLOWS

24. CHARACTER OF SERVICE
HONORABLE
`;

describe("N9c: NGB-22 primary period dates derived from Item 8 + Item 10", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("derives the entry date by counting NET SERVICE THIS PERIOD back from the separation date", async () => {
    const extractedData = await parseServiceRecord(
      NGB22_WITH_NET_SERVICE,
      "NGB22",
    );

    expect(extractedData.serviceStartDate).toBe("2002-03-05");
    expect(extractedData.serviceEndDate).toBe("2010-06-15");
    expect(extractedData.serviceStartDateDerived).toBe(true);
  });

  it("saves the derived dates as their own enlistment-level period, distinct from the Box 18 sub-periods", async () => {
    const extractedData = await parseServiceRecord(
      NGB22_WITH_NET_SERVICE,
      "NGB22",
    );
    saveServiceRecordToProfile(
      { name: "ngb22_net_service.pdf" },
      { extractedData },
    );

    const periods = getServicePeriods();
    // 1 enlistment-level period + 2 Box 18 sub-periods (IADT + AD) = 3
    expect(periods).toHaveLength(3);
    const enlistment = periods.find((p) => p.serviceStartDate === "2002-03-05");
    expect(enlistment).toBeDefined();
    expect(enlistment.serviceEndDate).toBe("2010-06-15");
    expect(enlistment.periodScope).not.toBe("window");
    expect(enlistment.serviceStartDateDerived).toBe(true);
    expect(getUnmatchedServiceRecords()).toHaveLength(0);
  });

  it("never guesses the entry date when NET SERVICE THIS PERIOD is missing", async () => {
    const extractedData = await parseServiceRecord(
      NGB22_WITHOUT_NET_SERVICE,
      "NGB22",
    );

    expect(extractedData.serviceStartDate).toBeFalsy();
    expect(extractedData.serviceEndDate).toBeFalsy();
  });
});

// ADR-007 open issue, closed here: once the veteran has corrected an
// enlistment-level period's start date, an unrelated later document (even
// VA's own, higher-confidence code sheet) must never re-label
// formType/sourceDocument away from the document that classification was
// proven against - doing so used to flip a Guard enlistment's projected
// timeline event from guard_enlistment to service_entry
// (buildServiceEntryTimelineEvent keys off formType === "NGB22"), which
// broke EvidenceTimeline's gap detection for that enlistment. Fixture
// values are synthetic.
describe("classification (formType/sourceDocument) is proven once the veteran corrects the start date", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps formType/sourceDocument once the veteran has corrected this period's start date, even against a higher-confidence code sheet", async () => {
    const extractedData = await parseServiceRecord(
      NGB22_WITH_NET_SERVICE,
      "NGB22",
    );
    saveServiceRecordToProfile(
      { name: "ngb22_net_service.pdf" },
      { extractedData },
    );

    const enlistment = getServicePeriods().find(
      (p) => p.serviceStartDate === "2002-03-05",
    );
    expect(enlistment.formType).toBe("NGB22");
    expect(enlistment.periodScope).not.toBe("window");

    const correction = setServiceEntryDate({
      date: "2002-03-10",
      via: "vkb_viewer",
      periodId: enlistment.id,
    });
    expect(correction.ok).toBe(true);
    expect(
      getServicePeriods().find((p) => p.id === enlistment.id)
        .serviceStartDateSource,
    ).toBe("veteran");

    saveCodeSheetServicePeriodsToProfile(
      { name: "cfile_codesheet.pdf" },
      {
        extractedData: {
          ratingSource: "code_sheet",
          servicePeriods: [
            {
              entryDate: "2002-03-10",
              separationDate: "2010-06-15",
              branch: "Army",
              characterOfDischarge: "Honorable",
            },
          ],
        },
      },
    );

    const corrected = getServicePeriods().find((p) => p.id === enlistment.id);
    expect(corrected.formType).toBe("NGB22");
    expect(corrected.sourceDocument).toBe("ngb22_net_service.pdf");
    expect(corrected.serviceStartDate).toBe("2002-03-10");
    // Non-classification fields still merge normally.
    expect(corrected.characterOfService).toBe("Honorable");
  });
});

// D-E (final10 QA, 2026-09-25): NET SERVICE THIS PERIOD was never
// range-checked, so an OCR/label misread producing an impossible duration
// (13 months, 45 days) round-tripped straight through subtractDuration as
// if it meant 13 real calendar months. Fixture values are synthetic.
describe("D-E: NGB-22 net-service duration is range-checked before deriving a date", () => {
  const ngbWithNetService = (net) => `
1. LAST NAME - FIRST NAME - MIDDLE NAME    2. DEPARTMENT, COMPONENT AND BRANCH
SAMPLE JORDAN TAYLOR                        ARNGUS/CAARNG

5a. RANK
SSG

8a. STATION OR INSTALLATION AT WHICH EFFECTED   YR MO DA
HHC 1-100 IN, ANYTOWN, ST 00000                 DATE 2010 | 06 | 15

9. COMMAND TO WHICH TRANSFERRED    10. RECORD OF SERVICE   YRS MOS DAYS
(a) NET SERVICE THIS PERIOD   ${net}

24. CHARACTER OF SERVICE
HONORABLE
`;

  it.each([
    ["08 | 13 | 10", "months over 11"],
    ["08 | 03 | 45", "days over 31"],
    ["99 | 03 | 10", "years over the sane career-length ceiling"],
    // D-E regression (final10 QA correctness re-review, 2026-09-26): an
    // all-zero duration passed the plain range check (0 is in-range on
    // every field individually) and derived a zero-length period -
    // entryDate === separationDate - from what a real "00 00 00" OCR read
    // means: a total miss, not a same-day tour.
    ["00 | 00 | 00", "an all-zero duration is not a plausible tour length"],
    // Boundary-pins (final10 QA "tests" lens, 2026-09-26): 12 months and 32
    // days are exactly one past the valid ceiling - months/days are
    // calendar remainders (0-11 / 0-31), never a full unit's worth of the
    // next one up.
    [
      "08 | 12 | 10",
      "exactly 12 months (one past the calendar-remainder ceiling)",
    ],
    [
      "08 | 03 | 32",
      "exactly 32 days (one past the calendar-remainder ceiling)",
    ],
  ])(
    "derives nothing when the net-service duration is invalid (%s: %s)",
    async (net) => {
      const extractedData = await parseServiceRecord(
        ngbWithNetService(net),
        "NGB22",
      );
      expect(extractedData.serviceStartDate).toBeFalsy();
      expect(extractedData.serviceEndDate).toBeFalsy();
      expect(extractedData.serviceStartDateDerived).toBeFalsy();
    },
  );

  it("still derives the date for an in-range duration", async () => {
    const extractedData = await parseServiceRecord(
      ngbWithNetService("08 | 03 | 10"),
      "NGB22",
    );
    expect(extractedData.serviceStartDate).toBe("2002-03-05");
    expect(extractedData.serviceStartDateDerived).toBe(true);
  });

  // Boundary-pin: 11 months and 31 days are the top of the valid range and
  // must still derive - only 12 months / 32 days (above) are rejected.
  it("still derives the date at the top of the valid range (11 months, 31 days)", async () => {
    const extractedData = await parseServiceRecord(
      ngbWithNetService("08 | 11 | 31"),
      "NGB22",
    );
    expect(extractedData.serviceStartDate).toBeTruthy();
    expect(extractedData.serviceStartDateDerived).toBe(true);
  });
});

// D-C (final10 QA correctness re-review, 2026-09-26): entryDateDerived
// describes entryDate itself - _mergeDD214Record used to merge each key
// independently, so a document's own real (false) entryDateDerived could
// "win" this key while a DIFFERENT document's entryDate won that key,
// mislabeling a calculated NGB-22 date as printed. Fixture values are
// synthetic.
describe("D-C: dd214Data.entryDateDerived merges in lockstep with entryDate, not independently", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps the calculated flag with the calculated date, even though a higher-confidence document (with no entry date at all) exists", () => {
    // A DD256 discharge certificate: no entry date, higher confidence.
    saveServiceRecordToProfile(
      { name: "dd256.pdf" },
      {
        classification: { confidence: 95 },
        extractedData: { type: "service_record", formType: "DD256" },
      },
    );
    // A lower-confidence NGB-22 with a CALCULATED entry date.
    saveServiceRecordToProfile(
      { name: "ngb22.pdf" },
      {
        classification: { confidence: 80 },
        extractedData: {
          type: "service_record",
          formType: "NGB22",
          serviceStartDate: "1997-07-30",
          serviceStartDateDerived: true,
        },
      },
    );

    const { dd214Data } = getServiceHistory();
    expect(dd214Data.entryDate).toBe("1997-07-30");
    expect(dd214Data.entryDateDerived).toBe(true);
  });

  it("clears the calculated flag once a real, printed entry date is merged in at equal confidence", () => {
    saveServiceRecordToProfile(
      { name: "ngb22.pdf" },
      {
        classification: { confidence: 90 },
        extractedData: {
          type: "service_record",
          formType: "NGB22",
          serviceStartDate: "1997-07-30",
          serviceStartDateDerived: true,
        },
      },
    );
    saveServiceRecordToProfile(
      { name: "dd214.pdf" },
      {
        classification: { confidence: 90 },
        extractedData: {
          type: "service_record",
          formType: "DD214",
          serviceStartDate: "1997-06-01",
          serviceStartDateDerived: false,
        },
      },
    );

    const { dd214Data } = getServiceHistory();
    expect(dd214Data.entryDate).toBe("1997-06-01");
    expect(dd214Data.entryDateDerived).toBe(false);
  });
});

// Box-18 window demotion (final15 QA review): REALISTIC_NGB22's Box-18 AD
// window (20040622-20050827) shares its dates EXACTLY with its own 12a/12b
// primary period (06/22/2004-08/27/2005) - the fixture this whole file's
// first describe block already exercises for rank attachment. N9c's "once
// a window, stays a window" rule used to let that coincidence merge the
// primary into its own sibling window's row, demoting a real enlistment to
// a training sub-period and locking it out of setServiceEntryDate's
// periodId-based correction (nonWindowPeriods excludes "window"-scoped
// rows). A primary period and a Box-18 window must never be the same row,
// however closely their dates coincide - see veteranProfile.js's
// _scopeCompatible/_isOwnSiblingWindow.
function findBox18PrimaryAndWindow() {
  const periods = getServicePeriods();
  const primary = periods.find(
    (p) =>
      p.serviceStartDate === "2004-06-22" &&
      p.serviceEndDate === "2005-08-27" &&
      p.periodScope !== "window",
  );
  const window = periods.find(
    (p) =>
      p.serviceStartDate === "2004-06-22" &&
      p.serviceEndDate === "2005-08-27" &&
      p.periodScope === "window",
  );
  return { primary, window };
}

describe("Box-18 window demotion: a coinciding window never demotes the primary enlistment", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps the primary as its own row (not periodScope 'window'), separate from the coinciding Box-18 window, in the app's real import order", async () => {
    const extractedData = await parseServiceRecord(REALISTIC_NGB22, "NGB22");
    saveServiceRecordToProfile({ name: "ngb22.pdf" }, { extractedData });

    const { primary, window } = findBox18PrimaryAndWindow();
    expect(primary).toBeDefined();
    expect(primary.periodScope).not.toBe("window");
    expect(window).toBeDefined();
    expect(window.periodScope).toBe("window");
    // Exactly one primary + one window at this date - not a duplicate of
    // either.
    expect(
      getServicePeriods().filter(
        (p) =>
          p.serviceStartDate === "2004-06-22" &&
          p.serviceEndDate === "2005-08-27",
      ),
    ).toHaveLength(2);
  });

  it("lets the veteran correct the primary enlistment's start date via its periodId (proves it isn't locked out as a 'window')", async () => {
    const extractedData = await parseServiceRecord(REALISTIC_NGB22, "NGB22");
    saveServiceRecordToProfile({ name: "ngb22.pdf" }, { extractedData });

    const { primary } = findBox18PrimaryAndWindow();
    const result = setServiceEntryDate({
      date: "2004-06-25",
      via: "my_packet",
      periodId: primary.id,
    });

    expect(result.ok).toBe(true);
    expect(result.periodId).toBe(primary.id);
    const corrected = getServicePeriods().find((p) => p.id === primary.id);
    expect(corrected.serviceStartDate).toBe("2004-06-25");
    expect(corrected.serviceStartDateSource).toBe("veteran");
    // The window is untouched by the primary's correction.
    const window = getServicePeriods().find(
      (p) => p.periodScope === "window" && p.serviceEndDate === "2005-08-27",
    );
    expect(window.serviceStartDate).toBe("2004-06-22");
  });

  it("keeps the primary and window as separate rows in the REVERSE import order too (window upserted first, primary second - matching production's real internal order - vs. primary upserted first, window second, simulating a different caller)", () => {
    // Reverse of saveServiceRecordToProfile's own internal order
    // (_saveNGB22AdditionalPeriods then _savePrimaryServicePeriod) - proves
    // the fix is in the MATCHING logic itself, not an artifact of call
    // sequence.
    upsertServicePeriod(
      {
        serviceStartDate: "2004-06-22",
        serviceEndDate: "2005-08-27",
        branch: "Army",
        rank: "SGT",
        formType: "NGB22",
      },
      { sourceDocument: "ngb22_reverse.pdf", confidence: 80 },
    );
    upsertServicePeriod(
      {
        serviceStartDate: "2004-06-22",
        serviceEndDate: "2005-08-27",
        component: "Active Duty",
        formType: "NGB22",
        notes: "Date range from NGB-22 Box 18 remarks.",
        periodScope: "window",
      },
      { sourceDocument: "ngb22_reverse.pdf", confidence: 80 },
    );

    const periods = getServicePeriods().filter(
      (p) =>
        p.serviceStartDate === "2004-06-22" &&
        p.serviceEndDate === "2005-08-27",
    );
    expect(periods).toHaveLength(2);
    expect(periods.some((p) => p.periodScope !== "window")).toBe(true);
    expect(periods.some((p) => p.periodScope === "window")).toBe(true);
  });
});

// D16-2 (final16 QA re-review, 2026-09-29): the demotion prevented above
// for an EXACT date coincidence still happened when the Box-18 window's
// OWN dating is only a FEW DAYS off its document's own 12a/12b primary (a
// report date vs an entry date, or a one-digit OCR miss) - REALISTIC_NGB22
// with its AD window moved 2 days later than 12a. `mayCollideWithOwnPrimary`
// (musterCallProcessor.js) used to compare with exact equality, so it
// never flagged this near-miss case, and pass 2's own near-date cross-
// scope tolerance (added for D16-1) was then free to merge the window
// into whatever pre-existing, EARLIER-imported row already sat at the
// primary's EXACT dates - flipping that row's periodScope to "window"
// (N9c) and setting up the primary's own subsequent upsert to collide
// with, and demote into, its own now-window-scoped sibling.
const REALISTIC_NGB22_NEAR_MISS_WINDOW = REALISTIC_NGB22.replace(
  "AD: 20040622-20050827",
  "AD: 20040624-20050827",
);

describe("Box-18 window demotion: a NEAR-COINCIDING window never demotes a primary from an EARLIER, different import", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps the code-sheet-sourced enlistment as its own non-window row when the NGB-22's Box-18 window is only 2 days off its own primary dates", async () => {
    saveCodeSheetServicePeriodsToProfile(
      { name: "cfile_codesheet.pdf" },
      {
        extractedData: {
          ratingSource: "code_sheet",
          servicePeriods: [
            {
              entryDate: "2004-06-22",
              separationDate: "2005-08-27",
              branch: "Army",
              characterOfDischarge: "Honorable",
            },
          ],
        },
      },
    );

    const extractedData = await parseServiceRecord(
      REALISTIC_NGB22_NEAR_MISS_WINDOW,
      "NGB22",
    );
    saveServiceRecordToProfile({ name: "ngb22.pdf" }, { extractedData });

    const primary = getServicePeriods().find(
      (p) =>
        p.serviceStartDate === "2004-06-22" &&
        p.serviceEndDate === "2005-08-27" &&
        p.periodScope !== "window",
    );
    const window = getServicePeriods().find(
      (p) => p.serviceStartDate === "2004-06-24" && p.periodScope === "window",
    );
    expect(primary).toBeDefined();
    expect(window).toBeDefined();
    // Without the fix, the primary demotes into the near-coinciding window:
    // no non-window row survives at the primary's own exact (06-22) dates.
    const primarySources = (primary.sources || []).map((s) => s.sourceDocument);
    expect(primarySources).toContain("cfile_codesheet.pdf");
    expect(primarySources).toContain("ngb22.pdf");

    // The primary is still reachable/correctable via its own periodId -
    // proof it was never folded into the window row.
    const result = setServiceEntryDate({
      date: "2004-06-20",
      via: "vkb_viewer",
      periodId: primary.id,
    });
    expect(result.ok).toBe(true);
  });
});

describe("Box-18 window demotion: a coinciding window never demotes a primary from an EARLIER, different import", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps the code-sheet-sourced enlistment as its own non-window row when the NGB-22 (with its coinciding Box-18 window) is imported AFTER it", async () => {
    // Veteran imports the C-File code sheet FIRST - its enlistment row has
    // no periodScope at all yet (null), same as any ordinary primary
    // period. Importing the NGB-22 SECOND must not let its Box-18 AD
    // window (same dates) cross-scope-match onto this pre-existing row and
    // turn it into a "window" - that's the code-sheet-first ordering this
    // test targets (veteranProfile.js's _crossScopeMergeAllowed).
    saveCodeSheetServicePeriodsToProfile(
      { name: "cfile_codesheet.pdf" },
      {
        extractedData: {
          ratingSource: "code_sheet",
          servicePeriods: [
            {
              entryDate: "2004-06-22",
              separationDate: "2005-08-27",
              branch: "Army",
              characterOfDischarge: "Honorable",
            },
          ],
        },
      },
    );

    const extractedData = await parseServiceRecord(REALISTIC_NGB22, "NGB22");
    saveServiceRecordToProfile({ name: "ngb22.pdf" }, { extractedData });

    const { primary, window } = findBox18PrimaryAndWindow();
    expect(primary).toBeDefined();
    expect(primary.periodScope).not.toBe("window");
    expect(window).toBeDefined();
    expect(window.periodScope).toBe("window");
    // Without the fix, the code sheet's row gets hijacked into the WINDOW
    // (both sources merge onto a periodScope:"window" row) and a brand-new,
    // code-sheet-less duplicate primary is created from the NGB-22's own
    // 12a/12b data alone - which still satisfies "a non-window row exists
    // at these dates" (masking the bug from a periodScope-only check), so
    // this explicitly proves the SURVIVING primary is the SAME logical row
    // the code sheet populated, not a fresh duplicate that merely looks
    // right.
    const primarySources = (primary.sources || []).map((s) => s.sourceDocument);
    expect(primarySources).toContain("cfile_codesheet.pdf");
    expect(primarySources).toContain("ngb22.pdf");
    expect(
      getServicePeriods().filter(
        (p) =>
          p.serviceStartDate === "2004-06-22" &&
          p.serviceEndDate === "2005-08-27",
      ),
    ).toHaveLength(2);

    // The primary is still reachable/correctable via its own periodId -
    // proof it was never folded into the window row.
    const result = setServiceEntryDate({
      date: "2004-06-20",
      via: "vkb_viewer",
      periodId: primary.id,
    });
    expect(result.ok).toBe(true);
  });
});

describe("Box-18 window demotion: correction survives a re-import", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("re-import after correction: re-processing the same NGB-22 preserves the veteran's correction and does not re-create or re-collide the primary with the window", async () => {
    const extractedData = await parseServiceRecord(REALISTIC_NGB22, "NGB22");
    saveServiceRecordToProfile({ name: "ngb22.pdf" }, { extractedData });

    const { primary: primaryBefore } = findBox18PrimaryAndWindow();
    const correction = setServiceEntryDate({
      date: "2004-06-25",
      via: "my_packet",
      periodId: primaryBefore.id,
    });
    expect(correction.ok).toBe(true);

    const totalBefore = getServicePeriods().length;

    // Re-import the identical document (e.g. a re-upload).
    saveServiceRecordToProfile({ name: "ngb22.pdf" }, { extractedData });

    expect(getServicePeriods()).toHaveLength(totalBefore);
    const corrected = getServicePeriods().find(
      (p) => p.id === primaryBefore.id,
    );
    expect(corrected).toBeDefined();
    expect(corrected.serviceStartDate).toBe("2004-06-25");
    expect(corrected.serviceStartDateSource).toBe("veteran");
    expect(corrected.periodScope).not.toBe("window");

    // The window is still its own separate, untouched row.
    const window = getServicePeriods().find(
      (p) =>
        p.periodScope === "window" &&
        p.serviceStartDate === "2004-06-22" &&
        p.serviceEndDate === "2005-08-27",
    );
    expect(window).toBeDefined();
  });
});

// D16-1 (final16 regression, 2026-09-29): the final16 fix above stopped a
// coinciding Box-18 window from demoting its own primary period by
// requiring pass 2's cross-scope match to skip the incoming record's own
// sibling window/primary (_isOwnSiblingWindow). That guard's fallback -
// "does the existing row already record incoming's own source document" -
// stays true FOREVER once it fires once, because a successful cross-scope
// merge itself adds the incoming document to `existing.sources`. Every
// document persistFormationDocument (musterCallProcessor.js) processes is
// saved TWICE by design - once from the initial extraction, once more from
// the Muster Call review modal's "Verify & Save" (see
// persistFormationDocument's own doc comment) - so a code-sheet or DD-214
// period that legitimately merged into an existing Box-18 window on its
// first save could never re-confirm that same link on its second, and
// created a fresh duplicate instead (musterCallProcessor.servicePeriodMerge:
// this is the exact call sequence saveCodeSheetServicePeriodsToProfile's
// own doc comment already promises is dedup-safe to call twice). A second,
// independent gap: pass 1's near-date (isSameServicePeriod) fuzzy match was
// scoped to same-periodScope candidates only, with no fuzzy fallback in
// cross-scope pass 2 - so a code-sheet period a few days off from how the
// NGB-22 itself dated its own Box-18 window could never merge into that
// window at all, even on the very first save.
//
// This fixture extends REALISTIC_NGB22 (same primary dates, same coinciding
// AD window) with a THIRD Box-18 window and a code sheet that lists all
// three: the coinciding AD window and the IADT window at an exact date
// match, and a third window 3 days off the NGB-22's own dating (within
// isSameServicePeriod's 7-day tolerance) - plus a DD-214 for the IADT
// window specifically. Fixture values are synthetic.
const D16_PRIMARY_START = "2004-06-22";
const D16_PRIMARY_END = "2005-08-27";
const D16_IADT_START = "2004-01-01";
const D16_IADT_END = "2004-03-01";
const D16_AD2003_START = "2003-06-01";
const D16_AD2003_END = "2003-08-01";

function d16Ngb22ExtractedData() {
  return {
    formType: "NGB22",
    serviceStartDate: D16_PRIMARY_START,
    serviceStartDateDerived: false,
    serviceEndDate: D16_PRIMARY_END,
    rank: "SGT",
    additionalPeriods: [
      {
        serviceStartDate: D16_IADT_START,
        serviceEndDate: D16_IADT_END,
        component: "IADT",
      },
      {
        serviceStartDate: D16_AD2003_START,
        serviceEndDate: D16_AD2003_END,
        component: "Active Duty",
      },
      // Coincides EXACTLY with the primary above - the final16 demotion-
      // prevention case, folded into this larger fixture too.
      {
        serviceStartDate: D16_PRIMARY_START,
        serviceEndDate: D16_PRIMARY_END,
        component: "Active Duty",
      },
    ],
  };
}

function saveD16Ngb22(fileName = "ngb22-d16.pdf") {
  saveServiceRecordToProfile(
    { name: fileName },
    { extractedData: { type: "service_record", ...d16Ngb22ExtractedData() } },
  );
}

function saveD16CodeSheet(fileName = "codesheet-d16.pdf") {
  saveCodeSheetServicePeriodsToProfile(
    { name: fileName },
    {
      extractedData: {
        ratingSource: "code_sheet",
        servicePeriods: [
          { entryDate: D16_PRIMARY_START, separationDate: D16_PRIMARY_END },
          { entryDate: D16_IADT_START, separationDate: D16_IADT_END },
          // 3 days off the NGB-22's own 2003-06-01 IADT window start - still
          // within isSameServicePeriod's 7-day tolerance.
          { entryDate: "2003-06-04", separationDate: D16_AD2003_END },
        ],
      },
    },
  );
}

function saveD16Dd214ForIadtWindow(fileName = "dd214-window-d16.pdf") {
  saveServiceRecordToProfile(
    { name: fileName },
    {
      extractedData: {
        type: "service_record",
        formType: "DD214",
        serviceStartDate: D16_IADT_START,
        serviceStartDateDerived: false,
        serviceEndDate: D16_IADT_END,
        rank: "PFC",
      },
    },
  );
}

// The code sheet's own dates are authoritative (options.authoritativeDates)
// and win the merge over the NGB-22's own Box-18-remarks-parsed dates - so
// the AD-2003 window's stored serviceStartDate moves from D16_AD2003_START
// to the code sheet's "3 days off" value once it merges. Windows are found
// by elimination (component/exact-date for the other two) rather than by
// the AD-2003 window's own original date, which the merge is SUPPOSED to
// move.
function findD16Rows() {
  const periods = getServicePeriods();
  const windows = periods.filter((p) => p.periodScope === "window");
  const iadtWindow = windows.find(
    (p) => p.component === "IADT" || p.serviceStartDate === D16_IADT_START,
  );
  const coincidingWindow = windows.find(
    (p) =>
      p.serviceStartDate === D16_PRIMARY_START &&
      p.serviceEndDate === D16_PRIMARY_END,
  );
  const ad2003Window = windows.find(
    (p) => p !== iadtWindow && p !== coincidingWindow,
  );
  const primary = periods.find(
    (p) =>
      p.periodScope !== "window" &&
      p.serviceStartDate === D16_PRIMARY_START &&
      p.serviceEndDate === D16_PRIMARY_END,
  );
  return { periods, iadtWindow, ad2003Window, coincidingWindow, primary };
}

function expectD16FixtureIsClean() {
  const rows = findD16Rows();
  expect(rows.periods).toHaveLength(4);
  expect(rows.iadtWindow).toBeDefined();
  expect(rows.ad2003Window).toBeDefined();
  expect(rows.coincidingWindow).toBeDefined();
  expect(rows.primary).toBeDefined();
  // Box-18 window demotion invariant (final16): the coinciding window
  // never demotes its own primary enlistment - they stay two rows.
  expect(rows.primary.id).not.toBe(rows.coincidingWindow.id);
  return rows;
}

function sourcesOf(period, fileName) {
  return (period.sources || []).filter((s) => s.sourceDocument === fileName);
}

describe("D16-1: code-sheet/DD-214 periods merge into Box-18 windows idempotently", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("merges an exact-date and a near-date code-sheet period into their Box-18 windows, in the app's real import order", () => {
    saveD16Ngb22();
    saveD16CodeSheet();
    saveD16Dd214ForIadtWindow();

    const { iadtWindow, ad2003Window, primary } = expectD16FixtureIsClean();
    expect(sourcesOf(iadtWindow, "codesheet-d16.pdf")).toHaveLength(1);
    expect(sourcesOf(iadtWindow, "dd214-window-d16.pdf")).toHaveLength(1);
    expect(sourcesOf(ad2003Window, "codesheet-d16.pdf")).toHaveLength(1);
    expect(sourcesOf(primary, "ngb22-d16.pdf")).toHaveLength(1);
  });

  it("produces the identical result in the reverse import order (DD-214 and code sheet before the NGB-22)", () => {
    saveD16Dd214ForIadtWindow();
    saveD16CodeSheet();
    saveD16Ngb22();

    expectD16FixtureIsClean();
  });

  it("stays at 4 periods, with each contributing document listed exactly once, when every document is saved twice (persistFormationDocument's own documented initial-extraction-then-Verify&Save double-save)", () => {
    saveD16Ngb22();
    saveD16Ngb22();
    saveD16CodeSheet();
    saveD16CodeSheet();
    saveD16Dd214ForIadtWindow();
    saveD16Dd214ForIadtWindow();

    const { iadtWindow, ad2003Window, primary } = expectD16FixtureIsClean();
    // N9a: append-only - a document already listed as a source is never
    // duplicated by re-saving the same document.
    expect(sourcesOf(iadtWindow, "codesheet-d16.pdf")).toHaveLength(1);
    expect(sourcesOf(iadtWindow, "dd214-window-d16.pdf")).toHaveLength(1);
    expect(sourcesOf(ad2003Window, "codesheet-d16.pdf")).toHaveLength(1);
    expect(sourcesOf(primary, "ngb22-d16.pdf")).toHaveLength(1);
  });

  it("stays at 4 periods on an unedited re-import after a veteran correction", () => {
    saveD16Ngb22();
    saveD16CodeSheet();

    const { primary } = expectD16FixtureIsClean();
    const correction = setServiceEntryDate({
      date: "2004-06-25",
      via: "my_packet",
      periodId: primary.id,
    });
    expect(correction.ok).toBe(true);

    saveD16Ngb22();
    saveD16CodeSheet();

    // The correction moved the primary's own serviceStartDate, so it's
    // looked up by id here rather than through expectD16FixtureIsClean's
    // date-keyed lookup (D16_PRIMARY_START no longer matches it).
    expect(getServicePeriods()).toHaveLength(4);
    const primaryAfter = getServicePeriods().find((p) => p.id === primary.id);
    expect(primaryAfter).toBeDefined();
    expect(primaryAfter.periodScope).not.toBe("window");
    expect(primaryAfter.serviceStartDate).toBe("2004-06-25");
    expect(primaryAfter.serviceStartDateSource).toBe("veteran");
  });
});
