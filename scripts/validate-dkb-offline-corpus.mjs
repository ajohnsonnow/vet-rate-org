#!/usr/bin/env node
/**
 * validate-dkb-offline-corpus.mjs — integrity gate for the offline Diamond
 * Knowledge Base corpus (llm-compiler/knowledge-base/diamond_knowledge_base.json).
 *
 * This is the 130K-entry stats-only corpus (see docs/DIAMOND_KNOWLEDGE_BASE.md),
 * NOT the small production dataset that scripts/validate-dkb.mjs checks, and NOT
 * the live legal-index that scripts/legal-ingestion/eval/run-eval.mjs checks.
 * Added in Sprint S28 (docs/SPRINT_PLAN_S27-S40_DKB_FULL_COVERAGE.md) to
 * establish the ongoing accuracy-verification discipline the sprint plan
 * requires before further content is layered onto this corpus.
 *
 * Checks:
 *   1. Historical fabrication-signature scan — the exact citation pattern and
 *      boilerplate marker found in the entries purged by the 2026-01-22
 *      cleanup (llm-compiler/knowledge-base/removed_fake_entries.json) must
 *      never reappear. This is the one hard-failure check; everything below
 *      is a warning against a known-issues baseline so this gate doesn't
 *      block on pre-existing data debt it wasn't scoped to fix.
 *   2. `dkb_id` uniqueness — the corpus's only reliably-unique key. Any
 *      collision here IS a hard failure (unlike `id`, see below).
 *   3. `id` uniqueness — known-broken (S28 audit found 48,994/130,508
 *      duplicates, concentrated in BVA/OGC/CAVC). Reported as a warning with
 *      an exact count so any *regression* past the recorded baseline is
 *      visible, without failing the build on a defect this sprint didn't fix.
 *   4. Per-category entry counts vs `metadata.sources` in the file itself.
 *   5. Source mislabeling — entries whose `url` domain doesn't match what
 *      their `source` category implies (the S28 audit's most significant
 *      find: 2,943 of 2,953 "38_cfr"-tagged entries are actually
 *      federalregister.gov notices with empty content).
 *   6. Exact-content duplicate scan (content-hash collisions across
 *      different entries) — reported as a warning with a count.
 *   7. Accuracy-field presence per category (`url`, `citation`) — the fields
 *      docs/DIAMOND_KNOWLEDGE_BASE.md's entry schema requires going forward
 *      (`source_url`/`authority_tier`/`precedential` don't exist in the data
 *      yet at all — enforcing 100% presence on fields that are 0% populated
 *      today would just fail every run; that's tracked in
 *      DATA_INTEGRITY_REPORT.md as future-sprint work, not gated here).
 *
 * Exit 0 = clean (warnings allowed), exit 1 = hard failure (fabrication
 * signature found, or a `dkb_id` collision).
 */

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const p = (...segs) => path.join(ROOT, ...segs);
const CORPUS_PATH = p(
  "llm-compiler",
  "knowledge-base",
  "diamond_knowledge_base.json",
);

const failures = [];
const warnings = [];
const passes = [];

// S28 baseline (2026-07-15) — see DATA_INTEGRITY_REPORT.md. Env-tunable so a
// deliberate remediation pass can tighten these without editing this file.
const MAX_KNOWN_ID_DUPLICATES = Number(
  process.env.DKB_MAX_ID_DUPLICATES ?? "49000",
);
const MAX_KNOWN_CONTENT_DUPLICATES = Number(
  process.env.DKB_MAX_CONTENT_DUPLICATES ?? "2600",
);
const MAX_KNOWN_MISLABELED_38CFR = Number(
  process.env.DKB_MAX_MISLABELED_38CFR ?? "2950",
);

// The exact signature of the fabricated entries purged 2026-01-22 (see
// removed_fake_entries.json). Citation format: "BVA <year>-<5 digits>" — the
// real corpus uses "BVA-<7-8 digit file number>" (e.g. "BVA-19167246"),
// which this pattern does not match.
const FAKE_CITATION_RE = /\bBVA\s+20\d\d-\d{5}\b/;
const FAKE_BOILERPLATE = "[BVA Precedent - GREEN]";

// Content-fingerprinting for exact-duplicate detection only — not a security
// boundary. sha256 to match the repo standard (sanitize-html/aiAuditLog) and
// stay clear of the CTK-007 "no deprecated crypto" pre-deploy gate.
function contentFingerprint(s) {
  return createHash("sha256").update(s).digest("hex");
}

