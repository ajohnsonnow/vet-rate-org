/**
 * Vet-Rate.org - Advanced OCR System
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
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

const STANDARD_FONT_DATA_URL =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/standard_fonts/";

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
};

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

  try {
    // Load PDF
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

    // Fast path: Try standard text extraction
    const standardText = await extractStandardText(pdf, numPages, onProgress);
    const avgCharsPerPage = standardText.text.length / numPages;

    // If sufficient text found, return it
    if (avgCharsPerPage >= config.MIN_CHARS_PER_PAGE) {
      onProgress({
        stage: "complete",
        progress: 100,
        message: "Text extraction complete",
      });
      return {
        text: standardText.text,
        pageCount: numPages,
        method: "standard",
        confidence: 100,
        processingTime: Date.now() - standardText.startTime,
      };
    }

    // Insufficient text - use advanced OCR
    // eslint-disable-next-line no-console
    console.log(
      `📷 Sparse text detected (${avgCharsPerPage.toFixed(0)} chars/page). Activating advanced OCR...`,
    );
    onProgress({
      stage: "ocr",
      progress: 10,
      message: "Preparing advanced OCR...",
    });

    // Analyze first page to determine optimal strategy
    const strategy = await detectOptimalStrategy(pdf, 1);
    // eslint-disable-next-line no-console
    console.log(`🎯 Detected quality: ${strategy}`);

    // Run advanced multi-pass OCR
    const ocrResult = await runAdvancedOCR(
      pdf,
      numPages,
      strategy,
      config,
      onProgress,
    );

    onProgress({ stage: "complete", progress: 100, message: "OCR complete" });
    return ocrResult;
  } catch (error) {
    console.error("❌ Advanced OCR failed:", error);
    throw error;
  }
}

/**
 * Extract standard PDF text (fast path)
 */
async function extractStandardText(pdf, numPages, onProgress) {
  const startTime = Date.now();
  let fullText = "";

  for (
    let i = 1;
    i <= Math.min(numPages, ADVANCED_OCR_CONFIG.MAX_OCR_PAGES);
    i++
  ) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(" ");
    fullText += `--- PAGE ${i} ---\n${pageText}\n\n`;

    onProgress({
      stage: "extracting",
      progress: 5 + (i / numPages) * 5,
      message: `Extracting text from page ${i}/${numPages}...`,
    });
  }

  return { text: fullText, startTime };
}

/**
 * Detect optimal OCR strategy based on document quality
 */
async function detectOptimalStrategy(pdf, pageNum = 1) {
  try {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: ctx, viewport }).promise;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const metrics = analyzeImageQuality(imageData);

    canvas.remove();

    // eslint-disable-next-line no-console
    console.log(
      `📊 Image quality metrics: brightness=${metrics.brightness.toFixed(0)}, contrast=${metrics.contrast.toFixed(0)}, noise=${metrics.noise.toFixed(0)}, inverted=${metrics.isInverted}`,
    );

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
  let brightnessValues = [];
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
 * Run advanced multi-pass OCR with ensemble voting
 * Enhanced with retry logic for degraded documents
 */
