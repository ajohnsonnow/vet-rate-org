/**
 * dkbShardedRag — cross-shard retrieval over the Diamond Knowledge Base (S29).
 *
 * This is the additive, full-corpus counterpart to legalRag.js. Where
 * legalRag.query() serves the single eCFR legal-index (and stays untouched —
 * "Ask the Regs" and the eval gate depend on its exact behavior), queryShards()
 * fans a query out across MANY independently-lazy-loaded shards
 * (public/dkb-index/, per dkbShardRegistry.js), fuses their results with the
 * SAME scoring primitives legalRag exports (so ranking can never drift between
 * the two paths), applies a gentle authority-tier prior, MMR-diversifies, and
 * returns cited chunks each carrying its `authority_tier`.
 *
 * Memory model — "per-shard-loaded ≤25 MB" (S29 DoD): shards stream one PART at
 * a time. Each part (≤25 MB by build-time invariant) is loaded, scored, and
 * fused in isolation; only that part's top `poolSize` candidates survive — and
 * for each survivor we copy out its 384-byte vector before the part's full
 * arrays are released. Peak resident vectors are therefore one part plus a tiny
 * candidate pool, regardless of a shard's total size. The 45 MB BVA shard is
 * queried without ever holding 45 MB at once.
 *
 * Regression-free eCFR: a single-part shard (all current shards except BVA)
 * runs exactly one hybridFuse over its whole chunk set — identical math to
 * legalRag.query() over one source — so queryShards({only:['ecfr']}) returns
 * the same chunks in the same order as legalRag.query() (asserted by test).
 *
 * Untrusted at runtime: like legalRag, chunk text is post-sanitization but
 * still untrusted — callers route it through legalAnswerer.js's dual-LLM split,
 * unchanged.
 */

import {
  EMBED_DIM,
  embedQuery,
  cosineQ8,
  tokenize,
  buildBM25Index,
  bm25ScoreAll,
  hybridFuse,
  mmrRerank,
  dequantizeQ8,
  HYBRID_DEFAULT,
  MMR_LAMBDA,
  MMR_POOL_SIZE,
} from "./legalRag.js";
import {
  loadRegistry,
  selectShards,
  partUrls,
  PER_PART_BYTE_BUDGET,
} from "./dkbShardRegistry.js";
import { rankForTier } from "./dkbAuthorityTiers.js";

// The tier prior is a SMALL additive bonus on the fused score, scaled so it can
// only reorder near-ties — never lift a weak match from an authoritative shard
// over a strong match from a lesser one. tier_rank 1 (statutory) gets the full
// bonus; each rank down gets proportionally less; the lowest tier gets ~0.
// TIER_PRIOR_WEIGHT is deliberately an order of magnitude below a typical RRF
// fused-score gap so semantic/lexical relevance dominates. Tunable in one place.
export const TIER_PRIOR_WEIGHT = 0.0015;
const MAX_TIER_RANK = 8; // community, the lowest — see dkbAuthorityTiers

/**
 * Additive tier prior for a shard rank. rank 1 → TIER_PRIOR_WEIGHT; rank 8 → 0.
 * @param {number} tierRank
 * @returns {number}
 */
export function tierPrior(tierRank) {
  const r = Math.min(Math.max(tierRank, 1), MAX_TIER_RANK);
  return (TIER_PRIOR_WEIGHT * (MAX_TIER_RANK - r)) / (MAX_TIER_RANK - 1);
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`dkbShardedRag: ${url} → HTTP ${res.status}`);
  return res.text();
}

async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`dkbShardedRag: ${url} → HTTP ${res.status}`);
  return new Int8Array(await res.arrayBuffer());
}

/**
 * Load ONE shard part (chunks + vectors). Not cached: a part is scored then
 * released so peak memory stays bounded to a single part. Validates the byte
 * budget and the vectors/chunks length agreement loudly.
 *
 * @param {Object} shard
 * @param {Object} part
 * @returns {Promise<{chunks: Array<Object>, vectors: Int8Array}>}
 */
export async function loadPart(shard, part) {
  const urls = partUrls(shard, part);
  const [chunksText, vectors] = await Promise.all([
    fetchText(urls.chunks),
    fetchBytes(urls.vectors),
  ]);
  if (vectors.length > PER_PART_BYTE_BUDGET) {
    throw new Error(
      `dkbShardedRag: shard ${shard.id} part ${urls.vectors} is ` +
        `${vectors.length} bytes, over the ${PER_PART_BYTE_BUDGET}-byte per-part ` +
        `budget — rebuild with smaller parts (build-shard.mjs)`,
    );
  }
  const chunks = chunksText
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  if (vectors.length !== chunks.length * EMBED_DIM) {
    throw new Error(
      `dkbShardedRag: ${shard.id} part vectors (${vectors.length}) ≠ ` +
        `chunks (${chunks.length}) × ${EMBED_DIM}`,
    );
  }
  return { chunks, vectors };
}

/**
 * Score + fuse one part in isolation, returning at most `poolSize` candidates,
 * each carrying a COPY of its 384-byte vector (so the part's big arrays can be
 * released) plus its shard's authority metadata.
 */
