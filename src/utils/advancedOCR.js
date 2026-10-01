/**
 * Vet-Rate.org - Advanced OCR System
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * DIAMOND STANDARD OCR - Best-in-class text extraction for veteran documents
 *
 * FEATURES:
 * - Multi-engine approach (Tesseract + fallbacks)
 * - Adaptive preprocessing (auto-detects document quality)
 * - Ensemble voting (combines multiple passes for accuracy)
 * - VA terminology correction
 * - Handles faxed, photocopied, and aged documents
 * - 100% client-side (no data leaves browser)
 *
 * OPTIMIZED FOR:
 * - DD-214s (military discharge papers)
 * - VA rating decisions (often faxed/photocopied)
 * - Medical records (varying quality)
 * - C-Files (scanned historical documents)
 */

import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import Tesseract from "tesseract.js";
import { getCachedDeviceProfile } from "./deviceCapabilityDetector";

// Configure pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const STANDARD_FONT_DATA_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`;

/**
 * Advanced OCR Configuration
 */
export const ADVANCED_OCR_CONFIG = {
  // Detection thresholds
  MIN_CHARS_PER_PAGE: 50,
  MIN_CONFIDENCE: 60,
  MIN_USEFUL_TEXT_LENGTH: 100, // Minimum chars for "useful" extraction

  // Processing limits
  MAX_OCR_PAGES: 20, // Process more pages for important docs
  MAX_PARALLEL_PAGES: 3, // Process multiple pages simultaneously

  // Quality settings - INCREASED for degraded documents
  CANVAS_SCALES: [2.5, 3.5, 4.5], // Higher resolution for better OCR
  CANVAS_SCALES_DEGRADED: [3.5, 4.5, 6.0], // Even higher for severely degraded
  TESSDATA_PATH: "https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.0.0/",

  // Languages (prioritize English but support others)
  LANGUAGES: "eng",

  // Ensemble settings
  ENABLE_ENSEMBLE: true, // Combine multiple passes
  MIN_ENSEMBLE_PASSES: 2, // At least 2 passes for voting

  // Retry settings for failed OCR
  ENABLE_RETRY_WITH_HIGHER_SCALE: true, // Retry with higher scale if OCR fails
  MAX_RETRIES: 2, // Maximum retry attempts

  // Blank-page detection: a zero-text-item page is rendered once at this low
  // scale and skipped when almost nothing on it differs from the paper.
  BLANK_CHECK_SCALE: 0.75,
  BLANK_CHECK_TIMEOUT_MS: 30_000,

  // No OCR promise may hang: every render, recognize job, worker start and
  // teardown below is bounded by one of these.
  OCR_PAGE_TIMEOUT_MS: 180_000,
  OCR_WORKER_START_TIMEOUT_MS: 60_000,
  OCR_CLEANUP_TIMEOUT_MS: 10_000,
};

