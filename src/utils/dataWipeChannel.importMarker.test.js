/**
 * A tab that only receives a Clear All Data broadcast reloads, and a reload
 * keeps session storage. The import marker (counts and neutral labels) must be
 * gone before that reload, or the next load reports an interrupted import
 * right after everything was deleted.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { IMPORT_MARKER_KEY, startImportMarker } from "./importProgressMarker";

const LISTENERS = [];

class FakeChannel {
  addEventListener(type, handler) {
    LISTENERS.push(handler);
  }
  postMessage() {}
}

beforeEach(async () => {
  sessionStorage.clear();
  LISTENERS.length = 0;
  vi.resetModules();
  vi.stubGlobal("BroadcastChannel", FakeChannel);
  await import("./dataWipeChannel");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("receiving a Clear All Data broadcast", () => {
  it("removes this tab's import marker before reloading", () => {
    const reload = vi.fn(() => {
      expect(sessionStorage.getItem(IMPORT_MARKER_KEY)).toBeNull();
    });
    vi.stubGlobal("location", { reload });
    startImportMarker(["document 1 (DD214)", "document 2 (DBQ)"]);
    expect(LISTENERS).toHaveLength(1);

    LISTENERS[0]({ data: { type: "wipe" } });

    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(IMPORT_MARKER_KEY)).toBeNull();
  });
});
