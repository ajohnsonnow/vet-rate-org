/**
 * A tab the browser kills cannot show a message, so a small marker (neutral
 * labels and counts only) is kept in local storage while an import runs, with
 * an owner heartbeat, and read back on the next load in any tab. Quick Exit,
 * Atomic Wipe and Clear All Data must remove it, so the real wipe functions
 * are exercised here, not a copy.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  IMPORT_MARKER_KEY,
  IMPORT_MARKER_KEY_PREFIX,
  HEARTBEAT_INTERVAL_MS,
  STALE_AFTER_MS,
  startImportMarker,
  recordDocumentSaved,
  clearImportMarker,
  clearAllImportMarkers,
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

const markerKeys = () =>
  Array.from({ length: localStorage.length }, (_, i) =>
    localStorage.key(i),
  ).filter((key) => key.startsWith(IMPORT_MARKER_KEY_PREFIX));

function seedOtherTabMarker(id, { ageMs, saved = 1, total = 3 }) {
  localStorage.setItem(
    `${IMPORT_MARKER_KEY_PREFIX}${id}`,
    JSON.stringify({
      id,
      total,
      saved,
      labels: LABELS,
      owner: "another-tab",
      heartbeat: Date.now() - ageMs,
    }),
  );
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  clearAllImportMarkers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("the import marker", () => {
  it("lives in local storage and holds neutral labels and counts only", () => {
    startImportMarker(LABELS);

    const [key] = markerKeys();
    const stored = localStorage.getItem(key);
    expect(markerKeys()).toHaveLength(1);
    expect(JSON.parse(stored)).toEqual({
      total: 3,
      saved: 0,
      labels: LABELS,
      id: expect.any(String),
      owner: expect.any(String),
      heartbeat: expect.any(Number),
    });
    expect(key).toBe(`${IMPORT_MARKER_KEY_PREFIX}${JSON.parse(stored).id}`);
    expect(stored).not.toMatch(/\.pdf|\.txt|\.docx/i);
    expect(sessionStorage).toHaveLength(0);
  });

  it("counts documents as they are saved", () => {
    startImportMarker(LABELS);
    recordDocumentSaved();
    recordDocumentSaved();

    const marker = JSON.parse(localStorage.getItem(markerKeys()[0]));
    expect(marker).toMatchObject({ saved: 2, total: 3 });
  });

  it("never counts past the total", () => {
    startImportMarker(["document 1 (DD214)"]);
    recordDocumentSaved();
    recordDocumentSaved();

    const marker = JSON.parse(localStorage.getItem(markerKeys()[0]));
    expect(marker).toMatchObject({ saved: 1, total: 1 });
  });

  it("is gone once the import finishes or is cancelled", () => {
    startImportMarker(LABELS);
    clearImportMarker();

    expect(markerKeys()).toHaveLength(0);
  });

  it("is not started for an empty import", () => {
    startImportMarker([]);

    expect(markerKeys()).toHaveLength(0);
  });

  it("is not recreated by a save after the marker was removed", () => {
    startImportMarker(LABELS);
    clearAllImportMarkers();

    recordDocumentSaved();

    expect(markerKeys()).toHaveLength(0);
  });
});

describe("telling a live import from an interrupted one", () => {
  it("shows a killed browser's marker once its heartbeat has gone stale", () => {
    seedOtherTabMarker("killed", { ageMs: STALE_AFTER_MS + 1000, saved: 2 });

    expect(readInterruptedImport()).toEqual({
      saved: 2,
      total: 3,
      id: "killed",
    });
  });

  it("never reports an import this tab is running", () => {
    startImportMarker(LABELS);

    expect(readInterruptedImport()).toBeNull();
  });

  it("never reports another tab's import while its heartbeat is fresh", () => {
    seedOtherTabMarker("live-elsewhere", { ageMs: 1000 });

    expect(readInterruptedImport()).toBeNull();
  });

  it("keeps a running import's heartbeat fresh so it never goes stale", () => {
    vi.useFakeTimers();
    startImportMarker(LABELS);
    const key = markerKeys()[0];
    const started = JSON.parse(localStorage.getItem(key)).heartbeat;

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 3);

    expect(JSON.parse(localStorage.getItem(key)).heartbeat).toBeGreaterThan(
      started,
    );
  });

  it("stops beating once the marker is gone and does not bring it back", () => {
    vi.useFakeTimers();
    startImportMarker(LABELS);
    localStorage.removeItem(markerKeys()[0]);

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 3);

    expect(markerKeys()).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("removes an unreadable marker instead of reporting a wrong count", () => {
    localStorage.setItem(`${IMPORT_MARKER_KEY_PREFIX}bad`, "{not json");

    expect(readInterruptedImport()).toBeNull();
    expect(markerKeys()).toHaveLength(0);
  });

  it("rejects a marker whose counts do not add up", () => {
    seedOtherTabMarker("bad-counts", { ageMs: STALE_AFTER_MS + 1, saved: 5 });

    expect(readInterruptedImport()).toBeNull();
  });
});

describe("one tab never clears another tab's live import", () => {
  it("leaves a live marker alone when asked to clear it by id", () => {
    seedOtherTabMarker("live-elsewhere", { ageMs: 1000 });

    clearImportMarker("live-elsewhere");

    expect(markerKeys()).toHaveLength(1);
  });

  it("leaves another tab's marker alone when clearing its own", () => {
    seedOtherTabMarker("live-elsewhere", { ageMs: 1000 });
    startImportMarker(LABELS);

    clearImportMarker();

    expect(markerKeys()).toEqual([`${IMPORT_MARKER_KEY_PREFIX}live-elsewhere`]);
  });

  it("dismissing a stale marker removes it", () => {
    seedOtherTabMarker("killed", { ageMs: STALE_AFTER_MS + 1000 });

    clearImportMarker("killed");

    expect(markerKeys()).toHaveLength(0);
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
  it("Quick Exit (the panic redirect) removes every marker, live or not", () => {
    vi.stubGlobal("location", { replace: vi.fn(), href: "" });
    startImportMarker(LABELS);
    seedOtherTabMarker("live-elsewhere", { ageMs: 1000 });
    sessionStorage.setItem(IMPORT_MARKER_KEY, "{}");

    triggerPanicRedirect();

    expect(markerKeys()).toHaveLength(0);
    expect(sessionStorage.getItem(IMPORT_MARKER_KEY)).toBeNull();
  });

  it("Atomic Wipe and every Clear All Data path remove every marker", async () => {
    startImportMarker(LABELS);
    seedOtherTabMarker("live-elsewhere", { ageMs: 1000 });

    await wipeAllLocalData();

    expect(markerKeys()).toHaveLength(0);
  });
});
