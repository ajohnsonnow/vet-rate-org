import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  cosineQ8,
  _resetForTesting,
  tokenize,
  buildBM25Index,
  bm25ScoreAll,
  hybridFuse,
  getChunksByCitation,
  RRF_K,
  RRF_W_DENSE,
  RRF_W_BM25,
  mmrRerank,
  dequantizeQ8,
  cosineF32,
} from "../../services/legalRag.js";

const EMBED_DIM = 384;

function mkBin(vectors) {
  const buf = new Int8Array(vectors.length * EMBED_DIM);
  for (let v = 0; v < vectors.length; v++) {
    for (let i = 0; i < EMBED_DIM; i++) buf[v * EMBED_DIM + i] = vectors[v][i];
  }
  return buf;
}

function unitVecQ8(seed) {
  const f = new Float32Array(EMBED_DIM);
  let sum = 0;
  for (let i = 0; i < EMBED_DIM; i++) {
    f[i] = Math.sin((i + 1) * (seed + 1) * 0.1);
    sum += f[i] * f[i];
  }
  const norm = Math.sqrt(sum) || 1;
  const q = new Int8Array(EMBED_DIM);
  for (let i = 0; i < EMBED_DIM; i++) {
    const v = f[i] / norm;
    q[i] = Math.round(Math.max(-1, Math.min(1, v)) * 127);
  }
  return { f32: Float32Array.from(q, (x) => x / 127), q8: q };
}

function toUnitFloat32(q8) {
  return Float32Array.from(q8, (v) => v / 127);
}

describe("legalRag - cosineQ8", () => {
  it("identical normalized vectors score ~1.0", () => {
    const { f32, q8 } = unitVecQ8(1);
    const bin = mkBin([Array.from(q8)]);
    const score = cosineQ8(f32, bin, 0);
    expect(score).toBeGreaterThan(0.99);
    expect(score).toBeLessThanOrEqual(1.01);
  });

  it("opposite vectors score ~-1.0", () => {
    const { f32, q8 } = unitVecQ8(2);
    const negQ8 = Int8Array.from(q8, (v) => -v);
    const bin = mkBin([Array.from(negQ8)]);
    const score = cosineQ8(f32, bin, 0);
    expect(score).toBeLessThan(-0.99);
  });

  it("indexes into the right slice", () => {
    const a = unitVecQ8(3);
    const b = unitVecQ8(4);
    const bin = mkBin([Array.from(a.q8), Array.from(b.q8)]);
    expect(cosineQ8(a.f32, bin, 0)).toBeGreaterThan(0.99);
    expect(cosineQ8(b.f32, bin, 1)).toBeGreaterThan(0.99);
    // cross-slice should not exceed self-similarity
    expect(cosineQ8(a.f32, bin, 1)).toBeLessThan(0.99);
  });
});

function buildEcfrChunksJsonl() {
  return [
    {
      id: "ecfr/4.71a/0",
      source: "ecfr",
      citation: "38 CFR § 4.71a",
      title: "Schedule of ratings-musculoskeletal",
      text: "musculoskeletal text",
      source_url: "https://www.ecfr.gov/section-4.71a",
      fetched_at: "2026-05-15T00:00:00Z",
      content_hash: "sha256:aaa",
      parent_hash: "sha256:aaa",
    },
    {
      id: "ecfr/4.71a/1",
      source: "ecfr",
      citation: "38 CFR § 4.71a",
      title: "Schedule of ratings-musculoskeletal",
      text: "more knee text",
      source_url: "https://www.ecfr.gov/section-4.71a",
      fetched_at: "2026-05-15T00:00:00Z",
      content_hash: "sha256:bbb",
      parent_hash: "sha256:aaa",
    },
    {
      id: "ecfr/4.1/0",
      source: "ecfr",
      citation: "38 CFR § 4.1",
      title: "Essentials of evaluative rating",
      text: "essentials text",
      source_url: "https://www.ecfr.gov/section-4.1",
      fetched_at: "2026-05-15T00:00:00Z",
      content_hash: "sha256:ccc",
      parent_hash: "sha256:ccc",
    },
  ]
    .map((r) => JSON.stringify(r))
    .join("\n");
}

