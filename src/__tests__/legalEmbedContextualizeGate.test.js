import { describe, it, expect, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * S20 — CONTEXTUALIZE_CHUNKS gate. Off by default (see embed.mjs's header
 * note and contextualize.mjs for the A/B numbers behind that decision); this
 * asserts the gate actually controls what text reaches the embedder, not
 * just that the env var string comparison looks right.
 */
const ORIGINAL_ENV = process.env.CONTEXTUALIZE_CHUNKS;

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.CONTEXTUALIZE_CHUNKS;
  else process.env.CONTEXTUALIZE_CHUNKS = ORIGINAL_ENV;
  vi.resetModules();
});

function writeChunkFile(dir, chunks) {
  const file = join(dir, "ecfr.jsonl");
  writeFileSync(file, chunks.map((c) => JSON.stringify(c)).join("\n") + "\n");
  return file;
}

function stubEmbedder() {
  const calls = [];
  const embedder = async (text) => {
    calls.push(text);
    return { data: new Float32Array(384).fill(0.01) };
  };
  return { embedder, calls };
}

describe("embed.mjs CONTEXTUALIZE_CHUNKS gate", () => {
  it("defaults OFF: embeds the raw chunk.text, no title prefix", async () => {
    delete process.env.CONTEXTUALIZE_CHUNKS;
    vi.resetModules();
    const { embedSource } = await import("../../scripts/legal-ingestion/embed.mjs");

    const dir = mkdtempSync(join(tmpdir(), "embed-gate-"));
    const chunkFile = writeChunkFile(dir, [
      { citation: "38 CFR § 4.21", title: "§ 4.21 Application of rating schedule.", text: "Body text." },
    ]);
    const { embedder, calls } = stubEmbedder();
    await embedSource({ chunkFile, vectorFile: join(dir, "ecfr.bin"), embedder });

    expect(calls).toEqual(["Body text."]);
    rmSync(dir, { recursive: true, force: true });
  });

  it("CONTEXTUALIZE_CHUNKS=1 prepends the section title before embedding", async () => {
    process.env.CONTEXTUALIZE_CHUNKS = "1";
    vi.resetModules();
    const { embedSource } = await import("../../scripts/legal-ingestion/embed.mjs");

    const dir = mkdtempSync(join(tmpdir(), "embed-gate-"));
    const chunkFile = writeChunkFile(dir, [
      { citation: "38 CFR § 4.21", title: "§ 4.21 Application of rating schedule.", text: "Body text." },
    ]);
    const { embedder, calls } = stubEmbedder();
    await embedSource({ chunkFile, vectorFile: join(dir, "ecfr.bin"), embedder });

    expect(calls).toEqual(["§ 4.21 Application of rating schedule.\n\nBody text."]);
    rmSync(dir, { recursive: true, force: true });
  });

  it("still writes the correct vector count regardless of the gate", async () => {
    process.env.CONTEXTUALIZE_CHUNKS = "1";
    vi.resetModules();
    const { embedSource } = await import("../../scripts/legal-ingestion/embed.mjs");

    const dir = mkdtempSync(join(tmpdir(), "embed-gate-"));
    const chunkFile = writeChunkFile(dir, [
      { citation: "38 CFR § 4.21", title: "a", text: "one" },
      { citation: "38 CFR § 4.22", title: "b", text: "two" },
    ]);
    const vectorFile = join(dir, "ecfr.bin");
    const { embedder } = stubEmbedder();
    const r = await embedSource({ chunkFile, vectorFile, embedder });

    expect(r.count).toBe(2);
    expect(readFileSync(vectorFile).length).toBe(2 * 384);
    rmSync(dir, { recursive: true, force: true });
  });
});
