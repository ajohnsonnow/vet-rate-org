/**
 * Pay-rate single-source-of-truth guard.
 *
 * src/data/vaPayRatesHistorical.js is the ONLY place compensation tables may
 * live. Every consumer (vaCalculator, TacticalCalculator, MillionDollarDashboard,
 * TimeMachine, WhatIfSandbox, the Python LLM tool) must derive from it.
 * These tests fail if anyone re-hardcodes a rate table — the bug class that
 * shipped three different rate vintages (2024/2025/2026) at once.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { VA_PAY_RATES_2026 } from "../../utils/vaCalculator";
import {
  VA_PAY_RATES_HISTORICAL,
  getCurrentYearRates,
  getHistoricalRate,
  analyzeRetroactivePay,
} from "../../data/vaPayRatesHistorical";

const HISTORICAL_2026 = VA_PAY_RATES_HISTORICAL[2026];

describe("vaCalculator derives its 2026 tables from the SSOT", () => {
  it.each([
    "solo",
    "spouse",
    "childUnder18",
    "childSchool",
    "parentOne",
    "parentTwo",
  ])("VA_PAY_RATES_2026.%s matches VA_PAY_RATES_HISTORICAL[2026]", (table) => {
    expect(VA_PAY_RATES_2026[table]).toEqual(HISTORICAL_2026[table]);
  });
});

describe("no component re-hardcodes a solo rate table", () => {
  // Distinctive solo-rate dollar values from every year in the SSOT.
  // A `<rating>: <value>` pair in a component/util source file means someone
  // pasted a rate table again instead of importing the SSOT.
  const soloValues = Object.values(VA_PAY_RATES_HISTORICAL)
    .flatMap((year) => Object.values(year.solo))
    .filter((v) => v > 0);

  const tableEntryPattern = new RegExp(
    `\\b\\d{1,3}\\s*:\\s*(${[...new Set(soloValues)]
      .map((v) => String(v).replace(".", "\\.") + "0?")
      .join("|")})\\b`,
  );

  const scanDirs = ["src/components", "src/utils", "src/features"];

  const offenders = [];
  for (const dir of scanDirs) {
    const root = path.join(process.cwd(), dir);
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root, { recursive: true })) {
      const file = path.join(root, String(entry));
      if (!/\.(jsx?|tsx?)$/.test(file) || !fs.statSync(file).isFile()) continue;
      const source = fs.readFileSync(file, "utf-8");
      if (tableEntryPattern.test(source)) {
        offenders.push(path.relative(process.cwd(), file));
      }
    }
  }

  it("finds zero hardcoded rate-table entries outside the SSOT", () => {
    expect(offenders).toEqual([]);
  });
});

describe("Python LLM tool stays in sync with the SSOT", () => {
  it("vaCalculatorTool.py VA_COMPENSATION_RATES matches historical 2026 solo", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/utils/vaCalculatorTool.py"),
      "utf-8",
    );
    const block = source.match(/VA_COMPENSATION_RATES = \{([\s\S]*?)\}/);
    expect(block).not.toBeNull();
    const entries = [...block[1].matchAll(/(\d+):\s*([\d.]+)/g)];
    expect(entries.length).toBe(10);
    for (const [, rating, value] of entries) {
      expect(Number(value)).toBe(HISTORICAL_2026.solo[Number(rating)]);
    }
    expect(source).toMatch(/RATES_YEAR = 2026/);
  });
});

describe("getCurrentYearRates", () => {
  it("returns a usable rate table with a known year", () => {
    const { year, rates, isLatest } = getCurrentYearRates();
    expect(VA_PAY_RATES_HISTORICAL[year]).toBeDefined();
    expect(rates.solo[100]).toBeGreaterThan(3000);
    expect(typeof isLatest).toBe("boolean");
  });
});

describe("getHistoricalRate input clamping", () => {
  it("clamps absurd dependent counts to 20", () => {
    const sane = getHistoricalRate(2026, 70, { childrenUnder18: 20 });
    const absurd = getHistoricalRate(2026, 70, { childrenUnder18: 200 });
    expect(absurd.monthly).toBe(sane.monthly);
  });

  it("treats non-numeric dependent counts as zero", () => {
    const solo = getHistoricalRate(2026, 70, {});
    const garbage = getHistoricalRate(2026, 70, { childrenUnder18: "lots" });
    expect(garbage.monthly).toBe(solo.monthly);
  });
});

describe("analyzeRetroactivePay input validation", () => {
  it("drops entries with unparseable effective dates", () => {
    const result = analyzeRetroactivePay([
      { effectiveDate: "not-a-date", rating: 50, dependents: {} },
    ]);
    expect(result.periods).toEqual([]);
  });

  it("keeps valid entries when mixed with invalid ones", () => {
    const result = analyzeRetroactivePay([
      { effectiveDate: "garbage", rating: 50, dependents: {} },
      { effectiveDate: "2025-01-15", rating: 50, dependents: {} },
    ]);
    expect(result.periods.length).toBeGreaterThan(0);
    expect(result.periods[0].rating).toBe(50);
  });

  it("does not skip months when the effective date is the 31st", () => {
    const result = analyzeRetroactivePay([
      { effectiveDate: "2025-01-31T12:00:00", rating: 50, dependents: {} },
    ]);
    const months = result.periods.map((p) => p.month);
    expect(months).toContain("2025-02");
  });
});
