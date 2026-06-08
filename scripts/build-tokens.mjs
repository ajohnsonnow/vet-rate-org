#!/usr/bin/env node
/**
 * Build design tokens — Style Dictionary v4, via npx-on-demand.
 *
 * Reads tokens/source/*.json and emits:
 *   src/generated/design-tokens.css   — CSS custom properties (runtime theming)
 *   src/generated/design-tokens.js    — CJS module consumed by tailwind.config.js
 *   docs/DESIGN_TOKENS_REFERENCE.md   — generated reference table
 *
 * Style Dictionary is invoked through `npx --yes style-dictionary@<pinned>` so the
 * package is downloaded only when this script runs — a clean `npm ci` does not
 * pull it. See docs/DESIGN_TOKENS.md for the rationale (mirrors the
 * PREFLIGHT_EXTRAS.md pattern).
 *
 * Usage:
 *   node scripts/build-tokens.mjs           # build all platforms
 *   node scripts/build-tokens.mjs --verify  # build, then fail if generated files
 *                                           # differ from what's on disk (CI gate)
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const argv = process.argv.slice(2);
const VERIFY = argv.includes("--verify");

const NPX = process.platform === "win32" ? "npx.cmd" : "npx";
const SD_VERSION = "^4.0.0";

const CONFIG = path.join(ROOT, "style-dictionary.config.mjs");
const OUT_DIR = path.join(ROOT, "src", "generated");
const TARGETS = [
  "src/generated/design-tokens.css",
  "src/generated/design-tokens.js",
  "docs/DESIGN_TOKENS_REFERENCE.md",
];

if (!existsSync(CONFIG)) {
  console.error(`[fail] missing config: ${CONFIG}`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

// Snapshot pre-build content for --verify mode (so we can compare).
const before = {};
if (VERIFY) {
  for (const t of TARGETS) {
    const p = path.join(ROOT, t);
    before[t] = existsSync(p) ? readFileSync(p, "utf8") : null;
  }
}

console.log(`[run] style-dictionary build (npx --yes style-dictionary@${SD_VERSION})`);
const r = spawnSync(
  NPX,
  ["--yes", `style-dictionary@${SD_VERSION}`, "build", "--config", "style-dictionary.config.mjs"],
  {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  }
);

if (r.status !== 0) {
  console.error(`[fail] style-dictionary exited ${r.status}`);
  process.exit(1);
}

console.log("[ok]  tokens built");

if (VERIFY) {
  let drift = false;
  for (const t of TARGETS) {
    const p = path.join(ROOT, t);
    const now = existsSync(p) ? readFileSync(p, "utf8") : null;
    if (now !== before[t]) {
      console.error(`[drift] ${t} would change — re-run \`npm run build:tokens\` and commit.`);
      drift = true;
    }
  }
  if (drift) process.exit(2);
  console.log("[ok]  no drift — generated tokens match source.");
}
