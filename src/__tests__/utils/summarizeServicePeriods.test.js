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
