import { readFileSync } from "node:fs";
import { test, expect, Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

// Current release, read from package.json (Playwright's cwd is the repo root).
// The "returning user" fixture below marks this version as already-seen so the
// What's New modal stays closed.
const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

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
  { label: "Time Machine", event: "openTimeMachine" },
  // Cluster B (S10): rich-header / no-max-h modals migrated to the shell. These
  // keep their action bar in the body (permanently-dark panels whose theming
  // would clash with the shell's light footer slot), so they assert the overflow
  // contract rather than the sticky-footer-CTA one.
  { label: "Mission Protocol", event: "openMissionProtocol" },
  { label: "Retro Pay Hunter", event: "openRetroPayHunter" },
  // Cluster C2 (S10): dark-panel / nested-child tools migrated to the shell.
  // Footerless (their actions live in-body), so they assert the overflow
  // contract rather than the sticky-footer-CTA one. Their nested children clear
  // the z-60 shell — VAGovRatingPaster already paints at z-100; RegulationsRef,
  // AIConsentModal, DoctorsPacket and the BuyMeCoffee/Luna popups are wrapped in
  // a `relative z-[70]` lift.
  { label: "MOS Hazard Matcher", event: "openMOSHazardMatcher" },
  { label: "Million Dollar Dashboard", event: "openMillionDollarDashboard" },
  { label: "Secondary Scout Launcher", event: "openSecondaryScoutLauncher" },
  { label: "VA Resources", event: "openVAResources" },
  // Not listed: NexusBuilder (openNexusBuilder) — migrated to the shell, but
  // DiscoverCluster renders it only once `nexusBuilderData` is set from the event
  // detail (`showNexusBuilder && nexusBuilderData`), so a bare event never mounts
  // it. It is exercised via the Secondary Scout "Learn how" flow manually.
  // Not listed: DemoDashboard (openDemoDashboard) + VaIntegrationTest
  // (openVaIntegrationDemo) — both were migrated to the shell, but VaDemoTools
  // gates them behind `isVaApiEnabled()` (build-time VITE_VA_API_ENABLED, off by
  // default), so they never mount in the standard build this gate runs against.
  // They are exercised manually in a VA-demo build.
  // Cluster D1 (S10): multi-step wizards migrated to the shell. Their step nav
  // (Back/Continue/Submit) lives per-step inside the scroll body, not a single
  // shared footer, so they assert the overflow contract (no .modal-footer slot).
  // The BuyMeCoffee/Luna popups in TDIU, BDD, PACT and FOIA are wrapped in a
  // `relative z-[70]` lift to clear the z-60 shell.
  { label: "TDIU Builder", event: "openTDIUBuilder" },
  { label: "BDD Builder", event: "openBDDBuilder" },
  { label: "Witness Bench", event: "openWitnessBench" },
  { label: "PACT Act Navigator", event: "openPACTActNavigator" },
  { label: "Risk Assessment", event: "openRiskAssessment" },
  { label: "FOIA Generator", event: "openFOIAGenerator" },
  // Cluster D2 (S10): FormsHelper migrated to the shell. Its only footer content
  // is a privacy note — no CTA button — so it asserts the overflow contract here
  // rather than the sticky-footer-CTA one. The BuyMeCoffee/Luna popup and the
  // AIConsentModal gate are lifted to `relative z-[70]` siblings to clear the
  // z-60 shell. (DD214Analyzer, the other D2 tool, has a real action bar and so
  // lives in MIGRATED_MODALS below.)
  { label: "Forms Helper", event: "openFormsHelper" },
  // Cluster E (S10): wide-table / page-scroll tools migrated to size="full".
  // RecordSearch and ConsistencyEngine are permanently-dark, header-close-only
  // panels (no footer slot). CFileAnalyzer and MusterCall do render a footer
  // slot, but its only always-present content is disclaimer text / a mode-status
  // line — their real CTAs are conditional (a file must be dropped first) and so
  // are absent on fresh open. All four therefore assert the overflow contract
  // here. CFileAnalyzer's mandatory privacy-consent gate is lifted to a
  // `relative z-[70]` sibling to clear the z-60 shell.
  // Not listed: Secondary Scout *results* (the SecondaryScout body modal in
  // DiscoverCluster) — also migrated to size="full", but it mounts only after
  // the Secondary Scout Launcher's onLaunch picks conditions (no bare event sets
  // `showSecondaryScout`), so it is exercised via that flow manually.
  { label: "Record Search", event: "openRecordSearch" },
  { label: "Consistency Engine", event: "openConsistencyEngine" },
  { label: "C-File Analyzer", event: "openCFileAnalyzer" },
  { label: "Muster Call", event: "openMusterCall" },
];

