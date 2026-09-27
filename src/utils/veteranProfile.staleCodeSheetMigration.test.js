/**
 * A veteran who imported an NGB-22 then a code sheet on an OLDER version of
 * this app (before _mergeExistingServicePeriod's authoritativeDates bypass
 * existed) can have a period saved with formType "Code Sheet" but
 * serviceStartDateDerived still stuck at true - VA's own printed date then
 * reads "(calculated from net service)" forever, since nothing re-saves
 * that period going forward. getServiceHistory() migrates it once, keyed
 * off the same signal (Code Sheet formType/sources) that already proves
 * the date is not a guess. Fixture values are synthetic.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getServiceHistory, getServiceEntry } from "./veteranProfile";

const SERVICE_HISTORY_KEY = "vet_rate_service_history";

function seedLegacyHistory(overrides = {}) {
  localStorage.setItem(
    SERVICE_HISTORY_KEY,
    JSON.stringify({
      deployments: [],
      awards: [],
      dd214Data: null,
      serviceInfo: null,
      servicePeriods: [
        {
          id: "period_legacy_1",
          serviceStartDate: "2002-03-05",
          serviceStartDateDerived: true,
          serviceEndDate: "2010-06-15",
          formType: "Code Sheet",
          sources: [{ sourceDocument: "ngb22.pdf", formType: "NGB22" }],
          ...overrides,
        },
      ],
      unmatchedServiceRecords: [],
      dutyStations: [],
      documentPeriodCounts: {},
      // No schemaVersion at all - data saved before this field existed.
    }),
  );
}

describe("getServiceHistory migration: a stale code-sheet-corrected period is no longer marked calculated", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("clears serviceStartDateDerived on a period whose own formType is Code Sheet", () => {
    seedLegacyHistory();

    const history = getServiceHistory();
    expect(history.servicePeriods[0].serviceStartDateDerived).toBe(false);
    expect(getServiceEntry()).toMatchObject({
      date: "2002-03-05",
      derived: false,
    });
  });

  it("clears serviceStartDateDerived on a period a code sheet only contributed to (formType still NGB22)", () => {
    seedLegacyHistory({
      formType: "NGB22",
      sources: [
        { sourceDocument: "ngb22.pdf", formType: "NGB22" },
        { sourceDocument: "codesheet.pdf", formType: "Code Sheet" },
      ],
    });

    const history = getServiceHistory();
    expect(history.servicePeriods[0].serviceStartDateDerived).toBe(false);
  });

  it("leaves a genuinely unresolved calculated period (no code sheet contributor) untouched", () => {
    seedLegacyHistory({
      formType: "NGB22",
      sources: [{ sourceDocument: "ngb22.pdf", formType: "NGB22" }],
    });

    const history = getServiceHistory();
    expect(history.servicePeriods[0].serviceStartDateDerived).toBe(true);
  });

  it("persists the migration so it only runs once", () => {
    seedLegacyHistory();
    getServiceHistory();

    const saved = JSON.parse(localStorage.getItem(SERVICE_HISTORY_KEY));
    expect(saved.schemaVersion).toBeGreaterThanOrEqual(2);
    expect(saved.servicePeriods[0].serviceStartDateDerived).toBe(false);
  });
});