function mockEcfrFetch({ manifest, chunksJsonl, bin }) {
  return vi.fn(async (url) => {
    if (url.endsWith("/manifest.json")) {
      return new Response(JSON.stringify(manifest), { status: 200 });
    }
    if (url.endsWith("/chunks/ecfr.jsonl")) {
      return new Response(chunksJsonl, { status: 200 });
    }
    if (url.endsWith("/vectors/ecfr.bin")) {
      return new Response(bin.buffer, { status: 200 });
    }
    return new Response("not found", { status: 404 });
  });
}

describe("legalRag - query() integration with mocked fetch + embedder", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    _resetForTesting();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    _resetForTesting();
    vi.resetModules();
  });

  it("returns top-K chunks sorted by score above threshold", async () => {
    const a = unitVecQ8(10);
    const b = unitVecQ8(11);
    const c = unitVecQ8(12);
    const chunksJsonl = buildEcfrChunksJsonl();

    const bin = mkBin([Array.from(a.q8), Array.from(b.q8), Array.from(c.q8)]);
    const manifest = {
      version: "v0.1.0",
      embedding_dim: EMBED_DIM,
      total_chunks: 3,
      sources: { ecfr: 3 },
    };

    globalThis.fetch = mockEcfrFetch({ manifest, chunksJsonl, bin });

    vi.doMock("@huggingface/transformers", () => ({
      pipeline: async () => async (_text, _opts) => ({
        data: Float32Array.from(a.q8, (v) => v / 127),
      }),
    }));

    const { query } = await import("../../services/legalRag.js");
    // Query "musculoskeletal" so BM25's lexical top hit is chunk #0 (the only
    // chunk whose text contains that term) - the same chunk the mocked embedder
    // makes dense rank #1. Both rankers agree, so the fused top result is
    // deterministic. ("knee pain rating" would let BM25 pull chunk #1's "knee".)
    const res = await query("musculoskeletal", { topK: 2, threshold: 0.3 });

    expect(res.query).toBe("musculoskeletal");
    expect(res.chunks.length).toBeLessThanOrEqual(2);
    expect(res.chunks[0].citation).toBe("38 CFR § 4.71a");
    expect(res.chunks[0].score).toBeGreaterThan(0.95); // score stays raw cosine
    expect(res.chunks[0].text).toBe("musculoskeletal text");
    // Hybrid diagnostics are present on returned chunks.
    expect(res.chunks[0].fusedScore).toBeGreaterThan(0);
    expect(res.chunks[0].bm25Rank).toBe(1);
  });

  it("returns empty chunks for empty queries", async () => {
    vi.doMock("@huggingface/transformers", () => ({
      pipeline: async () => async () => ({ data: new Float32Array(EMBED_DIM) }),
    }));
    const { query } = await import("../../services/legalRag.js");
    const res = await query("");
    expect(res.chunks).toEqual([]);
  });

  it("throws when manifest embedding_dim mismatches runtime", async () => {
    globalThis.fetch = vi.fn(async (url) => {
      if (url.endsWith("/manifest.json")) {
        return new Response(
          JSON.stringify({
            version: "v0.1.0",
            embedding_dim: 768,
            sources: {},
          }),
          { status: 200 },
        );
      }
      return new Response("", { status: 404 });
    });
    vi.doMock("@huggingface/transformers", () => ({
      pipeline: async () => async () => ({ data: new Float32Array(EMBED_DIM) }),
    }));
    const { query } = await import("../../services/legalRag.js");
    await expect(query("hello")).rejects.toThrow(/dim 768/);
  });
});