/**
 * Modals migrated to the ResponsiveModal shell (S10, Cluster A). Beyond the
 * overflow check these assert the shell's contract: a sticky footer whose
 * primary CTA stays inside the viewport at every baseline (no scroll-to-submit).
 */
const MIGRATED_MODALS = [
  { label: "Privacy Policy", event: "openPrivacyPolicy" },
  { label: "Contact Us", event: "openContactUs" },
  // Cluster B (S10): standard-themed, so the Close CTA lives in the sticky
  // footer slot — assert it stays inside the viewport at every baseline.
  { label: "State Benefit Hunter", event: "openStateBenefitHunter" },
  // Cluster C (S10): medium single-CTA tools migrated to the shell with a
  // rich header slot + sticky footer slot (BuyMeCoffee/encouragement + Close).
  // Workflow Guide moved here from MODALS now that its Close CTA lives in the
  // shell's sticky footer rather than an in-body action bar.
  { label: "Decision Decoder", event: "openDecisionDecoder" },
  { label: "Legislative Watchdog", event: "openLegislativeWatchdog" },
  { label: "Red Team", event: "openRedTeam" },
  { label: "VSO Finder", event: "openVSOFinder" },
  { label: "Symptom Logger", event: "openSymptomLogger" },
  { label: "Workflow Guide", event: "openWorkflowGuide" },
  // Cluster D2 (S10): DD214Analyzer migrated to the shell. Its action bar
  // (Clear / Save / Analyze) moves into the sticky-footer slot, so it asserts
  // the footer-CTA contract. Its ProfileImportConfirmModal and the z-[9999]
  // DD214FormBuilder both portal to document.body, so they clear the shell
  // without a lift wrapper.
  { label: "DD214 Analyzer", event: "openDD214Analyzer" },
  // Cluster E (S10): standard-themed wide modals migrated to size="full" with a
  // real Close CTA in the sticky-footer slot — assert it stays in view.
  // VAAITransparency combines its gradient header + tab strip in the header
  // slot; CommunityRoadmap keeps its privacy note + Close in the footer slot.
  { label: "VA AI Transparency", event: "openVAAITransparency" },
  { label: "Community Roadmap", event: "openCommunityRoadmap" },
];

/** Horizontal overflow of the document, in px (<= 1 is clean). */
async function pageOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.documentElement;
    return Math.round(el.scrollWidth - el.clientWidth);
  });
}

/**
 * Worst right-edge overflow of any visible descendant of the topmost overlay
 * whose bleed is not contained by an ancestor clip/scroll context.
 *
 * `getBoundingClientRect()` reports the unclipped layout box, so a decorative
 * flourish clipped by a header's `overflow:hidden`, or a tab inside an
 * intentional `overflow-x:auto` scroller, shows a `right` past the viewport
 * while causing no page/panel scroll. `containsX` walks each offender's
 * ancestors up to the overlay and discounts that contained bleed — it is not a
 * horizontal-overflow defect. Document scroll is still asserted independently
 * via `pageOverflow`.
 */
