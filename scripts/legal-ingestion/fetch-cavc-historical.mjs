#!/usr/bin/env node
/**
 * fetch-cavc-historical.mjs — fetch the FULL historical archive of Court of
 * Appeals for Veterans Claims decisions (1990–present), extending fetch-cavc.mjs
 * (which only covers the last few days via the Atom feed).
 *
 * fetch-cavc.mjs's header comment hypothesized this would be a POST search
 * endpoint at search.uscourts.cavc.gov (IW_DATABASE="USCAVC Opinions"). That
 * hypothesis was VERIFIED live against the site (2026-07-18) — with two
 * corrections: it's plain HTTP, not HTTPS (search.uscourts.cavc.gov refuses
 * connections on :443 entirely — curl: "Connection refused"; the www apex's
 * /robots.txt has no rule touching /search/ or the search subdomain), and the
 * decision-type value used is one of the site's own two categories, not the
 * generic "USCAVC Opinions" label.
 *
 * Mechanism — a legacy "Perceptive Enterprise Search Server 10" (ISYS) full-
 * text index, driven by plain fetch(), no headless browser:
 *
 *   1. POST http://search.uscourts.cavc.gov/search/
 *        IW_FIELD_WEB_STYLE=*          ("*" = match every document)
 *        IW_DATABASE=PanelDecisions        (precedential panel opinions, ~3,905 total)
 *        IW_DATABASE=SingleJudgeDecisions  (non-precedential memorandum decisions,
 *                                           ~50,700+ total — the UI's own hit count
 *                                           exceeds the 50,000-row browsable cap)
 *      → an HTML results page whose links all carry a per-query GUID:
 *        /isysquery/{guid}/...
 *      These two IW_DATABASE values (from the site's own "Decision Type"
 *      dropdown) are the authoritative precedential/non-precedential signal —
 *      more reliable than parsing the "may/may not be cited as precedent"
 *      sentence every opinion also carries inline in its own text.
 *
 *   2. GET http://search.uscourts.cavc.gov/isysquery/{guid}/-datetime/sort/
 *      once, to switch that query session to date-descending order (newest
 *      first) for every subsequent page.
 *
 *   3. GET http://search.uscourts.cavc.gov/isysquery/{guid}/{start}-{end}/list/
 *      (tested working up to a 1000-row range in one request) to enumerate
 *      hits: each hit is a docket number, a "list date", and a download link
 *      /isysquery/{guid}/{n}/doc/{docid} where docid is the archive's ORIGINAL
 *      filename (case-varying, decades of naming conventions).
 *
 *   4. GET each hit's download link for the raw file bytes. IMPORTANT: this is
 *      the anchor with the filename appended, NOT the separate bracketed
 *      "[View]" link (`/isysquery/{guid}/{n}/doc/` with no filename) — that
 *      HTML-render feature 500s ("The page cannot be displayed") for every
 *      format tested (WordPerfect and PDF alike); it appears broken on the
 *      current server. Format varies by era, interleaved rather than cleanly
 *      chronological (WordPerfect and PDF overlap ~2003–2009):
 *        - no extension (e.g. CRICK.570, SANDINE.362) → plain ASCII text,
 *          used directly (~1990s–early 2000s, and scattered later).
 *        - .pdf (dominant ~2008–present, back to ~2003) → fetch raw bytes,
 *          extract text with pdfjs-dist (already a repo dependency — same
 *          extractPdfText() approach as fetch-fedcir.mjs / fetch-ogc.mjs).
 *        - .wpd (WordPerfect binary, scattered ~1999–2009) → NOT extractable
 *          with anything in this repo's dependency set. SKIPPED, not
 *          fabricated — counted and logged. Adding coverage would mean adding
 *          a WordPerfect-binary parser dependency, out of scope here.
 *
 * Session-URL caveat (verified, not assumed): the {guid} in an /isysquery/
 * URL is a query-cache token, NOT a permanent per-document permalink. An
 * arbitrary/unknown guid 404s, but a real docid resolves under ANY currently
 * live guid regardless of the numeric index used in the path (confirmed: hit
 * #1's docid fetched fine through index "999" on the same guid). So the
 * source_url this script records is only guaranteed valid for the lifetime of
 * THIS run's search session (confirmed alive ≥ 20 minutes in testing; long-
 * run/production durability beyond that is unconfirmed) — unlike
 * fetch-cavc.mjs's stable CaseSummary.jsp?caseNum= links. A production
 * deploy would need the shard-wiring follow-up to either re-derive a fresh
 * link at read time or accept this as a known limitation.
 *
 * "List date" caveat: the per-hit date shown in search results matches the
 * details page's "Date" field, which is NOT confirmed to equal the decision's
 * actual issuance date (the same details page separately exposes a "Date In
 * Document" field that can differ) — used here as the best available per-hit
 * date, not asserted to be exact.
 *
 * Scale: ~3,905 (panel) + ~50,700+ (single-judge) ≈ 54,600+ documents. A full
 * backfill — every listing page plus one doc fetch per hit, throttled — is
 * genuinely multi-hour, confirming fetch-cavc.mjs's original "time/compute-
 * gated" framing. This script is BUILT and TESTED in bounded mode (see env
 * knobs below); running it unbounded for a full historical backfill is a
 * deliberate follow-up, not done as part of building this fetcher.
 *
 * Output: one file PER DATABASE — scripts/legal-ingestion/.work/cavc-historical-panel.jsonl
 * and .work/cavc-historical-singlejudge.jsonl — deliberately separate from
 * fetch-cavc.mjs's .work/cavc.jsonl (rolling window) AND from each other, so
 * running this script again for just one database (e.g. a SingleJudgeDecisions
 * backfill after an earlier PanelDecisions-only run) never clobbers the other
 * category's already-fetched records. build-cavc-shard.mjs reads both and tags
 * each chunk with its decision_type (S43).
 *
 * Format detection (S43 fix): the archive's "no extension" filenames are NOT
 * reliably plain text — some are WordPerfect binaries that just lack a .wpd
 * extension (confirmed: a 1990s PanelDecisions hit decoded as latin1 produced
 * garbled control-byte text starting with the WP file signature bytes
 * `\xFFWPC`). classifyDocFormat(docid) is now only a pre-download fast-skip for
 * explicit .wpd extensions; the real format is sniffed from the downloaded
 * bytes' magic number (sniffDocFormat) before deciding how to decode — a
 * mis-tagged WordPerfect binary is now SKIPPED (counted, not fabricated),
 * never latin1-decoded into garbage.
 *
 * Env knobs:
 *   CAVC_HIST_BASE           override the search host (default
 *                             http://search.uscourts.cavc.gov — plain HTTP;
 *                             the host has no working HTTPS listener)
 *   CAVC_HIST_DATABASES      comma list of IW_DATABASE values to crawl
 *                             (default "PanelDecisions,SingleJudgeDecisions")
 *   CAVC_HIST_MAX_RESULTS    cap per database (0 = unlimited/full; default 0)
 *   CAVC_HIST_PAGE_SIZE      /list/ range size per request (default 100)
 *   CAVC_HIST_THROTTLE_MS    delay between requests (default 400) — be a good
 *                             citizen against a federal court's servers
 *   CAVC_HIST_FORCE_FRESH    set to "1" to ignore any existing checkpoint and
 *                             start a database over from page 1 (S44 — see
 *                             checkpointPath()'s comment for the resume design)
 */

