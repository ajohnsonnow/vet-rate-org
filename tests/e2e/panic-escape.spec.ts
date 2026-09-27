import { readFileSync } from "node:fs";
import { test, expect, Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";
import { ESCAPE_WINDOW_MS } from "../../src/utils/safetyRedirect";

/**
 * Coverage for safetyRedirect.js's triple-Escape panic key vs. an Escape
 * that closes a dialog. Root cause (verified live, not assumed): the guard
 * used to read "is a dialog open right now" from a *bubble*-phase listener
 * on window, by which point a closing dialog's own Escape handler (a React
 * state update) had already removed its `role="dialog"` node from the DOM -
 * so a dialog-closing Escape read as "nothing open" and got counted anyway.
 * Three of those in a row (exactly what a veteran does closing dialogs one
 * after another) fired the panic redirect. The fix moves the check to the
 * capture phase, which runs before the dialog's own handler does.
 */

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

const DIALOG_SELECTOR =
  '[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]';
const TOOL_GRID_SELECTOR =
  '#main-content .mt-12.max-w-4xl.mx-auto button, footer[role="contentinfo"] button';
const MARKER_KEY = "panic-escape-test-marker";

async function seedReturningUser(page: Page): Promise<void> {
  await page.addInitScript((appVersion) => {
    localStorage.setItem("vet-rate-tos-accepted", "true");
    localStorage.setItem("vet_rate_last_seen_version", appVersion);
    localStorage.setItem("vetrate-tour-completed", "true");
    localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
    localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
  }, APP_VERSION);
  await page.goto("/");
  await dismissDisclaimer(page);
  await page.evaluate(
    (key) => sessionStorage.setItem(key, "still-here"),
    MARKER_KEY,
  );
}

/**
 * The real panic redirect navigates to https://www.weather.com. Faking the
 * response (rather than skipping the assertion) keeps the test hermetic and
 * fast while still proving a real cross-origin navigation occurred - the
 * browser's own navigation is exercised, only the network round-trip is
 * short-circuited.
 */
async function stubWeatherRedirect(page: Page): Promise<void> {
  await page.route("https://www.weather.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body>stub</body></html>",
    }),
  );
}

async function stillOnApp(page: Page): Promise<boolean> {
  if (!/127\.0\.0\.1/.test(page.url())) return false;
  const marker = await page
    .evaluate((key) => sessionStorage.getItem(key), MARKER_KEY)
    .catch(() => null);
  return marker === "still-here";
}

async function openFirstDialog(page: Page): Promise<void> {
  await page.locator(TOOL_GRID_SELECTOR).first().click();
  await page
    .locator(DIALOG_SELECTOR)
    .first()
    .waitFor({ state: "visible", timeout: 5000 });
}

async function closeDialogWithEscape(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await page
    .locator(DIALOG_SELECTOR)
    .first()
    .waitFor({ state: "hidden", timeout: 5000 });
}

// Five distinct dialogs opened/closed via their bare `open*` event (bypassing
// the grid click), so each cycle is fast enough that consecutive
// dialog-closing Escapes land well inside ESCAPE_WINDOW_MS of each other -
// the actual scenario a veteran closing dialogs one after another produces,
// and the one openFirstDialog/closeDialogWithEscape's slower grid-click cycle
// does not reliably reproduce (see this file's module doc comment history).
const TIGHT_DIALOG_EVENTS = [
  "openAboutUs",
  "openUserManual",
  "openMusterCall",
  "openClaimNavigator",
  "openCAPSimulator",
];

async function openDialogByEvent(page: Page, eventName: string): Promise<void> {
  await page.evaluate(
    (evt) => window.dispatchEvent(new CustomEvent(evt)),
    eventName,
  );
  await page
    .locator(DIALOG_SELECTOR)
    .first()
    .waitFor({ state: "visible", timeout: 5000 });
}

