/**
 * D22-1: while an import runs, a marker of neutral labels and counts is kept
 * so a killed tab can be reported on the next load; it is cleared when the
 * import completes. A finished document's queue entry keeps no document text.
 * The processor is the boundary and is faked; the flow is the real code.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("../utils/musterCallProcessor", () => ({
  processFormationDocument: vi.fn(),
  persistFormationDocument: vi.fn(async () => {}),
  retryFormationDocumentPersist: vi.fn(),
  describePersistIncomplete: vi.fn(),
  autoPopulateProfile: vi.fn(async () => {}),
  PROCESSING_STATES: { EXTRACTING: "EXTRACTING", COMPLETE: "COMPLETE" },
}));

import { processFormationDocument } from "../utils/musterCallProcessor";
import { useSequentialFormationFlow } from "./useSequentialFormationFlow";
import {
  IMPORT_MARKER_KEY,
  readInterruptedImport,
} from "../utils/importProgressMarker";

const NAME = "generic-private-name.pdf";
const TEXT = "generic document text ".repeat(1000);

const entries = [
  { id: "e1", file: new File(["x"], NAME), estimatedType: "DD214" },
  { id: "e2", file: new File(["y"], "other.pdf"), estimatedType: "DBQ" },
];

let formationQueue;

function setup() {
  formationQueue = {
    formation: entries,
    stats: {},
    updateEntry: vi.fn(),
    startFormation: vi.fn(() => entries[0]),
    completeCurrentAndNext: vi.fn(() => null),
    skipCurrentAndNext: vi.fn(() => null),
    errorEntryAndNext: vi.fn(() => null),
    getFormation: () => entries,
  };
  return renderHook(() =>
    useSequentialFormationFlow({
      formationQueue,
      toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
      setError: vi.fn(),
      setProcessingState: vi.fn(),
    }),
  ).result;
}

const settle = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  sessionStorage.clear();
  for (const method of ["log", "warn", "error"]) {
    vi.spyOn(console, method).mockImplementation(() => {});
  }
  processFormationDocument.mockResolvedValue({
    filename: NAME,
    size: 1,
    status: "complete",
    readyForReview: true,
    text: TEXT,
    pagesRead: 2,
    coverageNote: "Read all 2 page(s).",
    extractedData: { type: "DD214" },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the import marker follows the import", () => {
  it("is set when the import starts, with neutral labels and no file name", async () => {
    const result = setup();

    await act(async () => result.current.startSequentialProcessing());

    expect(readInterruptedImport()).toMatchObject({ saved: 0, total: 2 });
    const stored = sessionStorage.getItem(IMPORT_MARKER_KEY);
    expect(JSON.parse(stored).labels).toEqual([
      "document 1 (DD214)",
      "document 2 (DBQ)",
    ]);
    expect(stored).not.toMatch(/private-name|other\.pdf/);
  });

  it("counts a document once it is saved, and is cleared when the import completes", async () => {
    const result = setup();
    await act(async () => result.current.startSequentialProcessing());

    await act(async () => {
      await result.current.handleVerifyAndSave({
        verifiedData: {},
        saveToVKB: true,
        updateProfile: false,
      });
    });
    expect(readInterruptedImport()).toMatchObject({ saved: 1, total: 2 });

    await settle(600);
    expect(readInterruptedImport()).toBeNull();
  });
});

describe("a finished document's queue entry", () => {
  it("keeps the reading notices but none of the document's text", async () => {
    const result = setup();
    await act(async () => result.current.startSequentialProcessing());

    await act(async () => {
      await result.current.handleVerifyAndSave({
        verifiedData: {},
        saveToVKB: true,
        updateProfile: false,
      });
    });

    const [kept] = formationQueue.completeCurrentAndNext.mock.calls[0];
    expect(kept.text).toBeUndefined();
    expect(JSON.stringify(kept)).not.toContain("generic document text");
    expect(kept.coverageNote).toBe("Read all 2 page(s).");
    expect(kept.status).toBe("complete");
  });
});
