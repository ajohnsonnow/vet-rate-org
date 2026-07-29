#!/usr/bin/env node
/**
 * build-state-benefits.mjs — S36 ingestion orchestrator.
 *
 * Reads every scripts/state-benefits/sources/<code>.research.json, normalizes it
 * to the canonical schema, validates it, and writes the shipped per-state file
 * src/data/states/<code>.json. Fails loudly (non-zero exit) if any file fails
 * validation — a "verified" benefit missing its sourceUrl/citation is a build
 * error, never a silent ship.
 *
 * Usage:
 *   node scripts/state-benefits/build-state-benefits.mjs            # all states
 *   node scripts/state-benefits/build-state-benefits.mjs tx ca fl   # subset
 *
 * lastVerified stamps come from each research file (research_date) or, absent
 * that, must be passed via STATE_BENEFITS_DATE=YYYY-MM-DD (no Date.now here so
 * the build is reproducible).
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

import { normalizeStateFile } from "./normalize.mjs";
import { validateStateFile } from "./schema.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const SOURCES = path.join(__dirname, "sources");
const OUT_DIR = path.join(ROOT, "src", "data", "states");

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function researchFiles(only) {
  if (!existsSync(SOURCES)) return [];
  return readdirSync(SOURCES)
    .filter((f) => f.endsWith(".research.json"))
    .filter(
      (f) => !only.length || only.includes(f.split(".")[0].toLowerCase()),
    );
}

/**
 * Build one research file → validated canonical state file on disk. Returns a
 * report row on success, or null on any failure (message already logged). Output
 * is prettier-formatted (repo config via filepath) so a rebuild stays
 * format-clean and reproducible.
 */
async function buildOneState(file, envDate) {
  const raw = JSON.parse(readFileSync(path.join(SOURCES, file), "utf8"));
  const lastVerified = raw.research_date || envDate;
  if (!ISO_DATE.test(lastVerified || "")) {
    console.error(
      `[state-benefits] ${file}: no valid research_date and no STATE_BENEFITS_DATE`,
    );
    return null;
  }

  const canonical = normalizeStateFile(raw, { lastVerified });
  const { valid, errors, counts } = validateStateFile(canonical);
  if (!valid) {
    console.error(`[state-benefits] ${canonical.stateCode} INVALID:`);
    for (const e of errors) console.error(`    - ${e}`);
    return null;
  }

  const outPath = path.join(
    OUT_DIR,
    `${canonical.stateCode.toLowerCase()}.json`,
  );
  const json = await format(JSON.stringify(canonical), {
    parser: "json",
    filepath: outPath,
  });
  writeFileSync(outPath, json);
  return {
    code: canonical.stateCode,
    ...counts,
    status: canonical.verificationStatus,
  };
}

async function main() {
  const only = process.argv.slice(2).map((s) => s.toLowerCase());
  const files = researchFiles(only);
  if (files.length === 0) {
    console.error(
      `[state-benefits] no research files in ${path.relative(ROOT, SOURCES)}` +
        (only.length ? ` matching ${only.join(", ")}` : ""),
    );
    process.exit(1);
  }

  const envDate = process.env.STATE_BENEFITS_DATE;
  if (envDate && !ISO_DATE.test(envDate)) {
    console.error(`[state-benefits] STATE_BENEFITS_DATE must be YYYY-MM-DD`);
    process.exit(1);
  }

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const report = [];
  let failed = 0;
  for (const file of files) {
    const row = await buildOneState(file, envDate);
    if (row) report.push(row);
    else failed++;
  }

  for (const r of report) {
    console.log(
      `  • ${r.code.padEnd(4)} ${String(r.benefits).padStart(2)} benefits ` +
        `(${r.verified} verified) — ${r.status}`,
    );
  }
  console.log(
    `[state-benefits] wrote ${report.length} state file(s); ${failed} failed`,
  );
  if (failed) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
