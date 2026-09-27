import { readFileSync } from "node:fs";
import { test, expect, Page, ConsoleMessage } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

/**
 * boot-swap-dialog-loss regression coverage.
 *
 * Before the fix, App.jsx mounted the interactive tree immediately
 * (isMigrating started false), then swapped the whole tree out for
 * <MigrationScreen/> the instant a returning user's localStorage->IndexedDB
 * migration kicked in, then swapped back when it finished - unmounting
 * (and losing the state of) any dialog already open, and silently dropping
 * any window CustomEvent dispatched while nothing was mounted to hear it.
 *
 * The fix (useBootSequence.js's isBooting) holds the boot/migration screen
 * up until the migration decision has fully resolved, so the interactive
 * tree - and everything a veteran can open inside it - only ever mounts
 * once, after migration is already done. These tests seed real
 * pre-migration localStorage keys (the exact set src/utils/storage.js's
 * needsMigration() checks), so a genuine migration copy runs on load, and
 * assert a dialog opened right after boot survives the rest of the boot
 * sequence, and that the migrated data lands in IndexedDB exactly once and
 * survives an idempotent second load.
 */

// Kept as two distinct regexes (not one alternation) so a test can assert
// *which* branch fired: an idempotent second load must hit "Already
// complete" specifically, and a bug that re-runs the copy every load would
// still satisfy a loose "either one" check.
const MIGRATION_COPY_RAN_RE = /IndexedDB Migration: Successfully migrated/;
const MIGRATION_ALREADY_DONE_RE = /IndexedDB Migration: Already complete/;
const AUTO_BACKUP_SETTLED_RE = /Auto-Backup: System initialized/;
// A key the app itself never reads, so seeding it can't perturb any real
// component's rendering - migrateFromLocalStorage() copies every
// localStorage key, not just the ones needsMigration() checks for.
const MARKER_KEY = "e2e_boot_migration_marker";
const MARKER_VALUE = "boot-migration-fixture";

function attachBootWatcher(page: Page) {
  const state = {
    copyRan: false,
    alreadyDone: false,
    autoBackupSettled: false,
  };
  const onConsole = (msg: ConsoleMessage) => {
    const text = msg.text();
    if (MIGRATION_COPY_RAN_RE.test(text)) state.copyRan = true;
    if (MIGRATION_ALREADY_DONE_RE.test(text)) state.alreadyDone = true;
    if (AUTO_BACKUP_SETTLED_RE.test(text)) state.autoBackupSettled = true;
  };
  page.on("console", onConsole);
  return { state, detach: () => page.off("console", onConsole) };
}

/**
 * Holds every `indexedDB.open()` call in the page open-ended until the test
 * calls `window.__release()`, simulating a stalled/blocked IndexedDB open
 * (e.g. another tab's Atomic Wipe mid-delete) without needing two real
 * tabs. idb-keyval's default store opens 'keyval-store' lazily, once, on
 * the page's first get/set/del call - which for an unbooted app is always
 * needsMigration()'s own read - so holding indexedDB.open holds the
 * migration decision itself.
 */
async function holdIndexedDbOpen(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let release: () => void = () => {};
    const releaseGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    (window as unknown as { __release: () => void }).__release = () =>
      release();

    const originalOpen = indexedDB.open.bind(indexedDB);
    indexedDB.open = ((...args: Parameters<typeof indexedDB.open>) => {
      const fakeRequest = {} as IDBOpenDBRequest;
      releaseGate.then(() => {
        const real = originalOpen(...args);
        real.onupgradeneeded = (ev) => {
          fakeRequest.result = real.result;
          fakeRequest.onupgradeneeded?.(ev);
        };
        real.onsuccess = (ev) => {
          fakeRequest.result = real.result;
          fakeRequest.onsuccess?.(ev);
        };
        real.onerror = (ev) => {
          fakeRequest.error = real.error;
          fakeRequest.onerror?.(ev);
        };
        real.onblocked = (ev) => {
          fakeRequest.onblocked?.(ev);
        };
      });
      return fakeRequest;
    }) as typeof indexedDB.open;
  });
}

async function seedPreMigrationKeys(page: Page): Promise<void> {
  await page.addInitScript(
    ({ markerKey, markerValue, appVersion }) => {
      // The exact keys src/utils/storage.js's needsMigration() checks -
      // any one of them present makes this a genuine "returning user with
      // pre-migration data" load, not a first-ever visit.
      localStorage.setItem("vet-rate-tos-accepted", "true");
      localStorage.setItem("pwa_install_dismissed", "1");
      // Skip unrelated onboarding dialogs so they can't cover the one this
      // test opens. last-seen-version must match the running build, or
      // useUpdateOrchestrator opens the What's-New modal over everything.
      localStorage.setItem("vet_rate_last_seen_version", appVersion);
      localStorage.setItem("vetrate-tour-completed", "true");
      localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
      localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
      // The fixture whose migrated copy this test verifies.
      localStorage.setItem(markerKey, markerValue);
    },
    {
      markerKey: MARKER_KEY,
      markerValue: MARKER_VALUE,
      appVersion: APP_VERSION,
    },
  );
}

