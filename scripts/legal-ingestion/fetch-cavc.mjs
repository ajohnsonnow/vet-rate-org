#!/usr/bin/env node
/**
 * fetch-cavc.mjs — fetch precedential opinions from the Court of Appeals
 * for Veterans Claims (uscourts.cavc.gov).
 *
 * Strategy: scrape the precedential-decisions index, walk each opinion
 * page, extract the docket + opinion text.
 *
 * Default window: rolling 5 years (configurable via --years).
 *
 * THIS IS A SCAFFOLD. CAVC's site structure is HTML-only; verify the
 * regex anchors against the live site before promoting to CI.
 *
 * Output: scripts/legal-ingestion/.work/cavc.jsonl
 */

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { makeRecord } from "./sanitize-html.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORK_DIR = path.join(__dirname, ".work");

const CAVC_BASE = "https://www.uscourts.cavc.gov";
const PRECEDENTIAL_INDEX =
  process.env.CAVC_INDEX_URL ||
  `${CAVC_BASE}/opinions/precedential-opinions.php`;

const USER_AGENT =
  "vet-rate-org legal-ingestion/0.1 (anthony.johnson.now@gmail.com)";

async function fetchHtml(url) {
  console.log(`[cavc] GET ${url}`);
  const res = await fetch(url, {
    headers: { Accept: "text/html", "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`cavc ${url} → HTTP ${res.status}`);
  return res.text();
}

/**
 * Extract opinion links + dates from the index HTML.
 * Conservative regex — assumes anchor + adjacent date pattern.
 *
 * @param {string} html
 * @returns {Array<{url: string, title: string, year: number}>}
 */
export function parseCavcIndex(html) {
  const out = [];
  const re =
    /<a[^>]+href="([^"]+\/opinion[^"]+)"[^>]*>([^<]+)<\/a>[^<]*?(\d{4})/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = m[1].startsWith("http") ? m[1] : `${CAVC_BASE}${m[1]}`;
    out.push({
      url,
      title: m[2].trim(),
      year: Number.parseInt(m[3], 10),
    });
  }
  return out;
}

function citationFromTitle(title) {
  // CAVC opinions cite like "Pelegrini v. Principi, 18 Vet.App. 112 (2004)"
  const m = /^([A-Z][\w.'-]+)\s+v\.\s+([\w.'-]+)/.exec(title);
  return m ? `${m[1]} v. ${m[2]}` : title.slice(0, 80);
}

async function main() {
  const args = process.argv.slice(2);
  const yearsArg = args.find((a) => a.startsWith("--years="));
  const lookback = yearsArg ? Number.parseInt(yearsArg.split("=")[1], 10) : 5;
  const cutoffYear = new Date().getFullYear() - lookback;

  mkdirSync(WORK_DIR, { recursive: true });

  const indexHtml = await fetchHtml(PRECEDENTIAL_INDEX);
  const all = parseCavcIndex(indexHtml);
  const recent = all.filter((o) => o.year >= cutoffYear);

  if (all.length === 0) {
    throw new Error(
      "CAVC index parser returned ZERO opinions — site structure may have changed",
    );
  }

  console.log(
    `[cavc] ${all.length} opinions found; ${recent.length} within ${lookback}-year window (>= ${cutoffYear})`,
  );

  const records = [];
  for (const op of recent) {
    const html = await fetchHtml(op.url);
    records.push(
      await makeRecord({
        source: "cavc",
        citation: citationFromTitle(op.title),
        title: op.title,
        body: html,
        source_url: op.url,
      }),
    );
    await new Promise((r) => setTimeout(r, 1500));
  }

  const out = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  const outPath = path.join(WORK_DIR, "cavc.jsonl");
  writeFileSync(outPath, out);
  console.log(`[cavc] wrote ${records.length} opinions → ${outPath}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`[cavc] FAILED: ${e.message}`);
    process.exit(1);
  });
}
