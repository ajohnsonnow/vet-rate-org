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
      period("2010-06-01", "2015-05-30", { branch: "Army", rank: "PVT" }),
      meta("scan1.pdf", 0.5),
    );
    upsertServicePeriod(
      period("2010-06-01", "2015-05-30", { branch: "Army", rank: "SGT" }),
      meta("scan2.pdf", 0.9),
    );

    const periods = getServicePeriods();
    expect(periods).toHaveLength(1);
    // Higher-confidence re-scan wins for the conflicting field
    expect(periods[0].rank).toBe("SGT");
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
