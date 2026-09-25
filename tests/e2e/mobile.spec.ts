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

// D3 (QA S46 follow-up): the four widths QA hit-tested for the Quick Exit
// vs. dialog-title/close-X overlap fix. Kept separate from VIEWPORTS above -
// that array drives every describe block in this file (overflow, CTA-in-view,
// consent gates...), so folding 320/430 into it would double the run time of
// ~50 unrelated tests. Only the Quick Exit / Luna hit-test blocks below need
// this narrower, denser sweep.
const QUICK_EXIT_VIEWPORTS = [
  { name: "iphone-se", width: 320, height: 568 },
  { name: "small-android", width: 360, height: 740 },
  { name: "iphone", width: 390, height: 844 },
  { name: "iphone-max", width: 430, height: 932 },
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
 * Internal horizontal overflow of the open ResponsiveModal's own scroll
 * body (the `.flex-1.overflow-y-auto` region), independent of the viewport
 * check above. A flex row inside the body (e.g. an `<input class="flex-1">`
 * with no `min-w-0`) can push the body's own `scrollWidth` past its
 * `clientWidth` without any descendant's `getBoundingClientRect().right`
 * crossing the viewport edge, since the excess gets absorbed by the body's
 * own right padding before it would register there — so this is the
 * mechanism `overlayOverflow` above cannot catch. Matches the measurement
 * QA's audit tooling uses (bodySW/bodyCW).
 */
async function modalBodyOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const body = document.querySelector(
      '[role="dialog"] .flex-1.overflow-y-auto.overscroll-contain',
    );
    if (!body) return 0;
    return Math.round(body.scrollWidth - body.clientWidth);
  });
}

/**
 * Bounding box of a tool header's close button, measured against the real
 * viewport with no `containsX` exemption. `overlayOverflow` above
 * deliberately ignores bleed contained by an ancestor's `overflow: hidden`
 * (a decorative flourish clipped by a header is not a defect) — but the
 * `.modal-content` panel *itself* has `overflow-hidden`, so that same
 * exemption also swallows a functionally-broken clipped close button,
 * which is why it never caught the S9 audit's "close button clipped at
 * 390px" bug. This checks the button directly instead.
 */
async function closeButtonBox(
  page: Page,
  titleId: string,
  ariaLabel: string,
): Promise<{
  found: boolean;
  width: number;
  height: number;
  fullyVisible: boolean;
}> {
  return page.evaluate(
    ({ titleId, ariaLabel }) => {
      const dialog = document.querySelector(
        `[role="dialog"][aria-labelledby="${titleId}"]`,
      );
      const btn = dialog?.querySelector(
        `button[aria-label="${ariaLabel}"]`,
      ) as HTMLElement | null;
      if (!btn)
        return { found: false, width: 0, height: 0, fullyVisible: false };
      const r = btn.getBoundingClientRect();
      const vw = window.innerWidth;
      return {
        found: true,
        width: Math.round(r.width),
        height: Math.round(r.height),
        fullyVisible: r.right <= vw + 0.5 && r.left >= -0.5,
      };
    },
    { titleId, ariaLabel },
  );
}

/**
 * Hit-tests an element's own center via `document.elementFromPoint`, the
 * same lookup a real tap resolves against. `closeButtonBox` above (and
 * `overlayOverflow`/`pageOverflow`) only check bounding-box geometry - none
 * of them notice a same-region, higher-z-index sibling (e.g. the fixed
 * Quick Exit button) silently intercepting the tap instead of the element
 * actually under it, which is exactly how QA S46 found Quick Exit
 * swallowing tool close-button taps at 390px despite each button measuring
 * a clean, fully-visible 44-48px box on its own.
 */
async function centerHitsSelf(
  page: Page,
  selector: string,
): Promise<{ found: boolean; hit: boolean }> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return { found: false, hit: false };
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const hitEl = document.elementFromPoint(cx, cy);
    return { found: true, hit: el.contains(hitEl) };
  }, selector);
}

const QUICK_EXIT_SELECTOR =
  'button[aria-label="Quick exit - immediately leave this page"]';

/**
 * Bounding rect of the first element matching `selector`, or `null` if
 * absent. Used to compare Quick Exit / Luna against a dialog's title or
 * close-X directly, rather than only hit-testing a single point (D3/D7).
 */
async function elementRect(
  page: Page,
  selector: string,
): Promise<{
  left: number;
  top: number;
  right: number;
  bottom: number;
} | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  }, selector);
}