describe("legalRag - tokenize", () => {
  it("lowercases and splits on non-alphanumeric runs", () => {
    expect(tokenize("The § 4.14 Pyramiding!")).toEqual([
      "the",
      "4",
      "14",
      "pyramiding",
    ]);
  });

  it("returns [] for empty/nullish input", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize(null)).toEqual([]);
    expect(tokenize(undefined)).toEqual([]);
  });
});

describe("legalRag - BM25 scoring", () => {
  const corpus = [
    "the cat sat on the mat", // 0
    "the dog sat", // 1
    "birds fly high in the sky", // 2
    "cat cat cat rare rare", // 3 - high tf of a rare term
  ];
  const index = buildBM25Index(corpus);

  it("scores 0 for a document sharing no query term", () => {
    const s = bm25ScoreAll(index, tokenize("cat"));
    expect(s[2]).toBe(0); // doc 2 has no "cat"
    expect(s[0]).toBeGreaterThan(0);
    expect(s[3]).toBeGreaterThan(0);
  });

  it("ranks a rarer term higher than a common one (IDF)", () => {
    // "cat" appears in 2/4 docs; "sat" appears in 2/4 too - pick terms with
    // different document frequency: "mat" (1/4) vs "the" (3/4).
    const rare = bm25ScoreAll(index, tokenize("mat"));
    const common = bm25ScoreAll(index, tokenize("the"));
    // doc 0 contains both "mat" and "the"; the rarer term contributes more.
    expect(rare[0]).toBeGreaterThan(common[0]);
  });

  it("rewards higher term frequency (doc 3 has cat×3)", () => {
    const s = bm25ScoreAll(index, tokenize("cat"));
    expect(s[3]).toBeGreaterThan(s[0]); // cat×3 (doc3) > cat×1 (doc0)
  });

  it("applies length normalization (shorter doc, same tf, scores higher)", () => {
    const twoDocs = buildBM25Index([
      "alpha beta",
      "alpha beta gamma delta epsilon",
    ]);
    const s = bm25ScoreAll(twoDocs, tokenize("alpha"));
    expect(s[0]).toBeGreaterThan(s[1]);
  });
});

describe("legalRag - hybridFuse (RRF)", () => {
  it("rescues a below-threshold chunk that BM25 ranks #1", () => {
    // doc4 is below the dense threshold (even negative cosine) but is the only
    // lexical match - it must be pulled into the pool and, with the tuned
    // weights, outrank the dense #1.
    const cosine = [0.9, 0.8, 0.7, 0.6, -0.5];
    const bm25 = [0, 0, 0, 0, 5];
    const fused = hybridFuse({ cosine, bm25, threshold: 0.35, topK: 5 });
    const top = fused[0];
    expect(top.index).toBe(4);
    expect(top.bm25Rank).toBe(1);
    expect(top.denseRank).toBe(5); // ranked last by dense, still rescued
    // Its fused score beats dense-#1's (which has no lexical contribution).
    const denseFirst = fused.find((f) => f.index === 0);
    expect(top.fusedScore).toBeGreaterThan(denseFirst.fusedScore);
  });

  it("excludes below-threshold chunks with no lexical match from the pool", () => {
    const cosine = [0.9, 0.8, 0.1]; // doc2 below threshold
    const bm25 = [1, 0, 0]; // doc2 has no BM25 match either
    const fused = hybridFuse({ cosine, bm25, threshold: 0.35, topK: 5 });
    expect(fused.map((f) => f.index)).not.toContain(2);
  });

  it("preserves dense order when there is no lexical signal", () => {
    const cosine = [0.4, 0.9, 0.6];
    const bm25 = [0, 0, 0];
    const fused = hybridFuse({ cosine, bm25, threshold: 0.35, topK: 3 });
    expect(fused.map((f) => f.index)).toEqual([1, 2, 0]);
  });

  it("computes fused score as the weighted RRF sum", () => {
    const cosine = [0.9, 0.8];
    const bm25 = [0, 3]; // doc1 is BM25 rank 1
    const fused = hybridFuse({ cosine, bm25, threshold: 0.35, topK: 2 });
    const doc1 = fused.find((f) => f.index === 1);
    // doc1: dense rank 2, bm25 rank 1
    const expected = RRF_W_DENSE / (RRF_K + 2) + RRF_W_BM25 / (RRF_K + 1);
    expect(doc1.fusedScore).toBeCloseTo(expected, 10);
  });

  it("honors topK", () => {
    const cosine = [0.9, 0.8, 0.7, 0.6];
    const bm25 = [0, 0, 0, 0];
    expect(hybridFuse({ cosine, bm25, threshold: 0.35, topK: 2 })).toHaveLength(
      2,
    );
  });
});

