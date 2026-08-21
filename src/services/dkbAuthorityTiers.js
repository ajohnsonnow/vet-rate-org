/**
 * dkbAuthorityTiers - the canonical legal-authority hierarchy for the Diamond
 * Knowledge Base shards (S29).
 *
 * Veterans-law sources are not equal in weight: a 38 CFR regulation binds the
 * VA; a non-precedential BVA decision is merely persuasive. When the sharded
 * RAG (dkbShardedRag.js) fuses results ACROSS shards of different authority,
 * ranking must be aware of that hierarchy - otherwise the sheer volume of the
 * BVA shard (116K entries) would drown out the handful of controlling 38 CFR
 * or Federal Circuit chunks that actually answer a question.
 *
 * `tier_rank` is an ordinal (lower = more authoritative). It is used ONLY as a
 * gentle tie-breaking prior in ranking (see dkbShardedRag.applyTierPrior) - it
 * can nudge near-ties toward the more authoritative source but never override a
 * clearly stronger semantic/lexical match from a lower tier. The string
 * `authority_tier` is also surfaced on every returned chunk so the UI and the
 * dual-LLM answerer can label and caveat correctly - load-bearing for BVA,
 * where a non-precedential decision must never render as binding authority
 * (that per-entry precedential/non-precedential split is S32's job; this file
 * only establishes the coarse per-shard tier).
 *
 * The build script (scripts/dkb-sharding/build-shard.mjs) carries its own copy
 * of the SHARD_TIER map to tag shards at build time - keep the two in sync when
 * a new source category is added. (Deliberately not a shared import: the build
 * script is a node .mjs outside the Vite graph; a three-line duplicated literal
 * is cheaper and less fragile than a cross-tree module dependency.)
 */

/** Ordinal authority ranks. Lower = more authoritative / controlling. */
export const AUTHORITY_TIERS = Object.freeze({
  statutory: 1, // 38 CFR / eCFR - binding federal regulation
  judicial_federal_circuit: 2, // Federal Circuit - can overturn CAVC
  judicial: 3, // CAVC - binding on the Board
  administrative_precedent: 4, // BVA precedential - binding on ROs
  policy: 5, // VA OGC precedent opinions
  procedural: 6, // M21-1 adjudication manual
  reference: 7, // presumptive / secondary / state-benefits / multinational
  community: 8, // CKB - anecdotal, lowest weight
});

/** Map a DKB source-category id → its default authority tier string. */
export const SHARD_TIER = Object.freeze({
  ecfr: "statutory",
  "38_cfr": "statutory",
  federal_register: "statutory",
  federal_circuit: "judicial_federal_circuit",
  fedcir: "judicial_federal_circuit",
  cavc: "judicial",
  bva: "administrative_precedent",
  ogc: "policy",
  m21_1: "procedural",
  "m21-1": "procedural",
  m21_5: "procedural",
  "m21-5": "procedural",
  // m21_4 is intentionally "reference", not "procedural" like m21_1/m21_5 -
  // its content is RO workload-management/QA-audit material, not veteran-
  // facing adjudication guidance (see fetch-m21-4.mjs's header for the full
  // rationale). Keep it out of "procedural" so tier-based ranking never
  // presents internal staffing/audit procedure as adjudication authority.
  m21_4: "reference",
  "m21-4": "reference",
  presumptive: "reference",
  secondary: "reference",
  "state-benefits": "reference",
  multinational: "reference",
  community: "community",
});

/**
 * Resolve a source id to a `{ authority_tier, tier_rank }` pair, falling back
 * to the lowest-weight "reference" tier for an unknown source rather than
 * throwing - an unrecognized shard should still be queryable, just never
 * out-rank a known-authoritative one on tier alone.
 *
 * @param {string} sourceId
 * @returns {{ authority_tier: string, tier_rank: number }}
 */
export function tierForSource(sourceId) {
  const authority_tier = SHARD_TIER[sourceId] || "reference";
  return { authority_tier, tier_rank: AUTHORITY_TIERS[authority_tier] };
}

/** Rank for an explicit tier string (used when the shard already carries one). */
export function rankForTier(authority_tier) {
  return AUTHORITY_TIERS[authority_tier] ?? AUTHORITY_TIERS.reference;
}