/** True when two axis-aligned rects overlap (touching edges don't count). */
function rectsIntersect(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
): boolean {
  return (
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  );
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
        localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
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
        localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
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
        localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
      }, APP_VERSION);
      await page.goto("/");
      await dismissDisclaimer(page);
    });

    test("Atomic Wipe confirm keeps its CTA in view", async ({ page }) => {
      const trigger = page.getByRole("button", {
        name: "Clear Data - permanently erase all local data",
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

  // BDD Builder (QA audit fix): the "Add condition" input in the Dashboard
  // tab's Conditions Tracker card used `flex-1` with no `min-w-0`, so it
  // refused to shrink below its native min-content width inside the `flex
  // gap-2` row, overflowing the row and bleeding into the modal body's own
  // scroll region (measured at 390px: body scrollWidth > clientWidth).
  // `overlayOverflow`/`pageOverflow` don't catch this class of bug (the
  // excess never crosses the viewport edge), so this asserts the body's own
  // internal overflow directly via `modalBodyOverflow`.
  test.describe(`BDD Builder body overflow @ ${vp.width}px (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      await page.addInitScript((appVersion) => {
        localStorage.setItem("vet-rate-tos-accepted", "true");
        localStorage.setItem("vet_rate_last_seen_version", appVersion);
        localStorage.setItem("vetrate-tour-completed", "true");
        localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
        // Seeds a separation date so BDD Builder opens straight to the
        // Dashboard tab (with the Conditions Tracker's "Add condition"
        // input) instead of the setup screen.
        localStorage.setItem(
          "vetrate_bdd_data",
          JSON.stringify({
            separationDate: "2007-06-29",
            branch: "army",
            checkedItems: [],
            conditions: [],
            notes: "",
            lastUpdated: new Date().toISOString(),
            prefilledFromRecords: true,
          }),
        );
      }, APP_VERSION);
      await page.goto("/");
      await dismissDisclaimer(page);
    });

    test("Add-condition input row fits the Dashboard tab without internal overflow", async ({
      page,
    }) => {
      await openModalByEvent(page, "openBDDBuilder", async (p) => ({
        found: await p
          .locator('[role="dialog"][aria-labelledby="bdd-builder-title"]')
          .isVisible(),
      }));

      expect(await modalBodyOverflow(page)).toBeLessThanOrEqual(1);
      expect(await pageOverflow(page)).toBeLessThanOrEqual(1);
    });
  });

  // SecurityBadge (QA audit fix, low): the floating "100% Private" badge sat
  // at a fixed bottom-4 right-4 on every screen, directly on top of the
  // mobile bottom nav's rightmost "Missions" item at phone widths. Same
  // hit-test approach as the Quick Exit / close-button checks above.
  test.describe(`SecurityBadge vs mobile bottom nav @ ${vp.width}px (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      await page.addInitScript((appVersion) => {
        localStorage.setItem("vet-rate-tos-accepted", "true");
        localStorage.setItem("vet_rate_last_seen_version", appVersion);
        localStorage.setItem("vetrate-tour-completed", "true");
        localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
      }, APP_VERSION);
      await page.goto("/");
      await dismissDisclaimer(page);
    });

    test("Missions nav item stays tap-reachable and SecurityBadge stays tap-reachable", async ({
      page,
    }) => {
      // Two `nav[aria-label="Main navigation"]` elements exist (desktop
      // `hidden md:flex` sidebar + the phone-only MobileBottomNav) - `:visible`
      // resolves the real one at this viewport. `toBeVisible()` auto-retries,
      // riding out the same dev-mode React.StrictMode mount→unmount→remount
      // cycle the tool-header tests above account for; a single unguarded
      // `page.evaluate` snapshot doesn't and was flaky here.
      const missions = page.locator(
        'nav[aria-label="Main navigation"]:visible button[aria-label="Missions"]',
      );
      await expect(missions).toBeVisible();
      const badge = page.locator('button[aria-label="View Security Proof"]');
      await expect(badge).toBeVisible();

      const hitsSelf = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        return el.contains(document.elementFromPoint(cx, cy));
      };
      expect(await missions.evaluate(hitsSelf)).toBe(true);
      expect(await badge.evaluate(hitsSelf)).toBe(true);
    });
  });
}

