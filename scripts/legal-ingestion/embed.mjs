#!/usr/bin/env node
/**
 * embed.mjs — produce Q8-quantized embeddings for every chunk written by
 * chunk.mjs.
 *
 * Model: bge-small-en-v1.5 (384-dim) via @huggingface/transformers — already
 * a project dep. Q8 quantization brings the per-vector cost to 384 bytes,
 * keeping the lazy-loaded index bundle under the 25 MB target.
 *
 * Output:
 *   public/legal-index/{version}/vectors/{source}.bin       (raw Q8 vectors)
 *   public/legal-index/{version}/manifest.json              (index metadata)
 *
 * The manifest's `total_chunks` per source must match the chunks/{source}.jsonl
 * line count exactly. embed.mjs writes both atomically — if the embedder
 * throws partway, neither bin file nor manifest is written.
 *
 * NOTE: Running this requires the transformer model weights to be available
 * locally or fetchable from huggingface.co. First run will download ~30 MB.
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

const EMBEDDING_MODEL =
  process.env.EMBED_MODEL || "Xenova/bge-small-en-v1.5";
const EMBED_DIM = 384;

/**
 * Quantize a Float32Array to Int8 ([-1, 1] → [-127, 127]). Returns a
 * fresh Int8Array.
 *
 * @param {Float32Array} vec
 * @returns {Int8Array}
 */
export function quantizeQ8(vec) {
  const q = new Int8Array(vec.length);
  for (let i = 0; i < vec.length; i++) {
    const clamped = Math.max(-1, Math.min(1, vec[i]));
    q[i] = Math.round(clamped * 127);
  }
  return q;
}

/**
 * L2-normalize a Float32Array in place.
 * @param {Float32Array} vec
 */
function normalize(vec) {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i];
  const norm = Math.sqrt(sum) || 1;
  for (let i = 0; i < vec.length; i++) vec[i] = vec[i] / norm;
}

async function loadPipeline() {
  // Dynamic import so this script doesn't pay the cost when only chunking.
  const { pipeline } = await import("@huggingface/transformers");
  console.log(`[embed] loading model ${EMBEDDING_MODEL}…`);
  return pipeline("feature-extraction", EMBEDDING_MODEL, {
    pooling: "mean",
    normalize: false, // we normalize manually so the quantization range is consistent
  });
}

async function embedSource({ chunkFile, vectorFile, embedder }) {
  const lines = readFileSync(chunkFile, "utf8").split("\n").filter(Boolean);
  if (lines.length === 0) {
    console.log(`[embed] ${path.basename(chunkFile)}: 0 chunks, skipping`);
    return { count: 0 };
  }

  const buf = new Int8Array(lines.length * EMBED_DIM);
  for (let i = 0; i < lines.length; i++) {
    const chunk = JSON.parse(lines[i]);
    const output = await embedder(chunk.text);
    const flat = new Float32Array(output.data); // tensor → flat Float32
    normalize(flat);
    const q = quantizeQ8(flat);
    buf.set(q, i * EMBED_DIM);
    if (i > 0 && i % 100 === 0) {
      console.log(`[embed] ${path.basename(chunkFile)}: ${i}/${lines.length}`);
    }
  }

  writeFileSync(vectorFile, buf);
  console.log(
    `[embed] ${path.basename(chunkFile)}: wrote ${lines.length} vectors → ${path.basename(vectorFile)}`,
  );
  return { count: lines.length };
}

/**
 * Build a manifest.json describing the index version.
 */
function buildManifest({ version, perSource, totalChunks }) {
  return {
    version,
    fetched_at: new Date().toISOString(),
    embedding_model: EMBEDDING_MODEL,
    embedding_dim: EMBED_DIM,
    quantization: "int8",
    total_chunks: totalChunks,
    sources: perSource,
  };
}

async function main() {
  const version = process.argv[2] || "v0.0.0";
  const chunksDir = path.join(ROOT, "public", "legal-index", version, "chunks");
  const vectorsDir = path.join(
    ROOT,
    "public",
    "legal-index",
    version,
    "vectors",
  );

  if (!existsSync(chunksDir)) {
    throw new Error(
      `Chunks dir ${chunksDir} missing — run chunk.mjs first`,
    );
  }

  mkdirSync(vectorsDir, { recursive: true });

  const embedder = await loadPipeline();
  const files = readdirSync(chunksDir).filter((f) => f.endsWith(".jsonl"));
  const perSource = {};
  let totalChunks = 0;

  for (const file of files) {
    const source = file.replace(".jsonl", "");
    const r = await embedSource({
      chunkFile: path.join(chunksDir, file),
      vectorFile: path.join(vectorsDir, source + ".bin"),
      embedder,
    });
    perSource[source] = r.count;
    totalChunks += r.count;
  }

  const manifest = buildManifest({ version, perSource, totalChunks });
  writeFileSync(
    path.join(ROOT, "public", "legal-index", version, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );

  console.log(`[embed] DONE — total ${totalChunks} chunks across ${files.length} sources`);
  console.log(`[embed] manifest: public/legal-index/${version}/manifest.json`);
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}`) {
  main().catch((e) => {
    console.error(`[embed] FAILED: ${e.message}`);
    process.exit(1);
  });
}

export { loadPipeline, embedSource, buildManifest };
