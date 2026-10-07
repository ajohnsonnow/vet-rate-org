/**
 * analyzePDF (ocr.js) never returns a `success` field - it either resolves
 * with the extracted result or throws. _processPdfFile gated on
 * `result.success && result.text`, which was always false, so every
 * dropped PDF (including a clean text PDF) showed "Failed to extract text
 * from PDF" no matter what it contained. Same defect class as the one
 * fixed in DecisionDecoder.jsx's extractFileTextAndPreview.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// SecondaryScoutLauncher transitively imports pdfjs, which references
// canvas globals jsdom doesn't provide - same recipe as
// SecondaryScoutLauncher.parseConditions.test.js.
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

vi.mock("../utils/ocr", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    analyzePDF: vi.fn(async () => ({
      text: "Service connection for lumbosacral strain is granted.",
    })),
  };
});

const { _processPdfFile } = await import("./SecondaryScoutLauncher.jsx");

function makeCtx() {
  return {
    setPdfFile: vi.fn(),
    setPdfError: vi.fn(),
    setExtractedPdfConditions: vi.fn(),
    setPdfOcrProgress: vi.fn(),
  };
}

describe("SecondaryScoutLauncher _processPdfFile: accepts analyzePDF's real result shape", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses conditions from the extracted text instead of a false 'Failed to extract' error", async () => {
    const ctx = makeCtx();
    const file = new File(["dummy"], "decision-letter.pdf", {
      type: "application/pdf",
    });

    await _processPdfFile(file, ctx);

    expect(ctx.setExtractedPdfConditions).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining("Lumbosacral")]),
    );
    expect(ctx.setPdfError).toHaveBeenCalledWith(null);
    expect(ctx.setPdfError).not.toHaveBeenCalledWith(
      expect.stringContaining("Failed to extract"),
    );
  });
});