describe("legalRag - dequantizeQ8 / cosineF32", () => {
  it("round-trips a Q8 vector back to ~unit-cosine with itself", () => {
    const a = unitVecQ8(1);
    const bin = mkBin([Array.from(a.q8)]);
    const v = dequantizeQ8(bin, 0);
    expect(cosineF32(v, v)).toBeCloseTo(1, 2);
  });

  it("agrees with cosineQ8 on a query-vs-stored comparison", () => {
    const a = unitVecQ8(2);
    const bin = mkBin([Array.from(a.q8)]);
    const dequant = dequantizeQ8(bin, 0);
    expect(cosineF32(a.f32, dequant)).toBeCloseTo(cosineQ8(a.f32, bin, 0), 2);
  });
});

describe("legalRag - mmrRerank (S22 diversity reranking)", () => {
  // Two "chunks" whose vectors are near-identical (simulating overlapping/
  // redundant content) plus one clearly distinct chunk.
  const near = unitVecQ8(5).f32;
  const nearDup = new Float32Array(near).map((v) => v + 0.0005);
  const distinct = unitVecQ8(90).f32;
  const fourth = unitVecQ8(150).f32;
  const vectors = { 0: near, 1: nearDup, 2: distinct, 3: fourth };
  const getVector = (i) => vectors[i];

  it("returns the pool unchanged (truncated) when pool.length <= topK", () => {
    const pool = [
      { index: 0, cosine: 0.9 },
      { index: 1, cosine: 0.8 },
    ];
    expect(mmrRerank(pool, { topK: 5, getVector })).toEqual(pool);
  });

  it("always seeds with the top-relevance candidate", () => {
    const pool = [
      { index: 0, cosine: 0.95 },
      { index: 1, cosine: 0.9 },
      { index: 2, cosine: 0.5 },
    ];
    const out = mmrRerank(pool, { topK: 2, lambda: 0.5, getVector });
    expect(out[0].index).toBe(0);
  });

  it("prefers a distinct lower-relevance chunk over a near-duplicate higher-relevance one at moderate lambda", () => {
    const pool = [
      { index: 0, cosine: 0.9 },
      { index: 1, cosine: 0.89 }, // near-duplicate of index 0
      { index: 2, cosine: 0.7 }, // distinct
    ];
    const out = mmrRerank(pool, { topK: 2, lambda: 0.5, getVector });
    expect(out.map((c) => c.index)).toEqual([0, 2]);
  });

  it("at lambda=1 (pure relevance) ignores diversity entirely", () => {
    const pool = [
      { index: 0, cosine: 0.9 },
      { index: 1, cosine: 0.89 },
      { index: 2, cosine: 0.7 },
    ];
    const out = mmrRerank(pool, { topK: 2, lambda: 1, getVector });
    expect(out.map((c) => c.index)).toEqual([0, 1]);
  });

  it("caches vector lookups (getVector called once per candidate, not once per comparison)", () => {
    const calls = [];
    const countingGetVector = (i) => {
      calls.push(i);
      return vectors[i];
    };
    // pool.length (4) must exceed topK (3) - otherwise mmrRerank takes the
    // trivial "pool already fits" passthrough and never calls getVector.
    const pool = [
      { index: 0, cosine: 0.9 },
      { index: 1, cosine: 0.85 },
      { index: 2, cosine: 0.7 },
      { index: 3, cosine: 0.6 },
    ];
    mmrRerank(pool, { topK: 3, lambda: 0.5, getVector: countingGetVector });
    // Each distinct index is only ever dequantized once, however many pairwise
    // comparisons it participates in.
    const counts = calls.reduce(
      (m, i) => m.set(i, (m.get(i) || 0) + 1),
      new Map(),
    );
    expect(counts.size).toBe(4);
    for (const c of counts.values()) expect(c).toBe(1);
  });
});