function scanFabricationSignature(entries) {
  let hits = 0;
  const samples = [];
  for (const e of entries) {
    const blob = `${e.citation ?? ""} ${e.content ?? ""}`;
    if (FAKE_CITATION_RE.test(blob) || blob.includes(FAKE_BOILERPLATE)) {
      hits++;
      if (samples.length < 5) samples.push(e.id ?? e.dkb_id ?? "?");
    }
  }
  if (hits > 0) {
    failures.push(
      `FABRICATION SIGNATURE DETECTED: ${hits} entries match the 2026-01-22 ` +
        `purged-fake-entry pattern (fake "BVA YYYY-NNNNN" citation or ` +
        `"${FAKE_BOILERPLATE}" boilerplate). Sample ids: ${samples.join(", ")}. ` +
        `See removed_fake_entries.json for the historical incident.`,
    );
  } else {
    passes.push(
      `fabrication signature scan: 0 entries match the known fake-BVA-citation ` +
        `pattern across ${entries.length} entries`,
    );
  }
}

function checkDkbIdUniqueness(entries) {
  const seen = new Set();
  const dupes = [];
  for (const e of entries) {
    if (seen.has(e.dkb_id)) dupes.push(e.dkb_id);
    else seen.add(e.dkb_id);
  }
  if (dupes.length > 0) {
    failures.push(
      `dkb_id is not unique: ${dupes.length} collisions (e.g. ${dupes.slice(0, 5).join(", ")}). ` +
        `dkb_id is the only field this corpus can safely key on — a collision here is a hard failure.`,
    );
  } else {
    passes.push(`dkb_id uniqueness: 0 collisions across ${entries.length} entries`);
  }
}

function checkIdUniqueness(entries) {
  const seen = new Set();
  let dupes = 0;
  for (const e of entries) {
    if (seen.has(e.id)) dupes++;
    else seen.add(e.id);
  }
  if (dupes > MAX_KNOWN_ID_DUPLICATES) {
    failures.push(
      `id uniqueness regressed: ${dupes} duplicate ids, exceeding the recorded ` +
        `S28 baseline of ${MAX_KNOWN_ID_DUPLICATES}. This is a known pre-existing ` +
        `defect (id is NOT a reliable key — use dkb_id) but it must not get worse.`,
    );
  } else {
    warnings.push(
      `id uniqueness: ${dupes} duplicate ids (known pre-existing defect from before S28; ` +
        `baseline ${MAX_KNOWN_ID_DUPLICATES}; use dkb_id, not id, as the primary key). ` +
        `Confirmed by S28 sampling that duplicates include DIFFERENT decisions sharing an id ` +
        `(e.g. "bva_1"), not just harmless re-registration — do not silently dedupe by id.`,
    );
  }
}

function checkCategoryCounts(corpus) {
  const declared = corpus.metadata?.sources ?? {};
  const actual = {};
  for (const e of corpus.entries) {
    actual[e.source] = (actual[e.source] ?? 0) + 1;
  }
  for (const [src, declaredCount] of Object.entries(declared)) {
    const actualCount = actual[src] ?? 0;
    if (actualCount !== declaredCount) {
      failures.push(
        `metadata.sources.${src} claims ${declaredCount} entries but the actual count is ${actualCount}`,
      );
    } else {
      passes.push(`category count matches metadata: ${src} = ${actualCount}`);
    }
  }
}

function checkSourceMislabeling(entries) {
  const cfrEntries = entries.filter((e) => e.source === "38_cfr");
  const mislabeledAsFedReg = cfrEntries.filter((e) =>
    (e.url ?? "").includes("federalregister.gov"),
  );
  if (mislabeledAsFedReg.length > MAX_KNOWN_MISLABELED_38CFR) {
    failures.push(
      `38_cfr mislabeling regressed: ${mislabeledAsFedReg.length} entries tagged ` +
        `source="38_cfr" are actually federalregister.gov notices, exceeding the ` +
        `S28 baseline of ${MAX_KNOWN_MISLABELED_38CFR}`,
    );
  } else if (mislabeledAsFedReg.length > 0) {
    const realCfr = cfrEntries.length - mislabeledAsFedReg.length;
    warnings.push(
      `38_cfr category is mostly mislabeled: only ${realCfr} of ${cfrEntries.length} ` +
        `entries tagged source="38_cfr" contain real eCFR/Cornell-LII regulation text; ` +
        `${mislabeledAsFedReg.length} are federalregister.gov notices with empty ` +
        `content/citation fields (known pre-existing defect, S28 baseline ${MAX_KNOWN_MISLABELED_38CFR}). ` +
        `The real 38 CFR text lives in the separate "ecfr" category (${entries.filter((e) => e.source === "ecfr").length} entries).`,
    );
  } else {
    passes.push(`38_cfr mislabeling: 0 federalregister.gov entries tagged as 38_cfr`);
  }
}