async function runAdvancedOCR(pdf, numPages, strategy, config, onProgress) {
  const startTime = Date.now();
  const pagesToProcess = Math.min(numPages, config.MAX_OCR_PAGES);
  const results = [];

  // Use higher scales for degraded documents
  const isDegraded =
    strategy === PREPROCESS_STRATEGIES.SEVERELY_AGED ||
    strategy === PREPROCESS_STRATEGIES.POOR ||
    strategy === PREPROCESS_STRATEGIES.AGED;

  const baseScales = isDegraded
    ? config.CANVAS_SCALES_DEGRADED
    : config.CANVAS_SCALES;

  // Worker pool: a single Tesseract worker processed pages strictly
  // sequentially while the rest of the CPU sat idle — the dominant cost on
  // multi-page scans. Pool size adapts to device tier (deviceCapabilityDetector):
  // desktop-high→8, desktop-mid→6, laptop→4, tablet→2, mobile→1.
  // Falls back to hardwareConcurrency - 2 when the device profile is not yet cached.
  const deviceOCRWorkers =
    (typeof getCachedDeviceProfile !== "undefined" &&
      getCachedDeviceProfile?.()?.ocrWorkers) ||
    Math.max(2, (navigator.hardwareConcurrency || 4) - 2);
  const poolSize = Math.min(deviceOCRWorkers, 8, pagesToProcess);

  // eslint-disable-next-line no-console
  console.log(
    `🔬 OCR: ${poolSize} workers, ${isDegraded ? "HIGH" : "standard"} scales [${baseScales.join(", ")}], strategy: ${strategy}`,
  );

  const scheduler = Tesseract.createScheduler();
  await Promise.all(
    Array.from({ length: poolSize }, async () => {
      const worker = await Tesseract.createWorker(config.LANGUAGES);
      await worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
        preserve_interword_spaces: "1",
      });
      scheduler.addWorker(worker);
    }),
  );

  const recognize = async (page, scale, preprocessStrategy) => {
    const canvas = await renderPageToCanvas(page, scale);
    const processedCanvas = applyAdvancedPreprocessing(
      canvas,
      preprocessStrategy,
    );
    const imageData = processedCanvas.toDataURL("image/png");
    canvas.remove();
    processedCanvas.remove();
    const result = await scheduler.addJob("recognize", imageData);
    return {
      text: result.data.text,
      confidence: result.data.confidence,
      scale,
    };
  };

  let completedPages = 0;

  const processPage = async (pageNum) => {
    const page = await pdf.getPage(pageNum);

    // Text-layer fast path: digitally-generated pages (VA forms, typed medical
    // records, decision letters) already have a UTF-8 text layer embedded in
    // the PDF — reusing it is both faster and more accurate than rendering to
    // a canvas and running Tesseract. We consider the layer "sufficient" when
    // it has > 20 text items AND > 100 characters (blank/stamp pages have few
    // items; cover sheets may have 1-5 lines). Scanned pages return items=0.
    try {
      const textContent = await page.getTextContent();
      const layerText = textContent.items
        .map((item) => item.str)
        .join(" ")
        .trim();
      if (textContent.items.length > 20 && layerText.length > 100) {
        completedPages++;
        onProgress({
          stage: "ocr",
          progress: 10 + (completedPages / pagesToProcess) * 85,
          message: `Page ${pageNum}/${pagesToProcess} (text layer)...`,
        });
        return { text: layerText, confidence: 100, usedTextLayer: true };
      }
    } catch {
      // getTextContent can fail on corrupt pages — fall through to OCR
    }

    // Image-only page: one pass at the highest base scale. The full multi-scale
    // ensemble only runs when that pass reads poorly — most pages of a
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
      pageResults.reduce((sum, r) => sum + r.confidence, 0) /
      pageResults.length;

    // RETRY LOGIC: If OCR extracted very little text, try maximum scale
    // with the most aggressive preprocessing
    const textLength = pageText.trim().length;
    if (
      textLength < config.MIN_USEFUL_TEXT_LENGTH &&
      config.ENABLE_RETRY_WITH_HIGHER_SCALE
    ) {
      const retry = await recognize(
        page,
        8.0,
        PREPROCESS_STRATEGIES.SEVERELY_AGED,
      );
      if (retry.text.trim().length > textLength) {
        pageText = retry.text;
      }
    }

    completedPages++;
    onProgress({
      stage: "ocr",
      progress: 10 + (completedPages / pagesToProcess) * 85,
      message: `OCR processing page ${completedPages}/${pagesToProcess}...`,
      currentPage: completedPages,
      totalPages: pagesToProcess,
    });

    return { pageNum, text: pageText, confidence: avgConfidence };
  };

  try {
    // Bounded page-level concurrency: poolSize pages in flight at once
    const pageNumbers = Array.from({ length: pagesToProcess }, (_, i) => i + 1);
    const inFlight = pageNumbers.splice(0, poolSize).map((n) => processPage(n));
    const settled = [];
    while (inFlight.length > 0) {
      const done = await Promise.race(
        inFlight.map((p, idx) => p.then((r) => ({ r, idx }))),
      );
      settled.push(done.r);
      inFlight.splice(done.idx, 1);
      if (pageNumbers.length > 0) {
        inFlight.push(processPage(pageNumbers.shift()));
      }
    }
    settled.sort((a, b) => a.pageNum - b.pageNum);
    results.push(...settled);

    // Combine all pages
    const fullText = results
      .map(
        (r) =>
          `--- PAGE ${r.pageNum} (OCR ${r.confidence.toFixed(0)}%) ---\n${r.text.trim()}\n\n`,
      )
      .join("");

    // Post-process: VA terminology correction
    const correctedText = applyVATerminologyCorrection(fullText);

    const avgConfidence =
      results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

    // Log summary
    const totalChars = correctedText
      .replace(/---\s*PAGE.*?---\n/g, "")
      .replace(/\s+/g, " ")
      .trim().length;
    // eslint-disable-next-line no-console
    console.log(
      `📊 OCR Summary: ${totalChars} chars extracted from ${pagesToProcess} pages (avg confidence: ${avgConfidence.toFixed(0)}%)`,
    );

    return {
      text: correctedText,
      pageCount: numPages,
      method: "advanced_ocr",
      strategy: strategy,
      confidence: avgConfidence,
      processingTime: Date.now() - startTime,
      pagesProcessed: pagesToProcess,
      totalCharsExtracted: totalChars,
    };
  } finally {
    await scheduler.terminate();
  }
}

