#!/usr/bin/env node
/**
 * Model watch: lists new open-weight models that fit what the app runs on
 * the device, so a person can evaluate them with the golden set.
 *
 *   node scripts/eval/model-watch.mjs [--out-dir <dir>]
 *   node scripts/eval/model-watch.mjs --update-snapshot
 *
 * Reads public, unauthenticated sources only (plain GETs). Exit codes:
 *   0  nothing new
 *   1  a source could not be fetched or parsed (named on stderr and in the report)
 *   2  new candidates to evaluate, or a newer runtime package
 *
 * --update-snapshot rewrites scripts/eval/model-watch-snapshot.json from a
 * full fetch after a person has reviewed the candidates; it refuses to write
 * when any source failed.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEntries, findCandidates } from "./lib/modelWatchClassify.js";
import {
  buildResult,
  renderMarkdown,
  renderSummary,
  runtimeComparisons,
} from "./lib/modelWatchReport.js";
import { gatherAll } from "./lib/modelWatchSources.js";

const REPO_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const SNAPSHOT_REL = "scripts/eval/model-watch-snapshot.json";
const DEFAULT_OUT_DIR = join(REPO_ROOT, "test-results/model-watch");
const USAGE =
  "usage: node scripts/eval/model-watch.mjs [--out-dir <dir>] [--snapshot <file>] [--update-snapshot]";

function parseArgs(argv) {
  const opts = {
    outDir: DEFAULT_OUT_DIR,
    snapshotPath: join(REPO_ROOT, SNAPSHOT_REL),
    updateSnapshot: false,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--update-snapshot") opts.updateSnapshot = true;
    else if (argv[i] === "--out-dir" && argv[i + 1])
      opts.outDir = resolve(argv[++i]);
    else if (argv[i] === "--snapshot" && argv[i + 1])
      opts.snapshotPath = resolve(argv[++i]);
    else throw new Error(`unknown argument: ${argv[i]}\n${USAGE}`);
  }
  return opts;
}

function printErrors(errors) {
  for (const e of errors)
    console.error(`model-watch: source failed: ${e.source}: ${e.message}`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const now = Date.now();
  const gathered = await gatherAll({
    fetchImpl: fetch,
    readText: (rel) =>
      readFileSync(
        rel === SNAPSHOT_REL ? opts.snapshotPath : join(REPO_ROOT, rel),
        "utf8",
      ),
    now,
  });

  const entries = buildEntries(gathered.webllm, gathered.hf);

  if (opts.updateSnapshot) {
    // The snapshot being absent or unreadable is what this run repairs.
    const blocking = gathered.errors.filter((e) => e.source !== "snapshot");
    if (blocking.length) {
      printErrors(blocking);
      console.error("model-watch: snapshot not written");
      return 1;
    }
    const ids = entries.map((e) => e.id).sort();
    const snapshot = {
      schema: 1,
      updatedAt: new Date(now).toISOString(),
      models: ids,
    };
    writeFileSync(opts.snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
    console.log(`model-watch: snapshot written with ${ids.length} model ids`);
    return 0;
  }

  const classification = findCandidates({
    entries,
    snapshotIds: gathered.snapshotIds,
    appModels: gathered.appModels,
  });
  const result = buildResult({
    now,
    gathered,
    classification,
    runtimePackages: runtimeComparisons(gathered.declared, gathered.latest),
  });

  mkdirSync(opts.outDir, { recursive: true });
  writeFileSync(
    join(opts.outDir, "model-watch-report.md"),
    renderMarkdown(result),
  );
  writeFileSync(
    join(opts.outDir, "model-watch-report.json"),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  printErrors(result.sourceErrors);
  console.log(renderSummary(result));
  return result.exitCode;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`model-watch: ${err.message}`);
    process.exit(1);
  },
);