/**
 * Closes each of TIGHT_DIALOG_EVENTS via Escape and records the wall-clock
 * gap between consecutive closes (in-page, via performance.now(), so the
 * timestamps aren't skewed by CDP round-trip latency). Asserting those gaps
 * are under ESCAPE_WINDOW_MS is what makes this test discriminate a capture-
 * vs-bubble regression instead of passing vacuously because the cycle
 * happened to be slow enough to reset the counter between closes.
 */
async function closeDialogsTightly(page: Page): Promise<number[]> {
  const gaps: number[] = [];
  let lastCloseAt: number | null = null;

  for (const eventName of TIGHT_DIALOG_EVENTS) {
    await openDialogByEvent(page, eventName);
    await page.keyboard.press("Escape");
    await page
      .locator(DIALOG_SELECTOR)
      .first()
      .waitFor({ state: "hidden", timeout: 5000 });

    const closedAt = await page.evaluate(() => performance.now());
    if (lastCloseAt !== null) gaps.push(closedAt - lastCloseAt);
    lastCloseAt = closedAt;
  }

  return gaps;
}

test.describe("Panic key (triple-Escape) vs. dialog-closing Escapes", () => {
  test("closing 4 dialogs in a row via Escape never trips the panic key", async ({
    page,
  }) => {
    await seedReturningUser(page);

    for (let i = 0; i < 4; i++) {
      await openFirstDialog(page);
      await closeDialogWithEscape(page);
    }

    expect(await stillOnApp(page)).toBe(true);
  });

  test("3 deliberate Escapes with nothing open trigger the panic redirect", async ({
    page,
  }) => {
    await seedReturningUser(page);
    await stubWeatherRedirect(page);

    for (let i = 0; i < 3; i++) await page.keyboard.press("Escape");

    await page.waitForURL(/weather\.com/, { timeout: 5000 });
    expect(page.url()).toMatch(/weather\.com/);
  });

  test("mixed: dialog-closing Escapes don't count toward 3 real ones", async ({
    page,
  }) => {
    await seedReturningUser(page);
    await stubWeatherRedirect(page);

    // Two dialog-closes shouldn't move the counter at all.
    await openFirstDialog(page);
    await closeDialogWithEscape(page);
    await openFirstDialog(page);
    await closeDialogWithEscape(page);
    expect(await stillOnApp(page)).toBe(true);

    // Now 3 real, deliberate Escapes with nothing open still fire.
    for (let i = 0; i < 3; i++) await page.keyboard.press("Escape");
    await page.waitForURL(/weather\.com/, { timeout: 5000 });
    expect(page.url()).toMatch(/weather\.com/);
  });

  // Tight-timing regression guard: the "closing 4 dialogs in a row" test
  // above opens each dialog via a real grid click, and that cycle (click,
  // wait visible, Escape, wait hidden) routinely runs well past
  // ESCAPE_WINDOW_MS, so the counter resets between dialog-closing Escapes
  // even with a capture-vs-bubble regression present - it can pass
  // vacuously. This closes 5 distinct dialogs via their bare open* event
  // (no grid click) and asserts the actual gap between consecutive closes
  // stayed under ESCAPE_WINDOW_MS, so the test can't pass by timing alone.
  test("closing 5 different dialogs with tight Escape timing never trips the panic key", async ({
    page,
  }) => {
    await seedReturningUser(page);

    const gaps = await closeDialogsTightly(page);

    expect(gaps.every((gap) => gap < ESCAPE_WINDOW_MS)).toBe(true);
    expect(await stillOnApp(page)).toBe(true);
  });

  // REGRESSION: HANDLED_ELSEWHERE_SELECTOR's aria-haspopup clause treated
  // every open disclosure menu as "will be handled elsewhere", full stop.
  // Header's Tools/Resources dropdowns have no Escape handler at all (close
  // only on blur or a second trigger click), so with either open, every
  // Escape was swallowed and the panic key stayed dead until the menu closed
  // some other way. This opens the desktop Tools menu (unaffected by
  // whether it also closes) and proves 3 Escapes still redirect.
  test("triple-Escape still redirects while the desktop Tools menu is open", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedReturningUser(page);
    await stubWeatherRedirect(page);

    await page.locator('[data-e2e-menu-trigger="tools"]').click();
    await page
      .locator('[data-e2e-menu-panel="tools"]')
      .waitFor({ state: "visible", timeout: 5000 });

    for (let i = 0; i < 3; i++) await page.keyboard.press("Escape");

    await page.waitForURL(/weather\.com/, { timeout: 5000 });
    expect(page.url()).toMatch(/weather\.com/);
  });

  test("triple-Escape still redirects while the desktop Resources menu is open", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedReturningUser(page);
    await stubWeatherRedirect(page);

    await page.locator('[data-e2e-menu-trigger="resources"]').click();
    await page
      .locator('[data-e2e-menu-panel="resources"]')
      .waitFor({ state: "visible", timeout: 5000 });

    for (let i = 0; i < 3; i++) await page.keyboard.press("Escape");

    await page.waitForURL(/weather\.com/, { timeout: 5000 });
    expect(page.url()).toMatch(/weather\.com/);
  });
});

