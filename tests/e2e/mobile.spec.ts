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

// N13: the close-X-stays-top-right sweep runs at the four QUICK_EXIT_VIEWPORTS
// widths plus a desktop width - the "safety net" regression this guards
// against (a wrapped cluster landing left-aligned on its own row) reproduces
// at both a narrow phone AND a wide desktop header once the title/cluster
// text is long enough to wrap, so a phone-only sweep could miss a desktop-only
// regression.
const HEADER_ALIGNMENT_VIEWPORTS = [
  ...QUICK_EXIT_VIEWPORTS,
  { name: "desktop", width: 1440, height: 900 },
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
// 640x800/700x900: Header mobile menu (opened by click, not a bare open*
// event, so the DOM-enumerated tool-grid sweep above never reaches it) has
// the same sm/md gutter mismatch AboutUs/UserManual had - its own mobile
// header stays mounted (md:hidden drawer) through 767px while its gutter
// used to drop at sm: (640px), the same width Quick Exit moves to
// top-right, so 640-767px had zero clearance (measured collision at both
// widths, fixed in Header.jsx).
const BYPASS_TEST_VIEWPORTS = [
  ...QUICK_EXIT_VIEWPORTS,
  { name: "sm-boundary", width: 640, height: 800 },
  { name: "sm-boundary-tall", width: 700, height: 900 },
  DESKTOP_VIEWPORT,
];

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

/**
 * True once *any* modal dialog is in the DOM - excluding the one-time
 * DisclaimerSplash. Without this exclusion, a slow-to-dismiss splash (the
 * dismissDisclaimer race documented on that helper) satisfies this check on
 * its own, and every caller below moves on to probe the splash instead of
 * the tool dialog it actually triggered.
 */
async function anyDialogProbe(page: Page): Promise<{ found: boolean }> {
  return {
    found: await page.evaluate(
      () =>
        Array.from(
          document.querySelectorAll(
            '[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]',
          ),
        ).filter((d) => d.getAttribute("aria-labelledby") !== "splash-title")
          .length > 0,
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

function dispatchTrigger(
  page: Page,
  event: string,
  detail?: unknown,
): () => Promise<void> {
  return () =>
    page.evaluate(
      ({ evt, detail }) =>
        window.dispatchEvent(
          detail === undefined
            ? new CustomEvent(evt)
            : new CustomEvent(evt, { detail }),
        ),
      { evt: event, detail },
    );
}

/**
 * Runs `trigger` and probes with `probeFn`, retrying the pair up to twice
 * more if the probe comes back empty. `triggerUntilDialogFound` only proves
 * a dialog existed at poll time - a separate dialog that opens and then
 * closes itself before the follow-up `probeFn` call runs (an open, real,
 * still-uninvestigated race - see the mobile.spec.ts N12 flakiness notes)
 * would otherwise fail the whole test on a dialog that was never actually
 * broken.
 */
async function triggerAndProbe<T extends { found: boolean }>(
  page: Page,
  trigger: () => Promise<void>,
  probeFn: (page: Page) => Promise<T>,
): Promise<T> {
  let probe: T;
  for (let attempt = 0; attempt < 3; attempt++) {
    await triggerUntilDialogFound(page, trigger);
    probe = await probeFn(page);
    if (probe.found) return probe;
  }
  return probe!;
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

// N15: true DOM enumeration of the tool grid, replacing the hand-kept
// TOOL_GRID_DIALOG_EVENTS array above (which reused MODALS/MIGRATED_MODALS/
// TOOL_HEADERS plus a handful of hand-added entries). Opens the home page -
// the tool grid (HomeFeatureCards) and the site footer are both
// unconditionally in the DOM there, no dropdown/drawer interaction needed -
// enumerates every real `<button>` inside them, clicks each one for real
// (not a synthetic `dispatchEvent`), and probes whatever dialog actually
// appears via `probeHeaderLayout` (below). Fails loudly - never a vacuous
// pass - when a launcher opens no dialog and isn't on the explicit
// NO_DIALOG_LAUNCHERS allow-list, or when an opened dialog's title can't be
// resolved. Never measures the DisclaimerSplash (excluded the same way
// `anyDialogProbe` already excludes it elsewhere in this file).
//
// Scope note (openIssues, corrected - a prior version of this note both
// mis-listed two real grid launchers as header-only and missed most of the
// actual gap; PARTIALLY addressed by N16, see MENU_SURFACES/
// enumerateHeaderMenuLaunchers below - kept for history, not "RESOLVED": the
// header's own Tools/Resources dropdown menus and the mobile hamburger
// drawer were a separate nav surface this sweep did not open, and 23 dialogs
// were reachable only from there (or, for My Packet, the bottom nav - that
// surface specifically is still outside this sweep, N16 only added the
// header menus/drawer): AI Command Center, Appeals Lane Advisor, Ask the
// Regs, Backup Manager, Body Map Selector, Cloud Sync Manager, Community
// Roadmap, Consistency Engine, DD214 Analyzer, Feature Request, My Packet,
// Nexus Builder, Nexus Quality Analyzer, Record Search, Remand Risk Checker,
// VA Resources, VKB Timeline, VKB Viewer, Vision Simulator, What-If Sandbox.
// (Global Command Search is covered via `BYPASS_DIALOGS`; Claim Navigator and
// Denial Decoder get their own targeted N12/N13 coverage below, since that
// branch specifically touches their placement. Claim Stress Test and The
// Tribunal were never part of this gap - both are real grid launchers and
// were already fully covered by this sweep.)
//
// Still open after N16, not yet fixed (two distinct residual gaps, tracked
// rather than rushed - each needs its own pass, not a quick bolt-on here):
// (a) the phone-width sweeps (QUICK_EXIT_VIEWPORTS, 320-430px) only ever see
// the 4-item mobile drawer, so the header-collision/on-screen checks never
// run against the six dialogs reachable *only* through the desktop-only
// Tools/Resources panels (Appeals Lane Advisor, Consistency Engine, Nexus
// Builder, Record Search, Remand Risk Checker, What-If Sandbox) at any phone
// width - only the 1024/1280/1440 desktop checks reach them; (b) launchers
// that live directly in QuickActionsRow/LowerHeaderRow rather than inside a
// MENU_SURFACES panel - My Packet, AI Settings, AI Command Center, Community
// Roadmap, Feature Request - are enumerated by neither the grid/footer sweep
// nor MENU_SURFACES, at any viewport.
// Kept as two named selectors (not just the union below) so the sweep can
// assert each surface independently has launchers - a routine restyle of
// HomeFeatureCards' wrapper classes would otherwise silently zero out the
// 32 grid launchers while the 13 footer buttons alone keep the union
// non-empty, and the whole grid's worth of coverage would drop with no
// failure anywhere.
const TOOL_GRID_ONLY_SELECTOR = "#main-content .mt-12.max-w-4xl.mx-auto button";
const FOOTER_ONLY_SELECTOR = 'footer[role="contentinfo"] button';
const TOOL_GRID_SELECTOR = `${TOOL_GRID_ONLY_SELECTOR}, ${FOOTER_ONLY_SELECTOR}`;

/**
 * Launcher buttons - `TOOL_GRID_SELECTOR`'s grid/footer buttons, or (N16)
 * any button inside a `MENU_SURFACES` panel - that legitimately open no
 * dialog. Every button either sweep matches dispatches a real `open*` event
 * (audited directly against Header.jsx's source for the menu/drawer panels
 * specifically - every onClick in ToolsMenuPanel/ResourcesMenuPanel/the
 * mobile drawer's four sections calls a real `onXClick` handler; the only
 * buttonless items are `<a>` external links, which `MENU_SURFACES`' own
 * `button`-only selectors never match in the first place) except the one
 * listed below. Add a label here (with a comment explaining why) if a
 * future launcher legitimately doesn't - anything NOT listed here that opens
 * no dialog fails the sweep instead of silently passing.
 */
const NO_DIALOG_LAUNCHERS = new Set<string>([
  // Same VITE_VA_API_ENABLED-off-by-default gate as quick-exit-wide.spec.ts's
  // own BUILD_GATED_EVENTS ("openVaIntegrationDemo" never registers a
  // listener in the default build) - Header.jsx's own onClick prop for this
  // button is conditionally `undefined` when the flag is off
  // (`isVaApiEnabled() ? dispatch(...) : undefined` in AppHeader.jsx), so a
  // real click here is a genuine no-op, not a defect.
  "🔗 VA.gov IntegrationDEMOConnect to VA.gov APIs (OAuth 2.0)",
]);

/**
 * Dialogs (keyed by their own `aria-labelledby` id, not the launcher's own
 * label - rarely the same string) that by design have no header close-X.
 * Mission Protocol's full-width CTA + ESC/backdrop dismiss is a deliberate
 * consent-style "trust beacon" (N13 openIssues), not a bug this sweep
 * should fail on.
 */
const NO_CLOSE_BY_DESIGN = new Set<string>(["mission-protocol-title"]);

const NON_SPLASH_DIALOG_SELECTOR =
  '[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]';

/**
 * True once a *real* dialog (not the splash, not the header's own
 * mobile-menu drawer - see `findProbeBundle`'s identical exclusion for why
 * the drawer needs to be excluded here too) is in the DOM. N16's header-menu
 * sweep uses this instead of the plain `someDialogOpen` above: that one
 * only excludes the splash, and the drawer (`role="dialog"` itself, N16's
 * own enumeration surface) can still be mid-unmount at the exact moment a
 * freshly-opened tool dialog also exists.
 */
function someRealDialogOpen(page: Page, timeout: number): Promise<boolean> {
  return page
    .waitForFunction(
      ({ sel }) =>
        Array.from(document.querySelectorAll(sel)).some(
          (d) =>
            d.getAttribute("aria-labelledby") !== "splash-title" &&
            d.getAttribute("aria-labelledby") !== "mobile-menu-title",
        ),
      { sel: NON_SPLASH_DIALOG_SELECTOR },
      { timeout },
    )
    .then(() => true)
    .catch(() => false);
}

type GridLauncher = { index: number; label: string };

/**
 * A launcher the sweep can process regardless of where it actually lives -
 * a tool-grid/footer button (always present in the DOM, opened by index)
 * or a header-menu/mobile-drawer item (opened by re-opening its menu fresh
 * each time - see `openMenuLauncherUntilDialog`). `processSweepLauncher`
 * only ever needs `label` and `open`; the two enumerators below build these
 * from their own, differently-shaped launcher lists.
 */
type SweepLauncher = { label: string; open: (page: Page) => Promise<boolean> };

type MenuSurface = {
  key: string;
  triggerSelector: string;
  panelSelector: string;
};

/**
 * N16: the header's own Tools/Resources dropdown menus and the mobile
 * hamburger drawer, the 23-dialog gap the tool-grid enumeration above
 * doesn't reach (see its own scope-note comment). Tools/Resources are
 * desktop-only (`hidden md:flex`-style) and the hamburger is mobile-only -
 * never more than one or two of these three are actually visible/openable
 * at a given viewport; `openMenuSurface` skips a surface whose trigger
 * isn't visible rather than failing on it.
 */
const MENU_SURFACES: MenuSurface[] = [
  {
    key: "tools",
    triggerSelector: '[data-e2e-menu-trigger="tools"]',
    panelSelector: '[data-e2e-menu-panel="tools"]',
  },
  {
    key: "resources",
    triggerSelector: '[data-e2e-menu-trigger="resources"]',
    panelSelector: '[data-e2e-menu-panel="resources"]',
  },
  {
    key: "mobile-drawer",
    triggerSelector: '[data-e2e-menu-trigger="mobile-drawer"]',
    panelSelector: '[data-e2e-menu-panel="mobile-drawer"]',
  },
];

const MENU_ITEM_INDEX_ATTR = "data-e2e-menu-item-index";

/**
 * Opens `surface`'s panel and (re-)stamps every real `<button>` inside it
 * with `MENU_ITEM_INDEX_ATTR`, in DOM order - same restamp-before-every-use
 * pattern `stampToolGridButtons` uses, for a stronger reason here: opening
 * any item inside also closes the menu (that item's own onClick side
 * effect, matching every tool-grid launcher's own idempotent-open
 * assumption elsewhere in this file), so a stale index from a previous open
 * can never be reused across opens - this must run fresh immediately before
 * every single click, not once upfront. Returns false (skip, not fail) when
 * `surface`'s trigger isn't visible at all - the expected case for two of
 * the three surfaces at any given viewport (see `MENU_SURFACES`).
 */
async function openMenuSurface(
  page: Page,
  surface: MenuSurface,
): Promise<boolean> {
  const trigger = page.locator(surface.triggerSelector);
  if (!(await trigger.isVisible().catch(() => false))) return false;
  await trigger.click({ timeout: 3000 }).catch(() => {});
  const opened = await page
    .locator(surface.panelSelector)
    .first()
    .waitFor({ state: "visible", timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  if (!opened) return false;
  await page.evaluate(
    ({ sel, attr }) =>
      Array.from(document.querySelectorAll(sel)).forEach((b, i) =>
        b.setAttribute(attr, String(i)),
      ),
    { sel: `${surface.panelSelector} button`, attr: MENU_ITEM_INDEX_ATTR },
  );
  return true;
}

/**
 * Same idempotent-retry shape as `openLauncherUntilDialog` below, adapted
 * for a launcher that lives behind a menu that must be freshly (re-)opened
 * before every attempt (see `openMenuSurface`) instead of always being
 * present in the DOM already.
 */
async function openMenuLauncherUntilDialog(
  page: Page,
  surface: MenuSurface,
  index: number,
): Promise<boolean> {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (!(await openMenuSurface(page, surface))) continue;
    await page
      .locator(`[${MENU_ITEM_INDEX_ATTR}="${index}"]`)
      .click({ timeout: 3000 })
      .catch(() => {});
    if (await someRealDialogOpen(page, 1000)) return true;
  }
  return false;
}

/**
 * Every real launcher `<button>` currently inside `surface`'s panel,
 * labelled - closes the panel again afterward (its own trigger toggles it
 * shut, same as a second click on any disclosure trigger) so the page
 * returns to a clean baseline before the next surface is opened.
 */
/**
 * Closes `surface`'s panel back up after enumeration, so the page returns
 * to a clean baseline before the next surface (or the grid/menu processing
 * loop) starts. NOT a second click on the trigger for the mobile drawer:
 * its own backdrop is `fixed inset-0` (full-screen, above the header), so
 * once open it physically covers the hamburger trigger sitting behind it -
 * a click there either no-ops (actionability timeout, silently swallowed by
 * the `.catch()` a naive version of this used to have) or lands on the
 * backdrop instead and does something else entirely. Escape reliably closes
 * it instead, via its own `useFocusTrap` `onEscape` wiring (confirmed
 * working - unlike Tools/Resources, which have no such wiring and rely on
 * the trigger click). Tools/Resources aren't covered by anything, so a
 * second trigger click closes those two safely.
 */
async function closeMenuSurface(
  page: Page,
  surface: MenuSurface,
): Promise<void> {
  if (surface.key === "mobile-drawer") {
    await page.keyboard.press("Escape").catch(() => {});
  } else {
    await page
      .locator(surface.triggerSelector)
      .click({ timeout: 3000 })
      .catch(() => {});
  }
  await page
    .locator(surface.panelSelector)
    .first()
    .waitFor({ state: "hidden", timeout: 3000 })
    .catch(() => {});
}

async function enumerateMenuSurfaceLaunchers(
  page: Page,
  surface: MenuSurface,
): Promise<SweepLauncher[]> {
  if (!(await openMenuSurface(page, surface))) return [];
  const labels = await page.evaluate(
    (sel) =>
      Array.from(document.querySelectorAll(sel)).map((b) =>
        (b.textContent || b.getAttribute("aria-label") || "")
          .trim()
          .replace(/\s+/g, " "),
      ),
    `${surface.panelSelector} button`,
  );
  await closeMenuSurface(page, surface);
  return labels.map((label, index) => ({
    label,
    open: (p: Page) => openMenuLauncherUntilDialog(p, surface, index),
  }));
}

async function enumerateHeaderMenuLaunchers(
  page: Page,
): Promise<SweepLauncher[]> {
  const all: SweepLauncher[] = [];
  for (const surface of MENU_SURFACES) {
    all.push(...(await enumerateMenuSurfaceLaunchers(page, surface)));
  }
  return all;
}

const GRID_INDEX_ATTR = "data-e2e-tool-grid-index";

/**
 * (Re-)tags every real launcher button currently in the tool grid + footer
 * with a throwaway `data-e2e-tool-grid-index` attribute (same pattern as
 * `probeOpenDialog`'s own tagging above), in DOM order. Idempotent and cheap
 * enough to call again before every click rather than trusting a single
 * upfront pass to survive the whole sweep - measured live: this container
 * remounts wholesale (dev-mode React.StrictMode double-invoke, already
 * documented elsewhere in this file) within roughly the first two seconds
 * after boot, discarding every attribute a one-time stamp had just set.
 */
async function stampToolGridButtons(page: Page): Promise<void> {
  await page.evaluate(
    ({ sel, attr }) =>
      Array.from(document.querySelectorAll(sel)).forEach((b, index) =>
        b.setAttribute(attr, String(index)),
      ),
    { sel: TOOL_GRID_SELECTOR, attr: GRID_INDEX_ATTR },
  );
}

/**
 * Every real launcher button currently in the tool grid + footer, labelled.
 * Reads the count and the labels in a single round trip and retries until
 * that one read finds at least one button, rather than checking "any
 * buttons exist" and reading the list as two separate round trips -
 * measured live: the grid can go from populated to briefly empty and back
 * within a single evaluate's own latency (dev-mode React.StrictMode
 * mount/unmount/remount, documented elsewhere in this file, evidently
 * isn't always the one-shot blip its other call sites see - on this home
 * container specifically it can still be settling several seconds into
 * boot), so a check-then-read split can observe "present" and then read
 * an already-emptied grid moments later.
 */
async function enumerateToolGridButtons(page: Page): Promise<GridLauncher[]> {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const launchers = await page.evaluate((sel) => {
      const buttons = Array.from(document.querySelectorAll(sel));
      if (buttons.length === 0) return null;
      return buttons.map((b, index) => ({
        index,
        label: (b.textContent || b.getAttribute("aria-label") || "")
          .trim()
          .replace(/\s+/g, " "),
      }));
    }, TOOL_GRID_SELECTOR);
    if (launchers) {
      await stampToolGridButtons(page);
      return launchers;
    }
  }
  return [];
}

/** True once no non-splash dialog remains in the DOM, polled - not slept. */
function noDialogOpen(page: Page, timeout: number): Promise<boolean> {
  return page
    .waitForFunction(
      ({ sel }) =>
        !Array.from(document.querySelectorAll(sel)).some(
          (d) => d.getAttribute("aria-labelledby") !== "splash-title",
        ),
      { sel: NON_SPLASH_DIALOG_SELECTOR },
      { timeout },
    )
    .then(() => true)
    .catch(() => false);
}

/** True once at least one non-splash dialog is in the DOM, polled - not slept. */
function someDialogOpen(page: Page, timeout: number): Promise<boolean> {
  return page
    .waitForFunction(
      ({ sel }) =>
        Array.from(document.querySelectorAll(sel)).some(
          (d) => d.getAttribute("aria-labelledby") !== "splash-title",
        ),
      { sel: NON_SPLASH_DIALOG_SELECTOR },
      { timeout },
    )
    .then(() => true)
    .catch(() => false);
}

/**
 * Closes whatever dialog is open so the next launcher starts clean, instead
 * of stacking dialogs (which would corrupt every probe after the first one
 * that fails to close). The dialog's own close/exit button first - Escape
 * only as a last-resort fallback for a dialog with no such control (e.g.
 * Mission Protocol's by-design consent gate, NO_CLOSE_BY_DESIGN). Escape as
 * the *default* close path here would fire on nearly every one of the 45
 * launchers in this sweep in quick succession and trip the app's own
 * triple-Escape panic key (safetyRedirect.js's `handleEscapeKey`): its
 * "don't count an ESC that dismissed a dialog" guard doesn't actually
 * suppress these presses (a real, pre-existing app bug, filed separately -
 * not fixed here since it's outside this sweep's file), so three dialogs
 * closed this way redirects the whole test page to weather.com and clears
 * sessionStorage. Returns false (rather than throwing) if neither worked, so
 * the caller can record a violation and recover via a full reload instead of
 * aborting the sweep.
 */
async function closeOpenToolGridDialog(page: Page): Promise<boolean> {
  const closeBtn = page
    .locator(
      '[role="dialog"][aria-modal="true"] button[aria-label*="close" i], ' +
        '[role="dialog"][aria-modal="true"] button[aria-label*="exit" i], ' +
        '[role="alertdialog"][aria-modal="true"] button[aria-label*="close" i], ' +
        '[role="alertdialog"][aria-modal="true"] button[aria-label*="exit" i]',
    )
    .first();
  if (await closeBtn.count()) {
    await closeBtn.click({ timeout: 4000 }).catch(() => {});
    if (await noDialogOpen(page, 4000)) return true;
  }

  await page.keyboard.press("Escape");
  return noDialogOpen(page, 4000);
}

async function resetToolGridPage(page: Page): Promise<void> {
  await page.goto("/");
  await dismissDisclaimer(page);
}

/**
 * `language` (LanguageContext.jsx's `vetrate_language` key) is optional and
 * defaults to unset (English/LTR) - passing an RTL code (`ar`/`fa`/`prs`/
 * `ps`) is what N13's RTL regression test below uses to actually exercise
 * `closeTopRightViolations`' `isRtl` branch, which no committed test
 * previously set up a document `dir="rtl"` to run.
 */
async function seedReturningUserAndGoHome(
  page: Page,
  language?: string,
): Promise<void> {
  await page.addInitScript(
    ({ appVersion, language }) => {
      localStorage.setItem("vet-rate-tos-accepted", "true");
      localStorage.setItem("vet_rate_last_seen_version", appVersion);
      localStorage.setItem("vetrate-tour-completed", "true");
      localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
      localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
      if (language) localStorage.setItem("vetrate_language", language);
    },
    { appVersion: APP_VERSION, language },
  );
  await resetToolGridPage(page);
}

type GridDialogOutcome = { label: string; probe: HeaderProbe };

/**
 * Clicks the launcher at `index` repeatedly (re-stamping fresh each time)
 * until a non-splash dialog appears, rather than trusting a single click.
 * Every real `open*` listener in this app attaches via a bare
 * `useEffect(() => { window.addEventListener(...); return () =>
 * removeEventListener(...) }, [])`, and dev-mode React.StrictMode's
 * mount/unmount/remount blip (documented elsewhere in this file) briefly
 * detaches that listener between the unmount and remount - a single click
 * landing in that gap dispatches its event into the void with nothing
 * listening, and no amount of waiting afterward recovers it. Re-clicking
 * (like `triggerUntilDialogFound`/`openDialog` elsewhere in this suite)
 * is safe because every launcher here is an idempotent "open" action.
 */
async function openLauncherUntilDialog(
  page: Page,
  index: number,
): Promise<boolean> {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    await stampToolGridButtons(page);
    await page
      .locator(`[${GRID_INDEX_ATTR}="${index}"]`)
      .click({ timeout: 3000 })
      .catch(() => {});
    if (await someDialogOpen(page, 1000)) return true;
  }
  return false;
}

/**
 * One launcher's full open/probe/close cycle, pushed onto `violations`
 * rather than returned/thrown - an unexpected exception here (a genuinely
 * broken action, not a geometry finding) becomes a violation entry plus a
 * recovery reload instead of crashing the whole sweep and losing every
 * launcher after it. Takes a `SweepLauncher` (just a label + an `open`
 * function) rather than a `GridLauncher` directly - N16's header-menu
 * launchers open via a completely different mechanism (re-opening a menu,
 * not clicking an always-present indexed button), and this cycle is
 * otherwise identical for either kind.
 */
async function processSweepLauncher(
  page: Page,
  launcher: SweepLauncher,
  onDialog: (outcome: GridDialogOutcome) => Promise<string[]>,
  violations: string[],
): Promise<void> {
  try {
    if (!(await launcher.open(page))) {
      if (!NO_DIALOG_LAUNCHERS.has(launcher.label)) {
        violations.push(
          `"${launcher.label}" opened no dialog and is not on NO_DIALOG_LAUNCHERS`,
        );
      }
      // A full reload (not just moving on) guards against a slow dev-server
      // lazy-chunk compile finishing after this gives up and mounting its
      // dialog late, on top of whatever the next launcher was trying to
      // check - a stale reference in an unloaded document is a no-op, so
      // this is a clean slate regardless of whether that race is what
      // actually happened here.
      await resetToolGridPage(page).catch(() => {});
      return;
    }

    const probe = await probeHeaderLayout(page);
    if (!probe.found) {
      violations.push(
        `"${launcher.label}": dialog opened but its title/header could not be resolved`,
      );
    } else {
      violations.push(...(await onDialog({ label: launcher.label, probe })));
    }

    if (!(await closeOpenToolGridDialog(page))) {
      violations.push(
        `"${launcher.label}": dialog did not close via Escape or its own close control`,
      );
      await resetToolGridPage(page);
    }
  } catch (err) {
    violations.push(
      `"${launcher.label}": unexpected error - ${err instanceof Error ? err.message : String(err)}`,
    );
    await resetToolGridPage(page).catch(() => {});
  }
}

function toSweepLauncher(launcher: GridLauncher): SweepLauncher {
  return {
    label: launcher.label || `button #${launcher.index}`,
    open: (page) => openLauncherUntilDialog(page, launcher.index),
  };
}

async function runToolGridSweep(
  page: Page,
  onDialog: (outcome: GridDialogOutcome) => Promise<string[]>,
): Promise<string[]> {
  const violations: string[] = [];
  const gridLaunchers = await enumerateToolGridButtons(page);
  expect(gridLaunchers.length).toBeGreaterThan(0);
  // The union assertion above passes vacuously if either surface alone goes
  // to zero - assert both independently so a grid-only (or footer-only)
  // regression fails loudly instead of quietly running a smaller sweep.
  // Auto-retrying locator assertions (not a one-shot `.count()` read): the
  // home grid's own dev-mode React.StrictMode remount blip (documented on
  // `enumerateToolGridButtons` above) can land the count at 0 for a moment
  // even when the grid is fine, and a one-shot read caught exactly that.
  await expect(page.locator(TOOL_GRID_ONLY_SELECTOR)).not.toHaveCount(0);
  await expect(page.locator(FOOTER_ONLY_SELECTOR)).not.toHaveCount(0);

  // N16: the header's Tools/Resources menus + the mobile drawer, on top of
  // the grid/footer above - closes the "23 dialogs reachable only from
  // there" gap the scope-note above `enumerateToolGridButtons` used to
  // document. Asserted non-empty for the same reason the grid/footer are
  // above: Header.jsx's DesktopNav (`hidden md:flex`, wraps Tools +
  // Resources) and MobileMenuButton (`md:hidden`, the drawer trigger) are
  // exact complements, so at every width at least one of the three
  // `MENU_SURFACES` is visible and openable - a run where the enumeration
  // comes back empty is always a real regression (a renamed data-e2e-menu-*
  // attribute, or a trigger click silently swallowed by `openMenuSurface`'s
  // own `.catch()`), never a legitimate "nothing to check here" outcome.
  const menuLaunchers = await enumerateHeaderMenuLaunchers(page);
  expect(menuLaunchers.length).toBeGreaterThan(0);

  const launchers: SweepLauncher[] = [
    ...gridLaunchers.map(toSweepLauncher),
    ...menuLaunchers,
  ];

  for (const launcher of launchers) {
    await test.step(launcher.label, () =>
      processSweepLauncher(page, launcher, onDialog, violations),
    );
  }
  return violations;
}

/**
 * The × must be fully inside the viewport - not clipped or pushed past the
 * right edge by the ≤640px `.modal-content .flex.gap-2/3 > button` min-width
 * rule (index.css, N10) - and no dialog may force the page itself to scroll
 * sideways.
 */
async function onScreenViolations(
  page: Page,
  vpWidth: number,
  outcome: GridDialogOutcome,
): Promise<string[]> {
  const violations: string[] = [];
  const r = outcome.probe.closeRect;
  const noCloseByDesign =
    !!outcome.probe.dialogId && NO_CLOSE_BY_DESIGN.has(outcome.probe.dialogId);
  if (r) {
    if (r.left < -0.5 || r.right > vpWidth + 0.5) {
      violations.push(
        `"${outcome.label}": close control not fully on-screen (left=${r.left.toFixed(1)}, right=${r.right.toFixed(1)}, viewport=${vpWidth})`,
      );
    }
  } else if (!noCloseByDesign) {
    // Without this, a dialog whose close-X regresses to "not found" at this
    // viewport silently passes (nothing to compare against `vpWidth`) - the
    // same "fail loudly, never vacuously" rule N13's `closeTopRightViolations`
    // already applies.
    violations.push(`"${outcome.label}": close control not found`);
  }
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  if (overflow.scrollWidth > overflow.innerWidth + 1) {
    violations.push(
      `"${outcome.label}": page scrolls horizontally (scrollWidth=${overflow.scrollWidth}, innerWidth=${overflow.innerWidth})`,
    );
  }
  return violations;
}

for (const vp of QUICK_EXIT_VIEWPORTS) {
  test.describe(`Tool-grid dialog close buttons stay on-screen @ ${vp.width}px (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("every launcher's close control stays on-screen, no page horizontal overflow", async ({
      page,
    }) => {
      test.setTimeout(600_000);
      await seedReturningUserAndGoHome(page);
      const violations = await runToolGridSweep(page, (outcome) =>
        onScreenViolations(page, vp.width, outcome),
      );
      expect(violations).toEqual([]);
    });
  });
}

type HeaderProbe = {
  found: boolean;
  // The dialog's own `aria-labelledby` target id, when it has one - a
  // stable identity to key a known-exception allow-list on (e.g. Mission
  // Protocol's by-design missing close-X) instead of the launcher button's
  // own label, which rarely matches the dialog's title text.
  dialogId: string | null;
  // False for a dialog with no discoverable `.modal-header`/
  // `[data-modal-header]` landmark at all (e.g. User Manual's >=md two-pane
  // layout) - `closeTopRightViolations` skips its "on the header's first
  // line" check in that case, since there's no header line for the close-X
  // to be on or off of; the end-edge alignment check still applies.
  hasHeaderLandmark: boolean;
  // Document reading direction at probe time - `closeTopRightViolations`
  // measures against the header's right edge in `ltr`, left edge in `rtl`
  // (decision (1): the close-X sits at the header's top END corner, which
  // physically flips under RTL).
  direction: "ltr" | "rtl";
  titleClipped: boolean;
  // One rect per wrapped line, not a single bounding box: a wide line 1 +
  // short line 2 (the badge's line) would otherwise union into an L-shaped
  // box whose bounding rect's right edge sits far past line 2's actual
  // content, making an adjacent-not-overlapping badge look "contained".
  titleTextRects: Rect[] | null;
  badgeRect: Rect | null;
  bugLinkRect: Rect | null;
  closeRect: Rect | null;
  backRect: Rect | null;
  aiStatusRect: Rect | null;
  llmBadgeRect: Rect | null;
  shareRect: Rect | null;
  // The header's padding-adjusted content box (not its raw, undecorated
  // outer box) - the reference frame the N13 top-right-pin assertion
  // measures the close control against, so a header's own intentional
  // padding (e.g. px-6) isn't mistaken for the close control drifting.
  headerRect: Rect | null;
};

/**
 * N12 (QA final10): VAResources/CAPSimulator/NexusBuilder pinned their
 * header's Bug-link+close cluster with `absolute`, painting it over the
 * title/badge the surrounding normal-flow layout put underneath - plain
 * bounding-box geometry can't otherwise tell "adjacent" from "stacked".
 * Title text is isolated from a trailing badge via a DOM Range: the badge
 * is normally a `<span>` *inside* the heading, so the heading's own rect
 * always contains it, and that nesting isn't the defect - a naive
 * parent/child rect check would fail every dialog that has a badge at all.
 *
 * Independent-audit follow-up: the AIStatusBadge ("No AI" etc.),
 * LLMRecommendationBadge, ShareButton and "Go back" controls are now probed
 * too (TheTribunal's BETA badge collided with AIStatusBadge and neither the
 * original probe nor its dialog inventory could see it). Badge search is
 * scoped to `.modal-header` - the wrapper ResponsiveModal always renders
 * around both its `header` and default `title` slots - instead of only the
 * heading, so a BETA badge painted outside the `<h2>` is no longer invisible
 * either. A dialog with no discoverable title now fails outright instead of
 * reporting `found: true` with every part null and nothing left to compare.
 *
 * The trailing-badge exclusion above generalizes to every tracked part, not
 * just the amber BETA span: SymptomLogger nests its AIStatusBadge directly
 * inside the `<h2>` alongside the BETA badge, so a range that only cut
 * before the amber span still counted the AIStatusBadge as "title" *and*
 * compared it against the separately-probed `aiStatusRect` - a guaranteed
 * self-collision on a dialog with no real defect.
 */
/** All-null probe result - a constant, so it doesn't count against the
 * max-lines-per-function budget of the (already long) probe below. */
const EMPTY_HEADER_PROBE: HeaderProbe = {
  found: false,
  dialogId: null,
  hasHeaderLandmark: false,
  direction: "ltr",
  titleClipped: false,
  titleTextRects: null,
  badgeRect: null,
  bugLinkRect: null,
  closeRect: null,
  backRect: null,
  aiStatusRect: null,
  llmBadgeRect: null,
  shareRect: null,
  headerRect: null,
};

// N14: both functions below are passed straight to `page.evaluateHandle`/
// `JSHandle.evaluate`, which serializes each with `.toString()` and re-runs
// it inside the browser realm - it can only ever see its own body, not
// sibling functions or outer closure variables (verified live: a
// stringified function calling a same-file sibling throws `ReferenceError`
// in the browser, it doesn't inline it). So each is fully self-contained,
// and `probeHeaderLayout` chains them via a single `page.evaluateHandle` +
// `JSHandle.evaluate` round trip (not one per lookup - each extra
// evaluate/evaluateHandle hop is a real IPC round trip, and the more of
// them stack up before the close button's own rect is finally read, the
// more often a dialog whose close button mounts a beat after its title
// loses that race; measured live going from 1 round trip to 4 turned 2
// flaky failures into 11 on an identical, unrelated-to-N14 baseline sweep).
//
// `isRendered` (not just "exists") is the load-bearing check in both.
// A `md:hidden` mobile-only header (User Manual) still resolves a computed
// `paddingRight` and still matches a close-button label query even while
// `display: none` - only `getClientRects().length` reflects that it isn't
// actually rendered. Without it, the padding walk below stops on the hidden
// header and the close-button search grabs its (also hidden, zero-rect)
// close button first, so every downstream check compares against an
// all-zero rect and passes vacuously instead of measuring the real, visible
// control.
type ProbeBundle = {
  titleEl: HTMLElement;
  headerRegion: HTMLElement;
  paddedSource: HTMLElement;
  dialogId: string | null;
  // False when no `.modal-header`/`[data-modal-header]` landmark exists at
  // all (e.g. User Manual's >=md two-pane layout, which by design has no
  // unified top bar - see UserManualDesktopCloseButton) - `headerRegion` is
  // then just the dialog panel itself, not a real header, so callers that
  // assume "the header's first line" (N13's top-offset check) shouldn't
  // apply that assumption to it.
  hasHeaderLandmark: boolean;
} | null;

/**
 * Resolves the dialog, its title, the visible header region (`.modal-header`,
 * `[data-modal-header]`, or a bare semantic `<header>`), and (N13) the first
 * visible, padded ancestor within it - a header's own real breathing room
 * (often px-6/p-6, a normal design choice) lives one or more levels down the
 * header landmark's own (deliberately zero-padding) box, so this walks
 * zero-padding wrappers until one carries padding, skipping any hidden
 * sibling/child so a mobile-only header can't win by being first in DOM
 * order (N14). Capped at 5 levels so a genuinely paddingless header can't
 * walk into unrelated body content. `[data-modal-header]`/`<header>` cover
 * real headers that (like AboutUs's/Claim Navigator's) don't go through
 * ResponsiveModal's shared `.modal-header` wrapper - without a landmark at
 * all, this walk has no signal to distinguish a real header from an
 * unrelated zero-padding control (a dialog's own floating close button, for
 * one - the walk landed there on User Manual's >=md layout, comparing its
 * close-X rect against its own icon), so it doesn't run: `paddedSource`
 * stays the dialog panel itself.
 */
function findProbeBundle(): ProbeBundle {
  const isRendered = (el: Element) => el.getClientRects().length > 0;
  // `:not(...)` excludes the DisclaimerSplash and (N16) the header's own
  // mobile-menu drawer the same way `someDialogOpen`/`noDialogOpen` already
  // do (this dialog match can't reference their shared
  // `NON_SPLASH_DIALOG_SELECTOR` constant - see the N14 comment above
  // `ProbeBundle`, this function has no access to outer module scope once
  // Playwright re-runs it in the browser). The drawer is `role="dialog"`
  // too (it traps focus/blocks the background like one) but N16's header-
  // menu sweep opens it purely as an enumeration surface to reach the real
  // dialogs behind it, not as something to probe itself - without this it
  // can still be mid-close (its own onClick already fired, closing it, but
  // React hasn't unmounted it yet) at the exact moment a freshly-opened
  // tool dialog also exists, and `document.querySelector` would return
  // whichever of the two happens to sit first in DOM order.
  const dialog = document.querySelector(
    '[role="dialog"][aria-modal="true"]:not([aria-labelledby="splash-title"]):not([aria-labelledby="mobile-menu-title"]), [role="alertdialog"][aria-modal="true"]:not([aria-labelledby="splash-title"]):not([aria-labelledby="mobile-menu-title"])',
  ) as HTMLElement | null;
  const labelledBy = dialog?.getAttribute("aria-labelledby");
  const titleEl = ((labelledBy && document.getElementById(labelledBy)) ||
    dialog?.querySelector("h1, h2, h3")) as HTMLElement | null;
  if (!dialog || !titleEl) return null;

  const headerCandidates = Array.from(
    dialog.querySelectorAll(".modal-header, [data-modal-header], header"),
  ) as HTMLElement[];
  const realHeader = headerCandidates.find(isRendered);
  const headerRegion = realHeader || dialog;

  let paddedSource: HTMLElement = headerRegion;
  for (let depth = 0; realHeader && depth < 5; depth++) {
    if (
      isRendered(paddedSource) &&
      parseFloat(getComputedStyle(paddedSource).paddingRight || "0") > 0
    )
      break;
    const next = Array.from(paddedSource.children).find(isRendered) as
      | HTMLElement
      | undefined;
    if (!next) break;
    paddedSource = next;
  }
  return {
    titleEl,
    headerRegion,
    paddedSource,
    dialogId: labelledBy || null,
    hasHeaderLandmark: !!realHeader,
  };
}

/**
 * Final round trip: reads every rect `HeaderProbe` reports off the elements
 * `findProbeBundle` resolved. `triggerUntilDialogFound` only waits for a
 * title to exist before this runs - a heavier dialog's own close button can
 * still be a paint or two behind its title, so this polls (bounded, via
 * rAF - not a fixed sleep) for a close-like button to actually render
 * before reading rects, instead of racing it and reporting a false
 * "close control not found" (measured live: this class of flake dropped
 * back to the pre-N14 baseline rate once this wait was added).
 */
async function extractProbeData(bundle: ProbeBundle) {
  if (!bundle) return null;
  const { titleEl, headerRegion, paddedSource, dialogId, hasHeaderLandmark } =
    bundle;
  const isRendered = (el: Element) => el.getClientRects().length > 0;
  const hasCloseCandidate = () =>
    Array.from(headerRegion.querySelectorAll("button")).some(
      (b) =>
        /close|exit/i.test(b.getAttribute("aria-label") || "") && isRendered(b),
    );
  // N13 (VKB Viewer): a dialog that loads its content asynchronously (e.g.
  // "Loading your Knowledge Base...") can take longer than a couple of
  // frames to reach the state that actually has a close button - bounded to
  // match the `expect.poll`/`triggerUntilDialogFound` convention elsewhere
  // in this file rather than picking an arbitrary shorter number.
  const deadline = Date.now() + 6000;
  while (!hasCloseCandidate() && Date.now() < deadline) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  const rectOf = (el: Element | null | undefined) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  };
  const byLabel = (pattern: RegExp) =>
    Array.from(headerRegion.querySelectorAll("button")).find(
      (b) => pattern.test(b.getAttribute("aria-label") || "") && isRendered(b),
    ) as HTMLElement | undefined;
  const parts = {
    badgeEl: Array.from(headerRegion.querySelectorAll("span")).find(
      (s) => s.className.includes("bg-amber-700") && isRendered(s),
    ) as HTMLElement | undefined,
    bugLinkEl: byLabel(/^Report a bug/i),
    closeEl: byLabel(/close|exit/i),
    backEl: byLabel(/^go back$/i),
    aiStatusEl: Array.from(
      headerRegion.querySelectorAll('[data-testid="ai-status-badge"]'),
    ).find(isRendered) as HTMLElement | undefined,
    llmBadgeEl: byLabel(/View AI model recommendations/i),
    shareEl: byLabel(/^Export for Reddit/i),
  };

  const nested = Object.values(parts).filter(
    (el): el is HTMLElement => !!el && el !== titleEl && titleEl.contains(el),
  );
  const range = document.createRange();
  range.selectNodeContents(titleEl);
  if (nested.length > 0) {
    // `querySelectorAll("*")`'s own document order ranks the nested parts - no `compareDocumentPosition` bitmask needed.
    const order = Array.from(titleEl.querySelectorAll("*"));
    range.setEndBefore(
      nested.reduce((a, b) => (order.indexOf(a) < order.indexOf(b) ? a : b)),
    );
  }
  const titleTextRects = Array.from(range.getClientRects())
    .filter((r) => r.width > 0 && r.height > 0)
    .map((r) => ({
      left: r.left,
      top: r.top,
      right: r.right,
      bottom: r.bottom,
    }));

  const hr = paddedSource.getBoundingClientRect();
  const hcs = getComputedStyle(paddedSource);
  return {
    dialogId,
    hasHeaderLandmark,
    direction: getComputedStyle(document.documentElement).direction as
      | "ltr"
      | "rtl",
    titleClipped: titleEl.scrollWidth > titleEl.clientWidth + 1,
    titleTextRects,
    badgeRect: rectOf(parts.badgeEl),
    bugLinkRect: rectOf(parts.bugLinkEl),
    closeRect: rectOf(parts.closeEl),
    backRect: rectOf(parts.backEl),
    aiStatusRect: rectOf(parts.aiStatusEl),
    llmBadgeRect: rectOf(parts.llmBadgeEl),
    shareRect: rectOf(parts.shareEl),
    headerRect: {
      left: hr.left + parseFloat(hcs.paddingLeft || "0"),
      top: hr.top + parseFloat(hcs.paddingTop || "0"),
      right: hr.right - parseFloat(hcs.paddingRight || "0"),
      bottom: hr.bottom - parseFloat(hcs.paddingBottom || "0"),
    },
  };
}

async function probeHeaderLayout(page: Page): Promise<HeaderProbe> {
  const bundleHandle = await page.evaluateHandle(findProbeBundle);
  const probe = await bundleHandle.evaluate(extractProbeData);
  return probe ? { found: true, ...probe } : EMPTY_HEADER_PROBE;
}

/**
 * Every header part `probeHeaderLayout` can find, as the label/rects pairs
 * the pairwise collision check below consumes - one place to add a part
 * (rather than growing the per-dialog test callback past the max-lines
 * budget every time the probe grows a field).
 */
function headerParts(
  probe: HeaderProbe,
): { label: string; rects: Rect[] | null }[] {
  const one = (r: Rect | null) => (r ? [r] : null);
  return [
    { label: "title", rects: probe.titleTextRects },
    { label: "badge", rects: one(probe.badgeRect) },
    { label: "bug-link", rects: one(probe.bugLinkRect) },
    { label: "close", rects: one(probe.closeRect) },
    { label: "back", rects: one(probe.backRect) },
    { label: "ai-status", rects: one(probe.aiStatusRect) },
    { label: "llm-badge", rects: one(probe.llmBadgeRect) },
    { label: "share", rects: one(probe.shareRect) },
  ];
}

/** Every pairwise collision among `headerParts`, plus title clipping. */
function headerCollisionViolations(probe: HeaderProbe): string[] {
  const present = headerParts(probe).filter(
    (p): p is { label: string; rects: Rect[] } =>
      !!p.rects && p.rects.length > 0,
  );

  const violations: string[] = [];
  if (probe.titleTextRects && probe.titleClipped) {
    violations.push("title text is clipped (scrollWidth > clientWidth)");
  }
  for (let i = 0; i < present.length; i++) {
    for (let j = i + 1; j < present.length; j++) {
      const a = present[i];
      const b = present[j];
      const collides = a.rects.some((ra) =>
        b.rects.some((rb) => rectsIntersect(ra, rb)),
      );
      if (collides) violations.push(`${a.label} intersects ${b.label}`);
    }
  }
  return violations;
}

// N12 (QA final10): DOM-enumerated header-collision sweep across the whole
// tool grid at the four widths QA hit-tested for the VAResources/
// CAPSimulator/TacticalCalculator defects. Reuses `rectsIntersect` (Quick
// Exit checks above) pairwise across every part `headerParts` returns
// instead of hand-picking which pair a given dialog happens to collide on.
async function headerCollisionCallback(
  outcome: GridDialogOutcome,
): Promise<string[]> {
  return headerCollisionViolations(outcome.probe).map(
    (v) => `"${outcome.label}": ${v}`,
  );
}

for (const vp of QUICK_EXIT_VIEWPORTS) {
  test.describe(`Tool dialog header layout @ ${vp.width}px (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("every launcher's title/badge/bug-link/close don't collide, title isn't clipped", async ({
      page,
    }) => {
      test.setTimeout(600_000);
      await seedReturningUserAndGoHome(page);
      const violations = await runToolGridSweep(page, headerCollisionCallback);
      expect(violations).toEqual([]);
    });
  });
}

/**
 * N13: the close × must stay pinned to the header's top END corner at every
 * width (decision (1): top-right in `ltr`, top-left in `rtl`) - the fix for
 * the N12 "flex-wrap safety net" regression (wrapping the whole title+cluster
 * row let a lone-on-its-line close button degrade to flex-start, i.e.
 * left-aligned, instead of staying end-aligned). Fails outright (rather than
 * skipping) when the close control or the header region itself can't be
 * found, so a dialog with no discoverable close button is a reported
 * violation, not a vacuous pass.
 *
 * The top-offset half of this check assumes a real header row exists to be
 * "on the first line" of - meaningless for a dialog with no header landmark
 * at all (`hasHeaderLandmark: false`; `probe.headerRect` is then just the
 * dialog panel's own box). Decision (1) is unambiguous about the *end-edge*
 * ("rightmost control left of [a] reserved area") regardless, so that half
 * still runs for every dialog.
 */
function closeTopRightViolations(probe: HeaderProbe): string[] {
  if (!probe.headerRect) return ["header region not found"];
  if (!probe.closeRect) return ["close control not found"];

  const violations: string[] = [];
  const isRtl = probe.direction === "rtl";
  const endGap = Math.abs(
    (isRtl ? probe.headerRect.left : probe.headerRect.right) -
      (isRtl ? probe.closeRect.left : probe.closeRect.right),
  );
  if (endGap > 16) {
    violations.push(
      `close ${isRtl ? "left" : "right"} edge is ${endGap.toFixed(1)}px from the header's usable ${isRtl ? "left" : "right"} (end) edge (max 16)`,
    );
  }
  if (probe.hasHeaderLandmark) {
    const topOffset = probe.closeRect.top - probe.headerRect.top;
    if (topOffset > 16) {
      violations.push(
        `close top sits ${topOffset.toFixed(1)}px below the header's top - not on its first line (max 16)`,
      );
    }
  }
  return violations;
}

/**
 * Mission Protocol is a deliberate consent-style "trust beacon" with no
 * header close-X at all (only its full-width CTA and ESC/backdrop dismiss) -
 * a known, pre-existing exception to "every tool has one", not a regression
 * this sweep should fail on (NO_CLOSE_BY_DESIGN). Whether it should gain one
 * is a product call, not an engineering one - flagged in openIssues rather
 * than decided here.
 */
async function closeTopRightCallback(
  outcome: GridDialogOutcome,
): Promise<string[]> {
  if (outcome.probe.dialogId && NO_CLOSE_BY_DESIGN.has(outcome.probe.dialogId))
    return [];
  return closeTopRightViolations(outcome.probe).map(
    (v) => `"${outcome.label}": ${v}`,
  );
}

for (const vp of HEADER_ALIGNMENT_VIEWPORTS) {
  test.describe(`Tool dialog close-X stays top-right @ ${vp.width}px (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("every launcher's close × right edge and top stay pinned to the header's top-right corner", async ({
      page,
    }) => {
      test.setTimeout(600_000);
      await seedReturningUserAndGoHome(page);
      const violations = await runToolGridSweep(page, closeTopRightCallback);
      expect(violations).toEqual([]);
    });
  });
}

// D13: HeaderCloseSlot's root-cause fix (removing the `sm:items-center`
// special case entirely, back to unconditional `items-start`) targets
// exactly the 640-720px band HEADER_ALIGNMENT_VIEWPORTS never covered (see
// CLAIM_NAV_HEADER_VIEWPORTS above, previously scoped to only two dialogs
// because it was a per-dialog override at the time). Now that the fix lives
// in the shared default, this runs the same DOM-enumerated sweep across
// every launcher instead of just those two.
const HEADER_WRAP_BAND_VIEWPORTS = [
  { name: "sm-boundary", width: 640, height: 800 },
  { name: "sm-boundary-wrap", width: 660, height: 800 },
  { name: "sm-boundary-wrap-tall", width: 700, height: 900 },
];

for (const vp of HEADER_WRAP_BAND_VIEWPORTS) {
  test.describe(`Tool dialog close-X stays top-right @ ${vp.width}px (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("every launcher's close × right edge and top stay pinned to the header's top-right corner", async ({
      page,
    }) => {
      test.setTimeout(600_000);
      await seedReturningUserAndGoHome(page);
      const violations = await runToolGridSweep(page, closeTopRightCallback);
      expect(violations).toEqual([]);
    });
  });
}

/**
 * D14-3: Tooltip.jsx had no viewport clamping - focusing The Tribunal's AI
 * status badge (the one Tooltip-wrapped control reliably present in the
 * global header and in every tool dialog's header) rendered its bubble
 * partly off-screen at narrow widths (measured: left -34px at 320/390px,
 * -10px at 640px, first word cut off). DOM-enumerates every real, rendered,
 * focusable control inside a header region rather than hard-coding the AI
 * badge specifically - a header control with no tooltip simply never
 * produces a `[role=tooltip]` and is skipped, not a violation.
 */
// Two separate selectors, not one union: the global `header[role="banner"]`
// never unmounts while a tool dialog is open, so a union selector would
// re-scan and re-test its ~15-20 nav controls (Tools/Resources items, AI
// badge, language, etc.) on every single one of the ~40 dialogs the sweep
// below opens - 40x redundant work for a region already covered once by the
// dedicated "home header" test. Each call site picks the one it actually
// means.
const HOME_HEADER_REGION_SELECTOR = 'header[role="banner"]';
const DIALOG_HEADER_REGION_SELECTOR =
  '[role="dialog"][aria-modal="true"] .modal-header, [role="alertdialog"][aria-modal="true"] .modal-header';
const HEADER_FOCUSABLE_INDEX_ATTR = "data-e2e-header-focusable-index";

async function stampHeaderFocusableControls(
  page: Page,
  sel: string,
): Promise<number> {
  return page.evaluate(
    ({ sel, attr }) => {
      const isRendered = (el: Element) => el.getClientRects().length > 0;
      const controls = Array.from(document.querySelectorAll(sel))
        .flatMap((region) =>
          Array.from(
            region.querySelectorAll(
              'button, a[href], [tabindex]:not([tabindex="-1"])',
            ),
          ),
        )
        .filter(isRendered);
      controls.forEach((el, i) => el.setAttribute(attr, String(i)));
      return controls.length;
    },
    { sel, attr: HEADER_FOCUSABLE_INDEX_ATTR },
  );
}

/**
 * Focuses header control `index` and, only if that actually opens a
 * `[role=tooltip]`, asserts the bubble's real rendered rect is fully inside
 * `vpWidth`x`vpHeight`. Blurs (and waits for the bubble to actually close)
 * before returning either way, so a still-open tooltip's own Escape-capture
 * handler can't interfere with the sweep's subsequent dialog-close step.
 * The 500/300ms waits are generous relative to Tooltip.jsx's own 200ms
 * SHOW_DELAY_MS - most controls have no tooltip at all, so this cost is
 * paid on every one of them; a longer wait multiplies across every control
 * on every dialog the sweep opens.
 */
async function tooltipViewportViolation(
  page: Page,
  index: number,
  vpWidth: number,
  vpHeight: number,
  label: string,
): Promise<string | null> {
  const control = page.locator(`[${HEADER_FOCUSABLE_INDEX_ATTR}="${index}"]`);
  await control.focus().catch(() => {});
  const tooltip = page.locator('[role="tooltip"]').first();
  const appeared = await tooltip
    .waitFor({ state: "visible", timeout: 500 })
    .then(() => true)
    .catch(() => false);

  let violation: string | null = null;
  if (appeared) {
    const box = await tooltip.boundingBox();
    if (!box) {
      violation = `"${label}" control #${index}: tooltip open but has no bounding box`;
    } else if (
      box.x < -0.5 ||
      box.y < -0.5 ||
      box.x + box.width > vpWidth + 0.5 ||
      box.y + box.height > vpHeight + 0.5
    ) {
      violation =
        `"${label}" control #${index}: tooltip rect ` +
        `(${box.x.toFixed(1)},${box.y.toFixed(1)})-(${(box.x + box.width).toFixed(1)},${(box.y + box.height).toFixed(1)}) ` +
        `outside 0..${vpWidth}x0..${vpHeight}`;
    }
  }
  await control.blur().catch(() => {});
  await tooltip.waitFor({ state: "hidden", timeout: 300 }).catch(() => {});
  return violation;
}

async function headerTooltipViolations(
  page: Page,
  sel: string,
  vpWidth: number,
  vpHeight: number,
  label: string,
): Promise<string[]> {
  const count = await stampHeaderFocusableControls(page, sel);
  const violations: string[] = [];
  for (let i = 0; i < count; i++) {
    const v = await tooltipViewportViolation(page, i, vpWidth, vpHeight, label);
    if (v) violations.push(v);
  }
  return violations;
}

const TOOLTIP_VIEWPORT_CASES = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 640, height: 800 },
  { width: 1280, height: 720 },
];

for (const vp of TOOLTIP_VIEWPORT_CASES) {
  test.describe(`Tooltip stays inside the viewport @ ${vp.width}px`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("every home-header tooltip trigger's [role=tooltip] rect is fully on-screen", async ({
      page,
    }) => {
      test.setTimeout(60_000);
      await seedReturningUserAndGoHome(page);
      const violations = await headerTooltipViolations(
        page,
        HOME_HEADER_REGION_SELECTOR,
        vp.width,
        vp.height,
        "Home header",
      );
      expect(violations).toEqual([]);
    });

    test("every tool dialog header's tooltip trigger's [role=tooltip] rect is fully on-screen", async ({
      page,
    }) => {
      test.setTimeout(600_000);
      await seedReturningUserAndGoHome(page);
      const violations = await runToolGridSweep(page, (outcome) =>
        headerTooltipViolations(
          page,
          DIALOG_HEADER_REGION_SELECTOR,
          vp.width,
          vp.height,
          outcome.label,
        ),
      );
      expect(violations).toEqual([]);
    });
  });
}

// RTL regression coverage: `closeTopRightViolations`' `isRtl` branch
// (decision (1): the close-X flips to the header's top-LEFT corner under
// RTL) had no committed test that ever set `document.dir` to `rtl` to run
// it. `ar` (LanguageContext.jsx) is one of four RTL languages the app
// supports (ar/fa/prs/ps) - any one exercises the same `isRtl` branch.
test.describe("Tool dialog close-X stays top-END in RTL (Arabic) @ 1440px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("every launcher's close × stays pinned to the header's top-left corner", async ({
    page,
  }) => {
    test.setTimeout(600_000);
    await seedReturningUserAndGoHome(page, "ar");
    const violations = await runToolGridSweep(page, closeTopRightCallback);
    expect(violations).toEqual([]);
  });
});

