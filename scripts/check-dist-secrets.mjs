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

// The vendor regexes above only match known key shapes (Google/Stripe/Slack).
// Opaque tokens — e.g. VA Platform API keys declared as `VITE_VA_*` build-env in
// render.yaml — match NONE of them, so a populated value would ship undetected
// (RT-A-H05). Vite inlines every `import.meta.env.VITE_*` literally, so also scan
// the bundle for the literal VALUE of any credential-named VITE_* env var that is
// set at build time. Normal builds set none of these (BYOK), so this is a no-op
// unless a real secret is being inlined — exactly the case we must fail on.
const CREDENTIAL_NAME = /(KEY|SECRET|TOKEN|PASSWORD)/i;
const inlinedEnvSecrets = Object.entries(process.env)
  .filter(
    ([k, v]) =>
      k.startsWith("VITE_") &&
      CREDENTIAL_NAME.test(k) &&
      typeof v === "string" &&
      v.trim().length >= 12,
  )
  .map(([k, v]) => ({ envVar: k, value: v.trim() }));

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
  for (const { envVar, value } of inlinedEnvSecrets) {
    if (content.includes(value)) {
      findings.push({
        file,
        name: `inlined build-env secret (${envVar})`,
        count: 1,
        sample: `${value.slice(0, 4)}…(redacted)`,
      });
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
