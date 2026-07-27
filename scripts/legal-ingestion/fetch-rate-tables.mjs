#!/usr/bin/env node
/**
 * fetch-rate-tables.mjs — fetch VA disability compensation + SMC rate tables
 * from KnowVA (S44).
 *
 * Same KnowVA "Compensation and Pension" tree as M21-1/M21-5 (portal
 * 554400000001018), found by listing the Rate Tables topic's children:
 * Current (554400000005317) > Compensation (554400000005319), and
 * Historical (554400000005318) > Compensation (554400000005321) >
 * "12/01/2014 and Later..." (554400000018995, one article per COLA year).
 *
 * Investigated to answer "would KnowVA's rate tables be better than what we
 * have": the CURRENT-year numbers match src/data/vaPayRatesHistorical.js's
 * existing (already va.gov-verified) entry exactly, and KnowVA has one real
 * gap ours lacked entirely — Special Monthly Compensation (SMC) rates (zero
 * SMC data existed in the app before this).
 *
 * Mechanism differs from M21-1/M21-5: those manuals are prose (fetched via
 * the `contentText` attribute, chunked into a DKB shard for RAG). Rate
 * tables are structured numeric data feeding a JS data module directly, not
 * a shard — so this fetcher requests the `content` attribute instead
 * (raw HTML with real <table> elements) and parses it with jsdom, which is
 * far more reliable than reconstructing table structure from `contentText`'s
 * whitespace-mangled plain-text rendering of the same tables.
 *
 * Table HTML layout is NOT stable across years (column counts/positions
 * drift, e.g. 2016's SMC table has code/rate data crammed into single
 * malformed cells). Basic-rate rows are parsed positionally (see
 * parseBasicRatesRows doc — value-scanning was tried first but rate cells
 * aren't reliably distinguishable from dep-code cells by format alone).
 * SMC rows are found by scanning for a numeric SMC-code anchor cell rather
 * than a fixed column offset, because the table packs two code entries
 * side-by-side per row and some rows are ragged. A row that doesn't fit
 * either pattern is skipped with a warning — never guessed at.
 *
 * S44 SCOPE DECISION — current year only, not historical: parsing was
 * verified by cross-checking every derived value (spouse/child/parent
 * deltas) against vaPayRatesHistorical.js's existing hand-entered entries.
 * The 2025 COLA Rates article (→ app's 2026 rate year) matched EXACTLY,
 * zero discrepancies, and that entry is independently verified against a
 * live fetch of va.gov's own current-rates page. But the SAME check against
 * the 2017-2024 archived articles (→ app years 2018-2025) found real
 * discrepancies — up to ~$1 on some cells, in BOTH directly-read values
 * (e.g. the base veteran-alone rate) and derived deltas. This isn't a
 * parser bug (checked the raw table cells by hand); KnowVA's own historical
 * archive appears to carry small inconsistencies for past years that the
 * app's existing, independently-verified data doesn't have. Given this
 * feeds real compensation-underpayment math shown to veterans, only the
 * current year is trusted enough to ship (user decision, 2026-07-20).
 * Historical fetch/parse still runs (informational, opt-in — see env knobs
 * below) so a future session can revisit if a second independent source
 * shows up to arbitrate the discrepancy.
 *
 * OTHER KNOWN GAPS, not fetched here (see knowledge-sources.yaml notes):
 *   - 2014/2015 COLA articles are attachment-stub-only (real data is in a
 *     PDF, "01/01/2014 and Older..." topic 554400000018991); 2016's article
 *     has a malformed SMC table (see above) — all three are detected and
 *     skipped automatically, not hardcoded, so a future upstream fix would
 *     be picked up without a code change. Moot for now given the scope
 *     decision above, but kept working in case that changes.
 *   - Pre-2014 rates (1933-2014) exist only as PDF attachments on that same
 *     topic. The KnowVA v11 JSON API has no attachment-listing endpoint we
 *     could find (probed $attribute=attachment and several plausible REST
 *     paths, all 400/404) — pulling those would need browser-based network
 *     capture to find the real download mechanism first. Not attempted.
 *   - Special Benefit Allowances / Spina Bifida / Birth Defects rate tables
 *     are visible in the same articles but their section labels sit in
 *     irregularly-nested HTML (not a reliable sibling-of-table position) —
 *     skipped rather than risk mislabeling Auto vs. Clothing allowance rows.
 *
 * Output: scripts/legal-ingestion/.work/rate-tables.json — one entry per
 * source COLA article. NOT consumed directly by the app; run
 * apply-smc-rates.mjs afterward, which uses ONLY the current-year entry (see
 * scope decision above) to generate src/data/vaSmcRatesHistorical.js, cross-
 * validating its base-rate deltas against vaPayRatesHistorical.js first and
 * refusing to proceed on any mismatch.
 *
 * Env knobs:
 *   RATE_TABLES_PORTAL_ID           override portal id
 *   RATE_TABLES_CURRENT_TOPIC       override "Current > Compensation" topic id
 *   RATE_TABLES_HISTORICAL_TOPIC    override "Historical > Compensation, 2014+" topic id
 *   RATE_TABLES_INCLUDE_HISTORICAL  set to "1" to also fetch/parse historical
 *                                   years — informational only, NOT used by
 *                                   apply-smc-rates.mjs (see scope decision)
 */

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORK_DIR = path.join(__dirname, ".work");

