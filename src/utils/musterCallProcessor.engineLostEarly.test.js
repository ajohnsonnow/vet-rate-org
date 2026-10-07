/**
 * D21-2, the case the first fix missed: the on-device engine was ready when the
 * import started (Muster Call will not start without it) but is gone by the
 * time the very first C-File reaches the AI step, for example while a long OCR
 * pass held the GPU. That must be rebuilt and retried like any later C-File,
 * not skipped without a word. The fault is injected at the extraction boundary
 * (the OCR pass is what takes the engine away); import, classification, the
 * C-File path and the AI step are the real code.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeIndexedDB } from "../__tests__/helpers/fakeIndexedDB";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

vi.mock("./unifiedAIService", async (importOriginal) => ({
  ...(await importOriginal()),
  generateAI: vi.fn(),
  getDocumentAIRouting: vi.fn(),
  isAnyAIAvailable: vi.fn(() => true),
  reloadSwarmEngine: vi.fn(),
}));

vi.mock("./documentAnalyzer", async (importOriginal) => ({
  ...(await importOriginal()),
  analyzeDocument: vi.fn(),
}));

const filler = (label) =>
  `${label} continuation text. `.repeat(20) +
  "Additional narrative body so the segment clears the 200-character minimum length filter.";

const CFILE_TEXT = [
  "Department of Veterans Affairs. Dear Veteran, this letter is about your claim for compensation.",
  "We made a decision on your claim. Your combined evaluation is 70 percent.",
  filler("Service treatment record"),
  "RATING DECISION",
  "The evidence shows service connection is warranted.",
  filler("Decision narrative"),
].join("\n");

const READY = { onDeviceReady: true, onDeviceMode: "swarm" };
const GONE = {
  onDeviceReady: false,
  onDeviceMode: null,
  blockedProviderLabel: null,
};

let ai;
let documentAnalyzer;
let processFormationDocument;

async function load() {
  vi.resetModules();
  vi.stubGlobal("indexedDB", createFakeIndexedDB().indexedDB);
  ai = await import("./unifiedAIService.js");
  documentAnalyzer = await import("./documentAnalyzer.js");
  ({ processFormationDocument } = await import("./musterCallProcessor.js"));
  ai.generateAI.mockReset();
  ai.reloadSwarmEngine.mockReset();
  ai.generateAI.mockResolvedValue({
    text: JSON.stringify({ potential_claims: [], exposures: [] }),
  });
  ai.isAnyAIAvailable.mockReturnValue(true);
  ai.getDocumentAIRouting.mockReturnValue(READY);
}

const engineLostDuringExtraction = () => {
  documentAnalyzer.analyzeDocument.mockImplementation(async () => {
    ai.getDocumentAIRouting.mockReturnValue(GONE);
    ai.isAnyAIAvailable.mockReturnValue(false);
    return {
      text: CFILE_TEXT,
      pageCount: 120,
      method: "text",
      ocrUsed: false,
      confidence: 90,
    };
  });
};

const importCFile = () =>
  processFormationDocument(
    new File([CFILE_TEXT], "generic-cfile.pdf", { type: "application/pdf" }),
    () => {},
  );

beforeEach(async () => {
  localStorage.clear();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  await load();
});

describe("an engine lost before the first C-File reaches the AI step", () => {
  it("is rebuilt, retried once, and the analysis is returned when the rebuild works", async () => {
    engineLostDuringExtraction();
    ai.reloadSwarmEngine.mockImplementation(async () => {
      ai.getDocumentAIRouting.mockReturnValue(READY);
      ai.isAnyAIAvailable.mockReturnValue(true);
    });

    const result = await importCFile();

    expect(result.extractedData.type).toBe("c_file");
    expect(ai.reloadSwarmEngine).toHaveBeenCalledTimes(1);
    expect(result.extractedData.aiAnalysis).not.toBeNull();
    expect(result.extractedData.aiAnalysisNotice).toBeNull();
  }, 30_000);

  it("shows the plain notice, never a silent skip, when it cannot be rebuilt", async () => {
    engineLostDuringExtraction();
    ai.reloadSwarmEngine.mockRejectedValue(new Error("GPU process wedged"));

    const result = await importCFile();

    expect(result.extractedData.aiAnalysis).toBeNull();
    expect(result.extractedData.aiAnalysisNotice).toMatch(
      /AI analysis of this document/,
    );
  }, 30_000);

  it("stays silent when no on-device engine was running when the import started", async () => {
    engineLostDuringExtraction();
    ai.getDocumentAIRouting.mockReturnValue(GONE);
    ai.isAnyAIAvailable.mockReturnValue(false);

    const result = await importCFile();

    expect(ai.reloadSwarmEngine).not.toHaveBeenCalled();
    expect(result.extractedData.aiAnalysisNotice).toBeNull();
  }, 30_000);
});
