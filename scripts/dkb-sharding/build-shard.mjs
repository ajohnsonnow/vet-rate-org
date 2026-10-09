#!/usr/bin/env node
/**
 * build-shard.mjs — build one Diamond Knowledge Base shard from an offline
 * corpus category (S29).
 *
 * Reads llm-compiler/knowledge-base/diamond_knowledge_base.json, filters to one
 * `source` category, and emits an independently-lazy-loadable shard under
 * public/dkb-index/<shard>/:
 *   chunks.partN.jsonl   — one chunk record per line (keyed by dkb_id)
 *   vectors.partN.bin     — Int8 Q8 embeddings, 384 bytes/chunk
 *   shard.json            — shard metadata (authority_tier, tier_rank, parts[])
 *
 * Parts: a shard is split so no single vectors.partN.bin exceeds the 25 MB
 * per-part budget (PER_PART_MAX_CHUNKS chunks) — the runtime never holds more
 * than one part's vectors per shard, so even the 116K-entry BVA shard fits a
 * mid-tier device one part at a time.
 *
 * Keying: chunk `dkb_id` comes from the entry's `dkb_id` (the corpus's only
 * unique key — the `id` field collides ~37%, per S28). `id` is carried through
 * only as a reference field.
 *
 * Accuracy discipline (S28): entries with empty/too-short content, or missing a
 * source url, are SKIPPED and COUNTED (never silently dropped) — the skip
 * report is printed and written into shard.json so a shard never silently
 * under-covers its category.
 *
 * Embedding: `--embed=real` (default) uses bge-small-en-v1.5 exactly like
 * embed.mjs (downloads ~30 MB weights on first run; the per-source sprints
 * S31-S34 run this). `--embed=stub` writes deterministic hash-derived vectors
 * to a scratch dir for pipeline testing only — NEVER commit stub output as a
 * real shard.
 *
 * Usage:
 *   node scripts/dkb-sharding/build-shard.mjs --source=presumptive
 *   node scripts/dkb-sharding/build-shard.mjs --source=bva --limit=1000
 *   node scripts/dkb-sharding/build-shard.mjs --source=secondary --embed=stub --out=/tmp/dkb
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { quantizeQ8 } from "../legal-ingestion/embed.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const CORPUS_PATH = path.join(
  ROOT,
  "llm-compiler",
  "knowledge-base",
  "diamond_knowledge_base.json",
);

const EMBED_DIM = 384;
const PER_PART_BYTE_BUDGET = 25 * 1024 * 1024;
export const PER_PART_MAX_CHUNKS = Math.floor(PER_PART_BYTE_BUDGET / EMBED_DIM); // 68266
const MIN_CONTENT_CHARS = 30;

// Canonical authority-tier map — KEEP IN SYNC with
// src/services/dkbAuthorityTiers.js (see that file's header for why this is a
// deliberate duplicate rather than a cross-tree import).
const AUTHORITY_TIERS = {
  statutory: 1,
  judicial_federal_circuit: 2,
  judicial: 3,
  administrative_precedent: 4,
  policy: 5,
  procedural: 6,
  reference: 7,
  community: 8,
};
const SHARD_TIER = {
  ecfr: "statutory",
  "38_cfr": "statutory",
  federal_register: "statutory",
  federal_circuit: "judicial_federal_circuit",
  fedcir: "judicial_federal_circuit",
  cavc: "judicial",
  bva: "administrative_precedent",
  ogc: "policy",
  m21_1: "procedural",
  "m21-1": "procedural",
  m21_5: "procedural",
  "m21-5": "procedural",
  // m21_4 is intentionally "reference", not "procedural" — see
  // dkbAuthorityTiers.js (the copy this map must stay in sync with) for why.
  m21_4: "reference",
  "m21-4": "reference",
  presumptive: "reference",
  secondary: "reference",
  "state-benefits": "reference",
  multinational: "reference",
  community: "community",
};

function tierForSource(sourceId) {
  const authority_tier = SHARD_TIER[sourceId] || "reference";
  return { authority_tier, tier_rank: AUTHORITY_TIERS[authority_tier] };
}

function parseArgs(argv) {
  const out = { embed: "real", limit: 0 };
  for (const a of argv) {
    if (a.startsWith("--source=")) out.source = a.split("=")[1];
    else if (a.startsWith("--embed=")) out.embed = a.split("=")[1];
    else if (a.startsWith("--limit=")) out.limit = Number(a.split("=")[1]) || 0;
    else if (a.startsWith("--out=")) out.out = a.split("=")[1];
  }
  return out;
}

/**
 * Map an offline-corpus entry to a shard chunk record. The offline corpus uses
 * `content` (not `text`) and `url` (not `source_url`); normalize to the chunk
 * shape legalRag/dkbShardedRag expect. Returns null for entries that fail the
 * accuracy floor (caller counts them).
 */
export function entryToChunk(entry, { authority_tier, fallbackFetchedAt }) {
  const text = String(entry.content || "").trim();
  if (text.length < MIN_CONTENT_CHARS) return { skip: "empty_content" };
  if (!entry.url) return { skip: "missing_url" };
  return {
    chunk: {
      dkb_id: entry.dkb_id,
      id: entry.id,
      source: entry.source,
      authority_tier,
      citation: entry.citation || "",
      title: entry.title || "",
      text,
      source_url: entry.url,
      fetched_at: entry.date_added || fallbackFetchedAt,
      // Optional per-entry authority metadata (S32): a source-specific builder
      // (e.g. build-bva-shard.mjs) sets entry.extra to bake fields like
      // precedential/binding/citation_weight onto the chunk. Absent for sources
      // that don't tag (spread of {} is a no-op) — backward compatible.
      ...(entry.extra && typeof entry.extra === "object" ? entry.extra : {}),
    },
  };
}

