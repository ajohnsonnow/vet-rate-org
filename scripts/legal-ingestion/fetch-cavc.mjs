#!/usr/bin/env node
/**
 * fetch-cavc.mjs — fetch recent decisions from the Court of Appeals for
 * Veterans Claims (uscourts.cavc.gov) (S33).
 *
 * Source: the court's own Atom feed, a plain fetch()able XML document — no
 * headless browser, no JS-only search form to reverse-engineer:
 *
 *   GET https://www.uscourts.cavc.gov/data/recentdecisions.rss
 *   <entry>
 *     <link href=".../CaseSummary.jsp?servlet=CaseSummary.jsp&caseNum=25-1124&..."/>
 *     <summary>Memorandum Decision that the January 13, 2025, Board decision
 *       is AFFIRMED. (FALVEY)</summary>
 *     <title>25-1124 Rocco David Ross v. Douglas A. Collins</title>
 *     <dc:date>2026-07-15T04:10:02-04:00</dc:date>
 *   </entry>
 *
 * The feed is a small rolling window (the last few days of decisions), not a
 * historical archive — the <link> resolves to the efiling CaseSummary.jsp
 * docket page, which is itself JS-driven. Full historical backfill (beyond
 * this rolling window) is a separate, time/compute-gated job that would query
 * search.uscourts.cavc.gov (POST /search/, IW_DATABASE="USCAVC Opinions") and
 * pull opinion bodies from the efiling CaseSummary.jsp docket entries — not
 * built this sprint; documented here so it isn't rediscovered from scratch.
 *
 * Because the feed carries only a disposition summary (no full opinion text),
 * `body` on each record is that summary/disposition text, not the memorandum
 * decision itself. CAVC memorandum decisions in this feed are non-precedential
 * (they don't appear in the "precedential opinions" index), so citation is by
 * docket number rather than a Vet.App. reporter cite.
 *
 * Output: scripts/legal-ingestion/.work/cavc.jsonl
 *
 * Env knobs:
 *   CAVC_RSS_URL       override the feed URL (site restructure / mirror)
 *   CAVC_THROTTLE_MS   delay after the feed fetch (default 0 — this is a
 *                      single request, there's nothing to throttle between)
 */

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { makeRecord } from "./sanitize-html.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORK_DIR = path.join(__dirname, ".work");

const CAVC_RSS_URL =
  process.env.CAVC_RSS_URL ||
  "https://www.uscourts.cavc.gov/data/recentdecisions.rss";
const THROTTLE_MS = Number(process.env.CAVC_THROTTLE_MS) || 0;

const USER_AGENT =
  "vet-rate-org legal-ingestion/1.0 (anthony.johnson.now@gmail.com)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ENTRY_RE = /<entry>([\s\S]*?)<\/entry>/gi;
const LINK_RE = /<link\s+href="([^"]+)"\s*\/>/i;
const SUMMARY_RE = /<summary>([\s\S]*?)<\/summary>/i;
const TITLE_RE = /<title>([\s\S]*?)<\/title>/i;
const DATE_RE = /<dc:date>([\s\S]*?)<\/dc:date>/i;
const CASE_NUM_RE = /[?&]caseNum=([\w-]+)/i;

/** Atom feeds only need `&amp;` decoded inside attribute/text values we read. */
function decodeAmp(s) {
  return String(s || "").replaceAll("&amp;", "&");
}

/**
 * Split a feed <title> of the form "<docket> <Party> v. <Party>" on its
 * first space. A plain indexOf split (not a regex) avoids any ambiguous
 * backtracking over the free-text parties half.
 * @param {string} title
 * @returns {[string, string]|null}
 */
function splitDocketTitle(title) {
  const idx = title.indexOf(" ");
  if (idx === -1) return null;
  return [title.slice(0, idx), title.slice(idx + 1).trim()];
}

/**
 * Parse the CAVC recent-decisions Atom feed into one record per <entry>.
 * Pure — regex-based (no XML dependency in this repo), same approach as the
 * other legal-ingestion fetchers' HTML parsing.
 * @param {string} xml
 * @returns {Array<{caseNum:string, title:string, parties:string, disposition:string, summary:string, source_url:string, date:string}>}
 */
