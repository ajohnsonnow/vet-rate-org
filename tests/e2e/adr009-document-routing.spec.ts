import { readFileSync } from "node:fs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { test, expect, type Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

/**
 * ADR-009 fail-closed document routing, exercised end-to-end in a real
 * browser: `vite --mode e2e`'s fake on-device engine (tests/e2e/fakes/
 * web-llm.fake.js, extended here with per-tool JSON markers) stands in for
 * Warrant Council; a stubbed `page.route()` on the Gemini endpoint stands in
 * for "cloud" - never a real provider either way.
 *
 * Per tool: (a) cloud-only -> the document never reaches the stubbed cloud
 * route (zero matching requests), the plain-language notice shows, and the
 * local parser's result still shows. (b) on-device available -> the fake
 * engine's completion call actually contains the fixture's unique marker,
 * and the tool completes without error. A single shared test additionally
 * proves (c): a genuinely "context"-classed call (the AI Assistant) still
 * reaches the stubbed cloud with only the allow-listed content.
 */

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

const DOC_MARKER = "ZZE2EDOCMARKER9f3a";
const CLOUD_KEY = "AIzaSyE2EFAKEKEY00000000000000000000";
const GEMINI_PATTERN = "https://generativelanguage.googleapis.com/**";

async function shimFakeGpuAdapter(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (!navigator.gpu) return;
    navigator.gpu.requestAdapter = async () => ({
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

async function bootApp(
  page: Page,
  { withCloudKey }: { withCloudKey: boolean },
): Promise<void> {
  await page.addInitScript(
    ({ version, cloudKey, withCloudKey: seedKey }) => {
      localStorage.setItem("vet-rate-tos-accepted", "true");
      localStorage.setItem("vet_rate_last_seen_version", version);
      localStorage.setItem("vetrate-tour-completed", "true");
      localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
      localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
      if (seedKey) localStorage.setItem("vetrate_gemini_key", cloudKey);
    },
    { version: APP_VERSION, cloudKey: CLOUD_KEY, withCloudKey },
  );
  await page.goto("/");
  await dismissDisclaimer(page);
}

interface CloudRecorder {
  bodies: string[];
}

// Stubs the ONE real off-device transport (Gemini) - never a real provider.
// Records every matched request's body before fulfilling with a minimal
// valid Gemini response shape, so a "context" call still gets a usable
// reply while a "document" call's absence from `bodies` is the assertion.
async function stubCloudRoute(page: Page): Promise<CloudRecorder> {
  const recorder: CloudRecorder = { bodies: [] };
  await page.route(GEMINI_PATTERN, async (route) => {
    recorder.bodies.push(route.request().postData() || "");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: "[e2e stub cloud] no real provider ran." }],
            },
          },
        ],
      }),
    });
  });
  return recorder;
}

// Every tool's "load on-device AI" affordance is the shared
// SmartAILoadButton (only rendered while `!isAnyAIAvailable()`) - clicking
// it and waiting for it to disappear is backend-agnostic across tools.
async function loadFakeOnDeviceAI(page: Page): Promise<void> {
  const loadBtn = page.getByRole("button", { name: /^(📥 Load|🔄 Switch)/ });
  await loadBtn.waitFor({ state: "visible", timeout: 10000 });
  await loadBtn.click();
  await loadBtn.waitFor({ state: "hidden", timeout: 30000 });
}

async function openToolDialog(
  page: Page,
  eventName: string,
  dialogSelector: string,
): Promise<void> {
  await page.evaluate(
    (name) => window.dispatchEvent(new CustomEvent(name)),
    eventName,
  );
  await page
    .locator(dialogSelector)
    .waitFor({ state: "visible", timeout: 10000 });
}

async function readFakeEngineCalls(
  page: Page,
): Promise<Array<{ system: string; user: string }>> {
  return page.evaluate(
    () =>
      (window as unknown as { __e2eFakeEngineCalls?: unknown[] })
        .__e2eFakeEngineCalls || [],
  ) as Promise<Array<{ system: string; user: string }>>;
}

function wrapPdfLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Real single-page text-layer PDF (not a scanned image) - PDF.js extracts
// its text directly, no OCR involved, keeping this fixture fast and
// deterministic.
async function makeTextPdfBuffer(text: string): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let y = 740;
  for (const line of wrapPdfLines(text, 95)) {
    page.drawText(line, { x: 50, y, size: 11, font });
    y -= 16;
  }
  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

const DD214_DIALOG = '[role="dialog"][aria-labelledby="dd214-analyzer-title"]';

const DD214_FIXTURE_TEXT = (marker: string) => `
DD FORM 214 CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY
1. NAME: TESTFIXTURE, E2E
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY/ACTIVE
3. SOCIAL SECURITY: 123 45 6789
4A. GRADE: E-4
5. DATE OF BIRTH: 1990 01 01
7B. HOME OF RECORD: TESTVILLE, TESTSTATE
8A. LAST DUTY ASSIGNMENT: FORT TEST
12A. DATE ENTERED ACTIVE DUTY THIS PERIOD: 20100101
12B. SEPARATION DATE THIS PERIOD: 20140101
18. REMARKS: ${marker}
24. CHARACTER OF SERVICE: HONORABLE
`;

test.describe("ADR-009: DD-214 Analyzer document routing", () => {
  test("cloud-only: the document never reaches the stubbed cloud, notice shows, local parser result shows", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await bootApp(page, { withCloudKey: true });
    const cloud = await stubCloudRoute(page);

    await openToolDialog(page, "openDD214Analyzer", DD214_DIALOG);
    const dialog = page.locator(DD214_DIALOG);
    await dialog
      .locator("textarea")
      .first()
      .fill(DD214_FIXTURE_TEXT(DOC_MARKER));
    await dialog.getByRole("button", { name: /Analyze with AI/i }).click();

    await expect(dialog.getByText(/Analysis Complete/i)).toBeVisible({
      timeout: 20000,
    });
    await expect(dialog.getByText(/was not sent to/i)).toBeVisible();

    expect(cloud.bodies.some((b) => b.includes(DOC_MARKER))).toBe(false);
    expect(cloud.bodies.length).toBe(0);
  });

  test("on-device available: the fake engine receives the document and the feature works", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await shimFakeGpuAdapter(page);
    await bootApp(page, { withCloudKey: false });

    await openToolDialog(page, "openDD214Analyzer", DD214_DIALOG);
    const dialog = page.locator(DD214_DIALOG);
    await dialog
      .locator("textarea")
      .first()
      .fill(DD214_FIXTURE_TEXT(DOC_MARKER));
    await loadFakeOnDeviceAI(page);
    await dialog.getByRole("button", { name: /Analyze with AI/i }).click();

    await expect(dialog.getByText(/Analysis Complete/i)).toBeVisible({
      timeout: 20000,
    });

    const calls = await readFakeEngineCalls(page);
    expect(calls.some((c) => c.user.includes(DOC_MARKER))).toBe(true);
  });
});

const CFILE_DIALOG = '[role="dialog"][aria-labelledby="cfile-analyzer-title"]';
const CFILE_CONSENT_DIALOG =
  '[role="dialog"][aria-labelledby="cfile-privacy-title"]';

const CFILE_FIXTURE_TEXT = (marker: string) =>
  `MEDICAL RECORD - PROGRESS NOTE\nDate: 2020-01-15\nPatient reports chronic ` +
  `tinnitus and lumbar spine pain following in-service noise exposure and a ` +
  `lifting injury. Diagnosis: Tinnitus, bilateral. Diagnosis: Lumbar strain. ` +
  `Treatment plan discussed with patient. Marker: ${marker}`;

async function startCFileAnalysis(page: Page): Promise<void> {
  const dialog = page.locator(CFILE_DIALOG);
  await dialog.getByRole("button", { name: /Analyze My C-File/i }).click();
  const consent = page.locator(CFILE_CONSENT_DIALOG);
  await consent.waitFor({ state: "visible", timeout: 10000 });
  await consent
    .getByRole("button", { name: /I Understand - Start Analysis/i })
    .click();
}