import {
  writeFileSync,
  appendFileSync,
  mkdirSync,
  existsSync,
  readFileSync,
  unlinkSync,
} from "node:fs";
import path, { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import { makeRecord } from "./sanitize-html.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORK_DIR = path.join(__dirname, ".work");

const workerPath = resolve("node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs");
GlobalWorkerOptions.workerSrc = new URL(`file:///${workerPath.replaceAll("\\", "/")}`).href;

export const BASE = process.env.CAVC_HIST_BASE || "http://search.uscourts.cavc.gov";
const DATABASES = (process.env.CAVC_HIST_DATABASES || "PanelDecisions,SingleJudgeDecisions")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const PAGE_SIZE = Number(process.env.CAVC_HIST_PAGE_SIZE) || 100;
const MAX_RESULTS = Number(process.env.CAVC_HIST_MAX_RESULTS) || 0; // 0 = unlimited, per database
export const THROTTLE_MS = Number(process.env.CAVC_HIST_THROTTLE_MS) || 400;

const USER_AGENT =
  "vet-rate-org legal-ingestion/1.0 (anthony.johnson.now@gmail.com)";

const DECISION_TYPE_LABEL = {
  PanelDecisions: "Panel Opinion (precedential)",
  SingleJudgeDecisions:
    "Single-Judge Memorandum Decision (non-precedential — U.S. Vet. App. R. 30(a))",
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function decodeAmp(s) {
  return String(s || "").replaceAll("&amp;", "&");
}

// S43: a real multi-hour run reproducibly hung on one specific list-page
// range (14101-14200 of SingleJudgeDecisions) — confirmed in isolation, fresh
// session, first request, hung past 30s. The legacy ISYS server has no
// timeout of its own for a request like that; plain fetch() has none either,
// so a single bad range could otherwise stall the whole job indefinitely.
// AbortSignal.timeout() turns that into a normal, retryable/skippable error.
//
// S44 recheck (2026-07-20): re-tested live. The 14101-14200 range is STILL
// dead (confirmed on two fresh sessions), but every other page now legitimately
// takes 33-36s to respond (up from whatever baseline motivated the original
// 30s figure) — at 30s, those healthy-but-slow pages would misclassify as
// failures and could trip CONSECUTIVE_FAILURE_LIMIT on a server that isn't
// actually down. Raised to 60s so only the one genuinely-dead range times out.
const REQUEST_TIMEOUT_MS = 60_000;

async function postForm(url, fields) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/html",
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams(fields).toString(),
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`POST ${url} → HTTP ${res.status}`);
  return res.text();
}

