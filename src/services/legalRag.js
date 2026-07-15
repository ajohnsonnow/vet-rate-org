/**
 * legalRag — runtime retrieval over the static legal index under
 * `public/legal-index/v{x.y.z}/`.
 *
 * The index is built by `scripts/legal-ingestion/{fetch-X, chunk, embed}.mjs`
 * and shipped as a versioned directory tree:
 *   public/legal-index/v0.1.0/
 *     manifest.json
 *     chunks/{source}.jsonl     (one JSON record per chunk)
 *     vectors/{source}.bin      (Int8Array, 384 bytes per chunk, L2-normalized
 *                                then quantized by embed.mjs:quantizeQ8)
 *
 * Lazy by design: the manifest is fetched once on first `query()`, then
 * per-source chunks + vectors are fetched the first time that source is
 * touched. Everything stays in module-level caches for the session.
 *
 * Trust model: chunks are stored *post-sanitization* (sanitize-html.mjs
 * stripped `<script>`, inline handlers, non-gov URLs at ingestion). They
 * are still treated as untrusted at runtime — callers pass results through
 * the dual-LLM split in `legalAnswerer.js`, which never lets raw chunk
 * text reach the synthesizer prompt.
 */

const INDEX_BASE = "/legal-index";
const DEFAULT_VERSION = "v0.1.0";
export const EMBED_DIM = 384;
export const EMBED_MODEL = "Xenova/bge-small-en-v1.5";

// Hybrid retrieval (S21). Dense-cosine and BM25 lexical rankings are fused
// with Reciprocal Rank Fusion. RRF_K=60 is the constant from the original RRF
// paper (Cormack et al.) and the de-facto default in hybrid-search literature.
// BM25 k1/b are the standard Okapi defaults. BM25_POOL_SIZE bounds how many
// top-BM25 chunks can enter the candidate pool on lexical merit alone (so a
// chunk that dense scored below `threshold` can still be rescued by an exact
// term match — the whole point of hybrid on this corpus's lexical-mismatch
// misses). All are exported so the eval harness fuses identically (no drift).
export const RRF_K = 60;
export const BM25_K1 = 1.5;
export const BM25_B = 0.75;
export const BM25_POOL_SIZE = 20;
// Weighted RRF. Dense is the far stronger ranker on this single-part corpus
// (recall@5 ≈ 0.98 alone), so an equal-weight fusion lets spurious lexical
// matches displace correct dense top-3 hits (net regression, measured S21).
// Down-weighting BM25 keeps its rescue power for lexical-mismatch misses
// (q06/q42) while preserving dense-strong queries. Tuned on the non-held-out
// golden slice only; see docs/RAG_EVAL.md.
export const RRF_W_DENSE = 1.0;
export const RRF_W_BM25 = 0.25;

// Default retrieval mode. `true` = fuse BM25 + dense; `false` = legacy
// dense-only cosine. `query(text, { hybrid })` overrides per-call. This is the
// opt-in/out switch (same spirit as the build-time CONTEXTUALIZE_CHUNKS gate),
// so a regression can be reverted by flipping one constant without deleting the
// tested code path.
export const HYBRID_DEFAULT = true;

// MMR diversity reranking (S22), always-on in both hybrid and dense-only
// modes. Applied over a POOL larger than topK (never over the whole corpus),
// so it can only reorder among already-relevant candidates — it cannot pull
// in an irrelevant chunk. lambda=0.7 favors relevance; diversity only breaks
// near-ties. Tuned against the non-held-out golden slice (docs/RAG_EVAL.md).
export const MMR_LAMBDA = 0.7;
export const MMR_POOL_SIZE = 15;

const state = {
  manifest: null,
  manifestVersion: null,
  chunksBySource: new Map(),
  vectorsBySource: new Map(),
  bm25BySource: new Map(),
  embedder: null,
  embedderPromise: null,
};

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`legalRag: ${url} → HTTP ${res.status}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`legalRag: ${url} → HTTP ${res.status}`);
  return res.text();
}

async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`legalRag: ${url} → HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  return new Int8Array(buf);
}