// N14: the widths between QUICK_EXIT_VIEWPORTS' widest phone (430px) and
// HEADER_ALIGNMENT_VIEWPORTS' desktop check (1440px) - nothing in this file
// ran a real browser at any width in between until now, which is exactly
// where HeaderCloseSlot's `items-start` alignment (fixed above, N14) turned
// a pre-existing partial rect overlap between the close-X and the fixed
// Quick Exit button into a dead-centre hit: a tap on the dialog's own close
// control opened Quick Exit's panic "Exit Now?" prompt instead.
const TABLET_LAPTOP_VIEWPORTS = [
  { name: "ipad-landscape", width: 1024, height: 768 },
  { name: "laptop", width: 1280, height: 720 },
];

/**
 * True if the *topmost dialog's* close button's own centre point resolves
 * (via `elementFromPoint`) to the fixed Quick Exit button specifically -
 * the exact mechanism a real tap on that point would hit. Scoped to the
 * active dialog (not `document`-wide) so a stray same-labelled control
 * elsewhere on the page can't be mistaken for the dialog's own close, and
 * checks the hit element's own aria-label (not just "something covers it")
 * so an unrelated in-dialog overlap doesn't get misreported as this
 * specific Quick-Exit regression.
 */
function closeCentreHitsQuickExit(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    // Splash-excluded the same way `findProbeBundle` is - see its comment.
    // Deliberately does NOT also exclude the mobile-menu drawer the way
    // `findProbeBundle` (N16) now does: BYPASS_DIALOGS' own "Header mobile
    // menu" entry probes the drawer itself as the dialog under test here.
    const dialog = document.querySelector(
      '[role="dialog"][aria-modal="true"]:not([aria-labelledby="splash-title"]), [role="alertdialog"][aria-modal="true"]:not([aria-labelledby="splash-title"])',
    );
    if (!dialog) return false;
    const closeBtn = Array.from(
      dialog.querySelectorAll(
        'button[aria-label*="close" i], button[aria-label*="exit" i]',
      ),
    ).find((b) => b.getClientRects().length > 0);
    if (!closeBtn) return false;
    const r = closeBtn.getBoundingClientRect();
    const hit = document.elementFromPoint(
      r.left + r.width / 2,
      r.top + r.height / 2,
    );
    const hitLabel = (hit?.closest("button")?.getAttribute("aria-label") ||
      hit?.getAttribute("aria-label") ||
      "") as string;
    return /quick exit/i.test(hitLabel);
  });
}

