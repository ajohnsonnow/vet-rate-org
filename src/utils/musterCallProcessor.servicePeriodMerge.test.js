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
} = await import("./veteranProfile");

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
    expect(ad.rank).toBe("SGT");
    expect(iadt).toBeDefined();
    expect(iadt.rank).toBe("");
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

  it("relabels an NGB-22-sourced period as Code Sheet once VA's own record confirms it, instead of keeping the stale NGB22 label", async () => {
    const extractedData = await parseServiceRecord(REALISTIC_NGB22, "NGB22");
    saveServiceRecordToProfile({ name: "ngb22.pdf" }, { extractedData });
    expect(
      getServicePeriods().find((p) => p.serviceStartDate === "2004-06-22")
        .formType,
    ).toBe("NGB22");

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
      (p) => p.serviceStartDate === "2004-06-22",
    );
    expect(period.formType).toBe("Code Sheet");
    expect(period.characterOfService).toBe("Honorable");
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
