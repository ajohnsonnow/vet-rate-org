#!/usr/bin/env node
/**
 * fetch-m21-1.mjs — fetch the VA M21-1 Adjudication Procedures Manual.
 *
 * Source: VA Knowledge Management portal (no public API).
 * Strategy: scrape the chapter index, then fetch each chapter HTML and
 * sanitize.
 *
 * THIS IS A SCAFFOLD. The exact entry URL + HTML structure varies; verify
 * the selectors below against the live portal before promoting to CI.
 * Expected URL surface (subject to change):
 *   https://www.knowva.ebenefits.va.gov/system/templates/selfservice/va_ssnew/help/customer/locale/en-US/portal/554400000001018/topic/554400000004003
 *
 * Output: scripts/legal-ingestion/.work/m21-1.jsonl
 */

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { makeRecord } from "./sanitize-html.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORK_DIR = path.join(__dirname, ".work");

// PLACEHOLDER — replace with the actual VA portal URLs once verified.
// Current canonical M21-1 Table of Contents on KnowVA (the old
// selfservice.controller?ARTICLE_ID=KA-09800 form 404s). NOTE: KnowVA renders
// the article list client-side, so a raw fetch may not contain the chapter
// links — this source likely needs a headless fetch or KnowVA's JSON endpoint;
// override with M21_INDEX_URL. Portal 554400000001018 / ToC content 554400000073398.
const M21_INDEX_URL =
  process.env.M21_INDEX_URL ||
  "https://www.knowva.ebenefits.va.gov/system/templates/selfservice/va_ssnew/help/customer/locale/en-US/portal/554400000001018/content/554400000073398/M21-1-Adjudication-Procedures-Manual-Table-of-Contents";

const USER_AGENT =
  "vet-rate-org legal-ingestion/0.1 (anthony.johnson.now@gmail.com)";

async function fetchHtml(url) {
  console.log(`[m21-1] GET ${url}`);
  const res = await fetch(url, {
    headers: {
      Accept: "text/html",
      "User-Agent": USER_AGENT,
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`m21-1 ${url} → HTTP ${res.status}`);
  }
  return res.text();
}

/**
 * Extract per-chapter links from the index page. The actual selector
 * depends on the live HTML; this regex looks for typical KnowVA article
 * link patterns.
 *
 * @param {string} html
 * @returns {Array<{url: string, title: string}>}
 */
export function parseChapterIndex(html) {
  const links = [];
  const linkRe = /<a[^>]+href="([^"]+ARTICLE_ID=[^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let m;
  while ((m = linkRe.exec(html))) {
    links.push({
      url: m[1].startsWith("http") ? m[1] : `https://www.knowva.ebenefits.va.gov${m[1]}`,
      title: m[2].trim(),
    });
  }
  return links;
}

/**
 * Heuristic citation parser. M21-1 references look like "M21-1 III.ii.2.A".
 * @param {string} title
 * @returns {string}
 */
function citationFromTitle(title) {
  const m = /M21-1\s*([IVX]+(?:\.[a-z0-9]+)*)/i.exec(title);
  return m ? `M21-1 ${m[1]}` : `M21-1 (${title.slice(0, 64)})`;
}

async function main() {
  mkdirSync(WORK_DIR, { recursive: true });

  const indexHtml = await fetchHtml(M21_INDEX_URL);
  const chapters = parseChapterIndex(indexHtml);

  if (chapters.length === 0) {
    throw new Error(
      "M21-1 index returned ZERO chapter links — selector may need updating",
    );
  }

  console.log(`[m21-1] discovered ${chapters.length} chapter links`);

  const records = [];
  // Conservative throttle to be a good citizen on the VA portal.
  for (const chap of chapters) {
    const html = await fetchHtml(chap.url);
    records.push(
      await makeRecord({
        source: "m21-1",
        citation: citationFromTitle(chap.title),
        title: chap.title,
        body: html,
        source_url: chap.url,
      }),
    );
    await new Promise((r) => setTimeout(r, 1500));
  }

  const out = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  const outPath = path.join(WORK_DIR, "m21-1.jsonl");
  writeFileSync(outPath, out);
  console.log(`[m21-1] wrote ${records.length} chapters → ${outPath}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`[m21-1] FAILED: ${e.message}`);
    process.exit(1);
  });
}
