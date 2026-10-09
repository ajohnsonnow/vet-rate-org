#!/usr/bin/env node
/**
 * build-cavc-shard.mjs — chunk + embed the fetched CAVC decisions into their
 * own lazy-loadable shard (S33 rolling feed; S42 historical backfill; S43
 * decision-type tagging + Single-Judge coverage).
 *
 * Inputs (merged, deduped by docket number parsed from `citation`):
 *   scripts/legal-ingestion/.work/cavc.jsonl                     (fetch-cavc.mjs,
 *     rolling few-days window, disposition-summary body only — tagged
 *     "singlejudge" per that fetcher's own header: "CAVC memorandum decisions
 *     in this feed are non-precedential (they don't appear in the
 *     'precedential opinions' index)"; confirmed empirically too, S43 — every
 *     sampled record in this feed self-declares "Memorandum Decision" or
 *     "ORDERED", never a formal Panel Opinion)
 *   scripts/legal-ingestion/.work/cavc-historical-panel.jsonl       (fetch-cavc-historical.mjs,
 *     precedential Panel Decisions backfill)
 *   scripts/legal-ingestion/.work/cavc-historical-singlejudge.jsonl (fetch-cavc-historical.mjs,
 *     non-precedential Single-Judge Memorandum Decisions backfill, S43)
 * At least one must exist. When the same docket appears in more than one file,
 * the record with the longer `body` wins (real opinion text beats a short
 * disposition summary for the same case) and its source file's decision_type
 * is kept. Every chunk is tagged via cavcAuthorityTagging.tagCavcEntry() —
 * decision_type/precedential/citation_weight (S43) — so a single-judge
 * memorandum decision can never rank or render as citable precedent.
 * Output: public/dkb-index/cavc/  (S29 shard format: chunks.partN.jsonl +
 *         vectors.partN.bin + shard.json, authority_tier "judicial" per
 *         build-shard.mjs's SHARD_TIER map)
 *
 * CURRENT COVERAGE STATUS (S43, as of 2026-07-19): the SingleJudgeDecisions
 * historical backfill (~50,700 non-precedential memorandum decisions) was
 * NOT completed — the archive server (search.uscourts.cavc.gov, a legacy
 * plain-HTTP ISYS box) had a genuine, confirmed outage mid-run (independently
 * reproduced with a real visible browser, not just our fetch script), and the
 * fetch was paused rather than left retrying unattended indefinitely. The
 * shard therefore currently has only 29 single_judge-tagged chunks (from
 * fetch-cavc.mjs's small rolling feed) alongside the full 1,363-decision
 * precedential Panel Decisions backfill. cavc-historical-singlejudge.jsonl
 * does not exist yet. Resuming: re-run
 * `CAVC_HIST_DATABASES=SingleJudgeDecisions node scripts/legal-ingestion/fetch-cavc-historical.mjs`
 * once the server is confirmed healthy (the fetcher has retry/timeout/
 * circuit-breaker hardening from this same debugging session — see that
 * file's header), then re-run this builder + build-registry.mjs.
 *
 * Two more skip filters (S43), found by inspecting the real fetched panel
 * corpus, not guessed at:
 *   1. isGarbledText — a small number of older PDFs (measured: 2 of 1,734
 *      panel records) have a custom/embedded font with no usable ToUnicode
 *      CMap, so pdf.js's extracted text is shifted glyph-index garbage (a
 *      >20% control-byte density measured on real examples, vs. 0% on every
 *      other record) — a DIFFERENT root cause than the WordPerfect-binary
 *      bug fetch-cavc-historical.mjs's sniffDocFormat() already fixes.
 *      Skipped, not fabricated — same discipline as everything else here.
 *   2. hasRealDocket — when a decision's own text has no "No. <docket>" line
 *      AND the search-index listing's docket field is also empty,
 *      fetch-cavc-historical.mjs falls back to the archive's raw filename as
 *      "docket" (e.g. "C:\USCAVC_Docs\PANEL.CVA\list\R.LST") — measured: 20 of
 *      1,734 panel records, mostly ".LST" directory-index artifacts that
 *      aren't decisions at all. A raw local file path is not a citation;
 *      skipped rather than published as one.
 *
 * Why a separate builder (not run-all.mjs): same rationale as
 * build-m21-1-shard.mjs — run-all folds every fetcher into the eCFR
 * legal-index MONOLITH that "Ask the Regs" queries (S29 keeps that
 * regression-free). CAVC becomes its own shard so knowledgeQuery.queryCorpus
 * (S30) can retrieve it independently.
 *
 * Usage:
 *   node scripts/dkb-sharding/build-cavc-shard.mjs                       # real embed → public/dkb-index/cavc
 *   node scripts/dkb-sharding/build-cavc-shard.mjs --embed=stub --out=<dir>   # pipeline test (FAKE vectors)
 *   node scripts/dkb-sharding/build-registry.mjs                          # then refresh the registry
 */