/**
 * Coverage for the app-wide beforeunload "unsaved changes" guard
 * (dataPersistence.js/persistentStorage.js) vs. the panic redirect. Root
 * cause: a `beforeunload` listener that calls preventDefault() makes the
 * browser show a native "Leave site?" prompt, and that prompt blocks
 * location.replace() the same as any other navigation - confirmed directly
 * against a real Chromium `dialog` event (type "beforeunload") before
 * writing this fix, not assumed. The panic redirect must remove every such
 * guard before it ever navigates, so neither Quick Exit nor triple-Escape
 * can be blocked by it, with unsaved changes genuinely pending.
 */
const QUICK_EXIT_SELECTOR =
  'button[aria-label="Quick exit - immediately leave this page"]';

async function seedUnsavedChanges(page: Page): Promise<void> {
  // dataPersistence.js's hasUnsavedChanges() reads this key and compares its
  // hash against vetrate_last_backup_timestamp/vetrate_data_hash - seeding it
  // alone (with no matching backup hash recorded) is exactly the real "typed
  // something, never backed up" state a veteran mid-task is in.
  await page.addInitScript(() => {
    localStorage.setItem("saved_claims", JSON.stringify([{ id: "e2e-1" }]));
  });
}

/**
 * Holds every `indexedDB.open()` call open-ended, simulating a stalled
 * migration decision so MigrationScreen stays mounted long enough to
 * exercise Quick Exit/triple-Escape against it deterministically, without
 * racing how briefly it renders in the normal case. Mirrors
 * boot-migration.spec.ts's holdIndexedDbOpen (kept local - that file is
 * outside this change's scope).
 */
async function holdIndexedDbOpen(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const originalOpen = indexedDB.open.bind(indexedDB);
    indexedDB.open = ((...args: Parameters<typeof indexedDB.open>) => {
      const fakeRequest = {} as IDBOpenDBRequest;
      // Never resolves - useBootSequence.js's MIGRATION_DECISION_TIMEOUT_MS
      // (3000ms) fail-open is what eventually moves the boot gate, not this.
      void originalOpen;
      return fakeRequest;
    }) as typeof indexedDB.open;
  });
}

function watchForBeforeUnloadDialog(page: Page): { fired: boolean } {
  const state = { fired: false };
  page.on("dialog", (dialog) => {
    if (dialog.type() === "beforeunload") state.fired = true;
    dialog.dismiss().catch(() => {});
  });
  return state;
}

async function clickQuickExit(page: Page): Promise<void> {
  await page.locator(QUICK_EXIT_SELECTOR).first().click();
  await page.getByRole("button", { name: /^exit$/i }).click();
}

