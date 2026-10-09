#!/usr/bin/env node
/**
 * build-ogc-shard.mjs — build the VA Office of General Counsel (OGC)
 * precedent-opinion shard from two inputs (S34):
 *
 *   (a) the offline corpus's source:"ogc" entries (891 total) — always
 *       included, so this shard is never empty. 468 of those entries carry
 *       an EMPTY url + EMPTY citation (only their `title` carries the
 *       "VAOPGCPREC n-yyyy" string); ogc-citation.mjs's ogcCanonicalUrl /
 *       ogcCitationText rescue those so build-shard.mjs's accuracy floor
 *       (S28: skip entries with no url) doesn't drop them.
 *   (b) scripts/legal-ingestion/.work/ogc.jsonl — recently fetched opinions
 *       from fetch-ogc.mjs's live va.gov crawl, if present. OPTIONAL: the
 *       builder works corpus-only when that file is absent.
 *
 * De-dup: a fetched record whose parsed citation (number+year) already
 * appears in the corpus is dropped — the corpus entry is authoritative.
 *
 * Output: public/dkb-index/ogc/ (S29 shard format; authority_tier "policy"
 * per build-shard.mjs's SHARD_TIER map).
 *
 * Usage:
 *   node scripts/dkb-sharding/build-ogc-shard.mjs                          # real embed → public/dkb-index/ogc (heavy)
 *   node scripts/dkb-sharding/build-ogc-shard.mjs --limit=200 --embed=stub --out=<dir>   # bounded pipeline test
 *   node scripts/dkb-sharding/build-registry.mjs                           # then refresh the registry
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildShard, stubEmbed } from "./build-shard.mjs";
import { ogcCanonicalUrl, ogcCitationText, parseOgcCitation } from "../legal-ingestion/ogc-citation.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const CORPUS_PATH = path.join(
  ROOT,
  "llm-compiler",
  "knowledge-base",
  "diamond_knowledge_base.json",
);
const WORK = path.join(ROOT, "scripts", "legal-ingestion", ".work", "ogc.jsonl");
const SHARD_SOURCE = "ogc"; // SHARD_TIER["ogc"] → "policy"

function parseArgs(argv) {
  const out = { embed: "real", limit: 0 };
  for (const a of argv) {
    if (a.startsWith("--embed=")) out.embed = a.split("=")[1];
    else if (a.startsWith("--limit=")) out.limit = Number(a.split("=")[1]) || 0;
    else if (a.startsWith("--out=")) out.out = a.split("=")[1];
  }
  return out;
}

/** URL/id-safe slug for a citation, e.g. "VAOPGCPREC 10-2010" → "vaopgcprec-10-2010". */
function slugifyCitation(citation) {
  return String(citation || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .split("-")
    .filter(Boolean)
    .join("-");
}

/**
 * Corpus entry → buildShard entry: keep the entry's own fields, but back-fill
 * `url` (ogcCanonicalUrl) and `citation` (ogcCitationText) so entries whose
 * only citation trace lives in `title` still resolve a real url. Not
 * sub-chunked — corpus OGC content is already short, same as build-bva-shard.
 * @param {Object} entry
 */
function corpusEntryToShardEntry(entry) {
  return {
    ...entry,
    url: ogcCanonicalUrl(entry),
    citation: ogcCitationText(entry) || entry.citation,
  };
}

/** Citation keys ("<number>-<year>") already covered by the corpus, for de-dup. */
function corpusCitationKeys(ogcEntries) {
  const keys = new Set();
  for (const entry of ogcEntries) {
    const parsed = parseOgcCitation(ogcCitationText(entry));
    if (parsed) keys.add(`${parsed.number}-${parsed.year}`);
  }
  return keys;
}

/** Fetched .work/ogc.jsonl records → buildShard entries, minus corpus dupes. */
function fetchedEntries(records, seenCitationKeys) {
  const entries = [];
  let kept = 0;
  for (const rec of records) {
    const parsed = parseOgcCitation(rec.citation);
    if (parsed && seenCitationKeys.has(`${parsed.number}-${parsed.year}`)) continue;
    kept += 1;
    const slug = slugifyCitation(rec.citation);
    entries.push({
      dkb_id: `ogc:fetched:${slug}`,
      id: `ogc:fetched:${slug}`,
      source: SHARD_SOURCE,
      content: rec.body,
      url: rec.source_url,
      citation: rec.citation,
      title: rec.title,
      date_added: rec.fetched_at,
    });
  }
  return { entries, kept };
}

/** Real bge-small-en-v1.5 embedder (same model/normalization as embed.mjs). */
async function realEmbedder() {
  const { pipeline } = await import("@huggingface/transformers");
  console.log("[ogc-shard] loading bge-small-en-v1.5…");
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
  if (!existsSync(CORPUS_PATH)) {
    throw new Error(`build-ogc-shard: corpus not found at ${CORPUS_PATH}`);
  }

  console.log("[ogc-shard] reading corpus…");
  const corpus = JSON.parse(readFileSync(CORPUS_PATH, "utf8"));
  const fallbackFetchedAt = corpus.metadata?.generated || new Date(0).toISOString();
  let ogc = (corpus.entries || []).filter((e) => e.source === SHARD_SOURCE);
  if (ogc.length === 0) {
    throw new Error('build-ogc-shard: 0 entries with source="ogc"');
  }
  if (args.limit > 0) ogc = ogc.slice(0, args.limit);

  const backfillCount = ogc.filter((e) => !String(e.url || "").trim()).length;
  const corpusEntries = ogc.map(corpusEntryToShardEntry);

  let fetchedChunkEntries = [];
  let fetchedRecordCount = 0;
  let fetchedKeptCount = 0;
  if (existsSync(WORK)) {
    const fetchedRecs = readFileSync(WORK, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    fetchedRecordCount = fetchedRecs.length;
    const { entries, kept } = fetchedEntries(fetchedRecs, corpusCitationKeys(ogc));
    fetchedChunkEntries = entries;
    fetchedKeptCount = kept;
  } else {
    console.log(
      "[ogc-shard] no .work/ogc.jsonl found — building corpus-only (run fetch-ogc.mjs for live opinions)",
    );
  }

  const entries = [...corpusEntries, ...fetchedChunkEntries];

  const outDir = args.out
    ? path.join(args.out, SHARD_SOURCE)
    : path.join(ROOT, "public", "dkb-index", SHARD_SOURCE);
  if (args.embed === "stub") {
    console.warn(
      "[ogc-shard] WARNING: --embed=stub produces FAKE vectors — pipeline testing only, never commit as a real shard.",
    );
  }
  const embed = args.embed === "stub" ? async (t) => stubEmbed(t) : await realEmbedder();

  console.log(
    `[ogc-shard] corpus: ${ogc.length} entries (${backfillCount} url-backfilled); ` +
      `fetched: ${fetchedRecordCount} records (${fetchedKeptCount} kept after de-dup) → ` +
      `${path.relative(ROOT, outDir)}`,
  );
  const meta = await buildShard({
    source: SHARD_SOURCE,
    entries,
    embed,
    outDir,
    fallbackFetchedAt,
  });
  console.log(
    `[ogc-shard] DONE — ${meta.entry_count} chunks in ${meta.parts.length} part(s); ` +
      `skipped ${meta.skipped.empty_content} empty + ${meta.skipped.missing_url} url-less`,
  );
  console.log(
    "[ogc-shard] NEXT: node scripts/dkb-sharding/build-registry.mjs to register the shard",
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`[ogc-shard] FAILED: ${e.message}`);
    process.exit(1);
  });
}
