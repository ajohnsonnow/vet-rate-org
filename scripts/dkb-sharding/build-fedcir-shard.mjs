#!/usr/bin/env node
/**
 * build-fedcir-shard.mjs — build the Federal Circuit veterans-law shard from
 * two inputs (S33):
 *
 *   (a) FEDCIR_KEY_CASES — a hand-verified seed of load-bearing precedents
 *       (scripts/legal-ingestion/fedcir-key-cases.mjs), each carrying its
 *       real reporter citation (F.3d/F.4th). Always included, even with no
 *       live fetch has ever run — this shard is never empty.
 *   (b) scripts/legal-ingestion/.work/fedcir.jsonl — recent veterans-origin
 *       opinions from fetch-fedcir.mjs's bounded CAFC REST crawl, if present.
 *   (c) scripts/legal-ingestion/.work/fedcir-historical.jsonl — the S42 full
 *       unbounded backfill from fetch-fedcir-historical.mjs, if present.
 *       Both (b) and (c) are OPTIONAL: the builder works seed-only when
 *       neither file exists.
 *
 * De-dup: a fetched case whose party name matches a seed case is dropped —
 * the seed already carries the real reporter cite the fetched record can't
 * reliably produce (see fedcir-key-cases.mjs's header). Across (b) and (c),
 * a case appearing in both is deduped by appeal number, keeping whichever
 * record has the longer body (the historical fetcher's --with-pdf-text full
 * opinion text beats a synopsis-only record for the same case).
 *
 * Output: public/dkb-index/fedcir/  (S29 shard format; authority_tier
 * "judicial_federal_circuit" per build-shard.mjs's SHARD_TIER map).
 *
 * Usage:
 *   node scripts/dkb-sharding/build-fedcir-shard.mjs                       # real embed → public/dkb-index/fedcir
 *   node scripts/dkb-sharding/build-fedcir-shard.mjs --embed=stub --out=<dir>   # pipeline test (FAKE vectors)
 *   node scripts/dkb-sharding/build-registry.mjs                          # then refresh the registry
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chunkRecord } from "../legal-ingestion/chunk.mjs";
import { makeRecord } from "../legal-ingestion/sanitize-html.mjs";
import { buildShard, stubEmbed } from "./build-shard.mjs";
import {
  FEDCIR_KEY_CASES,
  cafcSearchUrl,
  keyCaseToRecordBody,
} from "../legal-ingestion/fedcir-key-cases.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const WORK_DIR = path.join(ROOT, "scripts", "legal-ingestion", ".work");
const WORK_FILES = [
  path.join(WORK_DIR, "fedcir.jsonl"),
  path.join(WORK_DIR, "fedcir-historical.jsonl"),
];
const SHARD_SOURCE = "fedcir"; // matches SHARD_TIER key → "judicial_federal_circuit" tier

function parseArgs(argv) {
  const out = { embed: "real" };
  for (const a of argv) {
    if (a.startsWith("--embed=")) out.embed = a.split("=")[1];
    else if (a.startsWith("--out=")) out.out = a.split("=")[1];
  }
  return out;
}

/** URL/id-safe slug for a case name, e.g. "Procopio v. Wilkie" → "procopio-v-wilkie". */
function slugifyName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .split("-")
    .filter(Boolean)
    .join("-");
}

/** Loose match key so "Procopio v. Wilkie" and small casing/whitespace variants collide. */
function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The fetched record's citation is `"<PARTIES>, No. <appeal#> (Fed. Cir. <year>)"`. */
function appealNumberFromCitation(citation) {
  const m = /No\.\s*([\w-]+)/.exec(String(citation || ""));
  return m ? m[1] : "x";
}

async function seedRecords() {
  return Promise.all(
    FEDCIR_KEY_CASES.map(async (c) =>
      makeRecord({
        source: SHARD_SOURCE,
        jurisdiction: "court",
        citation: `${c.name}, ${c.citation}`,
        title: c.name,
        body: keyCaseToRecordBody(c),
        source_url: cafcSearchUrl(c.name),
      }),
    ),
  );
}

/** Seed cases → chunk entries, dkb_id `fedcir:key:<slug>:<passageIdx>`. */
async function seedEntries(records) {
  const entries = [];
  for (const rec of records) {
    const slug = slugifyName(rec.title);
    const passages = await chunkRecord(rec);
    passages.forEach((p, idx) => {
      entries.push({
        dkb_id: `fedcir:key:${slug}:${idx}`,
        id: p.id,
        source: SHARD_SOURCE,
        content: p.text,
        url: p.source_url,
        citation: p.citation,
        title: p.title,
        date_added: p.fetched_at,
      });
    });
  }
  return entries;
}

/**
 * Merge fedcir.jsonl + fedcir-historical.jsonl records, deduping by appeal
 * number (parsed from the shared "No. <appeal#>" citation format). When an
 * appeal number appears in both, keep whichever record has the longer body.
 * @param {Array<Array<object>>} recordSets — one array per input file
 * @returns {Array<object>}
 */
