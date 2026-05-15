#!/usr/bin/env node
/**
 * chunk.mjs — split sanitized legal records into ≤512-token windows with
 * 50-token overlap. Preserves citation + source metadata on every chunk.
 *
 * Token estimation: word count × 1.3 (empirical for English legal text).
 * Exact tokenization is the embedder's job; the chunker is approximate.
 *
 * Input:  scripts/legal-ingestion/.work/{source}.jsonl    (from fetchers)
 * Output: public/legal-index/{version}/chunks/{source}.jsonl
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { contentHash } from "./sanitize-html.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const WORK_DIR = path.join(__dirname, ".work");

const CHUNK_TOKEN_TARGET = 512;
const CHUNK_OVERLAP_TOKENS = 50;
const TOKEN_PER_WORD = 1.3;
const WORDS_PER_CHUNK = Math.floor(CHUNK_TOKEN_TARGET / TOKEN_PER_WORD);
const OVERLAP_WORDS = Math.floor(CHUNK_OVERLAP_TOKENS / TOKEN_PER_WORD);

/**
 * Split a single record into 1+ chunks. Preserves citation + source on each.
 * @param {Object} record
 * @returns {Promise<Array<Object>>}
 */
export async function chunkRecord(record) {
  if (!record || !record.body) return [];
  const words = record.body.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks = [];
  let chunkIdx = 0;
  let i = 0;

  while (i < words.length) {
    const end = Math.min(i + WORDS_PER_CHUNK, words.length);
    const text = words.slice(i, end).join(" ");
    const chunkId =
      `${record.source}/${record.citation || "uncited"}/${chunkIdx}`.replace(
        /[\s/]+/g,
        "_",
      );
    chunks.push({
      id: chunkId,
      source: record.source,
      jurisdiction: record.jurisdiction,
      citation: record.citation,
      title: record.title,
      text,
      fetched_at: record.fetched_at,
      source_url: record.source_url,
      content_hash: await contentHash(text),
      // back-reference to the parent record for diff-on-update logic
      parent_hash: record.content_hash,
    });
    if (end >= words.length) break;
    i = end - OVERLAP_WORDS;
    chunkIdx += 1;
  }

  return chunks;
}

/**
 * Chunk all JSONL files in WORK_DIR → public/legal-index/<version>/chunks/.
 * @param {Object} options
 * @param {string} options.version — e.g. "v0.1.0"
 * @returns {Promise<{totalChunks: number, perSource: Record<string, number>}>}
 */
export async function chunkAll({ version }) {
  if (!version) throw new Error("chunkAll: version required");
  const outDir = path.join(ROOT, "public", "legal-index", version, "chunks");
  mkdirSync(outDir, { recursive: true });

  if (!existsSync(WORK_DIR)) {
    throw new Error(
      `Work dir ${WORK_DIR} missing — run fetchers first`,
    );
  }

  const files = readdirSync(WORK_DIR).filter((f) => f.endsWith(".jsonl"));
  let totalChunks = 0;
  const perSource = {};

  for (const file of files) {
    const fp = path.join(WORK_DIR, file);
    const lines = readFileSync(fp, "utf8").split("\n").filter(Boolean);
    const outLines = [];
    for (const line of lines) {
      try {
        const record = JSON.parse(line);
        const chunks = await chunkRecord(record);
        for (const c of chunks) outLines.push(JSON.stringify(c));
      } catch (e) {
        console.error(`[chunk] failed to parse line in ${file}: ${e.message}`);
        process.exit(1);
      }
    }
    const outFile = path.join(outDir, file);
    writeFileSync(outFile, outLines.join("\n") + (outLines.length ? "\n" : ""));
    perSource[file.replace(".jsonl", "")] = outLines.length;
    totalChunks += outLines.length;
    console.log(`[chunk] ${file}: ${lines.length} records → ${outLines.length} chunks`);
  }

  return { totalChunks, perSource };
}

// CLI entry — only when invoked directly.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const version = process.argv[2] || "v0.0.0";
  chunkAll({ version })
    .then((r) =>
      console.log(`[chunk] DONE — ${r.totalChunks} total chunks`),
    )
    .catch((e) => {
      console.error(`[chunk] FAILED: ${e.message}`);
      process.exit(1);
    });
}
