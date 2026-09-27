/**
 * C1: canonical multi-period service history model
 * (serviceHistory.servicePeriods[] in veteranProfile.js).
 *
 * Identity key is (serviceStartDate, serviceEndDate) - NOT filename - so a
 * re-scan of the same document merges by confidence, but genuinely
 * different enlistment periods never collide (FIX-11). A user-edited
 * period must never be silently overwritten by a later document import.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  upsertServicePeriod,
  addServicePeriod,
  updateServicePeriod,
  removeServicePeriod,
  getServicePeriods,
  getUnmatchedServiceRecords,
} from "../../utils/veteranProfile";

// musterCallProcessor transitively imports pdfjs, which references canvas
// globals jsdom doesn't provide. Stub them so the module loads in the test
// environment (same pattern as musterCallProcessor.serviceRecord.test.js).
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const { saveServiceRecordToProfile } =
  await import("../../utils/musterCallProcessor");

function period(start, end, extra = {}) {
  return { serviceStartDate: start, serviceEndDate: end, ...extra };
}
function meta(sourceDocument, confidence) {
  return { sourceDocument, confidence };
}

describe("C1: service periods - identity and merge", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("creates a new period for a document-derived date pair", () => {
    upsertServicePeriod(
      period("2010-06-01", "2015-05-30", { branch: "Army", rank: "SGT" }),
      meta("dd214_1.pdf", 0.8),
    );

    const periods = getServicePeriods();
    expect(periods).toHaveLength(1);
    expect(periods[0].branch).toBe("Army");
    expect(periods[0].userEdited).toBe(false);
    expect(periods[0].incomplete).toBe(false);
  });

  it("treats two different date pairs as two distinct periods (FIX-11)", () => {
    for (const [start, end, doc] of [
      ["2004-01-01", "2008-01-01", "dd214_a.pdf"],
      ["2008-06-01", "2012-06-01", "dd214_b.pdf"],
      ["2012-09-01", "2016-09-01", "dd214_c.pdf"],
      ["2016-12-01", "2020-12-01", "dd214_d.pdf"],
    ]) {
      upsertServicePeriod(period(start, end), meta(doc, 0.9));
    }

    expect(getServicePeriods()).toHaveLength(4);
  });

  it("merges a re-scan of the same document (same date pair, same sourceDocument) instead of duplicating", () => {
    upsertServicePeriod(
      period("2010-06-01", "2015-05-30", { branch: "Army", mos: "11B" }),
      meta("rescan.pdf", 0.5),
    );
    upsertServicePeriod(
      period("2010-06-01", "2015-05-30", { branch: "Army", mos: "68W" }),
      meta("rescan.pdf", 0.9),
    );

    const periods = getServicePeriods();
    expect(periods).toHaveLength(1);
    // Higher-confidence re-scan of the SAME document wins for the field it
    // corrected - a legitimate re-read, not a disagreement between two
    // real documents (N1b).
    expect(periods[0].mos).toBe("68W");
  });

  it("never overwrites a userEdited period from a later document import", () => {
    const id = addServicePeriod(
      period("2010-06-01", "2015-05-30", {
        branch: "Army",
        rank: "MANUALLY CORRECTED RANK",
      }),
    );
    expect(getServicePeriods().find((p) => p.id === id).userEdited).toBe(true);

    upsertServicePeriod(
      period("2010-06-01", "2015-05-30", { rank: "WRONG OCR RANK" }),
      meta("rescan.pdf", 1),
    );

    const periods = getServicePeriods();
    expect(periods).toHaveLength(1);
    expect(periods[0].rank).toBe("MANUALLY CORRECTED RANK");
  });
});

// N1b (final8 QA, 2026-09-24): two DIFFERENT source documents that land on
// the same period must never have one silently overwrite the other's
// conflicting value, regardless of confidence ordering.
describe("N1b: a different source document's conflict is kept, not overwritten", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps the existing value and records the disagreement when a different document conflicts", () => {
    upsertServicePeriod(
      period("2010-06-01", "2015-05-30", { branch: "Army", mos: "11B" }),
      meta("dd214.pdf", 90),
    );
    upsertServicePeriod(
      period("2010-06-01", "2015-05-30", { mos: "68W" }),
      meta("codesheet.pdf", 100),
    );

    const periods = getServicePeriods();
    expect(periods).toHaveLength(1);
    expect(periods[0].mos).toBe("11B");
    expect(periods[0].fieldConflicts).toEqual([
      expect.objectContaining({
        field: "mos",
        keptValue: "11B",
        keptSourceDocument: "dd214.pdf",
        conflictingValue: "68W",
        conflictingSourceDocument: "codesheet.pdf",
      }),
    ]);
  });

  it("does not record a conflict when two documents disagree only by case", () => {
    upsertServicePeriod(
      period("2010-06-01", "2015-05-30", { characterOfService: "Honorable" }),
      meta("dd214.pdf", 90),
    );
    upsertServicePeriod(
      period("2010-06-01", "2015-05-30", { characterOfService: "HONORABLE" }),
      meta("codesheet.pdf", 100),
    );

    const periods = getServicePeriods();
    // Not a disagreement (same value, different case) - the normal
    // confidence high-water-mark rule still applies and the higher-
    // confidence document's casing wins; nothing is recorded as a conflict.
    expect(periods[0].characterOfService).toBe("HONORABLE");
    expect(periods[0].fieldConflicts ?? []).toEqual([]);
  });

  // D-F (final10 QA, 2026-09-25): shares _normalizeForComparison with
  // summarizeServicePeriods' own characterOfService disagreement check.
  it("does not record a conflict when two documents disagree only by punctuation/hyphenation", () => {
    upsertServicePeriod(
      period("2010-06-01", "2015-05-30", {
        characterOfService: "GENERAL - UNDER HONORABLE CONDITIONS",
      }),
      meta("dd214.pdf", 90),
    );
    upsertServicePeriod(
      period("2010-06-01", "2015-05-30", {
        characterOfService: "GENERAL UNDER HONORABLE CONDITIONS",
      }),
      meta("codesheet.pdf", 100),
    );

    const periods = getServicePeriods();
    expect(periods[0].characterOfService).toBe(
      "GENERAL UNDER HONORABLE CONDITIONS",
    );
    expect(periods[0].fieldConflicts ?? []).toEqual([]);
  });

  // D-F regression (final10 QA correctness re-review, 2026-09-26):
  // replace-with-space still left an intra-token hyphen distinct from its
  // joined form ("E-5" -> "e 5" vs "E5" -> "e5") - exactly what happens
  // when the vision parser strips a hyphen the regex parser keeps, for
  // pay grade, RE code, and MOS alike.
  it.each([
    ["payGrade", "E-5", "E5"],
    ["reentryCode", "RE-3", "RE3"],
    ["mos", "11B-10", "11B10"],
  ])(
    "does not record a conflict when two documents differ only by an intra-token hyphen (%s: %s vs %s)",
    (field, withHyphen, withoutHyphen) => {
      upsertServicePeriod(
        period("2010-06-01", "2015-05-30", { [field]: withHyphen }),
        meta("dd214.pdf", 90),
      );
      upsertServicePeriod(
        period("2010-06-01", "2015-05-30", { [field]: withoutHyphen }),
        meta("codesheet.pdf", 100),
      );

      const periods = getServicePeriods();
      expect(periods[0].fieldConflicts ?? []).toEqual([]);
    },
  );
});

// Regression (final10 QA "tests" lens re-review, 2026-09-26): a field
// FILLED by a lower-confidence document (going from "unknown" to "known")
// never recorded which document supplied it, only the period's single
// overall sourceDocument - which may belong to a different, higher-
// confidence document that never even had this field. A later conflict
// then blamed the wrong document.
describe("Obs 3 regression: a filled field's conflict is attributed to the document that actually supplied it", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("attributes a filled field's conflict to the document that actually supplied it, not the period's overall sourceDocument", () => {
    upsertServicePeriod(
      period("2010-06-01", "2015-05-30", { yearsService: 0, payGrade: "E-4" }),
      meta("hi.pdf", 95),
    );
    upsertServicePeriod(
      period("2010-06-01", "2015-05-30", { mos: "42A10" }),
      meta("lo.pdf", 40),
    );
    upsertServicePeriod(
      period("2010-06-01", "2015-05-30", { mos: "11B10" }),
      meta("third.pdf", 70),
    );

    const [saved] = getServicePeriods();
    // hi.pdf never supplied mos at all - lo.pdf did.
    expect(saved.mos).toBe("42A10");
    expect(saved.fieldConflicts).toEqual([
      expect.objectContaining({
        field: "mos",
        keptValue: "42A10",
        keptSourceDocument: "lo.pdf",
        conflictingValue: "11B10",
        conflictingSourceDocument: "third.pdf",
      }),
    ]);
  });
});

describe("C1: service periods - incomplete periods and edits", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keys an incomplete (single-date) period by date+sourceDocument, not dropping it", () => {
    upsertServicePeriod(period("2010-06-01", null), meta("torn_page.pdf", 0.4));

    const periods = getServicePeriods();
    expect(periods).toHaveLength(1);
    expect(periods[0].incomplete).toBe(true);
  });

  it("does not collide two different incomplete periods from different documents with the same single date", () => {
    upsertServicePeriod(period("2010-06-01", null), meta("doc_a.pdf", 0.4));
    upsertServicePeriod(period("2010-06-01", null), meta("doc_b.pdf", 0.4));

    expect(getServicePeriods()).toHaveLength(2);
  });

  it("updateServicePeriod marks the period userEdited", () => {
    const id = addServicePeriod(
      period("2010-06-01", "2015-05-30", { branch: "Army" }),
    );
    // addServicePeriod already sets userEdited: true; verify update
    // preserves it and applies the edit.
    updateServicePeriod(id, { rank: "CPL" });
    const updated = getServicePeriods().find((p) => p.id === id);
    expect(updated.rank).toBe("CPL");
    expect(updated.userEdited).toBe(true);
  });

  it("removeServicePeriod deletes only the targeted period", () => {
    const idA = addServicePeriod(period("2004-01-01", "2008-01-01"));
    addServicePeriod(period("2008-06-01", "2012-06-01"));

    removeServicePeriod(idA);
    const periods = getServicePeriods();
    expect(periods).toHaveLength(1);
    expect(periods.find((p) => p.id === idA)).toBeUndefined();
  });
});

// S46 QA follow-up, item 5 (2026-09-24): an undated period from a form
// should join the dated period it belongs to (same source document, or
// its one known date landing on that period's start/end) instead of
// always becoming its own orphan "? - ?" row.
describe("C1: service periods - an incomplete period joins the dated period it belongs to", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // N9b (final9 QA, 2026-09-25): "same source document" is only proof of a
  // link when that document produced exactly one period - true here (one
  // document, one dated period), so this stays a valid merge. See the N9
  // describe block below for the case where it produced more than one.
  it("merges into the dated period from the same source document, when that document produced exactly one period", () => {
    upsertServicePeriod(
      period("2004-06-22", "2005-08-27", { branch: "Army" }),
      meta("ngb22.pdf", 60),
    );
    upsertServicePeriod(
      period(null, null, { rank: "SGT" }),
      meta("ngb22.pdf", 60),
    );

    const periods = getServicePeriods();
    expect(periods).toHaveLength(1);
    expect(periods[0].rank).toBe("SGT");
    expect(periods[0].sources).toEqual([
      { sourceDocument: "ngb22.pdf", formType: "" },
    ]);
  });

  it("merges into the dated period whose separation date matches the incomplete period's one known date", () => {
    upsertServicePeriod(
      period("2002-05-06", "2003-04-30", { branch: "Army" }),
      meta("ngb22_clean.pdf", 60),
    );
    upsertServicePeriod(
      period(null, "2003-04-30", { rank: "SGT" }),
      meta("ngb22_garbled_box12a.pdf", 60),
    );

    const periods = getServicePeriods();
    expect(periods).toHaveLength(1);
    expect(periods[0]).toMatchObject({
      serviceStartDate: "2002-05-06",
      rank: "SGT",
    });
  });

  it("does not guess when the one known date matches more than one existing period", () => {
    upsertServicePeriod(period("2002-05-06", "2003-04-30"), meta("a.pdf", 60));
    upsertServicePeriod(period("2003-04-30", "2004-01-01"), meta("b.pdf", 60));
    upsertServicePeriod(
      period(null, "2003-04-30", { rank: "AMBIGUOUS" }),
      meta("c.pdf", 40),
    );

    const periods = getServicePeriods();
    expect(periods).toHaveLength(2);
    expect(periods.some((p) => p.rank === "AMBIGUOUS")).toBe(false);
  });
});

describe("service periods - the same period from two documents", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("treats dates a few days apart as one period and lets VA's dates win", () => {
    upsertServicePeriod(
      period("2006-02-13", "2007-06-29", { branch: "Army" }),
      meta("ngb22.pdf", 60),
    );
    upsertServicePeriod(
      period("2006-02-16", "2007-06-29", {
        characterOfService: "Honorable",
      }),
      {
        sourceDocument: "cfile.pdf",
        confidence: 100,
        authoritativeDates: true,
      },
    );
    const periods = getServicePeriods();
    expect(periods).toHaveLength(1);
    expect(periods[0]).toMatchObject({
      serviceStartDate: "2006-02-16",
      serviceEndDate: "2007-06-29",
      branch: "Army",
      characterOfService: "Honorable",
    });
  });

  it("keeps genuinely different periods apart", () => {
    upsertServicePeriod(period("2002-05-06", "2003-04-30"), meta("a.pdf", 60));
    upsertServicePeriod(period("2004-06-22", "2005-08-27"), meta("b.pdf", 60));
    expect(getServicePeriods()).toHaveLength(2);
  });
});

// N1 (final8 QA, 2026-09-24): 31409b97's branch+component "identity match"
// is removed - every mobilization DD214 for a Guard member parses
// component "National Guard" (musterCallProcessor.js's
// _resolveComponentFromDocument), so branch+component was exactly as weak
// a signal as branch alone, and it merged undated rows from several
// genuinely different real periods into one, silently losing an NGB-22's
// "General" characterization to a higher-confidence "HONORABLE" from an
// unrelated document. Proof of linkage is now only ever the same source
// document or a known date landing on an existing period's boundary.
// Fixture values are generic, not any real veteran's data.
describe("N1/N8: a Guard member's undated NGB-22 characterization only ever reaches its own period", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // period2.pdf's own undated re-scan recovers the NGB-22's General
  // characterization a first, lower-confidence pass on that SAME file
  // missed (proven link: same source document) - period1.pdf and
  // period3.pdf are unrelated real periods, each already carrying its own
  // "HONORABLE" from a different document, and must never receive it.
  function seedDatedPeriods() {
    upsertServicePeriod(
      period("2001-01-10", "2001-08-01", {
        branch: "Army",
        component: "National Guard",
        characterOfService: "HONORABLE",
      }),
      meta("period1.pdf", 90),
    );
    upsertServicePeriod(
      period("2004-06-22", "2005-08-27", {
        branch: "Army",
        component: "National Guard",
      }),
      meta("period2.pdf", 60),
    );
    upsertServicePeriod(
      period("2008-02-01", "2008-09-15", {
        branch: "Army",
        component: "National Guard",
        characterOfService: "HONORABLE",
      }),
      meta("period3.pdf", 90),
    );
  }

  const generalRow = () =>
    period(null, null, {
      branch: "Army",
      component: "National Guard",
      characterOfService: "General (Under Honorable Conditions)",
    });

  function expectGeneralAttachedOnlyToItsOwnPeriod() {
    const periods = getServicePeriods();
    expect(periods).toHaveLength(3);
    const target = periods.find((p) => p.serviceStartDate === "2004-06-22");
    expect(target.characterOfService).toBe(
      "General (Under Honorable Conditions)",
    );
    expect(
      periods.filter((p) => p.characterOfService === "HONORABLE"),
    ).toHaveLength(2);
  }

  it("attaches to its own period when the dated periods are imported first", () => {
    seedDatedPeriods();
    upsertServicePeriod(generalRow(), meta("period2.pdf", 90));

    expectGeneralAttachedOnlyToItsOwnPeriod();
  });

  it("N8: attaches to its own period even when imported BEFORE its dated twin", () => {
    upsertServicePeriod(generalRow(), meta("period2.pdf", 90));
    expect(getUnmatchedServiceRecords()).toHaveLength(1);

    seedDatedPeriods();

    expectGeneralAttachedOnlyToItsOwnPeriod();
    expect(getUnmatchedServiceRecords()).toHaveLength(0);
  });
});

describe("N1c: an unlinked undated row is kept, but not counted as a period", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("never merges undated rows across a genuinely different component, and neither becomes its own period", () => {
    upsertServicePeriod(
      period(null, null, {
        branch: "Army",
        component: "National Guard",
        rank: "SGT",
        payGrade: "E-5",
      }),
      meta("ngb22_discharge.pdf", 75),
    );
    upsertServicePeriod(
      period(null, null, {
        branch: "Army",
        component: "Active Duty",
        rank: "CPL",
        payGrade: "E-4",
      }),
      meta("dd214_ad.pdf", 90),
    );

    expect(getServicePeriods()).toHaveLength(0);
    const unmatched = getUnmatchedServiceRecords();
    expect(unmatched).toHaveLength(2);
    // Kept in full - rank and pay grade are not lost just because the row
    // couldn't be dated or linked.
    expect(unmatched.map((r) => r.rank).sort()).toEqual(["CPL", "SGT"]);
    expect(unmatched.map((r) => r.payGrade).sort()).toEqual(["E-4", "E-5"]);
  });

  it("does not attach an undated row when its identity matches more than one dated period", () => {
    upsertServicePeriod(
      period("2002-05-06", "2003-04-30", {
        branch: "Army",
        component: "Active Duty",
      }),
      meta("codesheet_a.pdf", 100),
    );
    upsertServicePeriod(
      period("2004-06-22", "2005-08-27", {
        branch: "Army",
        component: "Active Duty",
      }),
      meta("codesheet_b.pdf", 100),
    );
    upsertServicePeriod(
      period(null, null, {
        branch: "Army",
        component: "Active Duty",
        rank: "AMBIGUOUS",
      }),
      meta("dd214_ambiguous.pdf", 90),
    );

    const periods = getServicePeriods();
    expect(periods).toHaveLength(2);
    expect(periods.some((p) => p.rank === "AMBIGUOUS")).toBe(false);
    expect(getUnmatchedServiceRecords()).toHaveLength(1);
  });

  it("drops a genuinely zero-signal scan instead of giving it its own '? - ?' row", () => {
    upsertServicePeriod(
      period(null, null, {
        branch: "Army",
        component: "National Guard",
        rank: "SGT",
      }),
      meta("ngb22_discharge.pdf", 75),
    );
    upsertServicePeriod(
      period(null, null, {}),
      meta("dd214_blank_scan.pdf", 75),
    );

    expect(getServicePeriods()).toHaveLength(0);
    expect(getUnmatchedServiceRecords()).toHaveLength(1);
  });
});

// N9 (final9 QA, 2026-09-25): a multi-period form (an NGB-22 whose Box 18
// produces several training/activation sub-periods) had its undated
// enlistment-level row wrongly absorbed into ONE of its own sub-periods -
// mechanism: (1) the row correctly stayed unmatched while every
// sub-period still shared its sourceDocument (ambiguous - N9b), but (2) a
// later, higher-confidence merge (a VA code sheet) reassigned some of
// those sub-periods' single `sourceDocument` field, leaving exactly one
// sub-period looking like a "same document, exactly one match" target,
// and (3) _absorbUnmatchedRecords then merged the row into it, silently
// overwriting that sub-period's own component/rank/character/MOS with the
// enlistment-level record's. periodScope: "window" (set by
// musterCallProcessor.js's real Box 18 upsert) is what actually blocks
// this - N9b's document-produced-more-than-one-period count is a second,
// independent guard for the same real bug. Fixture values are generic.
describe("N9: an enlistment-level record never merges into one of its own document's sub-periods", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function seedSubPeriods() {
    upsertServicePeriod(
      period("1997-09-29", "1998-02-27", {
        branch: "Army",
        component: "Training",
        periodScope: "window",
      }),
      meta("multi_period_form.pdf", 75),
    );
    upsertServicePeriod(
      period("2002-05-06", "2003-04-30", {
        branch: "Army",
        component: "Activation",
        periodScope: "window",
      }),
      meta("multi_period_form.pdf", 75),
    );
  }

  const enlistmentRow = () =>
    period(null, null, {
      branch: "Army",
      component: "National Guard",
      rank: "SGT",
      mos: "92Y20",
    });

  function expectRowStaysUnmatched() {
    const periods = getServicePeriods();
    expect(periods).toHaveLength(2);
    expect(periods.every((p) => !p.rank && !p.mos)).toBe(true);
    const unmatched = getUnmatchedServiceRecords();
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0].rank).toBe("SGT");
  }

  it("stays unmatched when the sub-periods are imported first", () => {
    seedSubPeriods();
    upsertServicePeriod(enlistmentRow(), meta("multi_period_form.pdf", 75));

    expectRowStaysUnmatched();
  });

  it("stays unmatched when imported BEFORE its document's sub-periods", () => {
    upsertServicePeriod(enlistmentRow(), meta("multi_period_form.pdf", 75));
    expect(getUnmatchedServiceRecords()).toHaveLength(1);

    seedSubPeriods();

    expectRowStaysUnmatched();
  });

  it("stays unmatched even after a higher-confidence code sheet merges into one of the sub-periods", () => {
    seedSubPeriods();
    upsertServicePeriod(enlistmentRow(), meta("multi_period_form.pdf", 75));
    expectRowStaysUnmatched();

    // VA's own record confirms one sub-period's dates and becomes its
    // authoritative sourceDocument - must not make the untouched
    // sub-period look like the form's only remaining "same document"
    // match.
    upsertServicePeriod(
      period("2002-05-06", "2003-04-30", { characterOfService: "Honorable" }),
      { sourceDocument: "codesheet.pdf", confidence: 100 },
    );

    expectRowStaysUnmatched();
    const untouchedWindow = getServicePeriods().find(
      (p) => p.serviceStartDate === "1997-09-29",
    );
    expect(untouchedWindow.rank).toBeFalsy();
    expect(untouchedWindow.mos).toBeFalsy();
  });
});

// N9c is its own guard, independent of N9b's document-produced-count gate
// above: even a document that produced only a single sub-period must
// never have its enlistment-level row merge into it.
describe("N9c: never merges into a sub-period, even a lone one", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("still never merges into a lone sub-period, even when that document produced only one", () => {
    upsertServicePeriod(
      period("1997-09-29", "1998-02-27", {
        branch: "Army",
        component: "Training",
        periodScope: "window",
      }),
      meta("single_window_form.pdf", 75),
    );
    upsertServicePeriod(
      period(null, null, { branch: "Army", rank: "SGT" }),
      meta("single_window_form.pdf", 75),
    );

    const periods = getServicePeriods();
    expect(periods).toHaveLength(1);
    expect(periods[0].rank).toBeFalsy();
    expect(getUnmatchedServiceRecords()).toHaveLength(1);
  });
});

describe("N9a: the provenance list (`sources`) survives merges", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps every contributing document, even after a higher-confidence merge reassigns sourceDocument", () => {
    upsertServicePeriod(
      period("2010-06-01", "2015-05-30", { branch: "Army" }),
      meta("dd214.pdf", 60),
    );
    upsertServicePeriod(
      period("2010-06-01", "2015-05-30", { characterOfService: "Honorable" }),
      { sourceDocument: "codesheet.pdf", confidence: 100 },
    );

    const [saved] = getServicePeriods();
    expect(saved.sourceDocument).toBe("codesheet.pdf");
    expect(saved.sources).toEqual(
      expect.arrayContaining([
        { sourceDocument: "dd214.pdf", formType: "" },
        { sourceDocument: "codesheet.pdf", formType: "" },
      ]),
    );
    expect(saved.sources).toHaveLength(2);
  });

  it("does not duplicate a document already in `sources` on a re-scan", () => {
    upsertServicePeriod(
      period("2010-06-01", "2015-05-30", { mos: "11B" }),
      meta("rescan.pdf", 50),
    );
    upsertServicePeriod(
      period("2010-06-01", "2015-05-30", { mos: "68W" }),
      meta("rescan.pdf", 90),
    );

    expect(getServicePeriods()[0].sources).toHaveLength(1);
  });
});

// Observation 3 (adv11b, final10 QA, 2026-09-25): a lower-confidence
// document never filled an EMPTY field on an existing period - the
// confidence high-water-mark gate applied even when there was no existing
// value to protect. Filling an empty field with no conflict is now always
// allowed, with provenance recorded via `sources` regardless.
describe("Observation 3: a lower-confidence document can still fill a field the period never had", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("fills an empty field from a later, lower-confidence document", () => {
    upsertServicePeriod(
      period("1999-03-10", "1999-09-02", {
        branch: "Army",
        component: "IADT",
        formType: "NGB22",
      }),
      meta("ngb22.pdf", 90),
    );
    upsertServicePeriod(
      period("1999-03-10", "1999-09-02", {
        payGrade: "E-2",
        mos: "42A10",
        characterOfService: "UNCHARACTERIZED",
        reentryCode: "NA",
      }),
      meta("dd214_iadt.pdf", 80),
    );

    const [saved] = getServicePeriods();
    expect(saved.payGrade).toBe("E-2");
    expect(saved.mos).toBe("42A10");
    expect(saved.characterOfService).toBe("UNCHARACTERIZED");
    expect(saved.reentryCode).toBe("NA");
    // Not a disagreement - nothing to record.
    expect(saved.fieldConflicts ?? []).toEqual([]);
    expect(saved.sources.map((s) => s.sourceDocument).sort()).toEqual(
      ["dd214_iadt.pdf", "ngb22.pdf"].sort(),
    );
  });

  it("still protects a genuinely populated field with the confidence gate", () => {
    upsertServicePeriod(
      period("1999-03-10", "1999-09-02", { mos: "42A10" }),
      meta("dd214_a.pdf", 90),
    );
    upsertServicePeriod(
      period("1999-03-10", "1999-09-02", { mos: "68W99" }),
      meta("dd214_a.pdf", 40),
    );

    // Same sourceDocument (a re-scan) - the low-confidence pass never wins
    // over a real, already-known value from the SAME document.
    expect(getServicePeriods()[0].mos).toBe("42A10");
  });
});

// Regression (final10 QA correctness re-review, 2026-09-26): `!existing[field]`
// treated a real false/0 value the same as "never had a value", so a
// lower-confidence document from a DIFFERENT source silently overwrote a
// confirmed "no" or a real zero-length tour with no fieldConflict.
describe("Observation 3 regression: a real false/0 value is never silently overwritten by a different, lower-confidence document", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("never lets a lower-confidence, different-source document silently overwrite a confirmed 'no' (foreignService: false)", () => {
    upsertServicePeriod(
      period("1999-03-10", "1999-09-02", { foreignService: false }),
      meta("dd214_a.pdf", 90),
    );
    upsertServicePeriod(
      period("1999-03-10", "1999-09-02", { foreignService: true }),
      meta("other_doc.pdf", 50),
    );

    const [saved] = getServicePeriods();
    expect(saved.foreignService).toBe(false);
    expect(saved.fieldConflicts).toEqual([
      expect.objectContaining({ field: "foreignService" }),
    ]);
  });

  it("never lets a lower-confidence, different-source document silently overwrite a real zero-length tour (yearsService: 0)", () => {
    upsertServicePeriod(
      period("1999-03-10", "1999-09-02", { yearsService: 0 }),
      meta("dd214_a.pdf", 90),
    );
    upsertServicePeriod(
      period("1999-03-10", "1999-09-02", { yearsService: 4 }),
      meta("other_doc.pdf", 50),
    );

    const [saved] = getServicePeriods();
    expect(saved.yearsService).toBe(0);
    expect(saved.fieldConflicts).toEqual([
      expect.objectContaining({ field: "yearsService" }),
    ]);
  });

  it("still fills a genuinely unknown (null) foreignService from any confidence", () => {
    upsertServicePeriod(
      period("1999-03-10", "1999-09-02", {}),
      meta("dd214_a.pdf", 90),
    );
    upsertServicePeriod(
      period("1999-03-10", "1999-09-02", { foreignService: true }),
      meta("other_doc.pdf", 40),
    );

    const [saved] = getServicePeriods();
    expect(saved.foreignService).toBe(true);
    expect(saved.fieldConflicts ?? []).toEqual([]);
  });
});

describe("N9a: migration seeds `sources` for data stored before it existed", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("seeds sources from the legacy sourceDocument field on read", () => {
    localStorage.setItem(
      "vet_rate_service_history",
      JSON.stringify({
        deployments: [],
        awards: [],
        dd214Data: null,
        serviceInfo: null,
        servicePeriods: [
          {
            id: "legacy_period",
            serviceStartDate: "2010-06-01",
            serviceEndDate: "2015-05-30",
            branch: "Army",
            formType: "DD214",
            sourceDocument: "legacy_dd214.pdf",
          },
        ],
        unmatchedServiceRecords: [],
        dateUpdated: "2026-01-01T00:00:00.000Z",
      }),
    );

    const [migrated] = getServicePeriods();
    expect(migrated.sources).toEqual([
      { sourceDocument: "legacy_dd214.pdf", formType: "DD214" },
    ]);
  });
});

// N9e (final9 QA, 2026-09-25): one-time repair for a period saved before
// N9's (a)-(c) fixes, where an enlistment-level record was wrongly
// absorbed into one of its own document's Box 18 sub-periods. Traced by
// structural impossibility (see veteranProfile.js's
// _isContaminatedBox18Period) - only fields that document's Box 18 upsert
// could never have set directly.
//
// Corrected in final10 QA's correctness re-review (2026-09-26): this exact
// raw shape (single sourceDocument, no `sources` array) is what origin/main
// ALSO produces for a perfectly legitimate DD214-then-NGB22 merge, since
// `sources` never shipped there - the repair can no longer tell "the only
// document that ever touched this" apart from "we never recorded who
// else did", so it now only trusts `sources` this app's own merge code
// actually accumulated (see _hasNoOtherContributor), never a read-time
// seed built from `sourceDocument` alone. Fixture values are generic.
describe("D-A: the Box-18 contamination repair only trusts real, accumulated `sources` - never a read-time seed", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const BOX18_NOTES =
    "Date range from NGB-22 Box 18 remarks (no location listed on the document).";

  it("leaves a raw, pre-`sources` history alone - indistinguishable from a legitimate DD214+NGB22 merge", () => {
    localStorage.setItem(
      "vet_rate_service_history",
      JSON.stringify({
        deployments: [],
        awards: [],
        dd214Data: null,
        serviceInfo: null,
        servicePeriods: [
          {
            id: "legacy_window",
            serviceStartDate: "1997-09-29",
            serviceEndDate: "1998-02-27",
            branch: "Army",
            component: "National Guard",
            formType: "NGB22",
            rank: "SGT",
            mos: "92Y20",
            mosTitle: "UNIT SUPPLY SP",
            characterOfService: "GENERAL UNDER HONORABLE CONDITIONS",
            reentryCode: "RE-3",
            sourceDocument: "multi_period_form.pdf",
            notes: BOX18_NOTES,
          },
        ],
        unmatchedServiceRecords: [],
        dateUpdated: "2026-01-01T00:00:00.000Z",
      }),
    );

    const periods = getServicePeriods();
    expect(periods).toHaveLength(1);
    // A real DD214's fields, saved before the NGB-22 by origin/main's own
    // (unfixed) merge, look identical on read - stripping these would be
    // the exact D-A data-loss bug on real deployed data.
    expect(periods[0].mos).toBe("92Y20");
    expect(periods[0].characterOfService).toBe(
      "GENERAL UNDER HONORABLE CONDITIONS",
    );
    expect(periods[0].reentryCode).toBe("RE-3");
    expect(getUnmatchedServiceRecords()).toHaveLength(0);
  });

  // Regression (final10 QA "tests" lens re-review, 2026-09-26): origin/main's
  // Box-18 upsert writes payGrade onto every window from a single NGB-22 -
  // an "impossible" field per BOX18_IMPOSSIBLE_FIELD_DEFAULTS. Before this
  // gate, every one of a deployed veteran's NGB-22-only windows would have
  // payGrade wiped and gained a duplicate undated "unmatched record" on
  // first read after this branch ships, even with zero real contamination.
  it("does not strip payGrade or fabricate unmatched records across a single NGB-22's own multiple windows", () => {
    const window = (id, start, end) => ({
      id,
      serviceStartDate: start,
      serviceEndDate: end,
      branch: "Army",
      component: "Active Duty",
      formType: "NGB22",
      rank: "SSG",
      payGrade: "E-6",
      sourceDocument: "ngb22_generic.pdf",
      notes: BOX18_NOTES,
    });
    localStorage.setItem(
      "vet_rate_service_history",
      JSON.stringify({
        deployments: [],
        awards: [],
        dd214Data: null,
        serviceInfo: null,
        servicePeriods: [
          window("w1", "2003-01-15", "2003-12-20"),
          window("w2", "2005-06-01", "2005-12-31"),
          window("w3", "2008-02-01", "2009-01-31"),
        ],
        unmatchedServiceRecords: [],
        dateUpdated: "2026-01-01T00:00:00.000Z",
      }),
    );

    const periods = getServicePeriods();
    expect(periods.every((p) => p.payGrade === "E-6")).toBe(true);
    expect(getUnmatchedServiceRecords()).toHaveLength(0);
  });
});

describe("D-A: the Box-18 contamination repair still fires given genuine, accumulated evidence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const BOX18_NOTES =
    "Date range from NGB-22 Box 18 remarks (no location listed on the document).";

  it("still repairs a period whose `sources` this app's own merge code genuinely recorded as single-contributor", () => {
    localStorage.setItem(
      "vet_rate_service_history",
      JSON.stringify({
        deployments: [],
        awards: [],
        dd214Data: null,
        serviceInfo: null,
        servicePeriods: [
          {
            id: "contaminated_window",
            serviceStartDate: "1997-09-29",
            serviceEndDate: "1998-02-27",
            branch: "Army",
            component: "National Guard",
            formType: "NGB22",
            rank: "SGT",
            mos: "92Y20",
            mosTitle: "UNIT SUPPLY SP",
            characterOfService: "GENERAL UNDER HONORABLE CONDITIONS",
            reentryCode: "RE-3",
            sourceDocument: "multi_period_form.pdf",
            notes: BOX18_NOTES,
            // Real, already-accumulated provenance (as this app's own
            // _addSource writes it) naming only the one document that
            // could have absorbed its own undated row into this window -
            // genuine evidence, not a read-time guess.
            sources: [
              { sourceDocument: "multi_period_form.pdf", formType: "NGB22" },
            ],
          },
        ],
        unmatchedServiceRecords: [],
        dateUpdated: "2026-01-01T00:00:00.000Z",
      }),
    );

    const periods = getServicePeriods();
    expect(periods).toHaveLength(1);
    expect(periods[0].mos).toBe("");
    expect(periods[0].characterOfService).toBe("");
    expect(periods[0].reentryCode).toBe("");
    // Legitimately Box 18's own fields are untouched.
    expect(periods[0].serviceStartDate).toBe("1997-09-29");
    expect(periods[0].branch).toBe("Army");

    const unmatched = getUnmatchedServiceRecords();
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0].mos).toBe("92Y20");
    expect(unmatched[0].characterOfService).toBe(
      "GENERAL UNDER HONORABLE CONDITIONS",
    );
    expect(unmatched[0].reentryCode).toBe("RE-3");
    expect(unmatched[0].incomplete).toBe(true);
  });
});

describe("D-A: the Box-18 contamination repair still leaves an uncontaminated period alone", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const BOX18_NOTES =
    "Date range from NGB-22 Box 18 remarks (no location listed on the document).";

  it("leaves an uncontaminated Box 18 period alone", () => {
    localStorage.setItem(
      "vet_rate_service_history",
      JSON.stringify({
        deployments: [],
        awards: [],
        dd214Data: null,
        serviceInfo: null,
        servicePeriods: [
          {
            id: "clean_window",
            serviceStartDate: "2004-06-22",
            serviceEndDate: "2005-08-27",
            branch: "Army",
            component: "Active Duty",
            formType: "NGB22",
            rank: "SGT",
            sourceDocument: "multi_period_form.pdf",
            notes: BOX18_NOTES,
            sources: [
              { sourceDocument: "multi_period_form.pdf", formType: "NGB22" },
            ],
          },
        ],
        unmatchedServiceRecords: [],
        dateUpdated: "2026-01-01T00:00:00.000Z",
      }),
    );

    expect(getServicePeriods()[0].rank).toBe("SGT");
    expect(getUnmatchedServiceRecords()).toHaveLength(0);
  });
});

// D-A (final10 QA, 2026-09-25): _isContaminatedBox18Period's fingerprint
// (formType NGB22 + Box-18 notes + an "impossible" field populated) also
// matched a period an ORDINARY, legitimate merge produced - a dated DD214
// for that exact window saved before the NGB-22, at equal or lower
// confidence, whose Box 18 upsert only ever reassigns provenance fields
// (formType/notes/sourceDocument), never the DD214's real content fields.
// Reproduces QA's R1/R2 with generic fixtures. Fixture values are generic,
// not any real veteran's data.
describe("D-A: the contamination repair never strips a legitimate DD214's fields from another document's window", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function seedIadtDD214(confidence) {
    upsertServicePeriod(
      period("1999-03-10", "1999-09-02", {
        branch: "Army",
        component: "IADT",
        rank: "PV2",
        payGrade: "E-2",
        characterOfService: "UNCHARACTERIZED",
        mos: "42A10",
        reentryCode: "NA",
        formType: "DD214",
        sourceDocument: "dd214_iadt.pdf",
      }),
      meta("dd214_iadt.pdf", confidence),
    );
  }

  function saveNgb22(confidence) {
    saveServiceRecordToProfile(
      { name: "ngb22_generic.pdf" },
      {
        classification: { confidence },
        extractedData: {
          type: "service_record",
          formType: "NGB22",
          branch: "Army",
          component: "National Guard",
          rank: "SSG",
          mos: "42A20",
          reentryCode: "RE-3",
          dischargeType: "GENERAL UNDER HONORABLE CONDITIONS",
          additionalPeriods: [
            ["03/10/1999", "09/02/1999", "IADT"],
            ["01/15/2003", "12/20/2003", "Active Duty"],
          ].map(([s, e, c]) => ({
            serviceStartDate: s,
            serviceEndDate: e,
            component: c,
          })),
        },
      },
    );
  }

  function expectDD214FieldsIntact() {
    const periods = getServicePeriods();
    const window = periods.find((p) => p.serviceStartDate === "1999-03-10");
    expect(window).toBeDefined();
    expect(window.payGrade).toBe("E-2");
    expect(window.mos).toBe("42A10");
    expect(window.characterOfService).toBe("UNCHARACTERIZED");
    expect(window.reentryCode).toBe("NA");
    expect(window.sources.map((s) => s.sourceDocument).sort()).toEqual(
      ["dd214_iadt.pdf", "ngb22_generic.pdf"].sort(),
    );
    // The NGB-22's own undated enlistment-level record legitimately stays
    // unmatched (N9 - a multi-period document's primary row never merges
    // into one of its own windows), but it must never carry the DD214's
    // fields - that would be the D-A bug moving them there instead of
    // leaving them on the window.
    const unmatched = getUnmatchedServiceRecords();
    expect(unmatched.some((r) => r.mos === "42A10")).toBe(false);
    expect(unmatched.some((r) => r.payGrade === "E-2")).toBe(false);
  }

  it("R1: DD214 at lower confidence saved first, then a higher-confidence NGB-22", () => {
    seedIadtDD214(80);
    saveNgb22(90);
    expectDD214FieldsIntact();
  });

  it("R2: DD214 and NGB-22 at equal confidence", () => {
    seedIadtDD214(85);
    saveNgb22(85);
    expectDD214FieldsIntact();
  });
});

// D-A: the one-time migration is versioned and never re-runs once applied.
describe("D-A: the contamination repair is a versioned migration that runs once", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const BOX18_NOTES =
    "Date range from NGB-22 Box 18 remarks (no location listed on the document).";

  // Real, already-accumulated `sources` (see the previous describe block) -
  // the only shape this repair can safely act on.
  function contaminatedRawHistory() {
    return {
      deployments: [],
      awards: [],
      dd214Data: null,
      serviceInfo: null,
      servicePeriods: [
        {
          id: "contaminated_window",
          serviceStartDate: "1999-03-10",
          serviceEndDate: "1999-09-02",
          branch: "Army",
          component: "National Guard",
          formType: "NGB22",
          rank: "SSG",
          mos: "42A20",
          characterOfService: "GENERAL UNDER HONORABLE CONDITIONS",
          reentryCode: "RE-3",
          sourceDocument: "single_source_form.pdf",
          notes: BOX18_NOTES,
          sources: [
            { sourceDocument: "single_source_form.pdf", formType: "NGB22" },
          ],
        },
      ],
      unmatchedServiceRecords: [],
      dateUpdated: "2026-01-01T00:00:00.000Z",
    };
  }

  it("stamps a schema version on first read and repairs a genuinely contaminated row", () => {
    localStorage.setItem(
      "vet_rate_service_history",
      JSON.stringify(contaminatedRawHistory()),
    );

    const periods = getServicePeriods();
    expect(periods[0].mos).toBe("");
    expect(getUnmatchedServiceRecords()).toHaveLength(1);

    const raw = JSON.parse(localStorage.getItem("vet_rate_service_history"));
    expect(raw.schemaVersion).toBeGreaterThanOrEqual(1);
  });

  it("does not re-run the repair on a history already at the current schema version", () => {
    const alreadyMigrated = {
      ...contaminatedRawHistory(),
      schemaVersion: 1,
    };
    localStorage.setItem(
      "vet_rate_service_history",
      JSON.stringify(alreadyMigrated),
    );

    // The row is still shaped exactly like the legacy bug's signature, but
    // schemaVersion already claims the migration ran - a real migration
    // would have moved mos off this row already, so its presence here
    // proves the repair did NOT re-fire.
    const periods = getServicePeriods();
    expect(periods[0].mos).toBe("42A20");
    expect(getUnmatchedServiceRecords()).toHaveLength(0);
  });
});

// final7 QA follow-up, D2 (2026-09-24): rank must be resolved by which
// record is chronologically LATER, not by which scan had higher OCR
// confidence - a clean scan of an early enlistment isn't "later" than a
// garbled scan of the discharge that followed it.
// final8 QA (2026-09-24): re-scoped off the removed branch+component
// identity match (N1a) onto proven links instead - a re-scan of the same
// source document, or two documents whose dates land within
// isSameServicePeriod's tolerance of each other (the same real period,
// same as the existing "the same period from two documents" tests above).
describe("C1: service periods - a later record's rank wins (D2)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // Both rows are undated (no proven date-boundary to link to any period)
  // and land in unmatchedServiceRecords (N1c) - same rank-recency rule,
  // same _mergeExistingServicePeriod, just merged there instead of onto a
  // servicePeriods[] entry.
  it("keeps the earlier-set rank when neither side has an end date to compare", () => {
    upsertServicePeriod(
      period(null, null, {
        branch: "Army",
        component: "National Guard",
        rank: "SGT",
      }),
      meta("ngb22_rescan.pdf", 75),
    );
    upsertServicePeriod(
      period(null, null, {
        branch: "Army",
        component: "National Guard",
        rank: "SPC",
      }),
      meta("ngb22_rescan.pdf", 100),
    );

    expect(getServicePeriods()).toHaveLength(0);
    expect(getUnmatchedServiceRecords()[0].rank).toBe("SGT");
  });

  it("takes the incoming rank when its end date is genuinely later, even at lower confidence", () => {
    upsertServicePeriod(
      period("2005-01-01", "2005-08-25", {
        branch: "Army",
        component: "Active Duty",
        rank: "SPC",
      }),
      meta("dd214_2005.pdf", 100),
    );
    upsertServicePeriod(
      period("2005-01-03", "2005-08-27", {
        branch: "Army",
        component: "Active Duty",
        rank: "SGT",
      }),
      meta("codesheet.pdf", 40),
    );

    expect(getServicePeriods()[0].rank).toBe("SGT");
  });

  it("does not let an earlier record's rank override the later one already recorded", () => {
    upsertServicePeriod(
      period("2005-01-01", "2007-06-29", {
        branch: "Army",
        component: "Active Duty",
        rank: "SGT",
      }),
      meta("dd214_2007.pdf", 100),
    );
    upsertServicePeriod(
      period("2005-01-03", "2007-06-25", {
        branch: "Army",
        component: "Active Duty",
        rank: "SPC",
      }),
      meta("codesheet.pdf", 40),
    );

    expect(getServicePeriods()[0].rank).toBe("SGT");
  });
});

describe("C1: service periods - rank recency falls back to pay grade (D2)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // Both undated, same source document - lands in unmatchedServiceRecords
  // (N1c), same rank-recency rule applied there.
  it("falls back to pay grade when neither record has a date to compare", () => {
    upsertServicePeriod(
      period(null, null, {
        branch: "Army",
        component: "National Guard",
        rank: "SPC",
        payGrade: "E-4",
      }),
      meta("ngb22_rescan.pdf", 100),
    );
    upsertServicePeriod(
      period(null, null, {
        branch: "Army",
        component: "National Guard",
        rank: "SGT",
        payGrade: "E-5",
      }),
      meta("ngb22_rescan.pdf", 40),
    );

    expect(getUnmatchedServiceRecords()[0].rank).toBe("SGT");
  });

  // Observation (final9 QA, 2026-09-25): two DATED periods sharing an end
  // date used to keep whichever rank was already stored, no matter what -
  // right for a genuine re-scan, wrong when a second, more senior record
  // shares that end date. Falls back to pay grade, same as the undated
  // case above.
  it("breaks a same-end-date tie on pay grade, higher wins", () => {
    upsertServicePeriod(
      period("2005-01-01", "2007-06-29", {
        branch: "Army",
        component: "Active Duty",
        rank: "SPC",
        payGrade: "E-4",
      }),
      meta("dd214_a.pdf", 90),
    );
    upsertServicePeriod(
      period("2005-01-01", "2007-06-29", {
        branch: "Army",
        component: "Active Duty",
        rank: "SGT",
        payGrade: "E-5",
      }),
      meta("dd214_b.pdf", 40),
    );

    expect(getServicePeriods()[0].rank).toBe("SGT");
  });

  it("keeps the existing rank on a same-end-date tie when the incoming pay grade is not higher", () => {
    upsertServicePeriod(
      period("2005-01-01", "2007-06-29", {
        branch: "Army",
        component: "Active Duty",
        rank: "SGT",
        payGrade: "E-5",
      }),
      meta("dd214_a.pdf", 90),
    );
    upsertServicePeriod(
      period("2005-01-01", "2007-06-29", {
        branch: "Army",
        component: "Active Duty",
        rank: "SPC",
        payGrade: "E-4",
      }),
      meta("dd214_b.pdf", 40),
    );

    expect(getServicePeriods()[0].rank).toBe("SGT");
  });
});
