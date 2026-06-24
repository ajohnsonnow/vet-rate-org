import { readFileSync } from "node:fs";
import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { dismissDisclaimer } from "./helpers";

// Current release, read from package.json (Playwright's cwd is the repo root).
// Used by the returning-user fixture to suppress the What's New modal.
const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

/**
 * Accessibility gate (audit cycle S9–S17, Sprint S12; simulators added in
 * WS-5). Runs axe-core against the home page plus 22 event-mountable modals
 * and fails on any serious/critical WCAG 2.0/2.1/2.2 A + AA violation.
 *
 * Scope rationale: the S12 Definition of Done is "axe = 0 serious/critical on
 * top-20 (CI-gated)"; WS-5 extended the list with the three interactive
 * simulators. We gate on serious + critical only; moderate/minor findings are
 * tracked in the SR manual checklist (S12_SR_MANUAL_CHECKLIST.md), not
 * CI-blocking, to keep the gate signal high and avoid a day-one red wall of
 * cosmetic findings.
 *
 * Honest limit: axe is a static-rule engine — it cannot judge whether a label
 * reads sensibly, focus order makes sense, or a live region announces at the
 * right moment. Those are owner-run NVDA/VoiceOver/TalkBack checklist items.
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const BLOCKING_IMPACTS = new Set(["serious", "critical"]);

/**
 * Gated surfaces. AIAssistant, DocumentIntelligenceBriefing, and
 * VeteranTranslator are intentionally absent: each is flow/prop-gated, not
 * opened by a bare `open*` event, so they are manual-verify through the proven
 * shell (same status as in mobile.spec.ts). Everything below mounts on a
 * single dispatched event in a standard build — including the three
 * interactive simulators added by WS-5 (each has a window-event listener in
 * its lazy feature cluster).
 */
const MODAL_SURFACES = [
  // Migrated to ResponsiveModal (full dialog contract from the shell).
  { label: "Privacy Policy", event: "openPrivacyPolicy" },
  { label: "Contact Us", event: "openContactUs" },
  { label: "VSO Finder", event: "openVSOFinder" },
  { label: "Symptom Logger", event: "openSymptomLogger" },
  { label: "State Benefit Hunter", event: "openStateBenefitHunter" },
  { label: "Decision Decoder", event: "openDecisionDecoder" },
  { label: "Legislative Watchdog", event: "openLegislativeWatchdog" },
  { label: "Workflow Guide", event: "openWorkflowGuide" },
  { label: "DD214 Analyzer", event: "openDD214Analyzer" },
  { label: "Community Roadmap", event: "openCommunityRoadmap" },
  { label: "VA AI Transparency", event: "openVAAITransparency" },
  { label: "Terms of Service Page", event: "openTermsOfService" },
  // Migrated in S10 to the shell; assert the dialog is a11y-clean on open.
  { label: "My Packet", event: "openMyPacket" },
  { label: "TDIU Builder", event: "openTDIUBuilder" },
  { label: "BDD Builder", event: "openBDDBuilder" },
  { label: "PACT Act Navigator", event: "openPACTActNavigator" },
  { label: "FOIA Generator", event: "openFOIAGenerator" },
  { label: "Tactical Calculator", event: "openTacticalCalculator" },
  // S12 BVA-data tool migrated to the shell.
  { label: "Appeals Lane Advisor", event: "openAppealsLaneAdvisor" },
  // WS-5: the three interactive simulators.
  { label: "What-If Sandbox", event: "openWhatIfSandbox" },
  { label: "The Tribunal", event: "openTheTribunal" },
  { label: "Body Map Selector", event: "openBodyMapSelector" },
];

/** Set the returning-user fixture so the only dialog on screen is the one under test. */
async function bootReturningUser(page: Page): Promise<void> {
  await page.addInitScript((appVersion) => {
    localStorage.setItem("vet-rate-tos-accepted", "true");
    localStorage.setItem("vet_rate_last_seen_version", appVersion);
    localStorage.setItem("vetrate-tour-completed", "true");
    // Suppress the first-visit DisclaimerSplash so it can never linger into a
    // sibling dialog's scan. Without this the splash mounts on every test and
    // its (now-fixed) BETA badge contrast was caught intermittently against
    // whichever modal was under test — a "flaky→passed" masking of a real
    // violation. The splash itself is gated separately by its own test below.
    localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
  }, APP_VERSION);
  await page.goto("/");
  await dismissDisclaimer(page);
}