// A pixel counts as ink when its luminance differs from the page background
// by more than this (small on purpose: faded faxes and old photocopies print
// text only ~25 levels darker than the paper, and a page that is merely
// faint must never be taken for blank); a page is blank when ink covers at most this fraction.
// Kept deliberately tiny (about 27 px of a 459x594 render) so a page holding
// even one short line of real text is never mistaken for blank. Scanner grain,
// dust specks and smooth edge shadows are filtered out before this is measured.
const BLANK_INK_LUMINANCE_DELTA = 16;
export const BLANK_PAGE_MAX_INK_FRACTION = 0.0001;

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms} ms`);
      err.isTimeout = true;
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Bounds a pdf.js render and cancels it on timeout so a stuck render stops
// consuming CPU and memory after the page has been reported failed.
async function renderWithTimeout(page, ctx, viewport, ms, label) {
  const task = page.render({ canvasContext: ctx, viewport });
  try {
    await withTimeout(task.promise, ms, label);
  } catch (error) {
    if (error.isTimeout) {
      try {
        task.cancel?.();
      } catch {
        // already settled
      }
      task.promise?.catch?.(() => {});
    }
    throw error;
  }
}

function releaseCanvas(canvas) {
  if (!canvas) return;
  canvas.width = 0;
  canvas.height = 0;
  canvas.remove();
}

function pixelLuminance(data, i) {
  const alpha = data[i + 3] / 255;
  const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  return lum * alpha + 255 * (1 - alpha);
}

const BLANK_INK_MIN_EDGE_CONTRAST = 8;
const BLANK_INK_MIN_COMPONENT_PIXELS = 6;

function luminanceBackground(lum) {
  const histogram = new Uint32Array(256);
  for (let i = 0; i < lum.length; i++) histogram[lum[i]]++;
  let background = 0;
  for (let l = 1; l < 256; l++) {
    if (histogram[l] > histogram[background]) background = l;
  }
  return background;
}

function buildInkMask(lum, width, background) {
  const mask = new Uint8Array(lum.length);
  for (let i = 0; i < lum.length; i++) {
    if (Math.abs(lum[i] - background) <= BLANK_INK_LUMINANCE_DELTA) continue;
    const x = i % width;
    const contrast = Math.max(
      x > 0 ? Math.abs(lum[i] - lum[i - 1]) : 0,
      x < width - 1 ? Math.abs(lum[i] - lum[i + 1]) : 0,
      i >= width ? Math.abs(lum[i] - lum[i - width]) : 0,
      i + width < lum.length ? Math.abs(lum[i] - lum[i + width]) : 0,
    );
    if (contrast >= BLANK_INK_MIN_EDGE_CONTRAST) mask[i] = 1;
  }
  return mask;
}

function floodComponent(mask, start, width, stack) {
  let size = 0;
  let top = 0;
  stack[top++] = start;
  mask[start] = 2;
  while (top > 0) {
    const i = stack[--top];
    size++;
    const x = i % width;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const n = i + dy * width + dx;
        if (nx < 0 || nx >= width || n < 0 || n >= mask.length) continue;
        if (mask[n] !== 1) continue;
        mask[n] = 2;
        stack[top++] = n;
      }
    }
  }
  return size;
}

/**
 * Fraction of pixels that are real ink: visibly different from the page's own
 * background (its most common luminance), sitting on a sharp edge (so smooth
 * scanner shadows are not ink), and part of a cluster of at least a few
 * pixels (so isolated dust specks are not ink). Transparent pixels count as
 * white paper. Without a width the pixels are read as a single row.
 */
export function measureInkFraction(imageData) {
  const { data } = imageData;
  const pixelCount = data.length / 4;
  if (pixelCount === 0) return 0;
  const width = imageData.width || pixelCount;
  const lum = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    lum[i] = Math.round(pixelLuminance(data, i * 4));
  }
  const mask = buildInkMask(lum, width, luminanceBackground(lum));
  const stack = new Int32Array(pixelCount);
  let ink = 0;
  for (let i = 0; i < pixelCount; i++) {
    if (mask[i] !== 1) continue;
    const size = floodComponent(mask, i, width, stack);
    if (size >= BLANK_INK_MIN_COMPONENT_PIXELS) ink += size;
  }
  return ink / pixelCount;
}

/**
 * Preprocessing levels with automatic selection
 */
export const PREPROCESS_STRATEGIES = {
  AUTO: "auto", // Auto-detect best strategy
  CLEAN: "clean", // High-quality scans (light processing)
  STANDARD: "standard", // Average quality (balanced processing)
  POOR: "poor", // Low quality/faxed (aggressive processing)
  AGED: "aged", // Old/yellowed documents
  SEVERELY_AGED: "severely_aged", // Very old, faded, degraded documents
  HANDWRITTEN: "handwritten", // Mixed print + handwriting
  INVERTED: "inverted", // White text on dark background
};

/**
 * RT8-4: advancedPDFAnalysis loads the whole file into one ArrayBuffer, then
 * renders each page to a high-res canvas for Tesseract. A 300MB+ PDF can
 * easily consume 2-4 GB of JS heap on the render path. Gate before we start.
 *
 * Thresholds are deliberately conservative:
 *   - 200 MB + low-memory device  → abort (recommend C-File Analyzer which streams)
 *   - 100 MB + mobile tier         → cap OCR pages to avoid OOM
 *   - >200 MB on any device        → cap pages (OCR beyond ~20 pp is rarely useful anyway)
 */
function enforceOCRSizeLimits(file, config) {
  const OCR_HARD_LIMIT_BYTES = 200 * 1024 * 1024; // 200 MB compressed
  const OCR_WARN_LIMIT_BYTES = 100 * 1024 * 1024; // 100 MB
  const deviceProfile = getCachedDeviceProfile();
  const isMobileDevice =
    deviceProfile?.isMobile || deviceProfile?.tier === "mobile";
  const isLowMemory = (deviceProfile?.systemRAM ?? 4) <= 2;

  if (file.size > OCR_HARD_LIMIT_BYTES && (isMobileDevice || isLowMemory)) {
    throw new Error(
      `This PDF (${Math.round(file.size / (1024 * 1024))} MB) is too large for OCR on your device. ` +
        "Use the C-File Analyzer tool instead - it streams pages one at a time and handles files of any size.",
    );
  }
  if (file.size > OCR_WARN_LIMIT_BYTES) {
    // Cap page count to avoid multi-GB canvas accumulation.
    config.MAX_OCR_PAGES = Math.min(config.MAX_OCR_PAGES, 10);
    // eslint-disable-next-line no-console
    console.warn(
      `[advancedOCR] Large file (${Math.round(file.size / (1024 * 1024))} MB) - capping OCR at ${config.MAX_OCR_PAGES} pages to prevent OOM.`,
    );
  }
}

/**
 * Main Advanced OCR Function
 * Analyzes PDF with multiple engines and preprocessing strategies
 *
 * @param {File} file - PDF file to analyze
 * @param {Object} options - Configuration options
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<OCRResult>}
 */
export async function advancedPDFAnalysis(
  file,
  options = {},
  onProgress = () => {},
) {
  const config = { ...ADVANCED_OCR_CONFIG, ...options };
  if (options.readAllPages) config.MAX_OCR_PAGES = Infinity;
  enforceOCRSizeLimits(file, config);

  try {
    onProgress({
      stage: "loading",
      progress: 0,
      message: "Loading document...",
    });
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      standardFontDataUrl: STANDARD_FONT_DATA_URL,
    }).promise;

    const numPages = pdf.numPages;
    onProgress({
      stage: "analyzing",
      progress: 5,
      message: `Analyzing ${numPages} page(s)...`,
    });

    // D-4: the text layer is cheap (no rendering/Tesseract) - read it from
    // EVERY page regardless of MAX_OCR_PAGES. A previous version capped
    // this loop too, so a 520-page text-only PDF silently imported as its
    // first 20 pages with no signal that the other 500 were never read.
    const standardText = await extractStandardText(
      pdf,
      numPages,
      config,
      onProgress,
    );

    const needsOCR =
      standardText.pagesNeedingOCR.length > 0 ||
      config.ocrOnlyPageNumbers?.length;
    if (!needsOCR) {
      onProgress({
        stage: "complete",
        progress: 100,
        message: "Text extraction complete",
      });
      return buildFullTextResult(standardText, numPages);
    }

    const result = await ocrImageOnlyPages(
      pdf,
      numPages,
      standardText,
      config,
      onProgress,
    );
    onProgress({ stage: "complete", progress: 100, message: "OCR complete" });
    return result;
  } catch (error) {
    console.error("❌ Advanced OCR failed:", error);
    throw error;
  }
}

// Text layer read for every page is cheap enough to yield only occasionally
// (not per-page like the pixel-processing loops below) while still keeping
// a 500+ page document from hogging the main thread in one long task.
const TEXT_LAYER_YIELD_INTERVAL = 25;

// D-4: does this SPECIFIC page's own text layer look usable? Mirrors the
// old whole-document average check's threshold, but per-page - a blended
// document-wide average let a handful of real text pages mask a genuinely
// image-only majority (or the reverse), silently deciding OCR for the
// entire document instead of just the pages that actually need it.
//
// Character count alone is not enough: a genuinely scanned/image-only page
// has NO text operators at all (itemCount === 0, since there's nothing but
// a rendered image on it). A page with real embedded text - even a short
// "Enclosure: VA Form 21-0958" last page, or a "Page N of M" footer page -
// has real text items and must never be routed through the full Tesseract
// ensemble (or have that already-extracted text discarded as "NOT READ"
// once it falls past MAX_OCR_PAGES) just because its own character count
// happens to be short.
export function pageNeedsOCR(pageText, itemCount, config) {
  return itemCount === 0 && pageText.trim().length < config.MIN_CHARS_PER_PAGE;
}

/**
 * Extract every page's embedded text layer (fast path) - always the full
 * document. Reports, per page, whether that layer looked usable so the
 * caller knows exactly which pages (if any) still need real OCR.
 */
async function extractStandardText(pdf, numPages, config, onProgress) {
  const startTime = Date.now();
  let fullText = "";
  let letterheadText = "";
  const pageTexts = new Map();
  const pagesNeedingOCR = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(" ");
    fullText += `--- PAGE ${i} ---\n${pageText}\n\n`;
    pageTexts.set(i, pageText);
    // Every parser expects the space-joined page, so the line breaks a VA
    // letter's standalone letterhead date depends on are kept separately.
    if (i === 1) {
      letterheadText = textContent.items
        .map((item) => item.str + (item.hasEOL ? "\n" : " "))
        .join("");
    }
    if (pageNeedsOCR(pageText, textContent.items.length, config))
      pagesNeedingOCR.push(i);

    onProgress({
      stage: "extracting",
      progress: 5 + (i / numPages) * 5,
      message: `Extracting text from page ${i}/${numPages}...`,
    });
    if (i % TEXT_LAYER_YIELD_INTERVAL === 0) await yieldToEventLoop();
  }

  return {
    text: fullText,
    letterheadText,
    pageTexts,
    pagesNeedingOCR,
    startTime,
  };
}

function buildFullTextResult(standardText, numPages) {
  return {
    text: standardText.text,
    letterheadText: standardText.letterheadText,
    pageCount: numPages,
    pagesRead: numPages,
    pagesOCRd: 0,
    pagesBlank: [],
    pagesSkipped: [],
    pagesFailed: [],
    method: "standard",
    confidence: 100,
    processingTime: Date.now() - standardText.startTime,
    ocrUsed: false,
    coverageNote: `Read all ${numPages} page(s) - every page had a usable text layer.`,
  };
}

// D-4: "a way to continue" - a caller that got back a non-empty
// `pagesSkipped` can re-invoke advancedPDFAnalysis with
// `options.ocrOnlyPageNumbers` set to (a batch of) those page numbers to
// OCR exactly them, bypassing the auto-detected image-only list.
//
// That batch may name only SOME of the document's full image-only list -
// every image-only page this round didn't OCR must still show up as
// skipped, not just the ones past MAX_OCR_PAGES within the batch itself,
// or a page outside the batch entirely falls through
// mergePageCoverageResult's plain text-layer branch with empty content and
// no marker: a silent gap. Exported for its own unit test.
export function computeOcrPageSets(
  imageOnlyPages,
  ocrOnlyPageNumbers,
  maxOcrPages,
) {
  const targetPages = ocrOnlyPageNumbers?.length
    ? ocrOnlyPageNumbers
    : imageOnlyPages;
  const pagesToOcr = targetPages.slice(0, maxOcrPages);
  const skippedPages = imageOnlyPages.filter((p) => !pagesToOcr.includes(p));
  return { pagesToOcr, skippedPages };
}

async function ocrImageOnlyPages(
  pdf,
  numPages,
  standardText,
  config,
  onProgress,
) {
  onProgress({
    stage: "ocr",
    progress: 10,
    message: `Checking ${standardText.pagesNeedingOCR.length} page(s) for content...`,
  });
  const { contentPages: imageOnlyPages, blankPages } =
    await partitionBlankPages(pdf, standardText.pagesNeedingOCR, config);

  const requested = config.ocrOnlyPageNumbers?.length
    ? config.ocrOnlyPageNumbers.filter((p) => !blankPages.includes(p))
    : undefined;
  const { pagesToOcr, skippedPages } =
    requested?.length === 0
      ? { pagesToOcr: [], skippedPages: imageOnlyPages }
      : computeOcrPageSets(imageOnlyPages, requested, config.MAX_OCR_PAGES);

  // eslint-disable-next-line no-console
  console.log(
    `📷 ${imageOnlyPages.length} page(s) lack a usable text layer (${blankPages.length} blank). OCR-ing ${pagesToOcr.length}, skipping ${skippedPages.length}.`,
  );

  let strategy = null;
  let ocrResults = [];
  if (pagesToOcr.length > 0) {
    onProgress({
      stage: "ocr",
      progress: 10,
      message: `Preparing OCR for ${pagesToOcr.length} scanned page(s)...`,
    });
    strategy = await detectOptimalStrategy(pdf, pagesToOcr[0], config);
    // eslint-disable-next-line no-console
    console.log(`🎯 Detected quality: ${strategy}`);
    ocrResults = await runAdvancedOCR(
      pdf,
      pagesToOcr,
      strategy,
      config,
      onProgress,
    );
  }

  return mergePageCoverageResult({
    standardText,
    numPages,
    maxOcrPages: config.MAX_OCR_PAGES,
    blankPages,
    pagesToOcr,
    skippedPages,
    ocrResults,
    strategy,
  });
}

async function isPageBlank(page, config) {
  let canvas = null;
  try {
    const viewport = page.getViewport({ scale: config.BLANK_CHECK_SCALE });
    canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await renderWithTimeout(
      page,
      ctx,
      viewport,
      config.BLANK_CHECK_TIMEOUT_MS,
      "Blank-page check",
    );
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return measureInkFraction(imageData) <= BLANK_PAGE_MAX_INK_FRACTION;
  } catch (error) {
    // A page that cannot be inspected is never assumed blank: it goes to OCR.
    console.warn(`[advancedOCR] blank-page check failed: ${error.message}`);
    return false;
  } finally {
    releaseCanvas(canvas);
  }
}

async function partitionBlankPages(pdf, pageNumbers, config) {
  const contentPages = [];
  const blankPages = [];
  for (const pageNum of pageNumbers) {
    const page = await pdf.getPage(pageNum);
    if (await isPageBlank(page, config)) blankPages.push(pageNum);
    else contentPages.push(pageNum);
  }
  return { contentPages, blankPages };
}

function formatPageList(pages) {
  const ranges = [];
  for (const p of pages) {
    const last = ranges[ranges.length - 1];
    if (last && p === last[1] + 1) last[1] = p;
    else ranges.push([p, p]);
  }
  const text = ranges.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`));
  return `${pages.length === 1 ? "page" : "pages"} ${text.join(", ")}`;
}

