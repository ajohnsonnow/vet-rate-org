/**
 * S4123 regression: the panic-wipe's IndexedDB cleanup must actually wait
 * for every deleteDatabase() request to settle (via onsuccess/onerror/
 * onblocked) before resolving. A wipe that resolves before every database
 * is deleted could leave veteran data behind.
 */
import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AtomicWipe, { clearIndexedDb } from "./AtomicWipe";
import { ThemeProvider } from "../contexts/ThemeContext";
import {
  setupBeforeUnloadWarning,
  removeBeforeUnloadWarning,
  markBackupCreated,
} from "../utils/dataPersistence";

const broadcastDataWipe = vi.fn();
vi.mock("../utils/dataWipeChannel", () => ({
  broadcastDataWipe: (...args) => broadcastDataWipe(...args),
}));

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

// Decision B: dataWipeChannel's own doc comment claims to cover Atomic Wipe
// ("Cross-tab propagation for a full local-data wipe (Atomic Wipe,
// VKBViewer's 'Clear All Data')"), but only VKBViewer's Clear All Data
// actually called broadcastDataWipe() - a second open tab got no
// notification at all and kept serving (and could re-save) the deleted
// veteran's data from its in-memory caches.
describe("Atomic Wipe cross-tab broadcast (decision B)", () => {
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
    broadcastDataWipe.mockClear();
  });

  it("broadcasts the wipe to other open tabs when the veteran confirms", async () => {
    render(
      <ThemeProvider>
        <AtomicWipe />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Atomic Wipe/i }));
    fireEvent.click(screen.getByRole("button", { name: /Confirm Wipe/i }));

    await waitFor(() => expect(broadcastDataWipe).toHaveBeenCalledTimes(1));
  });
});

function walkJsFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkJsFiles(full, out);
    } else if (/\.jsx?$/.test(entry.name) && !entry.name.includes(".test.")) {
      out.push(full);
    }
  }
  return out;
}

const CONST_ASSIGN_REGEX = /const\s+(\w+)\s*=\s*["'`]([^"'`]+)["'`]/g;
// Anchored and applied one line at a time (not matchAll over the whole
// file) - the unanchored `(\w+):` shape flags eslint's own ReDoS heuristic
// when scanned globally across an arbitrarily long string.
const OBJECT_PROP_LINE_REGEX = /^\s*(\w+)\s*:\s*["'`]([^"'`]+)["'`],?\s*$/;
const OPEN_CALL_REGEX = /indexedDB\.open\(\s*([\w.]+)/g;

// Resolves each real `indexedDB.open(SOME_NAME, ...)` call site in src/ back
// to its literal database name, by finding that identifier's own
// `const SOME_NAME = "..."` (or `SOME_NAME: "..."` object-literal) in the
// same file - every real call site in this codebase passes a named
// constant, never an inline string.
function discoverRealIndexedDBNames(srcRoot) {
  const names = new Set();
  for (const file of walkJsFiles(srcRoot)) {
    const source = fs.readFileSync(file, "utf-8");
    if (!source.includes("indexedDB.open(")) continue;

    const declared = new Map();
    for (const match of source.matchAll(CONST_ASSIGN_REGEX)) {
      declared.set(match[1], match[2]);
    }
    for (const line of source.split("\n")) {
      const match = OBJECT_PROP_LINE_REGEX.exec(line);
      if (match) declared.set(match[1], match[2]);
    }

    for (const match of source.matchAll(OPEN_CALL_REGEX)) {
      const identifier = match[1].split(".").pop();
      const resolved = declared.get(identifier);
      if (resolved) names.add(resolved);
    }
  }
  return names;
}

// Regression: the no-databases()-support fallback test above hardcodes the
// same name list AtomicWipe.jsx's fallback added, so a database added to
// src/ later without also touching that list would pass silently - the
// comment above the list says it "must stay in sync with that grep", but
// nothing enforced it. This discovers the names itself (see
// discoverRealIndexedDBNames), instead of hand-copying them a second time.
describe("AtomicWipe's fallback list vs. every real indexedDB.open() call site in src/", () => {
  afterEach(() => {
    delete window.indexedDB;
  });

  it("deletes every database name discovered directly from src/ source, not a hand-maintained copy of it", async () => {
    const srcRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
    );
    const discovered = discoverRealIndexedDBNames(srcRoot);
    // idb-keyval's own default store name - its indexedDB.open() call lives
    // inside node_modules, not src/, so it can't be auto-discovered the
    // same way and is asserted separately here.
    discovered.add("keyval-store");
    expect(discovered.size).toBeGreaterThan(5);

    const deletedNames = [];
    window.indexedDB = {
      deleteDatabase: vi.fn((dbName) => {
        deletedNames.push(dbName);
        const req = {};
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      }),
    };

    await clearIndexedDb();

    for (const name of discovered) {
      expect(deletedNames).toContain(name);
    }
  });
});
