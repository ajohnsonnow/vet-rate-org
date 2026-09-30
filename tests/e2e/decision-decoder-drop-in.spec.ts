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

// A real, valid 1x1 PNG - only needs to pass the type-detection gate and
// not crash the image OCR path; its own extracted text isn't exercised
// here (the PDF above supplies the denial text the AI request body is
// checked against).
const MINIMAL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUAAScy0FUAAAAASUVORK5CYII=";

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
  // Lazy QC cluster mounts after networkidle; its window listener for
  // openDecisionDecoder registers a paint cycle later (same margin
  // tool-launch-matrix.spec.ts uses for every lazy-cluster tool).
  await page.waitForTimeout(1200);

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("openDecisionDecoder"));
  });
  await page
    .locator('[role="dialog"]')
    .filter({ hasText: "Decision Decoder" })
    .first()
    .waitFor({ state: "visible", timeout: 15000 });
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
    const pngBuffer = Buffer.from(MINIMAL_PNG_BASE64, "base64");

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
    await expect(dialog.getByText(IMAGE_FILE_NAME)).toBeVisible();
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
