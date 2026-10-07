/**
 * D19-7: segmentCFileChunked must be byte-identical to segmentCFile for the
 * same input - it exists purely to spread the same work across yielded
 * main-thread slices, never to change what gets computed. Run against a
 * generic 2,000-"page" synthetic C-File (code sheets, rating decisions,
 * letters, DD-214s) calibrated to reproduce the real ~0.35-0.48s of
 * synchronous cost this fix targets - see largeCFileFixture.js.
 */
import { describe, it, expect, vi } from "vitest";
import { segmentCFile, segmentCFileChunked } from "./cFileSegmentation";
import { buildLargeCFileFixture } from "../__tests__/fixtures/largeCFileFixture";

const LARGE_FIXTURE = buildLargeCFileFixture();

// Strips wall-clock-dependent fields a downstream parser stamps at call
// time (segmentCFile's own processedAt, and parseVADocument's extractedAt
// on every parsed segment) - real divergence there is expected since the
// chunked path takes longer wall-clock time, and isn't what this test is
// proving. Boundary positions/types/segment counts/classifications, which
// this test IS proving, are untouched by either field.
function stripVolatileTimestamps(value) {
  if (Array.isArray(value)) return value.map(stripVolatileTimestamps);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, v] of Object.entries(value)) {
      if (key === "processedAt" || key === "extractedAt") continue;
      out[key] = stripVolatileTimestamps(v);
    }
    return out;
  }
  return value;
}

describe("segmentCFileChunked: byte-identical to segmentCFile", () => {
  it("matches on a large multi-document fixture with parseDocuments:false", async () => {
    const opts = { parseDocuments: false, maxSegments: Infinity };
    const sync = segmentCFile(LARGE_FIXTURE, opts);
    const chunked = await segmentCFileChunked(LARGE_FIXTURE, opts);

    expect(stripVolatileTimestamps(chunked)).toEqual(
      stripVolatileTimestamps(sync),
    );
    expect(sync.segments.length).toBeGreaterThan(1000);
  });

  it("matches on a large multi-document fixture with parseDocuments:true", async () => {
    const sync = segmentCFile(LARGE_FIXTURE, {
      parseDocuments: true,
      maxSegments: 300,
    });
    const chunked = await segmentCFileChunked(LARGE_FIXTURE, {
      parseDocuments: true,
      maxSegments: 300,
    });

    expect(stripVolatileTimestamps(chunked)).toEqual(
      stripVolatileTimestamps(sync),
    );
  });

  it("matches exactly on boundary positions, types and confidences", async () => {
    const sync = segmentCFile(LARGE_FIXTURE, { parseDocuments: false });
    const chunked = await segmentCFileChunked(LARGE_FIXTURE, {
      parseDocuments: false,
    });

    const projection = (r) =>
      r.segments.map((s) => ({
        position: s.position,
        type: s.type,
        category: s.category,
        confidence: s.confidence,
        length: s.length,
      }));
    expect(projection(chunked)).toEqual(projection(sync));
  });

  it("matches the code sheet found by the backwards search", async () => {
    const sync = segmentCFile(LARGE_FIXTURE, { parseDocuments: false });
    const chunked = await segmentCFileChunked(LARGE_FIXTURE, {
      parseDocuments: false,
    });

    expect(stripVolatileTimestamps(chunked.codeSheet)).toEqual(
      stripVolatileTimestamps(sync.codeSheet),
    );
    expect(sync.codeSheet).not.toBeNull();
  });
});

describe("segmentCFileChunked: byte-identical on edge cases", () => {
  it("matches on an empty file", async () => {
    const sync = segmentCFile("", { parseDocuments: false });
    const chunked = await segmentCFileChunked("", { parseDocuments: false });
    expect(stripVolatileTimestamps(chunked)).toEqual(
      stripVolatileTimestamps(sync),
    );
  });

  it("matches when maxSegments truncates the file", async () => {
    const sync = segmentCFile(LARGE_FIXTURE, {
      parseDocuments: false,
      maxSegments: 5,
    });
    const chunked = await segmentCFileChunked(LARGE_FIXTURE, {
      parseDocuments: false,
      maxSegments: 5,
    });
    expect(stripVolatileTimestamps(chunked)).toEqual(
      stripVolatileTimestamps(sync),
    );
  });

  it("matches on a file with no recognizable code sheet", async () => {
    const text =
      "Just some plain narrative text with no VA document signatures at all. ".repeat(
        50,
      );
    const sync = segmentCFile(text, { parseDocuments: false });
    const chunked = await segmentCFileChunked(text, {
      parseDocuments: false,
    });
    expect(stripVolatileTimestamps(chunked)).toEqual(
      stripVolatileTimestamps(sync),
    );
  });
});

describe("segmentCFileChunked: actually yields to the main thread", () => {
  it("schedules more than one macrotask on a large fixture with a small budget", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    await segmentCFileChunked(LARGE_FIXTURE, {
      parseDocuments: false,
      budgetMs: 1,
    });
    expect(setTimeoutSpy.mock.calls.length).toBeGreaterThan(5);
    setTimeoutSpy.mockRestore();
  });

  it("schedules no yields at all when the budget comfortably covers the work", async () => {
    const small = buildLargeCFileFixture({ pages: 5, codeSheetEvery: 0 });
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    await segmentCFileChunked(small, {
      parseDocuments: false,
      budgetMs: 10_000,
    });
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    setTimeoutSpy.mockRestore();
  });
});
