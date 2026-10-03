/**
 * D22-1: a finished document's queue entry kept the document's full text and
 * extraction in memory (and so did every other finished document), until the
 * page closed. It keeps only what the completion summary shows.
 */
import { describe, it, expect } from "vitest";
import { slimCompletedResult } from "./formationQueue";
import { getReadingNotices } from "./readingNotices";

const BIG_TEXT = "generic page text ".repeat(50_000);

const fullResult = () => ({
  filename: "generic.pdf",
  status: "complete",
  text: BIG_TEXT,
  pageCount: 40,
  pagesRead: 38,
  pagesOCRd: 3,
  pagesBlank: [5],
  pagesSkipped: [39],
  pagesFailed: [],
  coverageNote: "Read 38 of 40 page(s).",
  classification: {
    type: "DD214",
    confidence: 0.9,
    reasons: ["x".repeat(1000)],
  },
  extractedData: {
    type: "DD214",
    awards: [{ name: "a" }, { name: "b" }],
    rawText: BIG_TEXT,
    pageCoverageNote: "stored note",
    aiAnalysisNotice: "The AI analysis did not finish.",
  },
  verifiedData: {
    verifiedData: { branch: "ARMY", rawText: BIG_TEXT },
    saveToVKB: true,
  },
});

describe("slimCompletedResult", () => {
  it("keeps none of the document's text", () => {
    const slim = slimCompletedResult(fullResult());

    expect(JSON.stringify(slim)).not.toContain("generic page text");
    expect(JSON.stringify(slim).length).toBeLessThan(2000);
  });

  it("keeps exactly what the completion summary shows", () => {
    const full = fullResult();
    const slim = slimCompletedResult(full);

    expect(getReadingNotices(slim)).toEqual(getReadingNotices(full));
    expect(slim.status).toBe("complete");
    expect(slim.classification).toEqual({ type: "DD214", confidence: 0.9 });
    expect(slim.verifiedData.verifiedData).toEqual({ branch: "ARMY" });
    expect(slim.extractedData.awardsCount).toBe(2);
  });

  it("does not change the result it was given", () => {
    const full = fullResult();
    slimCompletedResult(full);

    expect(full.text).toBe(BIG_TEXT);
  });

  it("passes through a missing result", () => {
    expect(slimCompletedResult(null)).toBeNull();
  });
});
