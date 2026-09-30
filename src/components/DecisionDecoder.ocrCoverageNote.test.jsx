/**
 * D-4: "tell the veteran exactly how many pages were read, OCR'd and which
 * were skipped" - advancedOCR.js already computes this as result.coverageNote,
 * but DecisionDecoder's extractFileTextAndPreview discarded everything from
 * analyzePDF except .text, so a dropped PDF's coverage note never reached
 * the uploaded-file entry (and so never reached the screen) no matter what
 * advancedOCR.js reported.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ocr.js transitively imports advancedOCR.js -> pdfjs-dist, which
// references canvas globals jsdom doesn't provide - same recipe as
// DecisionDecoder.dropInFile.test.jsx.
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const PDF_COVERAGE_NOTE =
  "Read 5 page(s): 1 of 2 scanned page(s) were OCR'd, and 1 scanned " +
  "page(s) were skipped due to size limits - pass their page numbers as " +
  "ocrOnlyPageNumbers to continue.";

vi.mock("../utils/ocr", async () => {
  const actual = await vi.importActual("../utils/ocr");
  return {
    ...actual,
    analyzePDF: vi.fn(async () => ({
      text: "extracted PDF text",
      coverageNote: PDF_COVERAGE_NOTE,
    })),
  };
});

const { processFile } = await import("./DecisionDecoder.jsx");

function makeFile(name, type) {
  return new File(["dummy content"], name, { type });
}

function makeProcessFileCtx() {
  return {
    setUploadedFiles: vi.fn(),
    setOcrProgress: vi.fn(),
    setCurrentProcessingFile: vi.fn(),
    setFileError: vi.fn(),
    setDenialText: vi.fn(),
  };
}

function finalEntryFrom(ctx) {
  let state = [];
  for (const [updater] of ctx.setUploadedFiles.mock.calls) {
    state = updater(state);
  }
  return state[0];
}

describe("DecisionDecoder processFile: surfaces the PDF page-coverage note (D-4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("carries analyzePDF's coverageNote onto the uploaded-file entry", async () => {
    const ctx = makeProcessFileCtx();
    await processFile(makeFile("decision-letter.pdf", "application/pdf"), ctx);

    const finalEntry = finalEntryFrom(ctx);
    expect(finalEntry.coverageNote).toBe(PDF_COVERAGE_NOTE);
  });
});