test.describe("ADR-009: C-File Analyzer document routing", () => {
  test("cloud-only: the document never reaches the stubbed cloud and the notice shows", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await bootApp(page, { withCloudKey: true });
    const cloud = await stubCloudRoute(page);

    await openToolDialog(page, "openCFileAnalyzer", CFILE_DIALOG);
    const dialog = page.locator(CFILE_DIALOG);
    const pdfBuffer = await makeTextPdfBuffer(CFILE_FIXTURE_TEXT(DOC_MARKER));
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "cfile-fixture.pdf",
      mimeType: "application/pdf",
      buffer: pdfBuffer,
    });
    await startCFileAnalysis(page);

    await expect(dialog.getByText(/was not sent to/i)).toBeVisible({
      timeout: 30000,
    });

    expect(cloud.bodies.some((b) => b.includes(DOC_MARKER))).toBe(false);
    expect(cloud.bodies.length).toBe(0);
  });

  test("on-device available: the fake engine receives the document and the feature works", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await shimFakeGpuAdapter(page);
    await bootApp(page, { withCloudKey: false });

    await openToolDialog(page, "openCFileAnalyzer", CFILE_DIALOG);
    const dialog = page.locator(CFILE_DIALOG);
    await loadFakeOnDeviceAI(page);
    const pdfBuffer = await makeTextPdfBuffer(CFILE_FIXTURE_TEXT(DOC_MARKER));
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "cfile-fixture.pdf",
      mimeType: "application/pdf",
      buffer: pdfBuffer,
    });
    await startCFileAnalysis(page);

    await expect(dialog.getByText(/Analysis Complete/i)).toBeVisible({
      timeout: 30000,
    });

    const calls = await readFakeEngineCalls(page);
    expect(calls.some((c) => c.user.includes(DOC_MARKER))).toBe(true);
  });
});

const BLUE_BUTTON_DIALOG =
  '[role="dialog"][aria-labelledby="blue-button-xray-title"]';

const BLUE_BUTTON_FIXTURE_TEXT = (marker: string) =>
  `VA BLUE BUTTON HEALTH SUMMARY\n\nProblem List:\n- Tinnitus, bilateral, chronic\n- Hypertension, essential\n\nNote: ${marker}\n`;

async function uploadBlueButtonFixture(
  page: Page,
  marker: string,
): Promise<void> {
  const dialog = page.locator(BLUE_BUTTON_DIALOG);
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "bluebutton-fixture.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(BLUE_BUTTON_FIXTURE_TEXT(marker)),
  });
  await dialog.getByRole("button", { name: /AI Scan for Diagnoses/i }).click();
}

test.describe("ADR-009: Blue Button X-Ray document routing", () => {
  test("cloud-only: the document never reaches the stubbed cloud, notice shows, local parser result shows", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await bootApp(page, { withCloudKey: true });
    const cloud = await stubCloudRoute(page);

    await openToolDialog(page, "openBlueButtonXRay", BLUE_BUTTON_DIALOG);
    await uploadBlueButtonFixture(page, DOC_MARKER);

    const dialog = page.locator(BLUE_BUTTON_DIALOG);
    await expect(dialog.getByText(/Found \d+ Conditions/i)).toBeVisible({
      timeout: 20000,
    });
    await expect(dialog.getByText(/was not sent to/i)).toBeVisible();

    expect(cloud.bodies.some((b) => b.includes(DOC_MARKER))).toBe(false);
    expect(cloud.bodies.length).toBe(0);
  });

  test("on-device available: the fake engine receives the document and the feature works", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await shimFakeGpuAdapter(page);
    await bootApp(page, { withCloudKey: false });

    await openToolDialog(page, "openBlueButtonXRay", BLUE_BUTTON_DIALOG);
    const dialog = page.locator(BLUE_BUTTON_DIALOG);
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "bluebutton-fixture.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(BLUE_BUTTON_FIXTURE_TEXT(DOC_MARKER)),
    });
    await loadFakeOnDeviceAI(page);
    await dialog
      .getByRole("button", { name: /AI Scan for Diagnoses/i })
      .click();

    await expect(dialog.getByText(/Found \d+ Conditions/i)).toBeVisible({
      timeout: 20000,
    });

    const calls = await readFakeEngineCalls(page);
    expect(calls.some((c) => c.user.includes(DOC_MARKER))).toBe(true);
  });
});

