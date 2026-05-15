#!/usr/bin/env node
/**
 * fetch-fedcir.mjs — fetch Federal Circuit veteran-law opinions.
 *
 * Source: cafc.uscourts.gov opinions search; we filter to opinions naming
 * "Department of Veterans Affairs" or "Veterans Affairs" as a party.
 *
 * Strategy: post the search form, walk the result HTML, fetch each
 * opinion PDF/HTML, sanitize.
 *
 * Default window: rolling 5 years (configurable via --years).
 *
 * THIS IS A SCAFFOLD. The CAFC search interface is JS-heavy; if the
 * non-JS endpoint doesn't return parseable HTML, fall back to the
 * federalregister.gov mirror at
 *   https://www.federalregister.gov/public-inspection/
 *
 * Output: scripts/legal-ingestion/.work/fedcir.jsonl
 */

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { makeRecord } from "./sanitize-html.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORK_DIR = path.join(__dirname, ".work");

const CAFC_BASE = "https://cafc.uscourts.gov";
const SEARCH_URL =
  process.env.FEDCIR_SEARCH_URL ||
  `${CAFC_BASE}/opinions-orders/search?keyword=veterans+affairs`;

const USER_AGENT =
  "vet-rate-org legal-ingestion/0.1 (anthony.johnson.now@gmail.com)";

async function fetchHtml(url) {
  console.log(`[fedcir] GET ${url}`);
  const res = await fetch(url, {
    headers: { Accept: "text/html", "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`fedcir ${url} → HTTP ${res.status}`);
  return res.text();
}

/**
 * Pull opinion links from the CAFC search-results HTML. Conservative
 * regex — looks for typical CAFC opinion URL patterns.
 *
 * @param {string} html
 * @returns {Array<{url: string, title: string, year: number}>}
 */
export function parseFedcirResults(html) {
  const out = [];
  const re =
    /<a[^>]+href="([^"]+\/opinions-orders\/[^"]+)"[^>]*>([^<]+)<\/a>[\s\S]{0,400}?(\d{4})/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = m[1].startsWith("http") ? m[1] : `${CAFC_BASE}${m[1]}`;
    out.push({
      url,
      title: m[2].trim(),
      year: Number.parseInt(m[3], 10),
    });
  }
  return out;
}

function citationFromTitle(title) {
  const m = /^([A-Z][\w.'-]+)\s+v\.\s+([\w.'-]+(?:\s+[\w.'-]+)*)/.exec(title);
  return m ? `${m[1]} v. ${m[2]}` : title.slice(0, 80);
}

async function main() {
  const args = process.argv.slice(2);
  const yearsArg = args.find((a) => a.startsWith("--years="));
  const lookback = yearsArg ? Number.parseInt(yearsArg.split("=")[1], 10) : 5;
  const cutoffYear = new Date().getFullYear() - lookback;

  mkdirSync(WORK_DIR, { recursive: true });

  const searchHtml = await fetchHtml(SEARCH_URL);
  const all = parseFedcirResults(searchHtml);
  const recent = all.filter((o) => o.year >= cutoffYear);

  if (all.length === 0) {
    throw new Error(
      "Federal Circuit search returned ZERO opinions — selector may need updating, or the search endpoint is JS-only (try federalregister.gov mirror)",
    );
  }

  console.log(
    `[fedcir] ${all.length} opinions; ${recent.length} within ${lookback}-year window (>= ${cutoffYear})`,
  );

  const records = [];
  for (const op of recent) {
    const html = await fetchHtml(op.url);
    records.push(
      await makeRecord({
        source: "fedcir",
        citation: citationFromTitle(op.title),
        title: op.title,
        body: html,
        source_url: op.url,
      }),
    );
    await new Promise((r) => setTimeout(r, 1500));
  }

  const out = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  const outPath = path.join(WORK_DIR, "fedcir.jsonl");
  writeFileSync(outPath, out);
  console.log(`[fedcir] wrote ${records.length} opinions → ${outPath}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`[fedcir] FAILED: ${e.message}`);
    process.exit(1);
  });
}
