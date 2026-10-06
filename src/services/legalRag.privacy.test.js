// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const hub = vi.hoisted(() => ({ models: [], texts: [] }));
vi.mock("@huggingface/transformers", () => ({
  pipeline: async (_task, model) => {
    hub.models.push(model);
    return async (text) => {
      hub.texts.push(text);
      return { data: new Float32Array(384).fill(0.05) };
    };
  },
}));

import { query, _resetForTesting, EMBED_MODEL } from "./legalRag";

const QUESTION = "my private sleep apnea question about John Q Veteran";
const requested = [];

beforeEach(() => {
  _resetForTesting();
  requested.length = 0;
  hub.models.length = 0;
  hub.texts.length = 0;
  const chunk = {
    id: "c1",
    source: "ecfr",
    citation: "38 CFR § 4.97",
    title: "Respiratory",
    text: "Sleep apnea syndromes.",
    source_url: "https://www.ecfr.gov/",
    fetched_at: "2026-01-01",
  };
  globalThis.fetch = vi.fn(async (url) => {
    requested.push(String(url));
    if (url.endsWith("manifest.json")) {
      return new Response(
        JSON.stringify({ embedding_dim: 384, sources: { ecfr: 1 } }),
      );
    }
    if (url.endsWith(".jsonl")) return new Response(JSON.stringify(chunk));
    return new Response(new Int8Array(384).fill(5));
  });
});

describe("the regulation search keeps the question on the device", () => {
  it("embeds the question in the page and sends it to no URL", async () => {
    await query(QUESTION, { topK: 1, threshold: 0 });
    expect(hub.texts).toEqual([QUESTION]);
    expect(requested.length).toBeGreaterThan(0);
    for (const url of requested) {
      expect(url.startsWith("/legal-index/")).toBe(true);
      expect(decodeURIComponent(url)).not.toContain("sleep");
    }
  });

  it("loads the embedding model by name from the Hugging Face hub, the one download on first use", async () => {
    await query(QUESTION, { topK: 1, threshold: 0 });
    expect(hub.models).toEqual([EMBED_MODEL]);
    expect(EMBED_MODEL).toBe("Xenova/bge-small-en-v1.5");
  });
});
