#!/usr/bin/env node
/**
 * recover-cavc-wpd.mjs — S46 WordPerfect recovery pass for
 * fetch-cavc-historical.mjs. That fetcher deliberately SKIPS any document
 * that sniffs as a WordPerfect (.wpd) binary rather than fabricate garbled
 * text — confirmed live against the SingleJudgeDecisions full backfill:
 * 14,762 of 50,000 scanned documents (~29.5%) were WordPerfect, concentrated
 * almost entirely in the oldest era of the archive.
 *
 * This machine has LibreOffice installed, which bundles libwpd — a real,
 * mature WordPerfect import library. Proof-of-concept (2026-07-26): 3 live
 * samples pulled from the confirmed-high-density 49500-49600 range all
 * converted via `soffice --headless --convert-to txt` into clean, fully
 * readable CAVC single-judge orders (correct docket numbers, dates, judges,
 * citations — no garbling). Recovery is real, not speculative.
 *
 * Why this is a SEPARATE pass, not a change to fetch-cavc-historical.mjs
 * itself: classifyDocFormat(docid) can only fast-skip explicit .wpd
 * filenames BEFORE download; most of the actual WPD hits in this archive
 * have no file extension at all (e.g. CASIONAN.341) and are only
 * identifiable by sniffing the downloaded bytes' magic number. There is no
 * shortcut that avoids re-fetching every hit's bytes — this pass costs
 * roughly the same network time as the original crawl. It is NOT a re-run
 * of the main fetcher; it does not re-save already-kept text/PDF records,
 * it only captures the raw bytes for hits that sniff as WordPerfect.
 *
 * Output: one raw .wpd file per recovered hit under
 * .work/cavc-wpd-raw/<slug>/<docid-sanitized>.wpd, plus a manifest JSONL
 * (.work/cavc-wpd-manifest-<slug>.jsonl) recording {docid, index, docket,
 * listDate, database} for each — enough to rebuild a real record once
 * convert-wpd-batch.mjs turns the .wpd into text.
 *
 * Checkpointed exactly like fetch-cavc-historical.mjs (S44 lesson applies
 * here too — this is also a genuinely multi-hour live run): resumes
 * automatically from .work/cavc-wpd-recover-<slug>.checkpoint.json. Only
 * clears the checkpoint on real full-range completion (S45 lesson) — never
 * on an artificial MAX_RESULTS test cap.
 *
 * Env knobs (mirrors fetch-cavc-historical.mjs where applicable):
 *   CAVC_HIST_DATABASES     comma list (default "SingleJudgeDecisions" —
 *                            the only database with a confirmed WPD problem
 *                            so far; PanelDecisions not yet re-audited)
 *   CAVC_WPD_MAX_RESULTS    cap per database (0 = unlimited; default 0)
 *   CAVC_WPD_FORCE_FRESH    set to "1" to ignore any checkpoint and restart
 */

import { writeFileSync, appendFileSync, mkdirSync, existsSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  BASE,
  THROTTLE_MS,
  sleep,
  getBytes,
  parseListPage,
  classifyDocFormat,
  sniffDocFormat,
  openSession,
  withSessionRetry,
  DATABASE_SLUG,
  CONSECUTIVE_FAILURE_LIMIT,
} from "./fetch-cavc-historical.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORK_DIR = path.join(__dirname, ".work");
const RAW_DIR = path.join(WORK_DIR, "cavc-wpd-raw");

const DATABASES = (process.env.CAVC_HIST_DATABASES || "SingleJudgeDecisions")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const PAGE_SIZE = 100;
const MAX_RESULTS = Number(process.env.CAVC_WPD_MAX_RESULTS) || 0;

function checkpointPath(slug) {
  return path.join(WORK_DIR, `cavc-wpd-recover-${slug}.checkpoint.json`);
}
function manifestPath(slug) {
  return path.join(WORK_DIR, `cavc-wpd-manifest-${slug}.jsonl`);
}
function rawDir(slug) {
  return path.join(RAW_DIR, slug);
}