import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chunkRecord } from "../legal-ingestion/chunk.mjs";
import { buildShard, stubEmbed } from "./build-shard.mjs";
import { tagCavcEntry } from "../../src/services/cavcAuthorityTagging.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const WORK_DIR = path.join(ROOT, "scripts", "legal-ingestion", ".work");
// Each entry pairs a work file with the decision_type its records get tagged
// with (S43) — see fetch-cavc.mjs's header: its rolling feed carries only
// non-precedential memorandum decisions/orders, never formal Panel Opinions.
const WORK_FILES = [
  { file: path.join(WORK_DIR, "cavc.jsonl"), decisionType: "singlejudge" },
  { file: path.join(WORK_DIR, "cavc-historical-panel.jsonl"), decisionType: "panel" },
  {
    file: path.join(WORK_DIR, "cavc-historical-singlejudge.jsonl"),
    decisionType: "singlejudge",
  },
];
const SHARD_SOURCE = "cavc"; // matches SHARD_TIER key → "judicial" tier

/**
 * Docket number parsed from a `citation` string of the shared
 * "No. <docket> (Vet. App. <year>)" form both fetchers emit — the one stable
 * key across the rolling feed's efiling URLs and the historical fetcher's
 * session-scoped ISYS query URLs, which don't share a URL shape.
 * @param {string} citation
 * @returns {string}
 */
function docketFromCitation(citation) {
  const m = /No\.\s*([\w-]+)/i.exec(citation || "");
  return m ? m[1] : "";
}

// Real CAVC dockets are "<2-digit year>-<1-6 digit number>" with an optional
// trailing letter suffix (e.g. "16-2993", "17-298E") — never a path separator.
const REAL_DOCKET_RE = /^\d{2}-\d{1,6}[A-Za-z]{0,2}$/;

/**
 * True when citation carries a real CAVC docket, not a raw archive filename
 * fallback (fetch-cavc-historical.mjs falls back to the archive's own
 * filename — sometimes an absolute Windows path — when neither the decision
 * text nor the search-listing carry a usable docket). Pure, unit-tested.
 * @param {string} citation
 * @returns {boolean}
 */
export function hasRealDocket(citation) {
  return REAL_DOCKET_RE.test(docketFromCitation(citation));
}

/**
 * True when `text` is dominated by non-printable control bytes — the
 * signature of a PDF whose embedded font has no usable ToUnicode CMap, so
 * pdf.js returns shifted glyph-index garbage instead of real characters
 * (measured on real examples: >20% control-byte density, vs. 0% for every
 * cleanly-extracted decision). \t\n\r\v\f are excluded — legitimate
 * whitespace, not corruption. Pure, unit-tested.
 * @param {string} text
 * @returns {boolean}
 */
export function isGarbledText(text) {
  const body = String(text || "");
  if (body.length === 0) return false;
  // Detecting control-byte corruption IS the point; \t\n\r are deliberately excluded.
  // eslint-disable-next-line no-control-regex
  const controlBytes = (body.match(/[\x00-\x08\x0e-\x1f]/g) || []).length;
  return controlBytes / body.length > 0.02;
}

/**
 * Merge the three WORK_FILES sources, deduping by docket number. When a
 * docket appears in more than one, keep whichever record has the longer body
 * (real opinion text from a historical fetcher outranks a short disposition
 * summary from the rolling feed) — and that record's decisionType travels
 * with it, so a docket never silently loses its panel/single-judge label.
 * @param {Array<{records: Array<object>, decisionType: string}>} taggedSets — one per input file
 * @returns {Array<{rec: object, decisionType: string}>}
 */
function mergeRecords(taggedSets) {
  const byDocket = new Map();
  for (const { records, decisionType } of taggedSets) {
    for (const rec of records) {
      const docket = docketFromCitation(rec.citation) || rec.source_url;
      const existing = byDocket.get(docket);
      if (!existing || (rec.body?.length || 0) > (existing.rec.body?.length || 0)) {
        byDocket.set(docket, { rec, decisionType });
      }
    }
  }
  return [...byDocket.values()];
}

function parseArgs(argv) {
  const out = { embed: "real" };
  for (const a of argv) {
    if (a.startsWith("--embed=")) out.embed = a.split("=")[1];
    else if (a.startsWith("--out=")) out.out = a.split("=")[1];
  }
  return out;
}

/**
 * Stable unique key for a chunked passage: the docket number when the
 * citation carries one (both fetchers' shared "No. <docket>" format), else a
 * short hash of the url so a record whose shape ever changes never collides.
 * @param {string} citation
 * @param {string} url
 * @returns {string}
 */
function caseIdFromRecord(citation, url) {
  const docket = docketFromCitation(citation);
  if (docket) return docket;
  return createHash("sha256").update(url || "").digest("hex").slice(0, 12);
}

