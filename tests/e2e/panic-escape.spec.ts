import { readFileSync } from "node:fs";
import { test, expect, Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";
import {
  ESCAPE_WINDOW_MS,
  ESCAPE_THRESHOLD,
} from "../../src/utils/safetyRedirect";

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

interface DialogCloseProbeResult {
  eventName: string;
  panicFiredAfterClose: boolean;
  panicFiredAfterProbes: boolean;
}

/**
 * For each of TIGHT_DIALOG_EVENTS: open it, close it via Escape, then
 * immediately fire ESCAPE_THRESHOLD - 1 more deliberate Escapes (nothing
 * open) back-to-back and record whether `vetrate:panic-triggered` fired
 * after the close itself and after the probes.
 *
 * An earlier version measured the real wall-clock gap between five
 * open->Escape->close cycles and asserted it stayed under ESCAPE_WINDOW_MS,
 * on the theory that a capture-vs-bubble regression (the dialog-closing
 * Escape gets miscounted) would only accumulate toward the redirect if
 * consecutive closes landed within that window - otherwise the counter
 * resets between them and the test passes vacuously even with the
 * regression present. That held the *test's* own cycle speed to an
 * unrealistic standard: under worker contention, five real dialogs
 * open/close on real React renders, and the compositor and CPU scheduling
 * of several concurrent Chromium instances measurably slow that down -
 * "no CDP round trip" removed one source of slack but not that one, so the
 * gap assertion itself still flaked under 6-worker load with no app
 * regression involved.
 *
 * Probing immediately after each close sidesteps needing the *dialogs* to
 * cycle quickly at all: the probes are ESCAPE_THRESHOLD - 1 = 2 raw
 * `document.dispatchEvent` calls with no real work (no render, no CDP round
 * trip) between them, so their own timing is effectively instant regardless
 * of system load. If the preceding dialog-close had secretly counted (the
 * exact regression this guards), the running total reaches ESCAPE_THRESHOLD
 * once the probes land and the redirect fires; if it was correctly exempt,
 * the probes alone (2) never reach the threshold (3) and nothing fires -
 * proof either way, independent of how long the dialog itself took to open
 * and close.
 */
async function probeDialogClosesForMiscount(
  page: Page,
): Promise<DialogCloseProbeResult[]> {
  return page.evaluate(
    async ({ events, dialogSelector, escapeThreshold, resetWindowMs }) => {
      let panicFired = false;
      window.addEventListener("vetrate:panic-triggered", () => {
        panicFired = true;
      });

      // setTimeout, not requestAnimationFrame: rAF ties polling to the
      // compositor's own frame rate, which several concurrent Chromium
      // instances (a multi-worker run) visibly throttle under GPU/compositor
      // contention.
      const waitFor = (predicate: () => boolean, timeoutMs: number) =>
        new Promise<void>((resolve, reject) => {
          const start = performance.now();
          const poll = () => {
            if (predicate()) {
              resolve();
              return;
            }
            if (performance.now() - start > timeoutMs) {
              reject(new Error("waitFor timed out"));
              return;
            }
            setTimeout(poll, 0);
          };
          poll();
        });

      // The dialog's DOM node existing is not enough: useFocusTrap registers
      // its Escape handler (pushEscapeTrap) and moves focus in from a
      // useEffect, which runs *after* the DOM mutation commits, not in the
      // same synchronous step. Dispatching Escape the instant querySelector
      // finds the node can fire into the gap before the trap is registered,
      // so it does nothing and the dialog never closes. Waiting for focus to
      // have actually landed inside the dialog (every one of
      // TIGHT_DIALOG_EVENTS autoFocuses on open) proves the same effect that
      // installed the trap has run.
      const dialogIsReady = () => {
        const dialog = document.querySelector(dialogSelector);
        return !!dialog && dialog.contains(document.activeElement);
      };

      const pressEscape = () => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
            cancelable: true,
          }),
        );
      };

      const results: DialogCloseProbeResult[] = [];

      for (const eventName of events) {
        window.dispatchEvent(new CustomEvent(eventName));
        await waitFor(dialogIsReady, 5000);

        panicFired = false;
        pressEscape();
        await waitFor(
          () => document.querySelector(dialogSelector) === null,
          5000,
        );
        const panicFiredAfterClose = panicFired;

        panicFired = false;
        for (let i = 0; i < escapeThreshold - 1; i++) pressEscape();
        const panicFiredAfterProbes = panicFired;

        results.push({
          eventName,
          panicFiredAfterClose,
          panicFiredAfterProbes,
        });
        if (panicFiredAfterClose || panicFiredAfterProbes) break;

        // Let ESCAPE_WINDOW_MS elapse so this iteration's probes don't carry
        // into the next dialog's baseline.
        await new Promise((resolve) =>
          setTimeout(resolve, resetWindowMs + 100),
        );
      }

      return results;
    },
    {
      events: TIGHT_DIALOG_EVENTS,
      dialogSelector: DIALOG_SELECTOR,
      escapeThreshold: ESCAPE_THRESHOLD,
      resetWindowMs: ESCAPE_WINDOW_MS,
    },
  );
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
  // (no grid click) and immediately probes each close with
  // ESCAPE_THRESHOLD - 1 deliberate Escapes (see probeDialogClosesForMiscount)
  // so the test can't pass by timing alone, deterministically rather than by
  // hoping five real dialog cycles happen to land within ESCAPE_WINDOW_MS of
  // each other.
  test("closing 5 different dialogs never trips the panic key, even probed immediately after each close", async ({
    page,
  }) => {
    await seedReturningUser(page);
    await stubWeatherRedirect(page);

    const results = await probeDialogClosesForMiscount(page);

    expect(results).toEqual(
      TIGHT_DIALOG_EVENTS.map((eventName) => ({
        eventName,
        panicFiredAfterClose: false,
        panicFiredAfterProbes: false,
      })),
    );
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

// One click, no confirmation step - Quick Exit must always work a single
// tap away, on every screen, with nothing able to block or delay it.
async function clickQuickExit(page: Page): Promise<void> {
  await page.locator(QUICK_EXIT_SELECTOR).first().click();
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
    // Confirms this actually exercises MigrationScreen (its boot splash,
    // held open by holdIndexedDbOpen above) rather than the main app's own
    // Quick Exit - MIGRATION_DECISION_TIMEOUT_MS fails the boot gate open at
    // ~3000ms, after which the main app mounts and renders one too, so a
    // regression that stopped MigrationScreen from rendering Quick Exit
    // could otherwise still pass this test via that later button.
    await page
      .getByRole("status")
      .filter({ hasText: /Loading\.\.\./ })
      .waitFor({ state: "visible", timeout: 2000 });
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

/**
 * VKBViewer and TheTribunal both activate their focus trap while still
 * loading, rendering a bare dialog shell with nothing focusable - so the
 * dialog's own Escape handler (bound to the panel node, relying on
 * bubbling) never saw a keydown fired at focus sitting outside it, and
 * Escape could never close either dialog for as long as it stayed open
 * (useFocusTrap.js). Each non-closing Escape counted like any other
 * unhandled one, so three quick Escapes aimed at closing the dialog fired
 * the panic redirect instead. Waiting for each dialog's real, post-load
 * content before pressing Escape is what actually exercises this - the bare
 * shell alone would close (or fail to) too fast to reproduce the dead zone
 * either way.
 */
test.describe("Triple-Escape vs. dialogs that load empty (VKB viewer / The Tribunal dead zone)", () => {
  test("an Escape actually closes the VKB viewer once its content has loaded, and does not misfire the panic redirect", async ({
    page,
  }) => {
    await seedReturningUser(page);

    await openDialogByEvent(page, "openVKBViewer");
    await page
      .getByRole("button", { name: /clear all data/i })
      .waitFor({ state: "visible", timeout: 5000 });

    await closeDialogWithEscape(page);

    expect(await stillOnApp(page)).toBe(true);
  });

  test("an Escape actually closes The Tribunal once its content has loaded, and does not misfire the panic redirect", async ({
    page,
  }) => {
    await seedReturningUser(page);

    await openDialogByEvent(page, "openTheTribunal");
    await page
      .locator("#the-tribunal-title")
      .waitFor({ state: "visible", timeout: 5000 });

    await closeDialogWithEscape(page);

    expect(await stillOnApp(page)).toBe(true);
  });
});

/**
 * event.repeat filtering already existed at both the capture snapshot and
 * the bubble decision before this branch (see safetyRedirect.js) - covered
 * so far only by jsdom unit tests, never against a real browser's dispatch.
 */
test.describe("Holding Escape (auto-repeat) never misfires the panic redirect", () => {
  test("holding Escape after it closes a dialog does not trigger the panic redirect, no matter how long the key stays down", async ({
    page,
  }) => {
    await seedReturningUser(page);

    await openFirstDialog(page);
    await closeDialogWithEscape(page); // one genuine press: closes the dialog, not counted

    await page.evaluate(() => {
      for (let i = 0; i < 15; i++) {
        window.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
            cancelable: true,
            repeat: true,
          }),
        );
      }
    });
    await page.waitForTimeout(ESCAPE_WINDOW_MS / 2);

    expect(await stillOnApp(page)).toBe(true);
  });
});