/**
 * Render PDF page to canvas
 */
async function renderPageToCanvas(page, scale) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

/**
 * Apply advanced preprocessing based on detected strategy
 */
function applyAdvancedPreprocessing(canvas, strategy) {
  const processed = document.createElement("canvas");
  const ctx = processed.getContext("2d");
  processed.width = canvas.width;
  processed.height = canvas.height;

  ctx.drawImage(canvas, 0, 0);
  let imageData = ctx.getImageData(0, 0, processed.width, processed.height);

  switch (strategy) {
    case PREPROCESS_STRATEGIES.CLEAN:
      imageData = enhanceContrast(imageData, 1.1);
      imageData = sharpen(imageData, 0.3);
      break;

    case PREPROCESS_STRATEGIES.STANDARD:
      imageData = grayscale(imageData);
      imageData = enhanceContrast(imageData, 1.4);
      imageData = adaptiveThreshold(imageData);
      imageData = denoise(imageData, 1);
      imageData = sharpen(imageData, 0.8);
      break;

    case PREPROCESS_STRATEGIES.POOR:
      imageData = grayscale(imageData);
      imageData = enhanceContrast(imageData, 2.0);
      imageData = adaptiveThreshold(imageData, 15);
      imageData = denoise(imageData, 2);
      imageData = morphologicalClosing(imageData);
      imageData = sharpen(imageData, 1.2);
      break;

    case PREPROCESS_STRATEGIES.AGED:
      imageData = grayscale(imageData);
      imageData = removeYellowing(imageData);
      imageData = enhanceContrast(imageData, 1.8);
      imageData = adaptiveThreshold(imageData);
      imageData = denoise(imageData, 1.5);
      imageData = sharpen(imageData, 1.0);
      break;

    case PREPROCESS_STRATEGIES.HANDWRITTEN:
      imageData = grayscale(imageData);
      imageData = enhanceContrast(imageData, 1.6);
      imageData = adaptiveThreshold(imageData, 20);
      imageData = denoise(imageData, 1);
      break;

    case PREPROCESS_STRATEGIES.SEVERELY_AGED:
      // MAXIMUM enhancement for severely degraded/faded documents
      // eslint-disable-next-line no-console
      console.log(
        "🔧 Applying SEVERELY_AGED preprocessing (maximum enhancement)",
      );
      imageData = grayscale(imageData);
      imageData = removeYellowing(imageData); // Remove age discoloration
      imageData = autoLevels(imageData); // Automatic contrast stretching
      imageData = enhanceContrast(imageData, 2.5); // Very aggressive contrast
      imageData = unsharpMask(imageData, 2.0); // Strong edge enhancement
      imageData = adaptiveThreshold(imageData, 21); // Larger block for faded text
      imageData = morphologicalClosing(imageData, 1); // Fill small gaps
      imageData = denoise(imageData, 2); // Strong denoising
      imageData = sharpen(imageData, 1.5); // Final sharpening
      break;

    case PREPROCESS_STRATEGIES.INVERTED:
      // Handle white text on dark background
      // eslint-disable-next-line no-console
      console.log("🔧 Applying INVERTED preprocessing");
      imageData = grayscale(imageData);
      imageData = invert(imageData); // Flip black/white
      imageData = enhanceContrast(imageData, 1.6);
      imageData = adaptiveThreshold(imageData);
      imageData = denoise(imageData, 1);
      imageData = sharpen(imageData, 0.8);
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
  // TODO: Implement character-level voting
  results.sort((a, b) => b.confidence - a.confidence);
  return results[0].text;
}

/**
 * VA terminology correction - EXPANDED for DD214 documents
 */
function applyVATerminologyCorrection(text) {
  const corrections = {
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
    O: "0", // Will be applied only in specific number contexts
    "|": "1", // Pipe to 1
  };

  let corrected = text;
  for (const [wrong, right] of Object.entries(corrections)) {
    corrected = corrected.replace(
      new RegExp(wrong.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
      right,
    );
  }

  // Fix common number/letter confusions in dates (YYYYMMDD format)
  // Match patterns like 19B5 -> 1985, 200I -> 2001
  corrected = corrected.replace(
    /\b(19|20)([0-9BOI])([0-9BOI])\b/g,
    (match, century, d1, d2) => {
      const fixChar = (c) =>
        c === "B" ? "8" : c === "O" ? "0" : c === "I" ? "1" : c;
      return century + fixChar(d1) + fixChar(d2);
    },
  );

  return corrected;
}

// ============================================================================
// IMAGE PROCESSING FUNCTIONS
// ============================================================================

function grayscale(imageData) {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    data[i] = data[i + 1] = data[i + 2] = avg;
  }
  return imageData;
}

function enhanceContrast(imageData, factor) {
  const data = imageData.data;
  const f = (259 * (factor * 255 + 255)) / (255 * (259 - factor * 255));

  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(f * (data[i] - 128) + 128);
    data[i + 1] = clamp(f * (data[i + 1] - 128) + 128);
    data[i + 2] = clamp(f * (data[i + 2] - 128) + 128);
  }
  return imageData;
}