async function readIdbValue(page: Page, key: string): Promise<unknown> {
  return page.evaluate(
    (k) =>
      new Promise((resolve, reject) => {
        const openReq = indexedDB.open("keyval-store");
        openReq.onerror = () => reject(openReq.error);
        openReq.onsuccess = () => {
          const db = openReq.result;
          if (!db.objectStoreNames.contains("keyval")) {
            resolve(undefined);
            return;
          }
          const getReq = db
            .transaction("keyval", "readonly")
            .objectStore("keyval")
            .get(k);
          getReq.onsuccess = () => resolve(getReq.result);
          getReq.onerror = () => reject(getReq.error);
        };
      }),
    key,
  );
}

test.describe("Boot migration does not close an open dialog or lose data", () => {
  test("a dialog opened right after boot survives the rest of the boot sequence, and the migrated marker lands in IndexedDB", async ({
    page,
  }) => {
    test.setTimeout(45000);
    const watcher = attachBootWatcher(page);
    await seedPreMigrationKeys(page);
    await page.goto("/");

    // Immediately, before anything can possibly have mounted: a raw dispatch
    // aimed at a dialog. Under the fix this is necessarily a no-op (nothing
    // is listening yet, by design - see comment above) - the real assertion
    // is the click below, once the tool launcher genuinely exists.
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("openMyPacket"));
    });

    await dismissDisclaimer(page);
    // A genuine copy, not "already complete" - proves this load actually
    // exercised the migration path the rest of the test depends on.
    await expect
      .poll(() => watcher.state.copyRan, { timeout: 20_000 })
      .toBe(true);
    await expect(
      page.getByText("Upgrading your data storage. This only happens once."),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "My Packet" }).click();
    const dialog = page.locator('[role="dialog"]').last();
    await expect(dialog).toBeVisible();

    // The rest of the boot sequence (persistent storage, auto-backup,
    // user-data migrations) keeps running in the background after mount;
    // none of it may close what was just opened.
    await expect
      .poll(() => watcher.state.autoBackupSettled, { timeout: 20_000 })
      .toBe(true);
    await expect(dialog).toBeVisible();
    watcher.detach();

    expect(await readIdbValue(page, MARKER_KEY)).toBe(MARKER_VALUE);
    expect(
      await page.evaluate((k) => localStorage.getItem(k), MARKER_KEY),
    ).toBe(MARKER_VALUE);
  });

  test("reloading after migration is idempotent: the marker is still present exactly once, unchanged", async ({
    page,
  }) => {
    const firstLoad = attachBootWatcher(page);
    await seedPreMigrationKeys(page);
    await page.goto("/");
    await dismissDisclaimer(page);
    await expect
      .poll(() => firstLoad.state.copyRan, { timeout: 20_000 })
      .toBe(true);
    firstLoad.detach();

    const secondLoad = attachBootWatcher(page);
    await page.reload();
    await dismissDisclaimer(page);
    // Specifically "already complete", not a loose "settled either way" -
    // a bug that re-copies on every load would still satisfy the latter.
    await expect
      .poll(() => secondLoad.state.alreadyDone, { timeout: 20_000 })
      .toBe(true);
    expect(secondLoad.state.copyRan).toBe(false);
    secondLoad.detach();

    expect(await readIdbValue(page, MARKER_KEY)).toBe(MARKER_VALUE);
    expect(
      await page.evaluate((k) => localStorage.getItem(k), MARKER_KEY),
    ).toBe(MARKER_VALUE);
  });

  test("the boot screen fails open within its timeout, and never hides Quick Exit, even if the migration decision never settles", async ({
    page,
  }) => {
    test.setTimeout(20_000);
    await holdIndexedDbOpen(page);
    await page.goto("/");

    // MigrationScreen's own Quick Exit button - reachable the instant the
    // screen renders, independent of whether/when the boot gate resolves.
    await expect(
      page.getByRole("button", { name: /quick exit/i }),
    ).toBeVisible();

    // Bounded by useBootSequence.js's MIGRATION_DECISION_TIMEOUT_MS
    // (3000ms): the interactive tree must mount even though indexedDB.open
    // above is still artificially held and release() is never called.
    await page
      .locator("#main-content")
      .waitFor({ state: "attached", timeout: 8000 });
  });

  test("a dialog opened while the migration decision is artificially held survives once it settles", async ({
    page,
  }) => {
    test.setTimeout(45_000);
    await holdIndexedDbOpen(page);
    await seedPreMigrationKeys(page);
    const watcher = attachBootWatcher(page);

    await page.goto("/");
    // dismissDisclaimer waits for #main-content, part of the gated tree, so
    // this only returns once the tree has mounted - here, necessarily via
    // the fail-open timeout above, since the real decision is still held.
    await dismissDisclaimer(page);

    await page.getByRole("button", { name: "My Packet" }).click();
    const dialog = page.locator('[role="dialog"]').last();
    await expect(dialog).toBeVisible();

    // Only now let the real (still-pending) migration decision resolve.
    // Before the isBooting fix, this is the exact moment a returning user's
    // migration swapped an already-open dialog out from under them.
    await page.evaluate(() =>
      (window as unknown as { __release: () => void }).__release(),
    );

    await expect
      .poll(() => watcher.state.copyRan || watcher.state.alreadyDone, {
        timeout: 20_000,
      })
      .toBe(true);
    await expect
      .poll(() => watcher.state.autoBackupSettled, { timeout: 20_000 })
      .toBe(true);
    await expect(dialog).toBeVisible();
    watcher.detach();
  });
});