describe("legalRag - getChunksByCitation", () => {
  afterEach(() => {
    _resetForTesting();
    vi.resetModules();
  });

  it("returns [] on a cold cache (never fetches)", () => {
    _resetForTesting();
    expect(getChunksByCitation("38 CFR § 4.14")).toEqual([]);
  });

  it("returns all cached chunks sharing a citation, in order", async () => {
    _resetForTesting();
    const a = unitVecQ8(20);
    const b = unitVecQ8(21);
    const c = unitVecQ8(22);
    const chunksJsonl = [
      {
        id: "s/4.71a/0",
        source: "ecfr",
        citation: "38 CFR § 4.71a",
        title: "t",
        text: "one",
        source_url: "u",
        fetched_at: "f",
      },
      {
        id: "s/4.71a/1",
        source: "ecfr",
        citation: "38 CFR § 4.71a",
        title: "t",
        text: "two",
        source_url: "u",
        fetched_at: "f",
      },
      {
        id: "s/4.1/0",
        source: "ecfr",
        citation: "38 CFR § 4.1",
        title: "t",
        text: "solo",
        source_url: "u",
        fetched_at: "f",
      },
    ]
      .map((r) => JSON.stringify(r))
      .join("\n");
    const bin = mkBin([Array.from(a.q8), Array.from(b.q8), Array.from(c.q8)]);
    const manifest = {
      version: "v0.1.0",
      embedding_dim: EMBED_DIM,
      sources: { ecfr: 3 },
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url) => {
      if (url.endsWith("/manifest.json"))
        return new Response(JSON.stringify(manifest), { status: 200 });
      if (url.endsWith("/chunks/ecfr.jsonl"))
        return new Response(chunksJsonl, { status: 200 });
      if (url.endsWith("/vectors/ecfr.bin"))
        return new Response(bin.buffer, { status: 200 });
      return new Response("nf", { status: 404 });
    });
    vi.doMock("@huggingface/transformers", () => ({
      pipeline: async () => async () => ({
        data: Float32Array.from(a.q8, (v) => v / 127),
      }),
    }));
    // Destructure getChunksByCitation from the SAME fresh dynamic import as
    // query() - vi.resetModules() (this block's afterEach) means the dynamic
    // import is a different module instance than the static top-of-file
    // import, with its own separate `state`; reading via the static binding
    // here would see an empty, never-populated cache.
    const { query, getChunksByCitation: getChunksByCitationFresh } =
      await import("../../services/legalRag.js");
    await query("warm the cache", { topK: 1 });

    const fam = getChunksByCitationFresh("38 CFR § 4.71a");
    expect(fam.map((c) => c.id)).toEqual(["s/4.71a/0", "s/4.71a/1"]);
    expect(getChunksByCitationFresh("38 CFR § 4.1")).toHaveLength(1);
    globalThis.fetch = originalFetch;
  });
});

