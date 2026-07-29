import { describe, it, expect } from "vitest";
import {
  parseBasicRatesRows,
  parseSmcMasterRows,
  parseColaArticle,
  validateParsed,
} from "../../scripts/legal-ingestion/fetch-rate-tables.mjs";

/**
 * S44 — rate-tables fetcher pure-function coverage. Row shapes below mirror
 * the real KnowVA "2025 COLA Rates" article's HTML table structure (verified
 * live, see fetch-rate-tables.mjs's header for the cross-validation that
 * caught older years disagreeing with the app's existing data — this suite
 * covers parsing mechanics, not source-data trustworthiness).
 */

describe("parseBasicRatesRows", () => {
  it("extracts the Veteran, V-S, V-1P and V-2P rows by dep-status text", () => {
    const rows = [
      ["Dep Code", "Dep Status", "10%", "20%", "30%", "Dep Code", "Dep Status"],
      [
        "0",
        "Veteran",
        "180.42",
        "356.66",
        "552.47",
        "795.84",
        "1132.90",
        "1435.02",
        "1808.45",
        "2102.15",
        "2362.30",
        "3938.58",
        "0",
        "Veteran",
      ],
      [
        "10",
        "V-S",
        "",
        "",
        "617.47",
        "882.84",
        "1241.90",
        "1566.02",
        "1961.45",
        "2277.15",
        "2559.30",
        "4158.17",
        "10",
        "V-S",
      ],
    ];
    const { byStatus, skipped } = parseBasicRatesRows(rows);
    expect(byStatus.get("Veteran")).toEqual({
      10: 180.42,
      20: 356.66,
      30: 552.47,
      40: 795.84,
      50: 1132.9,
      60: 1435.02,
      70: 1808.45,
      80: 2102.15,
      90: 2362.3,
      100: 3938.58,
    });
    expect(byStatus.get("V-S")[30]).toBe(617.47);
    expect(byStatus.get("V-S")[10]).toBeNull();
    // The header row is explicitly recognized-and-ignored, not an unknown
    // shape, so it isn't counted here (see the "skips footnote, header, and
    // malformed rows" test below for that distinction).
    expect(skipped).toBe(0);
  });

  it("parses 'each additional child' and schoolchild rows into the 30-100% ladder", () => {
    const rows = [
      [
        "Each additional child",
        "",
        "",
        "32",
        "43",
        "54",
        "65",
        "76",
        "87",
        "98",
        "109.11",
        "Each additional child",
      ],
      [
        "Each additional schoolchild (see footnote a)",
        "",
        "",
        "105",
        "140",
        "176",
        "211",
        "246",
        "281",
        "317",
        "352.45",
        "Each additional schoolchild (see footnote a)",
      ],
    ];
    const { childUnder18, childSchool } = parseBasicRatesRows(rows);
    expect(childUnder18).toEqual({
      30: 32,
      40: 43,
      50: 54,
      60: 65,
      70: 76,
      80: 87,
      90: 98,
      100: 109.11,
    });
    expect(childSchool[100]).toBe(352.45);
  });

  it("handles whole-dollar values without decimals (not just cents-formatted)", () => {
    // Regression: an earlier value-scanning approach only recognized
    // "\d+.\d{2}" cells and silently dropped whole-dollar rate columns.
    const rows = [
      [
        "50/60",
        "V-1P",
        "",
        "",
        "604.47",
        "865.84",
        "1220.90",
        "1540.02",
        "1931.45",
        "2242.15",
        "2520.30",
        "4114.82",
        "50/60",
        "V-1P",
      ],
    ];
    const { byStatus } = parseBasicRatesRows(rows);
    expect(byStatus.get("V-1P")[30]).toBe(604.47);
  });

  it("skips footnote, header, and malformed rows without throwing", () => {
    const rows = [
      ["FOOTNOTES: a. Rates for each school child are shown separately."],
      ["Entitlement Codes 01, 11, 21, 31, 41, 51, 61, 71, and 91"],
      ["Additional for A/A spouse (see footnote b)", "61", "81"],
      [""],
    ];
    const { byStatus, childUnder18, childSchool, skipped } =
      parseBasicRatesRows(rows);
    expect(byStatus.size).toBe(0);
    expect(childUnder18).toBeNull();
    expect(childSchool).toBeNull();
    expect(skipped).toBe(0); // all explicitly recognized+skipped, not "unknown shape"
  });
});

