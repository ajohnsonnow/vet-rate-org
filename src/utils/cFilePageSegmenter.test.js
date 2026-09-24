import { describe, it, expect } from "vitest";
import { segmentPages, chunkBySegment } from "./cFilePageSegmenter";

// Covers the PAGE_SLASH_N /^\s{0,10}1\s{0,10}\/\s{0,10}\d{1,4}\s{0,10}$/m
// pattern (bounded for sonarjs/super-linear-regex) against realistic
// "1 / N" page-marker text pulled from synthetic C-File pages.
describe("cFilePageSegmenter: PAGE_SLASH_N boundary detection", () => {
  it("starts a new segment on a plain '1 / 3' page marker", () => {
    const pages = [
      { pageNum: 1, text: "--- PAGE 1 ---\nFirst document body text.\n" },
      {
        pageNum: 2,
        text: "--- PAGE 2 ---\n1 / 3\nNew document starts here with its own boilerplate.\n",
      },
    ];
    const segments = segmentPages(pages);
    expect(segments).toHaveLength(2);
    expect(segments[1].startPage).toBe(2);
  });

  it("still matches with extra spacing around the slash", () => {
    const pages = [
      { pageNum: 1, text: "--- PAGE 1 ---\nFirst document body text.\n" },
      {
        pageNum: 2,
        text: "--- PAGE 2 ---\n  1   /   12  \nAnother fresh document begins.\n",
      },
    ];
    const segments = segmentPages(pages);
    expect(segments).toHaveLength(2);
    expect(segments[1].startPage).toBe(2);
  });

  it("does not treat unrelated body text as a page marker", () => {
    const pages = [
      { pageNum: 1, text: "--- PAGE 1 ---\nFirst document body text.\n" },
      {
        pageNum: 2,
        text: "--- PAGE 2 ---\nContinuing the same discussion from before.\n",
      },
    ];
    const segments = segmentPages(pages);
    expect(segments).toHaveLength(1);
  });
});

describe("cFilePageSegmenter: chunkBySegment", () => {
  const seg = (id, docType, charLength, pages) => ({
    id,
    docType,
    charLength,
    pages,
  });
  const page = (n, len) => ({ pageNum: n, text: "x".repeat(len) });

  it("packs small segments that fit into a single chunk", () => {
    const segments = [
      seg("seg_0", "DD214", 10, [page(1, 10)]),
      seg("seg_1", "RATING_DECISION", 10, [page(2, 10)]),
    ];
    const chunks = chunkBySegment(segments, 100);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].startPage).toBe(1);
    expect(chunks[0].endPage).toBe(2);
    expect(chunks[0].pageNums).toEqual([1, 2]);
  });

  it("splits an oversized segment into overlapping page-bounded chunks", () => {
    const bigPages = [page(1, 60), page(2, 60), page(3, 60)];
    const segments = [seg("seg_0", "C_FILE_MEDICAL", 180, bigPages)];
    const chunks = chunkBySegment(segments, 100);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].pageNums).toEqual([1]);
    // 1-page overlap: page 1 repeats as the seed of the next chunk
    expect(chunks[1].pageNums[0]).toBe(1);
    expect(chunks.every((c) => c.docType === "C_FILE_MEDICAL")).toBe(true);
    expect(chunks.at(-1).endPage).toBe(3);
    // chunkIndex is re-sequenced across the whole output
    expect(chunks.map((c) => c.chunkIndex)).toEqual(chunks.map((_, i) => i));
  });

  it("flushes the buffer before an oversized segment and resumes packing after it", () => {
    const segments = [
      seg("seg_0", "DD214", 10, [page(1, 10)]),
      seg("seg_1", "C_FILE_MEDICAL", 180, [page(2, 90), page(3, 90)]),
      seg("seg_2", "RATING_DECISION", 10, [page(4, 10)]),
    ];
    const chunks = chunkBySegment(segments, 100);
    expect(chunks[0].pageNums).toEqual([1]);
    expect(chunks.at(-1).pageNums).toEqual([4]);
  });
});
