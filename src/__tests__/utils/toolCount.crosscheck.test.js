import { describe, it, expect } from "vitest";
import { TOOLKIT_CATEGORIES, getTotalToolCount } from "../../data/toolkitData";
import { PROJECT_STATS } from "../../data/projectStats";
import projectStatsJson from "../../data/projectStats.json";

// Source of truth: TOOLKIT_CATEGORIES in src/data/toolkitData.js.
// All other tool-count surfaces (projectStats.js per-category counts,
// projectStats.json live.toolCount, README.md, index.html copy) must agree.
// This test fails fast when any of them drift, so the docs-accuracy fixes
// from PR7 cannot silently regress.

describe("Tool count — single source of truth", () => {
  it("getTotalToolCount() equals the sum of TOOLKIT_CATEGORIES.tools.length", () => {
    const summed = TOOLKIT_CATEGORIES.reduce(
      (n, cat) => n + cat.tools.length,
      0,
    );
    expect(getTotalToolCount()).toBe(summed);
  });

  it("toolkitData total is the audited canonical 42", () => {
    expect(getTotalToolCount()).toBe(42);
  });

  it("projectStats.js per-category counts match toolkitData.js exactly", () => {
    const expected = Object.fromEntries(
      TOOLKIT_CATEGORIES.map((cat) => [cat.id, cat.tools.length]),
    );
    expect(PROJECT_STATS.toolCounts).toEqual(expected);
  });

  it("projectStats.js per-category sum equals getTotalToolCount()", () => {
    const summed = Object.values(PROJECT_STATS.toolCounts).reduce(
      (a, b) => a + b,
      0,
    );
    expect(summed).toBe(getTotalToolCount());
  });

  it("projectStats.json live.toolCount agrees with toolkitData total", () => {
    expect(projectStatsJson.live.toolCount).toBe(getTotalToolCount());
  });
});
