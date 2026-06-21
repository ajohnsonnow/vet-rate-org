/**
 * Sprint 6 — Affiliation-palette axe coverage (e2e).
 *
 * For every palette × {light, dark} combination the home view is scanned by
 * axe under the same severity gate (serious + critical, WCAG 2.0/2.1/2.2 A +
 * AA) used by axe.spec.ts. color-contrast IS evaluated — it is the primary
 * purpose of this suite, catching real-DOM contrast that jsdom-based unit tests
 * cannot see. Palettes that only apply in plain light/dark modes are the scope
 * here; TBI, AAA, and colorblind modes suppress palettes by design
 * (ThemeContext.jsx line 109) and are tested in the existing axe.spec.ts.
 *
 * Additionally, two representative modals are scanned under two palettes
 * (pride + army) in both modes, matching the approach in axe.spec.ts.
 *
 * COVERED palettes (ALL 16, plus "default" as baseline):
 *   army, navy, air-force, marines, coast-guard, space-force,
 *   national-guard, reserves, pride, flag, pow-mia, gold-star,
 *   purple-heart, women-veterans, juneteenth, native-code-talker.
 *
 * SKIPPED: none — all 16 are included. Runtime budget: 16 palettes × 2 modes
 * = 32 home scans + 4 modal scans = 36 total; each axe pass is ~1-3 s in
 * Chromium, so total wall time is expected to be 1-3 min on a local machine.
 */

import { readFileSync } from "node:fs";
import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { dismissDisclaimer } from "./helpers";

// ── Constants (mirror axe.spec.ts exactly) ────────────────────────────────────

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const BLOCKING_IMPACTS = new Set(["serious", "critical"]);

// ── Palette registry (all 16 non-default ids) ─────────────────────────────────

const ALL_PALETTE_IDS = [
  "army",
  "navy",
  "air-force",
  "marines",
  "coast-guard",
  "space-force",
  "national-guard",
  "reserves",
  "pride",
  "flag",
  "pow-mia",
  "gold-star",
  "purple-heart",
  "women-veterans",
  "juneteenth",
  "native-code-talker",
] as const;

type PaletteId = (typeof ALL_PALETTE_IDS)[number];
type ThemeMode = "light" | "dark";

// Modals to scan under selected palettes — reuse the window-event pattern from
// axe.spec.ts. One surface from each of two distinct feature areas.
const PALETTE_MODAL_SURFACES = [
  { label: "Privacy Policy", event: "openPrivacyPolicy" },
  { label: "VSO Finder", event: "openVSOFinder" },
];

// Palettes selected for modal scanning (one inclusive + one branch).
const MODAL_SCAN_PALETTES: PaletteId[] = ["pride", "army"];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Human-readable one-liner per violation — mirrors axe.spec.ts. */
function summarize(
  violations: {
    id: string;
    impact?: string | null;
    help: string;
    nodes: { html: string }[];
  }[],
): string {
  if (violations.length === 0) return "no serious/critical violations";
  return violations
    .map(
      (v) =>
        `  • ${v.id} [${v.impact}] ×${v.nodes.length} — ${v.help}\n` +
        v.nodes
          .slice(0, 3)
          .map((n) => `    node: ${n.html.slice(0, 120)}`)
          .join("\n"),
    )
    .join("\n");
}

/**
 * Boot into a returning-user state with a specific palette + theme mode already
 * set in localStorage via addInitScript (runs before any app JS executes).
 *
 * ThemeContext.jsx reads vet-rate-palette and vet-rate-theme at useState init
 * time (lines 35-48, 59-62); because the useEffect that writes to the DOM runs
 * synchronously after mount, the palette-<id> class and the mode class are both
 * present before the first paint. We verify this after page.goto() before
 * running axe so the suite never silently test the wrong state.
 *
 * vet-rate-color-blind-mode must be absent (or "none") so ThemeContext does not
 * suppress the palette class (ThemeContext.jsx line 109).
 */
