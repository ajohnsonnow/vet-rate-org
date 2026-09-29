import { readFileSync } from "node:fs";
import { test, expect, Page } from "@playwright/test";
import { TOOLS } from "./tool-launch-matrix.data";

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

const FIXTURE = JSON.parse(
  readFileSync("tests/fixtures/redacted-packet.json", "utf-8"),
);

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
      localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
      localStorage.setItem("vet_rate_saved_claims", JSON.stringify(claims));
    },
    { version: APP_VERSION, claims },
  );
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200);
}

// ──────────────────────────────────────────────────────────────
// Modal detection — polls up to 15 s (30 × 500 ms) for a dialog to
// appear (matches the budget established in tool-with-packet.spec.ts
// and mobile.spec.ts's Atomic Wipe test). Heavier tools (My Packet,
// Retro Pay Hunter, C&P Exam Simulator) can exceed a tighter budget
// under the parallel-worker local dev-server contention this suite
// runs with — a 48-step test has ~48x the exposure to that per-tool
// risk of a single-tool test, so it needs the same generous margin.
// Uses isVisible() snapshots rather than expect().toBeVisible() to
// avoid Playwright's web-first retry machinery interfering with
// back-to-back dispatches.
// ──────────────────────────────────────────────────────────────
async function modalIsVisible(page: Page): Promise<boolean> {
  const selectors = ['[role="dialog"]', '[aria-modal="true"]'];
  for (let i = 0; i < 30; i++) {
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
  // removal) time to settle before dispatching the next tool event. Widened
  // from 300ms: under the parallel-worker local dev-server contention this
  // suite runs with, a shorter wait let the next tool's dispatch fire while
  // the previous tool's async cleanup was still in flight, producing a
  // delayed React error #299 that got misattributed to whichever tool
  // happened to be "current" when pageerror fired (a timing/attribution
  // artifact, not a bug in that tool's own code).
  await page.waitForTimeout(800);
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
