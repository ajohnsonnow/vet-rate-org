import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  tierForSource,
  rankForTier,
  AUTHORITY_TIERS,
} from "../../services/dkbAuthorityTiers.js";
import {
  deviceMeets,
  selectShards,
  PER_PART_BYTE_BUDGET,
} from "../../services/dkbShardRegistry.js";
import { tierPrior, TIER_PRIOR_WEIGHT } from "../../services/dkbShardedRag.js";

const EMBED_DIM = 384;

// ── deterministic Q8 vector helpers (mirrors legalRag.test.js) ───────────────
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
    q[i] = Math.round(Math.max(-1, Math.min(1, f[i] / norm)) * 127);
  }
  return { f32: Float32Array.from(q, (x) => x / 127), q8: q };
}
function mkBin(q8s) {
  const buf = new Int8Array(q8s.length * EMBED_DIM);
  for (let v = 0; v < q8s.length; v++) buf.set(q8s[v], v * EMBED_DIM);
  return buf;
}
function toUnitFloat32(q8) {
  return Float32Array.from(q8, (v) => v / 127);
}
function mockEmbedderPipeline(data) {
  vi.doMock("@huggingface/transformers", () => ({
    pipeline: async () => async () => ({ data }),
  }));
}
function mockShardFetch({ registry = REGISTRY, ecfrQ8s, presumptiveQ8s }) {
  const fetchMock = mockFetch({
    registry,
    ecfrBin: mkBin(ecfrQ8s),
    presumptiveBin: mkBin(presumptiveQ8s),
  });
  globalThis.fetch = fetchMock;
  return fetchMock;
}

// ── pure-function units ──────────────────────────────────────────────────────
describe("dkbAuthorityTiers", () => {
  it("maps sources to the veterans-law authority hierarchy", () => {
    expect(tierForSource("ecfr")).toEqual({
      authority_tier: "statutory",
      tier_rank: 1,
    });
    expect(tierForSource("federal_circuit").tier_rank).toBe(2);
    expect(tierForSource("cavc").tier_rank).toBe(3);
    expect(tierForSource("bva").authority_tier).toBe(
      "administrative_precedent",
    );
    expect(tierForSource("m21_1").authority_tier).toBe("procedural");
  });
  it("falls back to reference tier for an unknown source (never throws)", () => {
    expect(tierForSource("something-new")).toEqual({
      authority_tier: "reference",
      tier_rank: AUTHORITY_TIERS.reference,
    });
  });
  it("rankForTier resolves a tier string to its ordinal", () => {
    expect(rankForTier("statutory")).toBe(1);
    expect(rankForTier("community")).toBe(8);
    expect(rankForTier("bogus")).toBe(AUTHORITY_TIERS.reference);
  });
});

