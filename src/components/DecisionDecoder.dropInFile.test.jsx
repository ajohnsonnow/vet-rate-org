/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * D16-6: Decision Decoder's Drop-In File rejected every PDF and image
 * because isPDFFile/isImageFile (ocr.js) match a filename string, but
 * DecisionDecoder.jsx's own processFile called them with the File object
 * itself - coerced to "[object File]" by the regex, matching neither
 * extension pattern. computeCombinedText must also never embed a dropped
 * file's real name (which commonly carries a veteran's own name) into the
 * text sent to the AI (ADR-008) - a neutral "Document N (type, date)"
 * label is used instead.
 *
 * D19-1: the image test below used to mock `analyzeImage` itself, returning
 * a canned `{ success: true, text }` shape that ocr.js's real analyzeImage
 * never produces (no `success` field) and that never actually called OCR -
 * so the test passed while the real dropped-image path always showed "No
 * text extracted". This now leaves `analyzeImage` as the real
 * implementation and only fakes the underlying tesseract.js worker (the
 * same seam DenialDecoder.offDeviceFacts.test.js already mocks), so the
 * real analyzeImage -> createWorker -> recognize() call chain is what's
 * under test.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ocr.js transitively imports advancedOCR.js -> pdfjs-dist, which
// references canvas globals jsdom doesn't provide - same recipe as
// serviceEntryConsistency.integration.test.jsx.
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

// jsdom ships no image decoder (no optional `canvas` package): a real
// Image's onload/onerror never fires for a data: URL. analyzeImage only
// needs *a* width/height, not real decoded pixels, so this stands in for
// the browser's decode step the same way DOMMatrix/Path2D stand in above.
class FakeImage {
  set src(_value) {
    queueMicrotask(() => this.onload?.());
  }
}
globalThis.Image = FakeImage;

const mockOCRWorker = {
  recognize: vi.fn(async () => ({
    data: { text: "extracted image text", confidence: 91 },
  })),
  terminate: vi.fn(async () => {}),
};
vi.mock("tesseract.js", () => ({
  createWorker: vi.fn(async () => mockOCRWorker),
}));

vi.mock("../utils/ocr", async () => {
  const actual = await vi.importActual("../utils/ocr");
  return {
    ...actual,
    analyzePDF: vi.fn(async () => ({ text: "extracted PDF text" })),
  };
});

const { processFile, computeCombinedText } =
  await import("./DecisionDecoder.jsx");

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

// processFile's first setUploadedFiles call appends the pending entry via
// a functional update - replaying it against an empty list recovers the
// entry object itself.
function pendingEntryFrom(ctx) {
  const updater = ctx.setUploadedFiles.mock.calls[0][0];
  return updater([])[0];
}

// Every setUploadedFiles call is a functional update; replaying all of them
// in order against an empty list recovers the final entry state, however
// many intermediate updates (pending -> extracted -> combined-text refresh)
// processFile made.
function finalEntryFrom(ctx) {
  let state = [];
  for (const [updater] of ctx.setUploadedFiles.mock.calls) {
    state = updater(state);
  }
  return state[0];
}

describe("DecisionDecoder processFile: accepts real PDF/image File objects (D16-6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts a dropped PDF instead of rejecting it as unsupported", async () => {
    const ctx = makeProcessFileCtx();
    await processFile(makeFile("decision-letter.pdf", "application/pdf"), ctx);

    expect(ctx.setFileError).not.toHaveBeenCalled();
    expect(pendingEntryFrom(ctx).fileType).toBe("pdf");
  });

  it("accepts a dropped image instead of rejecting it as unsupported", async () => {
    const ctx = makeProcessFileCtx();
    await processFile(makeFile("decision-letter.png", "image/png"), ctx);

    expect(ctx.setFileError).not.toHaveBeenCalled();
    expect(pendingEntryFrom(ctx).fileType).toBe("image");
  });

  it("runs real OCR on a dropped image and surfaces the extracted text (D19-1)", async () => {
    const ctx = makeProcessFileCtx();
    await processFile(makeFile("decision-letter.png", "image/png"), ctx);

    expect(mockOCRWorker.recognize).toHaveBeenCalledTimes(1);
    const finalEntry = finalEntryFrom(ctx);
    expect(finalEntry.extractedText).toBe("extracted image text");
    expect(finalEntry.error).toBeNull();
  });

  it("still rejects a genuinely unsupported file type", async () => {
    const ctx = makeProcessFileCtx();
    await processFile(makeFile("notes.txt", "text/plain"), ctx);

    expect(ctx.setFileError).toHaveBeenCalledWith(
      expect.stringContaining("Unsupported file"),
    );
    expect(ctx.setUploadedFiles).not.toHaveBeenCalled();
  });
});

describe("computeCombinedText: never embeds a dropped file's real name in AI-bound text (ADR-008)", () => {
  it("labels each file by index/type/upload-date, not by its real fileName", () => {
    const fileList = [
      {
        file: { name: "John-Doe-SSN-123-45-6789-decision.pdf" },
        fileType: "pdf",
        addedAt: "2026-09-29T10:00:00.000Z",
        extractedText: "denial text one",
      },
      {
        file: { name: "Jane-Smith-VAfile-decision.png" },
        fileType: "image",
        addedAt: "2026-09-29T11:00:00.000Z",
        extractedText: "denial text two",
      },
    ];

    const combined = computeCombinedText(fileList);

    expect(combined).not.toContain("John-Doe");
    expect(combined).not.toContain("Jane-Smith");
    expect(combined).not.toContain(".pdf");
    expect(combined).not.toContain(".png");
    expect(combined).toContain("Document 1 (PDF, 2026-09-29)");
    expect(combined).toContain("Document 2 (Image, 2026-09-29)");
    expect(combined).toContain("denial text one");
    expect(combined).toContain("denial text two");
  });
});
