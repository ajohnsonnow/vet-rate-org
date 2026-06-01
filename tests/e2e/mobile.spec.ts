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

/**
 * Modals migrated to the ResponsiveModal shell (S10, Cluster A). Beyond the
 * overflow check these assert the shell's contract: a sticky footer whose
 * primary CTA stays inside the viewport at every baseline (no scroll-to-submit).
 */
const MIGRATED_MODALS = [
  { label: "Privacy Policy", event: "openPrivacyPolicy" },
  { label: "Contact Us", event: "openContactUs" },
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

/**
 * Inspect the open ResponsiveModal, located by its unique `.modal-footer`. Returns
 * the panel's worst right-edge overflow plus the sticky-footer contract: a button
 * exists and its bottom stays within the viewport (no scroll-to-submit on mobile).
 */
async function inspectResponsiveModal(page: Page): Promise<{
  found: boolean;
  overflow: number;
  hasButton: boolean;
  ctaInViewport: boolean;
}> {
  return page.evaluate(() => {
    const footer = document.querySelector(".modal-footer");
    const panel = footer?.closest('[role="dialog"]');
    if (!footer || !panel)
      return {
        found: false,
        overflow: 0,
        hasButton: false,
        ctaInViewport: false,
      };

    const vw = window.innerWidth;
    let worst = 0;
    panel.querySelectorAll("*").forEach((el) => {
      if (el.getAttribute("aria-hidden") === "true") return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.right > vw + 1) worst = Math.max(worst, r.right - vw);
    });

    const fr = footer.getBoundingClientRect();
    return {
      found: true,
      overflow: Math.round(worst),
      hasButton: footer.querySelector("button") !== null,
      ctaInViewport: fr.bottom <= window.innerHeight + 1,
    };
  });
}

for (const vp of VIEWPORTS) {
  test.describe(`mobile @ ${vp.width}px (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      // Pre-dismiss the <640px SmallScreenWarning so the gate measures the real
      // app, not the warning overlay (which would otherwise sit at z-[100] over
      // every modal and race the lazy chunk load). Mirrors a real mobile user
      // tapping "Continue Anyway"; becomes a no-op once the warning is removed.
      await page.addInitScript(() => {
        sessionStorage.setItem("vetrate-small-screen-dismissed", "true");
      });
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

    for (const modal of MIGRATED_MODALS) {
      test(`${modal.label} (ResponsiveModal) keeps its CTA in view`, async ({
        page,
      }) => {
        await page.evaluate((evt) => {
          window.dispatchEvent(new CustomEvent(evt));
        }, modal.event);

        await expect
          .poll(async () => (await inspectResponsiveModal(page)).found, {
            timeout: 6000,
          })
          .toBe(true);

        const m = await inspectResponsiveModal(page);
        expect(m.overflow).toBeLessThanOrEqual(1);
        expect(m.hasButton).toBe(true);
        expect(m.ctaInViewport).toBe(true);
        expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
      });
    }
  });
}