describe("dkbShardRegistry - device gating", () => {
  it("deviceMeets compares the tier ladder", () => {
    expect(deviceMeets("desktop-high", "mobile")).toBe(true);
    expect(deviceMeets("mobile", "desktop-mid")).toBe(false);
    expect(deviceMeets("laptop", "laptop")).toBe(true);
    expect(deviceMeets("unknown", "mobile")).toBe(true); // unknown floors to mobile
    expect(deviceMeets("mobile", "unknown")).toBe(true);
  });

  const registry = {
    shards: [
      {
        id: "ecfr",
        authority_tier: "statutory",
        tier_rank: 1,
        min_device_tier: "mobile",
        parts: [],
      },
      {
        id: "bva",
        authority_tier: "administrative_precedent",
        tier_rank: 4,
        min_device_tier: "desktop-mid",
        parts: [],
      },
      {
        id: "presumptive",
        authority_tier: "reference",
        tier_rank: 7,
        min_device_tier: "mobile",
        parts: [],
      },
    ],
  };

  it("a mobile device only sees mobile-tier shards", () => {
    const ids = selectShards(registry, { deviceTier: "mobile" }).map(
      (s) => s.id,
    );
    expect(ids).toContain("ecfr");
    expect(ids).toContain("presumptive");
    expect(ids).not.toContain("bva"); // gated to desktop-mid
  });
  it("a desktop-high device sees every shard", () => {
    const ids = selectShards(registry, { deviceTier: "desktop-high" }).map(
      (s) => s.id,
    );
    expect(ids).toEqual(["ecfr", "bva", "presumptive"]); // tier_rank order
  });
  it("returns shards ordered most-authoritative first", () => {
    const ranks = selectShards(registry, { deviceTier: "desktop-high" }).map(
      (s) => s.tier_rank,
    );
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
  it("`only` restricts to named shards, still tier-ordered", () => {
    const ids = selectShards(registry, {
      deviceTier: "desktop-high",
      only: ["presumptive", "ecfr"],
    }).map((s) => s.id);
    expect(ids).toEqual(["ecfr", "presumptive"]);
  });
  it("ignoreDeviceGate bypasses gating (eval/off-browser)", () => {
    const ids = selectShards(registry, {
      deviceTier: "mobile",
      ignoreDeviceGate: true,
    }).map((s) => s.id);
    expect(ids).toContain("bva");
  });
});

describe("dkbShardedRag - tierPrior", () => {
  it("is largest for statutory (rank 1) and ~0 for the lowest tier", () => {
    expect(tierPrior(1)).toBeCloseTo(TIER_PRIOR_WEIGHT, 10);
    expect(tierPrior(8)).toBe(0);
    expect(tierPrior(4)).toBeGreaterThan(0);
    expect(tierPrior(4)).toBeLessThan(TIER_PRIOR_WEIGHT);
  });
  it("is monotonic decreasing in tier_rank", () => {
    for (let r = 1; r < 8; r++)
      expect(tierPrior(r)).toBeGreaterThan(tierPrior(r + 1));
  });
  it("clamps out-of-range ranks", () => {
    expect(tierPrior(0)).toBeCloseTo(TIER_PRIOR_WEIGHT, 10);
    expect(tierPrior(99)).toBe(0);
  });
});

// ── integration: queryShards over mocked fetch + embedder ────────────────────
function ecfrChunks() {
  return [
    {
      dkb_id: "DKB-1",
      id: "ecfr/4.71a/0",
      source: "ecfr",
      citation: "38 CFR § 4.71a",
      title: "Musculoskeletal",
      text: "knee musculoskeletal rating",
      source_url: "https://ecfr.gov/4.71a",
      fetched_at: "2026-05-15T00:00:00Z",
    },
    {
      dkb_id: "DKB-2",
      id: "ecfr/4.1/0",
      source: "ecfr",
      citation: "38 CFR § 4.1",
      title: "Essentials",
      text: "essentials of evaluative rating",
      source_url: "https://ecfr.gov/4.1",
      fetched_at: "2026-05-15T00:00:00Z",
    },
  ];
}
function presumptiveChunks() {
  return [
    {
      dkb_id: "DKB-500",
      id: "presumptive/agent-orange/0",
      source: "presumptive",
      authority_tier: "reference",
      citation: "38 CFR § 3.309(e)",
      title: "Agent Orange presumptives",
      text: "diabetes ischemic heart disease agent orange presumptive",
      source_url: "https://va.gov/agent-orange",
      fetched_at: "2026-01-27T00:00:00Z",
    },
  ];
}

function jsonl(objs) {
  return objs.map((o) => JSON.stringify(o)).join("\n") + "\n";
}

/**
 * Build a fetch mock serving both the legal-index tree (for legalRag.query AND
 * the ecfr shard, which reuses that path) and a dkb-index presumptive shard.
 */
function mockFetch({ registry, ecfrBin, presumptiveBin }) {
  return vi.fn(async (url) => {
    if (url.endsWith("/dkb-index/registry.json"))
      return new Response(JSON.stringify(registry), { status: 200 });
    if (url.endsWith("/legal-index/v0.1.0/manifest.json"))
      return new Response(
        JSON.stringify({
          version: "v0.1.0",
          embedding_dim: EMBED_DIM,
          total_chunks: 2,
          sources: { ecfr: 2 },
        }),
        { status: 200 },
      );
    if (url.endsWith("/legal-index/v0.1.0/chunks/ecfr.jsonl"))
      return new Response(jsonl(ecfrChunks()), { status: 200 });
    if (url.endsWith("/legal-index/v0.1.0/vectors/ecfr.bin"))
      return new Response(ecfrBin.buffer, { status: 200 });
    if (url.endsWith("/dkb-index/presumptive/chunks.part0.jsonl"))
      return new Response(jsonl(presumptiveChunks()), { status: 200 });
    if (url.endsWith("/dkb-index/presumptive/vectors.part0.bin"))
      return new Response(presumptiveBin.buffer, { status: 200 });
    return new Response("not found", { status: 404 });
  });
}

const REGISTRY = {
  version: 1,
  embedding_dim: EMBED_DIM,
  shards: [
    {
      id: "ecfr",
      layout: "legal-index",
      path: "/legal-index/v0.1.0",
      authority_tier: "statutory",
      tier_rank: 1,
      min_device_tier: "mobile",
      parts: [
        {
          chunks: "chunks/ecfr.jsonl",
          vectors: "vectors/ecfr.bin",
          count: 2,
          bytes: 2 * EMBED_DIM,
        },
      ],
    },
    {
      id: "presumptive",
      layout: "shard",
      path: "/dkb-index/presumptive",
      authority_tier: "reference",
      tier_rank: 7,
      min_device_tier: "mobile",
      parts: [
        {
          chunks: "chunks.part0.jsonl",
          vectors: "vectors.part0.bin",
          count: 1,
          bytes: 1 * EMBED_DIM,
        },
      ],
    },
  ],
};

describe("dkbShardedRag - queryShards integration", () => {
  let originalFetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.resetModules();
  });

  it("empty query returns no shards or chunks (no fetch, no embed)", async () => {
    mockEmbedderPipeline(new Float32Array(EMBED_DIM));
    const { queryShards } = await import("../../services/dkbShardedRag.js");
    const res = await queryShards("   ");
    expect(res.chunks).toEqual([]);
    expect(res.shards).toEqual([]);
  });

  it("fans out across shards and tags each chunk with its authority_tier + dkb_id", async () => {
    const eA = unitVecQ8(10),
      eB = unitVecQ8(11),
      pA = unitVecQ8(12);
    mockShardFetch({ ecfrQ8s: [eA.q8, eB.q8], presumptiveQ8s: [pA.q8] });
    // Embedder returns the ecfr chunk-A vector, so ecfr DKB-1 is the dense top;
    // the presumptive chunk is also present (lexical "agent orange"/低 cosine).
    mockEmbedderPipeline(toUnitFloat32(eA.q8));
    const { queryShards, _resetForTesting } =
      await import("../../services/dkbShardedRag.js");
    _resetForTesting();
    const res = await queryShards("agent orange musculoskeletal", {
      topK: 5,
      threshold: 0,
      ignoreDeviceGate: true,
    });
    expect(res.shards).toEqual(["ecfr", "presumptive"]);
    // Both shards contributed candidates.
    const ecfrHits = res.chunks.filter((c) => c.source === "ecfr");
    const presHits = res.chunks.filter((c) => c.source === "presumptive");
    expect(ecfrHits.length).toBeGreaterThan(0);
    expect(presHits).toHaveLength(1);
    // Every chunk carries its shard's authority_tier and a dkb_id.
    for (const c of ecfrHits) {
      expect(c.authority_tier).toBe("statutory");
      expect(["DKB-1", "DKB-2"]).toContain(c.dkb_id);
    }
    expect(presHits[0].authority_tier).toBe("reference");
    expect(presHits[0].dkb_id).toBe("DKB-500");
  });

  it("device gating: on mobile a desktop-gated shard is never fetched", async () => {
    const eA = unitVecQ8(20),
      eB = unitVecQ8(21),
      pA = unitVecQ8(22);
    const gatedRegistry = {
      ...REGISTRY,
      shards: REGISTRY.shards.map((s) =>
        s.id === "presumptive" ? { ...s, min_device_tier: "desktop-mid" } : s,
      ),
    };
    const fetchMock = mockShardFetch({
      registry: gatedRegistry,
      ecfrQ8s: [eA.q8, eB.q8],
      presumptiveQ8s: [pA.q8],
    });
    mockEmbedderPipeline(toUnitFloat32(eA.q8));
    const { queryShards } = await import("../../services/dkbShardedRag.js");
    const res = await queryShards("anything", {
      topK: 5,
      threshold: 0,
      deviceTier: "mobile",
    });
    expect(res.shards).toEqual(["ecfr"]);
    // The presumptive shard's part files were never requested.
    const requested = fetchMock.mock.calls.map((c) => c[0]);
    expect(requested.some((u) => u.includes("/dkb-index/presumptive/"))).toBe(
      false,
    );
  });
});