const DECISION_DECODER_DIALOG =
  '[role="dialog"][aria-labelledby="decoder-title"]';

const DECISION_DECODER_FIXTURE_TEXT = (marker: string) =>
  `The Department of Veterans Affairs has denied your claim for service ` +
  `connection for tinnitus. The evidence does not establish a nexus between ` +
  `your current condition and your military service. Marker: ${marker}`;

test.describe("ADR-009: Decision Decoder document routing (pasted text)", () => {
  test("cloud-only: the document never reaches the stubbed cloud, notice shows, local parser result shows", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await bootApp(page, { withCloudKey: true });
    const cloud = await stubCloudRoute(page);

    await openToolDialog(page, "openDecisionDecoder", DECISION_DECODER_DIALOG);
    const dialog = page.locator(DECISION_DECODER_DIALOG);
    await dialog
      .locator("textarea")
      .first()
      .fill(DECISION_DECODER_FIXTURE_TEXT(DOC_MARKER));
    await dialog.getByRole("button", { name: /Decode This Decision/i }).click();

    await expect(dialog.getByText(/was not sent to/i)).toBeVisible({
      timeout: 20000,
    });
    await expect(dialog.getByText(/Full Denial/i)).toBeVisible();

    expect(cloud.bodies.some((b) => b.includes(DOC_MARKER))).toBe(false);
    expect(cloud.bodies.length).toBe(0);
  });

  test("on-device available: the fake engine receives the document and the feature works", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await shimFakeGpuAdapter(page);
    await bootApp(page, { withCloudKey: false });

    await openToolDialog(page, "openDecisionDecoder", DECISION_DECODER_DIALOG);
    const dialog = page.locator(DECISION_DECODER_DIALOG);
    await dialog
      .locator("textarea")
      .first()
      .fill(DECISION_DECODER_FIXTURE_TEXT(DOC_MARKER));
    await loadFakeOnDeviceAI(page);
    await dialog.getByRole("button", { name: /Decode This Decision/i }).click();

    await expect(dialog.getByText(/Full Denial/i)).toBeVisible({
      timeout: 20000,
    });

    const calls = await readFakeEngineCalls(page);
    expect(calls.some((c) => c.user.includes(DOC_MARKER))).toBe(true);
  });
});

const CONTEXT_MARKER = "ZZE2ECONTEXTMARKER9f3a";

test.describe("ADR-009: a context-classed call still reaches the stubbed cloud", () => {
  test("AI Assistant (context) reaches the stub cloud with the veteran's own question", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await bootApp(page, { withCloudKey: true });
    const cloud = await stubCloudRoute(page);

    await page.getByRole("button", { name: /Open AI Navigator/i }).click();
    const textarea = page.locator("textarea").last();
    await textarea.waitFor({ state: "visible", timeout: 10000 });
    await textarea.fill(`What are my options regarding ${CONTEXT_MARKER}?`);
    await page.getByRole("button", { name: /Send message/i }).click();

    await expect
      .poll(() => cloud.bodies.length, { timeout: 20000 })
      .toBeGreaterThan(0);
    expect(cloud.bodies.some((b) => b.includes(CONTEXT_MARKER))).toBe(true);
  });
});

