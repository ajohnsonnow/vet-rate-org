import { readFileSync } from "node:fs";
import { test, expect, Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

/**
 * Atomic Wipe ("Clear Data") audit: every persistent store the app uses,
 * confirmed cleared by a real browser wipe+reload cycle.
 *
 * Store inventory (src grep, 2026-09-27):
 *   - localStorage - every key, arbitrary prefixes (vetrate_*, vet_rate_*,
 *     saved_*, vet-rate-*, bare keys). AtomicWipe's clearLocalAndSessionStorage
 *     calls localStorage.clear() - a full, unconditional clear, so no prefix
 *     enumeration can miss anything by construction.
 *   - sessionStorage - same, via sessionStorage.clear().
 *   - Cookies - clearCookies() walks document.cookie and expires each one.
 *     Not used for veteran data by this app (no server, no auth session),
 *     covered defensively regardless.
 *   - IndexedDB - clearIndexedDb() enumerates every database dynamically via
 *     indexedDB.databases() (Chromium/Edge; this suite runs chromium) and
 *     deletes each one, rather than a hand-kept name list - so a database
 *     this comment doesn't name is still caught. Named databases found in
 *     src/: VetRateAutoBackup, VetRateBugSquasher, vet-rate-dbq-cache,
 *     VetRate_DKB, VetRateFeatureRequests, VetRateMyPacket,
 *     VetRate_CFileStream, VetRate_UserDocVectors, VetRateVKB (the Veteran
 *     Knowledge Base - highest-sensitivity store in the app), and
 *     idb-keyval's default "keyval-store" (src/utils/storage.js's primary
 *     packet/claims store, also used by aiAuditLog.js/logger.js).
 *   - Cache Storage - clearCacheStorage() enumerates via caches.keys().
 *   - Service Workers - unregisterServiceWorkers(); the app only registers
 *     one under import.meta.env.PROD (src/main.jsx), so this dev-server run
 *     exercises the enumeration/unregister call, not a live worker.
 *   - OPFS (navigator.storage.getDirectory) - not used anywhere in src/;
 *     persistentStorage.js's File System Access API (showSaveFilePicker) is
 *     a real user-chosen file on disk, outside the origin's storage and
 *     outside any wipe API's reach by design - not a gap, a different store
 *     entirely (an explicit veteran-initiated export, not an app-managed
 *     cache).
 *   - Per-veteran/VSO-scoped databases - not applicable: every database name
 *     above is a fixed literal (grepped for template-literal DB names -
 *     none found), matching this app's single-local-profile-per-browser
 *     design (no multi-veteran/VSO accounts in one browser profile).
 *
 * Conclusion: no gap found. This spec is the real-browser proof for that
 * conclusion, not just the source read above - it seeds one representative
 * record in every store category and confirms all are gone after the wipe
 * and a reload.
 */

const MARKER = "panic-wipe-e2e-marker";
const AI_MODEL_DB = "vetrate-ai-models";
const VKB_DB = "VetRateVKB";
const VKB_STORE = "knowledge_base";
const TEST_CACHE = "panic-wipe-e2e-cache";

// Installed into the page itself (not called via exposeFunction/CDP): both
// helpers need a real in-page IDBDatabase handle, which cannot cross the
// binding boundary a page.exposeFunction call marshals through.
async function installDbHelpers(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__putInDb = (dbName, storeName, record) =>
      new Promise((resolve, reject) => {
        const openReq = indexedDB.open(dbName, 1);
        openReq.onupgradeneeded = () => {
          openReq.result.createObjectStore(storeName, { keyPath: "id" });
        };
        openReq.onerror = () => reject(openReq.error);
        openReq.onsuccess = () => {
          const putReq = openReq.result
            .transaction(storeName, "readwrite")
            .objectStore(storeName)
            .put(record);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        };
      });

    window.__dbExists = (dbName) =>
      indexedDB.databases().then((dbs) => dbs.some((d) => d.name === dbName));
  });
}