// Plain sentences only: the veteran reads this on screens that have no
// "read more" control, so it never points at one.
function buildCoverageNote({
  numPages,
  ocrdCount,
  maxOcrPages,
  blankPages,
  skippedPages,
  failedPages,
}) {
  const unread = skippedPages.length;
  const parts = [
    unread === 0
      ? `Read all ${numPages} page(s).`
      : `Read ${numPages - unread} of ${numPages} page(s).`,
  ];
  if (ocrdCount > 0) {
    parts.push(`${ocrdCount} scanned page(s) were read with OCR.`);
  }
  if (blankPages.length > 0) {
    parts.push(
      `${blankPages.length} blank page(s) (${formatPageList(blankPages)}) had nothing to read.`,
    );
  }
  const failedSet = new Set(failedPages);
  const overLimit = skippedPages.filter((p) => !failedSet.has(p));
  if (overLimit.length > 0) {
    parts.push(
      `${overLimit.length} scanned page(s) (${formatPageList(overLimit)}) were not read because only ${maxOcrPages} scanned pages are read at a time.`,
    );
  }
  if (failedPages.length > 0) {
    parts.push(
      `${failedPages.length} scanned page(s) (${formatPageList(failedPages)}) could not be read.`,
    );
  }
  return parts.join(" ");
}

// Weaves the three per-page sources (real text layer, freshly OCR'd, or
// explicitly skipped) back into one document in page order, so a skipped
// page is always a visible marker in the text - never a silent gap.
function mergePageCoverageResult({
  standardText,
  numPages,
  maxOcrPages,
  blankPages,
  skippedPages: limitSkippedPages,
  ocrResults,
  strategy,
}) {
  const failedPages = ocrResults.filter((r) => r.failed).map((r) => r.pageNum);
  const failedSet = new Set(failedPages);
  const skippedPages = [...limitSkippedPages, ...failedPages].sort(
    (a, b) => a - b,
  );
  const ocrByPage = new Map(
    ocrResults.filter((r) => !r.failed).map((r) => [r.pageNum, r]),
  );
  const ocrdCount = ocrResults.filter(
    (r) => !r.failed && !r.usedTextLayer,
  ).length;
  const skippedSet = new Set(skippedPages);
  const blankSet = new Set(blankPages);
  let fullText = "";
  let confidenceSum = 0;
  let confidenceCount = 0;

  for (let i = 1; i <= numPages; i++) {
    const ocrResult = ocrByPage.get(i);
    if (failedSet.has(i)) {
      fullText += `--- PAGE ${i} (NOT READ - scanned page, OCR could not read it) ---\n\n`;
    } else if (skippedSet.has(i)) {
      fullText += `--- PAGE ${i} (NOT READ - scanned page, OCR skipped due to size limits) ---\n\n`;
    } else if (blankSet.has(i)) {
      fullText += `--- PAGE ${i} (blank) ---\n\n`;
    } else if (ocrResult) {
      fullText += `--- PAGE ${i} (OCR ${ocrResult.confidence.toFixed(0)}%) ---\n${ocrResult.text.trim()}\n\n`;
      confidenceSum += ocrResult.confidence;
      confidenceCount++;
    } else {
      fullText += `--- PAGE ${i} ---\n${(standardText.pageTexts.get(i) || "").trim()}\n\n`;
    }
  }

  return {
    text: applyVATerminologyCorrection(fullText),
    letterheadText: standardText.letterheadText,
    pageCount: numPages,
    pagesRead: numPages - skippedPages.length,
    pagesOCRd: ocrdCount,
    pagesBlank: blankPages,
    pagesSkipped: skippedPages,
    pagesFailed: failedPages,
    method: ocrdCount > 0 ? "advanced_ocr" : "standard",
    strategy,
    confidence: confidenceCount > 0 ? confidenceSum / confidenceCount : 100,
    processingTime: Date.now() - standardText.startTime,
    ocrUsed: ocrdCount > 0,
    coverageNote: buildCoverageNote({
      numPages,
      ocrdCount,
      maxOcrPages,
      blankPages,
      skippedPages,
      failedPages,
    }),
  };
}