/**
 * MaintenancePage is the only thing on screen when /version.json reports
 * maintenance_mode: true (App.jsx) - Quick Exit and triple-Escape must stay
 * reachable there too, a veteran routed here mid-session is not exempt.
 * Covered so far only by a unit test with a mocked triggerPanicRedirect,
 * never against a real browser's navigation.
 */
async function forceMaintenanceMode(page: Page): Promise<void> {
  await page.route("**/version.json*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        version: APP_VERSION,
        maintenance_mode: true,
        maintenance_message: "e2e-forced maintenance",
      }),
    }),
  );
  await page.goto("/");
  await page
    .getByRole("heading", { name: /maintenance mode/i })
    .waitFor({ state: "visible", timeout: 5000 });
}

test.describe("Quick Exit / triple-Escape on the maintenance kill-switch page", () => {
  test("Quick Exit lands on the decoy URL with a single click and no confirmation dialog", async ({
    page,
  }) => {
    await stubWeatherRedirect(page);
    await forceMaintenanceMode(page);

    await clickQuickExit(page);

    await page.waitForURL(/weather\.com/, { timeout: 5000 });
    expect(page.url()).toMatch(/weather\.com/);
  });

  test("triple-Escape redirects on the maintenance page", async ({ page }) => {
    await stubWeatherRedirect(page);
    await forceMaintenanceMode(page);

    for (let i = 0; i < 3; i++) await page.keyboard.press("Escape");

    await page.waitForURL(/weather\.com/, { timeout: 5000 });
    expect(page.url()).toMatch(/weather\.com/);
  });
});

