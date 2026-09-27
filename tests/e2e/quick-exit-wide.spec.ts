import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test, expect, Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

/**
 * Quick Exit vs. dialog headers, at desktop/wide widths (C, QA S46
 * follow-up). mobile.spec.ts already covers 320-430px (QUICK_EXIT_VIEWPORTS)
 * and one 1440x900 sample (BYPASS_TEST_VIEWPORTS); this file is the
 * dedicated sm+/wide sweep the reviewer's 1024x768 finding asked for -
 * every width from 640 to 1920 at the eight representative width/height
 * pairs QA hit-tested, continuous coverage being impractical to run.
 */
const WIDE_VIEWPORTS = [
  { width: 640, height: 800 },
  { width: 768, height: 1024 },
  { width: 820, height: 1180 },
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

const QUICK_EXIT_SELECTOR =
  'button[aria-label="Quick exit - immediately leave this page"]';
const DIALOG_SELECTOR =
  '[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]';

type Rect = { left: number; top: number; right: number; bottom: number };

function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  );
}

/**
 * Feature-flagged `open*` events that never register a listener in the
 * default build (VaDemoTools gates both behind `isVaApiEnabled()`,
 * VITE_VA_API_ENABLED off by default - see mobile.spec.ts's own "Not
 * listed" precedent for the same two events). Dispatching either here
 * would just time out waiting for a dialog that can never mount, which is
 * a test-harness false failure, not a Quick Exit defect.
 */
const BUILD_GATED_EVENTS = new Set([
  "openDemoDashboard",
  "openVaIntegrationDemo",
]);

/**
 * Recursively collects every `window.addEventListener("open...")` event
 * name declared in `src/`, straight from the source tree rather than a
 * hand-kept list - a new tool's open* listener is picked up automatically
 * the next time this file runs. (True DOM enumeration at test-collection
 * time isn't available: Playwright's `test()` calls must be registered
 * synchronously at module load, before any browser exists to inspect.)
 */
function discoverOpenEventNames(dir: string, out: Set<string>): void {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      discoverOpenEventNames(full, out);
      continue;
    }
    if (!/\.(jsx?|mjs)$/.test(entry)) continue;
    const text = readFileSync(full, "utf-8");
    for (const m of text.matchAll(
      /addEventListener\(\s*["'](open[A-Za-z0-9]+)["']/g,
    )) {
      out.add(m[1]);
    }
  }
}

function toolGridEvents(): string[] {
  const names = new Set<string>();
  discoverOpenEventNames(join(process.cwd(), "src"), names);
  return [...names].filter((n) => !BUILD_GATED_EVENTS.has(n)).sort();
}

type Trigger = { label: string; dispatch: (page: Page) => Promise<void> };

/**
 * Every dialog-opening trigger this sweep exercises: the full
 * source-scanned tool-grid inventory, plus two triggers that don't fit the
 * bare `open*` shape the scan above can find:
 *
 * - CrisisModal (named in the D requirement): `vetrate:crisis`, always
 *   carries a detail payload.
 * - NexusBuilder with a condition already chosen: a bare `openNexusBuilder`
 *   (already covered by the scan) only ever mounts its condition-picker
 *   step. `NexusHeaderBar` - the header actually restructured most
 *   recently - only mounts once `detail.condition` is set (see
 *   DiscoverCluster.jsx / PathfinderModal.jsx), so the auto-discovered
 *   trigger alone never exercises it.
 *
 * ClaimNavigator/UserManual/AboutUs/MyPacket (also named) already surface
 * through their real `openX` events.
 */
function buildTriggers(): Trigger[] {
  const triggers: Trigger[] = toolGridEvents().map((event) => ({
    label: event,
    dispatch: (page) =>
      page.evaluate((evt) => {
        window.dispatchEvent(new CustomEvent(evt));
      }, event),
  }));
  triggers.push({
    label: "vetrate:crisis (Crisis Modal)",
    dispatch: (page) =>
      page.evaluate(() => {
        window.dispatchEvent(
          new CustomEvent("vetrate:crisis", {
            detail: { severity: "high", source: "e2e" },
          }),
        );
      }),
  });
  triggers.push({
    label: "openNexusBuilder (with condition, NexusHeaderBar)",
    dispatch: (page) =>
      page.evaluate(() => {
        window.dispatchEvent(
          new CustomEvent("openNexusBuilder", {
            detail: {
              condition: "Tinnitus",
              primaryCondition: null,
              existingStatement: null,
            },
          }),
        );
      }),
  });
  return triggers;
}

