#!/usr/bin/env node
/**
 * check-bundle-budget.mjs — Sprint 5 / performance-engineering gate.
 *
 * Parses `dist/assets/*.{js,css}` after a `vite build` and asserts each
 * chunk against a budget. Runs zero-deps (no rollup-plugin-visualizer).
 *
 * Budgets (gzipped):
 *   initial JS / CSS bundle  ≤  300 KB
 *   lazy chunks (per chunk)  ≤  900 KB  (relaxed for WebLLM/PDF/AI heavies)
 *   total dist/ JS           ≤   16 MB
 *
 * Exit:
 *   0 — all budgets met (or STRICT=false)
 *   1 — at least one budget breached AND STRICT=true (default false during S5)
 *
 * Usage:
 *   node scripts/check-bundle-budget.mjs            # informational
 *   STRICT_BUNDLE=true node scripts/check-bundle-budget.mjs
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");
const ASSETS = path.join(DIST, "assets");

const KB = 1024;
const MB = 1024 * KB;

const BUDGET = {
  initialJsGz: 300 * KB, // entry chunk + critical CSS
  lazyChunkGz: 900 * KB, // any single lazy-loaded chunk
  totalJsRaw: 16 * MB, // total dist JS (uncompressed) — guards against bundle bloat
};

const STRICT = process.env.STRICT_BUNDLE === "true";

if (!existsSync(DIST)) {
  console.error("[bundle-budget] dist/ not found — run `npx vite build` first");
  process.exit(STRICT ? 1 : 0);
}

const files = readdirSync(ASSETS).filter((f) =>
  /\.(js|css)$/.test(f),
);

const stats = files.map((f) => {
  const fp = path.join(ASSETS, f);
  const raw = readFileSync(fp);
  const gz = gzipSync(raw).length;
  return {
    name: f,
    rawBytes: raw.length,
    gzBytes: gz,
    isCss: f.endsWith(".css"),
    isEntry: /^index-/.test(f), // Vite default entry chunk prefix
  };
});

stats.sort((a, b) => b.gzBytes - a.gzBytes);

const fmt = (b) =>
  b >= MB ? `${(b / MB).toFixed(2)} MB` : `${(b / KB).toFixed(1)} KB`;

console.log("Bundle budget report:\n");
console.log("  chunk".padEnd(48) + "    raw".padStart(12) + "       gz".padStart(12));
console.log("  " + "-".repeat(70));
stats.forEach((s) => {
  console.log(
    "  " +
      s.name.padEnd(46) +
      "  " +
      fmt(s.rawBytes).padStart(12) +
      "  " +
      fmt(s.gzBytes).padStart(12),
  );
});

const breaches = [];

const entry = stats.find((s) => s.isEntry && !s.isCss);
if (entry && entry.gzBytes > BUDGET.initialJsGz) {
  breaches.push(
    `Initial JS chunk ${entry.name} = ${fmt(entry.gzBytes)} gz (budget ${fmt(BUDGET.initialJsGz)})`,
  );
}

stats
  .filter((s) => !s.isEntry && !s.isCss)
  .forEach((s) => {
    if (s.gzBytes > BUDGET.lazyChunkGz) {
      breaches.push(
        `Lazy chunk ${s.name} = ${fmt(s.gzBytes)} gz (budget ${fmt(BUDGET.lazyChunkGz)})`,
      );
    }
  });

const totalRaw = stats
  .filter((s) => !s.isCss)
  .reduce((sum, s) => sum + s.rawBytes, 0);
if (totalRaw > BUDGET.totalJsRaw) {
  breaches.push(
    `Total dist JS = ${fmt(totalRaw)} raw (budget ${fmt(BUDGET.totalJsRaw)})`,
  );
}

console.log("");
if (breaches.length === 0) {
  console.log("[bundle-budget] PASS — all budgets met");
  process.exit(0);
}

console.log(`[bundle-budget] ${breaches.length} budget breach(es):`);
breaches.forEach((b) => console.log("  - " + b));

if (STRICT) {
  console.error(
    "\n[bundle-budget] FAIL — STRICT_BUNDLE=true and at least one breach",
  );
  process.exit(1);
}

console.log(
  "\n[bundle-budget] INFORMATIONAL — set STRICT_BUNDLE=true to make this gate blocking",
);
process.exit(0);