// Tool header close buttons (QA audit fix): Pathfinder, State Benefit
// Hunter, Web of Conditions, Evidence Timeline, Evidence Gap Visualizer,
// MOS Hazard Matcher, Tactical Calculator and BDD Builder all share the
// same bug — a shared mobile-only rule (`.modal-content .flex.gap-2 >
// button, .modal-content .flex.gap-3 > button { flex: 1; min-width:
// 120px }`, meant for footer action-button pairs) also matched each
// header's ReportBugLink+Close wrapper, and the title's flex item had no
// `min-w-0` to absorb the resulting width, so the close button was pushed
// off past the header's own edge and clipped by the panel's
// `overflow-hidden`. `overlayOverflow` doesn't catch it (see
// `closeButtonBox` above), so this checks the button directly.
//
// QA S46: the *fully-visible, correctly-sized* close button could still
// be untappable — the app-level Quick Exit button (fixed top-right,
// z-[9999], mounted above every dialog for panic-exit safety) sat in the
// same corner and silently intercepted the tap on five of these seven
// dialogs, with a corner clip on the other two. `centerHitsSelf` below
// hit-tests both buttons' real centers the way a tap resolves, which a
// bounding-box check alone can't catch.
//
// D3 follow-up: moving Quick Exit to top-left (below `sm`) to clear those
// close-X's then covered the dialog *title* instead on 8 of 12 dialogs -
// AppealsLaneAdvisor and MyPacket (added below) are two of the examples QA
// named. The fix (ResponsiveModal.jsx's shared `mt-20` gutter) is structural
// and applies to every dialog through the one shared shell, so this list
// isn't the app's full dialog inventory - it's every dialog previously
// implicated in a Quick Exit collision (the original close-X regression set
// plus QA's new named title-overlap examples), run at the four widths QA
// hit-tested (QUICK_EXIT_VIEWPORTS: 320/360/390/430).
const TOOL_HEADERS = [
  {
    label: "Pathfinder",
    event: "openPathfinder",
    titleId: "pathfinder-modal-title",
    ariaLabel: "Close",
  },
  {
    label: "State Benefit Hunter",
    event: "openStateBenefitHunter",
    titleId: "state-benefit-hunter-title",
    ariaLabel: "Close",
  },
  {
    label: "Web of Conditions",
    event: "openWebOfConditions",
    titleId: "web-of-conditions-title",
    ariaLabel: "Close",
  },
  {
    label: "Evidence Timeline",
    event: "openEvidenceTimeline",
    titleId: "evidence-timeline-title",
    ariaLabel: "Close",
  },
  {
    label: "Evidence Gap Visualizer",
    event: "openEvidenceGapVisualizer",
    titleId: "evidence-gap-title",
    ariaLabel: "Close",
  },
  {
    label: "MOS Hazard Matcher",
    event: "openMOSHazardMatcher",
    titleId: "mos-hazard-matcher-title",
    ariaLabel: "Close",
  },
  {
    label: "Tactical Calculator",
    event: "openTacticalCalculator",
    titleId: "calculator-title",
    ariaLabel: "Close",
  },
  {
    label: "BDD Builder",
    event: "openBDDBuilder",
    titleId: "bdd-builder-title",
    ariaLabel: "Close BDD Builder",
  },
  {
    label: "Appeals Lane Advisor",
    event: "openAppealsLaneAdvisor",
    titleId: "appeals-lane-title",
    ariaLabel: "Close",
  },
  {
    label: "My Packet",
    event: "openMyPacket",
    titleId: "my-packet-title",
    ariaLabel: "Close",
  },
];

