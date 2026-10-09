import { readFileSync } from "node:fs";
import { test, expect, Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

// Current release, read from package.json (Playwright's cwd is the repo root).
// Used by the returning-user fixture so the What's New modal stays closed.
const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

/**
 * Core Web Vitals gate (audit cycle S9–S17, Sprint 14). Reads the app's native
 * vitals buffer (window.__VITALS__, populated by src/utils/webVitals.js) under
 * the mobile-chrome (Pixel 5) project.
 *
 * What this gate proves — and what it deliberately does not:
 *   - CLS is layout-driven and deterministic regardless of CPU/network
 *     throttling, so CLS ≤ 0.1 is a HARD assertion here. This is the real
 *     signal that the S14 image width/height + aspect-ratio work landed.
 *   - LCP/INP *timing* under an un-throttled dev server is not a meaningful
 *     budget, so it is only smoke-checked (the pipeline emits, values are
 *     finite). The real throttled-mobile LCP/INP/TBT budgets are owned by the
 *     Lighthouse-CI gate (lighthouserc.json), not this spec.
 *
 * Honest limit: the layout-shift / largest-contentful-paint / event-timing
 * observers are Chromium-only, so this spec skips on Firefox.
 */

type VitalEntry = { name: string; value: number; rating: string; ts: number };

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "Core Web Vitals observers are Chromium-only",
);

/** Read the latest entry per metric from the app's native vitals buffer. */
async function readVitals(page: Page): Promise<Record<string, VitalEntry>> {
  return page.evaluate(() => {
    const out: Record<string, VitalEntry> = {};
    const buf = (window as unknown as { __VITALS__?: VitalEntry[] }).__VITALS__;
    for (const v of buf ?? []) out[v.name] = v;
    return out;
  });
}

/**
 * LCP, CLS and INP are emitted only when the page finalizes — the observers in
 * webVitals.js attach their emit to `visibilitychange`/`pagehide` (once).
 * Dispatching `pagehide` flushes all three into __VITALS__ mid-test.
 */
async function finalizeVitals(page: Page): Promise<void> {
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
}

test.describe("core web vitals @ mobile", () => {
  test.beforeEach(async ({ page }) => {
    // Returning-user fixture: clear every first-run overlay so the home surface
    // settles to its steady state before vitals are read (mirrors mobile.spec).
    await page.addInitScript((appVersion) => {
      localStorage.setItem("vet-rate-tos-accepted", "true");
      localStorage.setItem("vet_rate_last_seen_version", appVersion);
      localStorage.setItem("vetrate-tour-completed", "true");
      localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
      localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
    }, APP_VERSION);
    await page.goto("/");
    await dismissDisclaimer(page);
  });

  test("home reports CLS within budget", async ({ page }) => {
    // Settle the LCP hero (Header logo) and any deferred home content.
    await page
      .locator('img[src*="Vet-Rate-org-logo-official"]')
      .first()
      .waitFor({ state: "visible" });
    await page.waitForLoadState("networkidle");

    // A real interaction so INP has an event to measure — CustomEvent dispatches
    // are not event-timing entries. Clicking the heading is harmless.
    await page.locator("h1").first().click();

    await finalizeVitals(page);
    const v = await readVitals(page);

    // Hard gate: cumulative layout shift on the primary surface.
    expect(v.CLS, "CLS should be recorded").toBeTruthy();
    expect(v.CLS.value).toBeLessThanOrEqual(0.1);

    // Smoke: the vitals pipeline produced a paint metric (proves the wiring).
    expect(
      v.LCP ?? v.FCP,
      "an LCP or FCP metric should be recorded",
    ).toBeTruthy();

    // INP, when the interaction registered one, must stay within a generous dev
    // ceiling. The real throttled-mobile budget lives in lighthouserc.json.
    if (v.INP) expect(v.INP.value).toBeLessThanOrEqual(1000);
  });

  test("About gallery images reserve layout space (no load-time shift)", async ({
    page,
  }) => {
    // alt is used (not src) so the AboutUs photos are not confused with the
    // small Anth.jpg avatars that share the same file elsewhere.
    const GALLERY = [
      { alt: "Veteran in military uniform", w: 435, h: 604 },
      { alt: "Luna the calico cat - portrait", w: 1750, h: 2048 },
      { alt: "Luna supervising coding at the workstation", w: 2048, h: 1536 },
      { alt: "Luna taking a well-deserved nap", w: 2048, h: 1536 },
    ];

    // About mounts lazily; re-fire its open event until the first photo is in the DOM.
    await expect
      .poll(
        async () => {
          await page.evaluate(() =>
            window.dispatchEvent(new CustomEvent("openAboutUs")),
          );
          return page.locator('img[alt="Veteran in military uniform"]').count();
        },
        { timeout: 6000 },
      )
      .toBeGreaterThan(0);

    // The three Luna photos live inside a collapsed <details>; open every gallery.
    await page.evaluate(() =>
      document
        .querySelectorAll("details")
        .forEach((d) => ((d as HTMLDetailsElement).open = true)),
    );

    for (const g of GALLERY) {
      const img = page.locator(`img[alt="${g.alt}"]`).first();
      await img.waitFor({ state: "attached" });
      const box = await img.evaluate((el) => {
        const i = el as HTMLImageElement;
        const r = i.getBoundingClientRect();
        return {
          width: r.width,
          height: r.height,
          attrW: i.getAttribute("width"),
          attrH: i.getAttribute("height"),
        };
      });

      // Intrinsic dimensions are declared so the browser reserves the box…
      expect(box.attrW).toBe(String(g.w));
      expect(box.attrH).toBe(String(g.h));
      // …and the rendered box already honors that ratio before the bitmap loads,
      // which is exactly what prevents a layout shift when it does.
      expect(box.width).toBeGreaterThan(0);
      const expectedHeight = box.width * (g.h / g.w);
      expect(Math.abs(box.height - expectedHeight)).toBeLessThanOrEqual(2);
    }
  });
});
