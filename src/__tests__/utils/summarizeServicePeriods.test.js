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

  // D-B (final10 QA, 2026-09-25): previously fell back to estimating from
  // yearsService/monthsService when a period had no dates at all - now
  // skipped entirely instead, since it has no interval to place on the
  // union timeline the total is computed from (see the "undated period"
  // case in the D-B describe block below for full coverage).
  it("skips a fully undated period instead of estimating from yearsService/monthsService", () => {
    const summary = summarizeServicePeriods([
      { yearsService: 4, monthsService: 2, daysService: 0, incomplete: true },
    ]);
    expect(summary.totalTimeInService).toBeNull();
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

// N12 (final9 QA, 2026-09-25): a difference in case or incidental
// whitespace (a doubled OCR space) is not a real disagreement.
describe("summarizeServicePeriods: N12 - case/whitespace-insensitive disagreement check", () => {
  it("does not flag disagreement when periods differ only by case or whitespace", () => {
    const summary = summarizeServicePeriods([
      {
        characterOfService: "General Under Honorable Conditions",
        serviceEndDate: "2008-01-01",
      },
      {
        characterOfService: "GENERAL UNDER HONORABLE CONDITIONS ",
        serviceEndDate: "2012-01-01",
      },
      {
        characterOfService: "General  Under Honorable Conditions",
        serviceEndDate: "2016-01-01",
      },
      {
        characterOfService: "general under honorable conditions",
        serviceEndDate: "2020-01-01",
      },
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

// D-B (final10 QA, 2026-09-25): summing every period's own duration
// double-counted time covered by more than one period at once (a dated
// enclosing enlistment period plus its own Box 18 activation windows,
// most visibly) - Total time in service is now the union of the date
// intervals, merging overlaps before summing. Fixture values are generic.
describe("summarizeServicePeriods: D-B - Total time in service is a union of intervals, not a sum", () => {
  it("does not double-count a period nested entirely inside another", () => {
    const summary = summarizeServicePeriods([
      { serviceStartDate: "2000-01-01", serviceEndDate: "2010-01-01" },
      { serviceStartDate: "2003-01-01", serviceEndDate: "2004-01-01" },
    ]);
    // The nested period contributes nothing beyond the enclosing 10 years.
    expect(summary.totalTimeInService).toMatch(/^(9|10) years/);
  });

  it("does not double-count two periods that partially overlap", () => {
    const summary = summarizeServicePeriods([
      { serviceStartDate: "2000-01-01", serviceEndDate: "2005-01-01" },
      { serviceStartDate: "2003-01-01", serviceEndDate: "2008-01-01" },
    ]);
    // Union is 2000-01-01 to 2008-01-01 (8 years), not the naive 10-year
    // sum of two 5-year periods.
    expect(summary.totalTimeInService).toMatch(/^[78] years/);
    expect(summary.totalTimeInService).not.toMatch(/^(9|10) years/);
  });

  it("sums two adjacent (touching, non-overlapping) periods normally", () => {
    const summary = summarizeServicePeriods([
      { serviceStartDate: "2000-01-01", serviceEndDate: "2004-01-01" },
      { serviceStartDate: "2004-01-01", serviceEndDate: "2008-01-01" },
    ]);
    expect(summary.totalTimeInService).toMatch(/^[78] years/);
  });

  it("skips an undated period entirely instead of counting it", () => {
    const summary = summarizeServicePeriods([
      { serviceStartDate: "2000-01-01", serviceEndDate: "2004-01-01" },
      { yearsService: 3, incomplete: true },
    ]);
    expect(summary.totalTimeInService).toMatch(/^[34] years/);
  });

  // Regression (final10 QA correctness re-review, 2026-09-26): the
  // interval was [start, end) - the printed end date itself was excluded,
  // so a single-day period (start === end) counted as zero-length and two
  // DD214s that legitimately chain (one ends the day before the next
  // begins) each lost a real day instead of forming one continuous span.
  it("counts a single-day period as one real day, not zero", () => {
    const summary = summarizeServicePeriods([
      { serviceStartDate: "2005-05-05", serviceEndDate: "2005-05-05" },
    ]);
    expect(summary.totalTimeInService).toBe("1 day");
  });

  it("gives two chained DD214-style periods (end D, next start D+1) the same total as one continuous span", () => {
    const chained = summarizeServicePeriods([
      { serviceStartDate: "2000-01-01", serviceEndDate: "2003-12-31" },
      { serviceStartDate: "2004-01-01", serviceEndDate: "2007-12-31" },
    ]);
    const continuous = summarizeServicePeriods([
      { serviceStartDate: "2000-01-01", serviceEndDate: "2007-12-31" },
    ]);
    expect(chained.totalTimeInService).toBe("8 years");
    expect(chained.totalTimeInService).toBe(continuous.totalTimeInService);
  });
});

// D-F (final10 QA, 2026-09-25): punctuation/hyphen differences alone are
// not a real disagreement, same normalizer as _valuesConflict.
describe("summarizeServicePeriods: D-F - punctuation/hyphen-insensitive disagreement check", () => {
  it("does not flag disagreement when periods differ only by punctuation/hyphenation", () => {
    const summary = summarizeServicePeriods([
      {
        characterOfService: "GENERAL - UNDER HONORABLE CONDITIONS",
        serviceEndDate: "2008-01-01",
      },
      {
        characterOfService: "GENERAL UNDER HONORABLE CONDITIONS",
        serviceEndDate: "2012-01-01",
      },
    ]);
    expect(summary.characterOfServiceDisagrees).toBe(false);
  });

  it("still flags a genuine difference after punctuation normalization", () => {
    const summary = summarizeServicePeriods([
      { characterOfService: "Honorable", serviceEndDate: "2008-01-01" },
      {
        characterOfService: "GENERAL - UNDER HONORABLE CONDITIONS",
        serviceEndDate: "2012-01-01",
      },
    ]);
    expect(summary.characterOfServiceDisagrees).toBe(true);
  });
});
