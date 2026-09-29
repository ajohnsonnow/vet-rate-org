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
 */
import { describe, it, expect, vi } from "vitest";

// ocr.js transitively imports advancedOCR.js -> pdfjs-dist, which
// references canvas globals jsdom doesn't provide - same recipe as
// serviceEntryConsistency.integration.test.jsx.
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

vi.mock("../utils/ocr", async () => {
  const actual = await vi.importActual("../utils/ocr");
  return {
    ...actual,
    analyzePDF: vi.fn(async () => ({ text: "extracted PDF text" })),
    analyzeImage: vi.fn(async () => ({
      success: true,
      text: "extracted image text",
    })),
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

describe("DecisionDecoder processFile: accepts real PDF/image File objects (D16-6)", () => {
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
