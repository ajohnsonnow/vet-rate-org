/**
 * D21-1: saveVKB used to report a save as done when the write REQUEST
 * succeeded, but IndexedDB only commits when the transaction completes - a
 * commit that fails afterwards (storage full) aborts the transaction and the
 * write is lost, while the caller was told it was saved. The save now settles
 * on the transaction, and the connection closes itself when another tab needs
 * to upgrade the database instead of blocking that tab's open forever.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

function makeDb(onTransaction) {
  return {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => ({ createIndex: () => {} }),
    transaction: () => onTransaction(),
    close: vi.fn(),
  };
}

function installIndexedDB(db) {
  const opens = [];
  vi.stubGlobal("indexedDB", {
    open: () => {
      const request = {};
      opens.push(request);
      queueMicrotask(() => {
        request.result = db;
        request.onsuccess?.();
      });
      return request;
    },
  });
  return opens;
}

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("saveVKB settles on the transaction, not the request", () => {
  it("reports a write whose commit fails after the request succeeded as not saved", async () => {
    const quota = Object.assign(new Error("full"), {
      name: "QuotaExceededError",
    });
    installIndexedDB(
      makeDb(() => {
        const tx = { error: quota };
        tx.objectStore = () => ({
          put: () => {
            const request = {};
            queueMicrotask(() => {
              request.onsuccess?.();
              queueMicrotask(() => tx.onabort?.());
            });
            return request;
          },
        });
        return tx;
      }),
    );
    const { loadVKB, saveVKB } = await import("./veteranKnowledgeBase");
    const vkb = await loadVKB();

    const outcome = await saveVKB(vkb);

    expect(outcome.success).toBe(false);
    expect(outcome.quotaExceeded).toBe(true);
  });

  it("reports success only once the transaction completes", async () => {
    installIndexedDB(
      makeDb(() => {
        const tx = {};
        tx.objectStore = () => ({
          get: () => {
            const request = {};
            queueMicrotask(() => request.onsuccess?.());
            return request;
          },
          put: () => {
            const request = {};
            queueMicrotask(() => {
              request.onsuccess?.();
              queueMicrotask(() => tx.oncomplete?.());
            });
            return request;
          },
        });
        return tx;
      }),
    );
    const { loadVKB, saveVKB } = await import("./veteranKnowledgeBase");
    const vkb = await loadVKB();

    expect((await saveVKB(vkb)).success).toBe(true);
  });
});

describe("the connection never blocks another tab's upgrade", () => {
  it("closes itself on versionchange and opens a fresh connection for the next save", async () => {
    const db = makeDb(() => {
      const tx = {};
      tx.objectStore = () => ({
        get: () => {
          const request = {};
          queueMicrotask(() => request.onsuccess?.());
          return request;
        },
        put: () => {
          const request = {};
          queueMicrotask(() => {
            request.onsuccess?.();
            queueMicrotask(() => tx.oncomplete?.());
          });
          return request;
        },
      });
      return tx;
    });
    const opens = installIndexedDB(db);
    const { loadVKB, saveVKB } = await import("./veteranKnowledgeBase");
    const vkb = await loadVKB();
    expect(opens).toHaveLength(1);

    db.onversionchange();

    expect(db.close).toHaveBeenCalledTimes(1);
    expect((await saveVKB(vkb)).success).toBe(true);
    expect(opens).toHaveLength(2);
  });
});
