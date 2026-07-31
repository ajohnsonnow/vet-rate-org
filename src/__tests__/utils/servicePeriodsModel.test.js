/**
 * C1: canonical multi-period service history model
 * (serviceHistory.servicePeriods[] in veteranProfile.js).
 *
 * Identity key is (serviceStartDate, serviceEndDate) — NOT filename — so a
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

describe("C1: service periods — identity and merge", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("creates a new period for a document-derived date pair", () => {
    upsertServicePeriod(
      {
        serviceStartDate: "2010-06-01",
        serviceEndDate: "2015-05-30",
        branch: "Army",
        rank: "SGT",
      },
      { sourceDocument: "dd214_1.pdf", confidence: 0.8 },
    );

    const periods = getServicePeriods();
    expect(periods).toHaveLength(1);
    expect(periods[0].branch).toBe("Army");
    expect(periods[0].userEdited).toBe(false);
    expect(periods[0].incomplete).toBe(false);
  });

  it("treats two different date pairs as two distinct periods (FIX-11)", () => {
    upsertServicePeriod(
      { serviceStartDate: "2004-01-01", serviceEndDate: "2008-01-01" },
      { sourceDocument: "dd214_a.pdf", confidence: 0.9 },
    );
    upsertServicePeriod(
      { serviceStartDate: "2008-06-01", serviceEndDate: "2012-06-01" },
      { sourceDocument: "dd214_b.pdf", confidence: 0.9 },
    );
    upsertServicePeriod(
      { serviceStartDate: "2012-09-01", serviceEndDate: "2016-09-01" },
      { sourceDocument: "dd214_c.pdf", confidence: 0.9 },
    );
    upsertServicePeriod(
      { serviceStartDate: "2016-12-01", serviceEndDate: "2020-12-01" },
      { sourceDocument: "dd214_d.pdf", confidence: 0.9 },
    );

    expect(getServicePeriods()).toHaveLength(4);
  });

  it("merges a re-scan of the same period (same date pair) instead of duplicating", () => {
    upsertServicePeriod(
      {
        serviceStartDate: "2010-06-01",
        serviceEndDate: "2015-05-30",
        branch: "Army",
        rank: "PVT",
      },
      { sourceDocument: "scan1.pdf", confidence: 0.5 },
    );
    upsertServicePeriod(
      {
        serviceStartDate: "2010-06-01",
        serviceEndDate: "2015-05-30",
        branch: "Army",
        rank: "SGT",
      },
      { sourceDocument: "scan2.pdf", confidence: 0.9 },
    );

    const periods = getServicePeriods();
    expect(periods).toHaveLength(1);
    // Higher-confidence re-scan wins for the conflicting field
    expect(periods[0].rank).toBe("SGT");
  });

  it("never overwrites a userEdited period from a later document import", () => {
    const id = addServicePeriod({
      serviceStartDate: "2010-06-01",
      serviceEndDate: "2015-05-30",
      branch: "Army",
      rank: "MANUALLY CORRECTED RANK",
    });
    expect(getServicePeriods().find((p) => p.id === id).userEdited).toBe(
      true,
    );

    upsertServicePeriod(
      {
        serviceStartDate: "2010-06-01",
        serviceEndDate: "2015-05-30",
        rank: "WRONG OCR RANK",
      },
      { sourceDocument: "rescan.pdf", confidence: 1 },
    );

    const periods = getServicePeriods();
    expect(periods).toHaveLength(1);
    expect(periods[0].rank).toBe("MANUALLY CORRECTED RANK");
  });

  it("keys an incomplete (single-date) period by date+sourceDocument, not dropping it", () => {
    upsertServicePeriod(
      { serviceStartDate: "2010-06-01", serviceEndDate: null },
      { sourceDocument: "torn_page.pdf", confidence: 0.4 },
    );

    const periods = getServicePeriods();
    expect(periods).toHaveLength(1);
    expect(periods[0].incomplete).toBe(true);
  });

  it("does not collide two different incomplete periods from different documents with the same single date", () => {
    upsertServicePeriod(
      { serviceStartDate: "2010-06-01", serviceEndDate: null },
      { sourceDocument: "doc_a.pdf", confidence: 0.4 },
    );
    upsertServicePeriod(
      { serviceStartDate: "2010-06-01", serviceEndDate: null },
      { sourceDocument: "doc_b.pdf", confidence: 0.4 },
    );

    expect(getServicePeriods()).toHaveLength(2);
  });

  it("updateServicePeriod marks the period userEdited", () => {
    const id = addServicePeriod({
      serviceStartDate: "2010-06-01",
      serviceEndDate: "2015-05-30",
      branch: "Army",
    });
    // addServicePeriod already sets userEdited: true; verify update
    // preserves it and applies the edit.
    updateServicePeriod(id, { rank: "CPL" });
    const updated = getServicePeriods().find((p) => p.id === id);
    expect(updated.rank).toBe("CPL");
    expect(updated.userEdited).toBe(true);
  });

  it("removeServicePeriod deletes only the targeted period", () => {
    const idA = addServicePeriod({
      serviceStartDate: "2004-01-01",
      serviceEndDate: "2008-01-01",
    });
    addServicePeriod({
      serviceStartDate: "2008-06-01",
      serviceEndDate: "2012-06-01",
    });

    removeServicePeriod(idA);
    const periods = getServicePeriods();
    expect(periods).toHaveLength(1);
    expect(periods.find((p) => p.id === idA)).toBeUndefined();
  });
});
