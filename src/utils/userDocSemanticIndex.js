/**
 * Vet-Rate.org - User-Document Semantic Index (S24)
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * In-browser semantic search over a veteran's OWN uploaded documents
 * (C-Files, DD-214s, rating decisions). 100% client-side: page text and the
 * vectors derived from it never leave the device — this module makes ZERO
 * network calls. The only weights ever fetched are the shared bge-small
 * embedder's, downloaded once by `src/services/legalRag.js` (a one-time
 * model-weights download, not user data), and reused here via `embedText`.
 *
 * Design (mirrors the proven C-File streaming discipline in pdfExtractor.js):
 *   - Pages are embedded and their Int8-quantized vectors written to IndexedDB
 *     in bounded batches, so peak JS-heap use is one batch's worth of vectors
 *     (EMBED_BATCH_SIZE) regardless of document size. The full corpus's vectors
 *     are NEVER all held in memory at once — this is what keeps the 313 MB /
 *     5,000-page streaming guarantee intact when indexing runs in the same flow.
 *   - Search brute-force cosine-scans the stored vectors via an IndexedDB
 *     cursor (one vector visited at a time), aggregating to page-level results.
 *     A single user's single document set is dozens–low-thousands of pages, so
 *     brute-force is sub-10 ms and ANN/BM25/hybrid would be over-engineering
 *     (same rationale legalRag applied to the legal corpus's pre-hybrid design).
 *
 * Chunk granularity: the PDF PAGE is the primary unit (matches the veteran-
 * facing "found on page N" citation model and the NVIDIA study's finding that
 * page-level chunking is the most robust baseline). bge-small truncates input
 * past ~512 tokens (~1,740 chars of dense OCR text), so a page longer than
 * MAX_EMBED_CHARS is split into overlapping windows — each stored against the
 * same page number, search taking the max window similarity per page. Windowing
 * exists precisely so a dense page's tail is not silently unsearchable, which
 * is the same "no silent evidence loss" goal this sprint targets.
 *
 * Embedding dimension: bge-small-en-v1.5 emits 384 dims natively and is NOT
 * Matryoshka-trained, so truncating dims to "device-tier" would degrade recall
 * with no eval to justify it (Matryoshka reduction is explicitly deferred to
 * S25). A device-capability hook exists (deviceCapabilityDetector.js) but is
 * not wired to this path for that reason — a documented conservative fixed
 * default (full 384 dims, Int8-quantized = 384 bytes/vector, ~1.9 MB for a
 * 5,000-page doc), matching the S21 precedent for un-tiered new code paths.
 */

import { embedText, EMBED_DIM } from "../services/legalRag";

// --- Storage ---------------------------------------------------------------
const USERDOC_DB_NAME = "VetRate_UserDocVectors";
const USERDOC_DB_VERSION = 1;
const VECTOR_STORE = "page_vectors";
const SESSION_INDEX = "by_session";

// --- Streaming / chunking budgets ------------------------------------------
// Peak in-memory vectors during indexing = one batch. 20 mirrors the 20-page
// IDB batch pdfExtractor.js already flushes, so the two streaming passes share
// the same bounded-memory discipline.
export const EMBED_BATCH_SIZE = 20;
// ~512-token embedder ceiling ≈ 1,740 chars of dense OCR text (3.4 chars/token);
// 1,500 leaves margin so no window is silently truncated at the model boundary.
export const MAX_EMBED_CHARS = 1500;
// ~13% overlap so evidence straddling a window boundary is not lost (the NVIDIA
// sweep found ~15% overlap optimal; 200/1500 ≈ 13% is within that band).
const WINDOW_OVERLAP_CHARS = 200;
// A page with fewer alphanumerics than this is a scanned separator / blank —
// nothing to embed. Counted and reported, never silently dropped.
const MIN_PAGE_ALNUM = 15;
// Stored context shown next to each search hit; large enough to orient the
// veteran, small enough that snippets don't dominate storage.
const SNIPPET_CHARS = 240;

// ---------------------------------------------------------------------------
// Page parsing
// ---------------------------------------------------------------------------

/**
 * Split page-marked C-File text (`--- PAGE N ---`) into per-page records.
 * Preserves EVERY page's real page number for citation. Text with no markers
 * is treated as a single page.
 *
 * @param {string} fullText
 * @returns {Array<{pageNumber:number, text:string}>}
 */
export function parsePages(fullText) {
  const src = String(fullText || "");
  // eslint-disable-next-line sonarjs/slow-regex -- input is the user's own uploaded document text, not attacker-controlled
  const markerRe = /--- PAGE (\d+)[^\n]*---/g;
  const markers = [...src.matchAll(markerRe)];
  if (markers.length === 0) {
    const t = src.trim();
    return t ? [{ pageNumber: 1, text: t }] : [];
  }
  const pages = [];
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].index + markers[i][0].length;
    const end = i + 1 < markers.length ? markers[i + 1].index : src.length;
    pages.push({
      pageNumber: parseInt(markers[i][1], 10),
      text: src.slice(start, end).trim(),
    });
  }
  return pages;
}