/**
 * Detect optimal OCR strategy based on document quality
 */
async function measureStrategyMetrics(pdf, pageNum, config) {
  let canvas = null;
  try {
    const page = await withTimeout(
      pdf.getPage(pageNum),
      config.OCR_PAGE_TIMEOUT_MS,
      "Strategy page load",
    );
    const viewport = page.getViewport({ scale: 1.5 });
    canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await renderWithTimeout(
      page,
      ctx,
      viewport,
      config.OCR_PAGE_TIMEOUT_MS,
      "Strategy render",
    );
    return analyzeImageQuality(
      ctx.getImageData(0, 0, canvas.width, canvas.height),
    );
  } finally {
    releaseCanvas(canvas);
  }
}

function strategyFromMetrics(metrics) {
  // Decision tree based on metrics - IMPROVED for aged documents
  // Check for inverted text (white on dark)
  if (metrics.isInverted) {
    // eslint-disable-next-line no-console
    console.log("🔄 Detected inverted text (white on dark background)");
    return PREPROCESS_STRATEGIES.INVERTED;
  }

  // Severely degraded: very low contrast OR very faded (high brightness)
  if (
    metrics.contrast < 20 ||
    (metrics.brightness > 220 && metrics.contrast < 40)
  ) {
    // eslint-disable-next-line no-console
    console.log(
      "⚠️ Severely degraded document detected - using maximum enhancement",
    );
    return PREPROCESS_STRATEGIES.SEVERELY_AGED;
  }

  // Poor quality: low contrast with high noise
  if (metrics.contrast < 30) return PREPROCESS_STRATEGIES.POOR;

  // Aged: yellowed or faded
  if (metrics.brightness > 200 || metrics.brightness < 50) {
    // Check if it's severely faded
    if (metrics.contrast < 50) {
      return PREPROCESS_STRATEGIES.SEVERELY_AGED;
    }
    return PREPROCESS_STRATEGIES.AGED;
  }

  if (metrics.noise > 40) return PREPROCESS_STRATEGIES.POOR;
  if (metrics.contrast > 70 && metrics.noise < 20)
    return PREPROCESS_STRATEGIES.CLEAN;
  return PREPROCESS_STRATEGIES.STANDARD;
}

async function detectOptimalStrategy(
  pdf,
  pageNum = 1,
  config = ADVANCED_OCR_CONFIG,
) {
  try {
    const metrics = await measureStrategyMetrics(pdf, pageNum, config);
    // eslint-disable-next-line no-console
    console.log(
      `📊 Image quality metrics: brightness=${metrics.brightness.toFixed(0)}, contrast=${metrics.contrast.toFixed(0)}, noise=${metrics.noise.toFixed(0)}, inverted=${metrics.isInverted}`,
    );
    return strategyFromMetrics(metrics);
  } catch (error) {
    console.warn("Strategy detection failed, using STANDARD:", error);
    return PREPROCESS_STRATEGIES.STANDARD;
  }
}

/**
 * Analyze image quality metrics
 */
function analyzeImageQuality(imageData) {
  const data = imageData.data;
  let totalBrightness = 0;
  const brightnessValues = [];
  let darkPixels = 0;
  let lightPixels = 0;

  // Sample pixels (every 10th pixel for performance)
  for (let i = 0; i < data.length; i += 40) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    brightnessValues.push(brightness);
    totalBrightness += brightness;

    // Track dark vs light pixels for inversion detection
    if (brightness < 100) darkPixels++;
    else if (brightness > 155) lightPixels++;
  }

  const avgBrightness = totalBrightness / brightnessValues.length;

  // Calculate contrast (standard deviation)
  let varianceSum = 0;
  for (const val of brightnessValues) {
    varianceSum += Math.pow(val - avgBrightness, 2);
  }
  const contrast = Math.sqrt(varianceSum / brightnessValues.length);

  // Estimate noise (high-frequency variation)
  let noiseSum = 0;
  for (let i = 1; i < brightnessValues.length; i++) {
    noiseSum += Math.abs(brightnessValues[i] - brightnessValues[i - 1]);
  }
  const noise = noiseSum / (brightnessValues.length - 1);

  // Detect inverted text (predominantly dark background)
  const totalSampled = brightnessValues.length;
  const isInverted = darkPixels / totalSampled > 0.6 && avgBrightness < 100;

  return {
    brightness: avgBrightness,
    contrast: contrast,
    noise: noise,
    isInverted: isInverted,
    darkPixelRatio: darkPixels / totalSampled,
    lightPixelRatio: lightPixels / totalSampled,
  };
}

/**
 * Determine ensemble scale set and worker pool size for a run.
 *
 * Worker pool: a single Tesseract worker processed pages strictly
 * sequentially while the rest of the CPU sat idle - the dominant cost on
 * multi-page scans. Pool size adapts to device tier (deviceCapabilityDetector):
 * desktop-high→8, desktop-mid→6, laptop→4, tablet→2, mobile→1.
 * Falls back to hardwareConcurrency - 2 when the device profile is not yet cached.
 */
function computeOCRPoolConfig(strategy, config, pagesToProcess) {
  const isDegraded =
    strategy === PREPROCESS_STRATEGIES.SEVERELY_AGED ||
    strategy === PREPROCESS_STRATEGIES.POOR ||
    strategy === PREPROCESS_STRATEGIES.AGED;

  const baseScales = isDegraded
    ? config.CANVAS_SCALES_DEGRADED
    : config.CANVAS_SCALES;

  const deviceOCRWorkers =
    getCachedDeviceProfile?.()?.ocrWorkers ||
    Math.max(2, (navigator.hardwareConcurrency || 4) - 2);
  const poolSize = Math.min(deviceOCRWorkers, 8, pagesToProcess);

  return { isDegraded, baseScales, poolSize };
}

/**
 * Create a Tesseract scheduler with `poolSize` workers attached.
 */
async function createOCRScheduler(poolSize, config) {
  const scheduler = Tesseract.createScheduler();
  let abandoned = false;
  try {
    await withTimeout(
      Promise.all(
        Array.from({ length: poolSize }, async () => {
          const worker = await Tesseract.createWorker(config.LANGUAGES);
          if (abandoned) {
            await worker.terminate().catch(() => {});
            return;
          }
          await worker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM.AUTO,
            preserve_interword_spaces: "1",
          });
          scheduler.addWorker(worker);
        }),
      ),
      config.OCR_WORKER_START_TIMEOUT_MS,
      "OCR worker start",
    );
  } catch (error) {
    abandoned = true;
    await terminateScheduler(scheduler, config);
    throw error;
  }
  return scheduler;
}

async function terminateScheduler(scheduler, config) {
  try {
    await withTimeout(
      scheduler.terminate(),
      config.OCR_CLEANUP_TIMEOUT_MS,
      "OCR worker teardown",
    );
  } catch (error) {
    console.warn(`[advancedOCR] ${error.message}`);
  }
}

/**
 * Build the page recognizer closure bound to a scheduler.
 */
function createPageRecognizer(scheduler, config) {
  return async (page, scale, preprocessStrategy) => {
    let canvas = null;
    let processedCanvas = null;
    let imageData;
    try {
      canvas = await renderPageToCanvas(
        page,
        scale,
        config.OCR_PAGE_TIMEOUT_MS,
      );
      processedCanvas = await applyAdvancedPreprocessing(
        canvas,
        preprocessStrategy,
      );
      imageData = processedCanvas.toDataURL("image/png");
    } finally {
      releaseCanvas(canvas);
      releaseCanvas(processedCanvas);
    }
    const result = await withTimeout(
      scheduler.addJob("recognize", imageData),
      config.OCR_PAGE_TIMEOUT_MS,
      "OCR recognition",
    );
    return {
      text: result.data.text,
      confidence: result.data.confidence,
      scale,
    };
  };
}

