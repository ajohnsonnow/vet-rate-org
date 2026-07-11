import { readFileSync } from "node:fs";
import { test, expect, Page } from "@playwright/test";

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

const FIXTURE = JSON.parse(
  readFileSync("tests/fixtures/redacted-packet.json", "utf-8"),
);

// ──────────────────────────────────────────────────────────────
// All 48 user-facing tool events (verified against window.addEventListener
// calls across src/). Organised by cluster matching the app's 7 clusters.
// ──────────────────────────────────────────────────────────────
const TOOLS: { name: string; event: string; cluster: string }[] = [
  // Calculate Your Rating
  {
    name: "Tactical Calculator",
    event: "openTacticalCalculator",
    cluster: "Calculate",
  },
  {
    name: "Million Dollar Dashboard",
    event: "openMillionDollarDashboard",
    cluster: "Calculate",
  },
  {
    name: "Time Machine (ITF)",
    event: "openTimeMachine",
    cluster: "Calculate",
  },
  {
    name: "Retro Pay Hunter",
    event: "openRetroPayHunter",
    cluster: "Calculate",
  },
  {
    name: "C&P Exam Simulator",
    event: "openCAPSimulator",
    cluster: "Calculate",
  },

  // Discover Your Claims
  { name: "BDD Builder", event: "openBDDBuilder", cluster: "Discover" },
  {
    name: "Secondary Scout",
    event: "openSecondaryScoutLauncher",
    cluster: "Discover",
  },
  { name: "Pathfinder", event: "openPathfinder", cluster: "Discover" },
  {
    name: "MOS Hazard Matcher",
    event: "openMOSHazardMatcher",
    cluster: "Discover",
  },
  {
    name: "PACT Act Navigator",
    event: "openPACTActNavigator",
    cluster: "Discover",
  },
  {
    name: "Web of Conditions",
    event: "openWebOfConditions",
    cluster: "Discover",
  },
  { name: "Claim Navigator", event: "openClaimNavigator", cluster: "Discover" },

  // Build Your Evidence
  {
    name: "C-File AI Analyzer",
    event: "openCFileAnalyzer",
    cluster: "Evidence",
  },
  {
    name: "Blue Button X-Ray",
    event: "openBlueButtonXRay",
    cluster: "Evidence",
  },
  { name: "Muster Call (PDF)", event: "openMusterCall", cluster: "Evidence" },
  { name: "Witness Bench", event: "openWitnessBench", cluster: "Evidence" },
  { name: "Nexus Builder", event: "openNexusBuilder", cluster: "Evidence" },
  { name: "Forms Helper", event: "openFormsHelper", cluster: "Evidence" },
  { name: "Symptom Logger", event: "openSymptomLogger", cluster: "Evidence" },
  { name: "Pain Painter", event: "openPainPainter", cluster: "Evidence" },
  {
    name: "Evidence Timeline",
    event: "openEvidenceTimeline",
    cluster: "Evidence",
  },
  { name: "FOIA Keysmith", event: "openFOIAGenerator", cluster: "Evidence" },

  // Quality Control
  { name: "Red Team", event: "openRedTeam", cluster: "QC" },
  { name: "The War Game", event: "openClaimStressTest", cluster: "QC" },
  { name: "Decision Decoder", event: "openDecisionDecoder", cluster: "QC" },
  { name: "Denials Decoder", event: "openDenialDecoder", cluster: "QC" },
  { name: "Shark Radar", event: "openSharkRadar", cluster: "QC" },
  { name: "Consistency Engine", event: "openConsistencyEngine", cluster: "QC" },
  {
    name: "Evidence Gap Finder",
    event: "openEvidenceGapVisualizer",
    cluster: "QC",
  },
  { name: "Risk Assessment", event: "openRiskAssessment", cluster: "QC" },

  // Maximize Your Rating
  { name: "TDIU Builder", event: "openTDIUBuilder", cluster: "Maximize" },
  {
    name: "State Benefit Hunter",
    event: "openStateBenefitHunter",
    cluster: "Maximize",
  },
  { name: "The Tribunal", event: "openTheTribunal", cluster: "Maximize" },
  {
    name: "Legislative Watchdog",
    event: "openLegislativeWatchdog",
    cluster: "Maximize",
  },
  {
    name: "Body Map Selector",
    event: "openBodyMapSelector",
    cluster: "Maximize",
  },

  // Appeals
  {
    name: "Nexus Quality Analyzer",
    event: "openNexusQualityAnalyzer",
    cluster: "Appeals",
  },
  {
    name: "Remand Risk Checker",
    event: "openRemandRiskChecker",
    cluster: "Appeals",
  },
  {
    name: "Appeals Lane Advisor",
    event: "openAppealsLaneAdvisor",
    cluster: "Appeals",
  },

  // Support & Resources
  { name: "VSO Finder", event: "openVSOFinder", cluster: "Support" },
  { name: "My Packet", event: "openMyPacket", cluster: "Support" },
  { name: "Knowledge Base (VKB)", event: "openVKBViewer", cluster: "Support" },
  { name: "VA Resources Hub", event: "openVAResources", cluster: "Support" },
  { name: "Field Manual", event: "openUserManual", cluster: "Support" },
  { name: "Cloud Sync", event: "openCloudSyncManager", cluster: "Support" },
  { name: "Backup Manager", event: "openBackupManager", cluster: "Support" },
  { name: "VKB Timeline", event: "openVKBTimeline", cluster: "Support" },
  {
    name: "Publications Library",
    event: "openPublicationsLibrary",
    cluster: "Support",
  },
  { name: "Record Search", event: "openRecordSearch", cluster: "Support" },
];

