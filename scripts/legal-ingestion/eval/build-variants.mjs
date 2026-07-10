#!/usr/bin/env node
/**
 * build-variants.mjs — build candidate chunking-strategy indexes into scratch
 * dirs so run-eval.mjs --compare can A/B them without touching the shipped
 * public/legal-index/ bundle.
 *
 * Implements the NVIDIA chunking-strategy sweep (page-level / 256 / 512 / 1024
 * token windows, 10% vs 15% overlap) as self-contained variant chunkers —
 * deliberately NOT importing scripts/legal-ingestion/chunk.mjs, so this
 * harness keeps comparing against a stable "current production" shape even
 * as chunk.mjs itself evolves in later sprints (S19+).
 *
 * "section-level" is an alias of "page-level" for this corpus: each eCFR
 * fetch record already IS one §-section (the natural page/section unit for
 * structured regulatory HTML) — there is no separate page boundary to detect.
 * True intra-section structural splitting (tables-as-atomic-units, splitting
 * only oversized sections on paragraph boundaries) lands in S19.
 *
 * Input:  scripts/legal-ingestion/.work/{source}.jsonl (fetcher output —
 *         run `node scripts/legal-ingestion/fetch-ecfr.mjs` first if missing)
 * Output: scripts/legal-ingestion/eval/.variants/{name}/{chunks,vectors}/*,
 *         manifest.json — same on-disk shape run-eval.mjs already reads.
 *
 * Usage:
 *   node scripts/legal-ingestion/eval/build-variants.mjs
 *   node scripts/legal-ingestion/eval/build-variants.mjs --only page-level,1024tok-15pct
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { contentHash } from "../sanitize-html.mjs";
import { chunkRecord } from "../chunk.mjs";
import { loadPipeline, embedSource, buildManifest } from "../embed.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..");
const WORK_DIR = path.join(ROOT, "scripts", "legal-ingestion", ".work");
const VARIANTS_DIR = path.join(__dirname, ".variants");
const TOKEN_PER_WORD = 1.3;

/**
 * Build the canonical chunk-record schema (matches chunk.mjs's output shape)
 * for a given slice of a record's body text.
 */
async function makeChunk(record, text, idx) {
  const chunkId =
    `${record.source}/${record.citation || "uncited"}/${idx}`.replace(
      /[\s/]+/g,
      "_",
    );
  return {
    id: chunkId,
    source: record.source,
    jurisdiction: record.jurisdiction,
    citation: record.citation,
    title: record.title,
    text,
    fetched_at: record.fetched_at,
    source_url: record.source_url,
    content_hash: await contentHash(text),
    parent_hash: record.content_hash,
  };
}

/** Whole-record chunk — no windowing. The page/section-level variant. */
async function pageLevelChunk(record) {
  if (!record.body) return [];
  return [await makeChunk(record, record.body, 0)];
}

/** Sliding word-count window approximating a token target + overlap. */
function windowChunk(tokenTarget, overlapTokens) {
  const wordsPerChunk = Math.floor(tokenTarget / TOKEN_PER_WORD);
  const overlapWords = Math.floor(overlapTokens / TOKEN_PER_WORD);
  return async (record) => {
    if (!record.body) return [];
    const words = record.body.split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    const chunks = [];
    let idx = 0;
    let i = 0;
    while (i < words.length) {
      const end = Math.min(i + wordsPerChunk, words.length);
      chunks.push(await makeChunk(record, words.slice(i, end).join(" "), idx));
      if (end >= words.length) break;
      i = end - overlapWords;
      idx += 1;
    }
    return chunks;
  };
}

// name -> async (record) => chunk[]
export const VARIANTS = {
  "page-level": pageLevelChunk,
  "section-level": pageLevelChunk, // see header note — alias until S19
  "256tok-10pct": windowChunk(256, 26),
  "512tok-10pct": windowChunk(512, 50), // pre-S19 production chunk.mjs shape
  "512tok-15pct": windowChunk(512, 77),
  "1024tok-15pct": windowChunk(1024, 154),
  // S19: the ACTUAL production chunker — table-atomic + paragraph-packed prose.
  // Reads the same .work records the others do, so this validates the real
  // sanitize-html.mjs + chunk.mjs code path (not a synthetic reimplementation).
  structural: chunkRecord,
};

function loadWorkRecords(source) {
  const fp = path.join(WORK_DIR, `${source}.jsonl`);
  if (!existsSync(fp)) {
    throw new Error(
      `${fp} missing — run \`node scripts/legal-ingestion/fetch-ecfr.mjs\` first`,
    );
  }
  return readFileSync(fp, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

async function buildVariant(name, chunkFn, { sources, embedder }) {
  const base = path.join(VARIANTS_DIR, name);
  const chunksDir = path.join(base, "chunks");
  const vectorsDir = path.join(base, "vectors");
  mkdirSync(chunksDir, { recursive: true });
  mkdirSync(vectorsDir, { recursive: true });

  const perSource = {};
  let totalChunks = 0;
  for (const source of sources) {
    const records = loadWorkRecords(source);
    const outLines = [];
    for (const record of records) {
      const chunks = await chunkFn(record);
      for (const c of chunks) outLines.push(JSON.stringify(c));
    }
    const chunkFile = path.join(chunksDir, `${source}.jsonl`);
    writeFileSync(chunkFile, outLines.join("\n") + (outLines.length ? "\n" : ""));

    const vectorFile = path.join(vectorsDir, `${source}.bin`);
    const r = await embedSource({ chunkFile, vectorFile, embedder });
    perSource[source] = r.count;
    totalChunks += r.count;
  }

  const manifest = buildManifest({ version: name, perSource, totalChunks });
  writeFileSync(
    path.join(base, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  console.log(`[build-variants] ${name}: ${totalChunks} chunks`);
  return { name, totalChunks, perSource };
}

function parseArgs(argv) {
  const args = { only: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--only") args.only = argv[++i].split(",").map((s) => s.trim());
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const names = args.only ?? Object.keys(VARIANTS);
  for (const name of names) {
    if (!VARIANTS[name]) {
      throw new Error(
        `Unknown variant "${name}" — options: ${Object.keys(VARIANTS).join(", ")}`,
      );
    }
  }

  const sources = readdirSync(WORK_DIR)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => f.replace(".jsonl", ""));
  if (sources.length === 0) {
    throw new Error(`No fetcher output found in ${WORK_DIR}`);
  }

  const embedder = await loadPipeline();
  const results = [];
  for (const name of names) {
    results.push(await buildVariant(name, VARIANTS[name], { sources, embedder }));
  }
  console.log(`[build-variants] DONE — built ${results.length} variant(s) under ${VARIANTS_DIR}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`[build-variants] FAILED: ${e.message}`);
    process.exit(1);
  });
}