/**
 * Split one page's text into overlapping windows no longer than `maxChars`,
 * so nothing past the embedder's token ceiling is silently dropped.
 *
 * @param {string} text
 * @param {number} [maxChars=MAX_EMBED_CHARS]
 * @param {number} [overlap=WINDOW_OVERLAP_CHARS]
 * @returns {string[]}
 */
export function chunkPageText(
  text,
  maxChars = MAX_EMBED_CHARS,
  overlap = WINDOW_OVERLAP_CHARS,
) {
  const t = String(text || "");
  if (t.length <= maxChars) return t ? [t] : [];
  const step = Math.max(1, maxChars - overlap);
  const windows = [];
  for (let start = 0; start < t.length; start += step) {
    windows.push(t.slice(start, start + maxChars));
    if (start + maxChars >= t.length) break;
  }
  return windows;
}

// ---------------------------------------------------------------------------
// Quantization + similarity (same math as legalRag.js / embed.mjs)
// ---------------------------------------------------------------------------

/**
 * Quantize an L2-normalized Float32 vector to Int8 (×127, clamped). Halves
 * storage vs Float32 and matches the legal index's stored representation.
 * @param {Float32Array} f32
 * @returns {Int8Array}
 */
export function quantizeQ8(f32) {
  const out = new Int8Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    out[i] = Math.max(-127, Math.min(127, Math.round(f32[i] * 127)));
  }
  return out;
}

/**
 * Cosine similarity between a Float32 (normalized) query vector and an Int8
 * stored vector. Both are unit-length, so this is the dot product ÷127.
 * @param {Float32Array} queryVec
 * @param {Int8Array} bin
 * @returns {number}
 */
export function cosineQ8(queryVec, bin) {
  let dot = 0;
  const n = Math.min(queryVec.length, bin.length);
  for (let i = 0; i < n; i++) dot += queryVec[i] * bin[i];
  return dot / 127;
}

// ---------------------------------------------------------------------------
// Default IndexedDB-backed store
// ---------------------------------------------------------------------------

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(USERDOC_DB_NAME, USERDOC_DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(VECTOR_STORE)) {
        const store = db.createObjectStore(VECTOR_STORE, { keyPath: "id" });
        store.createIndex(SESSION_INDEX, "sessionKey", { unique: false });
      }
    };
  });
}

/**
 * Open the IndexedDB-backed vector store. The returned object is the `store`
 * dependency `indexDocumentPages`/`semanticSearchDocument` accept — tests pass
 * an in-memory implementation of the same shape instead, so the streaming,
 * ranking, and privacy logic is fully unit-testable without a real IDB.
 *
 * @returns {Promise<{putBatch:Function, scan:Function, clear:Function, count:Function, close:Function}>}
 */
export async function createIdbStore() {
  const db = await openDB();
  return {
    putBatch(records) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(VECTOR_STORE, "readwrite");
        const store = tx.objectStore(VECTOR_STORE);
        for (const r of records) store.put(r);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    scan(sessionKey, visitor) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(VECTOR_STORE, "readonly");
        const idx = tx.objectStore(VECTOR_STORE).index(SESSION_INDEX);
        const req = idx.openCursor(IDBKeyRange.only(sessionKey));
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) {
            resolve();
            return;
          }
          visitor(cursor.value);
          cursor.continue();
        };
      });
    },
    clear(sessionKey) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(VECTOR_STORE, "readwrite");
        const store = tx.objectStore(VECTOR_STORE);
        if (sessionKey == null) {
          store.clear();
        } else {
          const req = store
            .index(SESSION_INDEX)
            .openCursor(IDBKeyRange.only(sessionKey));
          req.onsuccess = () => {
            const cursor = req.result;
            if (cursor) {
              cursor.delete();
              cursor.continue();
            }
          };
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    count(sessionKey) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(VECTOR_STORE, "readonly");
        const idx = tx.objectStore(VECTOR_STORE).index(SESSION_INDEX);
        const req = idx.count(IDBKeyRange.only(sessionKey));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },
    close() {
      db.close();
    },
  };
}

// ---------------------------------------------------------------------------
// Indexing (streaming, bounded-memory)
// ---------------------------------------------------------------------------

/**
 * Stream-embed EVERY content page of a document into the vector store.
 *
 * Independent of any downstream AI-analysis cap: a page excluded from the slow
 * local-AI pass (because it scored below the relevance floor / top-N cap) is
 * still embedded and searchable here. That is the whole point — the semantic
 * layer retains 100% of pages even when the AI pass, for time-budget reasons,
 * reads only a subset.
 *
 * Peak in-memory vectors is bounded by `batchSize`: vectors are flushed to the
 * store and dropped from the heap as soon as a batch fills, so a 5,000-page
 * document costs the same peak memory as a 20-page one.
 *
 * @param {Object} args
 * @param {string} [args.fullText]         Page-marked document text (or pass `pages`)
 * @param {Array<{pageNumber:number,text:string}>} [args.pages]
 * @param {string} args.sessionKey         Namespace for this document's vectors
 * @param {Function} [args.embed=embedText] text → Promise<Float32Array>
 * @param {Object} [args.store]            Injected store; defaults to IDB
 * @param {number} [args.batchSize=EMBED_BATCH_SIZE]
 * @param {Function} [args.onProgress]     (pagesDone, pagesTotal) => void
 * @param {AbortSignal} [args.signal]
 * @param {boolean} [args.clearPrevious=true] Wipe prior sessions to bound storage
 * @returns {Promise<{sessionKey, pageCount, indexedPages, emptyPages, vectorCount}>}
 */