/**
 * Muster Call's import-time C-File analysis (buildSegmentedCFileResult ->
 * analyzeCFileWithAI, musterCallProcessor.js) only fires once
 * quickScanCFile() judges an uploaded document a genuinely consolidated
 * C-File (multiple detected document types, or 50+ pages) - reverse-
 * engineering a drag-and-drop fixture that reliably clears that bar (rather
 * than being classified DD214/DBQ/etc. directly, each with its own non-AI
 * parser) was disproportionate to this task's remaining scope. This drives
 * the same production function directly, inside the same real browser/real
 * fake-engine/real-network-stub harness as every other test in this file -
 * proving the routing boundary itself, not the classification heuristic.
 */
async function injectMusterCallModule(page: Page): Promise<void> {
  await page.addScriptTag({
    type: "module",
    content: `
      import { buildSegmentedCFileResult } from "/src/utils/musterCallProcessor.js";
      import { quickScanCFile } from "/src/utils/cFileSegmentation.js";
      window.__mc = { buildSegmentedCFileResult, quickScanCFile };
    `,
  });
  await page.waitForFunction(
    () => Boolean((window as unknown as Record<string, unknown>).__mc),
    null,
    {
      timeout: 15000,
    },
  );
}

async function runSegmentedCFileResult(
  page: Page,
  text: string,
): Promise<{ aiAnalysis: unknown; offDeviceNotice: string | null }> {
  return page.evaluate(async (fixtureText) => {
    const mc = (
      window as unknown as {
        __mc: {
          quickScanCFile: (t: string) => unknown;
          buildSegmentedCFileResult: (
            t: string,
            s: unknown,
          ) => Promise<{
            aiAnalysis: unknown;
            offDeviceNotice: string | null;
          }>;
        };
      }
    ).__mc;
    const summary = mc.quickScanCFile(fixtureText);
    return mc.buildSegmentedCFileResult(fixtureText, summary);
  }, text);
}

const MUSTER_CALL_FIXTURE_TEXT = (marker: string) =>
  `MEDICAL RECORD - PROGRESS NOTE\nDate: 2021-05-02\nPatient reports chronic ` +
  `knee pain and PTSD symptoms following an in-service incident. Diagnosis: ` +
  `Post-traumatic stress disorder. Diagnosis: Right knee strain. Marker: ${marker}`;

test.describe("ADR-009: Muster Call import-time C-File analysis document routing", () => {
  test("cloud-only: the document never reaches the stubbed cloud and the notice explains why", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await bootApp(page, { withCloudKey: true });
    const cloud = await stubCloudRoute(page);
    await injectMusterCallModule(page);

    const result = await runSegmentedCFileResult(
      page,
      MUSTER_CALL_FIXTURE_TEXT(DOC_MARKER),
    );

    expect(result.aiAnalysis).toBeNull();
    expect(result.offDeviceNotice).toMatch(/was not sent to/i);
    expect(cloud.bodies.some((b) => b.includes(DOC_MARKER))).toBe(false);
    expect(cloud.bodies.length).toBe(0);
  });

  test("on-device available: the fake engine receives the document and the analysis completes", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await shimFakeGpuAdapter(page);
    await bootApp(page, { withCloudKey: false });

    // Muster Call's own "Load AI" button (FormationLineup.jsx) is the
    // established, already-proven way to get Warrant Council/the fake
    // engine ready (see muster-call-ai-panic.spec.ts) - isDiamondSwarmReady()
    // is global module state once loaded, so it applies equally to the
    // direct module call below regardless of which UI loaded it.
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("openMusterCall")),
    );
    await page
      .locator('[aria-labelledby="muster-call-title"]')
      .waitFor({ state: "visible", timeout: 10000 });
    await page.getByRole("button", { name: /load ai/i }).click();
    await page
      .getByText(/CW5 Auditor ready/i)
      .waitFor({ state: "visible", timeout: 20000 });

    await injectMusterCallModule(page);
    const result = await runSegmentedCFileResult(
      page,
      MUSTER_CALL_FIXTURE_TEXT(DOC_MARKER),
    );

    expect(result.offDeviceNotice).toBeNull();
    expect(result.aiAnalysis).not.toBeNull();

    const calls = await readFakeEngineCalls(page);
    expect(calls.some((c) => c.user.includes(DOC_MARKER))).toBe(true);
  });
});