async function overlayOverflow(
  page: Page,
): Promise<{ found: boolean; overflow: number }> {
  return page.evaluate(() => {
    const containsX = (el: Element, root: Element): boolean => {
      let p = el.parentElement;
      while (p) {
        const ox = getComputedStyle(p).overflowX;
        if (
          ox === "hidden" ||
          ox === "clip" ||
          ox === "auto" ||
          ox === "scroll"
        )
          return true;
        if (p === root) break;
        p = p.parentElement;
      }
      return false;
    };

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
      if (r.right > vw + 1 && !containsX(el, overlay))
        worst = Math.max(worst, r.right - vw);
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
    const containsX = (el: Element, root: Element): boolean => {
      let p = el.parentElement;
      while (p) {
        const ox = getComputedStyle(p).overflowX;
        if (
          ox === "hidden" ||
          ox === "clip" ||
          ox === "auto" ||
          ox === "scroll"
        )
          return true;
        if (p === root) break;
        p = p.parentElement;
      }
      return false;
    };

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
      if (r.right > vw + 1 && !containsX(el, panel))
        worst = Math.max(worst, r.right - vw);
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

/**
 * Dispatch a modal-open window event until the modal appears, re-firing it on
 * every poll tick. The feature clusters that own these modals are lazy-loaded,
 * so a single dispatch sent before the cluster's listener attaches is silently
 * lost. Every open handler is an idempotent `setShow(true)`, so re-dispatching
 * is safe. `probe` returns the overlay's `found` flag for the modal's family.
 */
async function openModalByEvent(
  page: Page,
  event: string,
  probe: (page: Page) => Promise<{ found: boolean }>,
): Promise<void> {
  await expect
    .poll(
      async () => {
        await page.evaluate((evt) => {
          window.dispatchEvent(new CustomEvent(evt));
        }, event);
        return (await probe(page)).found;
      },
      { timeout: 6000 },
    )
    .toBe(true);
}

for (const vp of VIEWPORTS) {
  test.describe(`mobile @ ${vp.width}px (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      // Returning-user fixture: boot the app with every first-run overlay
      // already cleared so the only modal on screen is the one each test opens.
      //   - small-screen-dismissed: skips the <640px SmallScreenWarning (z-100).
      //   - tos-accepted: skips the migrated ToS gate (now a role=dialog with a
      //     `.modal-footer` that the locators below would otherwise grab).
      //   - last_seen_version: ToS-accepted alone trips the What's New modal
      //     (useUpdateOrchestrator) — marking this release seen suppresses it.
      //   - tour-completed: and 500ms after ToS, BootCampTour auto-starts; this
      //     skips it. The gates' own coverage lives in the "consent gates" block.
      await page.addInitScript((appVersion) => {
        sessionStorage.setItem("vetrate-small-screen-dismissed", "true");
        localStorage.setItem("vet-rate-tos-accepted", "true");
        localStorage.setItem("vet_rate_last_seen_version", appVersion);
        localStorage.setItem("vetrate-tour-completed", "true");
      }, APP_VERSION);
      await page.goto("/");
      await dismissDisclaimer(page);
    });

    test("home renders without horizontal overflow", async ({ page }) => {
      expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
    });

    for (const modal of MODALS) {
      test(`${modal.label} modal fits the viewport`, async ({ page }) => {
        await openModalByEvent(page, modal.event, overlayOverflow);

        const { overflow } = await overlayOverflow(page);
        expect(overflow).toBeLessThanOrEqual(1);
        expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
      });
    }

    for (const modal of MIGRATED_MODALS) {
      test(`${modal.label} (ResponsiveModal) keeps its CTA in view`, async ({
        page,
      }) => {
        await openModalByEvent(page, modal.event, inspectResponsiveModal);

        const m = await inspectResponsiveModal(page);
        expect(m.overflow).toBeLessThanOrEqual(1);
        expect(m.hasButton).toBe(true);
        expect(m.ctaInViewport).toBe(true);
        expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
      });
    }
  });

  // The first-run consent gates (S10): both migrated to ResponsiveModal with a
  // custom header + sticky-footer CTA + dismissable=false. They are not opened
  // by an event — DisclaimerSplash auto-shows on first visit and ToS follows
  // once the disclaimer is acknowledged — so they get their own setup (no
  // pre-accept) and assert the same footer-CTA-in-viewport contract.
  test.describe(`consent gates @ ${vp.width}px (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        sessionStorage.setItem("vetrate-small-screen-dismissed", "true");
      });
      await page.goto("/");
    });

    test("DisclaimerSplash keeps its CTA in view", async ({ page }) => {
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

    test("TermsOfServiceModal keeps its CTA in view", async ({ page }) => {
      await dismissDisclaimer(page);

      // ToS polls for the acknowledged disclaimer, then opens after ~300ms with
      // a read-gate countdown. The Accept button is disabled until the timer
      // ends, but it is present and positioned — layout is what we assert here.
      await expect
        .poll(
          async () =>
            page.evaluate(
              () =>
                !!document.querySelector(
                  '[role="dialog"][aria-labelledby="tos-title"]',
                ),
            ),
          { timeout: 8000 },
        )
        .toBe(true);

      const m = await inspectResponsiveModal(page);
      expect(m.overflow).toBeLessThanOrEqual(1);
      expect(m.hasButton).toBe(true);
      expect(m.ctaInViewport).toBe(true);
      expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
    });
  });
}