export async function loadManifest(version = DEFAULT_VERSION) {
  if (state.manifest && state.manifestVersion === version)
    return state.manifest;
  const m = await fetchJson(`${INDEX_BASE}/${version}/manifest.json`);
  if (m.embedding_dim !== EMBED_DIM) {
    throw new Error(
      `legalRag: manifest dim ${m.embedding_dim} ≠ runtime ${EMBED_DIM}`,
    );
  }
  state.manifest = m;
  state.manifestVersion = version;
  return m;
}

async function loadSource(source, version) {
  const cached = state.chunksBySource.get(source);
  if (cached) return cached;
  const [chunksText, vectors] = await Promise.all([
    fetchText(`${INDEX_BASE}/${version}/chunks/${source}.jsonl`),
    fetchBytes(`${INDEX_BASE}/${version}/vectors/${source}.bin`),
  ]);
  const chunks = chunksText
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  if (vectors.length !== chunks.length * EMBED_DIM) {
    throw new Error(
      `legalRag: ${source}.bin (${vectors.length}) ≠ chunks (${chunks.length}) × ${EMBED_DIM}`,
    );
  }
  state.chunksBySource.set(source, chunks);
  state.vectorsBySource.set(source, vectors);
  return chunks;
}

async function getEmbedder() {
  if (state.embedder) return state.embedder;
  if (state.embedderPromise) return state.embedderPromise;
  state.embedderPromise = (async () => {
    const { pipeline } = await import("@huggingface/transformers");
    const e = await pipeline("feature-extraction", EMBED_MODEL);
    state.embedder = e;
    return e;
  })();
  return state.embedderPromise;
}

/**
 * Embed and L2-normalize a query string. Returns a Float32Array of length
 * EMBED_DIM. We DO NOT quantize the query — Float32 × Q8/127 cosine works
 * fine and avoids double-rounding noise.
 *
 * @param {string} text
 * @returns {Promise<Float32Array>}
 */
export async function embedQuery(text) {
  const e = await getEmbedder();
  const out = await e(text, { pooling: "mean", normalize: false });
  const v = new Float32Array(out.data);
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  const norm = Math.sqrt(sum) || 1;
  for (let i = 0; i < v.length; i++) v[i] = v[i] / norm;
  return v;
}

/**
 * Embed and L2-normalize ARBITRARY text (a document page, a search phrase, …)
 * with the shared bge-small embedder singleton — the same loaded model instance
 * `embedQuery` uses, held in this module's `state.embedder`. Exposed so other
 * in-browser features (the user-document semantic index in
 * `src/utils/userDocSemanticIndex.js`) reuse that one already-downloaded model
 * instead of pulling a second ~30 MB copy of the weights. Behaviourally
 * identical to `embedQuery`; the distinct name documents that callers here embed
 * *documents*, not only queries.
 *
 * @param {string} text
 * @returns {Promise<Float32Array>} length EMBED_DIM, L2-normalized
 */
export function embedText(text) {
  return embedQuery(text);
}

/**
 * Cosine similarity between a Float32 query and a Q8-quantized vector
 * slice. Both inputs are already L2-normalized (the indexer normalized
 * before quantizing; `embedQuery` normalizes too), so this is just the
 * dot product divided by 127 to undo the quantization scale.
 *
 * @param {Float32Array} queryVec
 * @param {Int8Array} bin
 * @param {number} idx — chunk index inside `bin`
 * @returns {number}
 */
export function cosineQ8(queryVec, bin, idx) {
  let dot = 0;
  const base = idx * EMBED_DIM;
  for (let i = 0; i < EMBED_DIM; i++) {
    dot += queryVec[i] * bin[base + i];
  }
  return dot / 127;
}

/**
 * Lowercase, split on non-alphanumeric runs. Deliberately simple and
 * dependency-free: no stemming or stopword list — BM25's IDF already
 * downweights terms common across the corpus.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function tokenize(text) {
  return (
    String(text || "")
      .toLowerCase()
      .match(/[a-z0-9]+/g) || []
  );
}

/**
 * Build a compact in-memory BM25 index over an array of document strings.
 * Stores per-document term frequencies, document lengths, document
 * frequencies, and the average document length. Cheap for a few-hundred-chunk
 * corpus; no postings-list optimization needed at this scale.
 *
 * @param {string[]} texts
 * @returns {{N:number, avgdl:number, docLen:number[], tf:Array<Map<string,number>>, df:Map<string,number>}}
 */