describe("dkbShardedRag - eCFR regression parity with legalRag.query()", () => {
  let originalFetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.resetModules();
  });

  it("queryShards({only:['ecfr']}) returns the same chunks in the same order as legalRag.query()", async () => {
    const eA = unitVecQ8(30),
      eB = unitVecQ8(31);
    globalThis.fetch = mockFetch({
      registry: REGISTRY,
      ecfrBin: mkBin([eA.q8, eB.q8]),
      presumptiveBin: mkBin([unitVecQ8(99).q8]),
    });
    // Same embedder for both engines: returns eA so DKB-1 is dense #1.
    vi.doMock("@huggingface/transformers", () => ({
      pipeline: async () => async () => ({ data: toUnitFloat32(eA.q8) }),
    }));
    const legalRag = await import("../../services/legalRag.js");
    const { queryShards } = await import("../../services/dkbShardedRag.js");
    legalRag._resetForTesting();

    const q = "musculoskeletal knee rating";
    const viaLegalRag = await legalRag.query(q, { topK: 2, threshold: 0.3 });
    const viaShards = await queryShards(q, {
      topK: 2,
      threshold: 0.3,
      only: ["ecfr"],
      ignoreDeviceGate: true,
    });

    // Same citations, same order - the single-part eCFR shard runs the identical
    // hybridFuse+MMR pipeline over the identical chunk set.
    expect(viaShards.chunks.map((c) => c.citation)).toEqual(
      viaLegalRag.chunks.map((c) => c.citation),
    );
    expect(viaShards.chunks.map((c) => c.id)).toEqual(
      viaLegalRag.chunks.map((c) => c.id),
    );
    // And the shard path additionally exposes authority_tier the legacy path lacks.
    expect(viaShards.chunks[0].authority_tier).toBe("statutory");
  });
});