// Two exactly-orthogonal directions by construction (disjoint support),
// not approximate sine-wave orthogonality - deterministic, no seed luck.
function halfVec(firstHalf) {
  const f = new Float32Array(EMBED_DIM);
  const start = firstHalf ? 0 : EMBED_DIM / 2;
  for (let i = start; i < start + EMBED_DIM / 2; i++) f[i] = 1;
  let sum = 0;
  for (const x of f) sum += x * x;
  const norm = Math.sqrt(sum);
  const q = new Int8Array(EMBED_DIM);
  for (let i = 0; i < EMBED_DIM; i++) q[i] = Math.round((f[i] / norm) * 127);
  return q;
}
function blend(qA, qB, wA, wB) {
  const f = new Float32Array(EMBED_DIM);
  let sum = 0;
  for (let i = 0; i < EMBED_DIM; i++) {
    f[i] = wA * (qA[i] / 127) + wB * (qB[i] / 127);
    sum += f[i] * f[i];
  }
  const norm = Math.sqrt(sum) || 1;
  const q = new Int8Array(EMBED_DIM);
  for (let i = 0; i < EMBED_DIM; i++) {
    q[i] = Math.round(Math.max(-1, Math.min(1, f[i] / norm)) * 127);
  }
  return q;
}

async function hybridRescueLexicalMatchTest() {
  const a = unitVecQ8(30); // query + chunk0 vector
  const b = unitVecQ8(31); // chunk1 vector
  const negA = Int8Array.from(a.q8, (v) => -v); // chunk2 vector ≈ -query
  const chunksJsonl = [
    {
      id: "c0",
      source: "ecfr",
      citation: "38 CFR § 4.1",
      title: "t0",
      text: "musculoskeletal essentials",
      source_url: "u0",
      fetched_at: "f",
    },
    {
      id: "c1",
      source: "ecfr",
      citation: "38 CFR § 4.2",
      title: "t1",
      text: "interpretation reports",
      source_url: "u1",
      fetched_at: "f",
    },
    {
      id: "c2",
      source: "ecfr",
      citation: "38 CFR § 4.14",
      title: "t2",
      text: "zebra pyramiding avoidance",
      source_url: "u2",
      fetched_at: "f",
    },
  ]
    .map((r) => JSON.stringify(r))
    .join("\n");
  const bin = mkBin([Array.from(a.q8), Array.from(b.q8), Array.from(negA)]);
  const manifest = {
    version: "v0.1.0",
    embedding_dim: EMBED_DIM,
    sources: { ecfr: 3 },
  };

  globalThis.fetch = mockEcfrFetch({ manifest, chunksJsonl, bin });
  // Embedder always returns chunk0's vector, so dense ranks c2 (negA) last,
  // below threshold. But the query TEXT "zebra" only matches c2 lexically.
  vi.doMock("@huggingface/transformers", () => ({
    pipeline: async () => async () => ({
      data: toUnitFloat32(a.q8),
    }),
  }));
  const { query } = await import("../../services/legalRag.js");
  const res = await query("zebra", { topK: 3, threshold: 0.35 });

  // c2 was dense-excluded (negative cosine) yet BM25 rescued it to the top.
  expect(res.chunks[0].id).toBe("c2");
  expect(res.chunks[0].citation).toBe("38 CFR § 4.14");
  expect(res.chunks[0].bm25Rank).toBe(1);
  expect(res.chunks[0].score).toBeLessThan(0.35); // its raw cosine stayed low
}

