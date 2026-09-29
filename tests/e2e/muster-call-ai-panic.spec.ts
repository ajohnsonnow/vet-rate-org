import { readFileSync } from "node:fs";
import { test, expect, Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

/**
 * Real-browser coverage for Muster Call's AI-gated "Start Formation" flow
 * (ai.aiReady, FormationLineup.jsx) and the panic key around it.
 *
 * Headless Chromium reports navigator.gpu but requestAdapter() resolves
 * null (verified live, not assumed - see tests/e2e/_debug-gpu-style probes
 * run while building this spec), so the real @mlc-ai/web-llm engine never
 * loads here regardless of how long a test waits - aiReady never becomes
 * true and Start Formation stays permanently disabled. Two changes make it
 * reachable, both test-only:
 *
 *  1. `vite --mode e2e` (this suite's webServer command - see
 *     playwright.config.ts) aliases @mlc-ai/web-llm to a deterministic fake
 *     (tests/e2e/fakes/web-llm.fake.js) that returns responses in the exact
 *     shapes diamondSwarm.js's real call sites expect. Zero production
 *     code changes - the alias only exists under this one mode (proven by
 *     `npm run build`, which never passes --mode e2e, containing no trace
 *     of the fake - see the repo's e2e-fake-not-in-build check).
 *  2. This file's own `shimFakeGpuAdapter` patches
 *     navigator.gpu.requestAdapter (a real, unaliasable browser API call
 *     diamondSwarm.js makes directly, before ever touching the aliased
 *     module) to resolve a minimal fake adapter. Test-harness-only, via
 *     page.addInitScript - no src/ file touched.
 *
 * A generic .txt fixture (no real veteran data) is used throughout - its
 * raw text is itself one of DocumentIntelligenceBriefing's "fields to
 * verify", so this uses the briefing's "Skip This Document" action (always
 * enabled, regardless of what content extraction did or didn't find)
 * rather than "Verify & Save" (blocked until every extracted field's own
 * checkbox is checked) to reach formation-complete deterministically for
 * arbitrary generic content.
 */

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

const MUSTER_CALL_DIALOG_SELECTOR = '[aria-labelledby="muster-call-title"]';

async function shimFakeGpuAdapter(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (!navigator.gpu) return;
    navigator.gpu.requestAdapter = async () => ({
      // WebGPUManager.js's own separate GPU-discovery scan (unrelated to
      // Muster Call's path, but it runs on every page load) reads
      // adapter.info directly and throws without it - harmless to that
      // scan either way (caught, logged, non-fatal), but a real shape
      // here keeps this fake from adding console noise to every test.
      info: {
        vendor: "e2e-fake",
        architecture: "fake",
        device: "e2e fake GPU",
        description: "Deterministic e2e test adapter",
      },
      limits: {
        maxComputeInvocationsPerWorkgroup: 1024,
        maxStorageBufferBindingSize: 1 << 30,
        maxBufferSize: 1 << 30,
        maxComputeWorkgroupSizeX: 1024,
        maxComputeWorkgroupSizeY: 1024,
        maxComputeWorkgroupSizeZ: 64,
        maxComputeWorkgroupStorageSize: 32768,
        maxBindGroups: 4,
        maxBindingsPerBindGroup: 1000,
        maxDynamicStorageBuffersPerPipelineLayout: 4,
        maxStorageBuffersPerShaderStage: 8,
      },
      features: new Set(),
      requestDevice: async () => ({}),
    });
  });
}

async function seedReturningUser(page: Page): Promise<void> {
  await page.addInitScript((appVersion) => {
    localStorage.setItem("vet-rate-tos-accepted", "true");
    localStorage.setItem("vet_rate_last_seen_version", appVersion);
    localStorage.setItem("vetrate-tour-completed", "true");
    localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
    localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
  }, APP_VERSION);
  await page.goto("/");
  await dismissDisclaimer(page);
}

/**
 * The real panic redirect navigates to https://www.weather.com. Faking the
 * response (rather than skipping the assertion) keeps the test hermetic and
 * fast while still proving a real cross-origin navigation occurred.
 */
async function stubWeatherRedirect(page: Page): Promise<void> {
  await page.route("https://www.weather.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body>stub</body></html>",
    }),
  );
}

async function uploadGenericFixture(page: Page): Promise<void> {
  await page.locator("#muster-call-files").setInputFiles({
    name: "e2e-generic-fixture.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "This is a generic e2e test fixture with no real veteran information. " +
        "It contains no service dates, no SSNs, no diagnostic codes, and no PII.",
    ),
  });
}

