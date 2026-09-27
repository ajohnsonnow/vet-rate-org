/**
 * S4123 regression: the panic-wipe's IndexedDB cleanup must actually wait
 * for every deleteDatabase() request to settle (via onsuccess/onerror/
 * onblocked) before resolving. A wipe that resolves before every database
 * is deleted could leave veteran data behind.
 */
import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AtomicWipe, { clearIndexedDb } from "./AtomicWipe";
import { ThemeProvider } from "../contexts/ThemeContext";
import {
  setupBeforeUnloadWarning,
  removeBeforeUnloadWarning,
  markBackupCreated,
} from "../utils/dataPersistence";

function dispatchBeforeUnload() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

describe("clearIndexedDb", () => {
  afterEach(() => {
    delete window.indexedDB;
  });

  it("awaits every deleteDatabase request before resolving, in order", async () => {
    const events = [];

    window.indexedDB = {
      databases: vi.fn().mockResolvedValue([
        { name: "vetrate-storage" },
        { name: "vetrate-vectors" },
        { name: "" }, // no name — must be skipped, not passed to Promise.all as undefined
      ]),
      deleteDatabase: vi.fn((dbName) => {
        events.push(`delete-called:${dbName}`);
        const req = {};
        // Deletion completes asynchronously, on a later microtask/macrotask,
        // to prove clearIndexedDb genuinely awaits it rather than resolving
        // as soon as deleteDatabase() is merely *called*.
        setTimeout(() => {
          events.push(`delete-resolved:${dbName}`);
          req.onsuccess?.();
        }, 10);
        return req;
      }),
    };

    await clearIndexedDb();

    expect(window.indexedDB.deleteDatabase).toHaveBeenCalledTimes(2);
    expect(window.indexedDB.deleteDatabase).toHaveBeenCalledWith(
      "vetrate-storage",
    );
    expect(window.indexedDB.deleteDatabase).toHaveBeenCalledWith(
      "vetrate-vectors",
    );
    // Every deletion must have actually resolved before clearIndexedDb returned.
    expect(events).toEqual([
      "delete-called:vetrate-storage",
      "delete-called:vetrate-vectors",
      "delete-resolved:vetrate-storage",
      "delete-resolved:vetrate-vectors",
    ]);
  });

  it("does not hang or throw when a deleteDatabase request is blocked", async () => {
    window.indexedDB = {
      databases: vi.fn().mockResolvedValue([{ name: "vetrate-storage" }]),
      deleteDatabase: vi.fn(() => {
        const req = {};
        setTimeout(() => req.onblocked?.(), 5);
        return req;
      }),
    };

    await expect(clearIndexedDb()).resolves.toBeUndefined();
  });

  // Panic-wipe audit (item 5): a browser without indexedDB.databases() falls
  // back to a hand-kept name list, which can only delete a database it
  // already knows the name of - unlike the modern path, it cannot discover
  // one. VetRateVKB (the Veteran Knowledge Base) was missing from that list
  // entirely; this proves every real src/ database name is now included.
  it("the no-databases()-support fallback includes every real IndexedDB name in src/, including VetRateVKB", async () => {
    const deletedNames = [];
    window.indexedDB = {
      // No `databases` property - forces clearIndexedDb() down the fallback
      // path, same as a browser that predates that API.
      deleteDatabase: vi.fn((dbName) => {
        deletedNames.push(dbName);
        const req = {};
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      }),
    };

    await clearIndexedDb();

    for (const expected of [
      "keyval-store",
      "VetRateVKB",
      "VetRateAutoBackup",
      "VetRateBugSquasher",
      "vet-rate-dbq-cache",
      "VetRate_DKB",
      "VetRateFeatureRequests",
      "VetRateMyPacket",
      "VetRate_CFileStream",
      "VetRate_UserDocVectors",
    ]) {
      expect(deletedNames).toContain(expected);
    }
  });
});

describe("Atomic Wipe beforeunload guard", () => {
  // ThemeProvider (required by AtomicWipe's useTheme()) reads
  // window.matchMedia on mount; jsdom doesn't implement it.
  beforeAll(() => {
    if (typeof window !== "undefined" && !window.matchMedia) {
      window.matchMedia = (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      });
    }
  });

  afterEach(() => {
    removeBeforeUnloadWarning();
    localStorage.clear();
  });

  // handleAtomicWipe's own localStorage.clear() deletes vetrate_data_hash,
  // which makes dataPersistence.hasUnsavedChanges() read as true from that
  // point on - so without disabling the guard first, the reload this wipe
  // promises would trip the browser's native "Leave site?" prompt on every
  // confirmed wipe, even for a veteran who had fully backed up moments
  // earlier. A veteran who answers Stay to that prompt gets a wipe that
  // never actually reloads.
  it("disables the beforeunload prompt before reloading, even for a fully backed-up veteran", async () => {
    markBackupCreated();
    setupBeforeUnloadWarning();
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false);

    render(
      <ThemeProvider>
        <AtomicWipe />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Atomic Wipe/i }));
    fireEvent.click(screen.getByRole("button", { name: /Confirm Wipe/i }));

    await waitFor(() => {
      expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
    });
    expect(window.onbeforeunload).toBeNull();
  });
});
