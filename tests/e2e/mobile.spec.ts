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
  // Cluster F5 (S10): My Packet's main shell plus its four nested viewers (Pain
  // Map Detail, Form Viewer, Statement Viewer, Import Confirm) migrated to the
  // shell. The main modal keeps its actions in the header/body (no always-present
  // footer CTA), so it asserts the overflow contract here. The four nested viewers
  // lift to zIndex={70} above the z-60 main shell and open only after interaction
  // (selecting a saved item / importing a file), so they are exercised via flows.
  { label: "My Packet", event: "openMyPacket" },
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
  // Cluster F (S10): nested-children modals. PublicationsLibraryModal wraps the
  // inline library page — header-close-only (no footer CTA), so it asserts the
  // overflow contract. Its PublicationDetailsModal child lifts to zIndex={70}
  // above the z-60 shell; that child opens only after a publication card is
  // tapped, so it has no bare open* event and is exercised via that flow.
  { label: "Publications Library", event: "openPublicationsLibrary" },
  // Cluster F (S10): the VKB pair. VKBTimeline is a permanently-dark
  // (!bg-slate-800) header-close-only panel (no footer slot); VKBViewer's footer
  // (Show LLM Context / Clear All Data) is data-gated — absent until a Knowledge
  // Base is loaded — so on fresh open it shows only its loading/empty state.
  // Both therefore assert the overflow contract here. Their nested children lift
  // to zIndex={70} above the z-60 shell and open only after interaction
  // (selecting two docs to compare / tapping "Show LLM Context"), so neither has
  // a bare open* event; both are exercised via those flows.
  { label: "VKB Timeline", event: "openVKBTimeline" },
  { label: "VKB Viewer", event: "openVKBViewer" },
  // Cluster F (S10): PainPainter is a permanently-dark gradient panel — its
  // "Pro Tip" line is plain text (no CTA), so it lives in the body, not the
  // footer slot, and the modal asserts the overflow contract here. Its Save Map
  // child lifts to zIndex={70} above the z-60 shell and opens only after tapping
  // Save, so it has no bare open* event. BackupManager ("The Bunker") uses a
  // gradient header slot with no always-present footer CTA; its Confirm-Clear
  // child lifts to zIndex={70} and opens only after tapping Clear All Data. (Its
  // CloudSyncManager / DbqBrowser launches are separate components, migrated
  // independently.) Both nested children are exercised via those flows.
  { label: "Pain Painter", event: "openPainPainter" },
  { label: "Backup Manager", event: "openBackupManager" },
  // Cluster F (S10): PathfinderModal (teal-gradient header slot, no always-present
  // shell footer CTA) and ClaimNavigator (a full-bleed "Mission Control" takeover)
  // assert the overflow contract here. Pathfinder's File-Drop-In child and
  // ClaimNavigator's Help modal both lift above their parent shell (zIndex={70} /
  // default z-60 over the z-50 takeover) and open only after interaction (a
  // drop-in trigger / the Help button), so neither has a bare open* event; both
  // are exercised via those flows.
  { label: "Pathfinder", event: "openPathfinder" },
  { label: "Claim Navigator", event: "openClaimNavigator" },
  // Cluster F6 (S10): CAPSimulator is a single-file state machine — its seven
  // mode branches (intro, exam-prep, exam-prep-detail, select-condition,
  // flashcard, simulation, results) each render their own ResponsiveModal. A bare
  // openCAPSimulator opens the default "intro" branch; every branch keeps its
  // actions in the header/body (no shell footer CTA), so it asserts the overflow
  // contract here. The two dark branches (exam-prep, exam-prep-detail) carry an
  // opaque gradient via className. The six deeper branches need state (a picked
  // condition / an answered question / a completed run) to reach, so they are
  // exercised via those flows; the flashcard + results BuyMeCoffee popups are
  // fragment siblings of the shell.
  { label: "C&P Simulator", event: "openCAPSimulator" },
  // Cluster F7 (S10): TacticalCalculator's main modal migrated to the shell. Its
  // gradient header carries an always-visible close-X and the footer (CFR
  // disclaimer + Buy-Me-Coffee + Close) sits as the last body element rather than
  // the sticky-footer slot, so it asserts the overflow contract here. The nested
  // Edit Condition modal lifts to zIndex={70} above the z-60 shell and uses the
  // footer slot for its Cancel/Save CTAs, but it only mounts after tapping a saved
  // condition's edit action (editingCondition gate, no bare event), so it is
  // exercised via that flow. VAGovRatingPaster already paints at z-100.
  { label: "Tactical Calculator", event: "openTacticalCalculator" },
  // Cluster G1 (S10): three standalone visualizers migrated to the shell. All
  // three keep an always-visible close-X in a custom header slot and have no
  // always-present sticky-footer CTA (their actions are header-close-only or
  // in-body/conditional), so they assert the overflow contract here.
  // WebOfConditions pairs a light yellow header slot with a permanently-dark
  // gray-900 full-bleed body and a responsive flex-col->sm:flex-row graph/panel
  // stack. EvidenceGapVisualizer is a permanently-dark purple modal whose 38 CFR
  // disclaimer sits as the last body element (not the light footer slot).
  // BlueButtonXRay is a standard light/dark modal whose CTAs surface in-body only
  // after a Blue Button file is parsed (conditional, no fresh-open footer CTA).
  { label: "Web of Conditions", event: "openWebOfConditions" },
  { label: "Evidence Gap Visualizer", event: "openEvidenceGapVisualizer" },
  { label: "Blue Button X-Ray", event: "openBlueButtonXRay" },
  // Cluster G2 (S10): two embedded full-page components whose modal chrome used
  // to live in their cluster wrappers (BodyMappingCluster / SpecializedToolsCluster)
  // now own a ResponsiveModal directly; the wrappers render them bare. Both are
  // permanently-dark, header-close-only (close-X in a custom header slot) with
  // only conditional in-body CTAs, so they assert the overflow contract here.
  // BodyMapSelector's SVG container drops to min-h-[340px] on phones; its
  // "Log to Symptom Logger" CTA surfaces only after a zone is picked.
  // EvidenceTimeline's canvas is w-full/maxWidth:100% so it scales without
  // overflow; its export CTA appears only once events exist.
  { label: "Body Map Selector", event: "openBodyMapSelector" },
  { label: "Evidence Timeline", event: "openEvidenceTimeline" },
  // UserManual is a two-pane (sidebar + content) independent-scroll layout that
  // does not fit the single-scroll ResponsiveModal body; it keeps its bespoke
  // shell (already flex-col-stacks on phones with a mobile header + sidebar
  // toggle, locks body scroll, and closes on ESC). It asserts the overflow
  // contract here as-is; a full shell swap is intentionally deferred to avoid
  // regressing the desktop two-pane scroll.
  { label: "User Manual", event: "openUserManual" },
  // Cluster H (S10): VisionSimulator's wrapper dropped its bespoke backdrop +
  // max-w-2xl + floating corner-X for the shell's default title bar (size="lg",
  // title="Document Vision Simulator"); its panel lost the duplicate card chrome
  // and h3. Close lives in the shell's sticky header (no fresh-open footer CTA),
  // so it asserts the overflow contract here.
  { label: "Vision Simulator", event: "openVisionSimulator" },
  // Cluster S12: three BVA-data tool modals migrated from the legacy
  // `max-w-4xl + max-h-[90vh]` pattern to the shell (size="xl"), each with its
  // gradient bar (blue/amber/indigo) in a custom header slot carrying an
  // always-visible close-X. None has an always-present sticky-footer CTA — their
  // toggles/results live in the scroll body — so they assert the overflow
  // contract here. AppealsLaneAdvisor + RemandRiskChecker mount on their events
  // via AppealsToolsCluster; NexusQualityAnalyzer via QualityControlCluster.
  { label: "Appeals Lane Advisor", event: "openAppealsLaneAdvisor" },
  { label: "Remand Risk Checker", event: "openRemandRiskChecker" },
  { label: "Nexus Quality Analyzer", event: "openNexusQualityAnalyzer" },
  // SharkRadar (S12) also mounts via QualityControlCluster. Its rose/red gradient
  // header (with ReportBugLink + close) rides the shell's header slot and it has
  // no sticky-footer CTA, so it asserts the overflow contract here, not the CTA one.
  { label: "Shark Radar", event: "openSharkRadar" },
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
  // Cluster H (S10): critic-added surfaces. TermsOfServicePage was a bespoke
  // full-page legal shell (fixed-inset backdrop + min-h-screen panel); migrated
  // to size="xl" with the red gradient bar in the header slot and its always-on
  // Close CTA in the sticky-footer slot.
  { label: "Terms of Service Page", event: "openTermsOfService" },
  // Cluster (S12): the Bug Squasher and Feature Request wizards — structural
  // twins (3-step: classification → details → review/submit). Their Back / Next
  // / Generate / Done bar moves into the sticky-footer slot, so each asserts the
  // footer-CTA-in-viewport contract.
  { label: "Bug Squasher", event: "openBugSquasher" },
  { label: "Feature Request", event: "openFeatureRequest" },
  // S23: Ask the Regs — built on the shell from day one (size="lg", sticky
  // footer "Ask" CTA), never a legacy modal to migrate.
  { label: "Ask the Regs", event: "openAskTheRegs" },
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
async function inspectResponsiveModal(
  page: Page,
  labelledBy?: string,
): Promise<{
  found: boolean;
  overflow: number;
  hasButton: boolean;
  ctaInViewport: boolean;
}> {
  return page.evaluate((labelId) => {
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

    const footer = labelId
      ? document.querySelector(
          `[role="dialog"][aria-labelledby="${labelId}"] .modal-footer`,
        )
      : document.querySelector(".modal-footer");
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
  }, labelledBy);
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
      //   - tos-accepted: skips the migrated ToS gate (now a role=dialog with a
      //     `.modal-footer` that the locators below would otherwise grab).
      //   - last_seen_version: ToS-accepted alone trips the What's New modal
      //     (useUpdateOrchestrator) — marking this release seen suppresses it.
      //   - tour-completed: and 500ms after ToS, BootCampTour auto-starts; this
      //     skips it. The gates' own coverage lives in the "consent gates" block.
      await page.addInitScript((appVersion) => {
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

  // What's New (S12): migrated to ResponsiveModal with a custom gradient header
  // slot + the "Roger That" CTA in the sticky-footer slot. Unlike the modals
  // above it is not opened by an event — useUpdateOrchestrator auto-shows it on
  // boot when TOS is accepted but the current version is unseen — so it gets its
  // own setup (stale last_seen_version) and asserts the footer-CTA contract.
  test.describe(`What's New @ ${vp.width}px (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      // Accept TOS and skip the tour, but leave last_seen_version stale so the
      // What's New modal trips on mount (useUpdateOrchestrator).
      await page.addInitScript(() => {
        localStorage.setItem("vet-rate-tos-accepted", "true");
        localStorage.setItem("vet_rate_last_seen_version", "0.0.0");
        localStorage.setItem("vetrate-tour-completed", "true");
      });
      await page.goto("/");
      await dismissDisclaimer(page);
    });

    test("What's New modal keeps its CTA in view", async ({ page }) => {
      const footerBtn = page.locator(
        '[role="dialog"][aria-labelledby="whats-new-title"] .modal-footer button',
      );
      // toBeVisible + toBeInViewport use Playwright's built-in auto-retry, so they
      // ride through React.StrictMode's unmount→remount cycle without a false pass.
      await expect(footerBtn).toBeVisible({ timeout: 8000 });
      await expect(footerBtn).toBeInViewport();
      const m = await inspectResponsiveModal(page);
      expect(m.overflow).toBeLessThanOrEqual(1);
      expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
    });
  });

  // Atomic Wipe (S12): the panic-button confirm dialog migrated to
  // ResponsiveModal (dismissable=false, size="sm") with its ⚠️ header in the
  // custom header slot and the Cancel / Confirm Wipe pair in the sticky-footer
  // slot. The trigger now lives inside the Backup Manager (The Bunker), so the
  // test opens that modal first via its lazy-safe event, then clicks the real
  // trigger (never the destructive Confirm). Assertions are scoped to the
  // atomic-wipe dialog because Backup Manager's own sub-modals also render
  // `.modal-footer`.
  test.describe(`Atomic Wipe @ ${vp.width}px (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      await page.addInitScript((appVersion) => {
        localStorage.setItem("vet-rate-tos-accepted", "true");
        localStorage.setItem("vet_rate_last_seen_version", appVersion);
        localStorage.setItem("vetrate-tour-completed", "true");
      }, APP_VERSION);
      await page.goto("/");
      await dismissDisclaimer(page);
    });

    test("Atomic Wipe confirm keeps its CTA in view", async ({ page }) => {
      const trigger = page.getByRole("button", {
        name: "Clear all local data",
      });
      // BackupManager is React.lazy — first load in CI (dev server, JIT compile)
      // can exceed 6 s; 15 s matches the webServer startup budget.
      await expect
        .poll(
          async () => {
            await page.evaluate(() => {
              window.dispatchEvent(new CustomEvent("openBackupManager"));
            });
            return trigger.isVisible();
          },
          { timeout: 15_000 },
        )
        .toBe(true);
      await trigger.click();

      await expect
        .poll(
          async () =>
            (await inspectResponsiveModal(page, "atomic-wipe-title")).found,
          { timeout: 6000 },
        )
        .toBe(true);

      const m = await inspectResponsiveModal(page, "atomic-wipe-title");
      expect(m.overflow).toBeLessThanOrEqual(1);
      expect(m.hasButton).toBe(true);
      expect(m.ctaInViewport).toBe(true);
      expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
    });
  });
}