function loadCheckpoint(slug) {
  const p = checkpointPath(slug);
  if (process.env.CAVC_WPD_FORCE_FRESH === "1" || !existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
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

function safeName(docid) {
  return docid.replace(/[^a-z0-9._-]/gi, "_");
}

async function recoverDatabase(database) {
  const slug = DATABASE_SLUG[database] || database.toLowerCase();
  mkdirSync(rawDir(slug), { recursive: true });

  const checkpoint = loadCheckpoint(slug);
  const resuming = checkpoint !== null;
  const manifest = manifestPath(slug);
  if (!resuming) writeFileSync(manifest, "");

  console.log(
    `[cavc-wpd-recover] opening session for IW_DATABASE=${database}…` +
      (resuming ? ` (resuming from checkpoint: page ${checkpoint.lastCompletedEnd + 1})` : ""),
  );
  const session = await openSession(database);
  console.log(`[cavc-wpd-recover] ${database}: ${session.totalDocuments} documents available (date-desc)`);

  const cap = MAX_RESULTS ? Math.min(MAX_RESULTS, session.totalDocuments) : session.totalDocuments;
  if (cap === 0) return { recovered: 0, scanned: 0 };

  const sessionRef = { guid: session.guid };
  const startPage = resuming ? checkpoint.lastCompletedEnd + 1 : 1;
  let recovered = resuming ? checkpoint.recovered : 0;
  let scanned = resuming ? checkpoint.scanned : 0;
  let lastCompletedEnd = resuming ? checkpoint.lastCompletedEnd : 0;
  let exhaustedRealData = false;
  let consecutivePageFailures = 0;

  for (let start = startPage; start <= cap; start += PAGE_SIZE) {
    const end = Math.min(start + PAGE_SIZE - 1, cap);
    let listHtml;
    try {
      listHtml = await withSessionRetry(sessionRef, database, (guid) =>
        getBytes(`${BASE}/isysquery/${guid}/${start}-${end}/list/`).then((b) => Buffer.from(b).toString("utf8")),
      );
      consecutivePageFailures = 0;
    } catch (e) {
      // Same known-dead-range behavior as fetch-cavc-historical.mjs (S43):
      // one bad range (e.g. 14101-14200 of SingleJudgeDecisions, reproducibly
      // dead) must not kill the whole recovery pass — skip it and keep going.
      // A STRING of consecutive failures still means abort (real outage).
      consecutivePageFailures++;
      if (consecutivePageFailures > CONSECUTIVE_FAILURE_LIMIT) {
        throw new Error(
          `${database}: ${consecutivePageFailures} consecutive page failures ending at ${start}-${end} ` +
            `(${e.message}) — looks like a sustained outage. ${recovered} WPD binaries already recovered ` +
            `are safe on disk — re-run the SAME command once the server recovers to resume from page ${start}.`,
        );
      }
      console.warn(
        `[cavc-wpd-recover] ${database}: list page ${start}-${end} failed after retries (${e.message}) — skipping this page`,
      );
      continue;
    }
    const hits = parseListPage(listHtml);
    if (hits.length === 0) {
      console.warn(`[cavc-wpd-recover] ${database}: list page ${start}-${end} returned 0 hits — stopping early`);
      exhaustedRealData = true;
      break;
    }

    for (const hit of hits) {
      scanned++;
      // Fast pre-download skip is only possible for explicit .wpd filenames;
      // everything else must be downloaded and sniffed (see header comment).
      const preClassified = classifyDocFormat(hit.docid);
      let bytes;
      try {
        bytes = await withSessionRetry(sessionRef, database, (guid) =>
          getBytes(`${BASE}/isysquery/${guid}/${hit.index}/doc/${hit.docid}`),
        );
      } catch (e) {
        console.warn(`[cavc-wpd-recover] doc fetch failed for ${hit.docid}: ${e.message}`);
        continue;
      }
      const format = preClassified === "wpd" ? "wpd" : sniffDocFormat(bytes);
      if (format === "wpd") {
        writeFileSync(path.join(rawDir(slug), `${safeName(hit.docid)}.wpd`), Buffer.from(bytes));
        appendFileSync(
          manifest,
          JSON.stringify({
            docid: hit.docid,
            index: hit.index,
            docket: hit.docket,
            listDate: hit.listDate,
            database,
          }) + "\n",
        );
        recovered++;
      }
      await sleep(THROTTLE_MS);
    }

    lastCompletedEnd = end;
    saveCheckpoint(slug, { lastCompletedEnd, recovered, scanned });
    console.log(
      `[cavc-wpd-recover] ${database}: progress ${end}/${cap} scanned — ${recovered} WPD recovered so far`,
    );
    await sleep(THROTTLE_MS);
  }

  console.log(`[cavc-wpd-recover] ${database}: ${recovered} WPD binaries recovered out of ${scanned} scanned`);

  const stoppedByArtificialCap = MAX_RESULTS > 0 && cap < session.totalDocuments && !exhaustedRealData;
  if (stoppedByArtificialCap) {
    console.log(
      `[cavc-wpd-recover] ${database}: stopped at MAX_RESULTS cap (${cap}/${session.totalDocuments}) — ` +
        `checkpoint preserved; re-run WITHOUT CAVC_WPD_MAX_RESULTS to continue from page ${lastCompletedEnd + 1}.`,
    );
  } else {
    clearCheckpoint(slug);
  }
  return { recovered, scanned };
}

async function main() {
  mkdirSync(WORK_DIR, { recursive: true });
  for (const database of DATABASES) {
    const summary = await recoverDatabase(database);
    console.log(`[cavc-wpd-recover] ${database}: done — ${summary.recovered}/${summary.scanned}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`[cavc-wpd-recover] FAILED: ${e.message}`);
    process.exit(1);
  });
}