async function getText(url) {
  const res = await fetch(url, {
    headers: { Accept: "text/html", "User-Agent": USER_AGENT },
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  return res.text();
}

export async function getBytes(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

const GUID_RE = /\/isysquery\/([0-9a-f-]{36})\//i;
const TOTAL_RE = /occurred\s+[\d,]+\s+times\s+in\s+([\d,]+)\s+documents/i;

/**
 * Pull the query-session guid and the reported total document count out of a
 * search results page. Pure — unit-tested without network.
 * @param {string} html
 * @returns {{guid: string|null, totalDocuments: number}}
 */
export function parseSessionMeta(html) {
  const guidMatch = GUID_RE.exec(String(html || ""));
  const totalMatch = TOTAL_RE.exec(String(html || ""));
  return {
    guid: guidMatch ? guidMatch[1] : null,
    totalDocuments: totalMatch ? Number(totalMatch[1].replace(/,/g, "")) : 0,
  };
}

// Two-stage parse (mirrors sanitize-html.mjs's row/cell approach) instead of
// one monolithic regex spanning both `<td>` cells: find each row's start
// marker (index + docid + anchor text) first, then pull the filepath/date out
// of just that row's slice. Keeps every regex simple and linear instead of
// chaining non-greedy `[\s\S]*?` spans end to end.
const ITEM_START_RE =
  /(\d+)\.\s*<a href="\/isysquery\/[0-9a-f-]{36}\/\d+\/doc\/([^"]*)">([^<]*)<\/a>/g;
const FILEPATH_RE = /<font color="green"[^>]*>([^<]*)<\/font>/;
const LIST_DATE_RE = /(\d{1,2} [A-Za-z]{3} \d{4})<br/;

/**
 * Parse one /list/ results page into hit records. Pure — unit-tested without
 * network.
 * @param {string} html
 * @returns {Array<{index:number, docid:string, docket:string, filePath:string, listDate:string}>}
 */
export function parseListPage(html) {
  const text = String(html || "");
  const starts = [];
  let m;
  ITEM_START_RE.lastIndex = 0;
  while ((m = ITEM_START_RE.exec(text))) {
    starts.push({
      blockStart: ITEM_START_RE.lastIndex,
      index: Number(m[1]),
      docid: decodeAmp(m[2]).trim(),
      docket: decodeAmp(m[3]).trim(),
    });
  }

  const out = [];
  for (let i = 0; i < starts.length; i++) {
    if (!starts[i].docid) continue;
    const blockEnd = i + 1 < starts.length ? starts[i + 1].blockStart : text.length;
    const block = text.slice(starts[i].blockStart, blockEnd);
    const filePathMatch = FILEPATH_RE.exec(block);
    const dateMatch = LIST_DATE_RE.exec(block);
    out.push({
      index: starts[i].index,
      docid: starts[i].docid,
      docket: starts[i].docket,
      filePath: filePathMatch ? decodeAmp(filePathMatch[1]).trim() : "",
      listDate: dateMatch ? dateMatch[1].trim() : "",
    });
  }
  return out;
}

/**
 * Classify a docid's archive file format by extension — used ONLY as a
 * pre-download fast-skip for explicit .wpd filenames (saves a request for a
 * format we know we can't parse). No-extension and other filenames return
 * "text" here as a tentative guess only; sniffDocFormat() on the actual
 * downloaded bytes is the real classifier (see its doc comment for why the
 * extension alone is unreliable).
 * @param {string} docid
 * @returns {"pdf"|"wpd"|"text"}
 */
export function classifyDocFormat(docid) {
  const dot = String(docid || "").lastIndexOf(".");
  if (dot === -1) return "text";
  const ext = docid.slice(dot + 1).toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "wpd") return "wpd";
  return "text";
}

