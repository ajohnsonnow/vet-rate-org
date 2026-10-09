/**
 * ADR-007 §11: the schemaVersion 2->3 migration. Each repair step is gated
 * on its OWN prior version (v<1, v<2, v<3, and D11-4's own v<4) so a
 * history already past a given step never re-runs it (G3). The v3 steps
 * infer provenance for data older than serviceStartDateSource, then fold
 * the legacy D12-2 duplicate-period pairs a >7-day review correction used
 * to leave behind. Fixture values are synthetic, not any real veteran's
 * data.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getServiceHistory, getServicePeriods } from "./veteranProfile";

const HISTORY_KEY = "vet_rate_service_history";
const PROFILE_KEY = "vet_rate_veteran_profile";
const NGB22_BOX18_NOTES =
  "Date range from NGB-22 Box 18 remarks (no location listed on the document).";

function seed(history) {
  localStorage.clear();
  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify({
      unmatchedServiceRecords: [],
      deployments: [],
      dutyStations: [],
      documentPeriodCounts: {},
      ...history,
    }),
  );
}

function seedProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function rawHistory() {
  return JSON.parse(localStorage.getItem(HISTORY_KEY));
}

function ngb22Period(id, start, derived, extra = {}) {
  return {
    id,
    serviceStartDate: start,
    serviceEndDate: "2010-06-15",
    serviceStartDateDerived: derived,
    userEdited: false,
    formType: "NGB22",
    sourceDocument: "ngb22-synthetic.pdf",
    sources: [{ sourceDocument: "ngb22-synthetic.pdf", formType: "NGB22" }],
    ...extra,
  };
}

function duplicatePairHistory(extraPeriods = []) {
  return {
    schemaVersion: 2,
    servicePeriods: [
      ngb22Period("A", "2002-01-10", true, { fieldConflicts: [] }),
      ngb22Period("B", "2002-08-01", false, { fieldConflicts: [] }),
      ...extraPeriods,
    ],
    documentPeriodCounts: { "ngb22-synthetic.pdf": 2 + extraPeriods.length },
  };
}

describe("v3 migration: D12-2 legacy duplicate-period merge", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("merges an unmerged >7-day review-correction pair into one period", () => {
    seed({
      ...duplicatePairHistory(),
      deployments: [{ id: "dep1", theater: "Iraq", periodId: "B" }],
      dutyStations: [{ id: "ds1", name: "Some Base", periodId: "B" }],
    });

    const history = getServiceHistory();
    expect(history.servicePeriods).toHaveLength(1);
    const merged = history.servicePeriods[0];
    expect(merged.id).toBe("A");
    expect(merged.serviceStartDate).toBe("2002-08-01");
    expect(merged.serviceStartDateDerived).toBe(false);
    expect(merged.serviceStartDateSource).toBe("veteran");
    expect(merged.startDateCorrection).toMatchObject({
      via: "legacy_muster_review",
      documentDate: "2002-01-10",
      documentSource: "calculated",
    });
    expect(history.deployments[0].periodId).toBe("A");
    expect(history.dutyStations[0].periodId).toBe("A");
    expect(history.documentPeriodCounts["ngb22-synthetic.pdf"]).toBe(1);
  });

  it("leaves an ambiguous shape (more than one candidate pair) untouched", () => {
    // A third period sharing the same document/end date means no pair is
    // unambiguous, so none merge; pickServiceEntry's own grouping still
    // resolves the winner correctly regardless.
    seed(duplicatePairHistory([ngb22Period("C", "2002-09-01", false)]));

    const history = getServiceHistory();
    expect(history.servicePeriods).toHaveLength(3);
  });
});

describe("v3 migration: D12-2 merge idempotence and conservation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("is idempotent - re-running the same migration logic changes nothing further", () => {
    seed(duplicatePairHistory());
    getServiceHistory();
    const firstPass = JSON.parse(JSON.stringify(rawHistory()));

    const forced = rawHistory();
    forced.schemaVersion = 2;
    seed(forced);
    getServiceHistory();

    expect(rawHistory().servicePeriods).toEqual(firstPass.servicePeriods);
  });

  it("conservation: every original date survives as a start, a documentDate, or a fieldConflicts value", () => {
    seed(duplicatePairHistory());

    const history = getServiceHistory();
    const reachable = [
      ...history.servicePeriods.map((p) => p.serviceStartDate),
      ...history.servicePeriods.map((p) => p.startDateCorrection?.documentDate),
      ...history.servicePeriods.flatMap((p) =>
        (p.fieldConflicts || []).map((c) => c.conflictingValue),
      ),
    ];
    expect(reachable).toContain("2002-01-10");
    expect(reachable).toContain("2002-08-01");
  });
});

function contaminatedWindowPeriod() {
  return {
    id: "window1",
    serviceStartDate: null,
    serviceEndDate: null,
    userEdited: false,
    formType: "NGB22",
    notes: NGB22_BOX18_NOTES,
    sourceDocument: "ngb22-synthetic.pdf",
    sources: [{ sourceDocument: "ngb22-synthetic.pdf", formType: "NGB22" }],
    payGrade: "E-5",
  };
}

describe("v3 migration [G3]: per-version gating never re-runs an earlier repair", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("v0/undefined data still runs the v1 window-contamination repair", () => {
    seed({ servicePeriods: [contaminatedWindowPeriod()] });
    const history = getServiceHistory();
    expect(history.servicePeriods[0].payGrade).toBe("");
    expect(history.unmatchedServiceRecords).toHaveLength(1);
  });

  it("v2 data does NOT re-run the v1 window-contamination repair", () => {
    seed({ schemaVersion: 2, servicePeriods: [contaminatedWindowPeriod()] });
    const history = getServiceHistory();
    // The v1 contamination repair itself did not re-fire (that repair
    // fabricates an unmatched record when it runs; it never does at v2).
    // payGrade is no longer a safe canary for that specific repair once
    // D11-4's own v<4 step exists (final12 QA) - the same "no proven rank
    // contributor" shape is exactly what that separate, later repair
    // clears here, at v2 < 4.
    expect(history.servicePeriods[0].payGrade).toBe("");
    expect(history.unmatchedServiceRecords).toHaveLength(0);
  });

  it("v1 data runs the v2 stale-code-sheet-derived repair but not the v1 window repair", () => {
    seed({
      schemaVersion: 1,
      servicePeriods: [
        contaminatedWindowPeriod(),
        {
          id: "codeSheetPeriod",
          serviceStartDate: "2002-03-01",
          serviceEndDate: "2010-06-15",
          serviceStartDateDerived: true,
          formType: "Code Sheet",
          sourceDocument: "codesheet-synthetic.pdf",
          sources: [
            {
              sourceDocument: "codesheet-synthetic.pdf",
              formType: "Code Sheet",
            },
          ],
        },
      ],
    });
    const history = getServiceHistory();
    // v1 contamination repair did NOT run (still at v1, not < 1) - it
    // would have fabricated an unmatched record, which it did not.
    // D11-4's own v<4 guessed-rank repair (final12 QA) runs regardless
    // (1 < 4) and clears this same window's payGrade - a different,
    // narrower repair than the one this assertion is about.
    const window1 = history.servicePeriods.find((p) => p.id === "window1");
    expect(window1.payGrade).toBe("");
    expect(history.unmatchedServiceRecords).toHaveLength(0);
    // v2 stale-derived-flag repair DID run (1 < 2).
    const codeSheetPeriod = history.servicePeriods.find(
      (p) => p.id === "codeSheetPeriod",
    );
    expect(codeSheetPeriod.serviceStartDateDerived).toBe(false);
  });
});

describe("v3 migration: legacy provenance adoption (G7)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("an unmarked, non-derived FormsHelper flat date is adopted (rule B) over an all-calculated history", () => {
    seed({
      schemaVersion: 2,
      servicePeriods: [ngb22Period("calc", "2002-03-05", true)],
    });
    seedProfile({
      fullName: "Jordan Sample",
      serviceStartDate: "1998-05-01",
      serviceStartDateDerived: false,
    });

    getServiceHistory();
    const period = getServicePeriods().find((p) => p.id === "calc");
    expect(period.serviceStartDate).toBe("1998-05-01");
    expect(period.serviceStartDateSource).toBe("veteran");
    expect(period.startDateCorrection.via).toBe("legacy_profile");
  });

  it("the same flat date over a history with a printed period is recorded as a conflict instead", () => {
    seed({
      schemaVersion: 2,
      servicePeriods: [
        ngb22Period("printed", "2002-03-05", false, {
          formType: "DD214",
          sourceDocument: "dd214-synthetic.pdf",
          sources: [
            { sourceDocument: "dd214-synthetic.pdf", formType: "DD214" },
          ],
        }),
      ],
    });
    seedProfile({
      fullName: "Jordan Sample",
      serviceStartDate: "1998-05-01",
      serviceStartDateDerived: false,
    });

    getServiceHistory();
    const period = getServicePeriods().find((p) => p.id === "printed");
    expect(period.serviceStartDate).toBe("2002-03-05");
    expect(
      period.fieldConflicts.some(
        (c) =>
          c.field === "serviceStartDate" && c.conflictingValue === "1998-05-01",
      ),
    ).toBe(true);
  });
});

describe("v3 migration: legacy dd214Data adoption (G8, G13)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("[G13] a D11-1-era correction present only in dd214Data is adopted onto the calculated period (rule A)", () => {
    seed({
      schemaVersion: 2,
      dd214Data: {
        entryDate: "1998-05-01",
        entryDateDerived: false,
        separationDate: "2010-06-15",
      },
      servicePeriods: [ngb22Period("calc", "2002-03-05", true)],
    });

    getServiceHistory();
    const period = getServicePeriods().find((p) => p.id === "calc");
    expect(period.serviceStartDate).toBe("1998-05-01");
    expect(period.serviceStartDateSource).toBe("veteran");
    expect(period.startDateCorrection.via).toBe("legacy_dd214");
  });

  it("[G8] dd214Data MM/DD/YYYY equal to an ISO period start is known (no conflict)", () => {
    seed({
      schemaVersion: 2,
      dd214Data: {
        entryDate: "03/05/2002",
        entryDateDerived: false,
        separationDate: "06/15/2010",
      },
      servicePeriods: [
        ngb22Period("printed", "2002-03-05", false, {
          formType: "DD214",
          sourceDocument: "dd214-synthetic.pdf",
          sources: [
            { sourceDocument: "dd214-synthetic.pdf", formType: "DD214" },
          ],
        }),
      ],
    });

    getServiceHistory();
    const period = getServicePeriods().find((p) => p.id === "printed");
    expect(period.fieldConflicts || []).toHaveLength(0);
  });
});
