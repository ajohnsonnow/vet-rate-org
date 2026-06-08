#!/usr/bin/env node
/**
 * run-all.mjs — orchestrate the full legal-ingestion pipeline end-to-end.
 *
 * Steps:
 *   1. Fetch every source → .work/{source}.jsonl
 *   2. Chunk every .work/*.jsonl → public/legal-index/{version}/chunks/
 *   3. Embed every chunk → public/legal-index/{version}/vectors/
 *   4. Diff against previous version → write changelog to stdout
 *
 * The weekly cron action (.github/workflows/legal-ingestion.yml) calls
 * this script, captures the diff output, and opens a PR titled
 * `chore(legal): refresh index → v{x.y.z}` when changes are detected.
 *
 * Usage:
 *   node scripts/legal-ingestion/run-all.mjs                  # auto-version
 *   node scripts/legal-ingestion/run-all.mjs --version v0.2.0
 *   node scripts/legal-ingestion/run-all.mjs --skip-fedcir    # partial run
 */

import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const INDEX_ROOT = path.join(ROOT, "public", "legal-index");

const FETCHERS = [
  { name: "ecfr", script: "fetch-ecfr.mjs" },
  { name: "m21-1", script: "fetch-m21-1.mjs" },
  { name: "cavc", script: "fetch-cavc.mjs" },
  { name: "fedcir", script: "fetch-fedcir.mjs" },
];

function parseArgs(argv) {
  const out = { skip: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--version") out.version = argv[++i];
    else if (a.startsWith("--version=")) out.version = a.split("=")[1];
    else if (a.startsWith("--skip-")) out.skip.add(a.replace("--skip-", ""));
  }
  return out;
}

function autoVersion() {
  // v0.<minor>.0 where minor = count of existing v* versions
  if (!existsSync(INDEX_ROOT)) return "v0.1.0";
  const existing = readdirSync(INDEX_ROOT).filter((d) =>
    /^v\d+\.\d+\.\d+$/.test(d),
  ).sort();
  if (existing.length === 0) return "v0.1.0";
  const latest = existing[existing.length - 1];
  const m = /^v(\d+)\.(\d+)\.(\d+)$/.exec(latest);
  if (!m) return "v0.1.0";
  return `v${m[1]}.${Number.parseInt(m[2], 10) + 1}.0`;
}

function runStep(label, scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    console.log(`\n========== ${label} ==========`);
    const child = spawn( // nosemgrep: local.detect-child-process-strict
      process.execPath,
      [scriptPath, ...args],
      { stdio: "inherit", cwd: ROOT },
    );
    child.on("close", (code) => {
      if (code === 0 || code === 2) resolve(code);
      else reject(new Error(`${label} exited ${code}`));
    });
    child.on("error", reject);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const version = args.version || autoVersion();

  console.log(`[run-all] target index version: ${version}`);

  // 1. Fetchers
  for (const f of FETCHERS) {
    if (args.skip.has(f.name)) {
      console.log(`[run-all] SKIP fetcher ${f.name}`);
      continue;
    }
    try {
      await runStep(
        `FETCH ${f.name}`,
        path.join(__dirname, f.script),
      );
    } catch (e) {
      console.error(`[run-all] fetcher ${f.name} failed: ${e.message}`);
      // Continue with other sources — the workflow opens a 'stale' issue.
    }
  }

  // 2. Chunk
  await runStep("CHUNK", path.join(__dirname, "chunk.mjs"), [version]);

  // 3. Embed
  await runStep("EMBED", path.join(__dirname, "embed.mjs"), [version]);

  // 4. Diff against the previous version (if any)
  const exit = await runStep(
    "DIFF",
    path.join(__dirname, "diff.mjs"),
    [`--to=${version}`],
  );

  console.log(`\n[run-all] DONE — index ${version} ready under public/legal-index/`);
  // Bubble the diff exit code so CI can branch on "no-op vs changes".
  process.exit(exit);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`[run-all] FAILED: ${e.message}`);
    process.exit(1);
  });
}