// File-format magic numbers, checked against the first bytes actually
// downloaded. WPC_MAGIC is WordPerfect's own file signature (0xFF 'W' 'P' 'C')
// — some archive filenames with no/other extension are still WordPerfect
// binaries under the hood (confirmed live: a 1992 PanelDecisions hit named
// without a .wpd extension opened with exactly these four bytes). Trusting
// the filename alone silently latin1-decodes that binary into garbled text;
// sniffing the real bytes catches it before any decode is attempted.
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // "%PDF"
const WPC_MAGIC = [0xff, 0x57, 0x50, 0x43]; // "\xFFWPC"

/**
 * True file format from the downloaded bytes' magic number — the ground
 * truth classifyDocFormat(docid) can only guess at. Pure — unit-tested
 * without network.
 * @param {Uint8Array} bytes
 * @returns {"pdf"|"wpd"|"text"}
 */
export function sniffDocFormat(bytes) {
  if (!bytes || bytes.length < 4) return "text";
  if (WPC_MAGIC.every((b, i) => bytes[i] === b)) return "wpd";
  if (PDF_MAGIC.every((b, i) => bytes[i] === b)) return "pdf";
  return "text";
}

/**
 * Extract full opinion text from a downloaded PDF's raw bytes — same
 * pdfjs-dist legacy Node build + worker setup as fetch-fedcir.mjs.
 * @param {Uint8Array} uint8Array
 * @returns {Promise<string>}
 */
export async function extractPdfText(uint8Array) {
  const pdf = await getDocument({
    data: uint8Array,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
  }).promise;

  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item) => item.str).join(" ") + "\n\n";
  }
  return text.trim();
}

