#!/usr/bin/env node
/**
 * fetch-fedcir-historical.mjs — fetch the FULL historical archive of U.S.
 * Court of Appeals for the Federal Circuit veterans-law opinions, extending
 * fetch-fedcir.mjs (which runs bounded — FEDCIR_MAX_PAGES defaults to 3 pages
 * — for the weekly freshness check).
 *
 * Mechanism is IDENTICAL to fetch-fedcir.mjs and was RE-VERIFIED live
 * (2026-07-18), not assumed from memory:
 *
 *   GET https://www.cafc.uscourts.gov/wp-json/wp/v2/posts
 *       ?categories=27&per_page=100&_fields=id,date,link,title,content
 *       &page=N
 *
 * categories=27 is the "Opinion-Order" category. Confirmed live counts as of
 * 2026-07-18 (X-WP-Total / X-WP-TotalPages response headers):
 *   18,766 total Opinion-Order posts, 188 pages at per_page=100.
 * (knowledge-sources.yaml's "~18.7K" estimate holds.) Host MUST be
 * www.cafc.uscourts.gov — the apex fails SNI, same as fetch-fedcir.mjs.
 *
 * Veterans-origin ratio — RE-VERIFIED against a larger, spread sample than
 * the prior single-page (100-post) 12% estimate: 11 pages sampled evenly
 * across the full 1–188 page range (1,066 posts total) found 112 posts with
 * Origin: CAVC or DVA = 10.5%. This is the same order of magnitude as the
 * earlier 1-page estimate, not a material correction, but is a stronger
 * basis (spread sample vs. one page) for the ~1,970-record full-archive
 * estimate below. Non-veterans origins in the sample (DCT, CFC, PTO, MSPB,
 * CIT, RIT, ITC, BCA, DOJ, ABCM, OCBD, USTC, CAFC) are other dockets
 * (district court, ITC, Court of Federal Claims, patent office, etc.) and
 * are dropped by fetch-fedcir.mjs's isVeteransOrigin(), reused here.
 *
 * Estimated full-archive yield: 18,766 * 10.5% ≈ 1,970 veterans-law opinion
 * records. This is an ESTIMATE from sampling, not a guarantee — the actual
 * full run reports the ground-truth count in its own log/summary.
 *
 * Scale note (contrast with fetch-cavc-historical.mjs's ~54,600-document,
 * genuinely multi-hour CAVC backfill): 188 pages of this REST API at the
 * default 350ms throttle is roughly a 1–2 minute fetch-only job. So unlike
 * the CAVC historical fetcher, this script's default MAX_PAGES is 0
 * (unlimited/full) rather than requiring a special long-running mode — a
 * full run is the normal case, not a deliberate follow-up.
 *
 * Parsing/record logic is REUSED, not duplicated, from fetch-fedcir.mjs's
 * exported pure functions (parseFedcirPosts, isVeteransOrigin,
 * citationFromFedcirTitle, extractPdfText) — importing that module is safe
 * here: it only runs its main() crawl when invoked directly (import.meta.url
 * === argv[1] guard), so importing it as a library performs no network I/O.
 * This also means the two fetchers can never parse a post's title/origin/PDF
 * link differently.
 *
 * Full-text vs synopsis-only: SAME default as fetch-fedcir.mjs — synopsis
 * only (title + appeal number + origin + precedential + PDF link), because
 * the WP-REST content.rendered field never carries opinion body text, only a
 * synopsis + PDF href. --with-pdf-text opts into the heavy path (one PDF
 * download + pdfjs-dist extraction per case, ~1,970 PDFs for a full run) —
 * reuses fetch-fedcir.mjs's own extractPdfText() rather than reimplementing
 * the pdfjs-dist worker setup.
 *
 * Output: scripts/legal-ingestion/.work/fedcir-historical.jsonl —
 * deliberately separate from fetch-fedcir.mjs's .work/fedcir.jsonl (bounded
 * weekly-freshness output) so neither fetcher clobbers the other's file.
 * Wiring this file into build-fedcir-shard.mjs is a follow-up, not done
 * here.
 *
 * Env knobs:
 *   FEDCIR_HIST_API_URL     override the REST endpoint base (site restructure)
 *   FEDCIR_HIST_MAX_PAGES   pages to walk at 100/page (default 0 = unlimited/
 *                            full crawl; set e.g. 2 for a bounded test run)
 *   FEDCIR_HIST_THROTTLE_MS delay between page requests (default 350) — be a
 *                            good citizen against the court's own WordPress
 *                            site, same throttle as fetch-fedcir.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { makeRecord } from "./sanitize-html.mjs";
import {
  parseFedcirPosts,
  isVeteransOrigin,
  citationFromFedcirTitle,
  extractPdfText,
} from "./fetch-fedcir.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORK_DIR = path.join(__dirname, ".work");

const CAFC_ORIGIN = "https://www.cafc.uscourts.gov";
const FEDCIR_HIST_API_URL =
  process.env.FEDCIR_HIST_API_URL ||
  `${CAFC_ORIGIN}/wp-json/wp/v2/posts?categories=27&per_page=100&_fields=id,date,link,title,content`;
const MAX_PAGES = Number(process.env.FEDCIR_HIST_MAX_PAGES) || 0; // 0 = unlimited/full
const THROTTLE_MS = Number(process.env.FEDCIR_HIST_THROTTLE_MS) || 350;

const USER_AGENT =
  "vet-rate-org legal-ingestion/1.0 (anthony.johnson.now@gmail.com)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch one page of the WP-REST archive. Returns `{ json, totalPages }` on
 * success, or `null` once pagination is exhausted (WP-REST returns HTTP 400
 * for any page past the last — the normal end-of-pagination signal for any
 * page after the first, same convention as fetch-fedcir.mjs's fetchPage()).
 * @param {number} page
 */