async function bootReturningUser(page: Page): Promise<void> {
  await page.addInitScript((appVersion) => {
    localStorage.setItem("vet-rate-tos-accepted", "true");
    localStorage.setItem("vet_rate_last_seen_version", appVersion);
    localStorage.setItem("vetrate-tour-completed", "true");
    localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
    localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
  }, APP_VERSION);
  await page.goto("/");
  await dismissDisclaimer(page);
}

/**
 * Fires `dispatch` on every poll tick until a dialog is in the DOM. The
 * owning feature clusters are lazy-loaded and the whole app additionally
 * sits behind a one-time IndexedDB-migration boot gate on a fresh profile
 * (`useBootSequence` / MigrationScreen.jsx intentionally unmounts
 * everything else while it runs - see the Vision Simulator (D)
 * investigation), so a single, non-retried dispatch is a real, if narrow,
 * race - not a Quick Exit defect. Re-dispatching is safe: every handler
 * here is an idempotent "show" toggle.
 */
async function openDialog(
  page: Page,
  dispatch: (page: Page) => Promise<void>,
): Promise<void> {
  await expect
    .poll(
      async () => {
        await dispatch(page);
        return page.locator(DIALOG_SELECTOR).count();
      },
      // 30s, not the usual 15s: the very first batch of workers in a full
      // suite run all cold-start against the same freshly-launched dev
      // server at once, stacking the migration/DKB-download delay on top
      // of ordinary lazy-mount timing (see the Vision Simulator (D)
      // writeup) worse than any single spec file running alone ever hits.
      { timeout: 30000 },
    )
    .toBeGreaterThan(0);
}

type DialogProbe = {
  found: boolean;
  titleRect: Rect | null;
  closeRect: Rect | null;
  buttonRects: Rect[];
  closeHit: { center: boolean; topEdge: boolean };
};

/**
 * One round trip that reads whatever dialog is currently open: its title
 * (by `aria-labelledby`, falling back to the first heading), its close/exit
 * control (by aria-label, mirroring mobile.spec.ts's own probeOpenDialog),
 * every button's rect (the header-controls sweep, not a hand-picked "close
 * button" per dialog since header layouts vary per tool), and two
 * elementFromPoint hit-tests against the close control - its own center,
 * and 1px inside its top edge (the exact edge QA found Quick Exit stealing
 * taps from at 1024x768; a center-only hit-test can pass while the top
 * sliver still resolves to Quick Exit).
 */
async function probeDialog(page: Page): Promise<DialogProbe> {
  return page.evaluate((sel) => {
    const dialog = document.querySelector(sel) as HTMLElement | null;
    if (!dialog) {
      return {
        found: false,
        titleRect: null,
        closeRect: null,
        buttonRects: [],
        closeHit: { center: false, topEdge: false },
      };
    }

    const rectOf = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };

    const labelledBy = dialog.getAttribute("aria-labelledby");
    const titleEl =
      (labelledBy && document.getElementById(labelledBy)) ||
      dialog.querySelector("h1, h2, h3");
    const titleRect =
      titleEl && titleEl.getBoundingClientRect().width > 0
        ? rectOf(titleEl)
        : null;

    const buttons = Array.from(dialog.querySelectorAll("button"));
    const buttonRects = buttons
      .map((b) => b.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
      }));

    // Visible-only: some dialogs (e.g. UserManual) render two
    // close-labelled buttons - one `md:hidden` mobile close-X and one
    // desktop one - and an invisible button's collapsed [0,0,0,0] rect
    // would otherwise win by DOM order and fail every hit-test regardless
    // of the real, visible close-X's position.
    const closeBtn = buttons.find((b) => {
      if (!/close|exit/i.test(b.getAttribute("aria-label") || "")) return false;
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    const closeRect = closeBtn ? rectOf(closeBtn) : null;

    let closeHit = { center: false, topEdge: false };
    if (closeBtn && closeRect) {
      const cx = closeRect.left + (closeRect.right - closeRect.left) / 2;
      const cy = closeRect.top + (closeRect.bottom - closeRect.top) / 2;
      closeHit = {
        center: closeBtn.contains(document.elementFromPoint(cx, cy)),
        topEdge: closeBtn.contains(
          document.elementFromPoint(cx, closeRect.top + 1),
        ),
      };
    }

    return { found: true, titleRect, closeRect, buttonRects, closeHit };
  }, DIALOG_SELECTOR);
}