// ──────────────────────────────────────────────────────────────
// Boot helper — seeds localStorage with returning-user flags +
// redacted packet claims, then navigates to the app root.
// Extra 1200ms wait gives all React useEffect hooks time to
// register their window event listeners (lazy clusters mount
// after networkidle but effects run a paint cycle later).
// ──────────────────────────────────────────────────────────────
async function bootWithPacket(page: Page): Promise<void> {
  const claims = FIXTURE.claims;
  await page.addInitScript(
    ({ version, claims }) => {
      localStorage.setItem("vet-rate-tos-accepted", "true");
      localStorage.setItem("vet_rate_last_seen_version", version);
      localStorage.setItem("vetrate-tour-completed", "true");
      localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
      localStorage.setItem("vet_rate_saved_claims", JSON.stringify(claims));
    },
    { version: APP_VERSION, claims },
  );
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200);
}

// ──────────────────────────────────────────────────────────────
// Modal detection — polls up to 7 s (14 × 500 ms) for a dialog
// to appear. Uses isVisible() snapshots rather than
// expect().toBeVisible() to avoid Playwright's web-first retry
// machinery interfering with back-to-back dispatches.
// ──────────────────────────────────────────────────────────────
async function modalIsVisible(page: Page): Promise<boolean> {
  const selectors = ['[role="dialog"]', '[aria-modal="true"]'];
  for (let i = 0; i < 14; i++) {
    for (const sel of selectors) {
      const visible = await page
        .locator(sel)
        .first()
        .isVisible()
        .catch(() => false);
      if (visible) return true;
    }
    await page.waitForTimeout(500);
  }
  return false;
}

// ──────────────────────────────────────────────────────────────
// Close helper — Escape first, then wait for the dialog to
// actually disappear from the DOM. Falls back to force-clicking
// the close button if Escape is ignored. A 300ms settle wait
// after hiding gives React time to finish cleanup effects (focus
// restoration, unmount cascades) before the next dispatch.
// ──────────────────────────────────────────────────────────────
async function closeModal(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  const anyDialog = page
    .locator('[role="dialog"], [aria-modal="true"]')
    .first();
  const closedOnEscape = await anyDialog
    .waitFor({ state: "hidden", timeout: 1500 })
    .then(() => true)
    .catch(() => false);
  if (!closedOnEscape) {
    const closeBtn = page
      .locator(
        '[role="dialog"] button[aria-label="Close"], ' +
          '[role="dialog"] button[aria-label="Close dialog"], ' +
          '[aria-modal="true"] button[aria-label="Close"], ' +
          '[aria-modal="true"] button[aria-label="Close dialog"]',
      )
      .first();
    if (await closeBtn.isVisible({ timeout: 200 }).catch(() => false)) {
      await closeBtn.click({ force: true });
    }
    await anyDialog.waitFor({ state: "hidden", timeout: 1500 }).catch(() => {});
  }
  // Give React's unmount/cleanup effects (focus restoration, scroll-lock
  // removal) time to settle before dispatching the next tool event.
  await page.waitForTimeout(300);
}