export function buildBM25Index(texts) {
  const N = texts.length;
  const docLen = new Array(N);
  const tf = new Array(N);
  const df = new Map();
  let totalLen = 0;
  for (let i = 0; i < N; i++) {
    const toks = tokenize(texts[i]);
    docLen[i] = toks.length;
    totalLen += toks.length;
    const m = new Map();
    for (const t of toks) m.set(t, (m.get(t) || 0) + 1);
    tf[i] = m;
    for (const t of m.keys()) df.set(t, (df.get(t) || 0) + 1);
  }
  return { N, avgdl: N > 0 ? totalLen / N : 0, docLen, tf, df };
}

/**
 * Okapi BM25 score of every document in `index` against a tokenized query.
 * Returns a Float64Array of length `index.N`; a score of 0 means the document
 * shares no query term.
 *
 * @param {ReturnType<typeof buildBM25Index>} index
 * @param {string[]} queryTokens
 * @param {{k1?:number, b?:number}} [params]
 * @returns {Float64Array}
 */
export function bm25ScoreAll(
  index,
  queryTokens,
  { k1 = BM25_K1, b = BM25_B } = {},
) {
  const { N, avgdl, docLen, tf, df } = index;
  const scores = new Float64Array(N);
  const avg = avgdl || 1;
  for (const t of new Set(queryTokens)) {
    const dfi = df.get(t);
    if (!dfi) continue;
    const idf = Math.log(1 + (N - dfi + 0.5) / (dfi + 0.5));
    for (let i = 0; i < N; i++) {
      const f = tf[i].get(t);
      if (!f) continue;
      scores[i] +=
        (idf * (f * (k1 + 1))) / (f + k1 * (1 - b + (b * docLen[i]) / avg));
    }
  }
  return scores;
}

/**
 * Fuse a dense-cosine ranking and a BM25 ranking with Reciprocal Rank Fusion
 * over a bounded candidate pool.
 *
 * Candidate pool = {docs with cosine ≥ threshold} ∪ {top `bm25PoolSize` docs
 * by BM25 score > 0}. This union is what lets BM25 rescue a document dense
 * scored below `threshold` — the entire point of hybrid on lexical-mismatch
 * queries. Every pool member is then scored by RRF: `Σ 1/(RRF_K + rank_r)`
 * across the two rankers (rank is 1-based; a ranker that never ranked the doc
 * contributes 0). Dense ranks the whole corpus, so its contribution is always
 * present; BM25 contributes only when the doc shares a query term.
 *
 * @param {{cosine:Float64Array|number[], bm25:Float64Array|number[], threshold:number, topK:number, rrfK?:number, bm25PoolSize?:number, wDense?:number, wBm25?:number}} args
 * @returns {Array<{index:number, fusedScore:number, cosine:number, bm25:number, denseRank:number, bm25Rank:number}>}
 */
export function hybridFuse({
  cosine,
  bm25,
  threshold,
  topK,
  rrfK = RRF_K,
  bm25PoolSize = BM25_POOL_SIZE,
  wDense = RRF_W_DENSE,
  wBm25 = RRF_W_BM25,
}) {
  const N = cosine.length;
  const idx = Array.from({ length: N }, (_, i) => i);

  const denseOrder = idx.slice().sort((a, b) => cosine[b] - cosine[a]);
  const denseRank = new Int32Array(N);
  for (let r = 0; r < N; r++) denseRank[denseOrder[r]] = r + 1;

  const bm25Order = idx
    .filter((i) => bm25[i] > 0)
    .sort((a, b) => bm25[b] - bm25[a]);
  const bm25Rank = new Int32Array(N); // 0 = this ranker never ranked the doc
  for (let r = 0; r < bm25Order.length; r++) bm25Rank[bm25Order[r]] = r + 1;

  const pool = new Set();
  for (let i = 0; i < N; i++) if (cosine[i] >= threshold) pool.add(i);
  for (let r = 0; r < Math.min(bm25PoolSize, bm25Order.length); r++) {
    pool.add(bm25Order[r]);
  }

  const fused = [];
  for (const i of pool) {
    const dContrib = wDense / (rrfK + denseRank[i]);
    const bContrib = bm25Rank[i] ? wBm25 / (rrfK + bm25Rank[i]) : 0;
    fused.push({
      index: i,
      fusedScore: dContrib + bContrib,
      cosine: cosine[i],
      bm25: bm25[i],
      denseRank: denseRank[i],
      bm25Rank: bm25Rank[i],
    });
  }
  // Tie-break on cosine so equal-fusion ties fall back to semantic similarity.
  fused.sort((a, b) => b.fusedScore - a.fusedScore || b.cosine - a.cosine);
  return topK ? fused.slice(0, topK) : fused;
}

