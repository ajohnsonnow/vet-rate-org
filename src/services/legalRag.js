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

const state = {
  manifest: null,
  manifestVersion: null,
  chunksBySource: new Map(),
  vectorsBySource: new Map(),
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
 * Retrieve top-K chunks across all sources in the loaded manifest.
 *
 * @param {string} text
 * @param {Object} [opts]
 * @param {number} [opts.topK=5]
 * @param {number} [opts.threshold=0.35]  — drop matches below this cosine
 * @param {string} [opts.version]
 * @returns {Promise<{
 *   query: string,
 *   version: string,
 *   chunks: Array<{
 *     id: string, source: string, citation: string, title: string,
 *     text: string, source_url: string, fetched_at: string, score: number,
 *   }>,
 * }>}
 */
export async function query(text, opts = {}) {
  const { topK = 5, threshold = 0.35, version = DEFAULT_VERSION } = opts;
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return { query: text || "", version, chunks: [] };
  }

  const manifest = await loadManifest(version);
  const queryVec = await embedQuery(text);

  const scored = [];
  for (const source of Object.keys(manifest.sources)) {
    await loadSource(source, version);
    const chunks = state.chunksBySource.get(source);
    const bin = state.vectorsBySource.get(source);
    for (let i = 0; i < chunks.length; i++) {
      const score = cosineQ8(queryVec, bin, i);
      if (score < threshold) continue;
      scored.push({ chunk: chunks[i], score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const out = scored.slice(0, topK).map(({ chunk, score }) => ({
    id: chunk.id,
    source: chunk.source,
    citation: chunk.citation,
    title: chunk.title,
    text: chunk.text,
    source_url: chunk.source_url,
    fetched_at: chunk.fetched_at,
    score,
  }));

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
  state.embedder = null;
  state.embedderPromise = null;
}
