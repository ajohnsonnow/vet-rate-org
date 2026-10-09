/**
 * A tab that only receives a Clear All Data broadcast reloads. The import
 * markers (counts and neutral labels) must be gone before that reload, whoever
 * owns them, or the next load reports an interrupted import right after
 * everything was deleted - and a live import in the receiving tab must not
 * write its marker back.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const LISTENERS = [];

class FakeChannel {
  addEventListener(type, handler) {
    LISTENERS.push(handler);
  }
  postMessage() {}
}

let marker;

const markerKeys = () =>
  Array.from({ length: localStorage.length }, (_, i) =>
    localStorage.key(i),
  ).filter((key) => key.startsWith(marker.IMPORT_MARKER_KEY_PREFIX));

beforeEach(async () => {
  sessionStorage.clear();
  localStorage.clear();
  LISTENERS.length = 0;
  vi.resetModules();
  vi.stubGlobal("BroadcastChannel", FakeChannel);
  marker = await import("./importProgressMarker");
  await import("./dataWipeChannel");
});

afterEach(() => {
  marker.clearAllImportMarkers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("receiving a Clear All Data broadcast", () => {
  it("removes this tab's import marker before reloading", () => {
    const reload = vi.fn(() => {
      expect(markerKeys()).toHaveLength(0);
    });
    vi.stubGlobal("location", { reload });
    marker.startImportMarker(["document 1 (DD214)", "document 2 (DBQ)"]);
    expect(markerKeys()).toHaveLength(1);
    expect(LISTENERS).toHaveLength(1);

    LISTENERS[0]({ data: { type: "wipe" } });

    expect(reload).toHaveBeenCalledTimes(1);
    expect(markerKeys()).toHaveLength(0);
  });

  it("removes another tab's marker too, and a live import does not write it back", () => {
    vi.useFakeTimers();
    vi.stubGlobal("location", { reload: vi.fn() });
    marker.startImportMarker(["document 1 (DD214)", "document 2 (DBQ)"]);
    localStorage.setItem(
      `${marker.IMPORT_MARKER_KEY_PREFIX}other`,
      JSON.stringify({
        id: "other",
        total: 2,
        saved: 1,
        labels: [],
        owner: "another-tab",
        heartbeat: Date.now(),
      }),
    );

    LISTENERS[0]({ data: { type: "wipe" } });
    marker.recordDocumentSaved();
    vi.advanceTimersByTime(marker.HEARTBEAT_INTERVAL_MS * 3);

    expect(markerKeys()).toHaveLength(0);
  });
});
