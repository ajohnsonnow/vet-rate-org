/**
 * loadVKB serves a per-page cache that only this page's own writes refresh. A
 * caller that must see what ANOTHER tab stored asks for { fresh: true }, which
 * reads storage and leaves the cache alone. Only IndexedDB is stubbed (to fail,
 * so the real localStorage fallback is the store); loadVKB itself is real.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const STORAGE_KEY = "vetrate_knowledge_base";

function failingIndexedDb() {
  return {
    open: () => {
      const request = {};
      queueMicrotask(() => request.onerror?.());
      return request;
    },
  };
}

function storeDocuments(initializeVKB, count) {
  const vkb = initializeVKB();
  vkb.documentation.otherEvidence = Array.from({ length: count }, (_, i) => ({
    id: `doc-${i}`,
    uploadDate: new Date().toISOString(),
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vkb));
}

const filed = (vkb) => vkb.documentation.otherEvidence.length;

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  vi.stubGlobal("indexedDB", failingIndexedDb());
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("loadVKB({ fresh: true })", () => {
  it("sees another tab's later write that the page cache does not", async () => {
    const { loadVKB, initializeVKB } = await import("./veteranKnowledgeBase");
    storeDocuments(initializeVKB, 3);
    expect(filed(await loadVKB())).toBe(3);

    storeDocuments(initializeVKB, 5);

    expect(filed(await loadVKB())).toBe(3);
    expect(filed(await loadVKB({ fresh: true }))).toBe(5);
  });
});
