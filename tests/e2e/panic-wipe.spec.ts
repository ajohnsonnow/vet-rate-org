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

// Chromium (this suite's browser) always implements indexedDB.databases(),
// so clearIndexedDb()'s fallback name list - the one piece of code this
// branch's wipe-audit commit actually changed - was never exercised by a
// real browser run. Assigning `undefined` (not `delete`) is load-bearing:
// `databases` lives on IDBFactory.prototype, not the `indexedDB` instance,
// so `delete window.indexedDB.databases` would find no own property to
// remove and silently leave the prototype method reachable.
async function forceIndexedDbFallbackPath(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.indexedDB.databases = undefined;
  });
}

// Standing in for `indexedDB.databases()` (unavailable on this path by
// construction - see forceIndexedDbFallbackPath), so this check exercises
// exactly what a real "does the fallback browser see it as gone" query
// looks like: opening with no explicit version creates a fresh, empty
// database (firing onupgradeneeded) if - and only if - none existed.
// Deletes that empty database again immediately so a "did it get created"
// check is not itself destructive to a later check.
async function installNoDatabasesExistsCheck(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__dbExistsNoDatabases = (dbName) =>
      new Promise((resolve, reject) => {
        let existed = true;
        const req = indexedDB.open(dbName);
        req.onupgradeneeded = () => {
          existed = false;
        };
        req.onsuccess = () => {
          req.result.close();
          if (!existed) indexedDB.deleteDatabase(dbName);
          resolve(existed);
        };
        req.onerror = () => reject(req.error);
      });
  });
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

  // Discriminates the actual fix (AtomicWipe.jsx's fallback name list): the
  // test above always takes the indexedDB.databases() path in Chromium, so
  // it would pass identically whether or not VetRateVKB was ever added to
  // that fallback list.
  test("still deletes the Veteran Knowledge Base when indexedDB.databases() is unavailable (the fallback path)", async ({
    page,
  }) => {
    test.setTimeout(30_000);
    await installDbHelpers(page);
    await installNoDatabasesExistsCheck(page);
    await forceIndexedDbFallbackPath(page);
    await seedReturningUser(page);

    await page.goto("/");
    await dismissDisclaimer(page);
    await page.evaluate(
      ({ vkbDb, vkbStore }) =>
        window.__putInDb(vkbDb, vkbStore, {
          id: "main",
          personal: { fullName: "E2E Seeded Veteran" },
        }),
      { vkbDb: VKB_DB, vkbStore: VKB_STORE },
    );

    expect(
      await page.evaluate((db) => window.__dbExistsNoDatabases(db), VKB_DB),
    ).toBe(true);

    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("openBackupManager")),
    );
    await page
      .getByRole("button", { name: /clear data/i })
      .waitFor({ state: "visible", timeout: 5000 });
    await page.getByRole("button", { name: /clear data/i }).click();
    await page.getByRole("button", { name: /confirm wipe/i }).click();

    await page.waitForURL(/nocache=/, { timeout: 15000 });
    await page.waitForLoadState("load");

    expect(
      await page.evaluate((db) => window.__dbExistsNoDatabases(db), VKB_DB),
    ).toBe(false);
  });
});