/**
 * Text-layer fast path: digitally-generated pages (VA forms, typed medical
 * records, decision letters) already have a UTF-8 text layer embedded in
 * the PDF - reusing it is both faster and more accurate than rendering to
 * a canvas and running Tesseract. We consider the layer "sufficient" when
 * it has > 20 text items AND > 100 characters (blank/stamp pages have few
 * items; cover sheets may have 1-5 lines). Scanned pages return items=0.
 * Returns the layer text, or null if OCR is required.
 */
async function tryTextLayerText(page) {
  try {
    const textContent = await page.getTextContent();
    const layerText = textContent.items
      .map((item) => item.str)
      .join(" ")
      .trim();
    if (textContent.items.length > 20 && layerText.length > 100) {
      return layerText;
    }
  } catch {
    // getTextContent can fail on corrupt pages - fall through to OCR
  }
  return null;
}

/**
 * OCR a single image-only page with ensemble voting and a high-scale retry
 * for pages that still extract very little text.
 */
async function recognizePageWithEnsemble(
  page,
  recognize,
  baseScales,
  strategy,
  config,
) {
  // Image-only page: one pass at the highest base scale. The full multi-scale
  // ensemble only runs when that pass reads poorly - most pages of a
  // typical scan are legible and don't need 3x the OCR work.
  const primary = await recognize(
    page,
    baseScales[baseScales.length - 1],
    strategy,
  );

  const pageResults = [primary];
  const needsEnsemble =
    config.ENABLE_ENSEMBLE &&
    (primary.confidence < config.MIN_CONFIDENCE ||
      primary.text.trim().length < config.MIN_USEFUL_TEXT_LENGTH);

  if (needsEnsemble) {
    for (const scale of baseScales.slice(0, -1)) {
      pageResults.push(await recognize(page, scale, strategy));
    }
  }

  let pageText =
    pageResults.length > 1 ? ensembleVote(pageResults) : primary.text;
  const avgConfidence =
    pageResults.reduce((sum, r) => sum + r.confidence, 0) / pageResults.length;

  // RETRY LOGIC: If OCR extracted very little text, try maximum scale
  // with the most aggressive preprocessing
  const textLength = pageText.trim().length;
  if (
    textLength < config.MIN_USEFUL_TEXT_LENGTH &&
    config.ENABLE_RETRY_WITH_HIGHER_SCALE
  ) {
    // 8x on a Letter page is ~31M pixels: an allocation failure here must
    // only forfeit this optional retry, never the text already read.
    try {
      const retry = await recognize(
        page,
        8.0,
        PREPROCESS_STRATEGIES.SEVERELY_AGED,
      );
      if (retry.text.trim().length > textLength) {
        pageText = retry.text;
      }
    } catch (error) {
      console.warn(`[advancedOCR] high-scale retry skipped: ${error.message}`);
    }
  }

  return { text: pageText, confidence: avgConfidence };
}

/**
 * Run `processPage` across the given page numbers with bounded (poolSize)
 * concurrency, returning results sorted by page number.
 */
async function runPagesWithBoundedConcurrency(
  pageNumbers,
  poolSize,
  processPage,
) {
  const queue = [...pageNumbers];
  const inFlight = queue.splice(0, poolSize).map((n) => processPage(n));
  const settled = [];
  while (inFlight.length > 0) {
    const done = await Promise.race(
      inFlight.map((p, idx) => p.then((r) => ({ r, idx }))),
    );
    settled.push(done.r);
    inFlight.splice(done.idx, 1);
    if (queue.length > 0) {
      inFlight.push(processPage(queue.shift()));
    }
  }
  settled.sort((a, b) => a.pageNum - b.pageNum);
  return settled;
}

/**
 * OCR one page. An allocation failure (huge canvas, out-of-memory buffer) is
 * recoverable: the page is retried once as a single plain pass at the lowest
 * scale. A timeout is not retried - the engine is the problem, not the size.
 * A page that still cannot be read comes back as `failed`, never as a throw,
 * so one bad page can't take the document's other pages down with it.
 */
async function ocrPageRecovering(
  page,
  recognize,
  baseScales,
  strategy,
  config,
) {
  try {
    return await recognizePageWithEnsemble(
      page,
      recognize,
      baseScales,
      strategy,
      config,
    );
  } catch (error) {
    if (error.isTimeout) throw error;
    console.warn(
      `[advancedOCR] OCR pass failed (${error.message}); retrying at the lowest scale`,
    );
    return recognizePageWithEnsemble(
      page,
      recognize,
      [config.CANVAS_SCALES[0]],
      PREPROCESS_STRATEGIES.STANDARD,
      {
        ...config,
        ENABLE_ENSEMBLE: false,
        ENABLE_RETRY_WITH_HIGHER_SCALE: false,
      },
    );
  }
}

function createPageProcessor({
  pdf,
  recognize,
  baseScales,
  strategy,
  config,
  pagesToProcess,
  onProgress,
}) {
  let completedPages = 0;
  const report = (message, extra = {}) => {
    completedPages++;
    onProgress({
      stage: "ocr",
      progress: 10 + (completedPages / pagesToProcess) * 85,
      message: message(completedPages),
      ...extra,
    });
  };

  return async (pageNum) => {
    try {
      const page = await pdf.getPage(pageNum);

      // Defensive re-check: the caller's page list is normally already
      // filtered to image-only pages, but a caller-supplied
      // ocrOnlyPageNumbers could name a page that actually has a fine text
      // layer - skip the expensive render+Tesseract pass for it too.
      const layerText = await tryTextLayerText(page);
      if (layerText !== null) {
        report(() => `Page ${pageNum}/${pagesToProcess} (text layer)...`);
        return {
          pageNum,
          text: layerText,
          confidence: 100,
          usedTextLayer: true,
        };
      }

      const { text, confidence } = await ocrPageRecovering(
        page,
        recognize,
        baseScales,
        strategy,
        config,
      );
      report((n) => `OCR processing page ${n}/${pagesToProcess}...`, {
        currentPage: completedPages + 1,
        totalPages: pagesToProcess,
      });
      return { pageNum, text, confidence };
    } catch (error) {
      console.warn(`[advancedOCR] page could not be read: ${error.message}`);
      report((n) => `Page ${n}/${pagesToProcess} could not be read...`);
      return { pageNum, failed: true };
    }
  };
}

/**
 * Run advanced multi-pass OCR with ensemble voting, for a specific set of
 * page numbers only (the caller has already decided which pages actually
 * lack a usable text layer) - not "the first N pages of the document".
 * Enhanced with retry logic for degraded documents. Never rejects: pages the
 * OCR engine could not produce text for come back flagged `failed`.
 */
async function runAdvancedOCR(pdf, pageNumbers, strategy, config, onProgress) {
  const pagesToProcess = pageNumbers.length;
  const { isDegraded, baseScales, poolSize } = computeOCRPoolConfig(
    strategy,
    config,
    pagesToProcess,
  );

  // eslint-disable-next-line no-console
  console.log(
    `🔬 OCR: ${poolSize} workers, ${isDegraded ? "HIGH" : "standard"} scales [${baseScales.join(", ")}], strategy: ${strategy}`,
  );

  let scheduler;
  try {
    scheduler = await createOCRScheduler(poolSize, config);
  } catch (error) {
    console.warn(`[advancedOCR] OCR engine unavailable: ${error.message}`);
    return pageNumbers.map((pageNum) => ({ pageNum, failed: true }));
  }

  const processPage = createPageProcessor({
    pdf,
    recognize: createPageRecognizer(scheduler, config),
    baseScales,
    strategy,
    config,
    pagesToProcess,
    onProgress,
  });

  try {
    // Bounded page-level concurrency: poolSize pages in flight at once
    return await runPagesWithBoundedConcurrency(
      pageNumbers,
      poolSize,
      processPage,
    );
  } finally {
    await terminateScheduler(scheduler, config);
  }
}