/**
 * Derive a docket-based citation. No Vet.App. reporter cite is available from
 * this search index (only docket number + list date), so this deliberately
 * matches fetch-cavc.mjs's citationFromCavcEntry() convention rather than
 * fabricating a reporter volume/page.
 * @param {string} docket
 * @param {string} listDate
 * @returns {string}
 */
export function citationForHit(docket, listDate) {
  const year = (String(listDate || "").match(/\d{4}/) || [])[0] || "n.d.";
  return `No. ${docket || "unknown"} (Vet. App. ${year})`;
}

// The ISYS index's own "Title" field (the search result anchor text) is
// frequently NOT the docket number — verified against the live site: it can
// be an arbitrary fragment of the document's running text ("te:Pursuant to
// U.S.Vet.App.R.", a mangled cut of "Note: Pursuant to..."). The docket
// number is pulled from the opinion's own text instead, which reliably opens
// with "No. <docket>" (rendered with letter-spacing artifacts from small-caps
// PDF fonts, e.g. "N O . 23-7995" — hence the \s* tolerance).
const DOCKET_RE = /N\s*o\s*\.\s*(\d{2}-\d{1,6}[A-Z()]*)/i;

/**
 * Pull the primary docket number out of a decision's extracted text. Only the
 * first "No. <docket>" is used even for consolidated multi-docket decisions
 * (same single-primary-identifier convention as fetch-fedcir.mjs's appeal
 * number). Pure — unit-tested without network.
 * @param {string} text
 * @returns {string} docket number, or "" if not found
 */
export function docketFromText(text) {
  const m = DOCKET_RE.exec(String(text || "").slice(0, 2000));
  return m ? m[1].replace(/\s+/g, "") : "";
}

/** Open a new search session for one IW_DATABASE value, sorted date-descending. */
export async function openSession(database) {
  const html = await postForm(`${BASE}/search/`, {
    IW_FIELD_WEB_STYLE: "*",
    IW_DATABASE: database,
  });
  const meta = parseSessionMeta(html);
  if (!meta.guid) {
    throw new Error(
      `cavc-historical: no session guid in search response for IW_DATABASE=${database} — page structure may have changed`,
    );
  }
  await sleep(THROTTLE_MS);
  await getText(`${BASE}/isysquery/${meta.guid}/-datetime/sort/`);
  await sleep(THROTTLE_MS);
  return meta;
}

// S43: a real multi-hour run against this server hit a transient "fetch
// failed" (network-level, not a session/parsing error) that the original
// retry-once logic wasn't built to survive — it killed the whole ~50,700-doc
// job at 28% progress. Legacy federal-court infrastructure kept alive over
// plain HTTP for hours is going to blip occasionally; MAX_RETRIES with
// exponential backoff rides that out instead of losing hours of progress to
// one bad connection.
const MAX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 2000;
// A run past this many CONSECUTIVE fully-retried page failures aborts
// instead of continuing to skip — see the throw site in fetchDatabase() for
// why (distinguishing one bad page from a sustained server outage).
export const CONSECUTIVE_FAILURE_LIMIT = 3;

/**
 * Run `fn(guid)` against the current session; on failure, back off and open a
 * fresh session for `database` before retrying, up to MAX_RETRIES times
 * (exponential backoff: 2s, 4s, 8s, 16s, 32s). Session guids are query-cache
 * tokens that can go stale mid-crawl on a long run, so a session refresh is
 * attempted on every retry — this is the recovery path, not a silent
 * swallow (exhausting all retries still throws the original error).
 */
export async function withSessionRetry(sessionRef, database, fn) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn(sessionRef.guid);
    } catch (e) {
      lastError = e;
      if (attempt === MAX_RETRIES) break;
      const delayMs = RETRY_BASE_DELAY_MS * 2 ** attempt;
      console.warn(
        `[cavc-historical] request failed (${e.message}) — attempt ${attempt + 1}/${MAX_RETRIES}, ` +
          `retrying ${database} in ${delayMs}ms`,
      );
      await sleep(delayMs);
      try {
        sessionRef.guid = (await openSession(database)).guid;
      } catch (sessionError) {
        // Session refresh itself failed (network still down) — don't crash
        // here, let the next loop iteration's fn() call fail and retry again.
        console.warn(`[cavc-historical] session refresh also failed (${sessionError.message})`);
      }
    }
  }
  throw lastError;
}