/**
 * De-quantize one stored Q8 chunk vector back to Float32 (÷127 undoes
 * embed.mjs's quantizeQ8 scale). Used only for chunk-to-chunk similarity in
 * MMR — retrieval ranking itself stays on the exact `cosineQ8` math.
 *
 * @param {Int8Array} bin
 * @param {number} idx
 * @returns {Float32Array}
 */
export function dequantizeQ8(bin, idx) {
  const v = new Float32Array(EMBED_DIM);
  const base = idx * EMBED_DIM;
  for (let i = 0; i < EMBED_DIM; i++) v[i] = bin[base + i] / 127;
  return v;
}

/**
 * Cosine similarity between two already-normalized Float32 vectors (both
 * came from L2-normalized-then-quantized embeddings, so no re-normalization
 * needed — same assumption `cosineQ8` makes).
 * @param {Float32Array} a
 * @param {Float32Array} b
 * @returns {number}
 */
export function cosineF32(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/**
 * Maximal Marginal Relevance reranking. Greedily selects `topK` candidates
 * from `pool` (already sorted by relevance) that balance relevance against
 * redundancy with what's already selected — so two near-duplicate chunks
 * (e.g. overlapping windows of the same section) don't both occupy scarce
 * top-K slots at the expense of a distinct, still-relevant section.
 *
 * `pool` must be a candidate set already filtered to relevant chunks (a
 * dense-threshold/hybrid-fusion pool) — MMR only ever reorders within it, it
 * cannot introduce an irrelevant chunk that wasn't already a candidate.
 *
 * @param {Array<{index:number, cosine:number}>} pool — sorted by relevance desc
 * @param {{topK:number, lambda?:number, getVector:(index:number)=>Float32Array}} args
 * @returns {Array<Object>} the same candidate objects, reordered/truncated to topK
 */
export function mmrRerank(pool, { topK, lambda = MMR_LAMBDA, getVector }) {
  if (pool.length <= topK) return pool.slice(0, topK);

  const vectors = new Map();
  const vecFor = (c) => {
    let v = vectors.get(c.index);
    if (!v) {
      v = getVector(c.index);
      vectors.set(c.index, v);
    }
    return v;
  };

  const remaining = pool.slice();
  const selected = [remaining.shift()]; // seed with the top-relevance candidate
  while (selected.length < topK && remaining.length) {
    let bestPos = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i];
      let maxSim = 0;
      for (const s of selected) {
        const sim = cosineF32(vecFor(cand), vecFor(s));
        if (sim > maxSim) maxSim = sim;
      }
      const mmrScore = lambda * cand.cosine - (1 - lambda) * maxSim;
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestPos = i;
      }
    }
    selected.push(remaining.splice(bestPos, 1)[0]);
  }
  return selected;
}

/**
 * All loaded chunks whose `citation` matches, in index (section/chunk) order.
 * Reads only the in-memory cache populated by a prior `query()`/`loadSource()`
 * — it never fetches — so a caller running right after `query()` (the
 * parent-child expansion in legalAnswerer) gets the retrieved chunk's siblings
 * for free, and a caller with a cold cache safely gets `[]`.
 *
 * @param {string} citation
 * @returns {Array<Object>}
 */
export function getChunksByCitation(citation) {
  const out = [];
  if (!citation) return out;
  for (const chunks of state.chunksBySource.values()) {
    for (const c of chunks) if (c.citation === citation) out.push(c);
  }
  return out;
}

/**
 * Lazily build + cache the per-source BM25 index over each chunk's `text`.
 * Cached alongside chunksBySource/vectorsBySource for the session.
 */
function getBM25(source) {
  const cached = state.bm25BySource.get(source);
  if (cached) return cached;
  const chunks = state.chunksBySource.get(source) || [];
  const index = buildBM25Index(chunks.map((c) => c.text));
  state.bm25BySource.set(source, index);
  return index;
}

