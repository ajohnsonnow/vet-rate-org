/**
 * Profile-side counterpart to veteranKnowledgeBase.codeSheetServicePeriods.test.js
 * (the VKB already had this right). _mergeExistingServicePeriod treated
 * serviceStartDateDerived as an ordinary SERVICE_PERIOD_MERGE_FIELDS entry,
 * so a code sheet's real printed date (serviceStartDateDerived: false)
 * "disagreed" with an existing NGB-22-calculated period's flag (true)
 * instead of superseding it - the calculated marker survived a code-sheet
 * correction on getServiceHistory().servicePeriods[], even though the
 * dates themselves were correctly overwritten. Fixture values are
 * synthetic, not any real veteran's data.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  upsertServicePeriod,
  updateServicePeriod,
  getServicePeriods,
  getServiceEntry,
} from "./veteranProfile";

function upsertNgb22(serviceStartDate = "2002-03-08") {
  return upsertServicePeriod(
    {
      serviceStartDate,
      serviceEndDate: "2010-06-15",
      serviceStartDateDerived: true,
      branch: "Army National Guard",
      formType: "NGB22",
    },
    { sourceDocument: "ngb22.pdf", confidence: 60 },
  );
}

function upsertCodeSheet(serviceStartDate = "2002-03-05") {
  return upsertServicePeriod(
    {
      serviceStartDate,
      serviceEndDate: "2010-06-15",
      branch: "Army National Guard",
      characterOfService: "Honorable",
      formType: "Code Sheet",
      sourceDocument: "codesheet.pdf",
    },
    {
      sourceDocument: "codesheet.pdf",
      confidence: 100,
      authoritativeDates: true,
    },
  );
}

describe("upsertServicePeriod: code sheet clears a stale calculated flag (after NGB-22)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("clears serviceStartDateDerived when the code sheet corrects an NGB-22-calculated period", () => {
    upsertNgb22();
    upsertCodeSheet();

    const periods = getServicePeriods();
    expect(periods).toHaveLength(1);
    expect(periods[0].serviceStartDate).toBe("2002-03-05");
    expect(periods[0].serviceStartDateDerived).toBe(false);
  });

  it("keeps the code sheet's printed date un-flagged when a later NGB-22 near-matches it (reverse order)", () => {
    upsertCodeSheet();
    upsertNgb22("2002-03-01");

    const periods = getServicePeriods();
    expect(periods).toHaveLength(1);
    expect(periods[0].serviceStartDate).toBe("2002-03-05");
    expect(periods[0].serviceStartDateDerived).toBe(false);
  });
});

describe("upsertServicePeriod: survives an NGB-22 re-import after the correction", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not let a re-imported NGB-22 re-mark an already-authoritative period", () => {
    upsertNgb22();
    upsertCodeSheet();
    // Re-processing the SAME NGB-22 again (e.g. Muster Call re-import).
    upsertNgb22();

    const periods = getServicePeriods();
    expect(periods).toHaveLength(1);
    expect(periods[0].serviceStartDate).toBe("2002-03-05");
    expect(periods[0].serviceStartDateDerived).toBe(false);
  });
});

describe("getServiceEntry: canonical selector reflects the corrected period", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reports source: calculated for an unresolved NGB-22 guess", () => {
    upsertNgb22();

    expect(getServiceEntry()).toMatchObject({
      date: "2002-03-08",
      derived: true,
      source: "calculated",
    });
  });

  it("reports source: code_sheet once the code sheet supplies the printed date", () => {
    upsertNgb22();
    upsertCodeSheet();

    expect(getServiceEntry()).toMatchObject({
      date: "2002-03-05",
      derived: false,
      source: "code_sheet",
    });
  });

  it("reports source: veteran once the veteran manually edits the period (My Packet editor)", () => {
    const id = upsertNgb22();

    // Mirrors MyPacket.jsx's _updateServicePeriodField: a manual edit of
    // serviceStartDate always clears serviceStartDateDerived too.
    updateServicePeriod(id, {
      serviceStartDate: "1998-11-01",
      serviceStartDateDerived: false,
    });

    expect(getServiceEntry()).toMatchObject({
      date: "1998-11-01",
      derived: false,
      source: "veteran",
    });
  });
});
