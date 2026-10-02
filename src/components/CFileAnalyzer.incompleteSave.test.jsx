/**
 * The C-File Analyzer imports through the Muster Call pipeline, which now
 * reports a save that did not finish. The read text still serves the analysis,
 * but the veteran must be told the document was not saved, in words that do
 * not point at a Retry button this tool does not have.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

vi.mock("../utils/musterCallProcessor", async (importOriginal) => ({
  ...(await importOriginal()),
  processFormationDocument: vi.fn(),
}));

const { processFormationDocument } =
  await import("../utils/musterCallProcessor");
const { _extractTextForAnalysis } = await import("./CFileAnalyzer.jsx");

const LONG_TEXT = "Generic claims file text. ".repeat(20);
const FILE = { name: "generic-cfile.pdf", size: 10 };

const makeCtx = () => ({
  setExtractionProgress: vi.fn(),
  setProcessingStage: vi.fn(),
  setStorageWarning: vi.fn(),
  setExtractedText: vi.fn(),
  setError: vi.fn(),
  setIsProcessing: vi.fn(),
});

const readResult = (overrides) => ({
  filename: FILE.name,
  text: LONG_TEXT,
  pageCount: 1,
  status: "complete",
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("C-File Analyzer when the document did not finish saving", () => {
  it("asks for the failed result back instead of a thrown error", async () => {
    processFormationDocument.mockResolvedValue(readResult());

    await _extractTextForAnalysis(FILE, makeCtx(), {});

    expect(processFormationDocument.mock.calls[0][2]).toMatchObject({
      returnIncompleteSave: true,
    });
  });

  it("warns plainly, names the cause, and still goes on to analyse the read text", async () => {
    processFormationDocument.mockResolvedValue(
      readResult({
        status: "error",
        persistIncomplete: true,
        persistQuotaExceeded: true,
      }),
    );
    const ctx = makeCtx();

    const extraction = await _extractTextForAnalysis(FILE, ctx, {});

    const warning = ctx.setStorageWarning.mock.calls[0][0];
    expect(warning).toContain('"generic-cfile.pdf"');
    expect(warning).toMatch(/storage is full/i);
    expect(warning).not.toMatch(/Retry/);
    expect(extraction.text).toBe(LONG_TEXT);
  });

  it("shows no warning when the save finished", async () => {
    processFormationDocument.mockResolvedValue(readResult());
    const ctx = makeCtx();

    await _extractTextForAnalysis(FILE, ctx, {});

    expect(ctx.setStorageWarning).not.toHaveBeenCalled();
  });
});
