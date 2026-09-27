/**
 * clearVKB used to only remove the localStorage metadata cache
 * (vetrate_knowledge_base) - the real record in IndexedDB (VetRateVKB /
 * "knowledge_base" / id "main") and the in-memory read cache both survived,
 * so loadVKB() (and every AI context built from it) kept returning the
 * "cleared" veteran's full history, in the same session and after reload.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Minimal fake indexedDB backed by a Map that survives vi.resetModules() -
// `diskStore` lives in this test file's own scope, standing in for the
// browser's real on-disk IndexedDB, which a page reload does not erase
// (only the module's in-memory state - vkbDB/vkbCache - resets on reload).
function createFakeIndexedDB(diskStore) {
  function makeStore() {
    return {
      get: (key) => {
        const request = {};
        queueMicrotask(() => {
          request.result = diskStore.get(key);
          request.onsuccess?.();
        });
        return request;
      },
      put: (value) => {
        const request = {};
        queueMicrotask(() => {
          diskStore.set(value.id, value);
          request.onsuccess?.();
        });
        return request;
      },
      delete: (key) => {
        const request = {};
        queueMicrotask(() => {
          diskStore.delete(key);
          request.onsuccess?.();
        });
        return request;
      },
    };
  }

  return {
    open: () => {
      const request = {};
      queueMicrotask(() => {
        request.result = {
          objectStoreNames: { contains: () => true },
          createObjectStore: () => ({ createIndex: () => {} }),
          transaction: () => ({ objectStore: () => makeStore() }),
        };
        request.onsuccess?.();
      });
      return request;
    },
  };
}

describe("clearVKB deletes the IndexedDB record and in-memory cache", () => {
  let diskStore;

  beforeEach(() => {
    diskStore = new Map();
    window.indexedDB = createFakeIndexedDB(diskStore);
  });

  afterEach(() => {
    delete window.indexedDB;
    vi.resetModules();
  });

  it("loadVKB returns empty (no previously-saved data, no AI-context leakage) in the same session and after reload", async () => {
    const mod1 = await import("./veteranKnowledgeBase");

    const seeded = mod1.initializeVKB();
    seeded.personal.fullName = "Jane Veteran";
    seeded.medicalConditions.current.push({ name: "PTSD" });
    await mod1.saveVKB(seeded);

    // Sanity: it's really there before clearing.
    const before = await mod1.loadVKB();
    expect(before.personal.fullName).toBe("Jane Veteran");
    expect(diskStore.has("main")).toBe(true);

    await mod1.clearVKB();

    // Same session: the in-memory cache must not keep serving the old data.
    const afterSameSession = await mod1.loadVKB();
    expect(afterSameSession.personal.fullName).toBeNull();
    expect(afterSameSession.medicalConditions.current).toEqual([]);
    expect(mod1.generateLLMContext(afterSameSession)).not.toContain(
      "Jane Veteran",
    );

    // The IndexedDB record itself must be gone, not just cached-over.
    expect(diskStore.has("main")).toBe(false);

    // Simulate a real reload: fresh module instance (vkbDB/vkbCache reset),
    // same underlying "disk".
    vi.resetModules();
    const mod2 = await import("./veteranKnowledgeBase");
    const afterReload = await mod2.loadVKB();
    expect(afterReload.personal.fullName).toBeNull();
    expect(afterReload.medicalConditions.current).toEqual([]);
    expect(mod2.generateLLMContext(afterReload)).not.toContain("Jane Veteran");
  });
});
