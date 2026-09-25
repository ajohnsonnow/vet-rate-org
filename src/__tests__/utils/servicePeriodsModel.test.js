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
} from "../../utils/veteranProfile";

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

  it("merges a re-scan of the same period (same date pair) instead of duplicating", () => {
    upsertServicePeriod(
      period("2010-06-01", "2015-05-30", { branch: "Army", mos: "11B" }),
      meta("scan1.pdf", 0.5),
    );
    upsertServicePeriod(
      period("2010-06-01", "2015-05-30", { branch: "Army", mos: "68W" }),
      meta("scan2.pdf", 0.9),
    );

    const periods = getServicePeriods();
    expect(periods).toHaveLength(1);
    // Higher-confidence re-scan wins for the conflicting field
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

  it("merges into the dated period from the same source document", () => {
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

// final7 QA follow-up, D1 (2026-09-24): a real C-File yielded several
// undated DD214-derived rows (different scans recovering different fields)
// alongside dated code-sheet and NGB-22 rows. None of the undated rows
// shared a source document or a boundary date with anything, so each
// became its own permanent "? - ?" row instead of consolidating into the
// one real period they all describe. Fixture values are generic, not the
// real veteran's data.
describe("C1: service periods - shared identity merges undated rows (D1)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("merges several undated rows sharing a branch+component identity into one row", () => {
    upsertServicePeriod(
      period(null, null, {
        branch: "Army",
        component: "National Guard",
        rank: "SGT",
        characterOfService: "GENERAL",
      }),
      meta("ngb22_discharge.pdf", 75),
    );
    upsertServicePeriod(
      period(null, null, { branch: "Army", component: "National Guard" }),
      meta("dd214_scan_a.pdf", 100),
    );
    upsertServicePeriod(
      period(null, null, { branch: "Army", component: "National Guard" }),
      meta("dd214_scan_b.pdf", 92),
    );
    upsertServicePeriod(
      period(null, null, {
        branch: "Army",
        component: "National Guard",
        payGrade: "E-5",
      }),
      meta("dd214_scan_c.pdf", 86),
    );

    const periods = getServicePeriods();
    expect(periods).toHaveLength(1);
    expect(periods[0].incomplete).toBe(true);
  });

  it("drops a zero-signal scan instead of giving it its own '? - ?' row", () => {
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

    expect(getServicePeriods()).toHaveLength(1);
  });
});

describe("C1: service periods - identity match stays narrow (D1)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("never merges undated rows across a genuinely different component", () => {
    upsertServicePeriod(
      period(null, null, {
        branch: "Army",
        component: "National Guard",
        rank: "SGT",
      }),
      meta("ngb22_discharge.pdf", 75),
    );
    upsertServicePeriod(
      period(null, null, {
        branch: "Army",
        component: "Active Duty",
        rank: "CPL",
      }),
      meta("dd214_ad.pdf", 90),
    );

    expect(getServicePeriods()).toHaveLength(2);
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
  });
});

// final7 QA follow-up, D2 (2026-09-24): rank must be resolved by which
// record is chronologically LATER, not by which scan had higher OCR
// confidence - a clean scan of an early enlistment isn't "later" than a
// garbled scan of the discharge that followed it.
describe("C1: service periods - a later record's rank wins (D2)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps the earlier-set rank when neither side has an end date to compare", () => {
    upsertServicePeriod(
      period(null, null, {
        branch: "Army",
        component: "National Guard",
        rank: "SGT",
      }),
      meta("ngb22_discharge.pdf", 75),
    );
    upsertServicePeriod(
      period(null, null, {
        branch: "Army",
        component: "National Guard",
        rank: "SPC",
      }),
      meta("dd214_scan.pdf", 100),
    );

    expect(getServicePeriods()[0].rank).toBe("SGT");
  });

  it("takes the incoming rank when its end date is genuinely later, even at lower confidence", () => {
    upsertServicePeriod(
      period(null, "2005-08-27", {
        branch: "Army",
        component: "Active Duty",
        rank: "SPC",
      }),
      meta("dd214_2005.pdf", 100),
    );
    upsertServicePeriod(
      period(null, "2007-06-29", {
        branch: "Army",
        component: "Active Duty",
        rank: "SGT",
      }),
      meta("dd214_2007.pdf", 40),
    );

    expect(getServicePeriods()[0].rank).toBe("SGT");
  });

  it("does not let an earlier record's rank override the later one already recorded", () => {
    upsertServicePeriod(
      period(null, "2007-06-29", {
        branch: "Army",
        component: "Active Duty",
        rank: "SGT",
      }),
      meta("dd214_2007.pdf", 100),
    );
    upsertServicePeriod(
      period(null, "2005-08-27", {
        branch: "Army",
        component: "Active Duty",
        rank: "SPC",
      }),
      meta("dd214_2005.pdf", 40),
    );

    expect(getServicePeriods()[0].rank).toBe("SGT");
  });
});

describe("C1: service periods - rank recency falls back to pay grade (D2)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("falls back to pay grade when neither record has a date to compare", () => {
    upsertServicePeriod(
      period(null, null, {
        branch: "Army",
        component: "National Guard",
        rank: "SPC",
        payGrade: "E-4",
      }),
      meta("dd214_early.pdf", 100),
    );
    upsertServicePeriod(
      period(null, null, {
        branch: "Army",
        component: "National Guard",
        rank: "SGT",
        payGrade: "E-5",
      }),
      meta("dd214_later.pdf", 40),
    );

    expect(getServicePeriods()[0].rank).toBe("SGT");
  });
});