/**
 * Retrieve top-K chunks across all sources in the loaded manifest.
 *
 * Hybrid by default (S21): the returned chunks are ordered by fused BM25 +
 * dense RRF score, not raw cosine. The `score` field stays the dense cosine
 * similarity (a meaningful 0..1 confidence for display, backwards-compatible
 * with legalAnswerer's citation rendering); the fused rank is exposed
 * separately as `fusedScore` (with `bm25`, `denseRank`, `bm25Rank` for
 * diagnostics). Pass `{ hybrid: false }` for legacy dense-only cosine.
 *
 * MMR diversity reranking (S22) always runs over a pool larger than `topK`
 * (`MMR_POOL_SIZE`) before truncating to `topK` — it can only reorder among
 * already-relevant candidates, never introduce a new one. Pass
 * `{ mmr: false }` to disable and return the raw relevance order.
 *
 * @param {string} text
 * @param {Object} [opts]
 * @param {number} [opts.topK=5]
 * @param {number} [opts.threshold=0.35]  — dense cosine floor for the pool
 * @param {boolean} [opts.hybrid=HYBRID_DEFAULT]
 * @param {boolean} [opts.mmr=true]
 * @param {string} [opts.version]
 * @returns {Promise<{
 *   query: string,
 *   version: string,
 *   chunks: Array<{
 *     id: string, source: string, citation: string, title: string,
 *     text: string, source_url: string, fetched_at: string, score: number,
 *     fusedScore: number, bm25: number, denseRank: number, bm25Rank: number,
 *   }>,
 * }>}
 */
export async function query(text, opts = {}) {
  const {
    topK = 5,
    threshold = 0.35,
    version = DEFAULT_VERSION,
    hybrid = HYBRID_DEFAULT,
    mmr = true,
  } = opts;
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return { query: text || "", version, chunks: [] };
  }

  const manifest = await loadManifest(version);
  const queryVec = await embedQuery(text);

  // Flatten all sources into one global candidate list so ranking is uniform
  // across sources (today there is one: ecfr). Dense cosine for every chunk;
  // BM25 (per-source index) merged into the same global arrays. `binRefs`
  // tracks where each flat entry's raw vector lives so MMR can dequantize it
  // on demand without re-fetching or re-flattening per source.
  const flatChunks = [];
  const cosine = [];
  const bm25 = [];
  const binRefs = [];
  const queryTokens = tokenize(text);
  for (const source of Object.keys(manifest.sources)) {
    await loadSource(source, version);
    const chunks = state.chunksBySource.get(source);
    const bin = state.vectorsBySource.get(source);
    const bm25Scores = hybrid
      ? bm25ScoreAll(getBM25(source), queryTokens)
      : null;
    for (let i = 0; i < chunks.length; i++) {
      flatChunks.push(chunks[i]);
      cosine.push(cosineQ8(queryVec, bin, i));
      bm25.push(bm25Scores ? bm25Scores[i] : 0);
      binRefs.push({ bin, localIndex: i });
    }
  }

  // MMR needs a pool bigger than topK to have anything to diversify among.
  const poolSize = mmr ? Math.max(topK, MMR_POOL_SIZE) : topK;

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

  if (mmr) {
    ranked = mmrRerank(ranked, {
      topK,
      getVector: (index) => {
        const { bin, localIndex } = binRefs[index];
        return dequantizeQ8(bin, localIndex);
      },
    });
  } else {
    ranked = ranked.slice(0, topK);
  }

  const out = ranked.map((r) => {
    const chunk = flatChunks[r.index];
    return {
      id: chunk.id,
      source: chunk.source,
      citation: chunk.citation,
      title: chunk.title,
      text: chunk.text,
      source_url: chunk.source_url,
      fetched_at: chunk.fetched_at,
      score: r.cosine,
      fusedScore: r.fusedScore,
      bm25: r.bm25,
      denseRank: r.denseRank,
      bm25Rank: r.bm25Rank,
    };
  });

  return { query: text, version, chunks: out };
}

/**
 * Test/diagnostic helper — flush every cache so the next call re-fetches
 * the manifest, sources, and embedder.
 */
export function _resetForTesting() {
  state.manifest = null;
  state.manifestVersion = null;
  state.chunksBySource.clear();
  state.vectorsBySource.clear();
  state.bm25BySource.clear();
  state.embedder = null;
  state.embedderPromise = null;
}
