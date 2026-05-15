#!/usr/bin/env node
/**
 * diff.mjs — produce a human-readable diff between two legal-index versions.
 *
 * Output goes to stdout (and is consumed by the weekly cron action to
 * populate the auto-PR body when changes are detected).
 *
 * Usage:
 *   node scripts/legal-ingestion/diff.mjs --from v0.1.0 --to v0.2.0
 *   node scripts/legal-ingestion/diff.mjs --against v0.1.0     (--to defaults to newest)
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const INDEX_ROOT = path.join(ROOT, "public", "legal-index");

function listVersions() {
  if (!existsSync(INDEX_ROOT)) return [];
  return readdirSync(INDEX_ROOT)
    .filter((d) => /^v\d+\.\d+\.\d+$/.test(d))
    .sort();
}

function loadChunks(version) {
  const chunksDir = path.join(INDEX_ROOT, version, "chunks");
  if (!existsSync(chunksDir)) return [];
  const out = [];
  for (const file of readdirSync(chunksDir).filter((f) => f.endsWith(".jsonl"))) {
    const lines = readFileSync(path.join(chunksDir, file), "utf8")
      .split("\n")
      .filter(Boolean);
    for (const line of lines) out.push(JSON.parse(line));
  }
  return out;
}

function indexById(chunks) {
  const m = new Map();
  for (const c of chunks) m.set(c.id, c);
  return m;
}

function summarize(chunks) {
  const bySource = {};
  for (const c of chunks) bySource[c.source] = (bySource[c.source] || 0) + 1;
  return bySource;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--from=")) out.from = a.split("=")[1];
    else if (a.startsWith("--to=")) out.to = a.split("=")[1];
    else if (a.startsWith("--against=")) out.from = a.split("=")[1];
    else if (a === "--from") out.from = argv[++i];
    else if (a === "--to") out.to = argv[++i];
    else if (a === "--against") out.from = argv[++i];
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const versions = listVersions();
  if (versions.length === 0) {
    console.error("[diff] no legal-index versions found");
    process.exit(1);
  }
  const to = args.to || versions[versions.length - 1];
  const from = args.from || (versions.length > 1 ? versions[versions.length - 2] : versions[0]);

  if (from === to) {
    console.log(`No diff: from=${from}, to=${to} are the same version.`);
    return;
  }

  const fromChunks = loadChunks(from);
  const toChunks = loadChunks(to);
  const fromIdx = indexById(fromChunks);
  const toIdx = indexById(toChunks);

  const added = [];
  const removed = [];
  const changed = [];

  for (const [id, chunk] of toIdx) {
    if (!fromIdx.has(id)) added.push(chunk);
    else if (fromIdx.get(id).content_hash !== chunk.content_hash) changed.push(chunk);
  }
  for (const [id, chunk] of fromIdx) {
    if (!toIdx.has(id)) removed.push(chunk);
  }

  console.log(`# Legal-index diff: ${from} → ${to}\n`);
  console.log(`- **Added**:   ${added.length} chunk(s)`);
  console.log(`- **Removed**: ${removed.length} chunk(s)`);
  console.log(`- **Changed**: ${changed.length} chunk(s) (content_hash mismatch)\n`);

  console.log(`## Per-source totals\n`);
  console.log(`| source | ${from} | ${to} | delta |`);
  console.log(`|---|---|---|---|`);
  const fromBy = summarize(fromChunks);
  const toBy = summarize(toChunks);
  const sources = new Set([...Object.keys(fromBy), ...Object.keys(toBy)]);
  for (const src of sources) {
    const f = fromBy[src] || 0;
    const t = toBy[src] || 0;
    const sign = t - f >= 0 ? "+" : "";
    console.log(`| ${src} | ${f} | ${t} | ${sign}${t - f} |`);
  }
  console.log("");

  if (added.length > 0) {
    console.log(`## Added (first 25)\n`);
    for (const c of added.slice(0, 25)) {
      console.log(`- \`${c.citation || c.id}\` — ${c.title || "(no title)"}`);
    }
    console.log("");
  }
  if (changed.length > 0) {
    console.log(`## Changed (first 25)\n`);
    for (const c of changed.slice(0, 25)) {
      console.log(`- \`${c.citation || c.id}\` — ${c.title || "(no title)"}`);
    }
    console.log("");
  }
  if (removed.length > 0) {
    console.log(`## Removed (first 25)\n`);
    for (const c of removed.slice(0, 25)) {
      console.log(`- \`${c.citation || c.id}\` — ${c.title || "(no title)"}`);
    }
  }

  // Exit code = 0 if no change, 2 if changes detected, 1 on error.
  const noop = added.length === 0 && removed.length === 0 && changed.length === 0;
  process.exit(noop ? 0 : 2);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (e) {
    console.error(`[diff] FAILED: ${e.message}`);
    process.exit(1);
  }
}
