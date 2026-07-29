import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  filterGolden,
  resolveCompareSpec,
} from "../../scripts/legal-ingestion/eval/run-eval.mjs";
import { VARIANTS } from "../../scripts/legal-ingestion/eval/build-variants.mjs";

/**
 * S18: comparative chunking-eval harness. These cover the pure logic that
 * S19-S22 depend on to tune only against the non-held-out golden-set slice.
 */
describe("filterGolden (S18 held-out slice)", () => {
  const golden = [
    { id: "a", heldOut: true },
    { id: "b", heldOut: false },
    { id: "c" }, // no heldOut field — must behave like false
  ];

  it("returns everything with no options", () => {
    expect(filterGolden(golden)).toHaveLength(3);
  });

  it("--held-out-only keeps only heldOut === true", () => {
    const r = filterGolden(golden, { heldOutOnly: true });
    expect(r.map((g) => g.id)).toEqual(["a"]);
  });

  it("--exclude-held-out drops heldOut === true, keeps missing/false", () => {
    const r = filterGolden(golden, { excludeHeldOut: true });
    expect(r.map((g) => g.id)).toEqual(["b", "c"]);
  });
});

describe("resolveCompareSpec (S18 --compare variant resolution)", () => {
  const root = "/repo";
  const variantsDir = "/repo/scripts/legal-ingestion/eval/.variants";

  it("resolves a bare name to the variants scratch dir", () => {
    const { name, dir } = resolveCompareSpec("page-level", {
      root,
      variantsDir,
    });
    expect(name).toBe("page-level");
    expect(dir).toBe(join(variantsDir, "page-level"));
  });

  it("resolves name=relative-path against the repo root", () => {
    const { name, dir } = resolveCompareSpec(
      "current=public/legal-index/v0.1.0",
      {
        root,
        variantsDir,
      },
    );
    expect(name).toBe("current");
    // Matches the implementation's own path.resolve semantics rather than
    // path.join — on Windows, a POSIX-style fake root like "/repo" resolves
    // against the current drive, so we compare against the same resolver.
    expect(dir).toBe(resolve(root, "public/legal-index/v0.1.0"));
  });

  it("leaves an absolute name=path untouched", () => {
    const abs =
      process.platform === "win32" ? "C:\\scratch\\idx" : "/scratch/idx";
    const { dir } = resolveCompareSpec(`candidate=${abs}`, {
      root,
      variantsDir,
    });
    expect(dir).toBe(abs);
  });
});

describe("build-variants chunkers (S18 comparative sweep)", () => {
  const record = (words) => ({
    source: "ecfr",
    jurisdiction: "federal",
    citation: "38 CFR § 9.99",
    title: "test",
    body: Array.from({ length: words }, (_, i) => `word${i}`).join(" "),
    fetched_at: "2026-01-01T00:00:00Z",
    source_url: "https://www.ecfr.gov/x",
    content_hash: "sha256:parent",
  });

  it("page-level and section-level produce exactly one atomic chunk", async () => {
    const rec = record(2000);
    const pageChunks = await VARIANTS["page-level"](rec);
    const sectionChunks = await VARIANTS["section-level"](rec);
    expect(pageChunks).toHaveLength(1);
    expect(sectionChunks).toHaveLength(1);
    expect(pageChunks[0].text).toBe(rec.body);
  });

  it("512tok-10pct matches the production word-window shape (~394 words/chunk)", async () => {
    const rec = record(1000);
    const chunks = await VARIANTS["512tok-10pct"](rec);
    expect(chunks.length).toBeGreaterThan(1);
    const firstWordCount = chunks[0].text.split(" ").length;
    expect(firstWordCount).toBe(Math.floor(512 / 1.3));
  });

  it("every variant preserves citation/source metadata on each chunk", async () => {
    const rec = record(50);
    for (const [name, chunkFn] of Object.entries(VARIANTS)) {
      const chunks = await chunkFn(rec);
      for (const c of chunks) {
        expect(c.citation, `${name} chunk missing citation`).toBe(rec.citation);
        expect(c.source, `${name} chunk missing source`).toBe(rec.source);
        expect(c.parent_hash, `${name} chunk missing parent_hash`).toBe(
          rec.content_hash,
        );
      }
    }
  });

  it("empty body yields zero chunks for every variant", async () => {
    const rec = { ...record(0), body: "" };
    for (const [name, chunkFn] of Object.entries(VARIANTS)) {
      expect(await chunkFn(rec), name).toEqual([]);
    }
  });
});

describe("golden-set.jsonl schema (S18 growth 25→60)", () => {
  const lines = readFileSync(
    join(process.cwd(), "scripts/legal-ingestion/eval/golden-set.jsonl"),
    "utf8",
  )
    .split("\n")
    .filter(Boolean);
  const entries = lines.map((l) => JSON.parse(l));
  const VALID_CATEGORIES = new Set([
    "conceptual",
    "table_lookup",
    "lexical_exact",
    "cross_section",
    "known_miss",
  ]);

  it("has at least 60 queries", () => {
    expect(entries.length).toBeGreaterThanOrEqual(60);
  });

  it("every entry has a unique id, a query, expected_citations, and a valid category", () => {
    const ids = new Set();
    for (const e of entries) {
      expect(e.id).toBeTruthy();
      expect(ids.has(e.id), `duplicate id ${e.id}`).toBe(false);
      ids.add(e.id);
      expect(typeof e.query).toBe("string");
      expect(Array.isArray(e.expected_citations)).toBe(true);
      expect(e.expected_citations.length).toBeGreaterThan(0);
      expect(
        VALID_CATEGORIES.has(e.category),
        `${e.id} has bad category ${e.category}`,
      ).toBe(true);
    }
  });

  it("reserves a held-out slice of roughly 20% (not zero, not the whole set)", () => {
    const heldOut = entries.filter((e) => e.heldOut === true).length;
    const ratio = heldOut / entries.length;
    expect(heldOut).toBeGreaterThan(0);
    expect(ratio).toBeGreaterThan(0.1);
    expect(ratio).toBeLessThan(0.3);
  });

  it("pins the three documented known misses plus the S18-discovered fourth", () => {
    const ids = new Set(entries.map((e) => e.id));
    for (const id of ["q02", "q06", "q22", "q42"]) {
      expect(ids.has(id), `missing known-miss id ${id}`).toBe(true);
    }
  });
});