async function bootWithPalette(
  page: Page,
  paletteId: string,
  mode: ThemeMode,
): Promise<void> {
  await page.addInitScript(
    ({ appVersion, paletteId, mode }) => {
      // Returning-user suppressions (mirrors axe.spec.ts bootReturningUser)
      localStorage.setItem("vet-rate-tos-accepted", "true");
      localStorage.setItem("vet_rate_last_seen_version", appVersion);
      localStorage.setItem("vetrate-tour-completed", "true");
      localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
      // Palette + theme — set before the app reads localStorage
      localStorage.setItem("vet-rate-palette", paletteId);
      localStorage.setItem("vet-rate-theme", mode);
      // Ensure colorblind mode is off so the palette class is not suppressed
      localStorage.setItem("vet-rate-color-blind-mode", "none");

      // Pre-seed the IndexedDB→localStorage migration flag (src/utils/storage.js
      // MIGRATION_KEY) in idb-keyval's default store ("keyval-store"/"keyval").
      // Because vet-rate-tos-accepted is present, needsMigration() would otherwise
      // return true and the app renders <MigrationScreen> while migrating — in an
      // isolated/cold run that races the modal-open dispatch, so AppModals never
      // mounts and dialogs never appear. Seeding the flag skips migration entirely.
      const req = indexedDB.open("keyval-store");
      req.onupgradeneeded = () => req.result.createObjectStore("keyval");
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction("keyval", "readwrite");
          tx.objectStore("keyval").put("true", "vet_rate_migrated_to_indexeddb");
          tx.oncomplete = () => db.close();
        } catch {
          /* store missing on first open is handled by onupgradeneeded */
        }
      };
    },
    { appVersion: APP_VERSION, paletteId, mode },
  );
  // networkidle ensures the Vite dev server has finished serving all chunks
  // and the IDB migration async work has settled before we assert or dispatch.
  await page.goto("/", { waitUntil: "networkidle" });
  await dismissDisclaimer(page);
  // Settle async content (e.g. the DKB stat counter loads after networkidle).
  // Without this, the baseline-relative diff can flake when the counter is in a
  // different state between the default-baseline load and a palette load.
  await page.waitForTimeout(1200);
}

/**
 * Assert the <html> element carries both palette-<id> and the mode class.
 * If either is missing axe would be scanning the wrong state — fail fast.
 */
async function assertHtmlClasses(
  page: Page,
  paletteId: string,
  mode: ThemeMode,
): Promise<void> {
  const htmlClasses = await page.evaluate(
    () => document.documentElement.className,
  );
  const paletteClass = `palette-${paletteId}`;
  expect(
    htmlClasses,
    `html should carry "${paletteClass}" but has: "${htmlClasses}"`,
  ).toContain(paletteClass);
  expect(
    htmlClasses,
    `html should carry "${mode}" class but has: "${htmlClasses}"`,
  ).toContain(mode);
}

/**
 * Open a modal by window event, polling until a dialog appears.
 * Direct copy of the pattern in axe.spec.ts (openModalByEvent + retry wrapper).
 */
async function openModalByEvent(page: Page, event: string): Promise<void> {
  await expect
    .poll(
      async () => {
        await page.evaluate((evt) => {
          window.dispatchEvent(new CustomEvent(evt));
        }, event);
        return page.locator('[role="dialog"]').count();
      },
      { timeout: 15000 },
    )
    .toBeGreaterThan(0);

  const dialog = page.locator('[role="dialog"]').last();
  await dialog.waitFor({ state: "visible" });
  await dialog
    .locator("button, a, h1, h2, h3, input, [role='button']")
    .first()
    .waitFor({ state: "visible" });
}

async function scanDialogViolations(
  page: Page,
  event: string,
): Promise<
  { id: string; impact?: string | null; help: string; nodes: { html: string }[] }[]
> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    await openModalByEvent(page, event);
    try {
      const results = await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withTags(WCAG_TAGS)
        .analyze();
      return results.violations.filter((v) =>
        BLOCKING_IMPACTS.has(v.impact ?? ""),
      ) as { id: string; impact?: string | null; help: string; nodes: { html: string }[] }[];
    } catch (err) {
      if (!String(err).includes("No elements found for include")) throw err;
      lastError = err;
    }
  }
  throw lastError;
}

// ── Test suites ───────────────────────────────────────────────────────────────

/**
 * Home page — all 16 palettes × {light, dark}.
 *
 * Gate is BASELINE-RELATIVE: a palette must introduce no NEW serious/critical
 * violation beyond what the `default` palette already shows in the same mode.
 * This isolates palette regressions from pre-existing home-page issues (the app
 * has ~12 pre-existing light-mode contrast bugs unrelated to affiliation theming,
 * present even with `default`). A palette that recolors the brand surface must not
 * add any violation a veteran wouldn't already hit on the default theme.
 */