/**
 * Mission Protocol has no header close-X at all by design (N13 openIssues,
 * NO_CLOSE_BY_DESIGN) - nothing for this hit-test to check. Every other
 * dialog must have one: `closeCentreHitsQuickExit` itself silently returns
 * `false` (no violation) when it can't find a close button, which would let
 * a regressed/missing close-X at these two widths pass vacuously instead of
 * failing loudly, so this checks `probe.closeRect` first.
 */
async function closeCentreCallback(
  page: Page,
  outcome: GridDialogOutcome,
): Promise<string[]> {
  if (outcome.probe.dialogId && NO_CLOSE_BY_DESIGN.has(outcome.probe.dialogId))
    return [];
  if (!outcome.probe.closeRect) {
    return [`"${outcome.label}": close control not found`];
  }
  const hit = await closeCentreHitsQuickExit(page);
  return hit
    ? [`"${outcome.label}": close × centre point is covered by Quick Exit`]
    : [];
}

for (const vp of TABLET_LAPTOP_VIEWPORTS) {
  test.describe(`Tool dialog close-X isn't shadowed by Quick Exit @ ${vp.width}px (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("every launcher's close × centre point isn't covered by Quick Exit", async ({
      page,
    }) => {
      test.setTimeout(600_000);
      await seedReturningUserAndGoHome(page);
      const violations = await runToolGridSweep(page, (outcome) =>
        closeCentreCallback(page, outcome),
      );
      expect(violations).toEqual([]);
    });
  });
}

/**
 * A real tap, not just geometry: the four dialog/width pairs the original
 * regression report verified by clicking (rather than just measuring) - a
 * click at the close-X's centre must close the dialog itself, not surface
 * Quick Exit's "Exit Now?" panic prompt over a still-open dialog.
 */
const QUICK_EXIT_CLICK_CASES = [
  { label: "Pathfinder", event: "openPathfinder", width: 1024, height: 768 },
  { label: "BDD Builder", event: "openBDDBuilder", width: 1024, height: 768 },
  {
    label: "PACT Act Navigator",
    event: "openPACTActNavigator",
    width: 1024,
    height: 768,
  },
  {
    label: "C-File Analyzer",
    event: "openCFileAnalyzer",
    width: 1280,
    height: 720,
  },
];

test.describe("Tool dialog close-X click actually closes the dialog, not Quick Exit", () => {
  for (const testCase of QUICK_EXIT_CLICK_CASES) {
    test(`${testCase.label} @ ${testCase.width}x${testCase.height}`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: testCase.width,
        height: testCase.height,
      });
      await page.addInitScript((appVersion) => {
        localStorage.setItem("vet-rate-tos-accepted", "true");
        localStorage.setItem("vet_rate_last_seen_version", appVersion);
        localStorage.setItem("vetrate-tour-completed", "true");
        localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
        localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
      }, APP_VERSION);
      await page.goto("/");
      await dismissDisclaimer(page);

      await triggerAndProbe(
        page,
        dispatchTrigger(page, testCase.event),
        probeHeaderLayout,
      );
      const dialogLocator = page.locator(
        '[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]',
      );
      const closeBtn = page
        .locator(
          'button[aria-label*="close" i]:not([aria-label*="quick exit" i])',
        )
        .last();
      await closeBtn.waitFor({ state: "visible", timeout: 6000 });
      const box = await closeBtn.boundingBox();
      if (!box) throw new Error("close button has no bounding box");
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

      await expect(page.getByText("Exit Now?", { exact: false })).toHaveCount(
        0,
      );
      await expect(dialogLocator).toHaveCount(0);
    });
  }
});

/**
 * Final-14 D-3: Body Map Selector, Cloud Sync Manager, Community Roadmap,
 * Feature Request, Record Search, Remand Risk Checker and VKB Timeline are
 * reachable only via HomeFeatureCards CTA cards or the header's Tools/
 * Resources panels - the N15/N16 gap note above (`enumerateToolGridButtons`)
 * lists all seven as outside both the tool-grid/footer sweep and (below the
 * `md` breakpoint the Tools/Resources triggers need) the header-menu sweep
 * too. Neither HEADER_WRAP_BAND_VIEWPORTS (640/660/700, tool-grid/footer/menu
 * only) nor HEADER_ALIGNMENT_VIEWPORTS (phones + a single 1440 desktop point)
 * ever exercises these seven, and no existing sweep runs at 680/1024/1280 at
 * all - opened directly via their own `open*` event (same pattern
 * QUICK_EXIT_CLICK_CASES above already uses for this exact reason) instead of
 * hunting for a grid/menu launcher that doesn't reach them at these widths.
 */
/**
 * "Cloud Sync Manager" (CloudSyncManager.jsx, `cloud-sync-title`) is a
 * nested view reached only through BackupManager's own "Connect Drive"
 * button, not directly by any window event - `openCloudSyncManager` (the
 * event name) actually opens MultiCloudManager (`multicloud-title`), a
 * separate component DataManagementCluster.jsx wires it to. Confirmed by
 * reading DataManagementCluster.jsx/BackupManager.jsx directly rather than
 * assuming the event name matches the component file name.
 */
async function openCloudSyncManagerNestedView(page: Page): Promise<void> {
  await dispatchTrigger(page, "openBackupManager")();
  await page
    .getByRole("button", { name: /connect drive/i })
    .click({ timeout: 10_000 });
}

/**
 * `probeHeaderLayout`'s generic `document.querySelector` picks whichever
 * real dialog sits first in DOM order - fine when only one is ever open,
 * but Cloud Sync Manager stays stacked ON TOP of the BackupManager dialog
 * that opened it (both mounted, both real `[role=dialog]`s), so the generic
 * probe silently measures BackupManager's own header instead. Scoped by the
 * dialog's own known `aria-labelledby` id instead of "the first real dialog
 * found" - same extraction (`extractProbeData`), different selection.
 */
function findProbeBundleById(dialogId: string): ProbeBundle {
  const isRendered = (el: Element) => el.getClientRects().length > 0;
  const dialog = document.querySelector(
    `[aria-labelledby="${dialogId}"]`,
  ) as HTMLElement | null;
  const titleEl = document.getElementById(dialogId);
  if (!dialog || !titleEl) return null;

  const headerCandidates = Array.from(
    dialog.querySelectorAll(".modal-header, [data-modal-header], header"),
  ) as HTMLElement[];
  const realHeader = headerCandidates.find(isRendered);
  const headerRegion = realHeader || dialog;

  let paddedSource: HTMLElement = headerRegion;
  for (let depth = 0; realHeader && depth < 5; depth++) {
    if (
      isRendered(paddedSource) &&
      parseFloat(getComputedStyle(paddedSource).paddingRight || "0") > 0
    )
      break;
    const next = Array.from(paddedSource.children).find(isRendered) as
      | HTMLElement
      | undefined;
    if (!next) break;
    paddedSource = next;
  }
  return {
    titleEl,
    headerRegion,
    paddedSource,
    dialogId,
    hasHeaderLandmark: !!realHeader,
  };
}

async function probeHeaderLayoutById(
  page: Page,
  dialogId: string,
): Promise<HeaderProbe> {
  const bundleHandle = await page.evaluateHandle(findProbeBundleById, dialogId);
  const probe = await bundleHandle.evaluate(extractProbeData);
  return probe ? { found: true, ...probe } : EMPTY_HEADER_PROBE;
}

const NESTED_VIEW_HEADER_CASES = [
  {
    label: "Body Map Selector",
    event: "openBodyMapSelector",
    dialogId: "body-map-selector-title",
  },
  {
    label: "Cloud Sync Manager",
    open: openCloudSyncManagerNestedView,
    dialogId: "cloud-sync-title",
  },
  {
    label: "Community Roadmap",
    event: "openCommunityRoadmap",
    dialogId: "community-roadmap-title",
  },
  {
    label: "Feature Request",
    event: "openFeatureRequest",
    dialogId: "feature-request-title",
  },
  {
    label: "Record Search",
    event: "openRecordSearch",
    dialogId: "record-search-title",
  },
  {
    label: "Remand Risk Checker",
    event: "openRemandRiskChecker",
    dialogId: "remand-risk-title",
  },
  {
    label: "VKB Timeline",
    event: "openVKBTimeline",
    dialogId: "vkb-timeline-title",
  },
];

const NESTED_VIEW_WIDTHS = [640, 660, 680, 700, 1024, 1280];

for (const width of NESTED_VIEW_WIDTHS) {
  test.describe(`Nested-view dialog header layout @ ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    for (const testCase of NESTED_VIEW_HEADER_CASES) {
      test(`${testCase.label}: close-X on title's first line, not under Quick Exit, centre tap closes`, async ({
        page,
      }) => {
        await seedReturningUserAndGoHome(page);

        const trigger = testCase.open
          ? () => testCase.open(page)
          : dispatchTrigger(page, testCase.event);
        const probe = await triggerAndProbe(page, trigger, (p) =>
          probeHeaderLayoutById(p, testCase.dialogId),
        );
        expect(probe.dialogId).toBe(testCase.dialogId);
        expect(closeTopRightViolations(probe)).toEqual([]);

        const dialogSelector = `[aria-labelledby="${testCase.dialogId}"]`;
        const closeSelector = `${dialogSelector} button[aria-label*="close" i]:not([aria-label*="quick exit" i]), ${dialogSelector} button[aria-label*="exit" i]:not([aria-label*="quick exit" i])`;

        // Not-under-Quick-Exit: a real hit-test at the close-X's own centre
        // point (the same S46 regression class `centerHitsSelf` documents -
        // a fixed higher-z-index sibling can silently intercept a tap that
        // still measures a clean, fully-visible box on its own).
        const { found, hit } = await centerHitsSelf(page, closeSelector);
        expect(found).toBe(true);
        expect(hit).toBe(true);

        const closeBtn = page.locator(closeSelector).first();
        const box = await closeBtn.boundingBox();
        if (!box) {
          throw new Error(
            `${testCase.label}: close button has no bounding box`,
          );
        }
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await expect(page.locator(dialogSelector)).toHaveCount(0);
      });
    }
  });
}