// Decision B: VKBViewer's "Clear All Data" reuses the same wipeAllLocalData
// module as Atomic Wipe (no decoy redirect - it reloads instead), and must
// propagate to every open tab so a stale tab's in-memory caches (vkbCache
// and siblings) can't re-save deleted data. Reuses this file's own
// store-seeding/reading helpers - same scope, same module under the hood.
test.describe("VKBViewer Clear All Data propagates to every open tab (decision B)", () => {
  test("clicking Clear All Data in tab 1 wipes every store, and tab 2 reloads on its own with nothing coming back", async ({
    page,
    context,
  }) => {
    test.setTimeout(30_000);
    await installDbHelpers(page);
    await seedReturningUser(page);
    await page.goto("/");
    await dismissDisclaimer(page);
    await seedEveryStore(page);
    // seedEveryStore's raw VKB record (personal.fullName only) is missing
    // most of the schema - calculateCompleteness (runs on any VKB load/save,
    // app-wide, not just VKBViewer opening) reads several nested fields
    // unconditionally and throws on a record shaped that thinly. Dynamically
    // importing the real module inside the page gets the actual, always-
    // in-sync default shape instead of hand-copying fields one crash at a
    // time.
    await page.evaluate(
      async ({ vkbDb, vkbStore }) => {
        const mod = await import("/src/utils/veteranKnowledgeBase.js");
        const fresh = mod.initializeVKB();
        fresh.id = "main";
        fresh.personal.fullName = "E2E Seeded Veteran";
        await window.__putInDb(vkbDb, vkbStore, fresh);
      },
      { vkbDb: VKB_DB, vkbStore: VKB_STORE },
    );

    const page2 = await context.newPage();
    await installDbHelpers(page2);
    await seedReturningUser(page2);
    await page2.goto("/");
    await dismissDisclaimer(page2);

    // Sanity: tab 2 sees the same seeded, shared-origin data before any wipe.
    const before2 = await readEveryStore(page2);
    expect(before2.vkbDbExists).toBe(true);

    // Give tab 2 a real, trusted user gesture before the wipe: a returning
    // user's dismissDisclaimer() is a no-op (already acknowledged), so
    // without this tab 2 never has ANY genuine interaction, and Chromium's
    // own anti-annoyance heuristic suppresses beforeunload prompts entirely
    // for a document with no user interaction, regardless of what the app's
    // own beforeunload handler does - a programmatic
    // dispatchEvent(CustomEvent) does not count as one. Opening the viewer
    // and clicking Edit reproduces the veteran's exact scenario: an
    // interacted-with tab whose own "unsaved changes" guard could otherwise
    // block its cross-tab reload.
    await page2.evaluate(() =>
      window.dispatchEvent(new CustomEvent("openVKBViewer")),
    );
    await page2
      .getByRole("button", { name: /Edit/i })
      .waitFor({ state: "visible", timeout: 10000 });
    await page2.getByRole("button", { name: /Edit/i }).click();

    // Tab 2 must not show a "Leave site?" beforeunload prompt at all when it
    // receives the wipe broadcast (decision B: cross-tab must never be
    // blockable) - if it does, dismiss it (the pre-fix, buggy answer a
    // veteran would most naturally pick for an "unsaved changes" warning) so
    // the rest of this test can still observe the actual consequence (a
    // stale tab that never reloaded) instead of hanging on an unhandled
    // dialog.
    const page2DialogTypes: string[] = [];
    page2.on("dialog", (dialog) => {
      page2DialogTypes.push(dialog.type());
      dialog.dismiss().catch(() => {});
    });

    // Start listening for tab 2's own reload *before* triggering the wipe in
    // tab 1 - dataWipeChannel's broadcast reaches tab 2 (and its listener
    // calls location.reload()) essentially immediately, well before tab 1's
    // own reload+load-state sequence below finishes. Registering this wait
    // afterward races a navigation that may have already happened and
    // misses it (Playwright's waitForEvent does not buffer past events).
    const page2Reloaded = page2.waitForEvent("framenavigated", {
      timeout: 20000,
    });

    page.on("dialog", (dialog) => dialog.accept());
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("openVKBViewer")),
    );
    await page
      .getByRole("button", { name: /clear all data/i })
      .waitFor({ state: "visible", timeout: 5000 });
    await page.getByRole("button", { name: /clear all data/i }).click();

    // VKBViewer's wipe reuses forceReloadWithCacheBypass (nocache=<timestamp>).
    await page.waitForURL(/nocache=/, { timeout: 15000 });
    await page.waitForLoadState("load");

    await page2Reloaded;
    await page2.waitForLoadState("load");

    expect(page2DialogTypes).not.toContain("beforeunload");

    const after1 = await readEveryStore(page);
    const after2 = await readEveryStore(page2);
    for (const after of [after1, after2]) {
      expect(after.localStorage).toBeNull();
      expect(after.sessionStorage).toBeNull();
      expect(after.cookie).toBe(false);
      expect(after.vkbDbExists).toBe(false);
      expect(after.aiModelDbExists).toBe(false);
      expect(after.cacheExists).toBe(false);
    }

    // "Act in tab 2": open the VKB viewer there too, after its own reload -
    // it must render empty, not the stale seeded veteran re-served from an
    // in-memory cache that survived the reload. dismissDisclaimer is a
    // no-op if already acknowledged (the reload re-applies the seeded
    // returning-user init script) - defensive against any first-load gate.
    await dismissDisclaimer(page2);
    await page2.evaluate(() =>
      window.dispatchEvent(new CustomEvent("openVKBViewer")),
    );
    await page2
      .locator('[role="dialog"]')
      .first()
      .waitFor({ state: "visible", timeout: 10000 });
    const nameInput = page2
      .locator('[role="dialog"] input[type="text"]')
      .first();
    await nameInput.waitFor({ state: "visible", timeout: 10000 });
    expect(await nameInput.inputValue()).not.toBe("E2E Seeded Veteran");

    // The AI-facing context an LLM tool would actually receive must be
    // empty too, in tab 2, not just the editor's rendered field - a stale
    // in-memory vkbCache surviving the reload could still feed the seeded
    // veteran into every AI tool even if the editor UI itself looked clean.
    const llmContext = await page2.evaluate(async () => {
      const mod = await import("/src/utils/veteranKnowledgeBase.js");
      const vkb = await mod.loadVKB();
      return mod.generateLLMContext(vkb);
    });
    expect(llmContext).not.toContain("E2E Seeded Veteran");
  });
});

