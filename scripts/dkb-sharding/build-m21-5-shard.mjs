#!/usr/bin/env node
/**
 * build-m21-5-shard.mjs — chunk + embed the fetched M21-5 manual into its own
 * lazy-loadable shard (S44).
 *
 * Input:  scripts/legal-ingestion/.work/m21-5.jsonl  (from fetch-m21-5.mjs)
 * Output: public/dkb-index/m21_5/  (S29 shard format: chunks.partN.jsonl +
 *         vectors.partN.bin + shard.json, authority_tier "procedural" — same
 *         tier as M21-1, both are VA-internal adjudication/appeals procedure
 *         manuals, not statutory or judicial authority)
 *
 * Why a separate builder (not folded into build-m21-1-shard.mjs or run-all):
 * same rationale as every other per-source builder in this directory — keeps
 * the eCFR legal-index MONOLITH regression-free (S29) and lets
 * knowledgeQuery.queryCorpus (S30) retrieve M21-5 independently of M21-1.
 *
 * Usage:
 *   node scripts/dkb-sharding/build-m21-5-shard.mjs                       # real embed → public/dkb-index/m21_5
 *   node scripts/dkb-sharding/build-m21-5-shard.mjs --embed=stub --out=<dir>   # pipeline test (FAKE vectors)
 *   node scripts/dkb-sharding/build-registry.mjs                          # then refresh the registry
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chunkRecord } from "../legal-ingestion/chunk.mjs";
import { buildShard, stubEmbed } from "./build-shard.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const WORK = path.join(
  ROOT,
  "scripts",
  "legal-ingestion",
  ".work",
  "m21-5.jsonl",
);
const SHARD_SOURCE = "m21_5"; // matches SHARD_TIER key → "procedural" tier

function parseArgs(argv) {
  const out = { embed: "real" };
  for (const a of argv) {
    if (a.startsWith("--embed=")) out.embed = a.split("=")[1];
    else if (a.startsWith("--out=")) out.out = a.split("=")[1];
  }
  return out;
}

/** Article id is the stable unique key in the source_url; use it for dkb_id. */
function articleIdFromUrl(url) {
  const m = /\/article\/(\d+)/.exec(url || "");
  return m ? m[1] : "x";
}

/**
 * Read .work records → sub-chunk each article → S29 buildShard entry shape
 * (content/url/dkb_id keyed). dkb_id is `m21_5:<articleId>:<passageIdx>` — the
 * corpus's real unique key discipline from S28.
 */
async function recordsToEntries(records) {
  const entries = [];
  for (const rec of records) {
    const passages = await chunkRecord(rec);
    passages.forEach((p, idx) => {
      entries.push({
        dkb_id: `m21_5:${articleIdFromUrl(p.source_url)}:${idx}`,
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

/** Real bge-small-en-v1.5 embedder (same model/normalization as embed.mjs). */
async function realEmbedder() {
  const { pipeline } = await import("@huggingface/transformers");
  console.log("[m21-5-shard] loading bge-small-en-v1.5…");
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
  if (!existsSync(WORK)) {
    throw new Error(
      `build-m21-5-shard: ${path.relative(ROOT, WORK)} not found — run fetch-m21-5.mjs first`,
    );
  }
  const records = readFileSync(WORK, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const entries = await recordsToEntries(records);
  if (entries.length === 0) {
    throw new Error("build-m21-5-shard: 0 chunks produced from .work/m21-5.jsonl");
  }

  const outDir = args.out
    ? path.join(args.out, SHARD_SOURCE)
    : path.join(ROOT, "public", "dkb-index", SHARD_SOURCE);
  if (args.embed === "stub") {
    console.warn(
      "[m21-5-shard] WARNING: --embed=stub produces FAKE vectors — pipeline testing only, never commit as a real shard.",
    );
  }
  const embed =
    args.embed === "stub" ? async (t) => stubEmbed(t) : await realEmbedder();
  const fallbackFetchedAt = records[0]?.fetched_at || new Date(0).toISOString();

  console.log(
    `[m21-5-shard] ${records.length} articles → ${entries.length} chunks → ${path.relative(ROOT, outDir)}`,
  );
  const meta = await buildShard({
    source: SHARD_SOURCE,
    entries,
    embed,
    outDir,
    fallbackFetchedAt,
  });
  console.log(
    `[m21-5-shard] DONE — ${meta.entry_count} chunks in ${meta.parts.length} part(s); ` +
      `skipped ${meta.skipped.empty_content} empty + ${meta.skipped.missing_url} url-less`,
  );
  console.log(
    "[m21-5-shard] NEXT: node scripts/dkb-sharding/build-registry.mjs to register the shard",
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`[m21-5-shard] FAILED: ${e.message}`);
    process.exit(1);
  });
}
