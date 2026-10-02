/**
 * A PDF over 50 MB is read by a streaming extractor that opens its own
 * IndexedDB and awaits each page's text; none of it can be cancelled and a
 * wedged one freezes the import with no message. Honest work on a file this
 * size takes minutes, so the bound is silence, not a deadline: a read that
 * keeps reporting pages must be left alone however long it runs, and one that
 * goes quiet must end with a plain message. processLargePDF is the only fake.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createFakeIndexedDB } from "../__tests__/helpers/fakeIndexedDB";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

vi.stubGlobal("indexedDB", createFakeIndexedDB().indexedDB);

vi.mock("./pdfExtractor", async (importOriginal) => ({
  ...(await importOriginal()),
  processLargePDF: vi.fn(),
}));

const { processLargePDF } = await import("./pdfExtractor");
const { processFormationDocument } = await import("./musterCallProcessor");

const LETTER_TEXT =
  "Department of Veterans Affairs. Dear Veteran, this letter is about your claim for compensation. " +
  "We made a decision on your claim. Your combined evaluation is 70 percent. ".repeat(
    3,
  );
const STALL_MS = 180_000;
const finished = () => ({
  text: LETTER_TEXT,
  pageCount: 100,
  method: "streaming_all_pages",
  pagesWithText: 100,
  pagesEmpty: 0,
  hasScannedSections: false,
  scannedPageRanges: [],
});

function bigPdf() {
  const file = new File([LETTER_TEXT], "generic-large.pdf", {
    type: "application/pdf",
  });
  Object.defineProperty(file, "size", { value: 60 * 1024 * 1024 });
  return file;
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  localStorage.clear();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("a very large PDF read that goes quiet", () => {
  it("ends with a plain message that names no file when it never reports anything", async () => {
    processLargePDF.mockImplementation(() => new Promise(() => {}));

    const pending = processFormationDocument(bigPdf(), () => {});
    await vi.advanceTimersByTimeAsync(STALL_MS + 1000);
    const result = await pending;

    expect(result.status).toBe("error");
    expect(result.error).toMatch(/stopped making progress/);
    expect(result.error).not.toContain("generic-large");
  });

  it("ends the same way when pages were read and then it went quiet", async () => {
    processLargePDF.mockImplementation(async (_file, opts) => {
      await pause(100_000);
      opts.onProgress(1, 100, 1);
      await pause(100_000);
      opts.onProgress(2, 100, 2);
      return new Promise(() => {});
    });

    const pending = processFormationDocument(bigPdf(), () => {});
    await vi.advanceTimersByTimeAsync(200_000 + STALL_MS - 1000);
    expect(await Promise.race([pending, "still waiting"])).toBe(
      "still waiting",
    );
    await vi.advanceTimersByTimeAsync(2000);
    const result = await pending;

    expect(result.status).toBe("error");
    expect(result.error).toMatch(/stopped making progress/);
  });
});

describe("a very large PDF read that keeps making progress", () => {
  it("is never cut off, however long it runs past the quiet bound", async () => {
    processLargePDF.mockImplementation(async (_file, opts) => {
      for (let page = 1; page <= 6; page++) {
        await pause(100_000);
        opts.onProgress(page, 6, Math.round((page / 6) * 100));
      }
      return finished();
    });

    const pending = processFormationDocument(bigPdf(), () => {});
    await vi.advanceTimersByTimeAsync(600_000 + 1000);
    const result = await pending;

    expect(result.status).toBe("complete");
    expect(result.pageCount).toBe(100);
  });
});
