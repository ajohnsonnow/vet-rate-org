/**
 * D16-6: Decision Decoder's Drop-In File used to reject every PDF and
 * image because isPDFFile/isImageFile (ocr.js) matched a filename string,
 * but DecisionDecoder.jsx's own processFile called them with the File
 * object itself - coerced to "[object File]", matching neither extension
 * pattern. Also verifies computeCombinedText's ADR-008 fix: a dropped
 * file's real name (which commonly carries a veteran's own name) never
 * appears in the neutral "Document N (type, date)"-labeled text
 * denialText builds from the dropped files' extracted content.
 *
 * final16 QA re-review (2026-09-29): this spec used to go on to click
 * "Decode This Decision" and assert that labeled text reached a real
 * (network-intercepted) Gemini request body - i.e. that document-derived
 * text may be sent off-device whenever only a cloud provider is
 * configured. Owner decision (E) says the opposite: text derived from a
 * dropped document may only ever reach an on-device engine; a cloud-only
 * configuration must fall back to the local parsers instead. That
 * routing decision belongs to aiStatementHelper.js/unifiedAIService.js
 * (the parallel fix/final17-docs-on-device-routing track), not to
 * DecisionDecoder.jsx's drop-in acceptance/labeling this spec is actually
 * scoped to - so it stops at the label denialText carries, never at what
 * decodeDecision/generateAI does with it afterward. Cloud AI (a
 * syntactically valid but non-authenticating fake Gemini key) is still
 * configured below purely so isAIAvailable()'s readiness check doesn't
 * hide the "Decode This Decision" affordance the earlier D16-6 fix also
 * covers.
 */
import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { dismissDisclaimer } from "./helpers";

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

// Syntactically valid-looking (passes isValidApiKey's placeholder check) but
// won't actually authenticate - the Gemini call is intercepted below before
// any real network request is made.
const FAKE_GEMINI_KEY = "AIzaSyFakeKey_ForTestingOnly_1234567890A";

const PDF_FILE_NAME = "John-Doe-VA-decision-letter.pdf";
const IMAGE_FILE_NAME = "Jane-Smith-decision-scan.png";
const SYNTHETIC_DENIAL_TEXT =
  "SYNTHETIC TEST DENIAL LETTER. Service connection for tinnitus is denied. " +
  "The evidence does not establish a nexus between the current disability " +
  "and any in-service event.";

// A minimal, valid, single-page PDF with one real text-showing operator, so
// pdf.js's own text-layer extraction (analyzePDF -> advancedPDFAnalysis)
// finds real text without needing OCR/Tesseract at all - offsets are
// computed from the actual accumulated byte length, not hand-counted, so a
// change to SYNTHETIC_DENIAL_TEXT can't silently desync the xref table.
function buildMinimalTextPdf(text: string): Buffer {
  const objectBodies = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 500 200] /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const streamContent = `BT /F1 14 Tf 20 100 Td (${text}) Tj ET`;
  objectBodies.push(
    `<< /Length ${Buffer.byteLength(streamContent, "utf-8")} >>\nstream\n${streamContent}\nendstream`,
  );

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objectBodies.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, "utf-8"));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "utf-8");
  const total = objectBodies.length + 1;
  pdf += `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) {
    pdf += `${offsets[i].toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf-8");
}