/**
 * Render PDF page to canvas
 */
async function renderPageToCanvas(page, scale, timeoutMs) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  try {
    const ctx = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await renderWithTimeout(page, ctx, viewport, timeoutMs, "Page render");
    return canvas;
  } catch (error) {
    releaseCanvas(canvas);
    throw error;
  }
}

// A scanned-page image at typical OCR working scale (CANVAS_SCALES up to
// 4.5x, CANVAS_SCALES_DEGRADED/the high-scale retry up to 8.0x) runs each of
// adaptiveThreshold/denoise/sharpen/dilate/erode's nested pixel loops
// synchronously - measured live (CDP Profiler + PerformanceObserver
// longtask, a real 1700x2200 scanned-image import): a single
// applyAdvancedPreprocessing call is ONE uninterrupted main-thread task
// lasting up to ~30s, freezing every other event on the page (the panic key
// included) for the full duration. Yielding every ROWS_PER_CHUNK rows keeps
// each chunk's own cost bounded regardless of image size, without changing
// what gets computed - every read still comes from the untouched `data`
// buffer and every write still lands in `output`, exactly as before; only
// when control returns to the event loop between chunks changes.
const ROWS_PER_CHUNK = 6;

// `setTimeout(resolve, 0)` clamps to >= 4ms once nested five levels deep
// (every browser's documented nested-timer throttling, and this chunking
// loop's own await chain reaches that depth immediately) - measured live at
// ~5.6ms/yield here, turning a chunking pass meant to keep the main thread
// responsive into a 2-3x wall-clock slowdown instead. A MessageChannel round
// trip returns control to the event loop the same way but isn't a timer at
// all, so the clamp doesn't apply - measured at ~0.007-0.01ms/yield in both
// browsers this app targets (Chromium, Firefox; see playwright.config.ts's
// projects).
//
// scheduler.yield() looks like the more "correct" choice (it exists
// specifically for this) and is just as cheap per-yield in Chromium, but
// verified live in Firefox that it does NOT do what MessageChannel/
// setTimeout(0) both do there: a real keydown dispatched mid-loop was
// starved for the loop's ENTIRE remaining duration (an 8s busy-loop kept a
// keydown from firing until all 8s had elapsed, vs. ~0.5s for
// MessageChannel or setTimeout(0) in the same loop, same browser) - i.e.
// exactly the failure this chunking exists to prevent, and worse than doing
// nothing since it looks like a fix. Do not reintroduce it without
// re-verifying that specific behavior in a real Firefox, not just checking
// that the API exists.
function yieldToEventLoop() {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port2.onmessage = () => resolve();
    channel.port1.postMessage(null);
  });
}

/**
 * Apply advanced preprocessing based on detected strategy
 */
export async function applyAdvancedPreprocessing(canvas, strategy) {
  const processed = document.createElement("canvas");
  const ctx = processed.getContext("2d");
  processed.width = canvas.width;
  processed.height = canvas.height;

  ctx.drawImage(canvas, 0, 0);
  let imageData = ctx.getImageData(0, 0, processed.width, processed.height);

  switch (strategy) {
    case PREPROCESS_STRATEGIES.CLEAN:
      imageData = await enhanceContrast(imageData, 1.1);
      imageData = await sharpen(imageData, 0.3);
      break;

    case PREPROCESS_STRATEGIES.STANDARD:
      imageData = await grayscale(imageData);
      imageData = await enhanceContrast(imageData, 1.4);
      imageData = await adaptiveThreshold(imageData);
      imageData = await denoise(imageData, 1);
      imageData = await sharpen(imageData, 0.8);
      break;

    case PREPROCESS_STRATEGIES.POOR:
      imageData = await grayscale(imageData);
      imageData = await enhanceContrast(imageData, 2.0);
      imageData = await adaptiveThreshold(imageData, 15);
      imageData = await denoise(imageData, 2);
      imageData = await morphologicalClosing(imageData);
      imageData = await sharpen(imageData, 1.2);
      break;

    case PREPROCESS_STRATEGIES.AGED:
      imageData = await grayscale(imageData);
      imageData = await removeYellowing(imageData);
      imageData = await enhanceContrast(imageData, 1.8);
      imageData = await adaptiveThreshold(imageData);
      imageData = await denoise(imageData, 1.5);
      imageData = await sharpen(imageData, 1.0);
      break;

    case PREPROCESS_STRATEGIES.HANDWRITTEN:
      imageData = await grayscale(imageData);
      imageData = await enhanceContrast(imageData, 1.6);
      imageData = await adaptiveThreshold(imageData, 20);
      imageData = await denoise(imageData, 1);
      break;

    case PREPROCESS_STRATEGIES.SEVERELY_AGED:
      // MAXIMUM enhancement for severely degraded/faded documents
      // eslint-disable-next-line no-console
      console.log(
        "🔧 Applying SEVERELY_AGED preprocessing (maximum enhancement)",
      );
      imageData = await grayscale(imageData);
      imageData = await removeYellowing(imageData); // Remove age discoloration
      imageData = await autoLevels(imageData); // Automatic contrast stretching
      imageData = await enhanceContrast(imageData, 2.5); // Very aggressive contrast
      imageData = await unsharpMask(imageData, 2.0); // Strong edge enhancement
      imageData = await adaptiveThreshold(imageData, 21); // Larger block for faded text
      imageData = await morphologicalClosing(imageData, 1); // Fill small gaps
      imageData = await denoise(imageData, 2); // Strong denoising
      imageData = await sharpen(imageData, 1.5); // Final sharpening
      break;

    case PREPROCESS_STRATEGIES.INVERTED:
      // Handle white text on dark background
      // eslint-disable-next-line no-console
      console.log("🔧 Applying INVERTED preprocessing");
      imageData = await grayscale(imageData);
      imageData = await invert(imageData); // Flip black/white
      imageData = await enhanceContrast(imageData, 1.6);
      imageData = await adaptiveThreshold(imageData);
      imageData = await denoise(imageData, 1);
      imageData = await sharpen(imageData, 0.8);
      break;
  }

  ctx.putImageData(imageData, 0, 0);
  return processed;
}

/**
 * Ensemble voting - combine multiple OCR passes
 */
function ensembleVote(results) {
  // For now, use the highest confidence result
  // eslint-disable-next-line sonarjs/todo-tag -- tracked follow-up, not a lint-pass-sized change
  // TODO: Implement character-level voting
  results.sort((a, b) => b.confidence - a.confidence);
  return results[0].text;
}

/**
 * VA terminology correction lookup table - EXPANDED for DD214 documents
 */