for (const vp of QUICK_EXIT_VIEWPORTS) {
  test.describe(`Tool header close buttons @ ${vp.width}px (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      await page.addInitScript((appVersion) => {
        localStorage.setItem("vet-rate-tos-accepted", "true");
        localStorage.setItem("vet_rate_last_seen_version", appVersion);
        localStorage.setItem("vetrate-tour-completed", "true");
        localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
      }, APP_VERSION);
      await page.goto("/");
      await dismissDisclaimer(page);
    });

    for (const tool of TOOL_HEADERS) {
      test(`${tool.label} close button stays fully visible at >=44x44px, clear of Quick Exit, and a real tap closes it`, async ({
        page,
      }) => {
        await openModalByEvent(page, tool.event, () =>
          closeButtonBox(page, tool.titleId, tool.ariaLabel),
        );

        // toBeVisible() auto-retries (unlike a single evaluate() snapshot),
        // riding out the dev-mode React.StrictMode mount→unmount→remount
        // cycle the same way the What's New modal test above does. 15s
        // matches the Backup Manager test's budget for the same
        // first-load-in-a-fresh-worker dev-server JIT compile variance.
        const dialogSelector = `[role="dialog"][aria-labelledby="${tool.titleId}"]`;
        const closeSelector = `${dialogSelector} button[aria-label="${tool.ariaLabel}"]`;
        const closeButton = page.locator(closeSelector);
        await expect(closeButton).toBeVisible({ timeout: 15_000 });
        await expect(closeButton).toBeInViewport();

        const box = await closeButtonBox(page, tool.titleId, tool.ariaLabel);
        expect(box.found).toBe(true);
        expect(box.fullyVisible).toBe(true);
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);

        // Geometry: neither the dialog's title nor its close-X may share so
        // much as a pixel with Quick Exit's own box (D3) - a hit-test alone
        // only proves the *center* point is clear, not the whole rect.
        const qeRect = await elementRect(page, QUICK_EXIT_SELECTOR);
        const titleRect = await elementRect(page, `#${tool.titleId}`);
        const closeRect = await elementRect(page, closeSelector);
        expect(qeRect).not.toBeNull();
        expect(titleRect).not.toBeNull();
        expect(closeRect).not.toBeNull();
        expect(rectsIntersect(qeRect!, titleRect!)).toBe(false);
        expect(rectsIntersect(qeRect!, closeRect!)).toBe(false);

        // Hit-test: tapping the close button's real center must resolve to
        // the close button itself, not a higher-z-index Quick Exit sibling
        // sitting on top of it. expect.poll rides out the same StrictMode
        // remount blip the box checks above already tolerate via
        // toBeVisible()'s auto-retry - a bare single-shot evaluate() here
        // doesn't get that for free.
        await expect
          .poll(async () => (await centerHitsSelf(page, closeSelector)).hit, {
            timeout: 5000,
          })
          .toBe(true);

        // Quick Exit itself must stay reachable while this dialog is open -
        // it's a panic-exit safety control, not a decoration.
        await expect(page.locator(QUICK_EXIT_SELECTOR)).toBeVisible();
        await expect
          .poll(
            async () => (await centerHitsSelf(page, QUICK_EXIT_SELECTOR)).hit,
            { timeout: 5000 },
          )
          .toBe(true);

        // A real tap (Playwright's `.click()` dispatches actual pointer
        // events and fails actionability if another element intercepts the
        // target, unlike a JS-level `el.click()`) must close the dialog.
        await closeButton.click();
        await expect(page.locator(dialogSelector)).toBeHidden({
          timeout: 5000,
        });
      });
    }
  });
}

// Luna toast vs dialog close button (D7 fixed the top zones; N5 found the
// *bottom* zones still covered Forms Helper's close button at 320px (8/8
// taps missed) and the top-right zone still covered BDD Builder's close-X
// at 1440px - a zone can always land somewhere, at some width, on some
// dialog's controls. The N5 fix replaces zone-tuning entirely: Luna is now
// suppressed via CSS (`body:has([role="dialog"], [aria-modal="true"])
// .luna-toast { display: none }`, index.css) any time a dialog is open,
// including one that opens *after* she's already showing (`:has()`
// re-evaluates live). This block now asserts she never becomes visible
// while a dialog she's wired into (BuyMeCoffee's `show={true}` in
// FormsHelper/BDD Builder has no gating condition on dialog state) stays
// open, instead of asserting she avoids a particular corner. BDD Builder
// needs Dashboard-tab data seeded (see the BDD Builder body-overflow block
// above) - Luna is gated off during setup.
const LUNA_TOASTS = [
  {
    label: "BDD Builder",
    event: "openBDDBuilder",
    titleId: "bdd-builder-title",
    ariaLabel: "Close BDD Builder",
    bddSeed: true,
  },
  {
    label: "Forms Helper",
    event: "openFormsHelper",
    titleId: "forms-helper-title",
    ariaLabel: "Close",
    bddSeed: false,
  },
];

const LUNA_DISMISS_SELECTOR = 'button[aria-label="Dismiss Luna"]';

