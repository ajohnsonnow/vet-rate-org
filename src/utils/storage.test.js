/**
 * migrateFromLocalStorage used to ignore storage.setItem's own return
 * value, so an IndexedDB write that silently failed (storage.setItem
 * catches and returns false, storage.js:41-49) was still counted as
 * migrated - the migration reported success even when every write failed.
 * These tests use an in-memory idb-keyval stub whose `set` can be told to
 * fail for a specific key, so the failure is real (return false), not a
 * thrown exception - matching how storage.setItem actually degrades.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const store = new Map();
let failingKey = null;

vi.mock("idb-keyval", () => ({
  get: vi.fn(async (k) => store.get(k)),
  set: vi.fn(async (k, v) => {
    if (k === failingKey) throw new Error("simulated IndexedDB write failure");
    store.set(k, v);
  }),
  del: vi.fn(async (k) => {
    store.delete(k);
  }),
  keys: vi.fn(async () => [...store.keys()]),
  clear: vi.fn(async () => {
    store.clear();
  }),
}));

const { migrateFromLocalStorage, needsMigration } = await import("./storage");

beforeEach(() => {
  store.clear();
  failingKey = null;
  localStorage.clear();
});

describe("migrateFromLocalStorage", () => {
  it("reports success and migrates every localStorage key when every write succeeds", async () => {
    localStorage.setItem("vet_rate_veteran_profile", "profile-data");

    const result = await migrateFromLocalStorage();

    expect(result.success).toBe(true);
    expect(result.migratedKeys).toContain("vet_rate_veteran_profile");
    expect(result.failedKeys).toEqual([]);
  });

  it("reports failure, and does not count the key as migrated, when its IndexedDB write fails", async () => {
    localStorage.setItem("vet_rate_veteran_profile", "profile-data");
    failingKey = "vet_rate_veteran_profile";

    const result = await migrateFromLocalStorage();

    expect(result.success).toBe(false);
    expect(result.migratedKeys).not.toContain("vet_rate_veteran_profile");
    expect(
      result.failedKeys.some((f) => f.key === "vet_rate_veteran_profile"),
    ).toBe(true);
  });

  it("reports failure when the completion-flag write itself fails, even if every data key succeeded", async () => {
    localStorage.setItem("vet_rate_veteran_profile", "profile-data");
    failingKey = "vet_rate_migrated_to_indexeddb";

    const result = await migrateFromLocalStorage();

    expect(result.success).toBe(false);
    expect(result.migratedKeys).toContain("vet_rate_veteran_profile");
  });
});

describe("needsMigration", () => {
  it("returns false once the migration flag is durably set", async () => {
    store.set("vet_rate_migrated_to_indexeddb", "true");
    localStorage.setItem("vet_rate_veteran_profile", "profile-data");

    expect(await needsMigration()).toBe(false);
  });
});
