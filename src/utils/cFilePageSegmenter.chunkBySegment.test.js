/**
 * Characterization coverage for chunkBySegment, added while splitting it
 * up to satisfy sonarjs/cognitive-complexity. No existing test exercised
 * this exported, correctness-critical C-File chunk-packing function.
 */
import { describe, it, expect } from "vitest";
import { chunkBySegment } from "./cFilePageSegmenter";

const makePage = (pageNum, charLength) => ({
  pageNum,
  text: String(pageNum).repeat(charLength),
});

const makeSegment = (id, docType, pages) => ({
  id,
  docType,
  startPage: pages[0].pageNum,
  endPage: pages[pages.length - 1].pageNum,
  pages,
  charLength: pages.reduce((sum, p) => sum + p.text.length, 0),
});

describe("chunkBySegment", () => {
  it("packs adjacent same-fitting segments into one chunk, keeping the first segment's docType", () => {
    const seg1 = makeSegment("seg1", "DD214", [makePage(1, 40)]);
    const seg2 = makeSegment("seg2", "RATING_DECISION", [makePage(2, 40)]);

    const chunks = chunkBySegment([seg1, seg2], 100);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      docType: "DD214",
      startPage: 1,
      endPage: 2,
      pageNums: [1, 2],
      segmentIds: ["seg1", "seg2"],
      chunkIndex: 0,
    });
    expect(chunks[0].text).toHaveLength(80);
  });

  it("flushes and starts a new chunk when the next segment would overflow maxChars", () => {
    const seg1 = makeSegment("seg1", "DD214", [makePage(1, 40)]);
    const seg2 = makeSegment("seg2", "DD214", [makePage(2, 40)]);
    const seg3 = makeSegment("seg3", "MEDICAL_RECORD", [makePage(3, 30)]);

    const chunks = chunkBySegment([seg1, seg2, seg3], 100);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].segmentIds).toEqual(["seg1", "seg2"]);
    expect(chunks[1]).toMatchObject({
      docType: "MEDICAL_RECORD",
      segmentIds: ["seg3"],
      chunkIndex: 1,
    });
  });

  it("splits an oversized segment internally with a 1-page overlap between adjacent internal chunks", () => {
    const oversized = makeSegment("big", "C_FILE", [
      makePage(4, 60),
      makePage(5, 60),
      makePage(6, 60),
    ]);

    const chunks = chunkBySegment([oversized], 100);

    expect(chunks).toHaveLength(3);
    expect(chunks[0].pageNums).toEqual([4]);
    expect(chunks[1].pageNums).toEqual([4, 5]); // 1-page overlap
    expect(chunks[2].pageNums).toEqual([5, 6]); // 1-page overlap
    for (const c of chunks) {
      expect(c.docType).toBe("C_FILE");
      expect(c.segmentIds).toEqual(["big"]);
    }
  });

  it("flushes the pending buffer before splitting an oversized segment, and assigns sequential chunkIndex throughout", () => {
    const seg1 = makeSegment("seg1", "DD214", [makePage(1, 40)]);
    const seg2 = makeSegment("seg2", "DD214", [makePage(2, 40)]);
    const seg3 = makeSegment("seg3", "MEDICAL_RECORD", [makePage(3, 30)]);
    const oversized = makeSegment("big", "C_FILE", [
      makePage(4, 60),
      makePage(5, 60),
      makePage(6, 60),
    ]);

    const chunks = chunkBySegment([seg1, seg2, seg3, oversized], 100);

    expect(chunks).toHaveLength(5);
    expect(chunks.map((c) => c.chunkIndex)).toEqual([0, 1, 2, 3, 4]);
    expect(chunks[1].docType).toBe("MEDICAL_RECORD");
    expect(chunks[2].docType).toBe("C_FILE");
  });
});