/**
 * CAPSimulator's three "deeper" headers (select a condition, mid-simulation,
 * terminology flashcards) still had the absolute-positioned back/close
 * cluster painted over a centered title (independent audit, N12 follow-up).
 * The generic sweep above can't reach them - `openCAPSimulator` alone only
 * ever mounts the default intro branch - so this drives the real button
 * clicks QA's audit used to get there.
 */
async function openCAPMode(
  page: Page,
  buttonText: string,
  pickCondition: boolean,
): Promise<void> {
  await triggerUntilDialogFound(
    page,
    dispatchTrigger(page, "openCAPSimulator"),
  );
  await page.getByText(buttonText, { exact: false }).first().click();
  if (pickCondition) {
    // Playwright's own `:has()` selector + `.click()` auto-wait replaces the
    // fixed 200ms sleep this used to need for the condition-card grid to
    // render (sonarjs/no-fixed-wait-in-tests) - it retries until a matching,
    // actionable button exists instead of hoping 200ms was enough.
    await page
      .locator('[role="dialog"][aria-modal="true"] button:has(h3)')
      .first()
      .click();
  }
}

const CAP_DEEP_MODES = [
  {
    label: "Select Condition",
    buttonText: "Start Simulation",
    pickCondition: false,
  },
  {
    label: "Mid-Simulation",
    buttonText: "Start Simulation",
    pickCondition: true,
  },
  {
    label: "Terminology",
    buttonText: "Learn Terminology",
    pickCondition: false,
  },
];

