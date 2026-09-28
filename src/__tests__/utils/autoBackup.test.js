/**
 * D13-8: startAutoBackup() patches localStorage.setItem to debounce a
 * backup after every write to a monitored key. Nothing previously undid
 * that patch or cancelled a pending debounce, so a full data delete could
 * still have a stale backup fire ~2s later and write a fresh snapshot right
 * back after a veteran asked for everything to be gone.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  startAutoBackup,
  stopAutoBackup,
  getAllBackups,
} from "../../utils/autoBackup";

const MONITORED_KEY = "vet_rate_saved_claims";
const LAST_BACKUP_KEY = "vetrate_last_backup_time";
const BACKUP_INTERVAL_MS = 2000;

// jsdom in this project's test env has no indexedDB at all (verified: a bare
// `indexedDB.open()` throws) - performBackup's own try/catch swallows that,
// so a test that never provides a working indexedDB would "pass" whether or
// not the debounced backup actually got cancelled. This fake makes
// performBackup genuinely succeed, the same shape as
// veteranKnowledgeBase.clearVKB.test.js's fake, so stopAutoBackup's effect
// on LAST_BACKUP_KEY is real evidence, not a false negative from a
// silently-failed write.
function installFakeIndexedDB() {
  const store = new Map();
  let nextId = 1;

  function makeObjectStore() {
    return {
      add: (record) => {
        const request = {};
        queueMicrotask(() => {
          const id = nextId++;
          store.set(id, { ...record, id });
          request.result = id;
          request.onsuccess?.();
        });
        return request;
      },
      getAll: () => {
        const request = {};
        queueMicrotask(() => {
          request.result = Array.from(store.values());
          request.onsuccess?.();
        });
        return request;
      },
      delete: (id) => {
        const request = {};
        queueMicrotask(() => {
          store.delete(id);
          request.onsuccess?.();
        });
        return request;
      },
      createIndex: () => {},
    };
  }

  // openBackupDB only calls createObjectStore/objectStoreNames inside
  // onupgradeneeded; this fake always resolves via onsuccess with a store
  // already backed by the shared `store` Map, so it never needs to fire.
  const db = {
    transaction: () => ({ objectStore: () => makeObjectStore() }),
  };

  window.indexedDB = {
    open: () => {
      const request = {};
      queueMicrotask(() => {
        request.result = db;
        request.onsuccess?.();
      });
      return request;
    },
  };

  return store;
}

describe("stopAutoBackup", () => {
  afterEach(() => {
    stopAutoBackup();
    localStorage.clear();
    delete window.indexedDB;
    vi.useRealTimers();
  });

  it("cancels a pending debounced backup before it fires, even after the interval elapses", async () => {
    installFakeIndexedDB();
    vi.useFakeTimers();
    startAutoBackup();

    localStorage.setItem(MONITORED_KEY, JSON.stringify({ a: 1 }));
    expect(localStorage.getItem(LAST_BACKUP_KEY)).toBeNull();

    // Wipe: clear storage, then stop the backup system before the debounce
    // it just scheduled would otherwise fire.
    localStorage.clear();
    stopAutoBackup();

    await vi.advanceTimersByTimeAsync(BACKUP_INTERVAL_MS + 500);

    expect(localStorage.getItem(LAST_BACKUP_KEY)).toBeNull();
    expect(localStorage).toHaveLength(0);
  });

  it("un-patches localStorage.setItem so later writes no longer schedule a backup", async () => {
    installFakeIndexedDB();
    vi.useFakeTimers();
    startAutoBackup();
    stopAutoBackup();

    localStorage.setItem(MONITORED_KEY, JSON.stringify({ a: 1 }));
    await vi.advanceTimersByTimeAsync(BACKUP_INTERVAL_MS + 500);

    expect(localStorage.getItem(LAST_BACKUP_KEY)).toBeNull();
  });

  it("is safe to call when auto-backup was never started", () => {
    expect(() => stopAutoBackup()).not.toThrow();
  });

  // Proves the two tests above are not vacuous: with the same fake
  // indexedDB and the same debounced write, NOT calling stopAutoBackup
  // really does let the backup fire and populate LAST_BACKUP_KEY.
  it("control: without stopAutoBackup, the debounced backup does fire", async () => {
    installFakeIndexedDB();
    vi.useFakeTimers();
    startAutoBackup();

    localStorage.setItem(MONITORED_KEY, JSON.stringify({ a: 1 }));
    await vi.advanceTimersByTimeAsync(BACKUP_INTERVAL_MS + 500);

    expect(localStorage.getItem(LAST_BACKUP_KEY)).not.toBeNull();
  });
});

describe("startAutoBackup idempotency", () => {
  afterEach(() => {
    stopAutoBackup();
    localStorage.clear();
  });

  it("a second startAutoBackup() call does not wrap localStorage.setItem twice", () => {
    startAutoBackup();
    const afterFirst = localStorage.setItem;
    startAutoBackup();
    expect(localStorage.setItem).toBe(afterFirst);
  });

  it("stopAutoBackup restores the exact pre-patch setItem reference", () => {
    const beforePatch = localStorage.setItem;
    startAutoBackup();
    expect(localStorage.setItem).not.toBe(beforePatch);
    stopAutoBackup();
    expect(localStorage.setItem).toBe(beforePatch);
  });
});

// Full-scope wipe scenario: the actual "storage stays empty" test the owner
// decision requires, exercised through the real backup pipeline (not just
// stopAutoBackup in isolation) - a monitored write is pending, a wipe stops
// the system, and nothing shows up in the backups store either.
describe("wipe stops autoBackup end-to-end", () => {
  afterEach(() => {
    stopAutoBackup();
    localStorage.clear();
    delete window.indexedDB;
    vi.useRealTimers();
  });

  it("wipe, then waiting past the backup interval leaves storage and backups empty", async () => {
    const diskStore = installFakeIndexedDB();
    vi.useFakeTimers();
    startAutoBackup();
    localStorage.setItem(MONITORED_KEY, JSON.stringify({ claim: "x" }));

    localStorage.clear();
    stopAutoBackup();

    await vi.advanceTimersByTimeAsync(BACKUP_INTERVAL_MS + 500);

    expect(localStorage).toHaveLength(0);
    expect(diskStore.size).toBe(0);
    vi.useRealTimers();
    const backups = await getAllBackups();
    expect(backups).toEqual([]);
  });
});