// D19-1: analyzeImage now runs real Tesseract OCR (it used to always
// resolve `text: ""` without ever calling it), so the dropped image fixture
// needs to be something a real OCR engine can actually read - a 1x1 pixel
// PNG (the previous fixture, back when OCR never ran) makes Tesseract throw
// ("Error attempting to read image"). Rendered in the live browser via
// canvas so it's a genuine, decodable PNG with real legible text, not a
// hand-rolled byte buffer. Takes pre-wrapped lines (not a single long
// string) so callers control legibility directly instead of this helper
// guessing a wrap width.
async function buildTextImagePng(page: Page, lines: string[]): Promise<Buffer> {
  const dataUrl = await page.evaluate((renderLines) => {
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 60 + renderLines.length * 50;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d canvas context unavailable");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "black";
    ctx.font = "bold 34px sans-serif";
    ctx.textBaseline = "top";
    renderLines.forEach((line, i) => {
      ctx.fillText(line, 20, 20 + i * 50);
    });
    return canvas.toDataURL("image/png");
  }, lines);
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

// Dispatch the modal-open window event until the dialog appears, re-firing
// on every poll tick (QualityControlCluster's openDecisionDecoder listener
// registers as a passive effect a tick after #main-content attaches, so a
// single dispatch can race it; every open handler is an idempotent
// setShow(true), so re-firing is harmless). Same proven pattern as
// dialog-contract.spec.ts's openModalByEvent for the same dialog.
async function bootDecisionDecoder(page: Page): Promise<void> {
  await page.addInitScript(
    ({ version, geminiKey }) => {
      localStorage.setItem("vet-rate-tos-accepted", "true");
      localStorage.setItem("vet_rate_last_seen_version", version);
      localStorage.setItem("vetrate-tour-completed", "true");
      localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
      localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
      localStorage.setItem("vetrate_gemini_key", geminiKey);
      localStorage.setItem("vet_rate_ai_mode", "cloud");
    },
    { version: APP_VERSION, geminiKey: FAKE_GEMINI_KEY },
  );

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await dismissDisclaimer(page);

  const dialog = page
    .locator('[role="dialog"]')
    .filter({ hasText: "Decision Decoder" });
  await expect
    .poll(
      async () => {
        await page.evaluate(() => {
          window.dispatchEvent(new CustomEvent("openDecisionDecoder"));
        });
        return dialog.count();
      },
      { timeout: 15000 },
    )
    .toBeGreaterThan(0);
  await dialog.first().waitFor({ state: "visible", timeout: 15000 });
}

test.describe("Decision Decoder Drop-In File (D16-6)", () => {
  test("accepts a dropped PDF and image, and the captured AI request body has no file name", async ({
    page,
  }) => {
    await bootDecisionDecoder(page);
    const dialog = page
      .locator('[role="dialog"]')
      .filter({ hasText: "Decision Decoder" })
      .first();

    await dialog.getByRole("button", { name: "Drop-In File" }).click();

    const pdfBuffer = buildMinimalTextPdf(SYNTHETIC_DENIAL_TEXT);
    const pngBuffer = await buildTextImagePng(page, ["UNUSED IMAGE TEXT"]);

    await dialog.locator('input[type="file"]').setInputFiles([
      { name: PDF_FILE_NAME, mimeType: "application/pdf", buffer: pdfBuffer },
      { name: IMAGE_FILE_NAME, mimeType: "image/png", buffer: pngBuffer },
    ]);

    // Both files reached the uploaded-files list at all - the exact gate
    // D16-6's bug rejected every file at, before either file's own OCR
    // outcome is even relevant.
    await expect(dialog.getByText("📁 Uploaded Files (2)")).toBeVisible({
      timeout: 20000,
    });
    await expect(dialog.getByText(PDF_FILE_NAME)).toBeVisible();
    // exact: true - real OCR now takes real time, so a "Processing:
    // <name>" label can still be on screen alongside the final filename
    // label; without exact:true this matches both and Playwright's strict
    // mode rejects the ambiguity.
    await expect(
      dialog.getByText(IMAGE_FILE_NAME, { exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await expect(dialog.getByText(/Unsupported file/i)).toHaveCount(0);

    // The PDF's real text layer (no OCR needed) reaches denialText.
    await expect(dialog.getByText(/Combined text ready/i)).toBeVisible({
      timeout: 20000,
    });

    // ADR-008: switch to the Paste tab to read denialText directly - the
    // exact string computeCombinedText built from the two dropped files.
    // Neither dropped file's real name may appear in it.
    await dialog.getByRole("button", { name: "Paste Text" }).click();
    const denialText = await dialog.locator("textarea").inputValue();
    expect(denialText).not.toContain(PDF_FILE_NAME);
    expect(denialText).not.toContain(IMAGE_FILE_NAME);
    expect(denialText).not.toContain("John-Doe");
    expect(denialText).not.toContain("Jane-Smith");
    expect(denialText).toContain("Document 1 (PDF,");
    expect(denialText).toContain("tinnitus is denied");

    // Deliberately stops here - see the file header re: D16-6/owner
    // decision (E) for why this spec never clicks "Decode This Decision"
    // to assert what happens to denialText off-device.
  });
});

/**
 * D19-1: ocr.js's analyzeImage used to always resolve `text: ""` without
 * ever running OCR, so a dropped image could never enable "Decode This
 * Decision" - this proves the real OCR path end to end (image -> extracted
 * text -> denialText -> decodeDecision), mirroring the already-proven
 * ADR-009 routing pattern from adr009-document-routing.spec.ts (own copies
 * of the small helpers below - not imported, to stay within this file's
 * ownership boundary) for the same "document" dataClass guarantee: an
 * on-device engine may see the dropped document's real content, a
 * cloud-only configuration may not and falls back to a local result.
 */
const IMAGE_OCR_MARKER = "ZEBRAFISH";
const IMAGE_DENIAL_LINES = [
  "THE DEPARTMENT OF VETERANS AFFAIRS",
  "HAS DENIED YOUR CLAIM FOR SERVICE",
  "CONNECTION FOR TINNITUS. NO NEXUS",
  `ESTABLISHED. MARKER ${IMAGE_OCR_MARKER}`,
];
const IMAGE_ROUTING_CLOUD_KEY = "AIzaSyE2EIMGFAKEKEY0000000000000000000";
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

async function loadFakeOnDeviceAI(page: Page): Promise<void> {
  const loadBtn = page.getByRole("button", { name: /^(📥 Load|🔄 Switch)/ });
  await loadBtn.waitFor({ state: "visible", timeout: 10000 });
  await loadBtn.click();
  await loadBtn.waitFor({ state: "hidden", timeout: 30000 });
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

interface CloudRecorder {
  bodies: string[];
}

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

function skipOnDeviceOnMobileTier(testInfo: {
  project: { name: string };
}): void {
  test.skip(
    testInfo.project.name === "mobile-chrome",
    "mobile-chrome's UA forces the mobile device tier (canUseWebLLM: false) " +
      "in deviceCapabilityDetector.js - on-device WebLLM is unreachable here.",
  );
}

async function bootAppForImageRouting(
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
    {
      version: APP_VERSION,
      cloudKey: IMAGE_ROUTING_CLOUD_KEY,
      withCloudKey,
    },
  );
  await page.goto("/");
  await dismissDisclaimer(page);
}

async function openDecisionDecoderForRouting(page: Page) {
  const dialog = page
    .locator('[role="dialog"]')
    .filter({ hasText: "Decision Decoder" });
  await expect
    .poll(
      async () => {
        await page.evaluate(() => {
          window.dispatchEvent(new CustomEvent("openDecisionDecoder"));
        });
        return dialog.count();
      },
      { timeout: 15000 },
    )
    .toBeGreaterThan(0);
  const first = dialog.first();
  await first.waitFor({ state: "visible", timeout: 15000 });
  return first;
}

async function dropDenialImageAndWaitForText(
  page: Page,
  dialog: Awaited<ReturnType<typeof openDecisionDecoderForRouting>>,
): Promise<void> {
  await dialog.getByRole("button", { name: "Drop-In File" }).click();
  const pngBuffer = await buildTextImagePng(page, IMAGE_DENIAL_LINES);
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "decision-scan.png",
    mimeType: "image/png",
    buffer: pngBuffer,
  });

  // The real OCR pass takes measurable wall-clock time (worker init +
  // recognition) - wait for it to finish and denialText to populate before
  // touching "Decode This Decision".
  await expect(dialog.getByText(/Combined text ready/i)).toBeVisible({
    timeout: 30000,
  });
  await expect(
    dialog.getByRole("button", { name: /Decode This Decision/i }),
  ).toBeEnabled();
}

test.describe("D19-1: Decision Decoder image drop-in document routing", () => {
  test("cloud-only: the OCR'd image never reaches the stubbed cloud, notice shows, local result shows", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await bootAppForImageRouting(page, { withCloudKey: true });
    const cloud = await stubCloudRoute(page);

    const dialog = await openDecisionDecoderForRouting(page);
    await dropDenialImageAndWaitForText(page, dialog);
    await dialog.getByRole("button", { name: /Decode This Decision/i }).click();

    await expect(dialog.getByText(/was not sent to/i)).toBeVisible({
      timeout: 20000,
    });
    await expect(dialog.getByText(/Full Denial/i)).toBeVisible();

    expect(cloud.bodies.some((b) => b.includes(IMAGE_OCR_MARKER))).toBe(false);
    expect(cloud.bodies.length).toBe(0);
  });

  test("on-device available: the fake engine receives the OCR'd text and decode completes", async ({
    page,
  }, testInfo) => {
    skipOnDeviceOnMobileTier(testInfo);
    test.setTimeout(60000);
    await shimFakeGpuAdapter(page);
    await bootAppForImageRouting(page, { withCloudKey: false });

    const dialog = await openDecisionDecoderForRouting(page);
    await dropDenialImageAndWaitForText(page, dialog);
    await loadFakeOnDeviceAI(page);
    await dialog.getByRole("button", { name: /Decode This Decision/i }).click();

    await expect(dialog.getByText(/Full Denial/i)).toBeVisible({
      timeout: 20000,
    });

    const calls = await readFakeEngineCalls(page);
    expect(calls.some((c) => c.user.includes(IMAGE_OCR_MARKER))).toBe(true);
  });
});

/**
 * Pre-existing bug (surfaced on Firefox): SmartAILoadButton's onLoadComplete
 * in DecisionDecoder.jsx only logged, never updating any state, so
 * `!aiStatus.anyAvailable` never re-evaluated and the button stayed on
 * screen forever after a successful on-device load. Fixed by mirroring
 * DD214Analyzer.jsx/BlueButtonXRay.jsx's `setAIStatus(getAIStatus())` call.
 * Runs on both chromium and firefox (no project filter) - only
 * skipOnDeviceOnMobileTier excludes mobile-chrome, where on-device WebLLM
 * is structurally unreachable regardless of this fix.
 */
test.describe("Decision Decoder: SmartAILoadButton disappears after on-device load", () => {
  test("the Load AI button is gone once the fake on-device engine finishes loading", async ({
    page,
  }, testInfo) => {
    skipOnDeviceOnMobileTier(testInfo);
    test.setTimeout(60000);
    await shimFakeGpuAdapter(page);
    await bootAppForImageRouting(page, { withCloudKey: false });

    const dialog = await openDecisionDecoderForRouting(page);
    const loadBtn = dialog.getByRole("button", {
      name: /^(📥 Load|🔄 Switch)/,
    });
    await expect(loadBtn).toBeVisible({ timeout: 10000 });
    await loadBtn.click();

    // Ground truth that loading actually finished (not just that the Load
    // button's own text briefly changed mid-spinner): the header's
    // AIStatusBadge derives independently from getAIStatus() and is not
    // touched by this fix, so waiting on it sidesteps any race with
    // SmartAILoadButton's own transient loading state.
    const statusBadge = dialog.locator('[data-testid="ai-status-badge"]');
    await expect(statusBadge).not.toHaveAttribute(
      "aria-label",
      "No AI configured - Click to set up",
      { timeout: 30000 },
    );

    // The actual bug: DecisionDecoder.jsx's wrapper div (gated on
    // `!aiStatus.anyAvailable`) never re-evaluated after a successful load,
    // so SmartAILoadButton (in whichever of its own internal states: the
    // load/switch prompt or its "AI Ready" notice) stayed mounted and
    // visible forever instead of disappearing with the rest of its wrapper.
    await expect(
      dialog.getByText(
        /Load AI for This Tool|Recommended: Switch Model|AI Ready/,
      ),
    ).toBeHidden();
  });
});

/**
 * D-4: advancedOCR.js's fast text-layer extraction used to cap at
 * MAX_OCR_PAGES (20) even though reading a PDF's own text layer is cheap -
 * a 520-page text-only PDF silently imported as its first 20 pages with no
 * signal the rest were never read. Real PDF parsing (pdf.js) and real OCR
 * (Tesseract) both need a real browser, not jsdom - hence e2e, not vitest
 * (same reasoning as this repo's other OCR/vision coverage).
 */
async function buildGenericTextOnlyPdf(pageCount: number): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pageCount; i++) {
    const page = pdfDoc.addPage([300, 150]);
    page.drawText(
      `Generic fixture page ${i} contains enough real text content marker`,
      {
        x: 20,
        y: 100,
        size: 12,
        font,
      },
    );
  }
  return Buffer.from(await pdfDoc.save());
}

