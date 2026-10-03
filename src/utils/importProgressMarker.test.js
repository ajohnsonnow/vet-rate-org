/**
 * D22-1 follow-up: a tab the browser kills cannot show a message, so a small
 * marker (neutral labels and counts only) is kept while an import runs and
 * read back on the next load. Quick Exit, Atomic Wipe and Clear All Data must
 * remove it, so the real wipe functions are exercised here, not a copy.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  IMPORT_MARKER_KEY,
  startImportMarker,
  recordDocumentSaved,
  clearImportMarker,
  readInterruptedImport,
  describeInterruptedImport,
} from "./importProgressMarker";
import { triggerPanicRedirect } from "./safetyRedirect";
import { wipeAllLocalData } from "../components/AtomicWipe";

const LABELS = [
  "document 1 (DD214)",
  "document 2 (UNKNOWN)",
  "document 3 (DBQ)",
];

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("the import marker", () => {
  it("holds neutral labels and counts only, never a file name", () => {
    startImportMarker(LABELS);

    const stored = sessionStorage.getItem(IMPORT_MARKER_KEY);
    expect(JSON.parse(stored)).toEqual({ total: 3, saved: 0, labels: LABELS });
    expect(stored).not.toMatch(/\.pdf|\.txt|\.docx/i);
  });

  it("counts documents as they are saved", () => {
    startImportMarker(LABELS);
    recordDocumentSaved();
    recordDocumentSaved();

    expect(readInterruptedImport()).toEqual({ saved: 2, total: 3 });
  });

  it("never counts past the total", () => {
    startImportMarker(["document 1 (DD214)"]);
    recordDocumentSaved();
    recordDocumentSaved();

    expect(readInterruptedImport()).toEqual({ saved: 1, total: 1 });
  });

  it("is gone once the import finishes or is cancelled", () => {
    startImportMarker(LABELS);
    clearImportMarker();

    expect(readInterruptedImport()).toBeNull();
  });

  it("is not started for an empty import", () => {
    startImportMarker([]);

    expect(sessionStorage.getItem(IMPORT_MARKER_KEY)).toBeNull();
  });

  it("removes an unreadable marker instead of reporting a wrong count", () => {
    sessionStorage.setItem(IMPORT_MARKER_KEY, "{not json");

    expect(readInterruptedImport()).toBeNull();
    expect(sessionStorage.getItem(IMPORT_MARKER_KEY)).toBeNull();
  });

  it("rejects a marker whose counts do not add up", () => {
    sessionStorage.setItem(
      IMPORT_MARKER_KEY,
      JSON.stringify({ total: 2, saved: 5, labels: [] }),
    );

    expect(readInterruptedImport()).toBeNull();
  });
});

describe("the notice text", () => {
  it("says what happened, how many were saved and what to do", () => {
    expect(describeInterruptedImport({ saved: 2, total: 5 })).toBe(
      "Your last import was interrupted before it finished. 2 of 5 documents were saved. Add the same files again to finish - nothing will be duplicated.",
    );
  });

  it("reads correctly for a single document", () => {
    expect(describeInterruptedImport({ saved: 0, total: 1 })).toContain(
      "0 of 1 document was saved.",
    );
  });
});

describe("wiping", () => {
  it("Quick Exit (the panic redirect) removes the marker", () => {
    vi.stubGlobal("location", { replace: vi.fn(), href: "" });
    startImportMarker(LABELS);

    triggerPanicRedirect();

    expect(sessionStorage.getItem(IMPORT_MARKER_KEY)).toBeNull();
  });

  it("Atomic Wipe and every Clear All Data path remove the marker", async () => {
    startImportMarker(LABELS);

    await wipeAllLocalData();

    expect(sessionStorage.getItem(IMPORT_MARKER_KEY)).toBeNull();
  });
});