async function loadFakeAI(page: Page): Promise<void> {
  await page.getByRole("button", { name: /load ai/i }).click();
  await page
    .getByText(/CW5 Auditor ready/i)
    .waitFor({ state: "visible", timeout: 20000 });
}

/**
 * Opens Muster Call, uploads a generic fixture, loads the (fake) AI, starts
 * Formation, and resolves the one document via Skip - the one action that
 * reaches formation-complete regardless of what got extracted from generic
 * content (see this file's own doc comment).
 */
async function completeGenericFormation(page: Page): Promise<void> {
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("openMusterCall")),
  );
  await page
    .locator(MUSTER_CALL_DIALOG_SELECTOR)
    .waitFor({ state: "visible", timeout: 10000 });

  await uploadGenericFixture(page);
  await loadFakeAI(page);

  await page
    .getByRole("button", { name: "Start processing documents" })
    .click();

  const skipBtn = page.getByRole("button", { name: /skip this document/i });
  await skipBtn.waitFor({ state: "visible", timeout: 15000 });
  await skipBtn.click();

  await page
    .getByRole("button", { name: /fall in.*new formation/i })
    .waitFor({ state: "visible", timeout: 10000 });
}

test.describe("Muster Call AI-gated Start Formation (fake WebLLM engine)", () => {
  // deviceCapabilityDetector.js forces tier="mobile" -> canUseWebLLM: false
  // from the User-Agent alone, unconditionally - a real, intentional
  // product decision (no local AI on phones), completely independent of
  // navigator.gpu/requestAdapter. This suite's fakes only address the
  // latter (headless Chromium's requestAdapter() resolving null); they
  // neither can nor should override a legitimate device-tier gate, so
  // Warrant Council AI is genuinely unreachable on the mobile-chrome
  // project (Pixel 5 UA) regardless - verified live before writing this
  // skip, not assumed.
  test.skip(
    ({ isMobile }) => !!isMobile,
    "Warrant Council AI is desktop/laptop-only by device-tier design (deviceCapabilityDetector.js) - not reachable on any mobile UA, real or emulated",
  );

  test("Start Formation is reachable and a generic fixture completes formation", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await shimFakeGpuAdapter(page);
    await seedReturningUser(page);

    await completeGenericFormation(page);

    await expect(
      page.getByRole("button", { name: /fall in.*new formation/i }),
    ).toBeVisible();
  });

  test("after formation completes, one Escape closes Muster Call with no redirect", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await shimFakeGpuAdapter(page);
    await seedReturningUser(page);
    await stubWeatherRedirect(page);

    await completeGenericFormation(page);

    await page.keyboard.press("Escape");
    await page
      .locator(MUSTER_CALL_DIALOG_SELECTOR)
      .waitFor({ state: "hidden", timeout: 5000 });

    expect(page.url()).not.toMatch(/weather\.com/);
  });

  // Owner decision C: the Escape that closes Muster Call is exempt (a
  // dialog closed), so 3 Escapes 300ms apart only contribute 2 real presses
  // - one short of ESCAPE_THRESHOLD (3) - and must not redirect.
  test("after formation completes, 3 Escapes 300ms apart close Muster Call without redirecting", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await shimFakeGpuAdapter(page);
    await seedReturningUser(page);
    await stubWeatherRedirect(page);

    await completeGenericFormation(page);

    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }

    await expect(page.locator(MUSTER_CALL_DIALOG_SELECTOR)).toBeHidden();
    expect(page.url()).not.toMatch(/weather\.com/);
  });

  // Baseline sanity check in this same context: with Muster Call closed and
  // nothing else open, 3 deliberate Escapes still redirect - the panic key
  // is not left dead by anything this flow (AI loading, formation
  // completing, the briefing modal) does along the way.
  test("with nothing open after Muster Call closes, 3 more Escapes trigger the panic redirect", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await shimFakeGpuAdapter(page);
    await seedReturningUser(page);
    await stubWeatherRedirect(page);

    await completeGenericFormation(page);

    await page.keyboard.press("Escape"); // closes Muster Call - not counted
    await page
      .locator(MUSTER_CALL_DIALOG_SELECTOR)
      .waitFor({ state: "hidden", timeout: 5000 });

    for (let i = 0; i < 3; i++) await page.keyboard.press("Escape");

    await page.waitForURL(/weather\.com/, { timeout: 5000 });
    expect(page.url()).toMatch(/weather\.com/);
  });
});
