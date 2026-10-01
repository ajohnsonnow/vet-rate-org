/**
 * D20-9/3: advancedOCR reports how many pages were read, OCR'd, blank or not
 * read, and documentAnalyzer forwards it - but processSingleDocument rebuilt
 * its result from a hand-picked field list and dropped all of it, so neither
 * Muster Call nor the C-File Analyzer could tell the veteran. The real
 * processFormationDocument must now carry the coverage through, and
 * options (the "Read remaining pages" action) must reach the analyzer.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

vi.mock("./documentAnalyzer", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, analyzeDocument: vi.fn() };
});

const { analyzeDocument } = await import("./documentAnalyzer");
const { processFormationDocument } = await import("./musterCallProcessor");

const LETTER_TEXT =
  "Department of Veterans Affairs. Dear Veteran, this letter is about your claim for compensation. " +
  "We made a decision on your claim. Your combined evaluation is 70 percent. ".repeat(
    3,
  );

const coverage = {
  pagesRead: 3,
  pagesOCRd: 1,
  pagesBlank: [2],
  pagesSkipped: [4],
  pagesFailed: [],
  coverageNote: "Read 3 of 4 page(s). 1 scanned page(s) were read with OCR.",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  analyzeDocument.mockResolvedValue({
    text: LETTER_TEXT,
    pageCount: 4,
    method: "advanced_ocr",
    ocrUsed: true,
    confidence: 90,
    ...coverage,
  });
});

describe("processFormationDocument: page coverage reaches the result", () => {
  it("carries pagesRead/pagesOCRd/pagesBlank/pagesSkipped/coverageNote through", async () => {
    const file = new File([LETTER_TEXT], "generic-letter.pdf", {
      type: "application/pdf",
    });
    const result = await processFormationDocument(file, () => {});

    expect(result.status).toBe("complete");
    expect(result.pagesRead).toBe(3);
    expect(result.pagesOCRd).toBe(1);
    expect(result.pagesBlank).toEqual([2]);
    expect(result.pagesSkipped).toEqual([4]);
    expect(result.coverageNote).toBe(coverage.coverageNote);
  });

  it("forwards extraction options (Read remaining pages) to the analyzer", async () => {
    const file = new File([LETTER_TEXT], "generic-letter.pdf", {
      type: "application/pdf",
    });
    await processFormationDocument(file, () => {}, { readAllPages: true });

    expect(analyzeDocument).toHaveBeenCalledTimes(1);
    expect(analyzeDocument.mock.calls[0][2]).toEqual({ readAllPages: true });
  });

  it("leaves coverage empty (not invented) when the extractor reported none", async () => {
    analyzeDocument.mockResolvedValue({
      text: LETTER_TEXT,
      pageCount: 1,
      method: "text",
      ocrUsed: false,
    });
    const file = new File([LETTER_TEXT], "generic-letter.txt", {
      type: "text/plain",
    });
    const result = await processFormationDocument(file, () => {});

    expect(result.coverageNote).toBeNull();
    expect(result.pagesSkipped).toEqual([]);
  });
});