const VA_TERMINOLOGY_CORRECTIONS = {
  // Common OCR errors for DD-214 form number
  "OO-214": "DD-214",
  "DD-Z14": "DD-214",
  "OD-214": "DD-214",
  "D0-214": "DD-214",
  "00-214": "DD-214",
  "DO-214": "DD-214",
  "DD 214": "DD-214",
  DD2I4: "DD-214",
  DD21A: "DD-214",

  // Character of service
  HONORABIE: "HONORABLE",
  HONORAB1E: "HONORABLE",
  HONORARLE: "HONORABLE",
  GENERAI: "GENERAL",
  GENERA1: "GENERAL",
  "GEN ERAL": "GENERAL",

  // Common DD214 fields
  SERV1CE: "SERVICE",
  "SERVI CE": "SERVICE",
  "SERV ICE": "SERVICE",
  "DATE OF SEPARAT1ON": "DATE OF SEPARATION",
  "SEPARATI ON": "SEPARATION",
  SEPARAT1ON: "SEPARATION",
  MIUTARY: "MILITARY",
  "MILIT ARY": "MILITARY",
  MIL1TARY: "MILITARY",
  M1LITARY: "MILITARY",
  "DEPARTM ENT": "DEPARTMENT",
  "DEPART MENT": "DEPARTMENT",
  DEPARTMEHT: "DEPARTMENT",

  // VA terms
  "VET ERAN": "VETERAN",
  "VETER AN": "VETERAN",
  VETERAH: "VETERAN",
  "RATIN G": "RATING",
  RAT1NG: "RATING",
  DISAB1LITY: "DISABILITY",
  DISABIL1TY: "DISABILITY",
  "DISABILI TY": "DISABILITY",
  COMPENSAT1ON: "COMPENSATION",
  "COMPENSA TION": "COMPENSATION",

  // Military branches
  ARHY: "ARMY",
  ARNY: "ARMY",
  "ARM Y": "ARMY",
  NAVY: "NAVY", // Already correct but include for completeness
  "AIR FORCE": "AIR FORCE",
  AIRFORCE: "AIR FORCE",
  "A1R FORCE": "AIR FORCE",
  MAR1NE: "MARINE",
  "MARI NE": "MARINE",
  "COAST GUARD": "COAST GUARD",
  COASTGUARD: "COAST GUARD",

  // Ranks (enlisted)
  SPEC1ALIST: "SPECIALIST",
  "SPECIA LIST": "SPECIALIST",
  "SERGEA NT": "SERGEANT",
  "SERGE ANT": "SERGEANT",
  "SERGEAN T": "SERGEANT",
  "SERGEA HT": "SERGEANT",
  "CORPOR AL": "CORPORAL",
  "CORPO RAL": "CORPORAL",
  PR1VATE: "PRIVATE",
  "PRIV ATE": "PRIVATE",

  // Common DD214 box labels
  CERT1FICATE: "CERTIFICATE",
  "CERTIFICA TE": "CERTIFICATE",
  D1SCHARGE: "DISCHARGE",
  "DISCH ARGE": "DISCHARGE",
  "DISCHAR GE": "DISCHARGE",
  ACT1VE: "ACTIVE",
  "ACTIV E": "ACTIVE",
  "DU TY": "DUTY",
  RELEASE: "RELEASE",
  "RELE ASE": "RELEASE",
  "DECORA TIONS": "DECORATIONS",
  "DECORATI ONS": "DECORATIONS",
  "MED ALS": "MEDALS",
  "MEDA LS": "MEDALS",
  "BADG ES": "BADGES",
  "BAD GES": "BADGES",

  // Date-related
  "SEPTEMB ER": "SEPTEMBER",
  "NOVEMB ER": "NOVEMBER",
  "DECEMB ER": "DECEMBER",
  "FEBRUAR Y": "FEBRUARY",
  "JANU ARY": "JANUARY",

  // Numbers commonly misread
  l9: "19", // lowercase L to 1
};

/**
 * Resolve a single OCR-confused digit character (used when fixing numeric
 * tokens like years or 8-digit dates: 19B5 -> 1985, 200I -> 2001,
 * 20O40808 -> 20040808).
 */
function resolveDigitConfusion(char) {
  const DIGIT_CONFUSIONS = { B: "8", O: "0", I: "1" };
  return DIGIT_CONFUSIONS[char] ?? char;
}

/**
 * Recognize token shapes that are Army/AFSC-style codes or officer/warrant
 * pay grades rather than genuine numbers, so the correction below leaves
 * them alone: Army/AF MOS codes render as 2 digits + letter + a 2-digit
 * skill-level suffix, or no suffix at all ("11B10", "13B20", "12B" - never
 * a 1-digit suffix, which is how a real corrupted year like "19B5" is told
 * apart from a real MOS code below), and officer/warrant pay grades are a
 * single confusable letter followed by 1-2 digits ("O3", "O12"). Both
 * shapes are only reachable here because B/I/O are also digit-confusable
 * letters - any other MOS/rank letter (92Y, E5, W2) never enters the
 * [\dOIB]-only token match in the first place.
 */
function isMilitaryCodeShape(token) {
  return /^\d{2}[OIB](?:\d{2})?$/.test(token) || /^[OIB]\d{1,2}$/.test(token);
}

/**
 * Correct OCR letter/digit confusion (O/I/B misread for 0/1/8) inside
 * tokens that are otherwise all-digit, e.g. a date "20O40808" ->
 * "20040808" or a year "19B5" -> "1985". A whole-text global "O" -> "0"
 * substitution used to live here instead and corrupted every real letter
 * O in the document ("FROM"/"TO" became "FR0M"/"T0") - this only touches a
 * character surrounded by (or forming a maximal run with) real digits, so
 * a normal word like "FROM" or "TO" never matches at all.
 *
 * A later regression: matching "otherwise all-digit" by character class
 * alone also corrupted real Army MOS codes ("11B10" -> "11810", "12B" ->
 * "128") and officer pay grades ("O3" -> "03"), because a 2-digit MOS
 * suffix looks exactly as "surrounded by digits" as a real numeric token
 * does. isMilitaryCodeShape excludes those shapes before any correction is
 * considered - "B" in particular should almost never become "8".
 */
function correctDigitConfusionInNumberTokens(text) {
  return text.replace(/\b[\dOIB]+\b/g, (token) => {
    if (!/\d/.test(token) || isMilitaryCodeShape(token)) return token;
    return token.replace(/[OIB]/g, resolveDigitConfusion);
  });
}

/**
 * VA terminology correction - EXPANDED for DD214 documents
 */