// A mix of real-text pages and truly blank (zero content stream, so
// getTextContent() returns nothing) pages standing in for scanned,
// image-only pages - without needing an actual scanned image fixture.
async function buildMixedCoveragePdf(): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const layout = ["text", "blank", "text", "blank", "text"];
  layout.forEach((kind, idx) => {
    const page = pdfDoc.addPage([300, 150]);
    if (kind === "text") {
      page.drawText(
        `Generic fixture text page ${idx + 1} has enough real text content here`,
        {
          x: 20,
          y: 100,
          size: 12,
          font,
        },
      );
    }
  });
  return Buffer.from(await pdfDoc.save());
}

async function injectAdvancedOCRModule(page: Page): Promise<void> {
  await page.addScriptTag({
    type: "module",
    content: `
      import advancedPDFAnalysis from "/src/utils/advancedOCR.js";
      window.__advancedPDFAnalysis = advancedPDFAnalysis;
    `,
  });
  await page.waitForFunction(
    () =>
      Boolean(
        (window as unknown as Record<string, unknown>).__advancedPDFAnalysis,
      ),
    null,
    { timeout: 15000 },
  );
}

interface PageCoverageResult {
  pageCount: number;
  pagesRead: number;
  pagesOCRd: number;
  pagesSkipped: number[];
  coverageNote: string;
  text: string;
}