for (const vp of QUICK_EXIT_VIEWPORTS) {
  test.describe(`Luna toast suppressed while a dialog is open @ ${vp.width}px (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const tool of LUNA_TOASTS) {
      test(`${tool.label}: Luna never becomes visible while the dialog is open, and its close button still works`, async ({
        page,
      }) => {
        await page.addInitScript(
          // addInitScript takes exactly one serializable `arg` (unlike
          // page.evaluate's variadic form) - bundle appVersion + bddSeed
          // into a single object instead of two trailing arguments, which
          // Playwright otherwise silently drops.
          ({ appVersion, bddSeed }) => {
            localStorage.setItem("vet-rate-tos-accepted", "true");
            localStorage.setItem("vet_rate_last_seen_version", appVersion);
            localStorage.setItem("vetrate-tour-completed", "true");
            localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
            // BDD Builder gates its Luna popup behind !state.showSetup - seed
            // a separation date so it opens straight to the Dashboard tab.
            if (bddSeed) {
              localStorage.setItem(
                "vetrate_bdd_data",
                JSON.stringify({
                  separationDate: "2007-06-29",
                  branch: "army",
                  checkedItems: [],
                  conditions: [],
                  notes: "",
                  lastUpdated: new Date().toISOString(),
                  prefilledFromRecords: true,
                }),
              );
            }
          },
          { appVersion: APP_VERSION, bddSeed: tool.bddSeed },
        );
        await page.goto("/");
        await dismissDisclaimer(page);

        const dialogSelector = `[role="dialog"][aria-labelledby="${tool.titleId}"]`;
        const closeSelector = `${dialogSelector} button[aria-label="${tool.ariaLabel}"]`;
        await openModalByEvent(page, tool.event, async (p) => ({
          found: await p.locator(dialogSelector).isVisible(),
        }));
        await expect(page.locator(closeSelector)).toBeVisible({
          timeout: 15_000,
        });

        // BuyMeCoffee mounts under this tool with `show={true}` and no
        // gating on dialog state, so - pre-fix - she'd become visible ~2s
        // after mount (up to 5s if a prior dismissal in this session bumped
        // her delay) and could land on the close button (N5). Poll for her
        // dismiss button to *mount* (a condition, not a fixed sleep) so this
        // genuinely waits out that window rather than checking too early and
        // passing on a technicality; `.luna-toast` still mounts as before -
        // only its CSS visibility changed - so this proves suppression, not
        // that the trigger silently stopped firing.
        await expect
          .poll(
            async () =>
              page.evaluate(
                (sel) => !!document.querySelector(sel),
                LUNA_DISMISS_SELECTOR,
              ),
            { timeout: 6000 },
          )
          .toBe(true);
        await expect(page.locator(LUNA_DISMISS_SELECTOR)).toBeHidden();

        // Luna being suppressed must not regress the close button itself
        // (D3/D7's hit-test).
        await expect
          .poll(async () => (await centerHitsSelf(page, closeSelector)).hit, {
            timeout: 5000,
          })
          .toBe(true);

        await page.locator(closeSelector).click();
        await expect(page.locator(dialogSelector)).toBeHidden({
          timeout: 5000,
        });
      });
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════
// N4 (QA final8): QA named three dialogs that don't render through
// ResponsiveModal.jsx - ClaimNavigator, UserManual, CrisisModal - so they
// never got D3's shared `mt-20` gutter and Quick Exit still collides with
// them. Grepping the app for every other `role="dialog"`/`aria-modal`
// element outside ResponsiveModal.jsx turned up five more real bypasses
// (AboutUs, Header.jsx's mobile menu drawer, StressReliefDivision's IDDQD
// easter egg, GlobalCommandSearch) plus MusterCall's own header, which
// *is* inside ResponsiveModal but overflowed independently (see the
// Observation fix in MusterCallHeader.jsx/AboutUs.jsx). AIConsentModal and
// VADataCenter's standalone (`!embeddedMode`) mode got the same fix but
// aren't exercised below: AIConsentModal only opens after a multi-step
// in-tool flow with no direct trigger event, and VADataCenter's
// non-embedded dialog path has no live call site in the app today (its one
// usage, MyPacket.jsx, always passes `embeddedMode={true}`).
//
// Rather than hand-listing each dialog's title id and close-button
// aria-label (exactly the kind of list a new bypass could slip through
// unnoticed), `probeOpenDialog` below reads both live from whatever dialog
// is actually open in the DOM: `aria-labelledby` (falling back to the
// first heading) for the title, and the first button whose aria-label
// matches /close|exit/i for the close control. Each entry in
// BYPASS_DIALOGS only supplies a *trigger* - opening a dialog is
// unavoidably per-component (event, click, keystroke), but nothing here
// hardcodes which element inside it counts as the title or the close
// button.

type Rect = { left: number; top: number; right: number; bottom: number };

const DESKTOP_VIEWPORT = { name: "desktop", width: 1440, height: 900 };
const BYPASS_TEST_VIEWPORTS = [...QUICK_EXIT_VIEWPORTS, DESKTOP_VIEWPORT];

type BypassDialog = {
  label: string;
  open: (page: Page) => Promise<void>;
  // "button": tap the discovered close control and assert the dialog hides.
  // "escape": press Escape and assert the dialog hides (no close button in
  // the DOM to hit-test/tap, e.g. GlobalCommandSearch).
  // "none": CrisisModal is intentionally non-dismissible - don't try.
  closeMethod: "button" | "escape" | "none";
  availableAt?: (width: number) => boolean;
};

/** True once *any* modal dialog is in the DOM. */
async function anyDialogProbe(page: Page): Promise<{ found: boolean }> {
  return {
    found: await page.evaluate(
      () =>
        document.querySelectorAll(
          '[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]',
        ).length > 0,
    ),
  };
}

/**
 * Repeats `action` until a dialog appears, rather than firing it once and
 * hoping. Every action here is idempotent when repeated (dispatching an
 * open* event / typing "iddqd" again just re-arrives at "dialog open";
 * clicking a toggle button is guarded not to re-fire once open - see the
 * "Header mobile menu" entry below), so this is safe against both the
 * ordinary "dispatched before the listener attached" race `openModalByEvent`
 * already documents *and* the dev-mode React.StrictMode mount->unmount->
 * remount blip other tests in this file ride out with `toBeVisible()`'s
 * auto-retry - a single evaluate() snapshot doesn't get that for free.
 */
async function triggerUntilDialogFound(
  page: Page,
  action: () => Promise<void>,
): Promise<void> {
  await expect
    .poll(
      async () => {
        await action();
        return (await anyDialogProbe(page)).found;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
}

function dispatchTrigger(page: Page, event: string): () => Promise<void> {
  return () =>
    page.evaluate((evt) => window.dispatchEvent(new CustomEvent(evt)), event);
}

const BYPASS_DIALOGS: BypassDialog[] = [
  {
    label: "Claim Navigator",
    open: (page) =>
      triggerUntilDialogFound(
        page,
        dispatchTrigger(page, "openClaimNavigator"),
      ),
    closeMethod: "button",
  },
  {
    label: "User Manual",
    open: (page) =>
      triggerUntilDialogFound(page, dispatchTrigger(page, "openUserManual")),
    closeMethod: "button",
    // The mobile header (title + hamburger + close) that N4 covers only
    // renders `md:hidden`; at >=768px the two-pane desktop layout has no
    // equivalent top bar for Quick Exit to collide with.
    availableAt: (width) => width < 768,
  },
  {
    label: "Crisis Modal",
    // CrisisListener.jsx's `vetrate:crisis` listener carries a detail
    // payload openModalByEvent's plain CustomEvent(event) can't express.
    open: (page) =>
      triggerUntilDialogFound(page, () =>
        page.evaluate(() => {
          window.dispatchEvent(
            new CustomEvent("vetrate:crisis", {
              detail: { severity: "high", source: "e2e" },
            }),
          );
        }),
      ),
    closeMethod: "none",
  },
  {
    label: "About Us",
    open: (page) =>
      triggerUntilDialogFound(page, dispatchTrigger(page, "openAboutUs")),
    closeMethod: "button",
  },
  {
    label: "Muster Call",
    open: (page) =>
      triggerUntilDialogFound(page, dispatchTrigger(page, "openMusterCall")),
    closeMethod: "button",
  },
  {
    label: "Global Command Search",
    open: (page) =>
      triggerUntilDialogFound(
        page,
        dispatchTrigger(page, "openGlobalCommandSearch"),
      ),
    closeMethod: "escape",
  },
  {
    label: "Header mobile menu",
    open: (page) =>
      triggerUntilDialogFound(page, async () => {
        const btn = page.getByRole("button", { name: "Toggle menu" });
        // Guard against re-toggling an already-open drawer shut on a retry
        // (this trigger is a plain onClick, not an idempotent "open" event).
        if ((await btn.getAttribute("aria-expanded")) !== "true") {
          await btn.click();
        }
      }),
    closeMethod: "button",
    // The hamburger trigger itself is `md:hidden`.
    availableAt: (width) => width < 768,
  },
  {
    label: "Stress Relief Division (IDDQD)",
    open: (page) =>
      // useIDDQD (easterEggs.js) buffers plain keydown chars app-wide - no
      // input needs focus. Retyping the full 5-char code is safe: its
      // rolling last-5-chars buffer ends in "iddqd" after any full retry
      // regardless of what a half-caught previous attempt left behind.
      triggerUntilDialogFound(page, () => page.keyboard.type("iddqd")),
    closeMethod: "button",
  },
];

/**
 * Reads the currently-open dialog straight from the DOM (see the block
 * comment above) and tags it plus its close control (if any) with a
 * throwaway data attribute so the caller can build Playwright locators for
 * the real-tap / visibility assertions below.
 */
async function probeOpenDialog(page: Page): Promise<{
  found: boolean;
  titleRect: Rect | null;
  hasCloseControl: boolean;
  closeRect: Rect | null;
  lunaVisible: boolean;
}> {
  return page.evaluate(() => {
    const dialog = document.querySelector(
      '[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]',
    ) as HTMLElement | null;
    if (!dialog) {
      return {
        found: false,
        titleRect: null,
        hasCloseControl: false,
        closeRect: null,
        lunaVisible: false,
      };
    }
    dialog.setAttribute("data-e2e-probe-dialog", "1");

    const labelledBy = dialog.getAttribute("aria-labelledby");
    const titleEl =
      (labelledBy && document.getElementById(labelledBy)) ||
      dialog.querySelector("h1, h2, h3");
    let titleRect: Rect | null = null;
    if (titleEl) {
      const r = titleEl.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        titleRect = {
          left: r.left,
          top: r.top,
          right: r.right,
          bottom: r.bottom,
        };
      }
    }

    const closeBtn = Array.from(dialog.querySelectorAll("button")).find((b) =>
      /close|exit/i.test(b.getAttribute("aria-label") || ""),
    ) as HTMLElement | undefined;
    let closeRect: Rect | null = null;
    if (closeBtn) {
      closeBtn.setAttribute("data-e2e-probe-close", "1");
      const r = closeBtn.getBoundingClientRect();
      closeRect = {
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
      };
    }

    const luna = document.querySelector(
      '.luna-toast, [aria-label="Dismiss Luna"]',
    ) as HTMLElement | null;
    const lunaVisible = !!luna && luna.offsetParent !== null;

    return {
      found: true,
      titleRect,
      hasCloseControl: !!closeBtn,
      closeRect,
      lunaVisible,
    };
  });
}

for (const vp of BYPASS_TEST_VIEWPORTS) {
  test.describe(`Bypass dialogs vs Quick Exit @ ${vp.width}px (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      await page.addInitScript((appVersion) => {
        localStorage.setItem("vet-rate-tos-accepted", "true");
        localStorage.setItem("vet_rate_last_seen_version", appVersion);
        localStorage.setItem("vetrate-tour-completed", "true");
        localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
      }, APP_VERSION);
      await page.goto("/");
      await dismissDisclaimer(page);
    });

    for (const dialog of BYPASS_DIALOGS) {
      if (dialog.availableAt && !dialog.availableAt(vp.width)) continue;

      test(`${dialog.label}: title/close clear of Quick Exit, close control works, Luna absent`, async ({
        page,
      }) => {
        await dialog.open(page);

        const probe = await probeOpenDialog(page);
        expect(probe.found).toBe(true);

        // N5: no dialog should ever be sharing the screen with Luna.
        expect(probe.lunaVisible).toBe(false);

        const qeRect = await elementRect(page, QUICK_EXIT_SELECTOR);
        expect(qeRect).not.toBeNull();

        if (probe.titleRect) {
          expect(rectsIntersect(qeRect!, probe.titleRect)).toBe(false);
        }

        const dialogSelector = '[data-e2e-probe-dialog="1"]';
        const closeSelector = '[data-e2e-probe-close="1"]';

        if (dialog.closeMethod === "button") {
          expect(probe.hasCloseControl).toBe(true);
          expect(probe.closeRect).not.toBeNull();
          expect(rectsIntersect(qeRect!, probe.closeRect!)).toBe(false);

          // The close control must lie fully inside the viewport (the
          // Observation fix: Muster Call's and About Us's close buttons sat
          // partly off-screen at 320-390px).
          expect(probe.closeRect!.left).toBeGreaterThanOrEqual(-0.5);
          expect(probe.closeRect!.right).toBeLessThanOrEqual(vp.width + 0.5);

          await expect
            .poll(async () => (await centerHitsSelf(page, closeSelector)).hit, {
              timeout: 5000,
            })
            .toBe(true);

          await page.locator(closeSelector).click();
          await expect(page.locator(dialogSelector)).toBeHidden({
            timeout: 5000,
          });
        } else if (dialog.closeMethod === "escape") {
          await page.keyboard.press("Escape");
          await expect(page.locator(dialogSelector)).toBeHidden({
            timeout: 5000,
          });
        }
        // "none" (Crisis Modal): intentionally non-dismissible, nothing to close.

        // Quick Exit itself must stay reachable throughout - it's a
        // panic-exit safety control, not a decoration.
        await expect(page.locator(QUICK_EXIT_SELECTOR)).toBeVisible();
      });
    }
  });
}