export function parseCavcRss(xml) {
  const out = [];
  let m;
  ENTRY_RE.lastIndex = 0;
  while ((m = ENTRY_RE.exec(String(xml || "")))) {
    const block = m[1];
    const linkMatch = LINK_RE.exec(block);
    const summaryMatch = SUMMARY_RE.exec(block);
    const titleMatch = TITLE_RE.exec(block);
    const dateMatch = DATE_RE.exec(block);
    if (!linkMatch || !titleMatch) continue;

    const source_url = decodeAmp(linkMatch[1]).trim();
    const caseNumMatch = CASE_NUM_RE.exec(source_url);
    const title = decodeAmp(titleMatch[1]).trim();
    const summary = decodeAmp(summaryMatch ? summaryMatch[1] : "").trim();
    const docketSplit = splitDocketTitle(title);
    const parties = docketSplit ? docketSplit[1] : title;
    let caseNum = "";
    if (caseNumMatch) caseNum = caseNumMatch[1];
    else if (docketSplit) caseNum = docketSplit[0];

    out.push({
      caseNum,
      title,
      parties,
      disposition: dispositionFromSummary(summary),
      summary,
      source_url,
      date: dateMatch ? dateMatch[1].trim() : "",
    });
  }
  return out;
}

const OUTCOME_PATTERNS = {
  GRANTED: /\bgrant(?:s|ed|ing)?\b/i,
  AFFIRMED: /\baffirm(?:s|ed|ing)?\b/i,
  REVERSED: /\brevers(?:e|es|ed|ing)\b/i,
  REMANDED: /\bremand(?:s|ed|ing)?\b/i,
  VACATED: /\b(?:vacat(?:e|es|ed|ing)|sets?\s+aside|set\s+aside)\b/i,
  DISMISSED: /\bdismiss(?:es|ed|ing)?\b/i,
};

/**
 * Classify a CAVC memorandum-decision summary into one outcome bucket. A
 * summary that names more than one distinct outcome verb (e.g. "AFFIRMED in
 * part and REMANDED in part") is genuinely mixed-disposition — reported as
 * MIXED rather than guessing which outcome is primary.
 * @param {string} summary
 * @returns {"GRANTED"|"AFFIRMED"|"REVERSED"|"REMANDED"|"VACATED"|"DISMISSED"|"MIXED"|"UNKNOWN"}
 */
export function dispositionFromSummary(summary) {
  const text = String(summary || "");
  const hits = Object.entries(OUTCOME_PATTERNS)
    .filter(([, re]) => re.test(text))
    .map(([label]) => label);
  if (hits.length === 0) return "UNKNOWN";
  if (hits.length > 1) return "MIXED";
  return hits[0];
}

/**
 * Neutral docket citation for a non-precedential CAVC memorandum decision —
 * cite by docket number and decision year, not a Vet.App. reporter cite (the
 * feed only carries memorandum decisions, which aren't reported).
 * @param {{caseNum:string, date:string}} entry
 * @returns {string}
 */
export function citationFromCavcEntry(entry) {
  const year = String(entry?.date || "").slice(0, 4) || "n.d.";
  const caseNum = entry?.caseNum || "unknown";
  return `No. ${caseNum} (Vet. App. ${year})`;
}

async function main() {
  mkdirSync(WORK_DIR, { recursive: true });

  console.log(`[cavc] GET ${CAVC_RSS_URL}`);
  const res = await fetch(CAVC_RSS_URL, {
    headers: { Accept: "application/atom+xml, application/xml, text/xml", "User-Agent": USER_AGENT },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`cavc ${CAVC_RSS_URL} → HTTP ${res.status}`);
  const xml = await res.text();
  await sleep(THROTTLE_MS);

  const entries = parseCavcRss(xml);
  if (entries.length === 0) {
    throw new Error(
      "CAVC RSS parser found ZERO entries — feed structure may have changed (verify against the live feed)",
    );
  }
  console.log(`[cavc] ${entries.length} recent decisions parsed`);

  const records = await Promise.all(
    entries.map(async (entry) =>
      makeRecord({
        source: "cavc",
        jurisdiction: "court",
        citation: citationFromCavcEntry(entry),
        title: entry.parties,
        body: entry.summary,
        source_url: entry.source_url,
      }),
    ),
  );

  const out = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  const outPath = path.join(WORK_DIR, "cavc.jsonl");
  writeFileSync(outPath, out);
  const rel = path.relative(path.resolve(__dirname, "..", ".."), outPath);
  console.log(`[cavc] wrote ${records.length} decision records → ${rel}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`[cavc] FAILED: ${e.message}`);
    process.exit(1);
  });
}
