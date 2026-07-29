#!/usr/bin/env node
/**
 * build-bva-shard.mjs — build the full-corpus BVA shard (S32).
 *
 * Reads every source:"bva" entry from the offline corpus
 * (llm-compiler/knowledge-base/diamond_knowledge_base.json — 116,209 entries),
 * tags each with its authority metadata (bvaAuthorityTagging: non-precedential
 * per 38 CFR § 20.1303 + a persuasive citation_weight), and emits the shard at
 * public/dkb-index/bva/ (administrative_precedent tier).
 *
 * The tag rides into every chunk via entry.extra (build-shard.mjs passes it
 * through), so retrieval (dkbShardedRag → knowledgeQuery.queryCorpus, S30)
 * returns each BVA chunk already carrying precedential:false / binding:false /
 * citation_weight / caveat — the answerer can rank and caveat without ever
 * presenting a Board decision as binding authority.
 *
 * 116,209 entries exceed the 68,266-chunk per-part budget, so buildShard splits
 * the shard into ~2 parts; the runtime streams one part at a time (S29 memory
 * model), so even this ~45 MB shard is queried without holding it all at once.
 *
 * Usage:
 *   node scripts/dkb-sharding/build-bva-shard.mjs                          # real embed → public/dkb-index/bva (heavy)
 *   node scripts/dkb-sharding/build-bva-shard.mjs --limit=200 --embed=stub --out=<dir>   # bounded pipeline test
 *   node scripts/dkb-sharding/build-registry.mjs                           # then refresh the registry
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildShard, stubEmbed } from "./build-shard.mjs";
import { tagBvaEntry } from "../../src/services/bvaAuthorityTagging.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const CORPUS_PATH = path.join(
  ROOT,
  "llm-compiler",
  "knowledge-base",
  "diamond_knowledge_base.json",
);
const SHARD_SOURCE = "bva"; // SHARD_TIER["bva"] → "administrative_precedent"

function parseArgs(argv) {
  const out = { embed: "real", limit: 0 };
  for (const a of argv) {
    if (a.startsWith("--embed=")) out.embed = a.split("=")[1];
    else if (a.startsWith("--limit=")) out.limit = Number(a.split("=")[1]) || 0;
    else if (a.startsWith("--out=")) out.out = a.split("=")[1];
  }
  return out;
}

/** Real bge-small-en-v1.5 embedder (same model/normalization as embed.mjs). */
async function realEmbedder() {
  const { pipeline } = await import("@huggingface/transformers");
  console.log("[bva-shard] loading bge-small-en-v1.5…");
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
    throw new Error(`build-bva-shard: corpus not found at ${CORPUS_PATH}`);
  }

  console.log("[bva-shard] reading corpus…");
  const corpus = JSON.parse(readFileSync(CORPUS_PATH, "utf8"));
  const fallbackFetchedAt =
    corpus.metadata?.generated || new Date(0).toISOString();
  let bva = (corpus.entries || []).filter((e) => e.source === SHARD_SOURCE);
  if (bva.length === 0) {
    throw new Error('build-bva-shard: 0 entries with source="bva"');
  }
  if (args.limit > 0) bva = bva.slice(0, args.limit);

  // Attach the authority tag to each entry as `extra` — build-shard.mjs spreads
  // it onto the chunk. Non-precedential/binding fields are invariant; weight and
  // descriptive fields are per-entry.
  const entries = bva.map((e) => ({ ...e, extra: tagBvaEntry(e) }));

  const outDir = args.out
    ? path.join(args.out, SHARD_SOURCE)
    : path.join(ROOT, "public", "dkb-index", SHARD_SOURCE);
  if (args.embed === "stub") {
    console.warn(
      "[bva-shard] WARNING: --embed=stub produces FAKE vectors — pipeline testing only, never commit as a real shard.",
    );
  }
  const embed =
    args.embed === "stub" ? async (t) => stubEmbed(t) : await realEmbedder();

  console.log(
    `[bva-shard] tagging + embedding ${entries.length} BVA entries → ${path.relative(ROOT, outDir)}`,
  );
  const meta = await buildShard({
    source: SHARD_SOURCE,
    entries,
    embed,
    outDir,
    fallbackFetchedAt,
  });
  console.log(
    `[bva-shard] DONE — ${meta.entry_count} chunks in ${meta.parts.length} part(s); ` +
      `skipped ${meta.skipped.empty_content} empty + ${meta.skipped.missing_url} url-less`,
  );
  console.log(
    "[bva-shard] NEXT: node scripts/dkb-sharding/build-registry.mjs to register the shard",
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`[bva-shard] FAILED: ${e.message}`);
    process.exit(1);
  });
}
