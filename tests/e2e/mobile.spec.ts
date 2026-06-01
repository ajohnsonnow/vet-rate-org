import { test, expect, Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

/**
 * Mobile layout gate (audit cycle S9–S17). Validates the S9 safety-net on the
 * three owner-specified baselines: 360px (small Android), 390px (iPhone), and
 * 768px (tablet edge). S9 scope = Home + the three worst modals; S10 promotes
 * this to a blocking CI job once the full modal set is migrated.
 *
 * Honest limit: real iOS Safari URL-bar / notch behaviour and screen-reader
 * gestures are owner-run manual checks, not covered here.
 */

const VIEWPORTS = [
  { name: "small-android", width: 360, height: 740 },
  { name: "iphone", width: 390, height: 844 },
  { name: "tablet-edge", width: 768, height: 1024 },
];

const MODALS = [
  { label: "My Packet", event: "openMyPacket" },
  { label: "Tactical Calculator", event: "openTacticalCalculator" },
  { label: "Workflow Guide", event: "openWorkflowGuide" },
];

/** Horizontal overflow of the document, in px (<= 1 is clean). */
async function pageOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.documentElement;
    return Math.round(el.scrollWidth - el.clientWidth);
  });
}

/** Worst right-edge overflow of any visible descendant of the topmost overlay. */
async function overlayOverflow(
  page: Page,
): Promise<{ found: boolean; overflow: number }> {
  return page.evaluate(() => {
    const overlays = Array.from(
      document.querySelectorAll('[role="dialog"], .fixed.inset-0'),
    ).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (overlays.length === 0) return { found: false, overflow: 0 };

    const overlay = overlays[overlays.length - 1];
    const vw = window.innerWidth;
    let worst = 0;
    overlay.querySelectorAll("*").forEach((el) => {
      if (el.getAttribute("aria-hidden") === "true") return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.right > vw + 1) worst = Math.max(worst, r.right - vw);
    });
    return { found: true, overflow: Math.round(worst) };
  });
}

for (const vp of VIEWPORTS) {
  test.describe(`mobile @ ${vp.width}px (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      await page.goto("/");
      await dismissDisclaimer(page);
    });

    test("home renders without horizontal overflow", async ({ page }) => {
      expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
    });

    for (const modal of MODALS) {
      test(`${modal.label} modal fits the viewport`, async ({ page }) => {
        await page.evaluate((evt) => {
          window.dispatchEvent(new CustomEvent(evt));
        }, modal.event);

        await expect
          .poll(async () => (await overlayOverflow(page)).found, {
            timeout: 6000,
          })
          .toBe(true);

        const { overflow } = await overlayOverflow(page);
        expect(overflow).toBeLessThanOrEqual(1);
        expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
      });
    }
  });
}
