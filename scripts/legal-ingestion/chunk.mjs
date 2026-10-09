#!/usr/bin/env node
/**
 * chunk.mjs — structure-aware chunker for sanitized legal records (S19).
 *
 * Splits on document structure rather than blind word windows:
 *   • Markdown tables (emitted by sanitize-html.mjs) are ATOMIC — each table
 *     becomes exactly one chunk and is never split, however large. Per the
 *     NVIDIA chunking study, tables/charts must be retrieved as whole units.
 *   • Prose is packed on paragraph / sub-paragraph boundaries (the newline
 *     structure sanitize-html.mjs preserves) up to a ~512-token budget, so a
 *     chunk never ends mid-sentence.
 *   • Only a single prose paragraph that alone exceeds the budget falls back to
 *     word-window splitting, with ~15% overlap (the study's best-performing
 *     overlap, ahead of 10% and 20%).
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
// ~15% of 512 — the NVIDIA sweep found 15% overlap beat 10% and 20%.
const CHUNK_OVERLAP_TOKENS = 77;
const TOKEN_PER_WORD = 1.3;
const WORDS_PER_CHUNK = Math.floor(CHUNK_TOKEN_TARGET / TOKEN_PER_WORD);
const OVERLAP_WORDS = Math.floor(CHUNK_OVERLAP_TOKENS / TOKEN_PER_WORD);

const wordCount = (text) => (text.match(/\S+/g) || []).length;
const isTableLine = (line) => line.trimStart().startsWith("|");

/**
 * Segment a sanitized body into ordered table / prose blocks. sanitize-html.mjs
 * fences each table and each paragraph with a blank line, so blocks split on
 * blank lines. A block whose every line is a Markdown table line (≥2 of them,
 * i.e. a header row plus its `|---|` separator) is a table; everything else is
 * prose. A lone `|` line stays prose and can't be mistaken for a table.
 *
 * @param {string} body
 * @returns {Array<{ type: "table" | "prose", text: string }>}
 */
export function segmentBody(body) {
  const blocks = [];
  for (const raw of body.split(/\n{2,}/)) {
    const text = raw.trim();
    if (!text) continue;
    const lines = text.split("\n");
    const isTable = lines.length >= 2 && lines.every(isTableLine);
    blocks.push({ type: isTable ? "table" : "prose", text });
  }
  return blocks;
}

/**
 * Word-window fallback for a single prose paragraph that alone exceeds the
 * chunk budget. ~15% overlap between adjacent windows.
 * @param {string} paragraph
 * @returns {string[]}
 */
function windowOversizedParagraph(paragraph) {
  const words = paragraph.match(/\S+/g) || [];
  const out = [];
  let i = 0;
  while (i < words.length) {
    const end = Math.min(i + WORDS_PER_CHUNK, words.length);
    out.push(words.slice(i, end).join(" "));
    if (end >= words.length) break;
    i = end - OVERLAP_WORDS;
  }
  return out;
}

/**
 * Pack prose paragraphs (newline-separated) greedily up to the token budget,
 * never splitting a paragraph except the oversized-paragraph fallback above.
 * @param {string} prose
 * @returns {string[]}
 */
export function packProse(prose) {
  const paragraphs = prose
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks = [];
  let current = [];
  let currentWords = 0;
  const flush = () => {
    if (current.length) {
      chunks.push(current.join("\n\n"));
      current = [];
      currentWords = 0;
    }
  };
  for (const para of paragraphs) {
    const w = wordCount(para);
    if (w > WORDS_PER_CHUNK) {
      flush();
      for (const win of windowOversizedParagraph(para)) chunks.push(win);
      continue;
    }
    if (currentWords + w > WORDS_PER_CHUNK && current.length) flush();
    current.push(para);
    currentWords += w;
  }
  flush();
  return chunks;
}

async function makeChunk(record, text, chunkIdx) {
  const chunkId =
    `${record.source}/${record.citation || "uncited"}/${chunkIdx}`.replace(
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
    // back-reference to the parent record for diff-on-update logic
    parent_hash: record.content_hash,
  };
}

/**
 * Split a single record into 1+ chunks. Tables are atomic; prose is packed on
 * paragraph boundaries. Preserves citation + source metadata on each chunk.
 * @param {Object} record
 * @returns {Promise<Array<Object>>}
 */
export async function chunkRecord(record) {
  if (!record || !record.body) return [];
  const blocks = segmentBody(record.body);
  if (blocks.length === 0) return [];

  const chunks = [];
  let chunkIdx = 0;
  let prose = [];
  const flushProse = async () => {
    if (prose.length === 0) return;
    for (const text of packProse(prose.join("\n"))) {
      chunks.push(await makeChunk(record, text, chunkIdx));
      chunkIdx += 1;
    }
    prose = [];
  };
  for (const block of blocks) {
    if (block.type === "table") {
      await flushProse();
      chunks.push(await makeChunk(record, block.text, chunkIdx));
      chunkIdx += 1;
    } else {
      prose.push(block.text);
    }
  }
  await flushProse();
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