describe("parseSmcMasterRows", () => {
  it("extracts both side-by-side code entries from one packed row", () => {
    const rows = [
      [
        "SMC Code",
        "Award Abbreviation",
        "Basic Rate",
        "Hospital Rate",
        "Notes",
      ],
      ["1", "K", "139.87", "N/C", "", "48", "S", "4408.53", "N/C", ""],
      ["3", "L", "4900.83", "4408.53", "a"],
    ];
    const { entries } = parseSmcMasterRows(rows);
    expect(entries).toEqual([
      { code: 1, award: "K", basicRate: 139.87, hospitalRate: null, notes: "" },
      {
        code: 48,
        award: "S",
        basicRate: 4408.53,
        hospitalRate: null,
        notes: "",
      },
      {
        code: 3,
        award: "L",
        basicRate: 4900.83,
        hospitalRate: 4408.53,
        notes: "a",
      },
    ]);
  });

  it("skips a code entry whose basic-rate cell isn't a real rate (e.g. a stray 'h' marker)", () => {
    const rows = [["45", "", "h", "N/C", ""]];
    const { entries, skipped } = parseSmcMasterRows(rows);
    expect(entries).toEqual([]);
    expect(skipped).toBe(1);
  });

  it("ignores a trailing free-text notes cell that doesn't fit the code/rate shape", () => {
    const rows = [
      [
        "44",
        "N½+K+R(2)A&A",
        "11048.42",
        "6653.87",
        "",
        "Note: As of February 2026, basic codes 62 and 63 have been removed.",
      ],
    ];
    const { entries } = parseSmcMasterRows(rows);
    expect(entries).toEqual([
      {
        code: 44,
        award: "N½+K+R(2)A&A",
        basicRate: 11048.42,
        hospitalRate: 6653.87,
        notes: "",
      },
    ]);
  });
});

function buildFixtureHtml(smcCodeCount = 32) {
  const smcRows = Array.from(
    { length: smcCodeCount },
    (_, i) =>
      `<tr><td>${i + 1}</td><td>K${i}</td><td>${100 + i}.00</td><td>N/C</td><td></td></tr>`,
  ).join("");
  return `
    <table><tr><td>DISABILITY COMPENSATION - BASIC RATES</td></tr></table>
    <table><tr><td>Entitlement Codes 01</td><td>PL 119-42 Effective 12/01/2025 (2.8%)</td></tr></table>
    <table>
      <tr><th>Dep Code</th><th>Dep Status</th><th>10%</th><th>20%</th><th>30%</th><th>40%</th><th>50%</th><th>60%</th><th>70%</th><th>80%</th><th>90%</th><th>100%</th><th>Dep Code</th><th>Dep Status</th></tr>
      <tr><td>0</td><td>Veteran</td><td>180.42</td><td>356.66</td><td>552.47</td><td>795.84</td><td>1132.90</td><td>1435.02</td><td>1808.45</td><td>2102.15</td><td>2362.30</td><td>3938.58</td><td>0</td><td>Veteran</td></tr>
      <tr><td>10</td><td>V-S</td><td></td><td></td><td>617.47</td><td>882.84</td><td>1241.90</td><td>1566.02</td><td>1961.45</td><td>2277.15</td><td>2559.30</td><td>4158.17</td><td>10</td><td>V-S</td></tr>
      <tr><td>50/60</td><td>V-1P</td><td></td><td></td><td>604.47</td><td>865.84</td><td>1220.90</td><td>1540.02</td><td>1931.45</td><td>2242.15</td><td>2520.30</td><td>4114.82</td><td>50/60</td><td>V-1P</td></tr>
      <tr><td>70</td><td>V-2P</td><td></td><td></td><td>656.47</td><td>935.84</td><td>1308.90</td><td>1645.02</td><td>2054.45</td><td>2382.15</td><td>2678.30</td><td>4291.06</td><td>70</td><td>V-2P</td></tr>
      <tr><td>Each additional child</td><td></td><td></td><td>32</td><td>43</td><td>54</td><td>65</td><td>76</td><td>87</td><td>98</td><td>109.11</td><td>Each additional child</td></tr>
      <tr><td>Each additional schoolchild (see footnote a)</td><td></td><td></td><td>105</td><td>140</td><td>176</td><td>211</td><td>246</td><td>281</td><td>317</td><td>352.45</td><td>Each additional schoolchild (see footnote a)</td></tr>
    </table>
    <table><tr><td>FOOTNOTES: a. Rates for each school child are shown separately.</td></tr></table>
    <table><tr><td>SPECIAL MONTHLY COMPENSATION CODES AND RATES</td></tr></table>
    <table><tr><th>SMC Code</th><th>Award Abbreviation</th><th>Basic Rate</th><th>Hospital Rate</th><th>Notes</th></tr>${smcRows}</table>
  `;
}

describe("parseColaArticle + validateParsed (integration)", () => {
  it("parses a realistic fixture into a fully valid result", () => {
    const parsed = parseColaArticle(buildFixtureHtml());
    expect(parsed.effectiveDate).toBe("12/01/2025");
    expect(parsed.colaPercent).toBe(2.8);
    expect(parsed.publicLaw).toBe("119-42");
    expect(parsed.veteran[100]).toBe(3938.58);
    expect(parsed.spouse[30]).toBe(617.47);
    expect(parsed.childUnder18[100]).toBe(109.11);
    expect(parsed.smc.length).toBe(32);
    expect(validateParsed(parsed)).toBeNull();
  });

  it("flags a too-thin SMC table rather than silently accepting it", () => {
    const parsed = parseColaArticle(buildFixtureHtml(5));
    const reason = validateParsed(parsed);
    expect(reason).toMatch(/SMC table too thin/);
  });

  it("flags missing dependency rows", () => {
    const reason = validateParsed({
      effectiveDate: "12/01/2025",
      veteran: null,
      spouse: {},
      parentOne: {},
      parentTwo: {},
      childUnder18: {},
      childSchool: {},
      smc: new Array(40).fill({}),
    });
    expect(reason).toMatch(
      /missing one or more required dependency-status rows/,
    );
  });
});
