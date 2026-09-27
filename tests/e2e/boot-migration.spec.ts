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

const MIGRATION_SETTLED_RE =
  /IndexedDB Migration: (Successfully migrated|Already complete)/;
const AUTO_BACKUP_SETTLED_RE = /Auto-Backup: System initialized/;
// A key the app itself never reads, so seeding it can't perturb any real
// component's rendering - migrateFromLocalStorage() copies every
// localStorage key, not just the ones needsMigration() checks for.
const MARKER_KEY = "e2e_boot_migration_marker";
const MARKER_VALUE = "boot-migration-fixture";

function attachBootWatcher(page: Page) {
  const state = { migrationSettled: false, autoBackupSettled: false };
  const onConsole = (msg: ConsoleMessage) => {
    const text = msg.text();
    if (MIGRATION_SETTLED_RE.test(text)) state.migrationSettled = true;
    if (AUTO_BACKUP_SETTLED_RE.test(text)) state.autoBackupSettled = true;
  };
  page.on("console", onConsole);
  return { state, detach: () => page.off("console", onConsole) };
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
    await expect
      .poll(() => watcher.state.migrationSettled, { timeout: 20_000 })
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
      .poll(() => firstLoad.state.migrationSettled, { timeout: 20_000 })
      .toBe(true);
    firstLoad.detach();

    const secondLoad = attachBootWatcher(page);
    await page.reload();
    await dismissDisclaimer(page);
    await expect
      .poll(() => secondLoad.state.migrationSettled, { timeout: 20_000 })
      .toBe(true);
    secondLoad.detach();

    expect(await readIdbValue(page, MARKER_KEY)).toBe(MARKER_VALUE);
    expect(
      await page.evaluate((k) => localStorage.getItem(k), MARKER_KEY),
    ).toBe(MARKER_VALUE);
  });
});