async function runAdvancedPDFAnalysis(
  page: Page,
  pdfBase64: string,
  options: Record<string, unknown>,
): Promise<PageCoverageResult> {
  return page.evaluate(
    async ({ base64, opts }) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const file = new File([bytes], "fixture.pdf", {
        type: "application/pdf",
      });
      const fn = (
        window as unknown as {
          __advancedPDFAnalysis: (
            f: File,
            o: Record<string, unknown>,
            p: () => void,
          ) => Promise<PageCoverageResult>;
        }
      ).__advancedPDFAnalysis;
      return fn(file, opts, () => {});
    },
    { base64: pdfBase64, opts: options },
  );
}

test.describe("D-4: advancedOCR full page coverage", () => {
  test("a generic 520-page text-only PDF: every page's text layer is read, not just the first 20", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await bootDecisionDecoder(page);
    const dialog = page
      .locator('[role="dialog"]')
      .filter({ hasText: "Decision Decoder" })
      .first();

    await dialog.getByRole("button", { name: "Drop-In File" }).click();
    const pdfBuffer = await buildGenericTextOnlyPdf(520);
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "generic-520-page.pdf",
      mimeType: "application/pdf",
      buffer: pdfBuffer,
    });

    await expect(dialog.getByText(/Combined text ready/i)).toBeVisible({
      timeout: 40000,
    });
    await dialog.getByRole("button", { name: "Paste Text" }).click();
    const denialText = await dialog.locator("textarea").inputValue();

    expect(denialText).toContain("Generic fixture page 1 contains");
    expect(denialText).toContain("Generic fixture page 520 contains");
  });

  test("a mixed PDF (real-text + blank/image-only pages) reports coverage truthfully, never silently", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await bootDecisionDecoder(page);
    await injectAdvancedOCRModule(page);

    const pdfBuffer = await buildMixedCoveragePdf();
    const base64 = pdfBuffer.toString("base64");
    // MAX_OCR_PAGES: 1 - only 1 of the 2 blank (image-only) pages can be
    // OCR'd, so the other must show up as explicitly skipped, never dropped
    // with no trace.
    const result = await runAdvancedPDFAnalysis(page, base64, {
      MAX_OCR_PAGES: 1,
    });

    expect(result.pageCount).toBe(5);
    expect(result.pagesRead).toBe(5);
    expect(result.pagesOCRd).toBe(1);
    expect(result.pagesSkipped).toHaveLength(1);
    expect(result.coverageNote).toMatch(/skipped/i);
    expect(result.text).toContain("Generic fixture text page 1");
    expect(result.text).toContain("Generic fixture text page 3");
    expect(result.text).toContain("Generic fixture text page 5");
    expect(result.text).toMatch(/NOT READ/);
  });
});