function fusePart({
  chunks,
  vectors,
  shard,
  queryVec,
  queryTokens,
  threshold,
  hybrid,
  poolSize,
}) {
  const cosine = new Array(chunks.length);
  for (let i = 0; i < chunks.length; i++)
    cosine[i] = cosineQ8(queryVec, vectors, i);
  const bm25 = hybrid
    ? bm25ScoreAll(buildBM25Index(chunks.map((c) => c.text)), queryTokens)
    : new Array(chunks.length).fill(0);

  let ranked;
  if (hybrid) {
    ranked = hybridFuse({ cosine, bm25, threshold, topK: poolSize });
  } else {
    ranked = cosine
      .map((c, index) => ({
        index,
        fusedScore: c,
        cosine: c,
        bm25: 0,
        denseRank: 0,
        bm25Rank: 0,
      }))
      .filter((r) => r.cosine >= threshold)
      .sort((a, b) => b.cosine - a.cosine)
      .slice(0, poolSize);
  }

  const tierRank = shard.tier_rank ?? rankForTier(shard.authority_tier);
  return ranked.map((r) => ({
    fusedScore: r.fusedScore,
    cosine: r.cosine,
    bm25: r.bm25,
    denseRank: r.denseRank,
    bm25Rank: r.bm25Rank,
    tier_rank: tierRank,
    authority_tier: shard.authority_tier,
    chunk: chunks[r.index],
    vector: dequantizeQ8(vectors, r.index), // retained for MMR after release
  }));
}

/**
 * Fan a query out across selected shards and return top-K cited chunks.
 *
 * @param {string} text
 * @param {Object} [opts]
 * @param {number} [opts.topK=5]
 * @param {number} [opts.threshold=0.35]
 * @param {boolean} [opts.hybrid=HYBRID_DEFAULT]
 * @param {boolean} [opts.mmr=true]
 * @param {boolean} [opts.tierPrior=true]
 * @param {string} [opts.deviceTier="desktop-high"]
 * @param {string[]} [opts.only]
 * @param {boolean} [opts.ignoreDeviceGate=false]
 * @returns {Promise<{query: string, shards: string[], chunks: Array<Object>}>}
 */
export async function queryShards(text, opts = {}) {
  const {
    topK = 5,
    threshold = 0.35,
    hybrid = HYBRID_DEFAULT,
    mmr = true,
    tierPrior: useTierPrior = true,
    deviceTier = "desktop-high",
    only,
    ignoreDeviceGate = false,
  } = opts;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return { query: text || "", shards: [], chunks: [] };
  }

  const registry = await loadRegistry();
  const shards = selectShards(registry, { deviceTier, only, ignoreDeviceGate });
  if (shards.length === 0) return { query: text, shards: [], chunks: [] };

  const queryVec = await embedQuery(text);
  const queryTokens = tokenize(text);
  const poolSize = mmr ? Math.max(topK, MMR_POOL_SIZE) : topK;

  // Stream every selected shard's parts, keeping only each part's top pool.
  let pool = [];
  for (const shard of shards) {
    for (const part of shard.parts) {
      const { chunks, vectors } = await loadPart(shard, part);
      const partPool = fusePart({
        chunks,
        vectors,
        shard,
        queryVec,
        queryTokens,
        threshold,
        hybrid,
        poolSize,
      });
      for (const c of partPool) pool.push(c);
      // `chunks` + `vectors` fall out of scope here — only partPool (≤poolSize,
      // each with a 384-float retained vector) survives.
    }
  }

  if (pool.length === 0)
    return { query: text, shards: shards.map((s) => s.id), chunks: [] };

  // Authority-tier prior: nudge near-ties toward the more authoritative shard.
  if (useTierPrior) {
    for (const c of pool) c.fusedScore += tierPrior(c.tier_rank);
  }
  pool.sort((a, b) => b.fusedScore - a.fusedScore || b.cosine - a.cosine);
  pool = pool.slice(0, poolSize);

  let selected;
  if (mmr) {
    // mmrRerank expects {index, cosine}; adapt via a positional index into pool.
    const adapted = pool.map((c, index) => ({ ...c, index }));
    selected = mmrRerank(adapted, {
      topK,
      lambda: MMR_LAMBDA,
      getVector: (index) => pool[index].vector,
    });
  } else {
    selected = pool.slice(0, topK);
  }

  const chunks = selected.map((c) => {
    const chunk = c.chunk;
    return {
      dkb_id: chunk.dkb_id ?? chunk.id, // dkb_id is the corpus's real key (S28)
      id: chunk.id,
      source: chunk.source,
      authority_tier: c.authority_tier,
      citation: chunk.citation,
      title: chunk.title,
      text: chunk.text,
      source_url: chunk.source_url,
      fetched_at: chunk.fetched_at,
      score: c.cosine,
      fusedScore: c.fusedScore,
      bm25: c.bm25,
      denseRank: c.denseRank,
      bm25Rank: c.bm25Rank,
    };
  });

  return { query: text, shards: shards.map((s) => s.id), chunks };
}

/** Test/diagnostic — no persistent cache today (parts stream); present for API parity. */
export function _resetForTesting() {
  // Intentionally empty: parts are not cached. Kept so tests can call it
  // symmetrically with legalRag._resetForTesting without special-casing.
}