/** Deterministic stub embedder — reproducible unit vector from text hash. */
export function stubEmbed(text) {
  const f = new Float32Array(EMBED_DIM);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.codePointAt(i);
    h = Math.imul(h, 16777619);
  }
  let sum = 0;
  for (let i = 0; i < EMBED_DIM; i++) {
    // cheap deterministic pseudo-random from the hash + index
    const x = Math.sin((h % 1000) * 0.001 * (i + 1) + i);
    f[i] = x;
    sum += x * x;
  }
  const norm = Math.sqrt(sum) || 1;
  for (let i = 0; i < EMBED_DIM; i++) f[i] /= norm;
  return f;
}

async function realEmbedder() {
  const { pipeline } = await import("@huggingface/transformers");
  console.log("[build-shard] loading bge-small-en-v1.5…");
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

/**
 * Build a shard from an in-memory list of corpus entries. Pure enough to unit
 * test: takes the entries, an embedder fn, and an output dir; returns the shard
 * metadata it wrote.
 *
 * @param {Object} args
 * @param {string} args.source
 * @param {Array<Object>} args.entries — already filtered to this source
 * @param {(text:string)=>Promise<Float32Array>} args.embed
 * @param {string} args.outDir — shard directory (created if missing)
 * @param {string} args.fallbackFetchedAt
 * @param {number} [args.maxChunksPerPart=PER_PART_MAX_CHUNKS] — override for tests
 * @returns {Promise<Object>} shard.json contents
 */
export async function buildShard({
  source,
  entries,
  embed,
  outDir,
  fallbackFetchedAt,
  maxChunksPerPart = PER_PART_MAX_CHUNKS,
}) {
  const { authority_tier, tier_rank } = tierForSource(source);
  const chunks = [];
  const skips = { empty_content: 0, missing_url: 0 };
  for (const entry of entries) {
    const r = entryToChunk(entry, { authority_tier, fallbackFetchedAt });
    if (r.skip) skips[r.skip]++;
    else chunks.push(r.chunk);
  }

  mkdirSync(outDir, { recursive: true });

  const parts = [];
  for (let start = 0, partNo = 0; start < chunks.length; start += maxChunksPerPart, partNo++) {
    const slice = chunks.slice(start, start + maxChunksPerPart);
    const buf = new Int8Array(slice.length * EMBED_DIM);
    for (let i = 0; i < slice.length; i++) {
      const vec = await embed(slice[i].text);
      buf.set(quantizeQ8(vec), i * EMBED_DIM);
    }
    const chunksFile = `chunks.part${partNo}.jsonl`;
    const vectorsFile = `vectors.part${partNo}.bin`;
    writeFileSync(
      path.join(outDir, chunksFile),
      slice.map((c) => JSON.stringify(c)).join("\n") + (slice.length ? "\n" : ""),
    );
    writeFileSync(path.join(outDir, vectorsFile), buf);
    parts.push({
      chunks: chunksFile,
      vectors: vectorsFile,
      count: slice.length,
      bytes: buf.length,
    });
  }

  const shardMeta = {
    id: source,
    layout: "shard",
    authority_tier,
    tier_rank,
    embedding_model: "Xenova/bge-small-en-v1.5",
    embedding_dim: EMBED_DIM,
    entry_count: chunks.length,
    source_entry_count: entries.length,
    skipped: skips,
    built_at: fallbackFetchedAt,
    parts,
  };
  writeFileSync(
    path.join(outDir, "shard.json"),
    JSON.stringify(shardMeta, null, 2) + "\n",
  );
  return shardMeta;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.source) throw new Error("build-shard: --source=<category> required");
  if (!existsSync(CORPUS_PATH)) {
    throw new Error(`build-shard: corpus not found at ${CORPUS_PATH}`);
  }

  console.log(`[build-shard] reading corpus…`);
  const corpus = JSON.parse(readFileSync(CORPUS_PATH, "utf8"));
  const fallbackFetchedAt = corpus.metadata?.generated || new Date(0).toISOString();
  let entries = corpus.entries.filter((e) => e.source === args.source);
  if (entries.length === 0) {
    throw new Error(
      `build-shard: 0 entries with source="${args.source}" — check the category id`,
    );
  }
  if (args.limit > 0) entries = entries.slice(0, args.limit);

  const outDir =
    args.out
      ? path.join(args.out, args.source)
      : path.join(ROOT, "public", "dkb-index", args.source);

  if (args.embed === "stub") {
    console.warn(
      "[build-shard] WARNING: --embed=stub produces FAKE vectors — for pipeline testing only, never commit as a real shard.",
    );
  }
  const embed = args.embed === "stub" ? async (t) => stubEmbed(t) : await realEmbedder();

  console.log(
    `[build-shard] source=${args.source} entries=${entries.length} → ${outDir}`,
  );
  const meta = await buildShard({
    source: args.source,
    entries,
    embed,
    outDir,
    fallbackFetchedAt,
  });

  console.log(
    `[build-shard] DONE — ${meta.entry_count} chunks in ${meta.parts.length} part(s); ` +
      `skipped ${meta.skipped.empty_content} empty + ${meta.skipped.missing_url} url-less`,
  );
  console.log(`[build-shard] wrote ${path.relative(ROOT, outDir)}/shard.json`);
  console.log(
    `[build-shard] NEXT: node scripts/dkb-sharding/build-registry.mjs to refresh the registry`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`[build-shard] FAILED: ${e.message}`);
    process.exit(1);
  });
}