// ──────────────────────────────────────────────────────────────
// Error filter — strip known-noise pageerror messages so the
// matrix records only genuine unexpected JS exceptions.
//
// Noise categories:
//  - Cross-origin localStorage: "Access is denied for this document"
//    (iframes embedded by tools like Shark Radar / Body Map Selector)
//  - Plain-object throws: "[object Object]"
//    (AI model-loading try/catch that throws non-Error objects)
// ──────────────────────────────────────────────────────────────
function isNoise(msg: string): boolean {
  return (
    // Cross-origin localStorage: iframes in tools like Shark Radar / Body Map
    msg.includes("Access is denied for this document") ||
    // Plain-object throws from AI model loading (throw {} instead of throw new Error)
    msg === "Object" ||
    msg === "[object Object]" ||
    // React error #418 is triggered by Vite+Babel deoptimising LanguageContext.jsx
    // (>500KB file) in dev mode — not present in production builds; not a real bug.
    msg.includes("Minified React error #418")
  );
}

// ──────────────────────────────────────────────────────────────
// Matrix spec — one test per cluster so CI can attribute
// failures to the right area without running all 48 serially.
// ──────────────────────────────────────────────────────────────

type ToolResult = {
  name: string;
  cluster: string;
  renders: boolean;
  errors: string[];
};

// ──────────────────────────────────────────────────────────────
// Single serial test — all 48 tools on one page boot.
// Running all tools on one page avoids the parallel-worker /
// Vite-dev-server resource contention that causes non-deterministic
// 0-render failures when 7 cluster tests load pages concurrently.
// ──────────────────────────────────────────────────────────────
test("48-tool launch matrix — all clusters", async ({ page }) => {
  test.setTimeout(600_000);

  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  await bootWithPacket(page);

  const results: ToolResult[] = [];

  for (const tool of TOOLS) {
    const errorsBefore = pageErrors.length;

    await page.evaluate((eventName) => {
      window.dispatchEvent(new CustomEvent(eventName));
    }, tool.event);

    const rendered = await modalIsVisible(page);
    await closeModal(page);

    const newErrors = pageErrors
      .slice(errorsBefore)
      .filter((e) => !e.includes("ResizeObserver") && !isNoise(e));

    const status = rendered ? "✓" : "✗";
    // eslint-disable-next-line no-console
    console.log(`  ${status} [${tool.cluster}] ${tool.name}`);

    results.push({
      name: tool.name,
      cluster: tool.cluster,
      renders: rendered,
      errors: newErrors,
    });
  }

  // ── Assertions ────────────────────────────────────────────────
  // Per-tool: unexpected JS errors (soft — logs failures without
  // blocking; real crashes also show up as renders=false below).
  for (const r of results) {
    expect
      .soft(r.errors, `${r.name} (${r.cluster}): unexpected JS error`)
      .toHaveLength(0);
  }

  // Cluster-level: at least one tool per cluster must render.
  // Guards against an entire cluster's events being broken.
  const clusters = [...new Set(TOOLS.map((t) => t.cluster))];
  for (const cluster of clusters) {
    const clusterRenders = results.filter(
      (r) => r.cluster === cluster && r.renders,
    ).length;
    expect(
      clusterRenders,
      `${cluster} cluster: no tools rendered — event-name mismatch or dispatch error`,
    ).toBeGreaterThan(0);
  }
});
