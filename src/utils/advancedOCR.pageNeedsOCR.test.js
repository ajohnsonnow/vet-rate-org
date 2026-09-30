/**
 * D-4's per-page OCR decision used to flag any page whose trimmed text was
 * shorter than MIN_CHARS_PER_PAGE (50), with no check for whether the page
 * actually had a text layer at all. Real VA text PDFs often have a page
 * under 50 characters - an "Enclosure: VA Form 21-0958" last page, or a
 * "Page N of M" footer page - which sent that page through the full
 * Tesseract ensemble (seconds to tens of seconds per page) and, once more
 * than MAX_OCR_PAGES such pages existed, discarded its real text-layer
 * content as "NOT READ" even though it had already been extracted. A
 * genuinely scanned page has NO text items at all (itemCount === 0); a
 * short-but-real page always has some.
 */
import { describe, it, expect } from "vitest";

// advancedOCR imports pdfjs-dist, which references canvas globals jsdom
// doesn't provide (same pattern as
// advancedOCR.applyVATerminologyCorrection.test.js).
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const { pageNeedsOCR } = await import("./advancedOCR");

const config = { MIN_CHARS_PER_PAGE: 50 };

describe("advancedOCR: pageNeedsOCR", () => {
  it("does NOT flag a short-but-real text page (e.g. an enclosure line)", () => {
    const pageText = "Enclosure: VA Form 21-0958";
    expect(pageText.length).toBeLessThan(50);
    // A real text run always produces at least one item per word/run.
    expect(pageNeedsOCR(pageText, 4, config)).toBe(false);
  });

  it("does NOT flag a short 'Page N of M' footer page", () => {
    const pageText = "Page 3 of 12";
    expect(pageNeedsOCR(pageText, 4, config)).toBe(false);
  });

  it("flags a genuinely image-only page (zero text items)", () => {
    expect(pageNeedsOCR("", 0, config)).toBe(true);
  });

  it("does not flag a normal full page of real text", () => {
    const pageText = "A".repeat(500);
    expect(pageNeedsOCR(pageText, 80, config)).toBe(false);
  });
});
