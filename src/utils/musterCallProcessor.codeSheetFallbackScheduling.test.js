/**
 * D19-7 follow-up (reviewer-confirmed defect): _computeCodeSheetData's
 * no-code-sheet fallback used to call vaDocumentParser's synchronous,
 * whole-text parseCodeSheet(text) directly - a single main-thread task with
 * no yield points (its own dcPattern matchAll and combinedMatch scan never
 * called slicer.maybeYield()). Most C-Files for a veteran with no rating
 * yet, or whose code sheet is OCR-garbled, hit exactly this branch. It now
 * uses vaCodeSheet's scanLooseRatingLinesChunked instead, which shares the
 * same chunked/yielding matchAllChunked scan the SC_HEADER search itself
 * was moved onto (see vaCodeSheet.chunked.equivalence.test.js). This proves
 * the synchronous fallback is never reached from the C-File import path.
 */
import { describe, it, expect, vi } from "vitest";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

vi.mock("./vaDocumentParser", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, parseCodeSheet: vi.fn(actual.parseCodeSheet) };
});

const vaDocumentParser = await import("./vaDocumentParser.js");
const { buildSegmentedCFileResult } = await import("./musterCallProcessor.js");

const filler = (label) =>
  `${label} continuation text. `.repeat(20) +
  "Additional narrative body so the segment clears the 200-character minimum length filter.";

// No SC_HEADER anywhere in this C-File - the defect's own failure scenario.
const NO_CODE_SHEET_TEXT = [
  "DD FORM 214 CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY",
  "CHARACTER OF SERVICE: HONORABLE",
  filler("Service record"),
  "RATING DECISION",
  "The evidence shows service connection is warranted.",
  filler("Decision narrative"),
].join("\n");

describe("buildSegmentedCFileResult: code-sheet phase without a code sheet", () => {
  it("never falls back to vaDocumentParser's synchronous parseCodeSheet", async () => {
    const result = await buildSegmentedCFileResult(NO_CODE_SHEET_TEXT, {});

    expect(vaDocumentParser.parseCodeSheet).not.toHaveBeenCalled();
    expect(Array.isArray(result.codeSheet?.conditions)).toBe(true);
    expect(result.codeSheet.conditions).toEqual([]);
  });
});