for (const vp of QUICK_EXIT_VIEWPORTS) {
  test.describe(`CAP Simulator deep-mode headers @ ${vp.width}px (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      await page.addInitScript((appVersion) => {
        localStorage.setItem("vet-rate-tos-accepted", "true");
        localStorage.setItem("vet_rate_last_seen_version", appVersion);
        localStorage.setItem("vetrate-tour-completed", "true");
        localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
        localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
      }, APP_VERSION);
      await page.goto("/");
      await dismissDisclaimer(page);
    });

    for (const mode of CAP_DEEP_MODES) {
      test(`${mode.label}: title/back/close don't collide, title isn't clipped, close stays top-right`, async ({
        page,
      }) => {
        await openCAPMode(page, mode.buttonText, mode.pickCondition);
        const probe = await probeHeaderLayout(page);
        expect(probe.found).toBe(true);
        expect(headerCollisionViolations(probe)).toEqual([]);
        expect(closeTopRightViolations(probe)).toEqual([]);
      });
    }
  });
}

/**
 * N13/N12 regression coverage for Claim Navigator and Denial Decoder -
 * both dropped out of the DOM-enumerated tool-grid sweep above (openIssues,
 * Scope note) because neither has a home-grid or footer launcher today.
 * Claim Navigator is decision (1)'s own worked example (the full-bleed
 * dialog whose header reserves Quick Exit's corner via `sm:pr-28`) and
 * Denial Decoder is this branch's own restructured dialog
 * (`openDenialDecoder` -> a real modal instead of an in-flow div), so both
 * keep a targeted header-layout/top-right check instead of relying only on
 * the looser Quick-Exit-clearance check `BYPASS_DIALOGS` already runs for
 * Claim Navigator.
 */
const HEADER_REGRESSION_DIALOGS = [
  { label: "Claim Navigator", event: "openClaimNavigator" },
  { label: "Denial Decoder", event: "openDenialDecoder" },
];

// QA follow-up: HEADER_ALIGNMENT_VIEWPORTS jumps straight from 430px
// (QUICK_EXIT_VIEWPORTS' widest phone) to 1440px desktop, so nothing in this
// loop ever exercised the exact band Claim Navigator's own `sm:!items-start`
// override targets - NavigatorHeader's view toggle (`sm:flex`) plus its
// action icons wrap the children column onto a second row starting at
// `sm:` (640px) and stop needing to by ~720px. A regression that dropped
// the override (or changed how HeaderCloseSlot merges className) would fall
// back to the shared `sm:items-center` default, centre close-x against that
// wrapped two-row block, and pass every width this file already ran.
// Scoped to this targeted loop only - not folded into the shared
// HEADER_ALIGNMENT_VIEWPORTS, which the full DOM-enumerated tool-grid sweep
// above also uses across ~40 other HeaderCloseSlot users that still inherit
// the shared default and have their own unresolved gap in this band
// (tracked separately, not this branch's scope).
const CLAIM_NAV_HEADER_VIEWPORTS = [
  ...HEADER_ALIGNMENT_VIEWPORTS,
  { name: "sm-boundary-wrap", width: 680, height: 800 },
];

for (const vp of CLAIM_NAV_HEADER_VIEWPORTS) {
  test.describe(`Claim Navigator / Denial Decoder header layout @ ${vp.width}px (${vp.name})`, () => {
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

    for (const dialog of HEADER_REGRESSION_DIALOGS) {
      test(`${dialog.label}: title/badge/close don't collide, close stays top-right`, async ({
        page,
      }) => {
        await triggerUntilDialogFound(
          page,
          dispatchTrigger(page, dialog.event),
        );
        const probe = await probeHeaderLayout(page);
        expect(probe.found).toBe(true);
        expect(headerCollisionViolations(probe)).toEqual([]);
        expect(closeTopRightViolations(probe)).toEqual([]);
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

// Observation: ClaimNavigator ignored Escape at 320-430px. Cause: below
// `sm:`, NavigatorViewToggle (the first focusable element in DOM order,
// `hidden sm:flex`) is `display:none`; useFocusTrap's autoFocus called
// `.focus()` on one of its buttons anyway, which browsers silently no-op on
// a non-rendered element, so real focus stayed on the tool-grid button that
// opened the dialog - outside the dialog's own subtree, where the trap's
// keydown listener (bound to the dialog container, relying on bubbling)
// never saw the keystroke. Fixed in useFocusTrap.js's `focusables()`
// (offsetParent !== null). BYPASS_DIALOGS above exercises ClaimNavigator's
// close *button*, not Escape, so this is its own regression check at the
// exact widths QA named.
test.describe("Claim Navigator closes on Escape below sm", () => {
  for (const vp of QUICK_EXIT_VIEWPORTS) {
    test(`Escape closes Claim Navigator @ ${vp.width}px (${vp.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.addInitScript((appVersion) => {
        localStorage.setItem("vet-rate-tos-accepted", "true");
        localStorage.setItem("vet_rate_last_seen_version", appVersion);
        localStorage.setItem("vetrate-tour-completed", "true");
        localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
      }, APP_VERSION);
      await page.goto("/");
      await dismissDisclaimer(page);

      const claimNavigator = BYPASS_DIALOGS.find(
        (d) => d.label === "Claim Navigator",
      );
      await claimNavigator!.open(page);

      const dialog = page.locator(
        '[role="dialog"][aria-labelledby="claim-navigator-title"]',
      );
      await expect(dialog).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden({ timeout: 5000 });
    });
  }
});

/**
 * Symptom Logger header regression: commit 335dca2a moved AIStatusBadge into
 * SymptomLoggerHeaderActions, whose cluster was `flex shrink-0` with no wrap -
 * once the badge widened the cluster past the header's own width, it ran past
 * the header's overflow-hidden edge instead of shrinking/wrapping, clipping
 * "Report a bug"/Share/AI Settings off-screen at every phone width. Checked
 * with AI unconfigured AND with a Gemini key set (the widest real badge
 * string) - only the wider cloud-mode badge pushed some controls fully
 * off-screen.
 */
async function measureSymptomLoggerHeaderClipping(
  page: Page,
): Promise<{ label: string; visiblePx: number; totalPx: number }[]> {
  return page.evaluate(() => {
    const title = document.querySelector("#symptom-logger-title");
    const header = title?.closest(".overflow-hidden");
    if (!header) return [];
    const headerRect = header.getBoundingClientRect();
    return Array.from(header.querySelectorAll("button, a")).map((el) => {
      const r = el.getBoundingClientRect();
      const label =
        el.getAttribute("aria-label") || el.textContent?.trim() || "?";
      const visibleRight = Math.min(r.right, headerRect.right, innerWidth);
      const visibleLeft = Math.max(r.left, headerRect.left, 0);
      return {
        label,
        visiblePx: Math.max(0, visibleRight - visibleLeft),
        totalPx: r.width,
      };
    });
  });
}

async function openSymptomLoggerHeader(
  page: Page,
  width: number,
  geminiKey: string | null,
): Promise<void> {
  await page.setViewportSize({ width, height: 800 });
  await page.addInitScript(
    ({ appVersion, geminiKey }) => {
      localStorage.setItem("vet-rate-tos-accepted", "true");
      localStorage.setItem("vet_rate_last_seen_version", appVersion);
      localStorage.setItem("vetrate-tour-completed", "true");
      localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
      localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
      if (geminiKey) localStorage.setItem("vetrate_gemini_key", geminiKey);
    },
    { appVersion: APP_VERSION, geminiKey },
  );
  await page.goto("/");
  await dismissDisclaimer(page);
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("openSymptomLogger")),
  );
  await page
    .locator("#symptom-logger-title")
    .waitFor({ state: "visible", timeout: 10000 });
}

test.describe("Symptom Logger header controls stay fully visible (no clipping)", () => {
  for (const vp of QUICK_EXIT_VIEWPORTS) {
    for (const geminiKey of [null, "AIzaFAKEKEYFORTEST1234567890"]) {
      test(`@ ${vp.width}px, AI ${geminiKey ? "configured (cloud)" : "unconfigured"}`, async ({
        page,
      }) => {
        await openSymptomLoggerHeader(page, vp.width, geminiKey);
        const controls = await measureSymptomLoggerHeaderClipping(page);
        expect(controls.length).toBeGreaterThan(0);
        const clipped = controls.filter((c) => c.visiblePx < c.totalPx - 0.5);
        expect(clipped, JSON.stringify(clipped)).toEqual([]);
      });
    }
  }
});