/**
 * Download a hit's raw bytes and decode according to its SNIFFED format
 * (never the filename-guessed one). Returns `{format: "wpd"}` with no text
 * for a WordPerfect binary the caller must skip.
 */
async function fetchDoc(guid, hit) {
  const url = `${BASE}/isysquery/${guid}/${hit.index}/doc/${hit.docid}`;
  const bytes = await getBytes(url);
  const format = sniffDocFormat(bytes);
  if (format === "wpd") return { format };
  if (format === "pdf") return { format, text: await extractPdfText(bytes) };
  return { format, text: Buffer.from(bytes).toString("latin1").trim() };
}

function buildBody(docket, hit, database, text) {
  const label = DECISION_TYPE_LABEL[database] || database;
  return (
    `${docket}\n` +
    `Decision Type: ${label}\n` +
    `Date: ${hit.listDate}\n\n` +
    text
  );
}

export const DATABASE_SLUG = {
  PanelDecisions: "panel",
  SingleJudgeDecisions: "singlejudge",
};

// S44: fetchDatabase() used to hold everything in memory and only
// writeFileSync at the very end of a full pass — a crash anywhere in a
// ~50,700-doc run lost ALL progress (confirmed twice, hours each time).
// Fixed by appending each page's records to the output .jsonl as soon as
// that page finishes, plus a small checkpoint file recording how far the
// run got — a restart with the SAME command picks up after the last
// completed page instead of starting over. This does NOT fully solve
// resumability: the ISYS search returns hits by POSITION in a date-desc
// sort, not a stable doc id, so if new Single-Judge decisions get published
// between the original run and a resume, positions after the checkpoint
// could shift slightly — an accepted, documented limitation, not silently
// ignored. Set CAVC_HIST_FORCE_FRESH=1 to discard any checkpoint and start
// a database over from page 1.
function checkpointPath(slug) {
  return path.join(WORK_DIR, `cavc-historical-${slug}.checkpoint.json`);
}

function outputPath(slug) {
  return path.join(WORK_DIR, `cavc-historical-${slug}.jsonl`);
}

function loadCheckpoint(slug) {
  const p = checkpointPath(slug);
  if (process.env.CAVC_HIST_FORCE_FRESH === "1" || !existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    console.warn(`[cavc-historical] checkpoint at ${p} is corrupt — starting fresh`);
    return null;
  }
}

function saveCheckpoint(slug, state) {
  writeFileSync(checkpointPath(slug), JSON.stringify(state, null, 2));
}

function clearCheckpoint(slug) {
  const p = checkpointPath(slug);
  if (existsSync(p)) unlinkSync(p);
}