async function seedEveryStore(page: Page): Promise<void> {
  await page.evaluate(
    async ({ marker, aiModelDb, vkbDb, vkbStore, cacheName }) => {
      localStorage.setItem(marker, "1");
      localStorage.setItem("vetrate_safety_use_count", "3"); // real app prefix
      sessionStorage.setItem(marker, "1");
      document.cookie = `${marker}=1; path=/`;

      await window.__putInDb(vkbDb, vkbStore, {
        id: "main",
        personal: { fullName: "E2E Seeded Veteran" },
      });
      await window.__putInDb(aiModelDb, "models", { id: marker, blob: "x" });

      const cache = await caches.open(cacheName);
      await cache.put("/e2e-wipe-marker", new Response("seeded"));
    },
    {
      marker: MARKER,
      aiModelDb: AI_MODEL_DB,
      vkbDb: VKB_DB,
      vkbStore: VKB_STORE,
      cacheName: TEST_CACHE,
    },
  );
}

async function readEveryStore(page: Page) {
  return page.evaluate(
    async ({ marker, aiModelDb, vkbDb, cacheName }) => {
      const cacheKeys = await caches.keys();
      return {
        localStorage: localStorage.getItem(marker),
        sessionStorage: sessionStorage.getItem(marker),
        cookie: document.cookie.includes(`${marker}=`),
        vkbDbExists: await window.__dbExists(vkbDb),
        aiModelDbExists: await window.__dbExists(aiModelDb),
        cacheExists: cacheKeys.includes(cacheName),
      };
    },
    {
      marker: MARKER,
      aiModelDb: AI_MODEL_DB,
      vkbDb: VKB_DB,
      cacheName: TEST_CACHE,
    },
  );
}

async function seedReturningUser(page: Page): Promise<void> {
  await page.addInitScript((appVersion) => {
    localStorage.setItem("vet-rate-tos-accepted", "true");
    localStorage.setItem("vet_rate_last_seen_version", appVersion);
    localStorage.setItem("vetrate-tour-completed", "true");
    localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
    localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
  }, APP_VERSION);
}

test.describe("Atomic Wipe clears every persistent store", () => {
  test("seeded data in every store category is gone after the wipe and a reload", async ({
    page,
  }) => {
    test.setTimeout(30_000);
    await installDbHelpers(page);
    await seedReturningUser(page);

    await page.goto("/");
    await dismissDisclaimer(page);
    await seedEveryStore(page);

    const before = await readEveryStore(page);
    expect(before.localStorage).toBe("1");
    expect(before.sessionStorage).toBe("1");
    expect(before.cookie).toBe(true);
    expect(before.vkbDbExists).toBe(true);
    expect(before.aiModelDbExists).toBe(true);
    expect(before.cacheExists).toBe(true);

    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("openBackupManager")),
    );
    await page
      .getByRole("button", { name: /clear data/i })
      .waitFor({ state: "visible", timeout: 5000 });
    await page.getByRole("button", { name: /clear data/i }).click();
    await page.getByRole("button", { name: /confirm wipe/i }).click();

    // AtomicWipe force-reloads (nocache=<timestamp>) 500ms after the wipe
    // completes - wait for that real navigation rather than a fixed sleep.
    await page.waitForURL(/nocache=/, { timeout: 15000 });
    await page.waitForLoadState("load");

    const after = await readEveryStore(page);
    expect(after.localStorage).toBeNull();
    expect(after.sessionStorage).toBeNull();
    expect(after.cookie).toBe(false);
    expect(after.vkbDbExists).toBe(false);
    expect(after.aiModelDbExists).toBe(false);
    expect(after.cacheExists).toBe(false);
  });
});

declare global {
  interface Window {
    __putInDb: (
      dbName: string,
      storeName: string,
      record: unknown,
    ) => Promise<void>;
    __dbExists: (dbName: string) => Promise<boolean>;
  }
}