/**
 * Dispatch a modal-open window event until a dialog appears, re-firing on every
 * poll tick. The owning feature clusters are lazy-loaded, so a single dispatch
 * sent before the listener attaches is silently lost; every open handler is an
 * idempotent `setShow(true)`, so re-dispatching is safe.
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

  // The dialog mounts a frame or two before its (often React.lazy) content
  // paints. Wait for the dialog to be visible AND for real interactive content
  // to render inside it, so axe never scans an empty Suspense shell — a race
  // that previously masked a real violation behind a "flaky→passed" run.
  const dialog = page.locator('[role="dialog"]').last();
  await dialog.waitFor({ state: "visible" });
  await dialog
    .locator("button, a, h1, h2, h3, input, [role='button']")
    .first()
    .waitFor({ state: "visible" });
}

/** Human-readable one-liner per violation for the failure message. */
function summarize(
  violations: {
    id: string;
    impact?: string | null;
    help: string;
    nodes: unknown[];
  }[],
): string {
  if (violations.length === 0) return "no serious/critical violations";
  return violations
    .map((v) => `  • ${v.id} [${v.impact}] ×${v.nodes.length} — ${v.help}`)
    .join("\n");
}

/**
 * Open a modal by event and return its blocking (serious/critical) violations.
 * A heavy lazy modal can briefly remount under React's dev StrictMode
 * double-invoke, so axe's `.include('[role="dialog"]')` occasionally finds the
 * dialog gone the instant it scans ("No elements found for include") — an infra
 * race, not a finding. Re-open and retry on that specific error only; any real
 * violation still surfaces through the returned list, so this never masks one.
 */
async function scanDialogViolations(page: Page, event: string) {
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
      );
    } catch (err) {
      if (!String(err).includes("No elements found for include")) throw err;
      lastError = err;
    }
  }
  throw lastError;
}

/**
 * First-visit DisclaimerSplash — the very first dialog every user sees, before
 * any other surface. Booted WITHOUT the disclaimer-acknowledged key so the
 * splash is the surface under test (the returning-user fixture suppresses it
 * everywhere else). Gated explicitly so its contrast can never regress unseen.
 */
test("Disclaimer splash dialog (first visit)", async ({ page }) => {
  await page.addInitScript((appVersion) => {
    localStorage.setItem("vet-rate-tos-accepted", "true");
    localStorage.setItem("vet_rate_last_seen_version", appVersion);
    localStorage.setItem("vetrate-tour-completed", "true");
  }, APP_VERSION);

  // The splash is entangled with the onboarding flow: it can dismiss within the
  // brief window axe takes to inject and evaluate `.include()`, so a single scan
  // sometimes finds the dialog gone ("No elements found"). Reload and retry on
  // that infra error only — a real contrast violation still surfaces and fails.
  const splashSel = '[role="dialog"][aria-labelledby="splash-title"]';
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto("/");
    await page.locator(splashSel).waitFor({ state: "visible" });
    try {
      const results = await new AxeBuilder({ page })
        .include(splashSel)
        .withTags(WCAG_TAGS)
        .analyze();
      const blocking = results.violations.filter((v) =>
        BLOCKING_IMPACTS.has(v.impact ?? ""),
      );
      expect(blocking, summarize(blocking)).toEqual([]);
      return;
    } catch (err) {
      if (!String(err).includes("No elements found for include")) throw err;
      lastError = err;
    }
  }
  throw lastError;
});

test.describe("axe: WCAG 2.2 AA — serious/critical", () => {
  test.beforeEach(async ({ page }) => {
    await bootReturningUser(page);
  });

  test("home page", async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    const blocking = results.violations.filter((v) =>
      BLOCKING_IMPACTS.has(v.impact ?? ""),
    );
    expect(blocking, summarize(blocking)).toEqual([]);
  });

  for (const surface of MODAL_SURFACES) {
    test(`${surface.label} dialog`, async ({ page }) => {
      const blocking = await scanDialogViolations(page, surface.event);
      expect(blocking, summarize(blocking)).toEqual([]);
    });
  }
});