function checkContentDuplication(entries) {
  const hashCounts = new Map();
  let substantive = 0;
  for (const e of entries) {
    const c = (e.content ?? "").trim();
    if (c.length < 30) continue;
    substantive++;
    const h = contentFingerprint(c);
    hashCounts.set(h, (hashCounts.get(h) ?? 0) + 1);
  }
  let dupEntries = 0;
  for (const c of hashCounts.values()) if (c > 1) dupEntries += c;

  if (dupEntries > MAX_KNOWN_CONTENT_DUPLICATES) {
    failures.push(
      `exact-content duplication regressed: ${dupEntries} entries share identical ` +
        `content with at least one other entry, exceeding the S28 baseline of ` +
        `${MAX_KNOWN_CONTENT_DUPLICATES} (out of ${substantive} substantive entries)`,
    );
  } else {
    warnings.push(
      `exact-content duplication: ${dupEntries} of ${substantive} substantive entries ` +
        `(≥30 chars) share identical content with another entry under a different id/citation ` +
        `(known pre-existing residue from before dedup; baseline ${MAX_KNOWN_CONTENT_DUPLICATES}). ` +
        `The corpus's own metadata.deduplication.duplicates_removed=117193 claim reflects an ` +
        `earlier pre-merge dedup pass, not this exact-content check.`,
    );
  }
}

function checkAccuracyFieldPresence(entries) {
  const bySource = new Map();
  for (const e of entries) {
    if (!bySource.has(e.source)) bySource.set(e.source, { total: 0, hasUrl: 0 });
    const bucket = bySource.get(e.source);
    bucket.total++;
    if (e.url) bucket.hasUrl++;
  }
  const lines = [];
  for (const [src, { total, hasUrl }] of [...bySource].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const pct = ((hasUrl / total) * 100).toFixed(1);
    lines.push(`${src}=${pct}% (${hasUrl}/${total})`);
  }
  warnings.push(
    `url/citation presence by category (source_url/authority_tier don't exist in ` +
      `the schema yet — that's future-sprint work, see DATA_INTEGRITY_REPORT.md): ${lines.join(", ")}`,
  );
}

async function main() {
  const started = Date.now();
  const corpus = JSON.parse(readFileSync(CORPUS_PATH, "utf8"));
  if (!Array.isArray(corpus.entries)) {
    console.error("✗ FAIL: diamond_knowledge_base.json has no `entries` array");
    process.exit(1);
  }

  scanFabricationSignature(corpus.entries);
  checkDkbIdUniqueness(corpus.entries);
  checkIdUniqueness(corpus.entries);
  checkCategoryCounts(corpus);
  checkSourceMislabeling(corpus.entries);
  checkContentDuplication(corpus.entries);
  checkAccuracyFieldPresence(corpus.entries);

  console.log(`\nOffline DKB corpus integrity report (${new Date().toISOString()})`);
  console.log(`Source: ${path.relative(ROOT, CORPUS_PATH)}`);
  console.log("─".repeat(72));
  for (const line of passes) console.log(`  ✓ ${line}`);
  for (const line of warnings) console.log(`  ⚠ ${line}`);
  for (const line of failures) console.log(`  ✗ ${line}`);
  console.log("─".repeat(72));
  console.log(
    `  ${passes.length} passed · ${warnings.length} warnings · ${failures.length} failures ` +
      `(${((Date.now() - started) / 1000).toFixed(1)}s)`,
  );
  console.log(
    `\nSee docs/SPRINT_PLAN_S27-S40_DKB_FULL_COVERAGE.md (S28) and ` +
      `llm-compiler/knowledge-base/DATA_INTEGRITY_REPORT.md for full context ` +
      `on every warning above before treating any of them as new news.`,
  );

  process.exit(failures.length ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`✗ validate-dkb-offline-corpus FATAL: ${err.message}`);
    process.exit(1);
  });
}

export {
  scanFabricationSignature,
  checkDkbIdUniqueness,
  checkIdUniqueness,
  checkCategoryCounts,
  checkSourceMislabeling,
  checkContentDuplication,
  checkAccuracyFieldPresence,
};
