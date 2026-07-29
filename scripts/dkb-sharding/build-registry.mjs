#!/usr/bin/env node
/**
 * build-registry.mjs — assemble public/dkb-index/registry.json (S29), the
 * single source of truth dkbShardRegistry.js reads at runtime.
 *
 * Two shard sources are merged:
 *   1. The pre-existing eCFR legal-index (public/legal-index/v{latest}/) is
 *      registered as a shard with layout "legal-index" — WITHOUT moving or
 *      re-embedding it, so legalRag.query() and the eval gate stay untouched.
 *   2. Every public/dkb-index/<id>/shard.json emitted by build-shard.mjs is
 *      registered with layout "shard".
 *
 * `min_device_tier` is derived from each shard's total on-disk bytes so a
 * low-end device is never handed a large shard to download. (Peak RAM stays
 * bounded regardless — dkbShardedRag streams one ≤25 MB part at a time — so the
 * gate is a bandwidth/UX guard, hence the generous thresholds.)
 *
 * Usage: node scripts/dkb-sharding/build-registry.mjs
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
  mkdirSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const LEGAL_INDEX_ROOT = path.join(ROOT, "public", "legal-index");
const DKB_INDEX_ROOT = path.join(ROOT, "public", "dkb-index");

const AUTHORITY_TIERS = {
  statutory: 1,
  judicial_federal_circuit: 2,
  judicial: 3,
  administrative_precedent: 4,
  policy: 5,
  procedural: 6,
  reference: 7,
  community: 8,
};

const MB = 1024 * 1024;
/** Total-bytes → minimum device tier. Generous: RAM is bounded by streaming. */
function deviceTierForBytes(bytes) {
  if (bytes <= 25 * MB) return "mobile";
  if (bytes <= 60 * MB) return "laptop";
  if (bytes <= 120 * MB) return "desktop-mid";
  return "desktop-high";
}

function latestLegalIndexVersion() {
  if (!existsSync(LEGAL_INDEX_ROOT)) return null;
  const versions = readdirSync(LEGAL_INDEX_ROOT)
    .filter((d) => /^v\d+\.\d+\.\d+$/.test(d))
    .sort();
  return versions.length ? versions[versions.length - 1] : null;
}

function ecfrShardFromLegalIndex() {
  const version = latestLegalIndexVersion();
  if (!version) return null;
  const dir = path.join(LEGAL_INDEX_ROOT, version);
  const manifestPath = path.join(dir, "manifest.json");
  if (!existsSync(manifestPath)) return null;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  // The legal-index groups everything under source keys (today: "ecfr"). Each
  // becomes one part of a single "ecfr" statutory shard.
  const parts = [];
  let totalBytes = 0;
  let totalCount = 0;
  for (const [sourceKey, count] of Object.entries(manifest.sources || {})) {
    const vectorsRel = `vectors/${sourceKey}.bin`;
    const vpath = path.join(dir, vectorsRel);
    const bytes = existsSync(vpath) ? statSync(vpath).size : 0;
    parts.push({
      chunks: `chunks/${sourceKey}.jsonl`,
      vectors: vectorsRel,
      count,
      bytes,
    });
    totalBytes += bytes;
    totalCount += count;
  }

  return {
    id: "ecfr",
    layout: "legal-index",
    path: `/legal-index/${version}`,
    authority_tier: "statutory",
    tier_rank: AUTHORITY_TIERS.statutory,
    embedding_model: manifest.embedding_model,
    embedding_dim: manifest.embedding_dim,
    entry_count: totalCount,
    bytes: totalBytes,
    min_device_tier: deviceTierForBytes(totalBytes),
    parts,
  };
}

function dkbShards() {
  if (!existsSync(DKB_INDEX_ROOT)) return [];
  const out = [];
  for (const name of readdirSync(DKB_INDEX_ROOT)) {
    const shardJson = path.join(DKB_INDEX_ROOT, name, "shard.json");
    if (!existsSync(shardJson)) continue;
    const meta = JSON.parse(readFileSync(shardJson, "utf8"));
    const totalBytes = (meta.parts || []).reduce((s, p) => s + (p.bytes || 0), 0);
    out.push({
      id: meta.id,
      layout: "shard",
      path: `/dkb-index/${meta.id}`,
      authority_tier: meta.authority_tier,
      tier_rank: meta.tier_rank ?? AUTHORITY_TIERS[meta.authority_tier] ?? 7,
      embedding_model: meta.embedding_model,
      embedding_dim: meta.embedding_dim,
      entry_count: meta.entry_count,
      bytes: totalBytes,
      min_device_tier: deviceTierForBytes(totalBytes),
      parts: meta.parts,
    });
  }
  return out;
}

export function buildRegistry({ builtAt }) {
  const shards = [];
  const ecfr = ecfrShardFromLegalIndex();
  if (ecfr) shards.push(ecfr);
  shards.push(...dkbShards());
  shards.sort((a, b) => a.tier_rank - b.tier_rank || a.id.localeCompare(b.id));
  return {
    version: 1,
    generated_at: builtAt,
    embedding_model: "Xenova/bge-small-en-v1.5",
    embedding_dim: 384,
    shard_count: shards.length,
    shards,
  };
}

function main() {
  const registry = buildRegistry({ builtAt: new Date().toISOString() });
  if (registry.shards.length === 0) {
    throw new Error(
      "build-registry: no shards found (no legal-index and no public/dkb-index/*/shard.json)",
    );
  }
  const outPath = path.join(DKB_INDEX_ROOT, "registry.json");
  if (!existsSync(DKB_INDEX_ROOT)) mkdirSync(DKB_INDEX_ROOT, { recursive: true });
  writeFileSync(outPath, JSON.stringify(registry, null, 2) + "\n");
  console.log(
    `[build-registry] wrote ${path.relative(ROOT, outPath)} — ${registry.shard_count} shard(s):`,
  );
  for (const s of registry.shards) {
    console.log(
      `  • ${s.id.padEnd(16)} tier=${s.authority_tier.padEnd(24)} ` +
        `entries=${String(s.entry_count).padStart(7)} ` +
        `parts=${s.parts.length} ${(s.bytes / MB).toFixed(1)}MB → ${s.min_device_tier}`,
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (e) {
    console.error(`[build-registry] FAILED: ${e.message}`);
    process.exit(1);
  }
}
