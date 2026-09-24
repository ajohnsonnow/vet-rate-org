/**
 * S4123 regression: the panic-wipe's IndexedDB cleanup must actually wait
 * for every deleteDatabase() request to settle (via onsuccess/onerror/
 * onblocked) before resolving. A wipe that resolves before every database
 * is deleted could leave veteran data behind.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { clearIndexedDb } from "./AtomicWipe";

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
});