const BASE = "https://www.knowva.ebenefits.va.gov";
const PORTAL_ID = process.env.RATE_TABLES_PORTAL_ID || "554400000001018";
const CURRENT_TOPIC =
  process.env.RATE_TABLES_CURRENT_TOPIC || "554400000005319";
const HISTORICAL_TOPIC =
  process.env.RATE_TABLES_HISTORICAL_TOPIC || "554400000018995";
const LANG = "en-us";

const USER_AGENT =
  "vet-rate-org legal-ingestion/1.0 (anthony.johnson.now@gmail.com)";

async function apiJson(pathAndQuery) {
  const url = `${BASE}${pathAndQuery}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`rate-tables ${url} → HTTP ${res.status}`);
  return res.json();
}

async function fetchArticles(topicId) {
  const q =
    `/system/ws/v11/ss/article` +
    `?$attribute=name,id,content` +
    `&$lang=${LANG}&$rangesize=50&$rangestart=0` +
    `&portalId=${PORTAL_ID}&topicId=${topicId}&usertype=customer`;
  const json = await apiJson(q);
  const a = json?.article;
  if (Array.isArray(a)) return a;
  if (a && typeof a === "object") return [a];
  return [];
}

/** Extract every <table> as an array of row-arrays of trimmed cell text. */
function extractTables(html) {
  const dom = new JSDOM(`<div id="root">${html || ""}</div>`);
  return [...dom.window.document.querySelectorAll("table")].map((t) =>
    [...t.querySelectorAll("tr")].map((tr) =>
      [...tr.querySelectorAll("th,td")].map((c) =>
        c.textContent.replace(/\s+/g, " ").trim(),
      ),
    ),
  );
}

const MONEY_RE = /^\d[\d,]*\.\d{2}$/;
const PCT_LADDER_10 = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const PCT_LADDER_8 = [30, 40, 50, 60, 70, 80, 90, 100];

/** Parse a rate cell: "" -> null (N/A), otherwise a number (some years omit
 * cents on whole-dollar amounts, e.g. "32" not "32.00" — can't require a
 * decimal point here without also rejecting those). */
function parseRateCell(c) {
  const t = String(c || "").trim();
  if (t === "") return null;
  const n = Number(t.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse the "DISABILITY COMPENSATION - BASIC RATES" section's data rows into
 * a depStatus -> {pct: rate} map, plus the two "each additional ___" rows.
 * Deliberately positional, not value-scanned: rate cells aren't reliably
 * distinguishable from dep-code cells by format alone (both can be bare
 * integers — a rate delta of "32" and a dep code of "32" look identical),
 * so a row is classified first by its label/cell-1 shape, then a fixed
 * number of trailing cells is read off for that shape. Rows whose length
 * doesn't match either known shape are skipped (counted, not guessed at).
 * @param {Array<Array<string>>} rows
 * @returns {{byStatus: Map<string,Object>, childUnder18: Object|null, childSchool: Object|null, skipped: number}}
 */
export function parseBasicRatesRows(rows) {
  const byStatus = new Map();
  let childUnder18 = null;
  let childSchool = null;
  let skipped = 0;

  for (const row of rows) {
    const label = String(row[0] || "").trim();
    if (
      !label ||
      /^Dep\s/i.test(label) ||
      /^FOOTNOTES/i.test(label) ||
      /^Entitlement Codes/i.test(label) ||
      /^Additional for A\/A spouse/i.test(label)
    ) {
      continue;
    }

    // "Each additional child" / "Each additional schoolchild" / "Each
    // schoolchild" rows: label, 2 blank (10%/20% N/A), 8 rate cells
    // (30%-100%), repeated label — rate cells always start at index 3.
    if (/^each\s+(additional\s+)?school\s*child/i.test(label)) {
      const values = row.slice(3, 11).map(parseRateCell);
      if (values.length !== 8) {
        skipped += 1;
        continue;
      }
      childSchool = Object.fromEntries(
        PCT_LADDER_8.map((p, i) => [p, values[i]]),
      );
      continue;
    }
    if (/^each\s+additional\s+child$/i.test(label)) {
      const values = row.slice(3, 11).map(parseRateCell);
      if (values.length !== 8) {
        skipped += 1;
        continue;
      }
      childUnder18 = Object.fromEntries(
        PCT_LADDER_8.map((p, i) => [p, values[i]]),
      );
      continue;
    }

    // Normal dep-code row: [depCode, depStatus, r10..r100 (10), repeat×2].
    // depStatus always contains a letter ("Veteran", "V-S", …), which is
    // what distinguishes this shape from the child/schoolchild rows above.
    if (row.length >= 12 && /[A-Za-z]/.test(row[1] || "")) {
      const depStatus = row[1].trim();
      const values = row.slice(2, 12).map(parseRateCell);
      if (values.length !== 10) {
        skipped += 1;
        continue;
      }
      byStatus.set(
        depStatus,
        Object.fromEntries(PCT_LADDER_10.map((p, i) => [p, values[i]])),
      );
      continue;
    }

    skipped += 1;
  }
  return { byStatus, childUnder18, childSchool, skipped };
}

/**
 * Parse the "SPECIAL MONTHLY COMPENSATION CODES AND RATES" master table.
 * Each row packs TWO code entries side by side (ragged column counts), so
 * entries are found by scanning for a bare 1-3 digit "SMC Code" anchor cell
 * rather than a fixed offset — see file header for why. A candidate is only
 * accepted if its basic-rate cell is a real money value or the literal
 * "N/C" sentinel; anything else (e.g. a stray "h" marking a
 * removed/renumbered code, or a footnote row) is skipped, not guessed at.
 * @param {Array<Array<string>>} rows
 * @returns {{entries: Array<{code:number, award:string, basicRate:number|null, hospitalRate:number|null, notes:string}>, skipped: number}}
 */
export function parseSmcMasterRows(rows) {
  const entries = [];
  let skipped = 0;
  const codeAnchor = /^\d{1,3}$/;
  const rateCell = (c) => {
    if (c === "N/C") return null;
    return MONEY_RE.test(c) ? parseFloat(c.replace(/,/g, "")) : undefined;
  };

  for (const row of rows) {
    let i = 0;
    while (i < row.length) {
      if (!codeAnchor.test(row[i])) {
        i += 1;
        continue;
      }
      const code = Number(row[i]);
      const award = row[i + 1] || "";
      const basicRate = rateCell(row[i + 2] ?? "");
      const hospitalRate = rateCell(row[i + 3] ?? "");
      const notes = row[i + 4] || "";
      if (basicRate === undefined || hospitalRate === undefined) {
        skipped += 1;
        i += 1;
        continue;
      }
      entries.push({ code, award, basicRate, hospitalRate, notes });
      i += 5;
    }
  }
  return { entries, skipped };
}

/**
 * Locate the section-title tables (single-cell tables whose text names a
 * known section) and bucket every subsequent table's rows under that
 * section until the next title is seen.
 * @param {Array<Array<Array<string>>>} tables
 * @returns {{basicRows: Array<Array<string>>, smcMasterRows: Array<Array<string>>}}
 */
function bucketBySection(tables) {
  const SECTION_TITLES = {
    "DISABILITY COMPENSATION - BASIC RATES": "basic",
    "SPECIAL MONTHLY COMPENSATION CODES AND RATES": "smcMaster",
  };
  let current = null;
  const basicRows = [];
  const smcMasterRows = [];
  for (const rows of tables) {
    if (rows.length === 1 && rows[0].length === 1) {
      const title = rows[0][0].trim();
      if (title in SECTION_TITLES) {
        current = SECTION_TITLES[title];
        continue;
      }
      // Any other single-cell title table (SMC dependent-rate chart,
      // allowances, spina bifida, etc.) ends the section we care about.
      if (/^[A-Z][A-Z\s/½-]+$/.test(title) || title.length > 40) {
        current = null;
      }
      continue;
    }
    if (current === "basic") basicRows.push(...rows);
    if (current === "smcMaster") smcMasterRows.push(...rows);
  }
  return { basicRows, smcMasterRows };
}

/**
 * Parse one COLA-rate article's raw HTML `content` into structured rate
 * data. Pure — unit-tested against a realistic fixture, no network.
 * @param {string} html
 * @returns {Object}
 */
export function parseColaArticle(html) {
  const tables = extractTables(html);
  const fullText = tables.flat(2).join(" ");
  const effMatch =
    /Effective\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s*\(([\d.]+)%\)/.exec(fullText);
  const plMatch = /PL\s?-?\s?(\d{2,3}-\d{2,4})/.exec(fullText);

  const { basicRows, smcMasterRows } = bucketBySection(tables);
  const {
    byStatus,
    childUnder18,
    childSchool,
    skipped: basicSkipped,
  } = parseBasicRatesRows(basicRows);
  const { entries: smc, skipped: smcSkipped } =
    parseSmcMasterRows(smcMasterRows);

  return {
    effectiveDate: effMatch ? effMatch[1] : null,
    colaPercent: effMatch ? Number(effMatch[2]) : null,
    publicLaw: plMatch ? plMatch[1] : null,
    veteran: byStatus.get("Veteran") || null,
    spouse: byStatus.get("V-S") || null,
    parentOne: byStatus.get("V-1P") || null,
    parentTwo: byStatus.get("V-2P") || null,
    childUnder18,
    childSchool,
    smc,
    skipped: { basicRows: basicSkipped, smcRows: smcSkipped },
  };
}

/**
 * Quality gate: does a parsed article have enough to be trustworthy? A
 * partial/garbled article (e.g. 2016's malformed SMC table) should be
 * skipped loudly, not silently promoted with missing data.
 * @param {Object} parsed
 * @returns {string|null} a reason string if invalid, else null
 */
export function validateParsed(parsed) {
  if (!parsed.effectiveDate) return "no effective date found";
  if (
    !parsed.veteran ||
    !parsed.spouse ||
    !parsed.parentOne ||
    !parsed.parentTwo
  )
    return "missing one or more required dependency-status rows";
  if (!parsed.childUnder18 || !parsed.childSchool)
    return "missing 'each additional child/schoolchild' rows";
  if (parsed.smc.length < 30)
    return `SMC table too thin (${parsed.smc.length} entries, expected 30+)`;
  return null;
}

async function main() {
  mkdirSync(WORK_DIR, { recursive: true });

  const includeHistorical = process.env.RATE_TABLES_INCLUDE_HISTORICAL === "1";
  console.log(
    `[rate-tables] fetching current${includeHistorical ? " + historical (informational only, see scope decision)" : ""} COLA articles…`,
  );
  const currentArticles = await fetchArticles(CURRENT_TOPIC);
  const historicalArticles = includeHistorical
    ? await fetchArticles(HISTORICAL_TOPIC)
    : [];
  const articles = [...currentArticles, ...historicalArticles];
  console.log(`[rate-tables] ${articles.length} articles found`);

  const results = [];
  for (const art of articles) {
    const html = String(art.content || "");
    if (html.trim().length < 500) {
      console.warn(
        `[rate-tables] "${art.name}" (${art.id}): stub content (${html.length} chars) — likely a PDF-attachment-only article, skipping`,
      );
      continue;
    }
    let parsed;
    try {
      parsed = parseColaArticle(html);
    } catch (e) {
      console.warn(
        `[rate-tables] "${art.name}" (${art.id}): parse failed — ${e.message}`,
      );
      continue;
    }
    const invalidReason = validateParsed(parsed);
    if (invalidReason) {
      console.warn(
        `[rate-tables] "${art.name}" (${art.id}): ${invalidReason} — skipping (likely a known-malformed year)`,
      );
      continue;
    }
    results.push({ articleName: art.name, articleId: art.id, ...parsed });
    console.log(
      `[rate-tables] "${art.name}": effective ${parsed.effectiveDate} (${parsed.colaPercent}% COLA), ${parsed.smc.length} SMC codes`,
    );
  }

  if (results.length === 0) {
    throw new Error("rate-tables fetch produced ZERO valid parsed articles");
  }

  const outPath = path.join(WORK_DIR, "rate-tables.json");
  writeFileSync(outPath, JSON.stringify(results, null, 2) + "\n");
  const rel = path.relative(path.resolve(__dirname, "..", ".."), outPath);
  console.log(`[rate-tables] wrote ${results.length} valid years → ${rel}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`[rate-tables] FAILED: ${e.message}`);
    process.exit(1);
  });
}
