/**
 * C3 / Q2: summarizeServicePeriods computes the Service tab's summary
 * view — branches served (deduped), Total time in service (SUM of period
 * durations) AND Service span (earliest entry → latest separation),
 * clearly separate per Q2, plus highest pay grade / most recent rank /
 * character of service (flagged on disagreement).
 */
import { describe, it, expect } from "vitest";
import { summarizeServicePeriods } from "../../utils/veteranProfile";

describe("summarizeServicePeriods", () => {
  it("returns an empty summary for no periods", () => {
    const summary = summarizeServicePeriods([]);
    expect(summary.branches).toEqual([]);
    expect(summary.totalTimeInService).toBeNull();
    expect(summary.serviceSpan).toBeNull();
  });

  it("dedups branches served across periods", () => {
    const summary = summarizeServicePeriods([
      {
        branch: "Army",
        serviceStartDate: "2004-01-01",
        serviceEndDate: "2008-01-01",
      },
      {
        branch: "Army National Guard",
        serviceStartDate: "2008-01-01",
        serviceEndDate: "2012-01-01",
      },
      {
        branch: "Army",
        serviceStartDate: "2012-01-01",
        serviceEndDate: "2016-01-01",
      },
    ]);
    expect(summary.branches).toEqual(["Army", "Army National Guard"]);
  });

  it("Q2: reports Total time in service as the SUM of period durations, distinct from Service span", () => {
    // Two periods with a 4-year break in service: 4 years + 4 years = 8
    // years total time, but a 12-year span from first entry to last exit.
    const summary = summarizeServicePeriods([
      { serviceStartDate: "2004-01-01", serviceEndDate: "2008-01-01" },
      { serviceStartDate: "2012-01-01", serviceEndDate: "2016-01-01" },
    ]);

    expect(summary.serviceSpan).toEqual({
      start: "2004-01-01",
      end: "2016-01-01",
    });
    // ~8 years total (sum of the two 4-year periods), not the 12-year span
    expect(summary.totalTimeInService).toMatch(/^7 years|^8 years/);
  });

  it("falls back to yearsService/monthsService when dates are incomplete", () => {
    const summary = summarizeServicePeriods([
      { yearsService: 4, monthsService: 2, daysService: 0, incomplete: true },
    ]);
    expect(summary.totalTimeInService).toMatch(/4 years, 2 months/);
  });

  it("picks the highest pay grade across periods", () => {
    const summary = summarizeServicePeriods([
      { payGrade: "E-4", serviceEndDate: "2008-01-01" },
      { payGrade: "E-7", serviceEndDate: "2016-01-01" },
      { payGrade: "E-5", serviceEndDate: "2012-01-01" },
    ]);
    expect(summary.highestPayGrade).toBe("E-7");
  });

  it("picks the most recent rank by latest serviceEndDate", () => {
    const summary = summarizeServicePeriods([
      { rank: "PVT", serviceEndDate: "2008-01-01" },
      { rank: "SGT", serviceEndDate: "2016-01-01" },
    ]);
    expect(summary.mostRecentRank).toBe("SGT");
  });

  it("uses the most recent period's character of service and flags disagreement", () => {
    const summary = summarizeServicePeriods([
      {
        characterOfService: "General Under Honorable Conditions",
        serviceEndDate: "2008-01-01",
      },
      { characterOfService: "Honorable", serviceEndDate: "2016-01-01" },
    ]);
    expect(summary.characterOfService).toBe("Honorable");
    expect(summary.characterOfServiceDisagrees).toBe(true);
  });

  it("does not flag disagreement when all periods share the same character of service", () => {
    const summary = summarizeServicePeriods([
      { characterOfService: "Honorable", serviceEndDate: "2008-01-01" },
      { characterOfService: "Honorable", serviceEndDate: "2016-01-01" },
    ]);
    expect(summary.characterOfServiceDisagrees).toBe(false);
  });
});

// N3 (final8 QA, 2026-09-24): a pay grade that lives on a row merged away
// from servicePeriods[] (unmatchedServiceRecords, or only ever reached
// dd214Data) must still surface as Highest Pay Grade instead of showing
// N/A.
describe("summarizeServicePeriods: N3 - Highest Pay Grade across all stored rows", () => {
  it("includes unmatchedRecords' pay grades", () => {
    const summary = summarizeServicePeriods(
      [{ payGrade: "E-4", serviceEndDate: "2008-01-01" }],
      { unmatchedRecords: [{ payGrade: "E-7" }] },
    );
    expect(summary.highestPayGrade).toBe("E-7");
  });

  it("includes dd214Data's pay grade", () => {
    const summary = summarizeServicePeriods(
      [{ payGrade: "E-4", serviceEndDate: "2008-01-01" }],
      { dd214Data: { payGrade: "E-6" } },
    );
    expect(summary.highestPayGrade).toBe("E-6");
  });

  it("computes Highest Pay Grade from unmatched/dd214Data even with zero periods", () => {
    const summary = summarizeServicePeriods([], {
      unmatchedRecords: [{ payGrade: "E-5" }],
      dd214Data: { payGrade: "E-3" },
    });
    expect(summary.highestPayGrade).toBe("E-5");
  });
});

// N1b: a same-row disagreement (recorded by _mergeExistingServicePeriod via
// fieldConflicts) feeds the same "Periods disagree" flag as two different
// periods with different characterOfService values.
describe("summarizeServicePeriods: N1b - a row-level fieldConflicts entry also flags disagreement", () => {
  it("flags disagreement from a row-level fieldConflicts entry, not just distinct periods", () => {
    const summary = summarizeServicePeriods([
      {
        characterOfService: "Honorable",
        serviceEndDate: "2008-01-01",
        fieldConflicts: [
          {
            field: "characterOfService",
            keptValue: "Honorable",
            conflictingValue: "General",
          },
        ],
      },
    ]);
    expect(summary.characterOfServiceDisagrees).toBe(true);
  });
});