function adaptiveThreshold(imageData, blockSize = 11) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const output = new Uint8ClampedArray(data);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Calculate local mean
      let sum = 0;
      let count = 0;
      const radius = Math.floor(blockSize / 2);

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

      const mean = sum / count;
      const threshold = mean * 0.95; // Slightly below mean
      const value = data[idx] > threshold ? 255 : 0;

      output[idx] = output[idx + 1] = output[idx + 2] = value;
    }
  }

  imageData.data.set(output);
  return imageData;
}

function denoise(imageData, strength = 1) {
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
  }

  imageData.data.set(output);
  return imageData;
}

function sharpen(imageData, amount = 1.0) {
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
  }

  imageData.data.set(output);
  return imageData;
}

function morphologicalClosing(imageData, size = 2) {
  imageData = dilate(imageData, size);
  imageData = erode(imageData, size);
  return imageData;
}

function dilate(imageData, size) {
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
  }

  imageData.data.set(output);
  return imageData;
}

function erode(imageData, size) {
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
  }

  imageData.data.set(output);
  return imageData;
}

function removeYellowing(imageData) {
  const data = imageData.data;

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
  }

  return imageData;
}

/**
 * Invert image colors (for white text on dark background)
 */
function invert(imageData) {
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i]; // R
    data[i + 1] = 255 - data[i + 1]; // G
    data[i + 2] = 255 - data[i + 2]; // B
    // Alpha (data[i + 3]) remains unchanged
  }

  return imageData;
}

/**
 * Auto-levels: stretch histogram to use full 0-255 range
 * Critical for faded documents where text has low contrast
 */
function autoLevels(imageData) {
  const data = imageData.data;

  // First pass: find min and max values
  let min = 255;
  let max = 0;

  for (let i = 0; i < data.length; i += 4) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (brightness < min) min = brightness;
    if (brightness > max) max = brightness;
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
  }

  return imageData;
}

/**
 * Unsharp mask: enhance edges for better OCR on blurry/faded text
 * amount: strength of sharpening (1.0 = normal, 2.0 = strong)
 */
function unsharpMask(imageData, amount = 1.0) {
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
  }

  // Unsharp mask: output = original + amount * (original - blurred)
  for (let i = 0; i < data.length; i += 4) {
    const diff = data[i] - blurred[i];
    output[i] = clamp(data[i] + amount * diff);
    output[i + 1] = clamp(data[i + 1] + amount * diff);
    output[i + 2] = clamp(data[i + 2] + amount * diff);
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
