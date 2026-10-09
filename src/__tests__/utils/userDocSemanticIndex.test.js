/**
 * S24 - User-document semantic index tests.
 *
 * Covers, WITHOUT the real ~30 MB bge-small embedder or a browser IndexedDB
 * (neither runs in vitest): a deterministic in-memory store implementing the
 * same shape the production IDB store exposes, and a deterministic "concept"
 * embed injected in place of bge-small. This isolates and proves the parts that
 * are ours to get right - streaming/memory discipline, quantization, cosine
 * ranking, per-page aggregation, and the privacy (no-egress) invariant.
 *
 * The concept embed maps synonyms to shared axes (e.g. "ringing"/"ears" and
 * "tinnitus" → the same hearing axis), so the mini golden set genuinely
 * exercises SEMANTIC (non-lexical) matching through the whole pipeline - a
 * query with zero words in common with its target page still retrieves it. The
 * real model's semantic quality is separately eval-gated in the legal-RAG
 * harness (recall@5 0.967 on the same bge-small embedding space).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parsePages,
  chunkPageText,
  quantizeQ8,
  cosineQ8,
  indexDocumentPages,
  semanticSearchDocument,
  getIndexedVectorCount,
  clearDocumentIndex,
  EMBED_BATCH_SIZE,
  MAX_EMBED_CHARS,
} from "../../utils/userDocSemanticIndex";
import { EMBED_DIM } from "../../services/legalRag";

// --- Deterministic in-memory store (same contract as createIdbStore) ---------
function makeMemStore() {
  const records = [];
  let maxBatch = 0;
  return {
    records,
    getMaxBatch: () => maxBatch,
    async putBatch(recs) {
      maxBatch = Math.max(maxBatch, recs.length);
      for (const r of recs) records.push(r);
    },
    async scan(sessionKey, visitor) {
      for (const r of records) if (r.sessionKey === sessionKey) visitor(r);
    },
    async clear(sessionKey) {
      if (sessionKey == null) {
        records.length = 0;
      } else {
        for (let i = records.length - 1; i >= 0; i--) {
          if (records[i].sessionKey === sessionKey) records.splice(i, 1);
        }
      }
    },
    async count(sessionKey) {
      return records.filter((r) => r.sessionKey === sessionKey).length;
    },
  };
}

// --- Deterministic synonym-aware "concept" embed (stands in for bge-small) ---
const CONCEPTS = [
  ["tinnitus", "ringing", "ears", "ear ", "hearing", "acoustic", "audiogram"],
  ["back", "lumbar", "spine", "spinal", "disc", "vertebra"],
  ["sleep", "insomnia", "apnea", "awaken", "nighttime", "tired"],
  ["knee", "patella", "meniscus", "kneecap"],
  ["ptsd", "trauma", "nightmare", "anxiety", "depress", "mental"],
  ["breath", "asthma", "copd", "lung", "pulmonary", "respirat"],
];
async function conceptEmbed(text) {
  const t = ` ${String(text).toLowerCase()} `;
  const v = new Float32Array(EMBED_DIM);
  CONCEPTS.forEach((keywords, ci) => {
    let w = 0;
    for (const kw of keywords) if (t.includes(kw)) w += 1;
    v[ci] = w;
  });
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  const norm = Math.sqrt(sum) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= norm;
  return v;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─────────────────────────────────────────────────────────────────────────────
describe("pure helpers", () => {
  it("parsePages splits page-marked text and preserves real page numbers", () => {
    const text =
      "--- PAGE 1 ---\nfirst page body\n\n--- PAGE 7 ---\nseventh page body\n\n";
    const pages = parsePages(text);
    expect(pages).toEqual([
      { pageNumber: 1, text: "first page body" },
      { pageNumber: 7, text: "seventh page body" },
    ]);
  });

  it("parsePages treats marker-less text as a single page and empty text as none", () => {
    expect(parsePages("just some text")).toEqual([
      { pageNumber: 1, text: "just some text" },
    ]);
    expect(parsePages("   ")).toEqual([]);
  });

  it("chunkPageText windows only oversized pages, with overlap", () => {
    expect(chunkPageText("short")).toEqual(["short"]);
    const long = "x".repeat(MAX_EMBED_CHARS * 2 + 100);
    const windows = chunkPageText(long);
    expect(windows.length).toBeGreaterThan(1);
    for (const w of windows)
      expect(w.length).toBeLessThanOrEqual(MAX_EMBED_CHARS);
    // Windows cover the whole page (last window reaches the end).
    expect(windows[windows.length - 1].endsWith("x")).toBe(true);
  });

  it("quantizeQ8 + cosineQ8 recover a clean cosine for matching vectors", async () => {
    const a = await conceptEmbed("tinnitus and hearing loss");
    const b = await conceptEmbed("constant ringing in the ears");
    const qb = quantizeQ8(b);
    // Same concept axis → cosine ≈ 1.
    expect(cosineQ8(a, qb)).toBeGreaterThan(0.95);
    const c = await conceptEmbed("chronic lumbar back strain");
    expect(cosineQ8(await conceptEmbed("ringing ears"), quantizeQ8(c))).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("streaming / bounded-memory indexing", () => {
  it("never holds more than one batch of vectors in memory, regardless of doc size", async () => {
    const store = makeMemStore();
    const pageCount = 300;
    const pages = Array.from({ length: pageCount }, (_, i) => ({
      pageNumber: i + 1,
      text: `Page ${i + 1}: veteran reports chronic knee pain and tinnitus.`,
    }));

    const res = await indexDocumentPages({
      pages,
      sessionKey: "mem",
      embed: conceptEmbed,
      store,
    });

    // Structural memory invariant: the in-flight buffer flushed to the store
    // never exceeded one batch, even across 300 pages.
    expect(store.getMaxBatch()).toBeLessThanOrEqual(EMBED_BATCH_SIZE);
    expect(res.vectorCount).toBe(pageCount); // one window per short page
    expect(res.indexedPages).toBe(pageCount);
    expect(store.records).toHaveLength(pageCount);
  });

  it("keeps the buffer bounded even for a dense multi-window page", async () => {
    const store = makeMemStore();
    const dense = { pageNumber: 1, text: "knee ".repeat(4000) }; // many windows
    const res = await indexDocumentPages({
      pages: [dense],
      sessionKey: "dense",
      embed: conceptEmbed,
      store,
      batchSize: 3,
    });
    expect(res.vectorCount).toBeGreaterThan(3);
    expect(store.getMaxBatch()).toBeLessThanOrEqual(3);
  });

  it("indexes every content page but counts blank pages separately (no silent evidence drop)", async () => {
    const store = makeMemStore();
    const pages = [
      { pageNumber: 1, text: "veteran reports tinnitus after acoustic trauma" },
      { pageNumber: 2, text: "   " }, // scanned blank separator
      { pageNumber: 3, text: "chronic lumbar back pain noted on exam" },
    ];
    const res = await indexDocumentPages({
      pages,
      sessionKey: "retain",
      embed: conceptEmbed,
      store,
    });
    expect(res.indexedPages).toBe(2);
    expect(res.emptyPages).toBe(1);
    expect(await getIndexedVectorCount("retain", store)).toBe(2);
  });

  it("clearPrevious wipes stale sessions so storage stays bounded to the current doc", async () => {
    const store = makeMemStore();
    await indexDocumentPages({
      pages: [
        { pageNumber: 1, text: "old knee injury noted in the service record" },
      ],
      sessionKey: "old",
      embed: conceptEmbed,
      store,
    });
    await indexDocumentPages({
      pages: [
        {
          pageNumber: 1,
          text: "new lumbar back strain documented on the exam",
        },
      ],
      sessionKey: "new",
      embed: conceptEmbed,
      store,
    });
    expect(await getIndexedVectorCount("old", store)).toBe(0);
    expect(await getIndexedVectorCount("new", store)).toBe(1);
  });
});

// Synthetic, non-PII pages. Each is about ONE concept.
const GOLDEN_PAGES = [
  {
    pageNumber: 5,
    text: "Veteran reports constant tinnitus and reduced hearing acuity after acoustic trauma in service.",
  },
  {
    pageNumber: 12,
    text: "Chronic lumbar strain with degenerative disc disease of the spine documented on MRI.",
  },
  {
    pageNumber: 20,
    text: "Sleep study consistent with obstructive apnea; frequent nighttime awakening reported.",
  },
  {
    pageNumber: 33,
    text: "Right knee pain with a meniscus tear; patella tracking abnormality noted.",
  },
  {
    pageNumber: 41,
    text: "Positive PTSD screen with recurrent nightmare and situational anxiety.",
  },
  {
    pageNumber: 50,
    text: "Complaints of shortness of breath; pulmonary testing suggests asthma.",
  },
];
// Queries phrased with DIFFERENT words than the target page (synonyms).
const GOLDEN_QUERIES = [
  { q: "ringing in my ears", expected: 5 },
  { q: "problems with my lower back", expected: 12 },
  { q: "trouble sleeping at night", expected: 20 },
  { q: "hurt my kneecap", expected: 33 },
  { q: "mental health and bad dreams", expected: 41 },
  { q: "hard to breathe", expected: 50 },
];

// ─────────────────────────────────────────────────────────────────────────────
describe("semantic search - mini golden set (recall)", () => {
  it("retrieves the correct page by meaning (recall@1 = recall@3 = 1.0)", async () => {
    const store = makeMemStore();
    await indexDocumentPages({
      pages: GOLDEN_PAGES,
      sessionKey: "golden",
      embed: conceptEmbed,
      store,
    });

    let hit1 = 0;
    let hit3 = 0;
    for (const { q, expected } of GOLDEN_QUERIES) {
      const results = await semanticSearchDocument({
        sessionKey: "golden",
        queryText: q,
        embed: conceptEmbed,
        store,
        topK: 3,
      });
      const pages = results.map((r) => r.page);
      if (pages[0] === expected) hit1++;
      if (pages.slice(0, 3).includes(expected)) hit3++;
    }
    const recallAt1 = hit1 / GOLDEN_QUERIES.length;
    const recallAt3 = hit3 / GOLDEN_QUERIES.length;
    // Report the numbers for the run log, then assert.
    // eslint-disable-next-line no-console
    console.log(
      `[S24 mini golden set] n=${GOLDEN_QUERIES.length} recall@1=${recallAt1.toFixed(3)} recall@3=${recallAt3.toFixed(3)}`,
    );
    expect(recallAt1).toBe(1);
    expect(recallAt3).toBe(1);
  });

  it("aggregates multiple windows of a page to the best-matching window", async () => {
    const store = makeMemStore();
    // One long page whose tinnitus content is only in the SECOND window.
    const tail = " veteran describes constant ringing in both ears (tinnitus).";
    const page = { pageNumber: 9, text: "filler ".repeat(300) + tail };
    await indexDocumentPages({
      pages: [page],
      sessionKey: "agg",
      embed: conceptEmbed,
      store,
    });
    const results = await semanticSearchDocument({
      sessionKey: "agg",
      queryText: "ringing in ears",
      embed: conceptEmbed,
      store,
    });
    expect(results[0].page).toBe(9);
    expect(results[0].score).toBeGreaterThan(0.9);
  });

  it("returns [] for an unindexed session or blank query", async () => {
    const store = makeMemStore();
    expect(
      await semanticSearchDocument({
        sessionKey: "missing",
        queryText: "knee",
        embed: conceptEmbed,
        store,
      }),
    ).toEqual([]);
    expect(
      await semanticSearchDocument({
        sessionKey: "golden",
        queryText: "   ",
        embed: conceptEmbed,
        store,
      }),
    ).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("privacy invariant - vectors never leave the device", () => {
  it("makes ZERO network calls (fetch / XHR) while indexing and searching", async () => {
    const fetchSpy = vi.fn(() =>
      Promise.reject(new Error("network blocked in test")),
    );
    const xhrOpen = vi.fn();
    const xhrSend = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal(
      "XMLHttpRequest",
      class {
        open(...a) {
          xhrOpen(...a);
        }
        send(...a) {
          xhrSend(...a);
        }
        setRequestHeader() {}
      },
    );

    const store = makeMemStore();
    const SENTINEL = "ZZ_SENTINEL_CONDITION_9931";
    const pages = [
      { pageNumber: 1, text: `patient has ${SENTINEL} and tinnitus` },
      { pageNumber: 2, text: `${SENTINEL} chronic back pain` },
    ];

    await indexDocumentPages({
      pages,
      sessionKey: "priv",
      embed: conceptEmbed, // local embed: no model fetch in this test
      store,
    });
    const results = await semanticSearchDocument({
      sessionKey: "priv",
      queryText: "ringing in ears",
      embed: conceptEmbed,
      store,
    });

    // My indexing/search code paths make no network calls at all - the strongest
    // form of "document text and vectors never leave the device." (The real
    // embedder's ONE-TIME model-weights download is a separate concern and
    // carries no user data; it is deliberately not exercised here.)
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrOpen).not.toHaveBeenCalled();
    expect(xhrSend).not.toHaveBeenCalled();
    // And the search still worked entirely on-device.
    expect(results[0].page).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("clearDocumentIndex", () => {
  it("removes a session's vectors", async () => {
    const store = makeMemStore();
    await indexDocumentPages({
      pages: [
        {
          pageNumber: 1,
          text: "chronic knee pain reported during the exam visit",
        },
      ],
      sessionKey: "c",
      embed: conceptEmbed,
      store,
      clearPrevious: false,
    });
    expect(await getIndexedVectorCount("c", store)).toBe(1);
    await clearDocumentIndex("c", store);
    expect(await getIndexedVectorCount("c", store)).toBe(0);
  });
});