function mergeFetchedRecords(recordSets) {
  const byAppeal = new Map();
  for (const records of recordSets) {
    for (const rec of records) {
      const key = appealNumberFromCitation(rec.citation) || rec.source_url;
      const existing = byAppeal.get(key);
      if (!existing || (rec.body?.length || 0) > (existing.body?.length || 0)) {
        byAppeal.set(key, rec);
      }
    }
  }
  return [...byAppeal.values()];
}

/**
 * Fetched records (merged from fetch-fedcir.mjs + fetch-fedcir-historical.mjs),
 * minus any whose party name already matches a seed case.
 * dkb_id `fedcir:<appealNumber>:<idx>`.
 * @param {Array<Object>} records
 * @param {Set<string>} seedNames — normalized seed case names
 */
async function fetchedEntries(records, seedNames) {
  const entries = [];
  let keptRecords = 0;
  for (const rec of records) {
    if (seedNames.has(normalizeName(rec.title))) continue;
    keptRecords += 1;
    const appealNumber = appealNumberFromCitation(rec.citation);
    const passages = await chunkRecord(rec);
    passages.forEach((p, idx) => {
      entries.push({
        dkb_id: `fedcir:${appealNumber}:${idx}`,
        id: p.id,
        source: SHARD_SOURCE,
        content: p.text,
        url: p.source_url,
        citation: p.citation,
        title: p.title,
        date_added: p.fetched_at,
      });
    });
  }
  return { entries, keptRecords };
}

/** Real bge-small-en-v1.5 embedder (same model/normalization as embed.mjs). */
async function realEmbedder() {
  const { pipeline } = await import("@huggingface/transformers");
  console.log("[fedcir-shard] loading bge-small-en-v1.5…");
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

  const seedRecs = await seedRecords();
  const seedChunkEntries = await seedEntries(seedRecs);
  const seedNames = new Set(FEDCIR_KEY_CASES.map((c) => normalizeName(c.name)));

  let fetchedChunkEntries = [];
  let fetchedRecordCount = 0;
  let fetchedKeptCount = 0;
  const existingWorkFiles = WORK_FILES.filter((f) => existsSync(f));
  if (existingWorkFiles.length > 0) {
    const recordSets = existingWorkFiles.map((f) =>
      readFileSync(f, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l)),
    );
    const fetchedRecs = mergeFetchedRecords(recordSets);
    fetchedRecordCount = fetchedRecs.length;
    console.log(
      `[fedcir-shard] merged ${recordSets.flat().length} raw records from ${existingWorkFiles.length} source(s) → ${fetchedRecordCount} deduped cases`,
    );
    const { entries, keptRecords } = await fetchedEntries(fetchedRecs, seedNames);
    fetchedChunkEntries = entries;
    fetchedKeptCount = keptRecords;
  } else {
    console.log(
      "[fedcir-shard] no .work/fedcir.jsonl or fedcir-historical.jsonl found — building seed-only",
    );
  }

  const entries = [...seedChunkEntries, ...fetchedChunkEntries];
  if (entries.length === 0) {
    throw new Error("build-fedcir-shard: 0 chunks produced from seed + fetched sources");
  }

  console.log(
    `[fedcir-shard] seed cases: ${FEDCIR_KEY_CASES.length} (${seedChunkEntries.length} chunks); ` +
      `fetched cases: ${fetchedRecordCount} (${fetchedKeptCount} kept after de-dup, ${fetchedChunkEntries.length} chunks)`,
  );

  const outDir = args.out
    ? path.join(args.out, SHARD_SOURCE)
    : path.join(ROOT, "public", "dkb-index", SHARD_SOURCE);
  if (args.embed === "stub") {
    console.warn(
      "[fedcir-shard] WARNING: --embed=stub produces FAKE vectors — pipeline testing only, never commit as a real shard.",
    );
  }
  const embed = args.embed === "stub" ? async (t) => stubEmbed(t) : await realEmbedder();
  const fallbackFetchedAt = seedRecs[0]?.fetched_at || new Date(0).toISOString();

  console.log(
    `[fedcir-shard] ${entries.length} total chunks → ${path.relative(ROOT, outDir)}`,
  );
  const meta = await buildShard({
    source: SHARD_SOURCE,
    entries,
    embed,
    outDir,
    fallbackFetchedAt,
  });
  console.log(
    `[fedcir-shard] DONE — ${meta.entry_count} chunks in ${meta.parts.length} part(s); ` +
      `skipped ${meta.skipped.empty_content} empty + ${meta.skipped.missing_url} url-less`,
  );
  console.log(
    "[fedcir-shard] NEXT: node scripts/dkb-sharding/build-registry.mjs to register the shard",
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`[fedcir-shard] FAILED: ${e.message}`);
    process.exit(1);
  });
}
