/**
 * dkbShardRegistry — loads and interprets the Diamond Knowledge Base shard
 * registry (public/dkb-index/registry.json), the single source of truth for
 * which shards exist, their authority tier, their on-disk parts, and which
 * device tiers may load them (S29).
 *
 * A "shard" is one source category's independently-lazy-loadable index. A shard
 * may be split into "parts" (BVA is ~45 MB of vectors — far over the 25 MB
 * per-load budget — so it ships as several parts, each ≤ budget and each fetched
 * only when that shard is queried on a capable device). Two on-disk layouts are
 * supported:
 *   - layout "legal-index": the shard reuses the pre-existing
 *     public/legal-index/v{x.y.z}/ tree (manifest.json + chunks/{key}.jsonl +
 *     vectors/{key}.bin). This is how the eCFR shard is expressed WITHOUT moving
 *     or re-embedding the shipped data — so legalRag.query() and the eval gate
 *     stay byte-for-byte regression-free (S29 DoD).
 *   - layout "shard": a new dkb-index shard, one dir per shard with
 *     chunks[.partN].jsonl + vectors[.partN].bin + shard.json.
 *
 * Nothing here fetches vectors — this module only reads the small registry.json
 * and answers "which shards should this device/query touch?". The heavy chunk +
 * vector loading is dkbShardedRag.js's job, lazily, per selected shard.
 */

import { rankForTier } from "./dkbAuthorityTiers.js";

const REGISTRY_URL = "/dkb-index/registry.json";

// Device tiers as an ordinal ladder (matches deviceCapabilityDetector.js's
// tier strings). A shard's `min_device_tier` gates loading: the device must sit
// at or above it. "mobile" is the floor — a shard marked mobile loads anywhere.
export const DEVICE_TIER_ORDER = Object.freeze({
  mobile: 0,
  tablet: 1,
  laptop: 2,
  "desktop-mid": 3,
  "desktop-high": 4,
});

// Per-part byte ceiling. The build script MUST split a shard so no single part
// exceeds this; the runtime never loads more than one part's worth of vectors
// at a time per shard. 25 MB matches the legal-index budget carried since S18.
export const PER_PART_BYTE_BUDGET = 25 * 1024 * 1024;

const state = { registry: null, promise: null };

/**
 * Compare two device-tier strings. Returns true when `have` is at least as
 * capable as `need`. Unknown tiers are treated as the floor (mobile) so an
 * unrecognized value never unlocks a gated shard.
 */
export function deviceMeets(have, need) {
  const h = DEVICE_TIER_ORDER[have] ?? 0;
  const n = DEVICE_TIER_ORDER[need] ?? 0;
  return h >= n;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`dkbShardRegistry: ${url} → HTTP ${res.status}`);
  return res.json();
}

/**
 * Load + cache the registry for the session. Normalizes each shard so callers
 * can rely on `parts` (always an array), `tier_rank` (derived from
 * authority_tier when absent), and `min_device_tier` (defaults to "mobile").
 *
 * @param {{ force?: boolean }} [opts]
 * @returns {Promise<Object>}
 */
export async function loadRegistry({ force = false } = {}) {
  if (state.registry && !force) return state.registry;
  if (state.promise && !force) return state.promise;
  state.promise = (async () => {
    const raw = await fetchJson(REGISTRY_URL);
    const shards = (raw.shards || []).map(normalizeShard);
    const registry = { ...raw, shards };
    state.registry = registry;
    return registry;
  })();
  return state.promise;
}

function normalizeShard(s) {
  const parts =
    Array.isArray(s.parts) && s.parts.length
      ? s.parts
      : [
          // A single-part shard is expressed as one implicit part so the loader
          // has one code path. legal-index layout names its files by source_key.
          {
            chunks: s.chunks_file,
            vectors: s.vectors_file,
            bytes: s.bytes ?? 0,
            count: s.entry_count ?? 0,
          },
        ];
  return {
    ...s,
    parts,
    tier_rank: s.tier_rank ?? rankForTier(s.authority_tier),
    min_device_tier: s.min_device_tier || "mobile",
  };
}

/**
 * Select which shards to query, given the device tier and an optional caller
 * filter. Filtering rules:
 *   - device gating: drop any shard whose `min_device_tier` outranks `deviceTier`.
 *   - explicit `only`: if provided, keep only those shard ids (still device-gated
 *     unless `ignoreDeviceGate` — used by the eval harness / tests on "server"
 *     hardware where no browser device tier applies).
 * Returns shards ordered by ascending tier_rank (most authoritative first) so a
 * downstream cap on shards-loaded keeps the highest-authority sources.
 *
 * @param {Object} registry — from loadRegistry()
 * @param {Object} [opts]
 * @param {string} [opts.deviceTier="desktop-high"] — from deviceCapabilityDetector
 * @param {string[]} [opts.only] — restrict to these shard ids
 * @param {boolean} [opts.ignoreDeviceGate=false]
 * @returns {Array<Object>} selected, normalized shard descriptors
 */
export function selectShards(
  registry,
  { deviceTier = "desktop-high", only, ignoreDeviceGate = false } = {},
) {
  const onlySet = only ? new Set(only) : null;
  return (registry.shards || [])
    .filter((s) => (onlySet ? onlySet.has(s.id) : true))
    .filter((s) =>
      ignoreDeviceGate ? true : deviceMeets(deviceTier, s.min_device_tier),
    )
    .slice()
    .sort((a, b) => a.tier_rank - b.tier_rank);
}

/** Resolve a shard part's absolute URLs given the shard's layout + base path. */
export function partUrls(shard, part) {
  const base = shard.path.replace(/\/$/, "");
  if (shard.layout === "legal-index") {
    // Reuses the legacy tree: /legal-index/v0.1.0/chunks/ecfr.jsonl etc.
    return {
      chunks: `${base}/${part.chunks}`,
      vectors: `${base}/${part.vectors}`,
    };
  }
  // New shard layout: files live directly under the shard dir.
  return {
    chunks: `${base}/${part.chunks}`,
    vectors: `${base}/${part.vectors}`,
  };
}

/** Test hook — clear the session cache. */
export function _resetForTesting() {
  state.registry = null;
  state.promise = null;
}
