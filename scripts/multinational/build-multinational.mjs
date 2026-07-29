#!/usr/bin/env node
/**
 * build-multinational.mjs — S38 ingestion orchestrator (mirrors S36's builder).
 *
 * Reads every scripts/multinational/sources/<category>.research.json, normalizes
 * it to the canonical schema, validates it, and writes the shipped per-category
 * file src/data/multinational/<category>.json. Fails loudly (non-zero exit) if
 * any file fails validation — a "verified" provision missing its sourceUrl is a
 * build error, never a silent ship.
 *
 * Usage:
 *   node scripts/multinational/build-multinational.mjs                       # all
 *   node scripts/multinational/build-multinational.mjs foreign_medical_program
 *
 * lastVerified stamps come from each research file (research_date) or, absent
 * that, must be passed via MULTINATIONAL_DATE=YYYY-MM-DD (no Date.now here so the
 * build is reproducible).
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  mkdirSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { format } from "prettier";

import { normalizeCategoryFile } from "./normalize.mjs";
import { validateCategoryFile } from "./schema.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const SOURCES = path.join(__dirname, "sources");
const OUT_DIR = path.join(ROOT, "src", "data", "multinational");

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function researchFiles(only) {
  if (!existsSync(SOURCES)) return [];
  return readdirSync(SOURCES)
    .filter((f) => f.endsWith(".research.json"))
    .filter(
      (f) => !only.length || only.includes(f.replace(/\.research\.json$/, "")),
    );
}

/**
 * Build one research file → validated canonical category file on disk. Returns a
 * report row on success, or null on any failure (message already logged). Output
 * is prettier-formatted so a rebuild stays format-clean and reproducible.
 */
async function buildOneCategory(file, envDate) {
  const raw = JSON.parse(readFileSync(path.join(SOURCES, file), "utf8"));
  const lastVerified = raw.research_date || envDate;
  if (!ISO_DATE.test(lastVerified || "")) {
    console.error(
      `[multinational] ${file}: no valid research_date and no MULTINATIONAL_DATE`,
    );
    return null;
  }

  const canonical = normalizeCategoryFile(raw, { lastVerified });
  const { valid, errors, counts } = validateCategoryFile(canonical);
  if (!valid) {
    console.error(`[multinational] ${canonical.category} INVALID:`);
    for (const e of errors) console.error(`    - ${e}`);
    return null;
  }

  const outPath = path.join(OUT_DIR, `${canonical.category}.json`);
  const json = await format(JSON.stringify(canonical), {
    parser: "json",
    filepath: outPath,
  });
  writeFileSync(outPath, json);
  return {
    category: canonical.category,
    ...counts,
    status: canonical.verificationStatus,
  };
}

async function main() {
  const only = process.argv.slice(2);
  const files = researchFiles(only);
  if (files.length === 0) {
    console.error(
      `[multinational] no research files in ${path.relative(ROOT, SOURCES)}` +
        (only.length ? ` matching ${only.join(", ")}` : ""),
    );
    process.exit(1);
  }

  const envDate = process.env.MULTINATIONAL_DATE;
  if (envDate && !ISO_DATE.test(envDate)) {
    console.error(`[multinational] MULTINATIONAL_DATE must be YYYY-MM-DD`);
    process.exit(1);
  }

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const report = [];
  let failed = 0;
  for (const file of files) {
    const row = await buildOneCategory(file, envDate);
    if (row) report.push(row);
    else failed++;
  }

  for (const r of report) {
    console.log(
      `  • ${r.category.padEnd(30)} ${String(r.provisions).padStart(2)} provisions ` +
        `(${r.verified} verified) — ${r.status}`,
    );
  }
  console.log(
    `[multinational] wrote ${report.length} category file(s); ${failed} failed`,
  );
  if (failed) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