// ── build-shard unit tests (node script, pure functions) ─────────────────────
function fiveBvaEntriesWithOneUrlLess() {
  const entries = Array.from({ length: 5 }, (_, i) => ({
    dkb_id: `DKB-${i}`,
    id: `bva_${i}`,
    source: "bva",
    content: `decision text number ${i} with enough length to pass the floor`,
    url: `https://va.gov/vetapp/${i}.txt`,
    citation: `BVA-${i}`,
    title: `t${i}`,
  }));
  // one url-less entry must be skipped, not silently dropped
  entries.push({
    dkb_id: "DKB-x",
    id: "bva_x",
    source: "bva",
    content: "x".repeat(60),
    url: "",
    citation: "c",
    title: "t",
  });
  return entries;
}

describe("build-shard - entryToChunk + part splitting", () => {
  it("skips empty content and url-less entries, keeps valid ones (S28 discipline)", async () => {
    const { entryToChunk } =
      await import("../../../scripts/dkb-sharding/build-shard.mjs");
    const opts = {
      authority_tier: "reference",
      fallbackFetchedAt: "2026-01-27T00:00:00Z",
    };
    expect(entryToChunk({ content: "", url: "https://x" }, opts)).toEqual({
      skip: "empty_content",
    });
    expect(entryToChunk({ content: "a".repeat(50), url: "" }, opts)).toEqual({
      skip: "missing_url",
    });
    const ok = entryToChunk(
      {
        dkb_id: "DKB-9",
        id: "x_1",
        source: "presumptive",
        content: "a".repeat(50),
        url: "https://va.gov/x",
        citation: "c",
        title: "t",
        date_added: "2026-01-01",
      },
      opts,
    );
    expect(ok.chunk.dkb_id).toBe("DKB-9");
    expect(ok.chunk.authority_tier).toBe("reference");
    expect(ok.chunk.source_url).toBe("https://va.gov/x");
    expect(ok.chunk.text).toBe("a".repeat(50));
  });

  it("splits a shard into multiple parts, each within the chunk cap, and reports skips", async () => {
    const { buildShard, stubEmbed } =
      await import("../../../scripts/dkb-sharding/build-shard.mjs");
    const { mkdtempSync, readFileSync, rmSync } = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const dir = mkdtempSync(path.join(os.tmpdir(), "dkb-shard-test-"));
    try {
      const entries = fiveBvaEntriesWithOneUrlLess();

      const meta = await buildShard({
        source: "bva",
        entries,
        embed: async (t) => stubEmbed(t),
        outDir: dir,
        fallbackFetchedAt: "2026-01-27T00:00:00Z",
        maxChunksPerPart: 2, // force 3 parts from 5 valid chunks
      });

      expect(meta.authority_tier).toBe("administrative_precedent");
      expect(meta.entry_count).toBe(5);
      expect(meta.source_entry_count).toBe(6);
      expect(meta.skipped.missing_url).toBe(1);
      expect(meta.parts).toHaveLength(3); // ceil(5/2)
      // Every part's vector bytes == count × 384 (no partial/oversized vectors).
      for (const p of meta.parts) {
        expect(p.bytes).toBe(p.count * EMBED_DIM);
        expect(p.bytes).toBeLessThanOrEqual(PER_PART_BYTE_BUDGET);
        const vpath = path.join(dir, p.vectors);
        expect(readFileSync(vpath)).toHaveLength(p.count * EMBED_DIM);
      }
      // Total chunks across parts == entry_count.
      expect(meta.parts.reduce((s, p) => s + p.count, 0)).toBe(5);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