async function fetchPage(page) {
  const url = `${FEDCIR_HIST_API_URL}&page=${page}`;
  console.log(`[fedcir-historical] GET ${url}`);
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    if (page > 1) return null;
    throw new Error(`fedcir-historical ${url} → HTTP ${res.status}`);
  }
  const totalPosts = Number(res.headers.get("x-wp-total")) || 0;
  const totalPages = Number(res.headers.get("x-wp-totalpages")) || 0;
  const json = await res.json();
  return { json, totalPosts, totalPages };
}

async function withPdfText(bodyText, pdfUrl) {
  console.log(`[fedcir-historical] fetching PDF text: ${pdfUrl}`);
  const res = await fetch(pdfUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    console.warn(
      `[fedcir-historical] PDF fetch failed (${res.status}) for ${pdfUrl}, keeping synopsis only`,
    );
    return bodyText;
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  const pdfText = await extractPdfText(buf);
  return `${bodyText}\n\n${pdfText}`;
}

async function buildRecord(c, withPdf) {
  const year = String(c.date || "").slice(0, 4) || "n.d.";
  let body =
    `${c.title}\n` +
    `Appeal Number: ${c.appealNumber}\n` +
    `Origin: ${c.origin}\n` +
    `Precedential: ${c.precedential}\n` +
    `Full opinion PDF: ${c.pdfUrl || "unavailable"}`;
  if (withPdf && c.pdfUrl) {
    body = await withPdfText(body, c.pdfUrl);
    await sleep(THROTTLE_MS);
  }
  return makeRecord({
    source: "fedcir",
    jurisdiction: "court",
    citation: citationFromFedcirTitle(c.title, year),
    title: c.parties,
    body,
    source_url: c.link,
  });
}

async function main() {
  mkdirSync(WORK_DIR, { recursive: true });
  const withPdf = process.argv.includes("--with-pdf-text");

  const records = [];
  let page = 1;
  let totalPosts = 0;
  let totalPages = 0;
  let postsScanned = 0;
  let veteransScanned = 0;

  for (;;) {
    const result = await fetchPage(page);
    if (!result || !Array.isArray(result.json) || result.json.length === 0)
      break;
    const { json, totalPosts: t, totalPages: tp } = result;
    if (page === 1) {
      totalPosts = t;
      totalPages = tp;
      console.log(
        `[fedcir-historical] live archive: ${totalPosts} Opinion-Order posts across ${totalPages} pages`,
      );
      if (Math.abs(totalPosts - 18766) > 2000) {
        console.warn(
          `[fedcir-historical] WARNING: live total (${totalPosts}) differs substantially from the ` +
            `documented 2026-07-18 baseline (18766) — knowledge-sources.yaml's estimate may be stale`,
        );
      }
    }

    const parsed = parseFedcirPosts(json);
    const veteransCases = parsed.filter((p) => isVeteransOrigin(p.origin));
    postsScanned += json.length;
    veteransScanned += veteransCases.length;
    const totalPagesSuffix = totalPages ? `/${totalPages}` : "";
    console.log(
      `[fedcir-historical] page ${page}${totalPagesSuffix}: ` +
        `${json.length} posts, ${veteransCases.length} veterans-origin`,
    );

    for (const c of veteransCases) {
      records.push(await buildRecord(c, withPdf));
    }

    const pageCap = MAX_PAGES || Infinity;
    const pastLastKnownPage = totalPages > 0 && page >= totalPages;
    if (page >= pageCap || pastLastKnownPage) break;
    page += 1;
    await sleep(THROTTLE_MS);
  }

  if (records.length === 0) {
    throw new Error(
      "Federal Circuit historical fetch produced ZERO veterans-origin records — " +
        "endpoint, category id, or Origin-field format may have changed",
    );
  }

  console.log(
    `[fedcir-historical] ${postsScanned} posts scanned across ${page} page(s); ` +
      `${veteransScanned} veterans-origin (${((veteransScanned / postsScanned) * 100).toFixed(1)}%)`,
  );

  const out = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  const outPath = path.join(WORK_DIR, "fedcir-historical.jsonl");
  writeFileSync(outPath, out);
  const rel = path.relative(path.resolve(__dirname, "..", ".."), outPath);
  const cap = MAX_PAGES ? ` (capped at ${MAX_PAGES} pages)` : "";
  console.log(
    `[fedcir-historical] wrote ${records.length} veterans-case records → ${rel}${cap}`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`[fedcir-historical] FAILED: ${e.message}`);
    process.exit(1);
  });
}