async function hybridRescueDenseOnlyModeTest() {
  const a = unitVecQ8(40);
  const b = unitVecQ8(41);
  const negA = Int8Array.from(a.q8, (v) => -v);
  const chunksJsonl = [
    {
      id: "d0",
      source: "ecfr",
      citation: "38 CFR § 4.1",
      title: "t0",
      text: "alpha",
      source_url: "u",
      fetched_at: "f",
    },
    {
      id: "d1",
      source: "ecfr",
      citation: "38 CFR § 4.2",
      title: "t1",
      text: "beta",
      source_url: "u",
      fetched_at: "f",
    },
    {
      id: "d2",
      source: "ecfr",
      citation: "38 CFR § 4.14",
      title: "t2",
      text: "zebra",
      source_url: "u",
      fetched_at: "f",
    },
  ]
    .map((r) => JSON.stringify(r))
    .join("\n");
  const bin = mkBin([Array.from(a.q8), Array.from(b.q8), Array.from(negA)]);
  const manifest = {
    version: "v0.1.0",
    embedding_dim: EMBED_DIM,
    sources: { ecfr: 3 },
  };
  globalThis.fetch = mockEcfrFetch({ manifest, chunksJsonl, bin });
  vi.doMock("@huggingface/transformers", () => ({
    pipeline: async () => async () => ({
      data: toUnitFloat32(a.q8),
    }),
  }));
  const { query } = await import("../../services/legalRag.js");
  const res = await query("zebra", {
    topK: 3,
    threshold: 0.35,
    hybrid: false,
  });
  // Without hybrid, the dense-excluded c2 never surfaces.
  expect(res.chunks.map((c) => c.id)).not.toContain("d2");
}

async function hybridRescueMmrDiversityTest() {
  const u = halfVec(true); // first-half direction
  const w = halfVec(false); // second-half direction - exactly orthogonal to u
  const query = blend(u, w, 0.8, 0.6); // query leans toward u but has some w
  const e0 = u; // top relevance to query (cosine ≈ 0.8), pure u
  const e1 = blend(u, w, 0.99, 0.02); // near-duplicate of e0 (still ~pure u), similar relevance
  const e2 = w; // distinct from e0/e1 (orthogonal), still meaningfully relevant (cosine ≈ 0.6)

  const chunksJsonl = [
    {
      id: "e0",
      source: "ecfr",
      citation: "38 CFR § 4.1",
      title: "t0",
      text: "one",
      source_url: "u",
      fetched_at: "f",
    },
    {
      id: "e1",
      source: "ecfr",
      citation: "38 CFR § 4.2",
      title: "t1",
      text: "two",
      source_url: "u",
      fetched_at: "f",
    },
    {
      id: "e2",
      source: "ecfr",
      citation: "38 CFR § 4.3",
      title: "t2",
      text: "three",
      source_url: "u",
      fetched_at: "f",
    },
  ]
    .map((r) => JSON.stringify(r))
    .join("\n");
  const bin = mkBin([Array.from(e0), Array.from(e1), Array.from(e2)]);
  const manifest = {
    version: "v0.1.0",
    embedding_dim: EMBED_DIM,
    sources: { ecfr: 3 },
  };
  globalThis.fetch = mockEcfrFetch({ manifest, chunksJsonl, bin });
  vi.doMock("@huggingface/transformers", () => ({
    pipeline: async () => async () => ({
      data: toUnitFloat32(query),
    }),
  }));
  const { query: runQuery } = await import("../../services/legalRag.js");

  const withMmr = await runQuery("query text", { topK: 2, threshold: 0 });
  expect(withMmr.chunks.map((c) => c.id)).toEqual(["e0", "e2"]);

  const withoutMmr = await runQuery("query text", {
    topK: 2,
    threshold: 0,
    mmr: false,
  });
  expect(withoutMmr.chunks.map((c) => c.id)).toEqual(["e0", "e1"]);
}

describe("legalRag - query() hybrid rescue path", () => {
  let originalFetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
    _resetForTesting();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    _resetForTesting();
    vi.resetModules();
  });

  it(
    "surfaces a lexically-matched chunk the dense score put below threshold",
    hybridRescueLexicalMatchTest,
  );

  it(
    "dense-only mode ignores BM25 (opts.hybrid=false)",
    hybridRescueDenseOnlyModeTest,
  );

  it(
    "MMR (default on, real lambda=0.7) prefers a distinct 2nd result over a near-duplicate; opts.mmr=false reverts to raw relevance order",
    hybridRescueMmrDiversityTest,
  );
});
