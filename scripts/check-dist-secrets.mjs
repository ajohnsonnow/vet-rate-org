#!/usr/bin/env node
/**
 * RT1-1 release gate: fail the build if the production bundle contains an
 * API-key-shaped secret. Vite inlines every `import.meta.env.VITE_*` value at
 * build time, so a BYOK key left in `.env` would ship in public `dist/` JS.
 * Run after `npm run build` (and in CI / release gates).
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIST = process.argv[2] || "dist";

// Patterns for secrets that must never appear in a public client bundle.
const PATTERNS = [
  { name: "Google API key", re: /AIza[0-9A-Za-z_-]{35}/g },
  { name: "Stripe live/test secret", re: /\b[sr]k_(?:live|test)_[0-9A-Za-z]{16,}/g },
  { name: "Slack token", re: /xox[baprs]-[0-9A-Za-z-]{10,}/g },
];

const TEXT_EXT = /\.(js|mjs|cjs|css|html|json|map|txt|svg|webmanifest)$/i;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

if (!existsSync(DIST)) {
  console.log(`[check-dist-secrets] no ${DIST}/ — run \`npm run build\` first. Skipping.`);
  process.exit(0);
}

const findings = [];
for (const file of walk(DIST)) {
  if (!TEXT_EXT.test(file)) continue;
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const { name, re } of PATTERNS) {
    const m = content.match(re);
    if (m) {
      findings.push({ file, name, count: m.length, sample: `${m[0].slice(0, 6)}…(redacted)` });
    }
  }
}

if (findings.length) {
  console.error(`[check-dist-secrets] ❌ Potential secret(s) found in ${DIST}/:`);
  for (const f of findings) {
    console.error(`  - ${f.file}: ${f.name} ×${f.count} (${f.sample})`);
  }
  console.error(
    "A real API key was inlined into the public bundle. Remove it from the build env " +
      "(BYOK keys must come from the user at runtime, not VITE_*). See RT1-1.",
  );
  process.exit(1);
}

console.log(`[check-dist-secrets] ✅ no API-key-shaped secrets in ${DIST}/.`);
process.exit(0);