/**
 * Read merged {rec, decisionType} pairs → sub-chunk each decision → S29
 * buildShard entry shape, tagged via cavcAuthorityTagging.tagCavcEntry() (S43)
 * so every chunk carries decision_type/precedential/citation_weight.
 * dkb_id is `cavc:<caseId>:<passageIdx>` — the corpus's real unique key
 * discipline from S28.
 */
async function recordsToEntries(mergedRecords) {
  const entries = [];
  for (const { rec, decisionType } of mergedRecords) {
    const passages = await chunkRecord(rec);
    const extra = tagCavcEntry(decisionType);
    passages.forEach((p, idx) => {
      entries.push({
        dkb_id: `cavc:${caseIdFromRecord(p.citation, p.source_url)}:${idx}`,
        id: p.id,
        source: SHARD_SOURCE,
        content: p.text,
        url: p.source_url,
        citation: p.citation,
        title: p.title,
        date_added: p.fetched_at,
        extra,
      });
    });
  }
  return entries;
}

/** Real bge-small-en-v1.5 embedder (same model/normalization as embed.mjs). */
async function realEmbedder() {
  const { pipeline } = await import("@huggingface/transformers");
  console.log("[cavc-shard] loading bge-small-en-v1.5…");
  const pipe = await pipeline("feature-extraction", "Xenova/bge-small-en-v1.5");
  return async (text) => {
    const out = await pipe(text, { pooling: "mean", normalize: false });
    const f = new Float32Array(out.data);
    let sum = 0;
    for (let i = 0; i < f.length; i++) sum += f[i] * f[i];
    const norm = Math.sqrt(sum) || 1;
    for (let i = 0; i < f.length; i++) f[i] /= norm;
    return f;
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const existingSets = WORK_FILES.filter((w) => existsSync(w.file));
  if (existingSets.length === 0) {
    throw new Error(
      `build-cavc-shard: none of ${WORK_FILES.map((w) => path.relative(ROOT, w.file)).join(", ")} exist — run fetch-cavc.mjs and/or fetch-cavc-historical.mjs first`,
    );
  }
  const taggedSets = existingSets.map(({ file, decisionType }) => ({
    decisionType,
    records: readFileSync(file, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l)),
  }));
  const merged = mergeRecords(taggedSets);
  const rawCount = taggedSets.reduce((n, s) => n + s.records.length, 0);
  const panelCount = merged.filter((m) => m.decisionType === "panel").length;
  const singleJudgeCount = merged.filter((m) => m.decisionType === "singlejudge").length;
  console.log(
    `[cavc-shard] merged ${rawCount} raw records from ${existingSets.length} source(s) → ` +
      `${merged.length} deduped decisions (${panelCount} panel, ${singleJudgeCount} single-judge)`,
  );

  const clean = [];
  let skippedGarbled = 0;
  let skippedBadDocket = 0;
  for (const m of merged) {
    if (isGarbledText(m.rec.body)) {
      skippedGarbled += 1;
      continue;
    }
    if (!hasRealDocket(m.rec.citation)) {
      skippedBadDocket += 1;
      continue;
    }
    clean.push(m);
  }
  if (skippedGarbled || skippedBadDocket) {
    console.log(
      `[cavc-shard] skipped ${skippedGarbled} garbled-extraction + ${skippedBadDocket} invalid-citation decisions (not fabricated)`,
    );
  }

  const entries = await recordsToEntries(clean);
  if (entries.length === 0) {
    throw new Error("build-cavc-shard: 0 chunks produced from available work files");
  }

  const outDir = args.out
    ? path.join(args.out, SHARD_SOURCE)
    : path.join(ROOT, "public", "dkb-index", SHARD_SOURCE);
  if (args.embed === "stub") {
    console.warn(
      "[cavc-shard] WARNING: --embed=stub produces FAKE vectors — pipeline testing only, never commit as a real shard.",
    );
  }
  const embed = args.embed === "stub" ? async (t) => stubEmbed(t) : await realEmbedder();
  const fallbackFetchedAt = clean[0]?.rec.fetched_at || new Date(0).toISOString();

  console.log(
    `[cavc-shard] ${clean.length} decisions → ${entries.length} chunks → ${path.relative(ROOT, outDir)}`,
  );
  const meta = await buildShard({
    source: SHARD_SOURCE,
    entries,
    embed,
    outDir,
    fallbackFetchedAt,
  });
  console.log(
    `[cavc-shard] DONE — ${meta.entry_count} chunks in ${meta.parts.length} part(s); ` +
      `skipped ${meta.skipped.empty_content} empty + ${meta.skipped.missing_url} url-less`,
  );
  console.log(
    "[cavc-shard] NEXT: node scripts/dkb-sharding/build-registry.mjs to register the shard",
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`[cavc-shard] FAILED: ${e.message}`);
    process.exit(1);
  });
}
