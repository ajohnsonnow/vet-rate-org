/**
 * D-4's "a way to continue": a caller can re-invoke advancedPDFAnalysis
 * with ocrOnlyPageNumbers set to a BATCH of the document's full image-only
 * page list. The old skipped-page computation derived skippedPages only
 * from that batch (targetPages.slice(MAX_OCR_PAGES)), so any image-only
 * page outside the batch entirely was never counted as skipped - it fell
 * through to the plain text-layer branch with empty content and no
 * "NOT READ" marker, a silent gap the standing rule ("never silently drop
 * part of a document") forbids.
 */
import { describe, it, expect } from "vitest";

// advancedOCR imports pdfjs-dist, which references canvas globals jsdom
// doesn't provide (same pattern as
// advancedOCR.applyVATerminologyCorrection.test.js).
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const { computeOcrPageSets } = await import("./advancedOCR");

describe("advancedOCR: computeOcrPageSets", () => {
  it("normal path (no continuation): skips exactly the pages past MAX_OCR_PAGES", () => {
    const imageOnlyPages = [1, 2, 3, 4, 5];
    const { pagesToOcr, skippedPages } = computeOcrPageSets(
      imageOnlyPages,
      undefined,
      3,
    );

    expect(pagesToOcr).toEqual([1, 2, 3]);
    expect(skippedPages).toEqual([4, 5]);
  });

  it("continuation batch covering only SOME image-only pages: the rest still count as skipped", () => {
    // 50-page doc, all 50 image-only; caller continues pages 21-40 only.
    const imageOnlyPages = Array.from({ length: 50 }, (_, i) => i + 1);
    const ocrOnlyPageNumbers = Array.from({ length: 20 }, (_, i) => i + 21); // 21..40

    const { pagesToOcr, skippedPages } = computeOcrPageSets(
      imageOnlyPages,
      ocrOnlyPageNumbers,
      20,
    );

    expect(pagesToOcr).toEqual(ocrOnlyPageNumbers);
    // Pages 1-20 and 41-50 were never in the continuation batch at all -
    // they must still be reported as skipped, not silently dropped.
    const expectedSkipped = [
      ...Array.from({ length: 20 }, (_, i) => i + 1),
      ...Array.from({ length: 10 }, (_, i) => i + 41),
    ];
    expect(skippedPages).toEqual(expectedSkipped);
    expect(skippedPages).toHaveLength(30);
  });
});
