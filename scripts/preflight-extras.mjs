#!/usr/bin/env node
/**
 * Preflight extras — optional, ad-hoc checks that do NOT install devDeps.
 *
 * Runs each via `npx --yes` so a clean tree never pays the install cost
 * unless these checks are invoked. Designed to be CI-friendly:
 *   - exits 0 on all checks pass
 *   - exits 1 on any check failing (use --soft to downgrade to warnings)
 *
 * Usage:
 *   node scripts/preflight-extras.mjs                # run all (markdown, knip, licenses)
 *   node scripts/preflight-extras.mjs --only=knip    # run a single check
 *   node scripts/preflight-extras.mjs --soft         # never fail the run; just warn
 *
 * See docs/PREFLIGHT_EXTRAS.md for rationale.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const argv = process.argv.slice(2);
const SOFT = argv.includes("--soft");
const ONLY = (argv.find((a) => a.startsWith("--only=")) || "").split("=")[1];

const NPX = process.platform === "win32" ? "npx.cmd" : "npx";

const tasks = [
  {
    id: "markdown",
    label: "markdownlint",
    cmd: NPX,
    args: [
      "--yes",
      "markdownlint-cli2@^0.18.0",
      "**/*.md",
      "#node_modules",
      "#dist",
      "#coverage",
      "#playwright-report",
    ],
    requires: () => existsSync(path.join(ROOT, ".markdownlint.json")),
    requiresMessage: ".markdownlint.json missing — skip.",
  },
  {
    id: "knip",
    label: "knip (dead-code)",
    cmd: NPX,
    args: ["--yes", "knip@^5.0.0", "--reporter", "compact", "--no-progress"],
    requires: () => existsSync(path.join(ROOT, "knip.json")),
    requiresMessage: "knip.json missing — skip.",
  },
  {
    id: "licenses",
    label: "license-checker (prod deps)",
    cmd: NPX,
    args: [
      "--yes",
      "license-checker-rseidelsohn@^4.4.2",
      "--production",
      "--summary",
      "--excludePrivatePackages",
    ],
    requires: () => existsSync(path.join(ROOT, "package.json")),
    requiresMessage: "package.json missing — impossible.",
  },
];

let exitCode = 0;
const results = [];

for (const task of tasks) {
  if (ONLY && task.id !== ONLY) continue;
  if (!task.requires()) {
    console.log(`[skip] ${task.label}: ${task.requiresMessage}`);
    results.push({ id: task.id, status: "skip" });
    continue;
  }

  console.log(`\n[run] ${task.label}`);
  const r = spawnSync(task.cmd, task.args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (r.status === 0) {
    console.log(`[ok]  ${task.label}`);
    results.push({ id: task.id, status: "ok" });
  } else {
    const symbol = SOFT ? "[warn]" : "[fail]";
    console.log(`${symbol} ${task.label} exited ${r.status}`);
    results.push({ id: task.id, status: SOFT ? "warn" : "fail" });
    if (!SOFT) exitCode = 1;
  }
}

console.log("\nSummary:");
for (const r of results) console.log(`  ${r.status.padEnd(5)} ${r.id}`);

process.exit(exitCode);