/**
 * Owner decision C: ONLY an Escape that closes a tool DIALOG is exempt from
 * the panic count - a popup/menu/combobox closing (or failing to close) on
 * Escape still counts, same as a dialog that stays open (Crisis Modal,
 * already covered above) or a tool dialog that closes normally (already
 * covered above too - "closing 4/5 dialogs never trips the panic key").
 * SearchBar's suggestion combobox is the one non-dialog exemption case with
 * no existing e2e coverage: it closes on Escape via its own handler, but is
 * `role="combobox"`, not `role="dialog"`, so safetyRedirect.js's
 * DIALOG_SELECTOR never matches it and those Escapes must count.
 */
test.describe("Triple-Escape vs. a non-dialog combobox (decision C)", () => {
  test("3 Escapes that close the search suggestions combobox still trigger the panic redirect", async ({
    page,
  }) => {
    await seedReturningUser(page);
    await stubWeatherRedirect(page);

    const searchInput = page.getByRole("combobox");
    await searchInput.fill("tinnitus");
    await page
      .getByRole("listbox")
      .waitFor({ state: "visible", timeout: 5000 });

    for (let i = 0; i < 3; i++) await page.keyboard.press("Escape");

    await page.waitForURL(/weather\.com/, { timeout: 5000 });
    expect(page.url()).toMatch(/weather\.com/);
  });

  // Proves the test above isn't vacuously passing regardless of what the
  // combobox does: fewer than the threshold, even with the same combobox
  // interaction, must not redirect.
  test("2 Escapes that close the search suggestions combobox do not trigger the panic redirect", async ({
    page,
  }) => {
    await seedReturningUser(page);
    await stubWeatherRedirect(page);

    const searchInput = page.getByRole("combobox");
    await searchInput.fill("tinnitus");
    await page
      .getByRole("listbox")
      .waitFor({ state: "visible", timeout: 5000 });

    for (let i = 0; i < 2; i++) await page.keyboard.press("Escape");

    expect(await stillOnApp(page)).toBe(true);
  });
});

/**
 * Owner decision C, the tooltip case specifically: Tooltip.jsx dismisses on
 * Escape via a `document`-level CAPTURE-phase listener that calls
 * stopPropagation() (not preventDefault()) - safetyRedirect.js's own count
 * decision used to live on window's BUBBLE phase, the very last stop in the
 * dispatch, so that stopPropagation() call meant the decision never ran at
 * all for that Escape, not just late. Decision C exempts only a
 * dialog-closing Escape; a tooltip (or anything else) swallowing the event
 * first must still count.
 */
