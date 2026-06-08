import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { cosineQ8, _resetForTesting } from "../../services/legalRag.js";

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

describe("legalRag — cosineQ8", () => {
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

describe("legalRag — query() integration with mocked fetch + embedder", () => {
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
    const chunksJsonl = [
      {
        id: "ecfr/4.71a/0",
        source: "ecfr",
        citation: "38 CFR § 4.71a",
        title: "Schedule of ratings—musculoskeletal",
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
        title: "Schedule of ratings—musculoskeletal",
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

    const bin = mkBin([Array.from(a.q8), Array.from(b.q8), Array.from(c.q8)]);
    const manifest = {
      version: "v0.1.0",
      embedding_dim: EMBED_DIM,
      total_chunks: 3,
      sources: { ecfr: 3 },
    };

    globalThis.fetch = vi.fn(async (url) => {
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

    vi.doMock("@huggingface/transformers", () => ({
      pipeline: async () => async (_text, _opts) => ({
        data: Float32Array.from(a.q8, (v) => v / 127),
      }),
    }));

    const { query } = await import("../../services/legalRag.js");
    const res = await query("knee pain rating", { topK: 2, threshold: 0.3 });

    expect(res.query).toBe("knee pain rating");
    expect(res.chunks.length).toBeLessThanOrEqual(2);
    expect(res.chunks[0].citation).toBe("38 CFR § 4.71a");
    expect(res.chunks[0].score).toBeGreaterThan(0.95);
    expect(res.chunks[0].text).toBe("musculoskeletal text");
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
