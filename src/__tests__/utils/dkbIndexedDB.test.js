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
            get: (key) => {
              const req = {};
              req.result = store.get(key);
              attachAsyncHandler(req, "onsuccess");
              req.onerror = null;
              return req;
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

  it("only ever fetches the web-optimized file, never the Git LFS full file", async () => {
    const { downloadFullDKB } = await import("../../utils/dkbIndexedDB");

    await downloadFullDKB();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe("/data/diamond_knowledge.json");
    expect(url).not.toContain("_full");
  });
});

describe("isFullDKBCached", () => {
  let store;

  beforeEach(() => {
    vi.resetModules();
    store = new Map();
    vi.stubGlobal("indexedDB", createFakeIndexedDB(store));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is false when nothing is cached", async () => {
    const { isFullDKBCached } = await import("../../utils/dkbIndexedDB");

    expect(await isFullDKBCached()).toBe(false);
  });

  it("is true once a web-optimized-sized download is cached", async () => {
    const { WEB_DATABASE_COUNT, isFullDKBCached } =
      await import("../../utils/dkbIndexedDB");
    store.set("dkb_metadata", {
      id: "dkb_metadata",
      entryCount: WEB_DATABASE_COUNT,
    });

    expect(await isFullDKBCached()).toBe(true);
  });

  it("still recognizes a genuine full cache left by a pre-fix build", async () => {
    const { FULL_DATABASE_COUNT, isFullDKBCached } =
      await import("../../utils/dkbIndexedDB");
    store.set("dkb_metadata", {
      id: "dkb_metadata",
      entryCount: FULL_DATABASE_COUNT,
    });

    expect(await isFullDKBCached()).toBe(true);
  });
});