async function fetchDatabase(database) {
  const slug = DATABASE_SLUG[database] || database.toLowerCase();
  const checkpoint = loadCheckpoint(slug);
  const resuming = checkpoint !== null;

  console.log(
    `[cavc-historical] opening session for IW_DATABASE=${database}…` +
      (resuming ? ` (resuming from checkpoint: page ${checkpoint.lastCompletedEnd + 1})` : ""),
  );
  const session = await openSession(database);
  console.log(
    `[cavc-historical] ${database}: ${session.totalDocuments} documents available (date-desc)`,
  );
  const cap = MAX_RESULTS
    ? Math.min(MAX_RESULTS, session.totalDocuments)
    : session.totalDocuments;
  if (cap === 0) return { recordCount: 0, skippedWpd: 0, skippedEmpty: 0, skippedError: 0, skippedPages: 0 };

  const out = outputPath(slug);
  if (resuming) {
    if (!existsSync(out)) {
      throw new Error(
        `${database}: checkpoint at ${checkpointPath(slug)} exists but ${out} doesn't — ` +
          `refusing to resume against a missing output file. Delete the checkpoint (or set ` +
          `CAVC_HIST_FORCE_FRESH=1) to start over instead.`,
      );
    }
  } else {
    writeFileSync(out, ""); // fresh run: start the output file clean
  }

  const sessionRef = { guid: session.guid };
  const startPage = resuming ? checkpoint.lastCompletedEnd + 1 : 1;
  let recordCount = resuming ? checkpoint.recordCount : 0;
  let skippedWpd = resuming ? checkpoint.skippedWpd : 0;
  let skippedEmpty = resuming ? checkpoint.skippedEmpty : 0;
  let skippedError = resuming ? checkpoint.skippedError : 0;
  let skippedPages = resuming ? checkpoint.skippedPages : 0;
  let consecutivePageFailures = 0;
  let exhaustedRealData = false;
  let lastCompletedEnd = resuming ? checkpoint.lastCompletedEnd : 0;

  for (let start = startPage; start <= cap; start += PAGE_SIZE) {
    const end = Math.min(start + PAGE_SIZE - 1, cap);
    let html;
    try {
      html = await withSessionRetry(sessionRef, database, (guid) =>
        getText(`${BASE}/isysquery/${guid}/${start}-${end}/list/`),
      );
      consecutivePageFailures = 0;
    } catch (e) {
      // A reproducible server-side bug on ONE isolated range must not kill
      // the whole run (confirmed live, S43: 14101-14200 of SingleJudgeDecisions
      // hangs even on a brand-new session, first request) — skip that one
      // page (up to PAGE_SIZE decisions), count it, and keep going.
      //
      // But a STRING of consecutive page failures is a different situation —
      // confirmed live, S43: the server going down mid-run made every
      // request time out, including session refreshes, for many pages in a
      // row. Silently skip-and-continuing through a real outage would reach
      // "done" having quietly dropped thousands of decisions — exactly the
      // "no gaps" guarantee this shard exists for. CONSECUTIVE_FAILURE_LIMIT
      // turns that into a loud abort instead of a silent mass-skip; the
      // caller can retry the whole run once the server recovers.
      skippedPages += 1;
      consecutivePageFailures += 1;
      if (consecutivePageFailures > CONSECUTIVE_FAILURE_LIMIT) {
        throw new Error(
          `${database}: ${consecutivePageFailures} consecutive page failures ending at ${start}-${end} ` +
            `(${e.message}) — looks like a sustained outage, not an isolated bad page. Aborting rather ` +
            `than silently skip-mass-continuing to the cap. ${recordCount} records already fetched are ` +
            `safely on disk (checkpointed incrementally) — re-run the SAME command once the server recovers ` +
            `to resume from page ${start} instead of starting over.`,
        );
      }
      console.warn(
        `[cavc-historical] ${database}: list page ${start}-${end} failed after retries (${e.message}) — skipping this page`,
      );
      continue;
    }
    const hits = parseListPage(html);
    if (hits.length === 0) {
      console.warn(
        `[cavc-historical] ${database}: list page ${start}-${end} returned 0 hits — stopping early`,
      );
      exhaustedRealData = true;
      break;
    }

    const pageRecords = [];
    for (const hit of hits) {
      if (classifyDocFormat(hit.docid) === "wpd") {
        // Explicit .wpd extension — skip without downloading.
        skippedWpd += 1;
        continue;
      }
      let doc;
      try {
        doc = await withSessionRetry(sessionRef, database, (guid) =>
          fetchDoc(guid, hit),
        );
      } catch (e) {
        console.warn(`[cavc-historical] doc fetch failed for ${hit.docid}: ${e.message}`);
        skippedError += 1;
        continue;
      }
      await sleep(THROTTLE_MS);
      if (doc.format === "wpd") {
        // Sniffed WordPerfect binary despite a non-.wpd filename — skip, not fabricate.
        skippedWpd += 1;
        continue;
      }
      const text = doc.text;
      if (!text || text.trim().length === 0) {
        skippedEmpty += 1;
        continue;
      }
      const docket = docketFromText(text) || hit.docket || hit.docid;
      pageRecords.push(
        await makeRecord({
          source: "cavc",
          jurisdiction: "court",
          citation: citationForHit(docket, hit.listDate),
          title: docket,
          body: buildBody(docket, hit, database, text),
          source_url: `${BASE}/isysquery/${sessionRef.guid}/${hit.index}/doc/${hit.docid}`,
        }),
      );
    }

    // S44: persist this page immediately (append, don't overwrite) and
    // checkpoint right after — this is the actual fix for the write-once-
    // at-end data-loss risk (see the block comment above checkpointPath()).
    if (pageRecords.length > 0) {
      appendFileSync(
        out,
        pageRecords.map((r) => JSON.stringify(r)).join("\n") + "\n",
      );
    }
    recordCount += pageRecords.length;
    lastCompletedEnd = end;
    saveCheckpoint(slug, {
      lastCompletedEnd,
      recordCount,
      skippedWpd,
      skippedEmpty,
      skippedError,
      skippedPages,
    });

    console.log(
      `[cavc-historical] ${database}: progress ${end}/${cap} scanned — ` +
        `${recordCount} fetched so far (skipped ${skippedWpd} WordPerfect, ${skippedEmpty} empty, ${skippedError} errors)`,
    );
    await sleep(THROTTLE_MS);
  }

  console.log(
    `[cavc-historical] ${database}: ${recordCount} records ` +
      `(skipped ${skippedWpd} WordPerfect, ${skippedEmpty} empty, ${skippedError} doc-fetch errors, ` +
      `${skippedPages} unreachable page(s) ≈${skippedPages * PAGE_SIZE} decisions max)`,
  );
  // A MAX_RESULTS cap below the database's real total is an artificial stop,
  // not completion — clearing the checkpoint here would make the NEXT run
  // (even an unbounded one) start over from page 1, silently discarding and
  // re-fetching everything already on disk. Only clear when the run actually
  // reached the true end of the database (ran the full, uncapped range) or
  // organically ran out of documents (a real 0-hits page).
  const stoppedByArtificialCap = MAX_RESULTS > 0 && cap < session.totalDocuments && !exhaustedRealData;
  if (stoppedByArtificialCap) {
    console.log(
      `[cavc-historical] ${database}: stopped at MAX_RESULTS cap (${cap}/${session.totalDocuments}) — ` +
        `checkpoint preserved; re-run WITHOUT CAVC_HIST_MAX_RESULTS to continue from page ${lastCompletedEnd + 1}.`,
    );
  } else {
    clearCheckpoint(slug); // full pass completed — nothing left to resume
  }
  return { recordCount, skippedWpd, skippedEmpty, skippedError, skippedPages };
}


async function main() {
  mkdirSync(WORK_DIR, { recursive: true });

  let totalRecords = 0;
  for (const database of DATABASES) {
    const summary = await fetchDatabase(database);
    totalRecords += summary.recordCount;

    const slug = DATABASE_SLUG[database] || database.toLowerCase();
    const rel = path.relative(path.resolve(__dirname, "..", ".."), outputPath(slug));
    console.log(`[cavc-historical] ${database}: ${summary.recordCount} records on disk → ${rel}`);
  }

  if (totalRecords === 0) {
    throw new Error(
      "CAVC historical fetch produced ZERO records — verify against the live search site",
    );
  }
  const cap = MAX_RESULTS ? ` (capped at ${MAX_RESULTS}/database)` : "";
  console.log(`[cavc-historical] done — ${totalRecords} decision records total${cap}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`[cavc-historical] FAILED: ${e.message}`);
    process.exit(1);
  });
}
