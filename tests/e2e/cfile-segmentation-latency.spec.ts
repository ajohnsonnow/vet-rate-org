/**
 * D19-7 (item 4): a real PDF C-File import's segmentation phase
 * (musterCallProcessor.js's buildSegmentedCFileResult -> segmentCFile /
 * findDocumentBoundaries, and the vaCodeSheet.js code-sheet parsers) ran as
 * one long synchronous main-thread task before this fix - measured
 * ~0.35-0.48s at 1x / 1.9-2.2s at 4x on a real 2,018-page C-File, long
 * enough that a Quick Exit click landing inside it (4x) took 1,438ms.
 *
 * Unlike dkb-import-latency.spec.ts (a plain .txt upload, targeting DKB
 * scoring), this drives a REAL PDF through pdf.js text extraction
 * (advancedOCR.js/documentAnalyzer.js), so what's measured is genuinely the
 * segmentation phase of a PDF import, not text-file parsing.
 *
 * The fixture text reuses dkb-import-latency.spec.ts's medical-narrative
 * word list (proven live to classify as C_FILE_MEDICAL by that spec's own
 * doc comment) at a larger scale, packed into real PDF pages dense enough
 * to carry ~6.7M characters, well inside the 20 real pages advancedOCR.js's
 * MAX_OCR_PAGES actually extracts from a <50MB PDF (see
 * PDF_LINES_PER_PAGE's doc comment) - on base, a direct Node profile
 * against segmentCFile/vaCodeSheet.js at a comparable character count
 * measured ~1.4s of synchronous work, well past this spec's 500ms/1000ms
 * budgets with margin. This fixture also carries no code-sheet header at
 * all (plain progress-note narrative), the shape that hits the most
 * expensive code-sheet-phase fallback path.
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";
import { test, expect, type Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";
import {
  armPanicGesture,
  armPanicTiming,
  measureClickToNavigation,
  measureKeydownToNavigation,
} from "./panic-latency-timing";

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

const QUICK_EXIT_SELECTOR =
  'button[aria-label="Quick exit - immediately leave this page"]';

// See this file's doc comment: the real 2,018-page measurement was
// 0.35-0.48s at 1x for a smaller, denser real C-File; this fixture is
// deliberately larger, and a direct Node profile at a comparable size
// measured ~1s of combined synchronous work pre-fix - both well clear of
// "still broken" and "fixed", not a coin-flip threshold.
const LATENCY_TRIGGER_1X_MS = 500;
const LATENCY_TRIGGER_4X_MS = 1000;

const SYNTHETIC_WORDS = [
  "service",
  "connection",
  "ptsd",
  "tinnitus",
  "knee",
  "pain",
  "examination",
  "diagnosis",
  "rating",
  "veteran",
  "disability",
  "claim",
  "medical",
  "record",
  "treatment",
  "chronic",
  "condition",
  "nexus",
  "opinion",
  "evidence",
  "deployment",
  "combat",
  "exposure",
  "hearing",
  "loss",
  "back",
  "shoulder",
  "anxiety",
  "depression",
  "sleep",
  "apnea",
  "migraine",
  "headache",
  "doctor",
  "physician",
  "clinic",
  "hospital",
  "notes",
  "findings",
  "history",
  "symptom",
  "injury",
  "surgery",
];

// Deterministic pseudo-random generator, same shape as
// dkb-import-latency.spec.ts's - reproducible fixture/classification.
function buildSyntheticCFileText(pages: number): string {
  let seed = 7;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const paragraph = () => {
    const wordCount = 60 + Math.floor(rand() * 40);
    let text = "";
    for (let i = 0; i < wordCount; i++) {
      text +=
        SYNTHETIC_WORDS[Math.floor(rand() * SYNTHETIC_WORDS.length)] + " ";
    }
    return text;
  };

  let text = "";
  for (let page = 1; page <= pages; page++) {
    text += `--- PAGE ${page} of ${pages} ---\n`;
    text += `VA MEDICAL CENTER\nPROGRESS NOTE\nCHIEF COMPLAINT: ${paragraph()}\n`;
    text += `PHYSICAL EXAMINATION: ${paragraph()}\n`;
    text += `ASSESSMENT AND PLAN: ${paragraph()}\n\n`;
  }
  return text;
}

// Character-count wrapping (not width-measured) - fast enough to wrap
// millions of characters in well under a second; maxChars is chosen
// conservatively below the width-measured average for this font/size so no
// line overflows the page (pdf.js's text extraction does not return text
// placed outside a page's content - verified directly against pdf-lib/
// pdfjs-dist before relying on it here).
function wrapByCharCount(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
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

const PDF_FONT_SIZE = 5;
const PDF_MAX_CHARS_PER_LINE = 190;
const PDF_LEFT_MARGIN = 20;
const PDF_PAGE_TOP_Y = 790;
const PDF_PAGE_BOTTOM_Y = 5;

// advancedOCR.js's MAX_OCR_PAGES caps a normal (<50MB) PDF's real text-layer
// extraction at just 20 pages, regardless of true page count (verified live
// against this exact fixture shape before relying on it: a >100-page
// version of this fixture came through musterCallProcessor's own "C-File
// scan: ~N pages" log as only ~164 estimated pages - the first 20 real PDF
// pages' worth of text). Rather than a 50MB+ fixture (the >50MB path is real
// and important, but not what THIS spec targets), each real page below
// packs far more text than it could ever display: pdf.js's text extraction
// returns every positioned text-showing operator in a page's content
// stream regardless of visual overlap (verified directly against pdf-lib/
// pdfjs-dist - 8,000 overlapping lines on one page all extracted correctly,
// in source order), so a tiny line height lets one real page carry over a
// million characters.
const PDF_LINES_PER_PAGE = 5000;

async function drawLinesAsPages(
  pdfDoc: PDFDocument,
  font: PDFFont,
  lines: string[],
): Promise<void> {
  const lineHeight = (PDF_PAGE_TOP_Y - PDF_PAGE_BOTTOM_Y) / PDF_LINES_PER_PAGE;
  for (let i = 0; i < lines.length; i += PDF_LINES_PER_PAGE) {
    const page = pdfDoc.addPage([612, 792]);
    const pageLines = lines.slice(i, i + PDF_LINES_PER_PAGE);
    for (let j = 0; j < pageLines.length; j++) {
      page.drawText(pageLines[j], {
        x: PDF_LEFT_MARGIN,
        y: PDF_PAGE_TOP_Y - j * lineHeight,
        size: PDF_FONT_SIZE,
        font,
      });
    }
  }
}

// ~6.7M characters, well within advancedOCR.js's 20-real-page cap (see
// PDF_LINES_PER_PAGE's doc comment) - large enough that base's unchunked
// segmentation phase blocks for over a second (see file doc comment).
async function buildFixturePdfBytes(): Promise<Buffer> {
  const text = buildSyntheticCFileText(3300);
  const lines = wrapByCharCount(text, PDF_MAX_CHARS_PER_LINE);
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  await drawLinesAsPages(pdfDoc, font, lines);
  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

// Built once per test-process run (not once per test) - every test below
// uses the identical fixture.
let cachedFixturePath: Promise<string> | null = null;
async function getFixturePdfPath(): Promise<string> {
  cachedFixturePath ??= (async () => {
    const dir = join(process.cwd(), "test-results", "cfile-seg-latency");
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, "synthetic-large-cfile.pdf");
    if (!existsSync(filePath)) {
      writeFileSync(filePath, await buildFixturePdfBytes());
    }
    return filePath;
  })();
  return cachedFixturePath;
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

async function stubWeatherRedirect(page: Page): Promise<void> {
  await page.route("https://www.weather.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body>stub</body></html>",
    }),
  );
}

// Same DB pre-creation workaround as dkb-import-latency.spec.ts - opening a
// NEW IndexedDB database while a bulk write runs was observed to stall.
async function precreateDatabases(page: Page): Promise<void> {
  await page.goto("/support.html", { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    const buildVkb = (db: IDBDatabase) => {
      if (db.objectStoreNames.contains("knowledge_base")) return;
      const s = db.createObjectStore("knowledge_base", { keyPath: "id" });
      s.createIndex("lastUpdated", "metadata.lastUpdated", { unique: false });
    };
    const buildPacket = (db: IDBDatabase) => {
      if (!db.objectStoreNames.contains("documents")) {
        const s = db.createObjectStore("documents", { keyPath: "id" });
        s.createIndex("classification", "classification", { unique: false });
        s.createIndex("uploadDate", "uploadDate", { unique: false });
        s.createIndex("fileName", "fileName", { unique: false });
      }
      if (!db.objectStoreNames.contains("document_index")) {
        const s = db.createObjectStore("document_index", { keyPath: "id" });
        s.createIndex("classification", "classification", { unique: false });
      }
    };
    const specs = [
      { name: "VetRateVKB", version: 1, build: buildVkb },
      { name: "VetRateMyPacket", version: 2, build: buildPacket },
    ];
    for (const spec of specs) {
      await new Promise<void>((resolve) => {
        const req = indexedDB.open(spec.name, spec.version);
        req.onupgradeneeded = () => spec.build(req.result);
        req.onsuccess = () => resolve(req.result.close());
        req.onerror = () => resolve();
        setTimeout(resolve, 20_000);
      });
    }
  });
  await page.goto("/");
  await dismissDisclaimer(page);
}

async function injectMusterCallProcessor(page: Page): Promise<void> {
  await page.addScriptTag({
    type: "module",
    content: `
      import * as musterMod from "/src/utils/musterCallProcessor.js";
      window.__cfileSegLatencyMods = { musterMod };
    `,
  });
  await page.waitForFunction(
    () => Boolean(window.__cfileSegLatencyMods),
    null,
    { timeout: 60_000 },
  );
}

async function createFileInput(page: Page): Promise<void> {
  await page.evaluate(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.id = "__cfile_seg_latency_file_input";
    input.style.position = "fixed";
    input.style.top = "-9999px";
    document.body.appendChild(input);
  });
}

// musterCallProcessor.js's parseCFileDocument logs this as its first
// statement, before quickScanCFile/buildSegmentedCFileResult run - the
// exact entry point into the risky synchronous pass this spec targets.
const SEGMENTATION_STARTING_LOG = "📚 Using enhanced C-File Segmentation...";

// buildSegmentedCFileResult logs this once segmentCFileChunked finishes and
// before the code-sheet phase (parseRatingCodeSheetsChunked, and its
// no-code-sheet fallback) starts - D19-7 item 1's own phase, distinct from
// (and running well after) SEGMENTATION_STARTING_LOG above. The original
// version of this spec only ever pressed at SEGMENTATION_STARTING_LOG, so a
// regression that re-lengthens any later phase (this one included) could
// pass unnoticed - see this file's own defect history.
const SEGMENTED_INTO_LOG = "✅ Segmented C-File into";

async function startBackgroundImport(
  page: Page,
  filePath: string,
  waitForLog: string = SEGMENTATION_STARTING_LOG,
): Promise<void> {
  const logSeen = page.waitForEvent("console", {
    predicate: (msg) => msg.text().includes(waitForLog),
    timeout: 60_000,
  });
  await page.locator("#__cfile_seg_latency_file_input").setInputFiles(filePath);
  await page.evaluate(() => {
    const input = document.getElementById(
      "__cfile_seg_latency_file_input",
    ) as HTMLInputElement;
    const file = input.files?.[0];
    const mods = window.__cfileSegLatencyMods;
    if (!file || !mods) return;
    mods.musterMod.processFormationDocument(file).catch(() => {});
  });
  await logSeen;
}

async function prepareImportReadyPage(page: Page): Promise<void> {
  await armPanicTiming(page);
  await seedReturningUser(page);
  await precreateDatabases(page);
  await injectMusterCallProcessor(page);
  await createFileInput(page);
  await armPanicGesture(page);
}

async function withCPUThrottle(
  page: Page,
  rate: number,
  fn: () => Promise<void>,
): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setCPUThrottlingRate", { rate });
  try {
    await fn();
  } finally {
    await client.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  }
}

test.describe("D19-7: real PDF C-File segmentation never blocks the panic key", () => {
  // Every test here imports the same ~6.7M-char real PDF - CPU-heavy in its
  // own right, and the 4x-throttle tests are sensitive to contention from
  // other tests' Chromium instances running at the same time (same
  // rationale as dkb-import-latency.spec.ts's cold-cache describe block).
  // Serializing keeps these four from ever overlapping each other.
  test.describe.configure({ mode: "serial" });

  test.skip(
    ({ isMobile }) => !!isMobile,
    "Large real-PDF import is desktop/laptop-only in scope for this spec.",
  );

  test("triple-Escape still redirects promptly during a real PDF import's segmentation phase (1x)", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const fixturePath = await getFixturePdfPath();
    await stubWeatherRedirect(page);
    await prepareImportReadyPage(page);

    await startBackgroundImport(page, fixturePath);
    const latencyMs = await measureKeydownToNavigation(page);
    // eslint-disable-next-line no-console
    console.log(
      `[cfile-seg-latency] triple-Escape during segmentation: ${latencyMs}ms`,
    );

    expect(page.url()).toMatch(/weather\.com/);
    expect(latencyMs).toBeLessThan(LATENCY_TRIGGER_1X_MS);
  });

  test("Quick Exit still redirects promptly during a real PDF import's segmentation phase (1x)", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const fixturePath = await getFixturePdfPath();
    await stubWeatherRedirect(page);
    await prepareImportReadyPage(page);

    const box = await page.locator(QUICK_EXIT_SELECTOR).first().boundingBox();
    if (!box) throw new Error("Quick Exit button has no bounding box");

    await startBackgroundImport(page, fixturePath);
    const latencyMs = await measureClickToNavigation(page, box);
    // eslint-disable-next-line no-console
    console.log(
      `[cfile-seg-latency] Quick Exit during segmentation: ${latencyMs}ms`,
    );

    expect(page.url()).toMatch(/weather\.com/);
    expect(latencyMs).toBeLessThan(LATENCY_TRIGGER_1X_MS);
  });

  test("triple-Escape still redirects within budget under a 4x CPU throttle", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "CPU throttling is a Chromium CDP feature.",
    );
    test.setTimeout(180_000);
    const fixturePath = await getFixturePdfPath();
    await stubWeatherRedirect(page);
    await prepareImportReadyPage(page);

    let latencyMs = 0;
    await withCPUThrottle(page, 4, async () => {
      await startBackgroundImport(page, fixturePath);
      latencyMs = await measureKeydownToNavigation(page);
    });
    // eslint-disable-next-line no-console
    console.log(
      `[cfile-seg-latency] triple-Escape during segmentation (4x): ${latencyMs}ms`,
    );

    expect(page.url()).toMatch(/weather\.com/);
    expect(latencyMs).toBeLessThan(LATENCY_TRIGGER_4X_MS);
  });

  test("Quick Exit still redirects within budget under a 4x CPU throttle", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "CPU throttling is a Chromium CDP feature.",
    );
    test.setTimeout(180_000);
    const fixturePath = await getFixturePdfPath();
    await stubWeatherRedirect(page);
    await prepareImportReadyPage(page);

    const box = await page.locator(QUICK_EXIT_SELECTOR).first().boundingBox();
    if (!box) throw new Error("Quick Exit button has no bounding box");

    let latencyMs = 0;
    await withCPUThrottle(page, 4, async () => {
      await startBackgroundImport(page, fixturePath);
      latencyMs = await measureClickToNavigation(page, box);
    });
    // eslint-disable-next-line no-console
    console.log(
      `[cfile-seg-latency] Quick Exit during segmentation (4x): ${latencyMs}ms`,
    );

    expect(page.url()).toMatch(/weather\.com/);
    expect(latencyMs).toBeLessThan(LATENCY_TRIGGER_4X_MS);
  });

  // D19-7 item 1: the code-sheet phase (parseRatingCodeSheetsChunked and its
  // no-code-sheet fallback) runs right after SEGMENTED_INTO_LOG, and this
  // fixture carries no code sheet at all - the shape that used to fall
  // through to the most expensive, least-chunked path. The four tests above
  // only ever pressed at SEGMENTATION_STARTING_LOG, well before this phase
  // even starts, so a regression here could pass unnoticed.
  test("triple-Escape still redirects promptly right as the code-sheet phase begins (1x)", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const fixturePath = await getFixturePdfPath();
    await stubWeatherRedirect(page);
    await prepareImportReadyPage(page);

    await startBackgroundImport(page, fixturePath, SEGMENTED_INTO_LOG);
    const latencyMs = await measureKeydownToNavigation(page);
    // eslint-disable-next-line no-console
    console.log(
      `[cfile-seg-latency] triple-Escape during code-sheet phase: ${latencyMs}ms`,
    );

    expect(page.url()).toMatch(/weather\.com/);
    expect(latencyMs).toBeLessThan(LATENCY_TRIGGER_1X_MS);
  });

  test("Quick Exit still redirects promptly right as the code-sheet phase begins (1x)", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const fixturePath = await getFixturePdfPath();
    await stubWeatherRedirect(page);
    await prepareImportReadyPage(page);

    const box = await page.locator(QUICK_EXIT_SELECTOR).first().boundingBox();
    if (!box) throw new Error("Quick Exit button has no bounding box");

    await startBackgroundImport(page, fixturePath, SEGMENTED_INTO_LOG);
    const latencyMs = await measureClickToNavigation(page, box);
    // eslint-disable-next-line no-console
    console.log(
      `[cfile-seg-latency] Quick Exit during code-sheet phase: ${latencyMs}ms`,
    );

    expect(page.url()).toMatch(/weather\.com/);
    expect(latencyMs).toBeLessThan(LATENCY_TRIGGER_1X_MS);
  });

  test("triple-Escape still redirects within budget right as the code-sheet phase begins under a 4x CPU throttle", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "CPU throttling is a Chromium CDP feature.",
    );
    test.setTimeout(180_000);
    const fixturePath = await getFixturePdfPath();
    await stubWeatherRedirect(page);
    await prepareImportReadyPage(page);

    let latencyMs = 0;
    await withCPUThrottle(page, 4, async () => {
      await startBackgroundImport(page, fixturePath, SEGMENTED_INTO_LOG);
      latencyMs = await measureKeydownToNavigation(page);
    });
    // eslint-disable-next-line no-console
    console.log(
      `[cfile-seg-latency] triple-Escape during code-sheet phase (4x): ${latencyMs}ms`,
    );

    expect(page.url()).toMatch(/weather\.com/);
    expect(latencyMs).toBeLessThan(LATENCY_TRIGGER_4X_MS);
  });

  test("Quick Exit still redirects within budget right as the code-sheet phase begins under a 4x CPU throttle", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "CPU throttling is a Chromium CDP feature.",
    );
    test.setTimeout(180_000);
    const fixturePath = await getFixturePdfPath();
    await stubWeatherRedirect(page);
    await prepareImportReadyPage(page);

    const box = await page.locator(QUICK_EXIT_SELECTOR).first().boundingBox();
    if (!box) throw new Error("Quick Exit button has no bounding box");

    let latencyMs = 0;
    await withCPUThrottle(page, 4, async () => {
      await startBackgroundImport(page, fixturePath, SEGMENTED_INTO_LOG);
      latencyMs = await measureClickToNavigation(page, box);
    });
    // eslint-disable-next-line no-console
    console.log(
      `[cfile-seg-latency] Quick Exit during code-sheet phase (4x): ${latencyMs}ms`,
    );

    expect(page.url()).toMatch(/weather\.com/);
    expect(latencyMs).toBeLessThan(LATENCY_TRIGGER_4X_MS);
  });
});