export async function indexDocumentPages({
  fullText,
  pages,
  sessionKey,
  embed = embedText,
  store,
  batchSize = EMBED_BATCH_SIZE,
  onProgress = () => {},
  signal,
  clearPrevious = true,
}) {
  if (!sessionKey) throw new Error("indexDocumentPages: sessionKey required");
  const pageList = pages || parsePages(fullText);
  const ownStore = !store;
  const vecStore = store || (await createIdbStore());

  try {
    // Single active document at a time in the C-File UI: clearing prior
    // sessions keeps IndexedDB from growing without bound across analyses.
    if (clearPrevious) await vecStore.clear(null);

    let vectorCount = 0;
    let indexedPages = 0;
    let emptyPages = 0;
    let batch = [];
    const flush = async () => {
      if (batch.length) {
        await vecStore.putBatch(batch);
        batch = [];
      }
    };

    for (let pi = 0; pi < pageList.length; pi++) {
      if (signal?.aborted) throw new Error("Semantic indexing cancelled");
      const { pageNumber, text } = pageList[pi];
      const clean = String(text || "").trim();
      const alnum = (clean.match(/[a-z0-9]/gi) || []).length;
      if (alnum < MIN_PAGE_ALNUM) {
        emptyPages++;
        onProgress(pi + 1, pageList.length);
        continue;
      }

      const windows = chunkPageText(clean);
      for (let wi = 0; wi < windows.length; wi++) {
        const vec = await embed(windows[wi]);
        batch.push({
          id: `${sessionKey}:${pageNumber}:${wi}`,
          sessionKey,
          pageNumber,
          chunkIndex: wi,
          dim: EMBED_DIM,
          vector: quantizeQ8(vec),
          snippet: windows[wi].slice(0, SNIPPET_CHARS),
        });
        vectorCount++;
        // Flush INSIDE the window loop so even a very dense multi-window page
        // cannot push the in-flight buffer past one batch.
        if (batch.length >= batchSize) await flush();
      }
      indexedPages++;
      onProgress(pi + 1, pageList.length);
    }

    await flush();
    return {
      sessionKey,
      pageCount: pageList.length,
      indexedPages,
      emptyPages,
      vectorCount,
    };
  } finally {
    if (ownStore && vecStore.close) vecStore.close();
  }
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Semantic search over a previously-indexed document. Embeds the query with
 * the SAME shared embedder, cosine-ranks against stored page vectors, and
 * returns page-level hits (best window per page), highest score first.
 *
 * @param {Object} args
 * @param {string} args.sessionKey
 * @param {string} args.queryText
 * @param {number} [args.topK=10]
 * @param {number} [args.minScore=0]  Drop hits below this cosine score
 * @param {Function} [args.embed=embedText]
 * @param {Object} [args.store]
 * @returns {Promise<Array<{page:number, score:number, snippet:string}>>}
 */
export async function semanticSearchDocument({
  sessionKey,
  queryText,
  topK = 10,
  minScore = 0,
  embed = embedText,
  store,
}) {
  if (!sessionKey || !queryText || !queryText.trim()) return [];
  const queryVec = await embed(queryText);
  const ownStore = !store;
  const vecStore = store || (await createIdbStore());
  try {
    // Aggregate to one entry per page (best window) — bounded by page count,
    // not vector count. The cursor visits vectors one at a time.
    const byPage = new Map();
    await vecStore.scan(sessionKey, (rec) => {
      const score = cosineQ8(queryVec, rec.vector);
      const prev = byPage.get(rec.pageNumber);
      if (!prev || score > prev.score) {
        byPage.set(rec.pageNumber, {
          page: rec.pageNumber,
          score,
          snippet: rec.snippet,
        });
      }
    });
    return [...byPage.values()]
      .filter((r) => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  } finally {
    if (ownStore && vecStore.close) vecStore.close();
  }
}

/**
 * Number of stored vectors for a session (0 if never indexed / cleared).
 * @param {string} sessionKey
 * @param {Object} [store]
 * @returns {Promise<number>}
 */
export async function getIndexedVectorCount(sessionKey, store) {
  const ownStore = !store;
  const vecStore = store || (await createIdbStore());
  try {
    return await vecStore.count(sessionKey);
  } finally {
    if (ownStore && vecStore.close) vecStore.close();
  }
}

/**
 * Delete one document's vectors (or all if `sessionKey` is null).
 * @param {string|null} sessionKey
 * @param {Object} [store]
 */
export async function clearDocumentIndex(sessionKey, store) {
  const ownStore = !store;
  const vecStore = store || (await createIdbStore());
  try {
    await vecStore.clear(sessionKey);
  } finally {
    if (ownStore && vecStore.close) vecStore.close();
  }
}
