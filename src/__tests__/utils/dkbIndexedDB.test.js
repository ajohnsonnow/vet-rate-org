import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

function makeFakeResponse(data) {
  const text = typeof data === "string" ? data : JSON.stringify(data);
  const bytes = new TextEncoder().encode(text);
  let alreadyRead = false;
  return {
    ok: true,
    status: 200,
    headers: { get: () => String(bytes.length) },
    body: {
      getReader: () => ({
        read: async () => {
          if (alreadyRead) return { done: true, value: undefined };
          alreadyRead = true;
          return { done: false, value: bytes };
        },
      }),
    },
  };
}

// Real IDBRequest/IDBTransaction handlers are assigned by the caller *after*
// the request/transaction is created, and fire asynchronously once assigned.
// This fake mirrors that ordering: the callback only fires once something has
// actually been assigned to the property, on the next tick.
function attachAsyncHandler(target, propName) {
  let handler = null;
  Object.defineProperty(target, propName, {
    get: () => handler,
    set: (fn) => {
      handler = fn;
      setTimeout(() => handler?.(), 0);
    },
  });
}

function createFakeIndexedDB(store) {
  return {
    open: () => {
      const request = {};
      attachAsyncHandler(request, "onsuccess");
      request.onerror = null;

      const db = {
        objectStoreNames: { contains: () => true },
        createObjectStore: () => {},
        transaction: () => {
          const tx = {};
          attachAsyncHandler(tx, "oncomplete");
          tx.onerror = null;

          const objectStore = {
            clear: () => {
              store.clear();
              const req = {};
              attachAsyncHandler(req, "onsuccess");
              req.onerror = null;
              return req;
            },
            put: (value) => {
              store.set(value.id, value);
              return {};
            },
          };
          tx.objectStore = () => objectStore;
          return tx;
        },
        close: () => {},
      };

      request.result = db;
      return request;
    },
  };
}

describe("downloadFullDKB - single-flight", () => {
  let fetchSpy;
  let store;

  beforeEach(() => {
    vi.resetModules();
    store = new Map();
    fetchSpy = vi
      .fn()
      .mockImplementation(async () =>
        makeFakeResponse({ entries: [{ id: "a" }, { id: "b" }] }),
      );
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("indexedDB", createFakeIndexedDB(store));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("runs the underlying fetch only once for concurrent callers", async () => {
    const { downloadFullDKB } = await import("../../utils/dkbIndexedDB");

    const [first, second] = await Promise.all([
      downloadFullDKB(),
      downloadFullDKB(),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first.success).toBe(true);
    expect(first.entryCount).toBe(2);
    expect(store.size).toBeGreaterThan(0);
  });

  it("allows a later call to trigger a new fetch once the first resolves", async () => {
    const { downloadFullDKB } = await import("../../utils/dkbIndexedDB");

    await downloadFullDKB();
    await downloadFullDKB();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("falls back to the web file when the full file is a Git LFS pointer", async () => {
    fetchSpy.mockImplementation(async (url) =>
      url.includes("_full")
        ? makeFakeResponse(
            "version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 135766414\n",
          )
        : makeFakeResponse({ entries: [{ id: "w" }] }),
    );
    const { downloadFullDKB } = await import("../../utils/dkbIndexedDB");

    const result = await downloadFullDKB();

    expect(result.success).toBe(true);
    expect(result.isFullDB).toBe(false);
    expect(result.entryCount).toBe(1);
  });
});
