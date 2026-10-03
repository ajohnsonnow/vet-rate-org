/**
 * The C-File Analyzer writes nothing until the veteran chooses Save to my
 * records. When that save does not finish, the screen says so plainly in
 * words that point at the button that is there, and a second try is allowed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

vi.mock("../utils/musterCallProcessor", async (importOriginal) => ({
  ...(await importOriginal()),
  processFormationDocument: vi.fn(),
  persistFormationDocument: vi.fn(),
}));
vi.mock("../utils/veteranContextProvider", async (importOriginal) => ({
  ...(await importOriginal()),
  mergeAnalysisIntoVkb: vi.fn().mockResolvedValue(undefined),
}));

const {
  processFormationDocument,
  persistFormationDocument,
  DocumentPersistIncompleteError,
} = await import("../utils/musterCallProcessor");
const { mergeAnalysisIntoVkb } =
  await import("../utils/veteranContextProvider");
const { _extractTextForAnalysis, CFileSaveToRecords } =
  await import("./CFileAnalyzer.jsx");

const LONG_TEXT = "Generic claims file text. ".repeat(20);
const FILE = { name: "generic-cfile.pdf", size: 10 };
const DEFERRED = {
  filename: FILE.name,
  size: FILE.size,
  text: LONG_TEXT,
  pageCount: 1,
  status: "complete",
  extractedData: { claimNumber: "SYNTHETIC-1", branch: "Army" },
};
const EXTRACTED = { totalPages: 1, text: LONG_TEXT, deferredResult: DEFERRED };
const ANALYSIS = {
  potential_claims: [{ condition: "Tinnitus", evidence: "noted" }],
  timeline: [{ date: "2010-01-02", event: "Visit" }],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("reading the document", () => {
  it("asks the pipeline to write nothing", async () => {
    processFormationDocument.mockResolvedValue(DEFERRED);

    await _extractTextForAnalysis(
      FILE,
      {
        setExtractionProgress: vi.fn(),
        setProcessingStage: vi.fn(),
        setExtractedText: vi.fn(),
        setError: vi.fn(),
        setIsProcessing: vi.fn(),
      },
      {},
    );

    expect(processFormationDocument.mock.calls[0][2]).toMatchObject({
      deferPersist: true,
      omitIdentifiers: true,
    });
  });
});

describe("Save to my records when the save does not finish", () => {
  it("names the cause, offers the same button again, and then confirms", async () => {
    persistFormationDocument.mockRejectedValueOnce(
      new DocumentPersistIncompleteError([], { quotaExceeded: true }),
    );
    render(
      <CFileSaveToRecords
        file={FILE}
        extractedText={EXTRACTED}
        analysisResult={ANALYSIS}
      />,
    );
    expect(screen.getByText(/Nothing has been saved yet/)).toBeTruthy();
    expect(persistFormationDocument).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save to my records" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain('"generic-cfile.pdf"');
    expect(alert.textContent).toMatch(/storage is full/i);
    expect(mergeAnalysisIntoVkb).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save to my records" }));

    await waitFor(() =>
      expect(screen.getByText(/Saved to your records/)).toBeTruthy(),
    );
    expect(screen.queryByRole("alert")).toBeNull();
    const filed = persistFormationDocument.mock.calls[1][1];
    expect(filed.extractedData).toEqual({ branch: "Army" });
    expect(mergeAnalysisIntoVkb).toHaveBeenCalledTimes(1);
  });
});