test.describe("Panic paths vs. the beforeunload unsaved-changes guard", () => {
  test("Quick Exit lands on the decoy URL with no beforeunload dialog, with unsaved changes pending", async ({
    page,
  }) => {
    await seedUnsavedChanges(page);
    await seedReturningUser(page);
    await stubWeatherRedirect(page);
    const dialogState = watchForBeforeUnloadDialog(page);

    await clickQuickExit(page);

    await page.waitForURL(/weather\.com/, { timeout: 5000 });
    expect(page.url()).toMatch(/weather\.com/);
    expect(dialogState.fired).toBe(false);
  });

  test("triple-Escape lands on the decoy URL with no beforeunload dialog, with unsaved changes pending", async ({
    page,
  }) => {
    await seedUnsavedChanges(page);
    await seedReturningUser(page);
    await stubWeatherRedirect(page);
    const dialogState = watchForBeforeUnloadDialog(page);

    for (let i = 0; i < 3; i++) await page.keyboard.press("Escape");

    await page.waitForURL(/weather\.com/, { timeout: 5000 });
    expect(page.url()).toMatch(/weather\.com/);
    expect(dialogState.fired).toBe(false);
  });

  test("Quick Exit on the migration screen lands on the decoy URL with no beforeunload dialog, with unsaved changes pending", async ({
    page,
  }) => {
    await seedUnsavedChanges(page);
    await holdIndexedDbOpen(page);
    await stubWeatherRedirect(page);
    const dialogState = watchForBeforeUnloadDialog(page);

    await page.goto("/");
    await page.locator(QUICK_EXIT_SELECTOR).first().waitFor({
      state: "visible",
      timeout: 5000,
    });
    await clickQuickExit(page);

    await page.waitForURL(/weather\.com/, { timeout: 5000 });
    expect(page.url()).toMatch(/weather\.com/);
    expect(dialogState.fired).toBe(false);
  });
});

/**
 * CrisisModal is non-dismissible by design (no onEscape - see
 * CrisisModal.jsx) - correct, and unchanged here. But the app-wide
 * triple-Escape panic key is a separate system with its own standing
 * requirement: it must always work, crisis screens included. Before the
 * fix, safetyRedirect.js trusted any open [role="dialog"/"alertdialog"] to
 * close on its own Escape and never re-checked, so a modal that (correctly)
 * never closes on Escape left the panic key permanently swallowed for as
 * long as it stayed open.
 */
async function openCrisisModal(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("vetrate:crisis", {
        detail: { severity: "high", source: "e2e" },
      }),
    );
  });
  await page
    .locator('[role="alertdialog"]')
    .waitFor({ state: "visible", timeout: 5000 });
}

test.describe("Triple-Escape vs. the non-dismissible Crisis Modal", () => {
  test("a single Escape does not dismiss the crisis modal", async ({
    page,
  }) => {
    await seedReturningUser(page);
    await openCrisisModal(page);

    await page.keyboard.press("Escape");

    await expect(page.locator('[role="alertdialog"]')).toBeVisible();
  });

  test("triple-Escape still redirects while the crisis modal is open and never closes it", async ({
    page,
  }) => {
    await seedReturningUser(page);
    await stubWeatherRedirect(page);
    await openCrisisModal(page);

    for (let i = 0; i < 3; i++) await page.keyboard.press("Escape");

    await page.waitForURL(/weather\.com/, { timeout: 5000 });
    expect(page.url()).toMatch(/weather\.com/);
  });

  // Stacked-dialog dead zone (item 3): a dialog opened first, then the
  // non-dismissible crisis modal on top of it. Closing neither via Escape,
  // triple-Escape must still redirect - the dialog COUNT never decreases,
  // so this must not be swallowed just because something else is open
  // underneath.
  test("triple-Escape still redirects with the crisis modal stacked on top of an already-open dialog", async ({
    page,
  }) => {
    await seedReturningUser(page);
    await stubWeatherRedirect(page);

    await page.locator(TOOL_GRID_SELECTOR).first().click();
    await page
      .locator(DIALOG_SELECTOR)
      .first()
      .waitFor({ state: "visible", timeout: 5000 });
    await openCrisisModal(page);

    for (let i = 0; i < 3; i++) await page.keyboard.press("Escape");

    await page.waitForURL(/weather\.com/, { timeout: 5000 });
    expect(page.url()).toMatch(/weather\.com/);
  });
});