async function elementRect(page: Page, selector: string): Promise<Rect | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  }, selector);
}

type DialogReading = { probe: DialogProbe; qeRect: Rect | null };

/**
 * Re-dispatches and re-probes until the dialog and Quick Exit are both
 * present AND two consecutive reads agree, rather than trusting whatever
 * the first successful read happens to show. Two distinct races justify
 * this: the app's one-time IndexedDB-migration boot gate can unmount and
 * remount the whole shell (dialog *and* Quick Exit) a moment after it first
 * appears on a slow/loaded machine (see the Vision Simulator (D) writeup),
 * and a dialog whose content is still loading/growing can hand back a
 * transient layout that happens to clear Quick Exit on one tick and not the
 * next (measured: a single-read version of this check passed VKBViewer 1
 * run in 3 against code with a real, reproducible overlap). `expect.poll`'s
 * own interval is the only wait here - no fixed sleep.
 */
async function probeAfterOpen(
  page: Page,
  dispatch: (page: Page) => Promise<void>,
): Promise<DialogReading> {
  let previous: DialogReading | null = null;

  await expect
    .poll(
      async () => {
        await dispatch(page);
        const current: DialogReading = {
          probe: await probeDialog(page),
          qeRect: await elementRect(page, QUICK_EXIT_SELECTOR),
        };
        const stable =
          previous !== null &&
          JSON.stringify(current) === JSON.stringify(previous);
        previous = current;
        return current.probe.found && current.qeRect !== null && stable;
      },
      { timeout: 15_000 },
    )
    .toBe(true);

  return previous as DialogReading;
}

/**
 * Quick Exit must stay one tap away: `toBeVisible()` alone can't tell a
 * button apart from something opaque covering it (ResponsiveModal takes a
 * `zIndex` prop, so a future dialog above Quick Exit's z-index would still
 * read "visible"). This hit-tests Quick Exit's own center the same way
 * `probeDialog` hit-tests a dialog's close button.
 */
async function assertQuickExitOnTop(page: Page, qeRect: Rect): Promise<void> {
  const onTop = await page.evaluate(
    ({ selector, cx, cy }) => {
      const qe = document.querySelector(selector);
      return !!qe && qe.contains(document.elementFromPoint(cx, cy));
    },
    {
      selector: QUICK_EXIT_SELECTOR,
      cx: (qeRect.left + qeRect.right) / 2,
      cy: (qeRect.top + qeRect.bottom) / 2,
    },
  );
  expect(onTop).toBe(true);
}

async function assertQuickExitClearOfDialog(
  page: Page,
  dispatch: (page: Page) => Promise<void>,
): Promise<void> {
  const { probe, qeRect } = await probeAfterOpen(page, dispatch);
  expect(probe.found).toBe(true);
  expect(qeRect).not.toBeNull();
  expect(qeRect!.bottom - qeRect!.top).toBeGreaterThanOrEqual(43.5);

  if (probe.titleRect) {
    expect(rectsIntersect(qeRect!, probe.titleRect)).toBe(false);
  }
  for (const btnRect of probe.buttonRects) {
    expect(rectsIntersect(qeRect!, btnRect)).toBe(false);
  }

  if (probe.closeRect) {
    expect(probe.closeHit.center).toBe(true);
    expect(probe.closeHit.topEdge).toBe(true);
  }

  await expect(page.locator(QUICK_EXIT_SELECTOR)).toBeVisible();
  await assertQuickExitOnTop(page, qeRect!);
}

const TRIGGERS = buildTriggers();

for (const vp of WIDE_VIEWPORTS) {
  test.describe(`Quick Exit vs dialogs @ ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      await bootReturningUser(page);
    });

    for (const trigger of TRIGGERS) {
      const title = `${trigger.label}: Quick Exit never overlaps the dialog's title/header controls`;
      test(title, async ({ page }) => {
        // Default 30s test timeout can't cover openDialog's own 30s worst
        // case plus assertQuickExitClearOfDialog's follow-up retry budget.
        test.setTimeout(60000);
        await openDialog(page, trigger.dispatch);
        await assertQuickExitClearOfDialog(page, trigger.dispatch);
      });
    }
  });
}