// N10 (QA final9): the ≤640px `.modal-content .flex.gap-2/3 > button`
// min-width rule (index.css) could widen and push off-screen the close
// button of *any* ResponsiveModal-based tool dialog, not just the 22 QA
// happened to hit-test. Reuses the DOM-enumeration approach above
// (probeOpenDialog/dispatchTrigger/triggerUntilDialogFound) against the
// whole tool-grid dialog inventory this file already catalogues for other
// assertions (MODALS, MIGRATED_MODALS, TOOL_HEADERS) - not a fourth
// hand-kept list - plus three dialogs among QA's 22 that had no e2e trigger
// yet (AI Command Center, Claim Stress Test, Denial Decoder). Deduped by
// event: several dialogs are catalogued in more than one array above (e.g.
// TOOL_HEADERS re-lists some MODALS entries for the Quick Exit check), and
// each should only be opened once per width here.
const TOOL_GRID_DIALOG_EVENTS: { label: string; event: string }[] = (() => {
  const merged = [
    ...MODALS,
    ...MIGRATED_MODALS,
    ...TOOL_HEADERS.map(({ label, event }) => ({ label, event })),
    { label: "AI Command Center", event: "openAISettings" },
    { label: "Claim Stress Test", event: "openClaimStressTest" },
    { label: "Denial Decoder", event: "openDenialDecoder" },
  ];
  const seen = new Set<string>();
  return merged.filter(({ event }) => {
    if (seen.has(event)) return false;
    seen.add(event);
    return true;
  });
})();

