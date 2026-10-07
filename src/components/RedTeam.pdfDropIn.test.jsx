/**
 * analyzePDF (ocr.js) never returns a `success` field - it either resolves
 * with the extracted result or throws. RedTeam's usePdfDropIn gated on
 * `result.success && result.text`, which was always false, so every
 * dropped PDF (including a clean text PDF) showed "Failed to extract text
 * from PDF" no matter what it contained. Same defect class as the one
 * fixed in DecisionDecoder.jsx's extractFileTextAndPreview.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { renderHook, act } from "@testing-library/react";

// RedTeam.jsx -> ocr.js -> advancedOCR.js -> pdfjs-dist, which references
// canvas globals jsdom doesn't provide - same recipe as
// DecisionDecoder.dropInFile.test.jsx.
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

vi.mock("../utils/ocr", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    analyzePDF: vi.fn(async () => ({ text: "extracted draft statement text" })),
  };
});

const { usePdfDropIn } = await import("./RedTeam.jsx");

function useTestHarness() {
  const [draftStatement, setDraftStatement] = useState("");
  const [isDocument, setIsDocument] = useState(false);
  const pdfDropIn = usePdfDropIn(setDraftStatement, setIsDocument);
  return { draftStatement, isDocument, pdfDropIn };
}

describe("RedTeam usePdfDropIn: accepts analyzePDF's real result shape", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("surfaces the extracted text instead of a false 'Failed to extract' error", async () => {
    const { result } = renderHook(() => useTestHarness());
    const file = new File(["dummy"], "draft-statement.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      await result.current.pdfDropIn.handlePdfFileChange({
        target: { files: [file] },
      });
    });

    expect(result.current.draftStatement).toBe(
      "extracted draft statement text",
    );
    expect(result.current.isDocument).toBe(true);
    expect(result.current.pdfDropIn.pdfError).toBeNull();
  });
});
