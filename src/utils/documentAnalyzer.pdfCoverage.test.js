/**
 * D-4: advancedOCR.js reports exactly how many pages were read, OCR'd and
 * skipped (pagesRead/pagesOCRd/pagesSkipped/coverageNote), and ocr.js's
 * analyzePDF passes that straight through - but documentAnalyzer.js's
 * analyzePDFDocument rebuilt its return object from scratch and copied only
 * text/letterheadText/pageCount/method/ocrUsed, silently dropping every
 * coverage field before it could reach any caller (musterCallProcessor.js,
 * CFileAnalyzer.jsx).
 */
import { describe, it, expect, vi } from "vitest";

// documentAnalyzer.js -> ocr.js -> advancedOCR.js -> pdfjs-dist, which
// references canvas globals jsdom doesn't provide - same recipe as
// cfileAnalyzer.offDeviceFallback.test.js.
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

vi.mock("./ocr", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    analyzePDF: vi.fn(async () => ({
      text: "extracted text",
      letterheadText: "",
      pageCount: 5,
      pagesRead: 5,
      pagesOCRd: 1,
      pagesSkipped: [4],
      method: "advanced_ocr",
      ocrUsed: true,
      coverageNote:
        "Read 5 page(s): 1 of 2 scanned page(s) were OCR'd, and 1 scanned " +
        "page(s) were skipped due to size limits.",
    })),
  };
});

const { analyzeDocument } = await import("./documentAnalyzer.js");

describe("documentAnalyzer.analyzeDocument: forwards advancedOCR's page-coverage fields", () => {
  it("does not drop pagesRead/pagesOCRd/pagesSkipped/coverageNote for a PDF", async () => {
    const file = new File(["dummy"], "decision-letter.pdf", {
      type: "application/pdf",
    });

    const result = await analyzeDocument(file);

    expect(result.pagesRead).toBe(5);
    expect(result.pagesOCRd).toBe(1);
    expect(result.pagesSkipped).toEqual([4]);
    expect(result.coverageNote).toMatch(/skipped/i);
  });
});