export function applyVATerminologyCorrection(text) {
  let corrected = text;
  for (const [wrong, right] of Object.entries(VA_TERMINOLOGY_CORRECTIONS)) {
    corrected = corrected.replace(
      new RegExp(wrong.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`), "gi"),
      right,
    );
  }

  // Fix common number/letter confusions inside otherwise-numeric tokens
  // (years like 19B5 -> 1985, 8-digit dates like 20O40808 -> 20040808).
  corrected = correctDigitConfusionInNumberTokens(corrected);

  return corrected;
}

// ============================================================================
// IMAGE PROCESSING FUNCTIONS
// ============================================================================

// Row-based yield cadence for functions that loop flatly over `data`
// (no neighbourhood access, so any row boundary is a valid chunk boundary).
// Mirrors unsharpMask's own pixelsPerChunk pattern below.
function rowPixelsPerChunk(width) {
  return ROWS_PER_CHUNK * width * 4;
}

export async function grayscale(imageData) {
  const data = imageData.data;
  const pixelsPerChunk = rowPixelsPerChunk(imageData.width);
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    data[i] = data[i + 1] = data[i + 2] = avg;
    if (i % pixelsPerChunk === 0) await yieldToEventLoop();
  }
  return imageData;
}

export async function enhanceContrast(imageData, factor) {
  const data = imageData.data;
  const f = (259 * (factor * 255 + 255)) / (255 * (259 - factor * 255));
  const pixelsPerChunk = rowPixelsPerChunk(imageData.width);

  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(f * (data[i] - 128) + 128);
    data[i + 1] = clamp(f * (data[i + 1] - 128) + 128);
    data[i + 2] = clamp(f * (data[i + 2] - 128) + 128);
    if (i % pixelsPerChunk === 0) await yieldToEventLoop();
  }
  return imageData;
}

// Mean pixel value (channel 0) within `radius` of (x, y), clamped to the
// image bounds.
function _localMean(data, x, y, width, height, radius) {
  let sum = 0;
  let count = 0;

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const ny = y + dy;
      const nx = x + dx;
      if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
        const nIdx = (ny * width + nx) * 4;
        sum += data[nIdx];
        count++;
      }
    }
  }

  return sum / count;
}

export async function adaptiveThreshold(imageData, blockSize = 11) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const output = new Uint8ClampedArray(data);
  const radius = Math.floor(blockSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      const mean = _localMean(data, x, y, width, height, radius);
      const threshold = mean * 0.95; // Slightly below mean
      const value = data[idx] > threshold ? 255 : 0;

      output[idx] = output[idx + 1] = output[idx + 2] = value;
    }
    if (y % ROWS_PER_CHUNK === 0) await yieldToEventLoop();
  }

  imageData.data.set(output);
  return imageData;
}

export async function denoise(imageData, strength = 1) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const output = new Uint8ClampedArray(data);
  const radius = Math.ceil(strength);

  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      const idx = (y * width + x) * 4;
      const values = [];

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nIdx = ((y + dy) * width + (x + dx)) * 4;
          values.push(data[nIdx]);
        }
      }

      values.sort((a, b) => a - b);
      const median = values[Math.floor(values.length / 2)];

      output[idx] = output[idx + 1] = output[idx + 2] = median;
    }
    if (y % ROWS_PER_CHUNK === 0) await yieldToEventLoop();
  }

  imageData.data.set(output);
  return imageData;
}

export async function sharpen(imageData, amount = 1.0) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const output = new Uint8ClampedArray(data);

  const kernel = [
    0,
    -amount,
    0,
    -amount,
    1 + 4 * amount,
    -amount,
    0,
    -amount,
    0,
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const kernelIdx = (ky + 1) * 3 + (kx + 1);
          sum += data[idx] * kernel[kernelIdx];
        }
      }

      const idx = (y * width + x) * 4;
      const value = clamp(sum);
      output[idx] = output[idx + 1] = output[idx + 2] = value;
    }
    if (y % ROWS_PER_CHUNK === 0) await yieldToEventLoop();
  }

  imageData.data.set(output);
  return imageData;
}

export async function morphologicalClosing(imageData, size = 2) {
  imageData = await dilate(imageData, size);
  imageData = await erode(imageData, size);
  return imageData;
}

export async function dilate(imageData, size) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const output = new Uint8ClampedArray(data);

  for (let y = size; y < height - size; y++) {
    for (let x = size; x < width - size; x++) {
      let maxVal = 0;

      for (let dy = -size; dy <= size; dy++) {
        for (let dx = -size; dx <= size; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          maxVal = Math.max(maxVal, data[idx]);
        }
      }

      const idx = (y * width + x) * 4;
      output[idx] = output[idx + 1] = output[idx + 2] = maxVal;
    }
    if (y % ROWS_PER_CHUNK === 0) await yieldToEventLoop();
  }

  imageData.data.set(output);
  return imageData;
}

export async function erode(imageData, size) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const output = new Uint8ClampedArray(data);

  for (let y = size; y < height - size; y++) {
    for (let x = size; x < width - size; x++) {
      let minVal = 255;

      for (let dy = -size; dy <= size; dy++) {
        for (let dx = -size; dx <= size; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          minVal = Math.min(minVal, data[idx]);
        }
      }

      const idx = (y * width + x) * 4;
      output[idx] = output[idx + 1] = output[idx + 2] = minVal;
    }
    if (y % ROWS_PER_CHUNK === 0) await yieldToEventLoop();
  }

  imageData.data.set(output);
  return imageData;
}

export async function removeYellowing(imageData) {
  const data = imageData.data;
  const pixelsPerChunk = rowPixelsPerChunk(imageData.width);

  for (let i = 0; i < data.length; i += 4) {
    // Remove yellow tint (boost blue channel)
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // If yellowish (high R and G, low B), normalize
    if (r > 150 && g > 150 && b < 150) {
      const max = Math.max(r, g, b);
      data[i] = data[i + 1] = data[i + 2] = max;
    }
    if (i % pixelsPerChunk === 0) await yieldToEventLoop();
  }

  return imageData;
}

/**
 * Invert image colors (for white text on dark background)
 */
export async function invert(imageData) {
  const data = imageData.data;
  const pixelsPerChunk = rowPixelsPerChunk(imageData.width);

  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i]; // R
    data[i + 1] = 255 - data[i + 1]; // G
    data[i + 2] = 255 - data[i + 2]; // B
    // Alpha (data[i + 3]) remains unchanged
    if (i % pixelsPerChunk === 0) await yieldToEventLoop();
  }

  return imageData;
}

/**
 * Auto-levels: stretch histogram to use full 0-255 range
 * Critical for faded documents where text has low contrast
 */
export async function autoLevels(imageData) {
  const data = imageData.data;
  const pixelsPerChunk = rowPixelsPerChunk(imageData.width);

  // First pass: find min and max values
  let min = 255;
  let max = 0;

  for (let i = 0; i < data.length; i += 4) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (brightness < min) min = brightness;
    if (brightness > max) max = brightness;
    if (i % pixelsPerChunk === 0) await yieldToEventLoop();
  }

  // Avoid division by zero
  if (max === min) return imageData;

  // Calculate stretch factor
  const range = max - min;
  const scale = 255 / range;

  // eslint-disable-next-line no-console
  console.log(
    `📊 Auto-levels: min=${min.toFixed(0)}, max=${max.toFixed(0)}, scale=${scale.toFixed(2)}`,
  );

  // Second pass: apply stretching
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp((data[i] - min) * scale);
    data[i + 1] = clamp((data[i + 1] - min) * scale);
    data[i + 2] = clamp((data[i + 2] - min) * scale);
    if (i % pixelsPerChunk === 0) await yieldToEventLoop();
  }

  return imageData;
}

/**
 * Unsharp mask: enhance edges for better OCR on blurry/faded text
 * amount: strength of sharpening (1.0 = normal, 2.0 = strong)
 */
export async function unsharpMask(imageData, amount = 1.0) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const output = new Uint8ClampedArray(data);

  // Create blurred version using box blur (3x3)
  const blurred = new Uint8ClampedArray(data);

  // Apply 3x3 box blur
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      let sum = 0;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nIdx = ((y + dy) * width + (x + dx)) * 4;
          sum += data[nIdx];
        }
      }

      blurred[idx] = sum / 9;
      blurred[idx + 1] = sum / 9;
      blurred[idx + 2] = sum / 9;
    }
    if (y % ROWS_PER_CHUNK === 0) await yieldToEventLoop();
  }

  // Unsharp mask: output = original + amount * (original - blurred)
  const pixelsPerChunk = ROWS_PER_CHUNK * width * 4;
  for (let i = 0; i < data.length; i += 4) {
    const diff = data[i] - blurred[i];
    output[i] = clamp(data[i] + amount * diff);
    output[i + 1] = clamp(data[i + 1] + amount * diff);
    output[i + 2] = clamp(data[i + 2] + amount * diff);
    if (i % pixelsPerChunk === 0) await yieldToEventLoop();
  }

  imageData.data.set(output);
  return imageData;
}

function clamp(value, min = 0, max = 255) {
  return Math.max(min, Math.min(max, value));
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

// Export for use
export default advancedPDFAnalysis;