test.describe("Triple-Escape vs. an open tooltip (decision C)", () => {
  const bugButtonName = /report a bug/i;

  async function openBugButtonTooltip(page: Page): Promise<void> {
    await page.getByRole("button", { name: bugButtonName }).hover();
    await page
      .locator('[role="tooltip"]')
      .waitFor({ state: "visible", timeout: 3000 });
  }

  test("3 Escapes with the Report-a-Bug tooltip open still trigger the panic redirect", async ({
    page,
  }) => {
    await seedReturningUser(page);
    await stubWeatherRedirect(page);

    await openBugButtonTooltip(page);

    for (let i = 0; i < 3; i++) await page.keyboard.press("Escape");

    await page.waitForURL(/weather\.com/, { timeout: 5000 });
    expect(page.url()).toMatch(/weather\.com/);
  });

  // Proves the test above isn't vacuously passing regardless of the
  // tooltip: fewer than the threshold, even with the same tooltip
  // interaction, must not redirect.
  test("2 Escapes with the Report-a-Bug tooltip open do not trigger the panic redirect", async ({
    page,
  }) => {
    await seedReturningUser(page);
    await stubWeatherRedirect(page);

    await openBugButtonTooltip(page);

    for (let i = 0; i < 2; i++) await page.keyboard.press("Escape");

    expect(await stillOnApp(page)).toBe(true);
  });
});

/**
 * Owner decision C, the mobile nav drawer specifically: Header.jsx marks it
 * role="dialog" aria-modal="true" (real accessibility semantics - focus
 * trap, background inertness, index.css's floating-widget-hiding rule) with
 * a useFocusTrap onEscape that closes it. Unlike a tool dialog, decision C
 * says a navigation menu/drawer's Escape counts toward the panic threshold -
 * safetyRedirect.js's DIALOG_SELECTOR excludes the drawer's own
 * data-vetrate-nav-menu marker from its "closed a tool dialog" exemption so
 * this holds. Phone viewport: the drawer trigger is `md:hidden`.
 */
test.describe("Triple-Escape vs. the mobile nav drawer (decision C)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  async function openMobileNavDrawer(page: Page): Promise<void> {
    await page.getByLabel("Toggle menu").click();
    await page
      .locator('[data-e2e-menu-panel="mobile-drawer"]')
      .waitFor({ state: "visible", timeout: 5000 });
  }

  test("drawer open, 3 Escapes 300ms apart triggers the panic redirect", async ({
    page,
  }) => {
    await seedReturningUser(page);
    await stubWeatherRedirect(page);

    await openMobileNavDrawer(page);

    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }

    await page.waitForURL(/weather\.com/, { timeout: 5000 });
    expect(page.url()).toMatch(/weather\.com/);
  });

  // Proves the test above isn't vacuously passing regardless of the drawer:
  // a single Escape must close the drawer (real dismissal, not swallowed)
  // and must not by itself trigger the redirect.
  test("drawer open, 1 Escape closes it without redirecting", async ({
    page,
  }) => {
    await seedReturningUser(page);
    await stubWeatherRedirect(page);

    await openMobileNavDrawer(page);

    await page.keyboard.press("Escape");
    await page
      .locator('[data-e2e-menu-panel="mobile-drawer"]')
      .waitFor({ state: "hidden", timeout: 5000 });

    expect(await stillOnApp(page)).toBe(true);
  });
});

/**
 * Owner decision C, Quick search specifically: GlobalCommandSearch.jsx marks
 * its palette role="dialog" aria-modal="true" aria-label="Quick search" for
 * real accessibility reasons (focus trap, background inertness) but it's a
 * search/navigation surface, not a tool dialog - same treatment as the
 * mobile nav drawer above. safetyRedirect.js's DIALOG_SELECTOR excludes its
 * own data-vetrate-nav-menu marker from the "closed a tool dialog" exemption
 * so this holds.
 */
test.describe("Triple-Escape vs. Quick search (decision C)", () => {
  async function openQuickSearch(page: Page): Promise<void> {
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("openGlobalCommandSearch")),
    );
    await page
      .getByRole("dialog", { name: "Quick search" })
      .waitFor({ state: "visible", timeout: 5000 });
  }

  test("Quick search open, 3 Escapes trigger the panic redirect", async ({
    page,
  }) => {
    await seedReturningUser(page);
    await stubWeatherRedirect(page);

    await openQuickSearch(page);

    for (let i = 0; i < 3; i++) await page.keyboard.press("Escape");

    await page.waitForURL(/weather\.com/, { timeout: 5000 });
    expect(page.url()).toMatch(/weather\.com/);
  });

  // Proves the test above isn't vacuously passing regardless of Quick
  // search: a single Escape must close the palette (real dismissal, not
  // swallowed) and must not by itself trigger the redirect.
  test("Quick search open, 1 Escape closes it without redirecting", async ({
    page,
  }) => {
    await seedReturningUser(page);
    await stubWeatherRedirect(page);

    await openQuickSearch(page);

    await page.keyboard.press("Escape");
    await page
      .getByRole("dialog", { name: "Quick search" })
      .waitFor({ state: "hidden", timeout: 5000 });

    expect(await stillOnApp(page)).toBe(true);
  });
});