const violationSignatures = (violations: { id: string; impact?: string | null; nodes: { target: unknown[] }[] }[]): Set<string> => {
  const sigs = new Set<string>();
  for (const v of violations) {
    if (!BLOCKING_IMPACTS.has(v.impact ?? "")) continue;
    for (const n of v.nodes) sigs.add(`${v.id}|${JSON.stringify(n.target)}`);
  }
  return sigs;
};

test.describe("axe palette: home page — all palettes × light/dark", () => {
  // Per-mode baseline = the `default` palette's blocking-violation signatures.
  const baseline: Record<ThemeMode, Set<string>> = { light: new Set(), dark: new Set() };

  test.beforeAll(async ({ browser }) => {
    // Two full page loads + axe scans; comfortably over the default 30s hook budget.
    test.setTimeout(120_000);
    for (const mode of ["light", "dark"] as ThemeMode[]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await bootWithPalette(page, "default", mode);
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      baseline[mode] = violationSignatures(results.violations);
      await context.close();
    }
  });

  for (const paletteId of ALL_PALETTE_IDS) {
    for (const mode of ["light", "dark"] as ThemeMode[]) {
      test(`palette=${paletteId} mode=${mode}`, async ({ page }) => {
        await bootWithPalette(page, paletteId, mode);
        await assertHtmlClasses(page, paletteId, mode);

        const results = await new AxeBuilder({ page })
          .withTags(WCAG_TAGS)
          .analyze();
        const blocking = results.violations.filter((v) =>
          BLOCKING_IMPACTS.has(v.impact ?? ""),
        );
        // New = signatures not present in the default baseline for this mode.
        const novel = blocking.filter(
          (v) =>
            !v.nodes.every((n) =>
              baseline[mode].has(`${v.id}|${JSON.stringify(n.target)}`),
            ),
        );
        expect(
          novel,
          `palette=${paletteId} mode=${mode} introduced NEW violations beyond default:\n${summarize(novel as Parameters<typeof summarize>[0])}`,
        ).toEqual([]);
      });
    }
  }
});

/**
 * Modal surfaces — 2 palettes (pride, army) × 2 modals × {light, dark}.
 *
 * bootWithPalette() seeds the IndexedDB migration flag so the app skips the
 * <MigrationScreen> and mounts AppModals immediately — without that, an isolated
 * cold run leaves the modal-open event with no listener and the dialog never
 * appears (the pre-existing harness race noted in Sprint 6, now fixed here).
 *
 * Gate is BASELINE-RELATIVE (same rationale as the home suite): a palette must add
 * no NEW serious/critical violation beyond what the default palette already shows
 * in the same modal + mode.
 */
test.describe("axe palette: modal surfaces — pride + army × light/dark", () => {
  // Baseline per `${event}|${mode}` from the default palette's modal scan.
  const modalBaseline: Record<string, Set<string>> = {};

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000);
    for (const mode of ["light", "dark"] as ThemeMode[]) {
      for (const surface of PALETTE_MODAL_SURFACES) {
        const context = await browser.newContext();
        const page = await context.newPage();
        await bootWithPalette(page, "default", mode);
        const blocking = await scanDialogViolations(page, surface.event);
        modalBaseline[`${surface.event}|${mode}`] = violationSignatures(
          blocking as Parameters<typeof violationSignatures>[0],
        );
        await context.close();
      }
    }
  });

  for (const paletteId of MODAL_SCAN_PALETTES) {
    for (const mode of ["light", "dark"] as ThemeMode[]) {
      for (const surface of PALETTE_MODAL_SURFACES) {
        test(`palette=${paletteId} mode=${mode} modal=${surface.label}`, async ({
          page,
        }) => {
          await bootWithPalette(page, paletteId, mode);
          await assertHtmlClasses(page, paletteId, mode);
          const blocking = await scanDialogViolations(page, surface.event);
          const base = modalBaseline[`${surface.event}|${mode}`] ?? new Set();
          const novel = blocking.filter(
            (v) =>
              !v.nodes.every((n) =>
                base.has(`${v.id}|${JSON.stringify((n as { target?: unknown }).target)}`),
              ),
          );
          expect(
            novel,
            `palette=${paletteId} mode=${mode} modal=${surface.label} introduced NEW violations beyond default:\n${summarize(novel)}`,
          ).toEqual([]);
        });
      }
    }
  }
});