for (const vp of QUICK_EXIT_VIEWPORTS) {
  test.describe(`Tool-grid dialog close buttons stay on-screen @ ${vp.width}px (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      await page.addInitScript((appVersion) => {
        localStorage.setItem("vet-rate-tos-accepted", "true");
        localStorage.setItem("vet_rate_last_seen_version", appVersion);
        localStorage.setItem("vetrate-tour-completed", "true");
        localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
      }, APP_VERSION);
      await page.goto("/");
      await dismissDisclaimer(page);
    });

    for (const dialog of TOOL_GRID_DIALOG_EVENTS) {
      test(`${dialog.label}: close control fully on-screen, no page horizontal overflow`, async ({
        page,
      }) => {
        await triggerUntilDialogFound(
          page,
          dispatchTrigger(page, dialog.event),
        );

        const probe = await probeOpenDialog(page);
        expect(probe.found).toBe(true);

        // The × must be fully inside the viewport - not clipped or pushed
        // past the right edge by the min-width rule (N10).
        if (probe.hasCloseControl) {
          expect(probe.closeRect).not.toBeNull();
          expect(probe.closeRect!.left).toBeGreaterThanOrEqual(-0.5);
          expect(probe.closeRect!.right).toBeLessThanOrEqual(vp.width + 0.5);
        }

        // No dialog may force the page itself to scroll sideways.
        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(overflow.scrollWidth).toBeLessThanOrEqual(
          overflow.innerWidth + 1,
        );
      });
    }
  });
}

// CrisisModal-specific content check (320x568): the panic-exit gutter fix
// (CrisisModal.jsx) must not come at the cost of the hotline actions
// themselves - QA's other stated requirement for N4's highest-priority
// item. Kept separate from the generic loop above since it inspects
// CrisisModal's own content, not just its title/Quick-Exit geometry.
test.describe("Crisis Modal content stays reachable at 320x568", () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test("call/text/chat actions and the hotline number are all reachable", async ({
    page,
  }) => {
    await page.addInitScript((appVersion) => {
      localStorage.setItem("vet-rate-tos-accepted", "true");
      localStorage.setItem("vet_rate_last_seen_version", appVersion);
      localStorage.setItem("vetrate-tour-completed", "true");
      localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
    }, APP_VERSION);
    await page.goto("/");
    await dismissDisclaimer(page);

    const crisisModal = BYPASS_DIALOGS.find((d) => d.label === "Crisis Modal");
    await crisisModal!.open(page);

    const callButton = page.getByRole("button", {
      name: "Call Veterans Crisis Line",
    });
    const chatButton = page.getByRole("button", {
      name: "Start online chat with Veterans Crisis Line",
    });
    await expect(callButton).toBeVisible({ timeout: 5000 });

    // `overflow-hidden` (pre-fix) could clip content past the fold with no
    // way to scroll to it; scrollIntoViewIfNeeded + toBeInViewport proves
    // it's actually reachable now, not just present in the DOM.
    await callButton.scrollIntoViewIfNeeded();
    await expect(callButton).toBeInViewport();
    await chatButton.scrollIntoViewIfNeeded();
    await expect(chatButton).toBeInViewport();
  });
});