// Decision B again, but through Atomic Wipe (Backup Manager > Clear Data >
// Confirm Wipe) rather than VKBViewer's Clear All Data - dataWipeChannel.js's
// own doc comment claims to cover both, but only VKBViewer ever actually
// called broadcastDataWipe() before this fix. Reuses seedReturningUser only
// (not seedEveryStore/readEveryStore) - the thing under test is purely
// "does tab 2 reload at all", already proven sufficient by tab 2's own
// framenavigated wait timing out on the pre-fix code.
test.describe("Atomic Wipe propagates to every open tab too (decision B)", () => {
  test("Atomic Wipe in tab 1 reloads tab 2 on its own", async ({
    page,
    context,
  }) => {
    test.setTimeout(30_000);
    await seedReturningUser(page);
    await page.goto("/");
    await dismissDisclaimer(page);

    const page2 = await context.newPage();
    await seedReturningUser(page2);
    await page2.goto("/");
    await dismissDisclaimer(page2);

    const page2Reloaded = page2.waitForEvent("framenavigated", {
      timeout: 20000,
    });

    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("openBackupManager")),
    );
    await page
      .getByRole("button", { name: /clear data/i })
      .waitFor({ state: "visible", timeout: 5000 });
    await page.getByRole("button", { name: /clear data/i }).click();
    await page.getByRole("button", { name: /confirm wipe/i }).click();

    // Atomic Wipe force-reloads (nocache=<timestamp>) 500ms after the wipe
    // completes - wait for that real navigation rather than a fixed sleep.
    await page.waitForURL(/nocache=/, { timeout: 15000 });
    await page.waitForLoadState("load");

    // The actual regression this proves fixed: before broadcastDataWipe()
    // was wired into handleAtomicWipe, tab 2 got no notification at all and
    // this wait timed out.
    await page2Reloaded;
    await page2.waitForLoadState("load");
  });
});

// D13-8: startAutoBackup patches localStorage.setItem to monitor writes to
// veteran-data keys. Firefox and WebKit follow the WebIDL named-property
// setter for Storage's own instances, which turns a naive instance-assignment
// patch into a silent no-op that ALSO creates a literal 'setItem' storage
// entry holding the wrapper's own source - confirmed live, not assumed (see
// src/__tests__/utils/autoBackup.test.js's real-Storage-instance test for the
// underlying mechanism, reproduced there via jsdom's own spec-compliant
// Storage). This runs the actual shipped app, in every configured project
// (including firefox) - proof in the browser this defect was specific to,
// not just a jsdom stand-in.
test.describe("Auto-backup patches localStorage without a phantom 'setItem' entry (D13-8)", () => {
  test("no 'setItem' storage entry exists after boot, and writing a monitored key doesn't create one either", async ({
    page,
  }) => {
    await seedReturningUser(page);
    await page.goto("/");
    await dismissDisclaimer(page);

    expect(
      await page.evaluate(() => localStorage.getItem("setItem")),
    ).toBeNull();

    await page.evaluate(() => {
      localStorage.setItem(
        "vet_rate_veteran_profile",
        JSON.stringify({ fullName: "E2E Probe" }),
      );
    });

    expect(
      await page.evaluate(() => localStorage.getItem("setItem")),
    ).toBeNull();
    expect(
      await page.evaluate(() =>
        localStorage.getItem("vet_rate_veteran_profile"),
      ),
    ).toContain("E2E Probe");
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
    __dbExistsNoDatabases: (dbName: string) => Promise<boolean>;
  }
}
