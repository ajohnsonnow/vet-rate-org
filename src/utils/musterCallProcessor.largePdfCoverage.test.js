/**
 * Files over 50 MB are streamed by processLargePDF, which reports pages with
 * no text layer but never ran through the page-coverage path, so the veteran
 * was told nothing about the pages that were not read. The real
 * processFormationDocument must turn that report into the same coverage
 * fields and a plain note (processLargePDF is the only fake).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

vi.mock("./pdfExtractor", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, processLargePDF: vi.fn() };
});

const { processLargePDF } = await import("./pdfExtractor");
const { processFormationDocument } = await import("./musterCallProcessor");

const LETTER_TEXT =
  "Department of Veterans Affairs. Dear Veteran, this letter is about your claim for compensation. " +
  "We made a decision on your claim. Your combined evaluation is 70 percent. ".repeat(
    3,
  );

function bigPdf() {
  const file = new File([LETTER_TEXT], "generic-large.pdf", {
    type: "application/pdf",
  });
  Object.defineProperty(file, "size", { value: 60 * 1024 * 1024 });
  return file;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("processFormationDocument on a PDF over 50 MB", () => {
  it("reports the pages that had no text layer as not read", async () => {
    processLargePDF.mockResolvedValue({
      text: LETTER_TEXT,
      pageCount: 100,
      method: "streaming_all_pages",
      pagesWithText: 90,
      pagesEmpty: 10,
      hasScannedSections: false,
      scannedPageRanges: [
        { start: 5, end: 7 },
        { start: 40, end: 46 },
      ],
    });
    const result = await processFormationDocument(bigPdf(), () => {});

    expect(result.status).toBe("complete");
    expect(result.pagesRead).toBe(90);
    expect(result.pagesOCRd).toBe(0);
    expect(result.pagesSkipped).toEqual([5, 6, 7, 40, 41, 42, 43, 44, 45, 46]);
    expect(result.coverageNote).toBe(
      "Read 90 of 100 page(s). 10 page(s) (pages 5-7, 40-46) had little or no typed text and were not read with OCR, because files this large are read for typed text only.",
    );
  });

  it("says plainly that a read-every-scanned-page request does not apply to files this large", async () => {
    processLargePDF.mockResolvedValue({
      text: LETTER_TEXT,
      pageCount: 100,
      method: "streaming_all_pages",
      pagesWithText: 97,
      pagesEmpty: 3,
      hasScannedSections: false,
      scannedPageRanges: [{ start: 10, end: 12 }],
    });
    const result = await processFormationDocument(bigPdf(), () => {}, {
      readAllPages: true,
    });

    expect(result.pagesRead).toBe(97);
    expect(result.pagesOCRd).toBe(0);
    expect(result.coverageNote).toContain(
      "The option to read every scanned page does not apply to files this large.",
    );
  });

  it("says all pages were read when every page had text", async () => {
    processLargePDF.mockResolvedValue({
      text: LETTER_TEXT,
      pageCount: 12,
      method: "streaming_all_pages",
      pagesWithText: 12,
      pagesEmpty: 0,
      hasScannedSections: false,
      scannedPageRanges: [],
    });
    const result = await processFormationDocument(bigPdf(), () => {});

    expect(result.coverageNote).toBe("Read all 12 page(s).");
    expect(result.pagesSkipped).toEqual([]);
  });
});
