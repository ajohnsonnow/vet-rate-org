/**
 * Vet-Rate.org - Mass Document Processor (Muster Call System)
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Handles large-scale document ingestion for veteran claim files:
 * - Multiple DD214s
 * - VA Rating Decisions
 * - Claim Letters (32+ files, 10+ MB)
 * - C-Files (320+ MB medical records)
 * - Poor-quality scanned documents
 *
 * Processing Pipeline:
 * 1. File validation & size checking
 * 2. Parallel document loading (Web Workers)
 * 3. Text extraction (PDF/DOCX/OCR)
 * 4. Document classification
 * 5. Data extraction & parsing
 * 6. Profile auto-population
 * 7. LLM analysis & recommendations
 * 8. Comprehensive report generation
 *
 * All processing is 100% client-side for maximum privacy.
 */

import { analyzeDocument, isFileSupported } from "./documentAnalyzer";
import { processLargePDF } from "./pdfExtractor";
import { formatFileSize } from "./ocr";
import { scanDocumentForCrisis } from "./crisisInterceptor";
import { untrustedSection } from "./aiSystemPrompts";
import {
  classifyDocument,
  classifyDocumentBatch,
  getDocumentTypeLabel,
  DOCUMENT_TYPES,
} from "./documentClassifier";
import {
  parseDD214Text,
  DEVICES,
  STATE_AWARD_CODES,
  STATE_NAME_TO_CODE,
} from "./ribbonRackData";
import {
  updateVeteranProfile,
  getVeteranProfile,
  getServiceHistory,
  saveDD214Data,
  addAward,
  upsertServicePeriod,
} from "./veteranProfile";
import { generateAI, isAnyAIAvailable } from "./unifiedAIService";
import {
  addDocumentToVKB,
  loadVKB,
  saveVKB,
  mergeDD214IntoVKB,
} from "./veteranKnowledgeBase";
import { saveDocumentToPacket, PACKET_DOC_TYPES } from "./myPacketManager";
// ============================================================
// C-FILE ANALYZER INTEGRATION (v1.18.3)
// Import JSON repair utility for handling truncated AI responses
// ============================================================
import {
  attemptJSONRepair,
  enforceValidDiagnosticCodes,
} from "./cfileAnalyzer";
// ============================================================
// FLORENCE-2 VISION AI SERVICE (v1.16.2)
// Fallback for poor OCR quality on scanned/aged documents
// ============================================================
import { florenceOCRService, isWebGPUSupported } from "./florenceOCRService";
// ============================================================
// NEW DOCUMENT INTELLIGENCE PARSERS (v1.16.0)
// Enhanced VA document understanding with "Header-First Extraction"
// ============================================================
import {
  parseDecisionLetter,
  parseDBQReport,
  parseCodeSheet,
  extractBigThree,
} from "./vaDocumentParser";
import {
  segmentCFile,
  quickScanCFile,
  buildInventoryFromSegmentation,
} from "./cFileSegmentation";
import { findEvidenceGaps, quickGapCheck } from "./evidenceGapFinder";

// Vision AI confidence threshold - below this, try vision fallback
const VISION_FALLBACK_THRESHOLD = 60; // If OCR confidence < 60%, try Florence-2
let visionInitialized = false;
let visionInitializing = false;

/**
 * Adaptive ETA: rolling average of pages/sec over the most recent extraction
 * batches. Static formulas drift badly on a 313MB C-File where per-page cost
 * varies between text-layer and scanned sections.
 */
const createEtaTracker = (windowSize = 5) => {
  const samples = [];
  let lastPages = 0;
  let lastTime = Date.now();

  const rate = () => {
    let pages = 0;
    let ms = 0;
    for (const s of samples) {
      pages += s.pages;
      ms += s.ms;
    }
    if (pages === 0 || ms === 0) return null;
    return (pages / ms) * 1000;
  };

  return {
    sample(processedPages) {
      const now = Date.now();
      const pages = processedPages - lastPages;
      const ms = now - lastTime;
      lastPages = processedPages;
      lastTime = now;
      if (pages > 0 && ms > 0) {
        samples.push({ pages, ms });
        if (samples.length > windowSize) samples.shift();
      }
    },
    pagesPerSecond: rate,
    etaSeconds(remainingPages) {
      const r = rate();
      if (!r || remainingPages <= 0) return null;
      return Math.ceil(remainingPages / r);
    },
  };
};

// Re-export formatFileSize for convenience
export { formatFileSize };

// ============================================================
// C-FILE AI ANALYSIS HELPER (v1.18.3)
// Uses AI to extract potential claims from C-File text
// Includes JSON repair for truncated responses
// ============================================================

/**
 * Analyze C-File text with AI to extract potential claims
 * Uses compact prompt and JSON repair for Local AI compatibility
 * @param {string} text - C-File text (max 50K chars recommended)
 * @returns {Object|null} Analysis results or null if failed
 */
const analyzeCFileWithAI = async (text) => {
  if (!isAnyAIAvailable()) {
    // eslint-disable-next-line no-console
    console.log("⚠️ No AI available for C-File analysis");
    return null;
  }

  // eslint-disable-next-line no-console
  console.log("🤖 Starting AI-enhanced C-File analysis...");

  // Compact prompt for local AI compatibility
  const systemPrompt = `You are a VA Claims Auditor. Analyze C-File text and extract claims evidence.

OUTPUT FORMAT: Valid JSON only. Structure:
{
  "potential_claims": [{"condition":"","likelihood":"high|medium|low","inServiceEvent":"","missing_element":""}],
  "exposures": [{"type":"","timeframe":""}],
  "mentalHealth": {"indicators":[],"diagnoses":[]},
  "actionItems": [""]
}

RULES: Only include findings present in text. Be concise.`;

  // PI-02: spotlight the untrusted C-file excerpt (treat-as-data delimiters).
  const userPrompt = `Analyze this C-File excerpt and return ONLY JSON:\n\n${untrustedSection("C-FILE EXCERPT", text.substring(0, 15000))}`;

  // AIS-05: non-blocking crisis scan over the raw C-File excerpt.
  scanDocumentForCrisis(text);

  try {
    const response = await generateAI(userPrompt, {
      systemPrompt,
      temperature: 0.2,
      maxTokens: 2048,
      expectJSON: true,
      skipCrisisCheck: true,
      skipHallucinationCheck: true,
      toolContext: "Muster Call C-File Analysis",
    });

    const content = response?.text || response;
    if (!content) return null;

    // Parse JSON response
    let cleanContent = content.trim();
    if (cleanContent.startsWith("```json"))
      cleanContent = cleanContent.slice(7);
    if (cleanContent.startsWith("```")) cleanContent = cleanContent.slice(3);
    if (cleanContent.endsWith("```")) cleanContent = cleanContent.slice(0, -3);
    cleanContent = cleanContent.trim();

    let result;
    try {
      result = JSON.parse(cleanContent);
    } catch (parseErr) {
      console.warn(
        `⚠️ JSON parse failed (${parseErr.message}), attempting repair...`,
      );
      result = attemptJSONRepair(cleanContent);
      if (result) {
        // eslint-disable-next-line no-console
        console.log("✅ Successfully repaired truncated AI response");
      }
    }

    if (result) {
      const rejectedCodes = enforceValidDiagnosticCodes(result);
      // eslint-disable-next-line no-console
      console.log(
        `✅ AI C-File analysis complete: ${result.potential_claims?.length || 0} potential claims found`,
      );
      return {
        ...result,
        analyzedAt: new Date().toISOString(),
        aiPowered: true,
        ...(rejectedCodes.length > 0 && {
          rejectedDiagnosticCodes: rejectedCodes,
        }),
      };
    }

    return null;
  } catch (err) {
    console.error("❌ AI C-File analysis error:", err);
    return null;
  }
};

/**
 * Processing states for UI feedback
 */
export const PROCESSING_STATES = {
  IDLE: "idle",
  VALIDATING: "validating",
  LOADING: "loading",
  EXTRACTING: "extracting",
  CLASSIFYING: "classifying",
  ANALYZING: "analyzing",
  POPULATING: "populating",
  COMPLETE: "complete",
  ERROR: "error",
};

/**
 * File size limits (can be adjusted based on browser memory)
 * NO SINGLE FILE LIMIT - C-Files and medical records can be massive
 */
const SIZE_LIMITS = {
  MAX_SINGLE_FILE: Infinity, // NO LIMIT - handle any file size
  MAX_TOTAL_SIZE: 2 * 1024 * 1024 * 1024, // 2 GB total batch
  WARN_THRESHOLD: 100 * 1024 * 1024, // Warn at 100 MB (informational only)
};

/**
 * Validate file batch before processing
 */
export const validateFilesBatch = (files) => {
  const results = {
    valid: [],
    invalid: [],
    warnings: [],
    totalSize: 0,
    errors: [],
  };

  if (!files || files.length === 0) {
    results.errors.push("No files provided");
    return results;
  }

  for (const file of files) {
    const fileSize = file.size || 0;
    results.totalSize += fileSize;

    // Check file type support
    if (!isFileSupported(file)) {
      results.invalid.push({
        file,
        reason: "Unsupported file type. Please use PDF, DOCX, or TXT files.",
      });
      continue;
    }

    // Check individual file size
    if (fileSize > SIZE_LIMITS.MAX_SINGLE_FILE) {
      results.invalid.push({
        file,
        reason: `File too large (${formatFileSize(fileSize)}). Maximum ${formatFileSize(SIZE_LIMITS.MAX_SINGLE_FILE)} per file.`,
      });
      continue;
    }

    // Warn on large files
    if (fileSize > SIZE_LIMITS.WARN_THRESHOLD) {
      results.warnings.push({
        file,
        message: `Large file (${formatFileSize(fileSize)}) may take several minutes to process.`,
      });
    }

    results.valid.push(file);
  }

  // Check total size
  if (results.totalSize > SIZE_LIMITS.MAX_TOTAL_SIZE) {
    results.errors.push(
      `Total size (${formatFileSize(results.totalSize)}) exceeds limit of ${formatFileSize(SIZE_LIMITS.MAX_TOTAL_SIZE)}. Please split into smaller batches.`,
    );
  }

  return results;
};

/**
 * Process a single document: extract text, classify, parse
 * Enhanced for sequential formation processing with VISION AI PRIMARY for DD214s
 */
const ensureFlorenceVisionReady = async (file, onProgress) => {
  // Initialize Florence if needed (only once)
  if (!visionInitialized && !visionInitializing) {
    visionInitializing = true;
    onProgress?.({
      filename: file.name,
      state: PROCESSING_STATES.EXTRACTING,
      progress: 30,
      stage: "vision_init",
      message: "⚡ Loading Florence-2 Vision engine (first time only)...",
    });

    const initSuccess = await florenceOCRService.initialize();
    visionInitialized = initSuccess;
    visionInitializing = false;

    if (!initSuccess) {
      console.warn(
        "⚠️ Florence Vision initialization failed, falling back to OCR",
      );
    }
  }

  // Wait for vision to be ready if still initializing
  if (visionInitializing) {
    onProgress?.({
      filename: file.name,
      state: PROCESSING_STATES.EXTRACTING,
      progress: 35,
      stage: "vision_wait",
      message: "⏳ Waiting for Vision engine to load...",
    });
    // Wait for initialization to complete
    while (visionInitializing) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
};

// Common boilerplate words/phrases that appear on virtually every real DD214.
// Used as a dictionary sanity check against Florence-2 hallucinated output.
const DD214_EXPECTED_TERMS = [
  "discharge",
  "active duty",
  "armed forces",
  "service",
  "separation",
  "united states",
  "grade",
  "rank",
  "military",
  "certificate",
];

// Florence-2 can degenerate into a repetition loop on faded/old scans -
// producing output that's long enough to pass a naive length check but is
// garbage (e.g. "3.4 BATH ROOM 3.5BATHROOM 3.4BATH ROAD"). Detect a repeated
// word-root appearing implausibly often relative to total word count.
function hasRepetitionLoop(text) {
  const words = text.toLowerCase().match(/[a-z]{4,}/g) || [];
  if (words.length === 0) return false;

  const counts = {};
  words.forEach((w) => {
    counts[w] = (counts[w] || 0) + 1;
  });
  const maxRepeats = Math.max(...Object.values(counts));
  return maxRepeats >= 5 && maxRepeats / words.length > 0.15;
}

// Dictionary sanity check for the DD214-specific vision path: a real
// extraction almost always contains at least one boilerplate term, so its
// total absence (combined with a repetition loop) signals hallucinated text.
function isGarbledVisionText(text) {
  if (!text) return true;
  if (hasRepetitionLoop(text)) return true;

  const lower = text.toLowerCase();
  const hasExpectedTerm = DD214_EXPECTED_TERMS.some((term) =>
    lower.includes(term),
  );
  return !hasExpectedTerm;
}

const extractDD214TextViaVision = async (file, onProgress, result) => {
  onProgress?.({
    filename: file.name,
    state: PROCESSING_STATES.EXTRACTING,
    progress: 40,
    stage: "vision_process",
    message: "👁️ Florence-2 Vision analyzing DD214...",
  });

  // Process all pages for multi-page DD214s
  const visionResult = await florenceOCRService.processMultiplePages(file, {
    maxPages: 4, // DD214s are typically 1-2 pages, but handle multi-page
    onPageComplete: (pageNum, total, _pageResult) => {
      const progress = 40 + (pageNum / total) * 30; // 40-70%
      onProgress?.({
        filename: file.name,
        state: PROCESSING_STATES.EXTRACTING,
        progress: Math.round(progress),
        stage: "vision_page",
        message: `👁️ Vision AI reading page ${pageNum}/${total}...`,
        currentPage: pageNum,
        totalPages: total,
      });
    },
  });

  if (
    visionResult.combinedText &&
    visionResult.combinedText.trim().length > 100 &&
    !isGarbledVisionText(visionResult.combinedText)
  ) {
    // eslint-disable-next-line no-console
    console.log(
      `✅ Florence Vision extracted ${visionResult.combinedText.length} chars from ${visionResult.processedPages} page(s)`,
    );

    // Log the parsed data from vision
    if (visionResult.parsedData?.fields) {
      const fields = visionResult.parsedData.fields;
      // eslint-disable-next-line no-console
      console.log("🔍 Vision parsed fields:", {
        name: fields.name,
        branch: fields.branch,
        rank: fields.rank,
        mos: fields.mos,
        awards: fields.awardCount,
        confidence: fields.overallConfidence,
      });
    }

    result.visionUsed = true;
    result.confidence = 90;

    return {
      text: visionResult.combinedText,
      pageCount: visionResult.totalPages,
      method: "vision_florence",
      confidence: 90, // Florence vision is highly accurate
      ocrUsed: false,
      visionUsed: true,
      // Pass through the parsed data from vision!
      visionParsedData: visionResult.parsedData,
    };
  }

  console.warn(
    "⚠️ Vision extraction returned minimal or garbled text, falling back to OCR",
  );
  return null; // Will trigger OCR fallback
};

const runVisionFirstDD214Extraction = async (file, onProgress, result) => {
  // ============================================================
  // VISION-FIRST PATH: DD214s get Florence-2 treatment
  // ============================================================
  // eslint-disable-next-line no-console
  console.log(
    `👁️ DD214 detected - using Florence-2 Vision AI as primary extraction`,
  );

  onProgress?.({
    filename: file.name,
    state: PROCESSING_STATES.EXTRACTING,
    progress: 25,
    stage: "vision_primary",
    message: "👁️ DD214 detected - engaging Vision AI...",
  });

  let extractionResult = null;

  try {
    await ensureFlorenceVisionReady(file, onProgress);

    if (visionInitialized) {
      extractionResult = await extractDD214TextViaVision(
        file,
        onProgress,
        result,
      );
    }
  } catch (visionError) {
    console.warn("⚠️ Vision primary extraction failed:", visionError.message);
    extractionResult = null; // Will trigger OCR fallback
  }

  // Fall back to OCR if vision failed
  if (!extractionResult) {
    // eslint-disable-next-line no-console
    console.log("📷 Falling back to OCR extraction...");
    onProgress?.({
      filename: file.name,
      state: PROCESSING_STATES.EXTRACTING,
      progress: 45,
      stage: "ocr_fallback",
      message: "📷 Vision unavailable - using OCR...",
    });

    extractionResult = await analyzeDocument(file, (state) => {
      onProgress?.({
        filename: file.name,
        state: PROCESSING_STATES.EXTRACTING,
        progress: 45 + (state.progress || 0) * 0.25, // 45-70%
        ocrState: state.message || state.state,
        currentPage: state.currentPage,
        totalPages: state.totalPages,
        quality: state.quality,
        confidence: state.confidence,
        stage: "platoon_sergeant",
      });
    });
  }

  return extractionResult;
};

async function _extractDocumentText(file, onProgress) {
  onProgress?.({
    filename: file.name,
    state: PROCESSING_STATES.EXTRACTING,
    progress: 25,
    stage: "platoon_sergeant",
  });

  const isLargePDF =
    file.name.toLowerCase().endsWith(".pdf") && file.size > 50 * 1024 * 1024;

  let extractionResult;

  if (isLargePDF) {
    // eslint-disable-next-line no-console
    console.log(
      `📦 Large PDF detected (${(file.size / 1024 / 1024).toFixed(1)} MB) - using streaming extraction...`,
    );
    const etaTracker = createEtaTracker();
    const largeResult = await processLargePDF(file, {
      batchSize: 20,
      onProgress: (cur, total, pct) => {
        onProgress?.({
          filename: file.name,
          state: PROCESSING_STATES.EXTRACTING,
          progress: 25 + pct * 0.4, // maps 0-100% → 25-65% of overall progress
          stage: "platoon_sergeant",
          message: `Streaming page ${cur}/${total} (${pct}%)...`,
          currentPage: cur,
          totalPages: total,
          etaSeconds: etaTracker.etaSeconds(total - cur),
          pagesPerSecond: etaTracker.pagesPerSecond(),
        });
      },
      onBatch: (batch) => {
        etaTracker.sample(batch.processedSoFar);
        // Forward per-batch updates for responsive UI on very large files
        onProgress?.({
          filename: file.name,
          state: PROCESSING_STATES.EXTRACTING,
          progress: 25 + batch.pct * 0.4,
          stage: "platoon_sergeant",
          message: `Pages ${batch.startPage}-${batch.endPage} of ${batch.totalPages} extracted`,
          currentPage: batch.processedSoFar,
          totalPages: batch.totalPages,
          etaSeconds: etaTracker.etaSeconds(
            batch.totalPages - batch.processedSoFar,
          ),
          pagesPerSecond: etaTracker.pagesPerSecond(),
        });
      },
    });
    extractionResult = {
      text: largeResult.text,
      pageCount: largeResult.pageCount,
      method: largeResult.method,
      fileType: "PDF",
      ocrUsed: false,
      hasScannedSections: largeResult.hasScannedSections,
      scannedPageRanges: largeResult.scannedPageRanges || [],
      pagesWithText: largeResult.pagesWithText,
      pagesEmpty: largeResult.pagesEmpty,
    };
  } else {
    extractionResult = await analyzeDocument(file, (state) => {
      onProgress?.({
        filename: file.name,
        state: PROCESSING_STATES.EXTRACTING,
        progress: 25 + (state.progress || 0) * 0.4, // 25-65%
        ocrState: state.message || state.state,
        currentPage: state.currentPage,
        totalPages: state.totalPages,
        quality: state.quality,
        confidence: state.confidence,
        stage: "platoon_sergeant",
      });
    });
  }

  return extractionResult;
}

async function _applyVisionFallbackIfNeeded(
  file,
  onProgress,
  result,
  isPDF,
  extractionResult,
) {
  // Store OCR confidence for fallback decision
  const ocrConfidence = extractionResult.confidence || 0;
  result.confidence = ocrConfidence;

  // Vision fallback for poor OCR quality on any PDF
  const shouldTryVisionFallback =
    isPDF &&
    ocrConfidence < VISION_FALLBACK_THRESHOLD &&
    isWebGPUSupported() &&
    extractionResult.ocrUsed;

  if (shouldTryVisionFallback) {
    // eslint-disable-next-line no-console
    console.log(
      `👁️ OCR confidence ${ocrConfidence}% < ${VISION_FALLBACK_THRESHOLD}% threshold, trying Florence-2 Vision...`,
    );

    onProgress?.({
      filename: file.name,
      state: PROCESSING_STATES.EXTRACTING,
      progress: 65,
      stage: "vision_fallback",
      message: "🔬 Low OCR quality detected - engaging Vision AI...",
    });

    try {
      // Initialize Florence if needed
      if (!visionInitialized && !visionInitializing) {
        visionInitializing = true;
        const initSuccess = await florenceOCRService.initialize();
        visionInitialized = initSuccess;
        visionInitializing = false;
      }

      if (visionInitialized) {
        const visionResult = await florenceOCRService.processDocument(file, {
          pageNumber: 1,
          parseDD214: false,
        });

        if (
          visionResult.text &&
          visionResult.text.trim().length >
            extractionResult.text.trim().length * 0.5 &&
          !hasRepetitionLoop(visionResult.text)
        ) {
          // eslint-disable-next-line no-console
          console.log(
            `✅ Florence Vision extracted ${visionResult.text.length} chars (OCR got ${extractionResult.text.length})`,
          );
          extractionResult = {
            ...extractionResult,
            text: visionResult.text,
            method: "vision_florence",
            confidence: 85,
            visionUsed: true,
          };
          result.visionUsed = true;
        }
      }
    } catch (visionError) {
      console.warn("⚠️ Vision fallback failed:", visionError.message);
    }
  }

  return extractionResult;
}

const runStandardDocumentExtraction = async (
  file,
  onProgress,
  result,
  isPDF,
) => {
  // ============================================================
  // STANDARD PATH: OCR extraction for non-DD214 documents
  // ============================================================
  let extractionResult = await _extractDocumentText(file, onProgress);
  extractionResult = await _applyVisionFallbackIfNeeded(
    file,
    onProgress,
    result,
    isPDF,
    extractionResult,
  );
  return extractionResult;
};

const storeDocumentInVKB = async (file, result) => {
  const vkbResult = await addDocumentToVKB({
    fileName: file.name,
    fileSize: file.size,
    pageCount: result.pageCount || 1,
    classification: result.classification.type,
    extractedText: result.text,
    extractedData: result.extractedData,
    ocrUsed: result.ocrUsed || false,
    method: result.method || "text",
  });

  if (vkbResult.success) {
    result.vkbDocumentId = vkbResult.documentId;
    // eslint-disable-next-line no-console
    console.log(`✅ Stored ${file.name} in VKB as ${vkbResult.documentId}`);

    if (vkbResult.storageWarning) {
      console.warn(`⚠️ ${vkbResult.storageWarning}`);
      result.storageWarning = vkbResult.storageWarning;
    }
  }
};

// classifyDocument() (documentClassifier.js) always returns one of the
// uppercase DOCUMENT_TYPES enum values, never the lowercase/snake_case labels
// below - those are dead keys kept only because some other caller may still
// pass them directly. Without the DOCUMENT_TYPES-keyed entries, every
// classification except the DD214 family (whose enum values happen to equal
// their own uppercase strings) fell through to PACKET_DOC_TYPES.OTHER.
const CLASS_TO_PACKET_TYPE = {
  DD214: PACKET_DOC_TYPES.DD214,
  service_record: PACKET_DOC_TYPES.DD214,
  NGB22: PACKET_DOC_TYPES.NGB22,
  DD256: PACKET_DOC_TYPES.DD256,
  DD257: PACKET_DOC_TYPES.DD257,
  rating_decision: PACKET_DOC_TYPES.RATING_DECISION,
  claim_letter: PACKET_DOC_TYPES.CLAIM_LETTER,
  c_file: PACKET_DOC_TYPES.C_FILE,
  blue_button: PACKET_DOC_TYPES.BLUE_BUTTON,
  medical_record: PACKET_DOC_TYPES.MEDICAL_RECORD,
  dbq: PACKET_DOC_TYPES.DBQ,
  nexus_letter: PACKET_DOC_TYPES.NEXUS_LETTER,
  personal_statement: PACKET_DOC_TYPES.PERSONAL_STATEMENT,
  buddy_statement: PACKET_DOC_TYPES.BUDDY_STATEMENT,
  va_decision: PACKET_DOC_TYPES.VA_CORRESPONDENCE,
  [DOCUMENT_TYPES.DD215]: PACKET_DOC_TYPES.DD215,
  [DOCUMENT_TYPES.RATING_DECISION]: PACKET_DOC_TYPES.RATING_DECISION,
  [DOCUMENT_TYPES.CLAIM_LETTER]: PACKET_DOC_TYPES.CLAIM_LETTER,
  [DOCUMENT_TYPES.C_FILE_MEDICAL]: PACKET_DOC_TYPES.C_FILE,
  [DOCUMENT_TYPES.BLUE_BUTTON]: PACKET_DOC_TYPES.BLUE_BUTTON,
  [DOCUMENT_TYPES.MEDICAL_RECORD]: PACKET_DOC_TYPES.MEDICAL_RECORD,
  [DOCUMENT_TYPES.DBQ]: PACKET_DOC_TYPES.DBQ,
  [DOCUMENT_TYPES.NEXUS_LETTER]: PACKET_DOC_TYPES.NEXUS_LETTER,
  [DOCUMENT_TYPES.PERSONAL_STATEMENT]: PACKET_DOC_TYPES.PERSONAL_STATEMENT,
  [DOCUMENT_TYPES.VA_CORRESPONDENCE]: PACKET_DOC_TYPES.VA_CORRESPONDENCE,
  [DOCUMENT_TYPES.EXAM_REPORT]: PACKET_DOC_TYPES.EXAM_REPORT,
};

const archiveDocumentInPacket = async (file, result) => {
  try {
    const packetType =
      CLASS_TO_PACKET_TYPE[result.classification.type] ||
      PACKET_DOC_TYPES.OTHER;

    await saveDocumentToPacket({
      fileName: file.name,
      classification: packetType,
      rawText: result.text || "",
      extractedData: result.extractedData || {},
      pageCount: result.pageCount || 1,
      fileSize: file.size || 0,
      ocrMethod: result.method || "text",
      ocrConfidence: result.classification?.confidence || 0,
      tags: [
        result.classification?.type,
        result.classification?.subtype,
      ].filter(Boolean),
    });
    // eslint-disable-next-line no-console
    console.log(`📁 Archived ${file.name} in My Packet`);
  } catch (packetErr) {
    console.warn(
      `My Packet save failed for ${file.name} (non-fatal):`,
      packetErr.message,
    );
  }
};

// Box 12b (NET ACTIVE SERVICE THIS PERIOD) is stored as a formatted string by
// parseServiceRecord (e.g. "4 years, 2 months, 15 days"). DD214DataGridB in
// MyPacket.jsx renders numeric yearsService/monthsService, so reconstitute
// them here instead of dropping the already-extracted value.
const _parseServiceTimeString = (str) => {
  if (!str) return { years: null, months: null, days: null };
  // years/months/days are always 1-3 digits in practice; bounding the
  // quantifier (was \d+) avoids a genuine slow path confirmed via
  // adversarial timing test (13s+ on 50k-digit input) without changing
  // behavior on any real extracted service-time string.
  const match =
    /(\d{1,3})\s*years?,\s*(\d{1,3})\s*months?(?:,\s*(\d{1,3})\s*days?)?/i.exec(
      str,
    );
  if (!match) return { years: null, months: null, days: null };
  return {
    years: Number.parseInt(match[1], 10),
    months: Number.parseInt(match[2], 10),
    days: match[3] ? Number.parseInt(match[3], 10) : null,
  };
};

// Field builders below are split out of buildDD214ProfileUpdate purely to
// keep that function's cyclomatic complexity under the repo's lint ceiling
// - every branch here is a field default, no new behavior.
function _buildDD214IdentityFields(d) {
  return {
    fullName: d.veteranName || null,
    // FIX-19: which form type actually supplied fullName - the merged
    // record could come from a DD214, NGB22, DD256, or DD257, and the
    // Service tab's Name card used to hardcode "DD-214, Block 1" regardless
    // of which one actually won the confidence merge. Only set when this
    // extraction actually found a name, so it merges through
    // _mergeDD214Record's existing per-field confidence/emptiness rules in
    // lockstep with fullName itself (same empty/non-empty state on every
    // merge event) rather than needing its own bespoke tracking.
    fullNameSourceForm: d.veteranName ? d.formType || null : null,
    lastName: d.lastName || null,
    firstName: d.firstName || null,
    middleName: d.middleName || null,
    dateOfBirth: d.dateOfBirth || null,
    branch: d.branch || null,
    component: d.component || null,
    rank: d.rank || null,
    payGrade: d.payGrade || null,
    mos: d.mos || null,
    mosTitle: d.mosTitle || null,
    entryDate: d.serviceStartDate || null,
    separationDate: d.serviceEndDate || null,
    placeOfEntry: d.placeOfEntry || null,
    placeOfEntryLowConfidence: !!d.placeOfEntryLowConfidence,
  };
}

function _buildDD214ServiceAndSeparationFields(d, result, serviceTime) {
  return {
    netActiveService: d.totalActiveService || null,
    totalPriorActiveService: d.totalPriorActiveService || null,
    totalPriorInactiveService: d.totalPriorInactiveService || null,
    yearsService: serviceTime.years,
    monthsService: serviceTime.months,
    daysService: serviceTime.days,
    militaryEducation: d.militaryEducation ? [d.militaryEducation] : [],
    separationType: d.separationType || null,
    characterOfService: d.dischargeType || null,
    separationAuthority: d.separationAuthority || null,
    separationCode: d.spdCode || null,
    reentryCode: d.reentryCode || null,
    narrativeReason: d.narrativeReason || null,
    foreignService: !!d.foreignService,
    combatService: d.combatService || null,
    extractedText: (result.text || "").substring(0, 10000),
    confidence: result.classification?.confidence ?? 0,
    additionalPeriods: Array.isArray(d.additionalPeriods)
      ? d.additionalPeriods
      : [],
  };
}

// Maps parseServiceRecord()/buildVisionParsedServiceRecord() field names
// (musterCallProcessor's own DD214 extraction) onto the field names
// saveDD214Data() (veteranProfile.js) expects. The two never agreed on names
// because saveDD214Data's other two callers (MyPacket.jsx, DD214Analyzer.jsx)
// feed it AI/regex output from a separate extractor (dd214FieldExtractor.js)
// that already uses saveDD214Data's names. Fields with no corresponding
// saveDD214Data target (remarks, deployments) are intentionally left
// unmapped rather than invented. placeOfEntry has no saveDD214Data target
// either, but FIX-15 forwards it here anyway for the period-scoped
// servicePeriods[] write in saveServiceRecordToProfile below.
const buildDD214ProfileUpdate = (result) => {
  const d = result.extractedData || {};
  const serviceTime = _parseServiceTimeString(d.totalActiveService);
  return {
    ..._buildDD214IdentityFields(d),
    ..._buildDD214ServiceAndSeparationFields(d, result, serviceTime),
  };
};

const _isEmptyDD214Value = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
};

// Merges a newly-extracted DD214 record onto whatever is already stored in
// the Service tab. Confidence is tracked at the record level (a single
// high-water mark via Math.max below, not per field): a field is only
// overwritten when the incoming extraction's confidence is >= the stored
// record's overall confidence, or when the existing field is empty - so a
// low-confidence re-scan can fill gaps but can't blank out or replace data
// from a higher-confidence scan. A field gap-filled by a low-confidence scan
// is thereafter protected by the record's higher watermark. `existing`/
// `candidate` field names always match: both flow through the same
// _sanitizeDd214Data() whitelist (veteranProfile.js) that saveDD214Data uses.
const _mergeDD214Record = (existing, candidate) => {
  if (!existing) return candidate;
  const existingConfidence = existing.confidence || 0;
  const candidateConfidence = candidate.confidence || 0;
  const keys = new Set([...Object.keys(existing), ...Object.keys(candidate)]);
  const merged = {};
  keys.forEach((key) => {
    const newVal = candidate[key];
    const oldVal = existing[key];
    if (_isEmptyDD214Value(oldVal)) {
      merged[key] = newVal;
    } else if (_isEmptyDD214Value(newVal)) {
      merged[key] = oldVal;
    } else {
      merged[key] = candidateConfidence >= existingConfidence ? newVal : oldVal;
    }
  });
  merged.confidence = Math.max(existingConfidence, candidateConfidence);
  return merged;
};

// The canonical service period shape (C1 multi-period model) mandates
// "YYYY-MM-DD" dates, but parseServiceRecord's own box extractors
// (_normalizeDateMatch) emit MM/DD/YYYY - normalize at this write boundary
// rather than touching the parser. Leaves anything unrecognized as-is
// rather than fabricating a date.
const _toISODateString = (dateStr) => {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return dateStr;
  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

// Writes extracted DD214 fields to the Service tab's storage key
// (SERVICE_HISTORY_KEY via saveDD214Data) - kept as-is, still the write
// target for person-scoped fields and everything currently displayed from
// dd214Data. C1: ADDITIVELY also writes the period-scoped subset of the
// same extraction into the canonical serviceHistory.servicePeriods[]
// array (upsertServicePeriod, keyed by (serviceStartDate, serviceEndDate)
// so genuinely different enlistment periods never collide - FIX-11).
// This does not change saveDD214Data's existing merge behavior at all.
// Split out of saveServiceRecordToProfile purely to keep that function's
// cyclomatic complexity under the repo's lint ceiling - same behavior, same
// upsertServicePeriod call, just its own named step.
function _savePrimaryServicePeriod(file, result, candidate) {
  try {
    upsertServicePeriod(
      {
        serviceStartDate: _toISODateString(candidate.entryDate),
        serviceEndDate: _toISODateString(candidate.separationDate),
        branch: candidate.branch || "",
        component: candidate.component || "",
        formType: result.extractedData.formType || "DD214",
        rank: candidate.rank || "",
        payGrade: candidate.payGrade || "",
        mos: candidate.mos || "",
        mosTitle: candidate.mosTitle || "",
        characterOfService: candidate.characterOfService || "",
        separationType: candidate.separationType || "",
        separationAuthority: candidate.separationAuthority || "",
        separationCode: candidate.separationCode || "",
        reentryCode: candidate.reentryCode || "",
        narrativeReason: candidate.narrativeReason || "",
        netActiveService: candidate.netActiveService || "",
        yearsService: candidate.yearsService,
        monthsService: candidate.monthsService,
        daysService: candidate.daysService,
        foreignService: !!candidate.foreignService,
        militaryEducation: candidate.militaryEducation?.[0] || "",
        placeOfEntry: candidate.placeOfEntry || "",
        placeOfEntryLowConfidence: !!candidate.placeOfEntryLowConfidence,
      },
      { sourceDocument: file.name, confidence: candidate.confidence },
    );
    // eslint-disable-next-line no-console
    console.log(`✅ Saved service period for ${file.name}`);
  } catch (periodErr) {
    console.warn(
      `Service period save failed for ${file.name} (non-fatal):`,
      periodErr.message,
    );
  }
}

// FIX-15: NGB-22 Box 18's granular IADT/AD date ranges (see
// _extractNGB22PeriodDates) each become their own servicePeriods[] entry,
// additive to the single Box 12a/12b period saved by
// _savePrimaryServicePeriod - upsertServicePeriod's own (serviceStartDate,
// serviceEndDate) identity key means a range that happens to match the
// primary period is a no-op, not a duplicate.
function _saveNGB22AdditionalPeriods(file, candidate) {
  if (!Array.isArray(candidate.additionalPeriods)) return;
  candidate.additionalPeriods.forEach((period) => {
    try {
      upsertServicePeriod(
        {
          serviceStartDate: _toISODateString(period.serviceStartDate),
          serviceEndDate: _toISODateString(period.serviceEndDate),
          branch: candidate.branch || "",
          component: period.component,
          formType: "NGB22",
          rank: candidate.rank || "",
          payGrade: candidate.payGrade || "",
          sourceDocument: file.name,
          notes:
            "Date range from NGB-22 Box 18 remarks (no location listed on the document).",
        },
        { sourceDocument: file.name, confidence: candidate.confidence },
      );
    } catch (periodErr) {
      console.warn(
        `NGB-22 Box 18 period save failed for ${file.name} (non-fatal):`,
        periodErr.message,
      );
    }
  });
}

const saveServiceRecordToProfile = (file, result) => {
  if (result.extractedData?.type !== "service_record") return;
  const candidate = buildDD214ProfileUpdate(result);
  try {
    const existing = getServiceHistory().dd214Data;
    saveDD214Data(_mergeDD214Record(existing, candidate));
    // eslint-disable-next-line no-console
    console.log(`✅ Saved DD214 data to Service tab for ${file.name}`);
  } catch (dd214Err) {
    console.warn(
      `Service history save failed for ${file.name} (non-fatal):`,
      dd214Err.message,
    );
  }

  _savePrimaryServicePeriod(file, result, candidate);
  _saveNGB22AdditionalPeriods(file, candidate);
};

// result.extractedData.awards reaches this in one of two shapes depending on
// which extraction path produced it: ribbonRackData.parseDD214Text() output
// (regex path, via _extractAwardsFromBlock13/_extractAwardsFallback inside
// parseServiceRecord below - { award, matchedText, devices, quantity }), or
// dd214VisionParser.extractAwards() output (Florence vision path, via
// buildVisionParsedServiceRecord above - { name, abbreviation, isCombat,
// count }). They never share a shape because the vision path's own parser
// runs before ribbonRackData.parseDD214Text ever sees the vision-extracted
// text. Both get normalized to addAward()'s input shape here.
// FIX-4: devices must stay structured {type, position} objects end-to-end
// - VisualRibbon.jsx switches on device.type and can't render a flattened
// display-name string. This previously flattened via DEVICES[d.type]?.name
// right here, which is why devices extracted correctly by
// ribbonRackData.detectDevices() never actually rendered on the Ribbon
// Rack: by the time addAward() saw them, they were already strings with
// nowhere structured to go.
const _normalizeExtractedAward = (item) => {
  if (item.award) {
    const isCombat = (item.devices || []).some(
      (d) => d.type === "v_device" || d.type === "c_device",
    );
    // matchedText is whichever token (full name OR alias) actually appeared
    // in the source document -- a DD214 that spells the award out in full
    // (rather than abbreviating it) makes matchedText equal the full name,
    // which would otherwise leave the real name sitting in this field too.
    // MASTER_AWARDS' first alias is reliably the true abbreviation (verified
    // against ribbon_manifest.json: 88/89 entries), so fall back to it.
    const matchedFullName =
      (item.matchedText || "").toUpperCase() ===
      (item.award.name || "").toUpperCase();
    return {
      name: item.award.name,
      abbreviation:
        (!matchedFullName && item.matchedText) || item.award.aliases?.[0] || "",
      isCombat,
      devices: item.devices || [],
    };
  }
  return {
    name: item.name,
    abbreviation: item.abbreviation || "",
    isCombat: !!item.isCombat,
    devices: [],
  };
};

// Routes awards already found by parseServiceRecord/parseDD214Document
// (result.extractedData.awards) through addAward()'s dedup so the Ribbon
// Rack (RibbonRackSection in MyPacket.jsx) gets populated from Muster Call
// batch imports, not just the single-document DD214Analyzer.jsx upload flow.
// addAward() itself is what prevents the same medal appearing once per
// source document when a veteran's corpus has several overlapping DD214s.
const saveAwardsToProfile = (file, result) => {
  const awards = result.extractedData?.awards;
  if (!Array.isArray(awards) || awards.length === 0) return;
  try {
    awards.forEach((item) => {
      const normalized = _normalizeExtractedAward(item);
      if (!normalized.name) return;
      // Human-readable device summary for `notes` - devices themselves go
      // through as structured data via the `devices` key below.
      const deviceLabels = normalized.devices.map(
        (d) => DEVICES[d.type]?.name || d.type,
      );
      addAward({
        name: normalized.name,
        abbreviation: normalized.abbreviation,
        dateReceived: null,
        notes: deviceLabels.join(", "),
        isCombat: normalized.isCombat,
        devices: normalized.devices,
      });
    });
    // eslint-disable-next-line no-console
    console.log(
      `✅ Saved ${awards.length} award(s) to Ribbon Rack for ${file.name}`,
    );
  } catch (awardErr) {
    console.warn(
      `Award save failed for ${file.name} (non-fatal):`,
      awardErr.message,
    );
  }
};

// Adapts musterCallProcessor's own extractedData field names
// (buildDD214ProfileUpdate above) onto the dd214Data shape
// veteranKnowledgeBase.mergeDD214IntoVKB expects, which differs in a couple
// of field names (netActiveServiceTime vs netActiveService, spnCode vs
// separationCode) because mergeDD214IntoVKB's other two callers
// (DD214Analyzer.jsx, IntelligenceBriefing.jsx) feed it output from a
// separate extractor (dd214FieldExtractor.js) that already uses those names.
const buildVKBDD214Data = (result) => {
  const candidate = buildDD214ProfileUpdate(result);
  const d = result.extractedData || {};
  const awards = (Array.isArray(d.awards) ? d.awards : []).map((item) => {
    const normalized = _normalizeExtractedAward(item);
    return {
      name: normalized.name,
      date: null,
      isCombat: normalized.isCombat,
      devices: normalized.devices,
    };
  });
  const deployments = (Array.isArray(d.deployments) ? d.deployments : []).map(
    (location) => ({ location }),
  );

  return {
    ...candidate,
    netActiveServiceTime: candidate.netActiveService,
    spnCode: candidate.separationCode,
    education: candidate.militaryEducation?.[0] || null,
    awards,
    deployments,
    pageCount: result.pageCount || 1,
  };
};

// Populates vkb.serviceHistory.awards/deployments/mos/combatService (the
// richer VKB schema every AI tool reads via getVeteranAIContext() /
// generateLLMContext()) from the same batch-processed DD214/NGB22 data that
// saveServiceRecordToProfile writes to the Service tab above. Without this,
// documents ingested via Muster Call never reached vkb.serviceHistory at all
// - only the manual DD214Analyzer.jsx upload (mergeDD214IntoVKB) and
// IntelligenceBriefing.jsx review screen (mergeMusterCallIntoVKB) did.
// mergeDD214IntoVKB's own mergeDD214Awards has a separate fuzzy-match dedup
// against vkb.serviceHistory.awards - a different array in a different store
// (IndexedDB VKB) than addAward()'s history.awards (veteranProfile.js
// localStorage) - so both need to independently end up deduped; neither
// dedup is aware of the other. This reuses the same loadVKB()/saveVKB()
// lost-update race already disclosed on appendMusterCallTimelineEntry below,
// not a new one.
const mergeServiceRecordIntoVKB = async (file, result) => {
  if (result.extractedData?.type !== "service_record") return;
  try {
    const vkb = await loadVKB();
    const dd214Data = buildVKBDD214Data(result);
    mergeDD214IntoVKB(vkb, dd214Data, { fileName: file.name });
    await saveVKB(vkb);
    // eslint-disable-next-line no-console
    console.log(`✅ Merged DD214 data into VKB for ${file.name}`);
  } catch (vkbErr) {
    console.warn(
      `VKB merge failed for ${file.name} (non-fatal):`,
      vkbErr.message,
    );
  }
};

// Picks the most relevant date already surfaced by this document's own
// extraction/classification for its timeline entry; falls back to the
// processing date only if nothing usable was extracted.
// VA correspondence dates its letterhead in prose ("November 28, 2008"), not
// the "CLAIM DATE: 11/28/2008" literal parseClaimLetter looks for, so a real
// claim-letter corpus yields no extracted date at all and every entry collapses
// onto the import date - a timeline that can't show continuity of symptoms.
// Exports commonly carry the real date in the filename (ClaimLetter-2008-11-28)
// so it is used ahead of the processing-date fallback.
const _filenameDate = (fileName) => {
  const match = /(\d{4})[-_](\d{1,2})[-_](\d{1,2})/.exec(fileName || "");
  if (!match) return null;
  const [, year, month, day] = match;
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
};

// FIX-5: picks the most relevant date already surfaced by this document's
// own extraction/classification, then the filename, and only as an
// absolute last resort reports no real date at all instead of fabricating
// "today". Returns { date, dateIsProcessingDate } - date is null when
// nothing real was found.
const _resolveTimelineDate = (result, fileName) => {
  const d = result.extractedData || {};
  const extracted =
    d.serviceEndDate ||
    d.serviceStartDate ||
    d.decisionDate ||
    d.effectiveDate ||
    d.examDate ||
    d.claimDate ||
    d.dateOfService ||
    _filenameDate(fileName) ||
    null;
  if (extracted) return { date: extracted, dateIsProcessingDate: false };
  return { date: null, dateIsProcessingDate: true };
};

// Appends one minimal read-only timeline entry per successfully processed
// document, for the Timeline tab's VkbTimelineSection (which reads
// vkb.evidenceTimeline). Uses the same loadVKB()/saveVKB() read-modify-write
// pair addDocumentToVKB already uses. Batch processing (processMusterCallBatch)
// runs up to maxConcurrent documents in parallel, and loadVKB() returns a
// deep copy per call, so concurrent calls to this function race on the same
// lost-update pattern addDocumentToVKB already has - this doesn't add a new
// kind of race, just a second call site exposed to the pre-existing one.
// FIX-5: uses the same 5-field shape mergeDD214EvidenceTimeline
// (veteranKnowledgeBase.js) already uses - {date, eventType, description,
// source, significance} - instead of a different 3-field shape.
// FIX-12: pure identity check, factored out so it's unit-testable without
// IndexedDB (appendMusterCallTimelineEntry itself requires loadVKB/saveVKB,
// which aren't available under jsdom - see musterCallProcessor timeline
// dedup tests). Same spirit as addDocumentToVKB's FIX-6 (fileName+fileSize
// identity), but the "document_import" timeline shape has no fileName/
// fileSize fields of its own; description is built deterministically from
// the same label + file.name every time a given document is re-imported, so
// (eventType, source, description) is this shape's stable identity key.
export const findDuplicateTimelineEntry = (evidenceTimeline, description) =>
  evidenceTimeline.find(
    (e) =>
      e.eventType === "document_import" &&
      e.source === "Muster Call" &&
      e.description === description,
  );

const appendMusterCallTimelineEntry = async (file, result) => {
  try {
    const vkb = await loadVKB();
    if (!Array.isArray(vkb.evidenceTimeline)) {
      vkb.evidenceTimeline = [];
    }
    const label =
      getDocumentTypeLabel(result.classification?.type) ||
      result.classification?.type ||
      "Document";
    const description = `${label}: ${file.name}`;
    const { date, dateIsProcessingDate } = _resolveTimelineDate(
      result,
      file.name,
    );
    const importedDate = dateIsProcessingDate
      ? new Date().toISOString().split("T")[0]
      : undefined;

    // Without this, every re-import appended a brand-new "document_import"
    // entry instead of updating the existing one.
    const existing = findDuplicateTimelineEntry(
      vkb.evidenceTimeline,
      description,
    );
    if (existing) {
      existing.date = date;
      existing.dateIsProcessingDate = dateIsProcessingDate;
      existing.importedDate = importedDate;
    } else {
      vkb.evidenceTimeline.push({
        date,
        dateIsProcessingDate,
        importedDate,
        eventType: "document_import",
        description,
        source: "Muster Call",
        significance: "",
      });
    }
    await saveVKB(vkb);
  } catch (timelineErr) {
    console.warn(
      `Evidence timeline update failed for ${file.name} (non-fatal):`,
      timelineErr.message,
    );
  }
};

const classifyAndParseDocument = async (
  file,
  onProgress,
  result,
  extractionResult,
) => {
  // Step 2: Classify document (SecOps Intelligence Briefing - Part 1)
  onProgress?.({
    filename: file.name,
    state: PROCESSING_STATES.CLASSIFYING,
    progress: 75,
    stage: "intel_classify",
  });

  result.classification = classifyDocument(result.text, file.name, {
    pageCount: result.pageCount,
  });

  // Step 3: Parse based on classification (SecOps Intelligence Briefing - Part 2)
  onProgress?.({
    filename: file.name,
    state: PROCESSING_STATES.ANALYZING,
    progress: 85,
    stage: "intel_extract",
    docType: result.classification.type,
    confidence: result.classification.confidence,
  });

  // Parsing is enrichment on top of a successful extraction, and it runs
  // BEFORE storeDocumentInVKB/archiveDocumentInPacket in processSingleDocument.
  // Letting a parser throw therefore loses the whole document - the veteran's
  // file never reaches the VKB or My Packet at all. Observed on a real 2,018-page
  // C-File once page-count classification correctly routed it to
  // parseCFileDocument, which threw where parseClaimLetter had not. Degrade to
  // raw text and record the failure loudly instead of dropping the document.
  try {
    result.extractedData = await parseDocumentByType(
      result.text,
      result.classification.type,
      file.name,
      extractionResult.visionParsedData, // Pass vision-parsed data if available
    );
  } catch (parseErr) {
    console.error(
      `Parser failed for ${file.name} (${result.classification.type}); storing raw text so the document is not lost:`,
      parseErr,
    );
    result.extractedData = {
      raw: result.text.substring(0, 1000),
      parseError:
        parseErr?.message || String(parseErr) || "unknown parse error",
      parseFailedType: result.classification.type,
    };
  }
};

// Every write here is keyed by (fileName, fileSize) or an equivalent
// identity (addDocumentToVKB, saveDocumentToPacket, findDuplicateTimelineEntry,
// mergeDD214IntoVKB's per-fileName guard, addAward's own dedup) and updates
// the existing record in place rather than duplicating it. That makes this
// safe to call twice for the same document: once on initial extraction, and
// again from the verification screen's "Verify & Save" with corrected
// field values, so a veteran's corrections actually reach the stores every
// AI tool reads from instead of being silently discarded.
export const persistFormationDocument = async (file, result) => {
  await storeDocumentInVKB(file, result);
  await archiveDocumentInPacket(file, result);
  saveServiceRecordToProfile(file, result);
  saveAwardsToProfile(file, result);
  await appendMusterCallTimelineEntry(file, result);
  await mergeServiceRecordIntoVKB(file, result);
};

const processSingleDocument = async (file, onProgress) => {
  const result = {
    filename: file.name,
    size: file.size,
    status: "processing",
    text: null,
    classification: null,
    extractedData: null,
    error: null,
    processingTime: 0,
    pageCount: 0,
    method: null,
    ocrUsed: false,
    visionUsed: false, // Track if Florence vision was used
    quality: null,
    confidence: null,
  };

  const startTime = Date.now();

  try {
    // ============================================================
    // DD214 VISION-FIRST STRATEGY (v1.16.3)
    // For DD214s: Use Florence-2 Vision AI as PRIMARY extraction
    // For other docs: Use OCR with vision fallback
    // ============================================================
    const isPDF = file.name.toLowerCase().endsWith(".pdf");
    const looksLikeDD214 =
      /dd[-_]?214|service.?record|discharge|dd256|dd257|ngb22/i.test(file.name);
    const useVisionPrimary = isPDF && looksLikeDD214 && isWebGPUSupported();

    const extractionResult = useVisionPrimary
      ? await runVisionFirstDD214Extraction(file, onProgress, result)
      : await runStandardDocumentExtraction(file, onProgress, result, isPDF);

    // analyzeDocument throws on error, no need to check .success
    if (!extractionResult.text || extractionResult.text.trim().length === 0) {
      throw new Error("No text could be extracted from document");
    }

    result.text = extractionResult.text;
    result.pageCount = extractionResult.pageCount || 1;
    result.method = extractionResult.method || "text";
    result.ocrUsed = extractionResult.ocrUsed || false;

    await classifyAndParseDocument(file, onProgress, result, extractionResult);

    // Steps 4-6: store to VKB, My Packet, Service tab, Ribbon Rack, and the
    // evidence timeline.
    await persistFormationDocument(file, result);

    result.status = "complete";
    onProgress?.({
      filename: file.name,
      state: PROCESSING_STATES.COMPLETE,
      progress: 100,
      stage: "complete",
      result: {
        classification: result.classification,
        extractedData: result.extractedData,
        pageCount: result.pageCount,
        method: result.method,
        ocrUsed: result.ocrUsed,
      },
    });
  } catch (error) {
    console.error(`Error processing ${file.name}:`, error);
    result.status = "error";
    result.error = error.message;
    onProgress?.({
      filename: file.name,
      state: PROCESSING_STATES.ERROR,
      error: error.message,
      stage: "error",
    });
  }

  result.processingTime = Date.now() - startTime;
  return result;
};

/**
 * Process single document for formation workflow
 * Returns enhanced result object for user verification
 */
export const processFormationDocument = async (file, onProgress) => {
  // eslint-disable-next-line no-console
  console.log(`🎖️ Platoon Sergeant inspecting: ${file.name}`);

  // Use enhanced single document processor
  const result = await processSingleDocument(file, onProgress);

  // FIX-9 (root cause 2): this single-document path never called
  // autoPopulateProfile at all - only the Muster Call batch path
  // (useLegacyBatchProcessing.js) did. Profile auto-fill must work here
  // too.
  let profilePopulateResult = null;
  if (result.status === "complete" && result.extractedData) {
    try {
      profilePopulateResult = await autoPopulateProfile([result]);
    } catch (populateErr) {
      console.warn(
        `Profile auto-populate failed for ${file.name} (non-fatal):`,
        populateErr.message,
      );
    }
  }

  // Return result ready for intelligence briefing
  return {
    ...result,
    readyForReview: result.status === "complete",
    requiresVerification: true,
    vkbSaved: !!result.vkbDocumentId,
    profilePopulateResult,
  };
};

/**
 * Detect and split multiple DD214s from a multi-page document
 * Each DD214 typically starts with "CERTIFICATE OF RELEASE OR DISCHARGE"
 * Returns array of text segments, one per DD214
 */
const splitMultipleDD214s = (text) => {
  // Split by page markers first
  // eslint-disable-next-line sonarjs/slow-regex -- verified via adversarial timing test: distinctive literal prefix (or already-bounded quantifier) prevents unanchored-match backtracking blowup at 100k+ chars
  const pagePattern = /---\s*PAGE\s+(\d+).*?---/gi;

  // Find all page boundaries
  const pageMatches = [...text.matchAll(pagePattern)];

  if (pageMatches.length === 0) {
    // No page markers, return as single document
    return [{ text, pages: "1", startPage: 1 }];
  }

  // Group pages by DD214 (look for "CERTIFICATE OF RELEASE" to start a new one)
  const dd214Segments = [];
  let currentSegment = "";
  let segmentPageStart = 1;

  for (let i = 0; i < pageMatches.length; i++) {
    const pageNum = Number.parseInt(pageMatches[i][1]);
    const pageStart = pageMatches[i].index;
    const pageEnd = pageMatches[i + 1]?.index || text.length;
    const pageText = text.substring(pageStart, pageEnd);

    // Check if this page starts a new DD214
    const isNewDD214 =
      /CERTIFICATE\s+OF\s+RELEASE\s+OR\s+DISCHARGE/i.test(pageText) &&
      pageText.indexOf("CERTIFICATE OF RELEASE") < 200; // Near start of page

    if (isNewDD214 && currentSegment.length > 0) {
      // Save previous segment
      dd214Segments.push({
        text: currentSegment.trim(),
        pages: `${segmentPageStart}-${pageNum - 1}`,
        startPage: segmentPageStart,
      });
      currentSegment = pageText;
      segmentPageStart = pageNum;
    } else {
      currentSegment += pageText;
    }
  }

  // Add final segment
  if (currentSegment.length > 0) {
    dd214Segments.push({
      text: currentSegment.trim(),
      pages:
        segmentPageStart === pageMatches.length
          ? `${segmentPageStart}`
          : `${segmentPageStart}-${pageMatches.length}`,
      startPage: segmentPageStart,
    });
  }

  // eslint-disable-next-line no-console
  console.log(`📄 Detected ${dd214Segments.length} DD214(s) in document`);
  return dd214Segments;
};

/**
 * Extract a quick name from DD214 text segment for matching purposes
 * Returns last name only (most reliable for filename matching)
 */
const extractQuickName = (text) => {
  // Clean the text first
  // eslint-disable-next-line sonarjs/slow-regex -- {0,300} bounds backtracking to O(300n); measured 4ms at 100k unmatched "(" (was 9s unbounded)
  const cleanedText = text
    .replace(/\([^)]{0,300}\)/g, " ")
    .replace(/\s+/g, " ");

  const namePatterns = [
    // "1. NAME" followed by name: WILLIAMS, ROBERT
    /1\.\s*NAME[^\n]*\n\s*([A-Z]{3,})[,;]?\s*/i,
    // Name pattern: LASTNAME, FIRSTNAME
    /\b([A-Z]{3,})\s*[,;]\s*[A-Z]{2,}/,
  ];

  for (const pattern of namePatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      const lastName = match[1]?.trim().toUpperCase();
      // Validate it's not a form field label
      const FIELD_LABELS = [
        "DEPARTMENT",
        "COMPONENT",
        "BRANCH",
        "GRADE",
        "RANK",
        "SERVICE",
        "SOCIAL",
        "SECURITY",
        "NUMBER",
        "NAME",
        "DATE",
        "CERTIFICATE",
        "RELEASE",
        "DISCHARGE",
        "ACTIVE",
        "DUTY",
      ];
      if (
        lastName &&
        lastName.length >= 3 &&
        !FIELD_LABELS.includes(lastName)
      ) {
        return lastName;
      }
    }
  }
  return null;
};

/**
 * Select the best DD214 segment from multiple found in a document
 * Prioritizes by: 1) Filename match, 2) Data completeness
 */
const selectBestDD214Segment = (segments, filename) => {
  if (segments.length === 0) return null;
  if (segments.length === 1) return segments[0];

  // eslint-disable-next-line no-console
  console.log(
    `🎯 Multiple DD214s found (${segments.length}), selecting best match for filename: ${filename}`,
  );

  // Extract potential names from filename
  // "Williams Service Records DD214 ALL.pdf" -> "WILLIAMS"
  // "Smith_John_DD214.pdf" -> "SMITH"
  const filenameUpper = filename.toUpperCase();
  const filenameWords = filenameUpper.replace(/[_\-.]/g, " ").split(/\s+/);

  // Common words to ignore in filename
  const IGNORE_WORDS = [
    "SERVICE",
    "RECORDS",
    "DD214",
    "DD",
    "214",
    "ALL",
    "PDF",
    "MILITARY",
    "DISCHARGE",
    "COPY",
    "MEMBER",
    "SCAN",
    "FILE",
  ];
  const potentialNames = filenameWords.filter(
    (word) =>
      word.length >= 3 && !IGNORE_WORDS.includes(word) && /^[A-Z]+$/.test(word),
  );

  // eslint-disable-next-line no-console
  console.log(
    `📛 Potential name(s) from filename: [${potentialNames.join(", ")}]`,
  );

  // Score each segment
  const scoredSegments = segments.map((segment, index) => {
    const extractedName = extractQuickName(segment.text);
    let score = 0;
    let matchReason = "default";

    // Check if extracted name matches any potential name from filename
    if (extractedName && potentialNames.length > 0) {
      for (const potentialName of potentialNames) {
        if (extractedName === potentialName) {
          score += 100; // Exact match
          matchReason = `exact match: ${extractedName}`;
          break;
        } else if (
          extractedName.startsWith(potentialName) ||
          potentialName.startsWith(extractedName)
        ) {
          score += 50; // Partial match
          matchReason = `partial match: ${extractedName} ~ ${potentialName}`;
        }
      }
    }

    // Bonus for data completeness (look for key fields)
    const hasRank = /4a?\.\s*GRADE|RANK|SGT|CPL|PFC|SPC|LT\b/i.test(
      segment.text,
    );
    const hasBranch = /ARMY|NAVY|AIR\s*FORCE|MARINE|COAST\s*GUARD/i.test(
      segment.text,
    );
    const hasDates = /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/g.test(segment.text);
    const hasAwards = /MEDAL|RIBBON|BADGE|AWARD/i.test(segment.text);

    if (hasRank) score += 5;
    if (hasBranch) score += 5;
    if (hasDates) score += 5;
    if (hasAwards) score += 5;

    // Small bonus for earlier segments if no strong match found
    // (first DD214 is often the "primary" one)
    if (score < 50) {
      score += segments.length - index;
    }

    // eslint-disable-next-line no-console
    console.log(
      `  Segment ${index + 1} (pages ${segment.pages}): name="${extractedName}", score=${score}, reason="${matchReason}"`,
    );

    return { ...segment, score, extractedName, matchReason };
  });

  // Sort by score (highest first)
  scoredSegments.sort((a, b) => b.score - a.score);

  const best = scoredSegments[0];
  // eslint-disable-next-line no-console
  console.log(
    `✅ Selected segment ${segments.indexOf(best) + 1} (pages ${best.pages}) with name "${best.extractedName}" - ${best.matchReason}`,
  );

  return best;
};

function _visionIdentityFields(vf) {
  return {
    veteranName:
      vf.name ||
      `${vf.lastName || ""}, ${vf.firstName || ""} ${vf.middleName || ""}`
        .replace(/,\s*$/, "")
        .trim() ||
      null,
    lastName: vf.lastName || null,
    firstName: vf.firstName || null,
    middleName: vf.middleName || null,
    branch: vf.branch || null,
    component: vf.component || null,
    rank: vf.rank || null,
    payGrade: vf.payGrade || null,
    mos: vf.mos || null,
    mosTitle: vf.mosTitle || null,
  };
}

function _visionServiceFields(vf) {
  return {
    serviceStartDate: vf.entryDateFormatted || vf.entryDate || null,
    serviceEndDate: vf.separationDateFormatted || vf.separationDate || null,
    dateOfBirth: vf.dateOfBirth || null,
    awards: vf.awards || [],
    dischargeType: vf.characterOfService || null,
    separationCode: vf.separationCode || null,
    spdCode: vf.separationCode || null,
    reentryCode: vf.reentryCode || null,
    narrativeReason: vf.narrativeReason || null,
    combatService: vf.combatService || null,
    foreignService: vf.foreignService || null,
    foreignServiceLocations: vf.foreignServiceLocations || [],
  };
}

const buildVisionParsedServiceRecord = (text, visionParsedData) => {
  // eslint-disable-next-line no-console
  console.log("👁️ Using pre-parsed Vision data for DD214");
  const vf = visionParsedData.fields;

  const visionData = {
    type: "service_record",
    ..._visionIdentityFields(vf),
    ..._visionServiceFields(vf),
    method: "vision_florence",
    visionConfidence: vf.overallConfidence || 0,
    raw: text.substring(0, 1000),
  };

  // eslint-disable-next-line no-console
  console.log(`✅ Vision-parsed DD214:`, {
    branch: visionData.branch,
    rank: visionData.rank,
    mos: visionData.mos,
    awards: visionData.awards?.length || 0,
  });

  return visionData;
};

const parseDD214Document = async (
  text,
  filename,
  visionParsedData,
  docType,
) => {
  // FIX-3b: carry the document's classified type through as a formType
  // marker on the parsed period ("DD214" | "NGB22" | "DD256" | "DD257").
  // FIX-15: documentClassifier.js's DD214 pattern set (Box labels shared by
  // every DD214-style service-record form) routinely outscores NGB22's
  // narrower pattern set on a real NGB-22 scan, so docType comes back
  // "DD214" even for a genuine NGB-22 - confirmed against the real corpus.
  // A literal "NGB22"/"NGB-22" in the filename is a much stronger signal
  // for the FORM-SPECIFIC parsing behavior selected here (Box 18 date
  // format, Box 1 boilerplate rejection) than for re-scoring the general
  // classifier, and never downgrades an already-correct NGB22/DD256/DD257
  // classification - it only fills the gap when docType is missing or
  // (mis-)landed on the generic "DD214".
  const filenameLooksLikeNGB22 = /ngb[-\s]?22/i.test(filename || "");
  const docTypeIsGenericOrMissing = !docType || docType === "DD214";
  let formType = docType || "DD214";
  if (docTypeIsGenericOrMissing && filenameLooksLikeNGB22) formType = "NGB22";
  // ============================================================
  // VISION-FIRST PARSING (v1.16.4)
  // If Florence-2 Vision already parsed this DD214, use that data!
  // This avoids re-parsing with regex which may fail on vision output.
  // ============================================================
  if (visionParsedData?.fields) {
    const visionParsed = buildVisionParsedServiceRecord(text, visionParsedData);
    visionParsed.formType = visionParsed.formType || formType;
    return visionParsed;
  }

  // Standard path: regex-based parsing
  // Check for multiple DD214s in the document
  const dd214Segments = splitMultipleDD214s(text);

  if (dd214Segments.length > 1) {
    // Multiple DD214s found - use intelligent selection based on filename
    // eslint-disable-next-line no-console
    console.log(
      `🎖️ Found ${dd214Segments.length} DD214s in ${filename} - selecting best match`,
    );

    // Select the DD214 that best matches the filename (e.g., "Williams" in filename)
    const bestSegment = selectBestDD214Segment(dd214Segments, filename);

    if (bestSegment) {
      // Parse just the selected DD214
      const parsed = await parseServiceRecord(bestSegment.text, formType);
      parsed.sourcePages = bestSegment.pages;
      parsed.multiDocument = true;
      parsed.selectedFromCount = dd214Segments.length;
      parsed.selectionReason = bestSegment.matchReason || "filename match";

      // Also store info about other DD214s found (but don't parse them in detail)
      parsed.otherDD214sFound = dd214Segments
        .filter((seg) => seg !== bestSegment)
        .map((seg) => ({
          pages: seg.pages,
          extractedName: extractQuickName(seg.text),
        }));

      // eslint-disable-next-line no-console
      console.log(
        `✅ Selected DD214 from pages ${bestSegment.pages} (${parsed.veteranName || "name TBD"})`,
      );
      return parsed;
    }

    // Fallback: if selection fails, parse first one
    console.warn("⚠️ Selection failed, falling back to first DD214");
    return await parseServiceRecord(dd214Segments[0].text, formType);
  }

  // Single DD214
  return await parseServiceRecord(dd214Segments[0]?.text || text, formType);
};

const parseRatingDecisionDocument = async (text) => {
  // Enhanced: Use new VA Document Parser for Decision Letters
  // eslint-disable-next-line no-console
  console.log("📋 Using enhanced VA Document Parser for Rating Decision...");
  const decisionData = parseDecisionLetter(text);

  // If new parser found data, use it; otherwise fall back to legacy parser
  if (
    decisionData.success &&
    (decisionData.conditions.length > 0 || decisionData.combinedRating)
  ) {
    // eslint-disable-next-line no-console
    console.log(
      `✅ Enhanced parser found ${decisionData.conditions.length} conditions, ${decisionData.combinedRating || "N/A"}% combined`,
    );

    // Also extract the "Big Three" for each condition
    const bigThree = extractBigThree(text);

    return {
      type: "rating_decision",
      ...decisionData,
      bigThree,
      parserVersion: "v1.16.0-enhanced",
    };
  }
  // eslint-disable-next-line no-console
  console.log("⚠️ Enhanced parser found limited data, using legacy parser");
  return await parseRatingDecision(text);
};

const parseDBQDocument = async (text) => {
  // Enhanced: Use new VA Document Parser for DBQs
  // eslint-disable-next-line no-console
  console.log("🩺 Using enhanced VA Document Parser for DBQ...");
  const dbqData = parseDBQReport(text);

  if (dbqData.success && dbqData.diagnosis) {
    // eslint-disable-next-line no-console
    console.log(`✅ Enhanced parser found diagnosis: ${dbqData.diagnosis}`);
    return {
      type: "dbq",
      ...dbqData,
      parserVersion: "v1.16.0-enhanced",
    };
  }
  // eslint-disable-next-line no-console
  console.log("⚠️ Enhanced parser found limited data, using legacy parser");
  return await parseDBQ(text);
};

const buildSegmentedCFileResult = async (text, cFileSummary) => {
  // Full segmentation for large files. No maxSegments override: this passed 100,
  // an order of magnitude below segmentCFile's own 1000 default, while a real
  // 2,018-page C-File segments into 332 document groups - the cap silently
  // discarded roughly two thirds of the file's structure.
  // parseDocuments:false - the mapped return below reads only type/startPage/
  // endPage/confidence/snippet, and the inventory needs no parsed bodies, so
  // the default (true) was parsing all ~332 segments of a real C-File into full
  // VA document objects and discarding every one. That waste is a prime suspect
  // for the renderer dying ~72 min into a 313MB run.
  const segments = segmentCFile(text, { parseDocuments: false });
  // eslint-disable-next-line no-console
  console.log(`✅ Segmented C-File into ${segments.segments.length} documents`);

  // Build inventory from the segmentation just computed. This used to call
  // buildDocumentInventory(text), which re-segments from scratch - a second
  // full pass over a text that is ~3.9M characters for a real C-File.
  const inventory = buildInventoryFromSegmentation(segments);

  // Extract Code Sheet (at END) for current ratings
  const codeSheet = parseCodeSheet(text);

  // Attempt AI-enhanced analysis for potential claims (if AI available)
  let aiAnalysis = null;
  if (isAnyAIAvailable()) {
    try {
      aiAnalysis = await analyzeCFileWithAI(text.substring(0, 50000)); // First 50K chars for context
    } catch (aiErr) {
      console.warn(
        "⚠️ AI C-File analysis failed, continuing with basic parsing:",
        aiErr.message,
      );
    }
  }

  return {
    type: "c_file",
    summary: cFileSummary,
    // segmentCFile emits {id, type, category, position, length, preview,
    // confidence, rawText, parsed} - there is no `text`, and no startPage/
    // endPage has ever existed on a segment. This read `s.text.substring()`
    // (TypeError) and emitted two permanently-undefined page fields; it never
    // surfaced because nothing reached this function until page-count
    // classification started routing real C-Files here.
    segments: segments.segments.map((s) => ({
      type: s.type,
      category: s.category,
      position: s.position,
      length: s.length,
      confidence: s.confidence,
      snippet: s.preview.substring(0, 200),
    })),
    inventory,
    codeSheet: codeSheet.success ? codeSheet : null,
    aiAnalysis, // Include AI-enhanced analysis if available
    parserVersion: "v1.18.3-enhanced",
  };
};

// quickScanCFile() reports detected document TYPES and a page estimate - it has
// never returned a document count. This function previously read
// `.estimatedDocCount` and `.categories`, neither of which exists on that
// object, so the log line threw on `.join()` of undefined and the routing test
// was `undefined > 5` - always false. The segmented path was unreachable for the
// life of the code; it only surfaced once page-count classification started
// routing real C-Files here instead of to parseClaimLetter. A consolidated
// C-File is distinguished by carrying several distinct document types, or by
// simply being long.
const CFILE_SEGMENTATION_MIN_PAGES = 50;

const parseCFileDocument = async (text) => {
  // Enhanced: Use C-File Segmentation for large claim files
  // eslint-disable-next-line no-console
  console.log("📚 Using enhanced C-File Segmentation...");

  // Quick scan to determine file structure
  const cFileSummary = quickScanCFile(text);
  // eslint-disable-next-line no-console
  console.log(
    `📊 C-File scan: ~${cFileSummary.estimatedPages} pages, types: ${cFileSummary.detectedTypes.join(", ") || "none detected"}`,
  );

  // Check if this is actually a large C-File (multi-document)
  const looksConsolidated =
    cFileSummary.detectedTypes.length > 1 ||
    cFileSummary.estimatedPages >= CFILE_SEGMENTATION_MIN_PAGES;
  if (looksConsolidated) {
    return await buildSegmentedCFileResult(text, cFileSummary);
  }

  // Small file - parse as regular medical record
  return await parseMedicalRecord(text);
};

/**
 * Parse document based on its classified type
 * @param {string} text - Raw extracted text
 * @param {string} docType - Document classification type
 * @param {string} filename - Original filename
 * @param {Object} visionParsedData - Pre-parsed data from Florence Vision (optional)
 */
const parseDocumentByType = async (
  text,
  docType,
  filename,
  visionParsedData = null,
) => {
  switch (docType) {
    case DOCUMENT_TYPES.DD214:
    case DOCUMENT_TYPES.NGB22:
    case DOCUMENT_TYPES.DD256:
    case DOCUMENT_TYPES.DD257:
      return await parseDD214Document(
        text,
        filename,
        visionParsedData,
        docType,
      );

    case DOCUMENT_TYPES.RATING_DECISION:
      return await parseRatingDecisionDocument(text);

    case DOCUMENT_TYPES.CLAIM_LETTER:
      return await parseClaimLetter(text);

    case DOCUMENT_TYPES.DBQ:
      return await parseDBQDocument(text);

    case DOCUMENT_TYPES.C_FILE_MEDICAL:
      return await parseCFileDocument(text);

    case DOCUMENT_TYPES.MEDICAL_RECORD:
      return await parseMedicalRecord(text);

    case DOCUMENT_TYPES.NEXUS_LETTER:
      return await parseNexusLetter(text);

    default:
      return { raw: text.substring(0, 1000) };
  }
};

/**
 * Parse DD214 and other service records
 * Extracts all standard DD214 boxes and fields
 * Field names match collectionRules.js expectations
 */
// Module-level: static DD214 parsing data, hoisted out of parseServiceRecord
// so it isn't rebuilt on every call and isn't at risk of being captured by
// only one of the extracted per-box helper functions below.
const ocrFixPatterns = [
  // "CAUTI0N" → "CAUTION"
  [/CAUTI0N/g, "CAUTION"],
  [/N0T\s+T0\s+BE/g, "NOT TO BE"],
  [/IMP0RTANT/g, "IMPORTANT"],
  // "CERT1FICATE" → "CERTIFICATE"
  [/CERT1F1CATE/gi, "CERTIFICATE"],
  [/CERT1FICATE/gi, "CERTIFICATE"],
  [/CERTIF1CATE/gi, "CERTIFICATE"],
  // "DISCH4RGE" → "DISCHARGE"
  [/D1SCHARGE/gi, "DISCHARGE"],
  [/DISCH4RGE/gi, "DISCHARGE"],
  [/DISCHARG3/gi, "DISCHARGE"],
  // "ACT1VE" → "ACTIVE"
  [/ACT1VE/gi, "ACTIVE"],
  [/ACTIV3/gi, "ACTIVE"],
  // "REL3ASE" → "RELEASE"
  [/REL3ASE/gi, "RELEASE"],
  [/RELEAS3/gi, "RELEASE"],
  // "D4TE" → "DATE"
  [/D4TE/gi, "DATE"],
  [/DAT3/gi, "DATE"],
  // "SER1AL" / "SERI4L" → "SERIAL"
  [/SER1AL/gi, "SERIAL"],
  [/SERI4L/gi, "SERIAL"],
  // "S0CIAL" → "SOCIAL"
  [/S0CIAL/gi, "SOCIAL"],
  [/SOCI4L/gi, "SOCIAL"],
  // "SECUR1TY" → "SECURITY"
  [/SECUR1TY/gi, "SECURITY"],
  [/S3CURITY/gi, "SECURITY"],
  // "SEPARAT10N" → "SEPARATION"
  [/SEPARAT10N/gi, "SEPARATION"],
  [/S3PARATION/gi, "SEPARATION"],
  // "GR4DE" → "GRADE"
  [/GR4DE/gi, "GRADE"],
  [/GRAD3/gi, "GRADE"],
  // "N4ME" / "NAM3" → "NAME"
  [/N4ME/gi, "NAME"],
  [/NAM3/gi, "NAME"],
  // "BR4NCH" → "BRANCH"
  [/BR4NCH/gi, "BRANCH"],
  [/8RANCH/gi, "BRANCH"],
  // "SERV1CE" → "SERVICE"
  [/SERV1CE/gi, "SERVICE"],
  [/S3RVICE/gi, "SERVICE"],
  [/SERVIC3/gi, "SERVICE"],
  // "AUTH0RITY" → "AUTHORITY"
  [/AUTH0RITY/gi, "AUTHORITY"],
  [/AUTHORIT¥/gi, "AUTHORITY"],
  // "DECORAT10NS" → "DECORATIONS"
  [/DECORAT10NS/gi, "DECORATIONS"],
  [/DEC0RATIONS/gi, "DECORATIONS"],
  // "HONORAB1E" → "HONORABLE"
  [/HONORAB1E/gi, "HONORABLE"],
  [/H0NORABLE/gi, "HONORABLE"],
  // General patterns - but be careful with context
  // Only fix 0→O in words (not numbers)
  [/\b([A-Z]+)0([A-Z]+)\b/g, "$1O$2"],
  [/\b0([A-Z]{2,})\b/g, "O$1"],
  [/\b([A-Z]{2,})0\b/g, "$1O"],
  // Same 0→O fix as above, but for a single-letter run (e.g. NGB22 Block 15
  // "0R-FSR" - the Oregon National Guard Faithful Service Ribbon's "OR"
  // state prefix OCR'd as "0R"). The {2,} patterns above only fire on 2+
  // letter runs, so a lone letter immediately after/before the 0 needs its
  // own boundary-anchored rule to avoid also matching numeric-only tokens.
  [/\b0([A-Z])\b/g, "O$1"],
  // Fix 1→I in words (not numbers)
  [/\b([A-Z]+)1([A-Z]+)\b/g, "$1I$2"],
  [/\b1([A-Z]{2,})\b/g, "I$1"],
  [/\b([A-Z]{2,})1\b/g, "$1I"],
  // Fix 3→E in words
  [/\b([A-Z]+)3([A-Z]+)\b/g, "$1E$2"],
  [/\b([A-Z])3\b/g, "$1E"],
  // Fix 4→A in words
  [/\b([A-Z]+)4([A-Z]+)\b/g, "$1A$2"],
  // Fix 5→S at word boundaries
  [/\b5([A-Z]{2,})\b/g, "S$1"],
  // Fix 8→B at word boundaries (but not inside MOS codes)
  [/\b8([A-Z]{2,})\b/g, "B$1"],
];
const INSTRUCTIONAL_PATTERNS = [
  /SILVER\s+STAR.*?BRONZE\s+STAR.*?AIR\s+MEDAL/gi, // Example awards list
  /DECORATIONS.*?AWARDED.*?SUCH\s+AS/gi, // "Decorations awarded such as"
  /EXAMPLES?:/gi,
  /\bE\.?G\.?\b/gi,
  /FOR\s+EXAMPLE/gi,
  /INSTRUCTIONS?:/gi,
  /SUCH\s+AS/gi,
  /INCLUDING\s+BUT\s+NOT\s+LIMITED/gi,
  /SEE\s+INSTRUCTIONS/gi,
  // Mixed case phrases are likely instructions (real data is ALL CAPS)
  /[a-z]{3,}/g, // Remove any word with 3+ lowercase letters
];
const DD214_FIELD_LABELS = [
  // Field labels
  "DEPARTMENT",
  "COMPONENT",
  "BRANCH",
  "GRADE",
  "RANK",
  "RATE",
  "SERVICE",
  "SOCIAL",
  "SECURITY",
  "NUMBER",
  "NAME",
  "DATE",
  "BIRTH",
  "PLACE",
  "ENTRY",
  "HOME",
  "RECORD",
  "RESERVE",
  "ACTIVE",
  "DUTY",
  "SEPARATION",
  "AUTHORITY",
  "CODE",
  "MEMBER",
  "COPY",
  "MILITARY",
  "COMMAND",
  "REMARKS",
  "DECORATIONS",
  "MEDALS",
  "BADGES",
  "CITATIONS",
  "CAMPAIGN",
  "RIBBONS",
  "AWARDED",
  "EDUCATION",
  "TRAINING",
  "PRIMARY",
  "SPECIALTY",
  "FOREIGN",
  "SEA",
  "LAST",
  "FIRST",
  "MIDDLE",
  "TYPE",
  "CHARACTER",
  "NARRATIVE",
  "REASON",
  "REENTRY",
  "MEMBER",
  "VETERAN",
  "CERTIFICATE",
  "RELEASE",
  "DISCHARGE",
  // Address components that look like names
  "COUNTY",
  "CITY",
  "STATE",
  "TOWN",
  "VILLAGE",
  "TOWNSHIP",
  "OREGON",
  "WASHINGTON",
  "CALIFORNIA",
  "TEXAS",
  "FLORIDA",
  "LINN",
  "MARION",
  "LANE",
  "POLK",
  "BENTON",
  "CLACKAMAS",
  "MULTNOMAH",
  "JACKSON",
  "DOUGLAS",
  "CLARK",
  "LEWIS",
  // Common location words
  "FORT",
  "CAMP",
  "BASE",
  "AIR",
  "FORCE",
  "NAVAL",
  "STATION",
  // FIX-3b: NGB22 boilerplate ("FOR USE OF THIS FORM, SEE NGR ...") that
  // the loose Box-1 fallback pattern can mistake for a LAST, FIRST name.
  "FORM",
  "SEE",
  "NGR",
  "NGB",
  "USE",
  "THIS",
];
const NAME_EXPANSIONS = {
  CR: ["CRAIG", "CHRISTOPHER", "CRYSTAL"],
  JR: ["JUNIOR", "JAMES"],
  WM: ["WILLIAM"],
  JN: ["JOHN"],
  JS: ["JAMES"],
  RB: ["ROBERT"],
  RD: ["RICHARD"],
  MD: ["MICHAEL", "DAVID"],
  TH: ["THOMAS"],
  ED: ["EDWARD", "EDWIN"],
  GR: ["GREGORY"],
  DN: ["DANIEL"],
  AN: ["ANTHONY"],
};
const INSTRUCTIONAL_AWARDS = [
  "SILVER STAR",
  "BRONZE STAR",
  "AIR MEDAL",
  "PURPLE HEART",
  "DISTINGUISHED FLYING CROSS",
  "ARMY COMMENDATION",
];

// FIX-3a: preprinted DD214 boilerplate that _extractNarrativeAndDeploymentLocations
// and _extractEducationAndRemarks must never treat as a real deployment mention.
const DEPLOYMENT_BOILERPLATE_PATTERNS = [
  /POST-VIETNAM\s+ERA/gi,
  /VIETNAM\s+ERA\s+VETERAN/gi,
  /EDUCATIONAL\s+ASSISTANCE\s+PROGRAM/gi,
];

// Last plausible year a veteran could have served in each named era -
// sanity guard against fabricating a deployment that predates the
// veteran's own birth (or is otherwise chronologically impossible).
const DEPLOYMENT_ERA_LATEST_YEAR = {
  VIETNAM: 1975,
  KOREA: 1953,
};

/**
 * Isolate Box 18 (Remarks) text so deployment/narrative extraction never
 * scans the entire document - the whole-document scan is what let
 * preprinted boilerplate ("POST-VIETNAM ERA VETERAN'S EDUCATIONAL
 * ASSISTANCE PROGRAM") get matched as a real Vietnam deployment.
 * Returns "" (not the full text) if the box can't be reliably isolated -
 * a missed deployment is far cheaper than a fabricated one.
 */
// FIX-12: callers must pass ocrCorrectedUpperText, not raw text - see
// _extractStateCode for the same requirement. A real DD214 scan renders
// "POST-VIETNAM ERA" as "P0ST-VIETNAM ERA", and DEPLOYMENT_BOILERPLATE_PATTERNS
// is letter-only, so stripping boilerplate against the raw text left the
// corrupted phrase in place while the (digit-immune) deployment-country
// matcher below still matched "VIETNAM" inside it, fabricating a deployment.
function _extractBox18RemarksText(ocrCorrectedText) {
  const match = ocrCorrectedText.match(
    // eslint-disable-next-line sonarjs/slow-regex, sonarjs/regex-complexity -- pre-existing (predates this change, unrelated to it); slow-regex verified via adversarial timing test: distinctive literal prefix (or already-bounded quantifier) prevents unanchored-match backtracking blowup at 100k+ chars. regex-complexity is inherent to the multi-alternative field-boundary lookahead this parser depends on; simplifying it is a separate, larger task out of scope here.
    /18\.\s*REMARKS[:\s]*(.+?)(?=\s*19a?\.|\s*20\.|\s*21\.|\s*22\.|\s*23\.\s*TYPE\s+OF\s+SEPARATION|$)/is,
  );
  return match ? match[1] : "";
}

/**
 * Strip known boilerplate phrases out of a Box 18 substring before running
 * deployment/location regexes over it.
 */
function _stripDeploymentBoilerplate(box18Text) {
  let scanText = box18Text;
  for (const pattern of DEPLOYMENT_BOILERPLATE_PATTERNS) {
    scanText = scanText.replace(pattern, " ");
  }
  return scanText;
}

function _parseYearFromDate(dateStr) {
  if (!dateStr) return null;
  const match = String(dateStr).match(/(\d{4})/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function _preprocessDD214Text(text) {
  const upperText = text.toUpperCase();
  let ocrCorrectedUpperText = text;

  // ============================================================
  // DD214 FORM STRUCTURE (Critical for parsing):
  //
  // 1. FIELD LABELS = BOLD ALL CAPS (e.g., "NAME", "GRADE", "DECORATIONS")
  // 2. INSTRUCTIONS = (parenthetic, often lowercase or mixed case)
  //    Example: "(Silver Star, Bronze Star, Air Medal, etc.)"
  // 3. ACTUAL DATA = ALL CAPS, not bold, NOT in parentheses
  //    Example: "WILLIAMS, ROBERT LEE"
  //
  // Key insight: Remove EVERYTHING in parentheses - that's instructional!
  // Then look for ALL CAPS text that's NOT a field label.
  // ============================================================

  let cleanedText = text;

  // ============================================================
  // OCR ERROR CORRECTION
  // Common character substitutions from low-quality scans:
  // - 0 → O (zeros mistaken for letter O)
  // - 1 → I or L (ones mistaken for I or L)
  // - 5 → S (fives mistaken for S)
  // - 8 → B (eights mistaken for B)
  // - $ → S (dollar sign mistaken for S)
  // Only apply to specific DD214 field labels, not numeric data!
  // ============================================================

  // Fix common OCR substitutions in DD214 field labels and keywords

  for (const [pattern, replacement] of ocrFixPatterns) {
    cleanedText = cleanedText.replace(pattern, replacement);
    ocrCorrectedUpperText = ocrCorrectedUpperText.replace(pattern, replacement);
  }
  ocrCorrectedUpperText = ocrCorrectedUpperText.toUpperCase();

  // eslint-disable-next-line no-console
  console.log("🔧 OCR normalization applied to DD214 text");

  // STEP 1: Remove ALL parenthetical content (instructions/examples)
  // This catches "(Silver Star, Bronze Star...)", "(Last, First, Middle)", etc.
  // Excludes "/" from the character class - see ribbonRackData.js's
  // parseDD214Text STEP 1 for why: real DD214/NGB22 award data is always
  // "//"-delimited, and an unclosed instructional paren (some real NGB22
  // OCR scans have one right before Block 15's award list) must not be
  // allowed to greedily span across "//"-delimited award tokens to reach a
  // later, unrelated field's closing ")".
  // eslint-disable-next-line sonarjs/slow-regex -- {0,300} bounds backtracking to O(300n); measured 59ms at 100k unmatched "(" (was 9.1s unbounded)
  cleanedText = cleanedText.replace(/\([^)/]{0,300}\)/g, " ");

  // STEP 2: Remove common instructional phrases (not always in parentheses)
  for (const pattern of INSTRUCTIONAL_PATTERNS) {
    cleanedText = cleanedText.replace(pattern, " ");
  }

  // STEP 3: Clean up multiple spaces
  cleanedText = cleanedText.replace(/\s+/g, " ").trim();
  return { cleanedText, upperText, ocrCorrectedUpperText };
}

function _extractNameField(ctx) {
  const { data, cleanedText } = ctx;
  // === BOX 1: NAME ===
  // Look for name after "1. NAME" heading - the actual veteran name
  // Format is typically: LAST, FIRST MIDDLE or LAST; FIRST MIDDLE
  //
  // CRITICAL: DD214 forms have field LABELS like "DEPARTMENT, COMPONENT AND BRANCH"
  // that look like names (LASTNAME, FIRSTNAME MIDDLE) but are NOT names!
  // Also exclude address components (counties, cities, states) that look like names

  // ============================================================
  // COMMON NAME ABBREVIATIONS TO EXPAND
  // OCR often truncates names - expand common abbreviations
  // ============================================================

  // === BOX 1 NAME EXTRACTION ===
  // CRITICAL: Only extract name from Box 1 area, NOT from addresses (Box 7, 8)
  // Box 1 is always near the top of the document, before "2. DEPARTMENT"

  // First, try to isolate Box 1 content (everything between "1. NAME" and
  // whatever field boundary comes next).
  // FIX-16: anchor forward from "1. NAME" to the NEXT field-number boundary
  // that appears after it, whatever box that happens to be - not
  // specifically "2. DEPARTMENT". A real DD214 scan's linearized OCR text
  // reads the form in column/field order, not printed reading order: "2.
  // DEPARTMENT" (and 3.-7.) routinely appear BEFORE "1. NAME" in the
  // extracted text stream, so the previous fixed "2. DEPARTMENT"/"2. DEPT"
  // lookahead never found one AFTER "1. NAME" and Box 1 extraction failed
  // on every real document sampled, even when the name text was sitting
  // right there in plain sight.
  const nameAnchorMatch = cleanedText.match(/1\.\s*NAME/i);
  // FIX-3b: the DD214 Box 1 anchor always fails on NGB22 (different box
  // structure/label text), which used to fall back to the first 500 chars
  // of the document - that fallback matched NGB22 boilerplate ("FOR USE OF
  // THIS FORM, SEE NGR ...") as a name. No box anchor = no name extraction;
  // returning nothing is far cheaper than returning a wrong name.
  if (!nameAnchorMatch) return;
  const afterAnchor = cleanedText.slice(
    nameAnchorMatch.index + nameAnchorMatch[0].length,
  );
  // A real field boundary looks like "4a GRADE" / "7.a PLACE" / "13.
  // DECORATIONS": 1-2 digits, an optional sub-box letter, an optional dot,
  // then an ALL-CAPS label word. \d{1,2} fails immediately (no match, no
  // backtracking) at every position with no digit, so an adversarial run
  // with no digit at all (or digits never followed by whitespace, as in a
  // real name like "WILLI0AMS") resolves in <5ms at 100k+ chars - verified
  // via adversarial timing test.
  const nextBoundaryMatch = afterAnchor.match(/\d{1,2}[a-z]?\.?\s+[A-Z]{3,}/);
  const box1Body = nextBoundaryMatch
    ? afterAnchor.slice(0, nextBoundaryMatch.index)
    : afterAnchor.slice(0, 300);
  // FIX-14: Box 1 is name-only (SSN is Box 3) and never legitimately
  // contains a numeric "0", so a real scan's digit-for-letter OCR
  // corruption ("WILLI0AMS") can be corrected unconditionally here. The
  // document-wide ocrFixPatterns pass already tries this, but its general
  // \b([A-Z]+)0([A-Z]+)\b rule fires once per word and needs a real word
  // boundary on both sides of the run it replaces - a word with two zeros
  // ("WILLI0AMS") has no boundary between the letters after the first zero
  // and the second zero (both are \w chars), so the whole word is silently
  // skipped. This narrow, name-only substring has no such ambiguity.
  const box1Text = `1. NAME${box1Body}`.replaceAll(/0/g, "O");

  const namePatterns = [
    // "WILLIAMS, ROBERT LEE" or "WILLIAMS; ROBERT LEE" - explicitly after "1. NAME"
    // eslint-disable-next-line sonarjs/slow-regex, sonarjs/regex-complexity -- verified via adversarial timing test: distinctive literal prefix (or already-bounded quantifier) prevents unanchored-match backtracking blowup at 100k+ chars
    /1\.\s*NAME.*?(?:Last.*?First.*?Middle.*?)?[:\s]+([A-Z]{3,})[,;]\s*([A-Z]{3,})(?:\s+([A-Z]+))?/i,
    // Name on line after "1. NAME" label
    /1\.\s*NAME[^\n]*\n\s*([A-Z]{3,})[,;]?\s+([A-Z]{3,})(?:\s+([A-Z]+))?/i,
    // Look for CAPS name with comma in Box 1 area: "WILLIAMS, ROBERT"
    /\b([A-Z]{3,})\s*[,;]\s*([A-Z]{3,})(?:\s+([A-Z]{3,}))?\b/,
  ];

  // Search ONLY in Box 1 area to avoid address contamination (like "LINN COUNTY")
  for (const pattern of namePatterns) {
    const match = box1Text.match(pattern);
    if (match) {
      const potentialLastName = match[1]?.trim().toUpperCase();
      const potentialFirstName = match[2]?.trim().toUpperCase();
      const potentialMiddleName = match[3]?.trim().toUpperCase() || null;

      // === VALIDATION ===
      // Reject if ANY part matches a DD214 field label
      const isFieldLabel = DD214_FIELD_LABELS.some(
        (label) =>
          potentialLastName === label ||
          potentialFirstName === label ||
          potentialMiddleName === label,
      );

      // Reject garbage: too short, or looks like form text
      const isGarbage =
        !potentialLastName ||
        potentialLastName.length < 3 ||
        !potentialFirstName ||
        /^\d+$/.test(potentialLastName) || // Just numbers
        /^(AND|OR|THE|FOR|WITH)$/i.test(potentialFirstName); // Common words

      // FIX-3b: reject a candidate whose matched text sits inside a
      // "FOR USE OF THIS FORM" / "SEE NGR" instructional phrase.
      const matchedSpan = match[0] || "";
      const surroundStart = Math.max(0, match.index - 40);
      const surroundingText = box1Text.substring(
        surroundStart,
        match.index + matchedSpan.length + 40,
      );
      const isFormInstructionPhrase =
        /FOR\s+USE\s+OF\s+THIS\s+FORM/i.test(surroundingText) ||
        /SEE\s+NGR/i.test(surroundingText);

      if (!isFieldLabel && !isGarbage && !isFormInstructionPhrase) {
        _assignParsedName(
          data,
          potentialLastName,
          potentialFirstName,
          potentialMiddleName,
        );
        break;
      }
    }
  }
}

function _assignParsedName(data, lastName, firstName, middleName) {
  data.lastName = lastName;
  data.firstName = firstName;

  // Short first names may be OCR-truncated abbreviations (e.g. "JS" -> James)
  if (firstName && firstName.length <= 2) {
    const expansion = NAME_EXPANSIONS[firstName];
    if (expansion) {
      data.firstNamePossibleExpansions = expansion;
    }
    data.nameNeedsVerification = true;
    console.warn(
      `⚠️ Short first name detected: "${firstName}" - may be OCR abbreviation`,
    );
  }

  data.middleName = middleName;
  data.veteranName = `${lastName}, ${firstName}${middleName ? " " + middleName : ""}`;
}

function _extractBranchField(ctx) {
  const { data, cleanedText } = ctx;
  // === BOX 2: BRANCH/COMPONENT ===
  // Handle abbreviations like ARNGUS, ORARNG, USMC, etc.
  const branchPatterns = [
    // eslint-disable-next-line sonarjs/slow-regex -- verified via adversarial timing test: distinctive literal prefix (or already-bounded quantifier) prevents unanchored-match backtracking blowup at 100k+ chars
    /2\.\s*DEPARTMENT[^:]*[:\s]+([A-Z0-9/\s]+?)(?:\s+3\.|$)/i,
    /COMPONENT\s+AND\s+BRANCH[:\s]+([A-Z0-9/\s]+)/i,
    // Common branch abbreviations
    /\b(ARMY|ARNGUS|ORARNG|[A-Z]{2}ARNG|USAR|USN|USNR|USMC|USMCR|USAF|USAFR|USCG|USCGR|USSF)\b/i,
  ];
  for (const pattern of branchPatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      const branchText = match[1]?.toUpperCase().trim();
      // Detect branch from abbreviations
      if (branchText?.includes("ARMY") || /ARN|USAR/i.test(branchText)) {
        data.branch = "Army";
      } else if (branchText?.includes("NAVY") || /USN/i.test(branchText)) {
        data.branch = "Navy";
      } else if (
        branchText?.includes("AIR FORCE") ||
        /USAF/i.test(branchText)
      ) {
        data.branch = "Air Force";
      } else if (branchText?.includes("MARINE") || /USMC/i.test(branchText)) {
        data.branch = "Marine Corps";
      } else if (
        branchText?.includes("COAST GUARD") ||
        /USCG/i.test(branchText)
      ) {
        data.branch = "Coast Guard";
      } else if (
        branchText?.includes("SPACE FORCE") ||
        /USSF/i.test(branchText)
      ) {
        data.branch = "Space Force";
      }

      // Detect component
      if (branchText?.includes("RESERVE") || /US[A-Z]R\b/.test(branchText)) {
        data.component = "Reserve";
      } else if (
        branchText?.includes("GUARD") ||
        /ARNG|[A-Z]{2}ARNG/.test(branchText)
      ) {
        data.component = "National Guard";
      } else {
        data.component = "Active Duty";
      }
      if (data.branch) break;
    }
  }
}

// Resolves a National Guard state/territory code for state-scoped award
// matching. Kept off the returned `data` object (internal to this parse
// call only) so it doesn't show up as an extra reviewable field in the
// document intelligence UI. Tries, in order: the DD214/NGB22 Box 2 state
// prefix ("ORARNG"), an explicit "NATIONAL GUARD OF ___"/"STATE OF ___"
// field, then falls back to the veteran's own profile state on file.
function _extractStateCode(ctx) {
  // ocrCorrectedUpperText, not upperText: a real NGB22 scan renders Box 2 as
  // "ARNGUS/0RARNG" and its header as "NATI0NAL GUARD 0F 0REG0N", and both
  // regexes below are [A-Z]-based, so they can only match after the
  // ocrFixPatterns 0->O pass has run. upperText is the raw text uppercased.
  const { ocrCorrectedUpperText } = ctx;

  const arngMatch = ocrCorrectedUpperText.match(/\b([A-Z]{2})ARNG\b/);
  if (arngMatch && STATE_AWARD_CODES.has(arngMatch[1])) {
    ctx.stateCode = arngMatch[1];
    return;
  }

  const guardOfMatch = ocrCorrectedUpperText.match(
    /(?:NATIONAL\s+GUARD\s+OF|STATE\s+OF)\s+([A-Z][A-Z\s]{2,30}?)(?=[.,\n]|\s{2}|$)/,
  );
  if (guardOfMatch) {
    const code = STATE_NAME_TO_CODE[guardOfMatch[1].trim()];
    if (code) {
      ctx.stateCode = code;
      return;
    }
  }

  const profileState = (getVeteranProfile().state || "").trim().toUpperCase();
  if (STATE_AWARD_CODES.has(profileState)) {
    ctx.stateCode = profileState;
  }
}

function _extractRankField(ctx) {
  const { data, cleanedText } = ctx;
  // === BOX 4a: RANK/GRADE ===
  // Look for rank specifically in Box 4a context
  const rankPatterns = [
    /4a?\.\s*GRADE.*?RANK[:\s]+([A-Z0-9]{2,6})/i,
    /GRADE.*?RANK[:\s]+([A-Z]{2,4}\d?)/i,
    // Enlisted ranks
    /\b(SPC|SGT|SSG|SFC|MSG|1SG|SGM|CSM|CPL|PFC|PV2|PVT)\b/i,
    // Officer ranks
    /\b(2LT|1LT|CPT|MAJ|LTC|COL|BG|MG|LTG|GEN)\b/i,
    // Navy/CG ranks
    /\b(SN|PO3|PO2|PO1|CPO|SCPO|MCPO|ENS|LTJG|LT|LCDR|CDR|CAPT)\b/i,
  ];
  for (const pattern of rankPatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      const rank = match[1]?.trim().toUpperCase();
      // Validate it's a real rank, not garbage like "AN" or "oe"
      const validRanks = [
        "PVT",
        "PV2",
        "PFC",
        "SPC",
        "CPL",
        "SGT",
        "SSG",
        "SFC",
        "MSG",
        "1SG",
        "SGM",
        "CSM",
        "2LT",
        "1LT",
        "CPT",
        "MAJ",
        "LTC",
        "COL",
        "BG",
        "MG",
        "LTG",
        "GEN",
        "SN",
        "SA",
        "SR",
        "AA",
        "AN",
        "PO3",
        "PO2",
        "PO1",
        "CPO",
        "SCPO",
        "MCPO",
        "ENS",
        "LTJG",
        "LT",
        "LCDR",
        "CDR",
        "CAPT",
      ];
      if (validRanks.includes(rank)) {
        data.rank = rank;
        break;
      }
    }
  }
}

function _extractPayGrade(ctx) {
  const { data, cleanedText } = ctx;
  // Box 4b: Pay Grade - Handle OCR garbling like "Ed" for "E4"
  const payGradePatterns = [
    /4b?\.\s*PAY\s+GRADE[:\s]+([EO]-?\d+)/i,
    /PAY\s+GRADE[:\s]+([EO]-?\d+)/i,
    /\b([EO]-?\d)\b/,
    // OCR might garble E4 as "Ed" or similar
    /\b(E[a-z])\b/gi, // Lowercase letter after E might be garbled number
  ];
  for (const pattern of payGradePatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      let grade = match[1]?.toUpperCase();
      // Attempt to fix OCR garbling: Ed->E4, Eb->E8, etc.
      grade = grade
        ?.replace(/ED$/i, "E4")
        .replace(/EB$/i, "E8")
        .replace(/EG$/i, "E6")
        .replace(/ES$/i, "E5");
      if (grade && /^[EO]-?\d$/.test(grade)) {
        data.payGrade = grade.replace(/([EO])(\d)/, "$1-$2"); // Normalize E4 to E-4
        break;
      }
    }
  }

  // ============================================================
}

function _extractDateOfBirth(ctx) {
  const { data, cleanedText } = ctx;
  // BOX 5: DATE OF BIRTH (NOT Box 6! Box 6 is Reserve Obligation)
  // Common formats: YYYYMMDD, MM/DD/YYYY, DD-MMM-YYYY
  // ============================================================
  const dobPatterns = [
    // Explicit Box 5 reference
    /5\.\s*(?:DATE\s+OF\s+)?BIRTH[:\s]+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
    // "DATE OF BIRTH" label (near start of doc, not near service dates)
    /DATE\s+OF\s+BIRTH[:\s]+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
    // DOB abbreviation
    /\bDOB[:\s]+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
    // Box 5 with compact YYYYMMDD format
    // eslint-disable-next-line sonarjs/slow-regex -- verified via adversarial timing test: distinctive literal prefix (or already-bounded quantifier) prevents unanchored-match backtracking blowup at 100k+ chars
    /5\.\s*\D*(\d{8})\b/i,
  ];
  for (const pattern of dobPatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      let dob = match[1];
      // Convert compact YYYYMMDD to readable format
      if (/^\d{8}$/.test(dob)) {
        const year = dob.substring(0, 4);
        const month = dob.substring(4, 6);
        const day = dob.substring(6, 8);
        // Validate it's a reasonable DOB (year 1940-2010)
        if (Number.parseInt(year) >= 1940 && Number.parseInt(year) <= 2010) {
          dob = `${month}/${day}/${year}`;
        } else {
          // Might be MMDDYYYY format instead
          const altYear = dob.substring(4, 8);
          const altMonth = dob.substring(0, 2);
          const altDay = dob.substring(2, 4);
          if (
            Number.parseInt(altYear) >= 1940 &&
            Number.parseInt(altYear) <= 2010
          ) {
            dob = `${altMonth}/${altDay}/${altYear}`;
          }
        }
      }
      data.dateOfBirth = dob;
      break;
    }
  }

  // ============================================================
}

function _extractServiceStartDate(ctx) {
  const { data, cleanedText } = ctx;
  // BOX 12a: DATE ENTERED AD THIS PERIOD (NOT Box 7!)
  // Box 7 is Place of Entry, NOT date!
  // Common formats: YYYYMMDD (compact), YY | MM | DD (table format)
  // ============================================================
  // FIX-13: the "12a" anchor never matched a real PDF text layer's "12.a."
  // rendering (dot before the sub-box letter, not just after), and the
  // table-format value pattern required a "|", "/", or "-" separator between
  // the year/month/day groups - a real DD214 renders that box as plain
  // whitespace-separated "2002 05 06" with no punctuation at all, so neither
  // ever matched and serviceStartDate came back null even on clean input.
  const entryPatterns = [
    // Explicit Box 12a reference
    /12\.?\s*a\.?\s*(?:DATE\s+)?(?:ENTERED|ENTRY|ENTERED\s+AD)[:\s]+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
    // "DATE ENTERED AD" or "ENTERED ACTIVE DUTY" label
    /DATE\s+ENTERED\s+(?:AD|ACTIVE\s+DUTY)\D*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
    // Box 12a with compact YYYYMMDD
    /12\.?\s*a\.?\D*(\d{8})\b/i,
    // Table format: "2004 | 06 | 22", "04 06 22", or plain whitespace-only
    // "2002 05 06"
    // eslint-disable-next-line sonarjs/regex-complexity -- pre-existing (predates this change, unrelated to it); the repeated (separator|whitespace) alternation is what makes this table-format date matcher tolerant of real OCR spacing variance, simplifying it is a separate, larger task out of scope here
    /12\.?\s*a\.?\D*(\d{2,4})(?:\s*[|/-]\s*|\s+)(\d{2})(?:\s*[|/-]\s*|\s+)(\d{2})\b/i,
    // Fallback: "DATE ENTERED" followed by date anywhere
    /(?:DATE\s+)?ENTERED[:\s]+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
  ];
  for (const pattern of entryPatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      const dateStr = _normalizeDateMatch(match);
      // Sanity check: Entry date should NOT be same as DOB
      if (dateStr !== data.dateOfBirth) {
        data.serviceStartDate = dateStr;
        break;
      }
    }
  }
}

// Normalizes a date regex match to MM/DD/YYYY. Handles two shapes: a
// table-style match with separate year/month/day groups (match[2] &&
// match[3]), and a single-group match that may be compact YYYYMMDD.
function _normalizeDateMatch(match) {
  if (match[2] && match[3]) {
    let year = match[1];
    const month = match[2];
    const day = match[3];
    if (year.length === 2) {
      year = Number.parseInt(year) > 50 ? `19${year}` : `20${year}`;
    }
    return `${month}/${day}/${year}`;
  }

  let dateStr = match[1];
  if (/^\d{8}$/.test(dateStr)) {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    if (Number.parseInt(year) >= 1950 && Number.parseInt(year) <= 2030) {
      dateStr = `${month}/${day}/${year}`;
    }
  }
  return dateStr;
}

// FIX-20: Box 7a is "Place of Entry into Active Duty" - Box 8a/8b are "Last
// Duty Assignment"/"Station Where Separated", a different field entirely.
// The old anchor literally required "8." before the label, so it never
// matched on any real DD214 (confirmed against all 39 real-corpus docs:
// placeOfEntry was empty on every one). Words that only ever appear in this
// box's own instructional boilerplate ("(City and State, or complete
// address if known)") or the neighboring Box 7b (Home of Record) label -
// used to reject a "City, ST"-shaped regex match that's actually boilerplate
// text, not a real place name. Deliberately excludes state abbreviations
// (e.g. "OR" for Oregon) from this list: "OR" is both a real, correct
// two-letter answer AND the boilerplate's own connector word, so only the
// city half of a match is ever checked against it.
const BOX7_PLACE_OF_ENTRY_NOISE_WORDS = new Set([
  "CITY",
  "AND",
  "STATE",
  "AT",
  "TIME",
  "OF",
  "ENTRY",
  "HOME",
  "RECORD",
  "COMPLETE",
  "ADDRESS",
  "IF",
  "KNOWN",
]);

// Same reasoning FIX-16 already applies to the Box 1 name field: this box's
// value is a city/state name, which never legitimately contains a digit, so
// a real scan's digit-for-letter OCR corruption can be corrected
// unconditionally on a candidate match. Box 7b's own "(City and State, or
// complete address if known)" boilerplate is instructional (mixed-case in
// the printed form) rather than a real field label, so it sits OUTSIDE the
// general ocrFixPatterns pass (that pass requires already-uppercase context
// on both sides of a digit to fire) and reaches this function with its
// digit-corruption intact - confirmed against the real corpus, where this
// boilerplate OCR's as "0R C0MPLETE ... ADDRESS IF KN0WN".
function _normalizeOcrLetterDigits(str) {
  return str
    .replaceAll(/0/g, "O")
    .replaceAll(/1/g, "I")
    .replaceAll(/3/g, "E")
    .replaceAll(/4/g, "A")
    .replaceAll(/5/g, "S")
    .replaceAll(/8/g, "B");
}

// Real DD214 scans read the two-column Box 7a/7b layout in scrambled order
// (same root cause as FIX-16's Box 1 name fix) - Box 7a's own label and
// value aren't reliably adjacent, and Box 7b's "(City and State, or complete
// address if known)" boilerplate is sometimes OCR'd with Box 7a's real value
// landing INSIDE what looks like that parenthetical, so this deliberately
// scans ocrCorrectedUpperText (OCR-digit-fixed, uppercased, NOT
// parenthetical-stripped - see _extractBox18RemarksText for why stripping
// parens here would be destructive) for the label, then walks forward
// through every "City, ST"-shaped candidate in a bounded window and takes
// the first one that isn't boilerplate/label text. The character classes
// below admit digits (real scans mix stray digit-for-letter OCR into both
// halves of a candidate, including the state abbreviation itself, e.g.
// "0REG0N") - _normalizeOcrLetterDigits repairs a candidate before it's
// checked against the boilerplate word list or accepted.
// Real US state capitals + the largest-population US metros - used only to
// flag a place-of-entry city as low-confidence, never to reject/replace it.
// A single OCR letter misread can turn a real city into a different-looking
// but still plausible one ("SORTLAND, OREGON" for "PORTLAND, OREGON"); there
// is no way to validate an arbitrary small town against a short list like
// this, so this deliberately only flags the narrow case of a city that is
// exactly one edit away from a well-known city without matching one
// outright - everything else (including real, uncommon small towns) passes
// through unflagged rather than risk false positives.
const PLACE_OF_ENTRY_KNOWN_CITIES = new Set([
  "MONTGOMERY",
  "JUNEAU",
  "PHOENIX",
  "LITTLE ROCK",
  "SACRAMENTO",
  "DENVER",
  "HARTFORD",
  "DOVER",
  "TALLAHASSEE",
  "ATLANTA",
  "HONOLULU",
  "BOISE",
  "SPRINGFIELD",
  "INDIANAPOLIS",
  "DES MOINES",
  "TOPEKA",
  "FRANKFORT",
  "BATON ROUGE",
  "AUGUSTA",
  "ANNAPOLIS",
  "BOSTON",
  "LANSING",
  "SAINT PAUL",
  "JACKSON",
  "JEFFERSON CITY",
  "HELENA",
  "LINCOLN",
  "CARSON CITY",
  "CONCORD",
  "TRENTON",
  "SANTA FE",
  "ALBANY",
  "RALEIGH",
  "BISMARCK",
  "COLUMBUS",
  "OKLAHOMA CITY",
  "SALEM",
  "HARRISBURG",
  "PROVIDENCE",
  "COLUMBIA",
  "PIERRE",
  "NASHVILLE",
  "AUSTIN",
  "SALT LAKE CITY",
  "MONTPELIER",
  "RICHMOND",
  "OLYMPIA",
  "CHARLESTON",
  "MADISON",
  "CHEYENNE",
  "WASHINGTON",
  "NEW YORK",
  "LOS ANGELES",
  "CHICAGO",
  "HOUSTON",
  "PHILADELPHIA",
  "SAN ANTONIO",
  "SAN DIEGO",
  "DALLAS",
  "SAN JOSE",
  "FORT WORTH",
  "JACKSONVILLE",
  "CHARLOTTE",
  "SAN FRANCISCO",
  "SEATTLE",
  "PORTLAND",
  "LAS VEGAS",
  "LOUISVILLE",
  "BALTIMORE",
  "MILWAUKEE",
  "ALBUQUERQUE",
  "TUCSON",
  "FRESNO",
  "MESA",
  "KANSAS CITY",
  "OMAHA",
  "COLORADO SPRINGS",
  "LONG BEACH",
  "VIRGINIA BEACH",
  "OAKLAND",
  "MINNEAPOLIS",
  "TULSA",
  "TAMPA",
  "ARLINGTON",
  "NEW ORLEANS",
  "WICHITA",
  "CLEVELAND",
  "ST LOUIS",
  "PITTSBURGH",
  "ANCHORAGE",
  "NEWARK",
  "ORLANDO",
  "NORFOLK",
  "SPOKANE",
  "EL PASO",
  "MEMPHIS",
  "DETROIT",
]);

// True only when `a`/`b` differ by exactly one single-character
// insertion/deletion/substitution (a bounded, early-exit edit-distance-1
// check - not a full Levenshtein DP, since every candidate here is already
// a short city name).
function _editDistanceIsOne(a, b) {
  if (a === b) return false;
  const lenDiff = a.length - b.length;
  if (lenDiff < -1 || lenDiff > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    edits++;
    if (edits > 1) return false;
    if (lenDiff === 0) {
      i++;
      j++;
    } else if (lenDiff > 0) {
      i++;
    } else {
      j++;
    }
  }
  edits += a.length - i + (b.length - j);
  return edits === 1;
}

function _isPlaceOfEntryLowConfidence(city) {
  if (PLACE_OF_ENTRY_KNOWN_CITIES.has(city)) return false;
  for (const known of PLACE_OF_ENTRY_KNOWN_CITIES) {
    if (_editDistanceIsOne(city, known)) return true;
  }
  return false;
}

function _extractPlaceOfEntry(ctx) {
  const { data, ocrCorrectedUpperText } = ctx;
  const anchorMatch = ocrCorrectedUpperText.match(/PLACE\s+OF\s+ENTRY/);
  if (!anchorMatch) return;
  const windowStart = anchorMatch.index + anchorMatch[0].length;
  const windowText = ocrCorrectedUpperText.slice(
    windowStart,
    windowStart + 300,
  );

  // The city portion is bounded to a single line (a space-only character
  // class, not \s) - real scans routinely place the anchor's trailing
  // words ("INTO ACTIVE DUTY") and the actual value on separate lines, and
  // an \s-based class would lazily cross that newline to fuse them into one
  // bogus multi-word "city".
  // eslint-disable-next-line sonarjs/slow-regex -- verified via adversarial timing test (100k-char no-comma input resolves in <5ms): bounded {1,30} lazy quantifier prevents backtracking blowup
  const cityStatePattern =
    /\b([A-Z][A-Z0-9 .-]{1,30}?),[ \t]*([A-Z0-9]{2,12})\b/g;
  let match;
  while ((match = cityStatePattern.exec(windowText)) !== null) {
    // Periods are stripped (not just excluded from the match) so "ST.
    // LOUIS" normalizes to the same "ST LOUIS" form the known-cities
    // gazetteer and low-confidence check both use; hyphens are kept
    // since they're load-bearing in real city names ("WINSTON-SALEM").
    const city = _normalizeOcrLetterDigits(match[1].trim())
      .replace(/\.+/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const state = _normalizeOcrLetterDigits(match[2].trim());
    const cityWords = city.split(/\s+/);
    const isBoilerplate = cityWords.every((word) =>
      BOX7_PLACE_OF_ENTRY_NOISE_WORDS.has(word),
    );
    if (!isBoilerplate) {
      data.placeOfEntry = `${city}, ${state}`;
      data.placeOfEntryLowConfidence = _isPlaceOfEntryLowConfidence(city);
      break;
    }
  }
}

function _extractPlaceOfEntryAndMOS(ctx) {
  const { data, cleanedText } = ctx;
  _extractPlaceOfEntry(ctx);

  // Box 11: Primary MOS/Specialty (mos) - Handle various formats
  // Examples: "92Y10 UNIT SUPPLY SP", "11B INFANTRY", "0311 RIFLEMAN"
  const mosPatterns = [
    // eslint-disable-next-line sonarjs/slow-regex -- verified via adversarial timing test: distinctive literal prefix (or already-bounded quantifier) prevents unanchored-match backtracking blowup at 100k+ chars
    /11\.\s*PRIMARY\s+SPECIALTY[:\s]+([A-Z0-9]+)[:\s-]*([A-Z\s-]+?)(?:\s+12\.|$)/i,
    // MOS followed by title: "92Y10 UNIT SUPPLY SP" or "92Y UNIT SUPPLY SPECIALIST"
    /\b(\d{2}[A-Z]\d{0,2})\s+([A-Z][A-Z\s]{5,30}(?:SPEC|SP|NCO)?)/i,
    // Marine MOS: 0311, 0341, etc.
    /\b(0[1-9]\d{2})\s+([A-Z][A-Z\s]+)/i,
    // Air Force AFSC: 2A3X1, etc.
    /\b(\d[A-Z]\d[A-Z]\d[A-Z]?)\s+([A-Z][A-Z\s]+)?/i,
    // Navy Rate: BM2, IT1, etc.
    /\b([A-Z]{2,4}\d)\s+([A-Z][A-Z\s]+)?/i,
    // Generic fallback
    /(?:MOS|AFSC|RATE)[:\s]+([A-Z0-9]{2,6})[:\s-]*([A-Z\s-]*)/i,
    /PRIMARY\s+(?:MOS|SPECIALTY)[:\s]+([A-Z0-9]+)/i,
  ];
  for (const pattern of mosPatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      data.mos = match[1]?.trim();
      // Clean up MOS title - remove trailing garbage
      let title = match[2]?.trim();
      if (title) {
        // Remove numbers and noise at end, keep just the job title.
        // \s{1,50} not \s+: title is capped to 50 chars below anyway, and
        // unbounded \s+ before a digit that might never appear is O(n²)
        // on adversarial input (confirmed 3.5s+ at 80k chars).
        // eslint-disable-next-line sonarjs/slow-regex -- verified via adversarial timing test: distinctive literal prefix (or already-bounded quantifier) prevents unanchored-match backtracking blowup at 100k+ chars
        title = title.replace(/\s{1,50}\d+.*$/, "").trim();
        if (title.length >= 5 && title.length <= 50) {
          data.mosTitle = title;
        }
      }
      break;
    }
  }

  // ============================================================
}

function _extractServiceEndDate(ctx) {
  const { data, cleanedText } = ctx;
  // BOX 12b: SEPARATION DATE THIS PERIOD (NOT Box 12a!)
  // Box 12a is Entry Date, Box 12b is Separation Date!
  // Common formats: YYYYMMDD (compact), YY | MM | DD (table format)
  // ============================================================
  // FIX-13: same "12b." vs "12.b." anchor and punctuation-only-separator
  // bugs as _extractServiceStartDate's Box 12a - see that function's
  // comment for the real-document repro that motivated this.
  const separationPatterns = [
    // Explicit Box 12b reference
    /12\.?\s*b\.?\s*(?:DATE\s+)?(?:SEPARATION|RELEASE)[:\s]+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
    // "SEPARATION DATE" or "DATE OF SEPARATION" label
    /SEPARATION\s+DATE\D*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
    /DATE\s+OF\s+(?:SEPARATION|RELEASE)\D*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
    // Box 12b with compact YYYYMMDD
    /12\.?\s*b\.?\D*(\d{8})\b/i,
    // Table format: "2007 | 06 | 29", "07 06 29", or plain whitespace-only
    // "2015 05 30"
    // eslint-disable-next-line sonarjs/regex-complexity -- pre-existing (predates this change, unrelated to it); the repeated (separator|whitespace) alternation is what makes this table-format date matcher tolerant of real OCR spacing variance, simplifying it is a separate, larger task out of scope here
    /12\.?\s*b\.?\D*(\d{2,4})(?:\s*[|/-]\s*|\s+)(\d{2})(?:\s*[|/-]\s*|\s+)(\d{2})\b/i,
  ];
  for (const pattern of separationPatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      const dateStr = _normalizeDateMatch(match);
      // Sanity check: Separation date should be AFTER entry date
      // And should NOT be same as DOB
      if (dateStr !== data.dateOfBirth && dateStr !== data.serviceStartDate) {
        data.serviceEndDate = dateStr;
        break;
      }
    }
  }
}

function _extractServiceTime(ctx) {
  const { data, cleanedText } = ctx;
  // === BOX 12b-d: SERVICE TIME ===
  // CRITICAL: Box 12b is "NET ACTIVE SERVICE THIS PERIOD" - the actual active duty time
  // Box 12c is "TOTAL PRIOR ACTIVE SERVICE" - previous active duty
  // Box 12d is "TOTAL PRIOR INACTIVE SERVICE" - reserve/guard time (not active duty)
  // Box 12e is "FOREIGN SERVICE" - overseas time
  // We need to be VERY specific about which box we're reading

  // Box 12b: NET ACTIVE SERVICE THIS PERIOD (the important one)
  const netActivePatterns = [
    // eslint-disable-next-line sonarjs/slow-regex, sonarjs/regex-complexity -- verified via adversarial timing test: distinctive literal prefix (or already-bounded quantifier) prevents unanchored-match backtracking blowup at 100k+ chars
    /12b\.?\s*NET\s+ACTIVE\s+SERVICE\s+THIS\s+PERIOD[:\s]+(\d{1,2})\s*(?:YR|YEAR)?S?\s*(\d{1,2})\s*(?:MO|MONTH)?S?\s*(\d{1,2})?\s*(?:DAY)?S?/i,
    /NET\s+ACTIVE\s+SERVICE[:\s]+(\d{1,2})\s*(\d{1,2})/i,
    // Look for pattern: "12b. XX YY ZZ" (years months days)
    /12b\.\s*(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})?/i,
  ];
  for (const pattern of netActivePatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      const years = Number.parseInt(match[1]) || 0;
      const months = Number.parseInt(match[2]) || 0;
      const days = Number.parseInt(match[3]) || 0;
      // Sanity check: active duty period should be reasonable (< 40 years)
      if (years < 40 && months <= 12) {
        data.totalActiveService =
          days > 0
            ? `${years} years, ${months} months, ${days} days`
            : `${years} years, ${months} months`;
        break;
      }
    }
  }

  // Box 12c: TOTAL PRIOR ACTIVE SERVICE (previous enlistments)
  const priorActiveMatch = cleanedText.match(
    // eslint-disable-next-line sonarjs/slow-regex -- verified via adversarial timing test: distinctive literal prefix (or already-bounded quantifier) prevents unanchored-match backtracking blowup at 100k+ chars
    /12c\.?\s*(?:TOTAL\s+)?PRIOR\s+ACTIVE[:\s]+(\d{1,2})\s*(?:YR)?S?\s*(\d{1,2})/i,
  );
  if (priorActiveMatch) {
    const years = Number.parseInt(priorActiveMatch[1]) || 0;
    const months = Number.parseInt(priorActiveMatch[2]) || 0;
    if (years > 0 || months > 0) {
      data.totalPriorActiveService = `${years} years, ${months} months`;
    }
  }

  // Box 12d: TOTAL PRIOR INACTIVE SERVICE (reserve/guard time)
  const priorInactiveMatch = cleanedText.match(
    // eslint-disable-next-line sonarjs/slow-regex -- verified via adversarial timing test: distinctive literal prefix (or already-bounded quantifier) prevents unanchored-match backtracking blowup at 100k+ chars
    /12d\.?\s*(?:TOTAL\s+)?PRIOR\s+INACTIVE[:\s]+(\d{1,2})\s*(?:YR)?S?\s*(\d{1,2})/i,
  );
  if (priorInactiveMatch) {
    const years = Number.parseInt(priorInactiveMatch[1]) || 0;
    const months = Number.parseInt(priorInactiveMatch[2]) || 0;
    if (years > 0 || months > 0) {
      data.totalPriorInactiveService = `${years} years, ${months} months`;
    }
  }
}

function _extractAwardsFromBlock13(ctx) {
  const { data, cleanedText, stateCode, ocrCorrectedUpperText } = ctx;
  // === BOX 13: DECORATIONS/MEDALS/AWARDS ===
  // CRITICAL: Only parse Block 13 section, NOT instructional text
  // DD214 forms have INSTRUCTIONAL TEXT listing example awards on the blank form
  // Common instructional awards: Silver Star, Bronze Star, Air Medal, Purple Heart
  // These are NOT the veteran's awards unless they appear WITHOUT the instructional context

  // Awards that commonly appear in DD214 instructions (should be filtered unless clearly real)

  // Look specifically for Block 13 content
  const block13Match = cleanedText.match(
    // eslint-disable-next-line sonarjs/slow-regex, sonarjs/regex-complexity -- verified via adversarial timing test: distinctive literal prefix (or already-bounded quantifier) prevents unanchored-match backtracking blowup at 100k+ chars
    /13\.?\s*DECORATIONS.*?(?:BADGES.*?CITATIONS.*?CAMPAIGN.*?)?[:\s]+(.+?)(?=\s*14\.|15\.|---|\[INSTRUCTION)/is,
  );

  if (block13Match) {
    let block13Text = block13Match[1];

    // FIX-3c: Block 13 sometimes terminates with a continuation marker
    // ("...CONT IN BLOCK 18", with or without a leading "//" delimiter --
    // real scans vary) when the award list overflows into Remarks. Append
    // the isolated Box 18 text so the continued awards still get parsed.
    // Previously required a literal leading "//", which silently dropped
    // the continuation on forms where OCR/the source form omits it.
    if (/(?:\/\/\s*)?CONT(?:INUED)?\s+IN\s+BLOCK\s+18/i.test(block13Text)) {
      const box18Continuation = _extractBox18RemarksText(ocrCorrectedUpperText);
      if (box18Continuation) {
        block13Text = `${block13Text} ${box18Continuation}`;
      }
    }

    // Check if this looks like instructional text
    const hasInstructionalPattern =
      /SILVER\s+STAR.*BRONZE\s+STAR|BRONZE\s+STAR.*AIR\s+MEDAL|SUCH\s+AS|EXAMPLE|E\.G\./i.test(
        block13Text,
      );
    const hasMultipleHighAwards =
      (
        block13Text.match(
          /SILVER\s+STAR|BRONZE\s+STAR|AIR\s+MEDAL|PURPLE\s+HEART/gi,
        ) || []
      ).length >= 3;

    // Only parse if it doesn't look like instructional text
    if (
      block13Text &&
      block13Text.length > 20 &&
      !hasInstructionalPattern &&
      !hasMultipleHighAwards
    ) {
      const parsedAwards = parseDD214Text(
        block13Text,
        data.branch || "Army",
        stateCode,
      );
      if (parsedAwards && parsedAwards.length > 0) {
        // Filter out awards that are likely instructional (high valor awards are rare)
        data.awards = parsedAwards.filter((award) => {
          const awardName =
            award.award?.name?.toUpperCase() ||
            award.matchedText?.toUpperCase() ||
            "";
          // Keep service ribbons, campaign medals, marksmanship - these are common real awards
          // Be skeptical of high valor awards appearing with other instructional patterns
          return (
            !INSTRUCTIONAL_AWARDS.some((ia) => awardName.includes(ia)) ||
            // Unless it's the ONLY high-value award found (might be real)
            parsedAwards.filter((a) =>
              INSTRUCTIONAL_AWARDS.some((ia) =>
                (a.award?.name?.toUpperCase() || "").includes(ia),
              ),
            ).length === 1
          );
        });
      }
    }
  }
}

function _extractAwardsFallback(ctx) {
  const { data, cleanedText, stateCode } = ctx;
  // Fallback: If no awards found in Block 13, look for award patterns in general
  // but be very conservative about what we accept
  if (!data.awards || data.awards.length === 0) {
    // Only parse if we DON'T see ANY classic instructional patterns
    const hasAnyInstructionalText =
      /SILVER\s+STAR.*(?:BRONZE|AIR)|BRONZE\s+STAR.*AIR\s+MEDAL|SUCH\s+AS|EXAMPLE/i.test(
        cleanedText,
      );

    if (!hasAnyInstructionalText) {
      const parsedAwards = parseDD214Text(
        cleanedText,
        data.branch || "Army",
        stateCode,
      );
      if (parsedAwards && parsedAwards.length > 0) {
        // Only keep clearly real awards (service ribbons, qualification badges, etc.)
        data.awards = parsedAwards.filter((award) => {
          const awardName = award.award?.name?.toUpperCase() || "";
          // Service ribbons and campaign medals are almost always real
          return (
            awardName.includes("SERVICE RIBBON") ||
            awardName.includes("CAMPAIGN") ||
            awardName.includes("QUALIFICATION") ||
            awardName.includes("MARKSMAN") ||
            awardName.includes("EXPERT") ||
            awardName.includes("GOOD CONDUCT") ||
            // Or it's explicitly NOT an instructional award
            !INSTRUCTIONAL_AWARDS.some((ia) => awardName.includes(ia))
          );
        });
      }
    }
  }
}

function _extractEducationAndRemarks(ctx) {
  const { data, text, ocrCorrectedUpperText } = ctx;
  // Box 14: Military Education - extract ONLY the structured education portion
  const eduPatterns = [
    // eslint-disable-next-line sonarjs/slow-regex, sonarjs/regex-complexity -- verified via adversarial timing test: distinctive literal prefix (or already-bounded quantifier) prevents unanchored-match backtracking blowup at 100k+ chars
    /14\.\s*MILITARY\s+EDUCATION[^:]*:\s*(.+?)(?=\s*15\s*[.ab]|\s+HIGH\s+SCHOOL)/is,
    // eslint-disable-next-line sonarjs/slow-regex -- verified via adversarial timing test: distinctive literal prefix (or already-bounded quantifier) prevents unanchored-match backtracking blowup at 100k+ chars
    /MILITARY\s+EDUCATION[^:]*:\s*([A-Z\s,0-9]+?(?:WEEKS?|WK|MONTHS?)[^15]*)/is,
  ];
  for (const pattern of eduPatterns) {
    const eduMatch = text.match(pattern);
    if (eduMatch) {
      // Clean up: remove noise, limit length
      let edu = eduMatch[1]?.replace(/\s+/g, " ").trim();
      // Only keep if it looks like actual education (course names, durations)
      if (
        edu &&
        edu.length > 10 &&
        edu.length < 500 &&
        // eslint-disable-next-line sonarjs/slow-regex -- `edu` is already capped to <500 chars by the length check above; measured 2ms worst case at that bound
        /\d+\s*(?:WK|WEEK|MONTH)/i.test(edu)
      ) {
        // Remove trailing noise like NOTHING FOLLOWS
        // eslint-disable-next-line sonarjs/slow-regex -- `edu` is already capped to <500 chars by the length check above; measured 1ms worst case at that bound
        edu = edu.replace(/\s*\/\/\s*NOTHING\s+FOLLOWS.*$/i, "").trim();
        data.militaryEducation = edu;
      }
      break;
    }
  }

  // Box 18: Remarks - Extract only key deployment/service info, not entire text
  // Look for specific valuable info in remarks rather than dumping entire section
  // FIX-3a: scoped to the isolated Box 18 substring only (not the whole
  // document) so preprinted boilerplate elsewhere on the form can't be
  // mistaken for a real deployment/service mention.
  const remarksKeyInfo = [];
  const box18Text = _stripDeploymentBoilerplate(
    _extractBox18RemarksText(ocrCorrectedUpperText),
  );

  if (box18Text) {
    // Check for deployment info
    const deploymentInfo = box18Text.match(
      /(?:SERVED\s+IN|SERVICE\s+IN|DEPLOYED\s+TO)\s+([A-Z][A-Z\s,]+?)(?:\.|\/\/|$)/gi,
    );
    if (deploymentInfo) {
      remarksKeyInfo.push(...deploymentInfo.map((d) => d.trim()));
    }

    // Check for OEF/OIF/OND service
    if (/OPERATION\s+(?:ENDURING|IRAQI|NEW\s+DAWN)/i.test(box18Text)) {
      const opMatch = box18Text.match(
        /(OPERATION\s+(?:ENDURING|IRAQI|NEW\s+DAWN)\s+FREEDOM?)/i,
      );
      if (opMatch) remarksKeyInfo.push(opMatch[1]);
    }
  }

  // Only store remarks if we found valuable info
  if (remarksKeyInfo.length > 0) {
    data.remarks = remarksKeyInfo.join(" | ");
  }
}

function _extractSeparationTypeAndCharacter(ctx) {
  const { data, text } = ctx;
  // Box 23: Type of Separation
  const sepTypeMatch = text.match(
    // eslint-disable-next-line sonarjs/slow-regex -- verified via adversarial timing test: distinctive literal prefix (or already-bounded quantifier) prevents unanchored-match backtracking blowup at 100k+ chars
    /23\.\s*TYPE\s+OF\s+SEPARATION[:\s]+([A-Z\s]+?)(?:\s+24\.|$)/i,
  );
  if (sepTypeMatch) {
    data.separationType = sepTypeMatch[1]?.trim();
  }

  // Box 24: Character of Service - CRITICAL for benefits (dischargeType)
  const characterPatterns = [
    // eslint-disable-next-line sonarjs/slow-regex -- verified via adversarial timing test: distinctive literal prefix (or already-bounded quantifier) prevents unanchored-match backtracking blowup at 100k+ chars
    /24\.\s*CHARACTER\s+OF\s+SERVICE[:\s]+([A-Z\s]+?)(?:\s+25\.|$)/i,
    /CHARACTER\s+OF\s+SERVICE[:\s]+([A-Z\s]+)/i,
    /(HONORABLE|GENERAL|OTHER\s+THAN\s+HONORABLE|DISHONORABLE|BAD\s+CONDUCT)/i,
  ];
  for (const pattern of characterPatterns) {
    const match = text.match(pattern);
    if (match) {
      data.dischargeType = match[1]?.trim();
      break;
    }
  }
}

function _extractSeparationAuthorityAndCodes(ctx) {
  const { data, text } = ctx;
  // Box 25: Separation Authority (regulation)
  const authMatch = text.match(
    // eslint-disable-next-line sonarjs/slow-regex -- verified via adversarial timing test: distinctive literal prefix (or already-bounded quantifier) prevents unanchored-match backtracking blowup at 100k+ chars
    /25\.\s*SEPARATION\s+AUTHORITY[:\s]+([A-Z0-9\s.-]+?)(?:\s+26\.|$)/i,
  );
  if (authMatch) {
    data.separationAuthority = authMatch[1]?.trim();
  }

  // Box 26: SPD Code
  const spdMatch =
    text.match(
      /26\.\s*(?:SEPARATION\s+(?:PROGRAM\s+)?)?(?:DESIGNATOR|CODE)[:\s]+([A-Z]{3})/i,
    ) || text.match(/SPD[:\s]+([A-Z]{3})/i);
  if (spdMatch) {
    data.spdCode = spdMatch[1]?.toUpperCase();
  }

  // Box 27: Reentry Code - Valid RE codes are: RE-1, RE-2, RE-3, RE-4 (with optional letter suffix)
  // Also NA for not applicable
  const rePatterns = [
    /27\.\s*(?:REENTRY|RE)\s+CODE[:\s]*([A-Z0-9-]{1,4})/i,
    /RE\s*CODE[:\s]*([A-Z0-9-]{1,4})/i,
    /\b(RE-?[1-4][A-Z]?|NA)\b/i,
  ];
  for (const pattern of rePatterns) {
    const reMatch = text.match(pattern);
    if (reMatch) {
      const code = reMatch[1]?.toUpperCase().replace(/[^A-Z0-9-]/g, "");
      // Validate it's a real RE code format (RE-1, RE-2A, NA, etc) not OCR garbage
      if (code && /^(?:RE-?[1-4][A-Z]?|NA|[1-4][A-Z]?)$/.test(code)) {
        // Normalize format
        if (/^[1-4][A-Z]?$/.test(code)) {
          data.reentryCode = `RE-${code}`;
        } else if (code === "NA") {
          data.reentryCode = "NA";
        } else {
          data.reentryCode = code.replace(/RE-?/, "RE-");
        }
        break;
      }
    }
  }
}

function _extractNarrativeAndDeploymentLocations(ctx) {
  const { data, text, ocrCorrectedUpperText } = ctx;
  // Box 28: Narrative Reason
  const narrativeMatch = text.match(
    // eslint-disable-next-line sonarjs/slow-regex -- verified via adversarial timing test: distinctive literal prefix (or already-bounded quantifier) prevents unanchored-match backtracking blowup at 100k+ chars
    /28\.\s*NARRATIVE\s+REASON[:\s]+(.+?)(?:\s+29\.|$)/i,
  );
  if (narrativeMatch) {
    data.narrativeReason = narrativeMatch[1]?.trim();
  }

  // FIX-3a (HIGHEST PRIORITY): deployment locations must be scoped to the
  // isolated Box 18 remarks substring, NOT the entire document. Scanning
  // the whole doc previously matched preprinted boilerplate ("POST-VIETNAM
  // ERA VETERAN'S EDUCATIONAL ASSISTANCE PROGRAM") and fabricated a
  // Vietnam deployment. If Box 18 can't be reliably isolated, extract
  // nothing rather than risk a fabrication.
  // FIX-12: isolate against ocrCorrectedUpperText, not raw text - see
  // _extractBox18RemarksText for why (boilerplate stripper and the
  // deployment-country matcher must see the same OCR-corrected text, or a
  // corrupted "P0ST-VIETNAM ERA" slips past the boilerplate strip while the
  // digit-immune "VIETNAM" match still fires below).
  const box18Text = _extractBox18RemarksText(ocrCorrectedUpperText);
  if (!box18Text) return;

  const scanUpper = _stripDeploymentBoilerplate(box18Text).toUpperCase();
  const dobYear = _parseYearFromDate(data.dateOfBirth);

  // Extract deployments from remarks (Box 18) - common locations
  const deploymentPatterns = [
    /(?:SERVICE\s+IN|SERVED\s+IN|DEPLOYED\s+TO)\s+([A-Z][A-Z\s]+?)(?:\.|,|$)/gi,
    /(IRAQ|AFGHANISTAN|KUWAIT|KOREA|VIETNAM|GERMANY|JAPAN)/gi,
  ];
  for (const pattern of deploymentPatterns) {
    let match;
    while ((match = pattern.exec(scanUpper)) !== null) {
      const deployment = match[1]?.trim();
      if (!deployment || data.deployments.includes(deployment)) continue;

      // Sanity guard: reject a deployment whose era ended before the
      // veteran was even born.
      const eraEndYear = DEPLOYMENT_ERA_LATEST_YEAR[deployment];
      if (eraEndYear && dobYear && dobYear >= eraEndYear) continue;

      data.deployments.push(deployment);
    }
  }
}

// FIX-15: 8-digit YYYYMMDD -> MM/DD/YYYY, same convention as every other
// date field parseServiceRecord produces (converted to canonical ISO at the
// saveServiceRecordToProfile write boundary via _toISODateString). Returns
// null instead of fabricating a date when the digits fall outside a
// plausible service-record year range.
function _normalizeCompactDate(yyyymmdd) {
  if (!/^\d{8}$/.test(yyyymmdd)) return null;
  const year = yyyymmdd.substring(0, 4);
  const month = yyyymmdd.substring(4, 6);
  const day = yyyymmdd.substring(6, 8);
  const y = Number.parseInt(year, 10);
  if (y < 1950 || y > 2030) return null;
  return `${month}/${day}/${year}`;
}

// FIX-15: real NGB-22 (Guard) discharge records carry a granular activation
// breakdown in Box 18 that Box 12a/12b (a single date pair) never captures,
// e.g. "IADT: YYYYMMDD-YYYYMMDD//AD: YYYYMMDD-YYYYMMDD//YYYYMMDD-YYYYMMDD//
// YYYYMMDD-YYYYMMDD//" - one IADT window plus several separately-dated AD
// windows. Each "//"-delimited segment inherits the most recently seen
// IADT/AD label. Dates only - no location name is ever present in this
// data, so this never populates a place field.
//
// FIX-18: a real scan OCR's "IADT" as "1A DT" (digit-for-letter plus a
// spurious space) - confirmed against the real corpus, where this exact
// corruption dropped the whole segment (dates included, not just the
// label) because the label match failed and the pre-fix code required a
// resolved component before it would even look at the date range. Every
// segment's label prefix (if it has one - a bare continuation range never
// does, see above) is now run through the same digit-for-letter
// normalization the Box 1 name field and Box 7a place-of-entry field
// already use (labels here never legitimately contain digits either), so
// "1A DT" normalizes to "IADT" and is recognized like any other IADT label.
// A label prefix that STILL doesn't normalize to a known IADT/AD label is
// treated as unknown (component: null) rather than dropped, and rather
// than silently inheriting whatever component the previous segment
// resolved to - symmetric with the IADT case: if "AD" were the one that
// OCR'd unrecognizably instead, silently inheriting a stale "IADT" would
// mislabel real Active Duty service as training. A segment with no colon
// at all (a genuine bare continuation, not a label attempt) still inherits
// the most recently resolved component, same as before this fix.
function _extractNGB22PeriodDates(ctx) {
  const { data, ocrCorrectedUpperText } = ctx;
  if (data.formType !== "NGB22") return;

  const box18Text = _extractBox18RemarksText(ocrCorrectedUpperText);
  if (!box18Text) return;

  const segments = box18Text
    .split("//")
    .map((s) => s.trim())
    .filter(Boolean);

  let currentComponent = null;
  const periods = [];
  for (const segment of segments) {
    // eslint-disable-next-line sonarjs/slow-regex -- verified via adversarial timing test (100k-char no-colon input resolves in <1ms): the bounded {1,15} quantifier prevents backtracking blowup
    const labelPrefixMatch = segment.match(/^([^:]{1,15}):\s*(.*)$/);
    let rest;
    if (labelPrefixMatch) {
      const normalizedLabel = _normalizeOcrLetterDigits(labelPrefixMatch[1])
        .replace(/\s+/g, "")
        .toUpperCase();
      if (normalizedLabel === "AD") {
        currentComponent = "Active Duty";
      } else if (normalizedLabel === "IADT") {
        currentComponent = "IADT";
      } else {
        currentComponent = null;
      }
      rest = labelPrefixMatch[2].trim();
    } else {
      rest = segment;
    }

    const rangeMatch = rest.match(/^(\d{8})\s*-\s*(\d{8})$/);
    if (!rangeMatch) continue;

    const serviceStartDate = _normalizeCompactDate(rangeMatch[1]);
    const serviceEndDate = _normalizeCompactDate(rangeMatch[2]);
    if (!serviceStartDate || !serviceEndDate) continue;

    periods.push({
      component: currentComponent,
      serviceStartDate,
      serviceEndDate,
    });
  }

  if (periods.length > 0) data.additionalPeriods = periods;
}

export const parseServiceRecord = async (text, formType = "DD214") => {
  const data = {
    type: "service_record",
    // FIX-3b: source form type marker ("DD214" | "NGB22" | "DD256" | "DD257")
    formType,
    // ============================================================
    // DD214 FORM BOX STRUCTURE (VERIFIED FROM ACTUAL FORMS):
    // Box 1: Name (Last, first, middle)
    // Box 2: Department, Component, Branch
    // Box 3: Social Security Number (we don't store)
    // Box 4a: Grade/Rank
    // Box 4b: Pay Grade
    // Box 5: Date of Birth ⚠️ NOT Box 6!
    // Box 6: Reserve Obligation Termination Date
    // Box 7a: Place of Entry into Active Duty
    // Box 7b: Home of Record at Time of Entry
    // Box 8a: Last Duty Assignment
    // Box 8b: Station Where Separated
    // Box 11: Primary Specialty (MOS/AFSC/Rate)
    // Box 12a: Date Entered AD This Period ⚠️ Entry Date!
    // Box 12b: Separation Date This Period ⚠️ End Date!
    // Box 12c-e: Service Time calculations
    // Box 13: Decorations, Medals, Badges
    // Box 14: Military Education
    // Box 18: Remarks
    // Box 23: Type of Separation
    // Box 24: Character of Service
    // Box 25: Separation Authority
    // Box 26: SPD Code
    // Box 27: Reentry Code
    // Box 28: Narrative Reason
    // ============================================================

    // Box 1: Name (matches collectionRules: veteranName)
    veteranName: null,
    lastName: null,
    firstName: null,
    middleName: null,
    // Box 2: Department, Component, Branch (matches collectionRules: branch)
    branch: null,
    component: null,
    // Box 4a: Grade/Rate/Rank (matches collectionRules: rank)
    rank: null,
    // Box 4b: Pay Grade
    payGrade: null,
    // Box 5: Date of Birth (matches collectionRules: dateOfBirth)
    dateOfBirth: null,
    // Box 12a: Date Entered AD This Period (matches collectionRules: serviceStartDate)
    serviceStartDate: null,
    // Box 7a: Place of Entry
    placeOfEntry: null,
    // True when placeOfEntry's city is a single-edit-distance OCR-plausible
    // misread of a well-known city (see _isPlaceOfEntryLowConfidence) -
    // hedges the field in the UI without blocking extraction.
    placeOfEntryLowConfidence: false,
    // Box 11: Primary MOS/Specialty (matches collectionRules: mos)
    mos: null,
    mosTitle: null,
    // Box 12b: Separation Date (matches collectionRules: serviceEndDate)
    serviceEndDate: null,
    // Box 12c-e: Service Time
    totalActiveService: null,
    totalPriorActiveService: null,
    totalPriorInactiveService: null,
    foreignService: null,
    seaService: null,
    // Box 13: Decorations, Medals, Badges (parsed awards - matches collectionRules: awards)
    awards: [],
    // Box 14: Military Education (cleaned/validated)
    militaryEducation: null,
    // Box 18: Remarks - extracted key info (deployments, operations)
    remarks: null,
    deployments: [],
    // Box 18 (NGB-22 only): granular IADT/AD activation date ranges - see
    // _extractNGB22PeriodDates. Empty unless this document is an NGB-22 AND
    // Box 18 contains the IADT:/AD: date-range format.
    additionalPeriods: [],
    // Box 23: Type of Separation
    separationType: null,
    // Box 24: Character of Service (matches collectionRules: dischargeType)
    dischargeType: null,
    // Box 25: Separation Authority
    separationAuthority: null,
    // Box 26: Separation Code (SPD)
    spdCode: null,
    // Box 27: Reentry Code
    reentryCode: null,
    // Box 28: Narrative Reason
    narrativeReason: null,
    // Metadata
    raw: text.substring(0, 1000),
  };

  try {
    const { cleanedText, upperText, ocrCorrectedUpperText } =
      _preprocessDD214Text(text);
    const ctx = { data, text, cleanedText, upperText, ocrCorrectedUpperText };

    _extractNameField(ctx);
    _extractBranchField(ctx);
    _extractStateCode(ctx);
    _extractRankField(ctx);
    _extractPayGrade(ctx);
    _extractDateOfBirth(ctx);
    _extractServiceStartDate(ctx);
    _extractPlaceOfEntryAndMOS(ctx);
    _extractServiceEndDate(ctx);
    _extractServiceTime(ctx);
    _extractAwardsFromBlock13(ctx);
    _extractAwardsFallback(ctx);
    _extractEducationAndRemarks(ctx);
    _extractSeparationTypeAndCharacter(ctx);
    _extractSeparationAuthorityAndCodes(ctx);
    _extractNarrativeAndDeploymentLocations(ctx);
    _extractNGB22PeriodDates(ctx);
    // eslint-disable-next-line no-console
    console.log("📋 DD214 parsed fields:", {
      branch: data.branch,
      rank: data.rank,
      mos: data.mos,
      serviceStartDate: data.serviceStartDate,
      serviceEndDate: data.serviceEndDate,
      dischargeType: data.dischargeType,
      awardsCount: data.awards?.length || 0,
      deploymentsCount: data.deployments?.length || 0,
    });

    return data;
  } catch (error) {
    console.error("Service record parsing error:", error);
    return { ...data, error: error.message };
  }
};

/**
 * Parse VA Rating Decision (legacy fallback -- see parseRatingDecisionDocument)
 */
export const parseRatingDecision = async (text) => {
  const data = {
    type: "rating_decision",
    conditions: [],
    combinedRating: null,
    effectiveDate: null,
    decisionDate: null,
    raw: text.substring(0, 500),
  };

  try {
    // Extract combined rating
    // eslint-disable-next-line sonarjs/slow-regex -- verified via adversarial timing test: distinctive literal prefix (or already-bounded quantifier) prevents unanchored-match backtracking blowup at 100k+ chars
    const combinedMatch = text.match(/COMBINED\s+RATING\s*[:=]?\s*(\d+)%?/i);
    if (combinedMatch) {
      data.combinedRating = Number.parseInt(combinedMatch[1]);
    }

    // Extract effective date
    const effectiveDateMatch = text.match(
      // eslint-disable-next-line sonarjs/slow-regex -- verified via adversarial timing test: distinctive literal prefix (or already-bounded quantifier) prevents unanchored-match backtracking blowup at 100k+ chars
      /EFFECTIVE\s+DATE\s*[:=]?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
    );
    if (effectiveDateMatch) {
      data.effectiveDate = effectiveDateMatch[1];
    }

    // Extract decision date
    const decisionDateMatch = text.match(
      // eslint-disable-next-line sonarjs/slow-regex -- verified via adversarial timing test: distinctive literal prefix (or already-bounded quantifier) prevents unanchored-match backtracking blowup at 100k+ chars
      /DECISION\s+DATE\s*[:=]?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
    );
    if (decisionDateMatch) {
      data.decisionDate = decisionDateMatch[1];
    }

    // Extract conditions with diagnostic codes.
    //
    // Security review note: this legacy fallback (only reached when the
    // primary vaDocumentParser.js finds limited data -- see
    // parseRatingDecisionDocument above) originally combined an optional
    // diagnostic-code prefix, an unbounded `[\s\S]{0,200}?` skip, and an
    // unbounded condition-name capture into one regex. `[A-Z][A-Z\s,]+?`
    // immediately adjacent to `[\s-]+` (both match plain spaces) is the
    // same ambiguous-adjacent-quantifier shape fixed elsewhere in this
    // session; confirmed 52s at 30k chars, still 3s+ at 100k after only
    // bounding the name length. Restructured as find-condition-first
    // (name length bounded to a realistic 100 chars) then a bounded
    // backward lookback for a preceding diagnostic code, same technique
    // used in vaDocumentParser.js. Verified identical on realistic
    // "DIAGNOSTIC CODE: NNNN, Condition - NN%"-shaped input; differs from
    // the original only on adversarial/unrealistic input (100+ char gaps
    // between code and name) that doesn't occur in real decision letters,
    // where the original's own behavior was already fragile (it could
    // swallow unrelated prose into the "condition name").
    const CONDITION_PERCENT_RE = /([A-Z][A-Z\s,]{1,100}?)[\s-]+(\d+)%/gi;
    const DIAGNOSTIC_CODE_BEFORE_RE =
      // eslint-disable-next-line sonarjs/slow-regex -- verified via adversarial timing test: distinctive literal prefix (or already-bounded quantifier) prevents unanchored-match backtracking blowup at 100k+ chars
      /DIAGNOSTIC\s+CODE\s*[:=]?\s*(\d{4})\s*$/i;
    const DIAGNOSTIC_CODE_LOOKBACK_WINDOW = 200;

    let match;
    let prevEnd = 0;
    while ((match = CONDITION_PERCENT_RE.exec(text)) !== null) {
      const nameStart = match.index;
      const windowStart = Math.max(
        0,
        nameStart - DIAGNOSTIC_CODE_LOOKBACK_WINDOW,
        prevEnd,
      );
      const dcMatch = text
        .slice(windowStart, nameStart)
        .match(DIAGNOSTIC_CODE_BEFORE_RE);
      prevEnd = nameStart + match[0].length;

      data.conditions.push({
        name: match[1].trim(),
        rating: Number.parseInt(match[2]),
        diagnosticCode: dcMatch ? dcMatch[1] : null,
        serviceConnected: true,
      });
      if (match[0].length === 0) CONDITION_PERCENT_RE.lastIndex++;
    }
  } catch (error) {
    console.error("Rating decision parsing error:", error);
    data.error = error.message;
  }

  return data;
};

/**
 * Extracts per-issue outcome lines from a real VA letter, e.g.:
 * "1. Service connection for tinnitus is granted with an evaluation of
 * 10 percent effective November 1, 2025." / "Evaluation of lumbosacral
 * strain, currently 20 percent disabling, is continued."
 * Reuses the same "is granted/increased/continued/denied" verb convention
 * DecisionDecoder.jsx already validates against real letter phrasing.
 * Processes line-by-line with a bounded, anchored lazy quantifier so a
 * pathological single huge line cannot cause backtracking blowup.
 */
function extractPerIssueDecisions(text) {
  const outcomeRe =
    /^(.{3,120}?)\s+is\s+(granted|denied|continued|increased)\b/i;
  const decisions = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/^\s*\d+[.)]\s*/, "").trim();
    if (!line) continue;

    const match = line.match(outcomeRe);
    if (!match) continue;

    const condition = match[1]
      .replace(/^service connection for\s+/i, "")
      .replace(/^entitlement to\s+/i, "")
      .replace(/^evaluation of\s+/i, "")
      // eslint-disable-next-line sonarjs/slow-regex -- runs on already-bounded (<=120 char) capture group, not raw text
      .replace(/,?\s*currently\s+\d{1,3}\s*percent\s+disabling,?\s*$/i, "")
      .trim();

    const ratingMatch = line.match(/(\d{1,3})\s*percent/i);
    const dateMatch = line.match(
      // eslint-disable-next-line sonarjs/regex-complexity -- verified via adversarial timing test (musterCallProcessor.parseClaimLetter.test.js): both alternation branches use non-overlapping character classes (letters vs digits), so there is no ambiguous backtracking, only a complexity-score count over the alternation/group structure
      /effective\s+([A-Z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}([-/])\d{1,2}\2\d{2,4})/i,
    );

    decisions.push({
      condition,
      outcome: match[2].toLowerCase(),
      rating: ratingMatch ? Number(ratingMatch[1]) : null,
      effectiveDate: dateMatch ? dateMatch[1] : null,
    });
  }

  return decisions;
}

/**
 * Parse VA Claim Letter - covers the real, broad CLAIM_LETTER category
 * (documentClassifier.js): development/evidence-request letters, Intent to
 * File acknowledgments, exam-scheduling notices, and decision/award letters
 * that don't hit the stricter RATING_DECISION triggers. Real letters use
 * prose ("We received your claim... on [date]", "What we need from you",
 * "You have 30 days to respond") rather than the "CLAIM NUMBER:"/
 * "CONTENTIONS:" intake-form labels the previous version looked for.
 */
export const parseClaimLetter = async (text) => {
  const data = {
    type: "claim_letter",
    claimNumber: null,
    claimDate: null,
    letterDate: null,
    decisions: [],
    evidenceNeeded: [],
    responseDeadlineDays: null,
    status: null,
    raw: text.substring(0, 500),
  };

  try {
    // VA file/claim number - real letters use several equivalent labels
    const fileNumMatch = text.match(
      // eslint-disable-next-line sonarjs/slow-regex -- verified via adversarial timing test: distinctive literal prefix (or already-bounded quantifier) prevents unanchored-match backtracking blowup at 100k+ chars
      /(?:VA\s+FILE\s+NUMBER|C-FILE\s+NUMBER|FILE\s+NUMBER|CLAIM\s+NUMBER)\s*[:#]?\s*(\d[\d-]{6,14})/i,
    );
    if (fileNumMatch) {
      data.claimNumber = fileNumMatch[1];
    }

    // Claim-received date ("We received your claim ... on November 1, 2025")
    const receivedMatch = text.match(
      // eslint-disable-next-line sonarjs/slow-regex, sonarjs/regex-complexity -- verified via adversarial timing test: bounded filler ({0,80}) between anchors prevents backtracking blowup; both date-alternation branches use non-overlapping character classes
      /RECEIVED\s+YOUR\s+CLAIM[^.\n]{0,80}?\bON\s+([A-Z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}([-/])\d{1,2}\2\d{2,4})/i,
    );
    if (receivedMatch) {
      data.claimDate = receivedMatch[1];
    } else {
      // Fall back to the old intake-form label for backward compatibility
      const claimDateMatch = text.match(
        // eslint-disable-next-line sonarjs/slow-regex -- verified via adversarial timing test: distinctive literal prefix (or already-bounded quantifier) prevents unanchored-match backtracking blowup at 100k+ chars
        /(?:DATE\s+OF\s+CLAIM|CLAIM\s+DATE)\s*[:=]?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
      );
      if (claimDateMatch) {
        data.claimDate = claimDateMatch[1];
      }
    }

    // Letter's own issue date (only trust an explicit "Date:" label to avoid
    // false-positives on unrelated dates elsewhere in the letter)
    const letterDateMatch = text.match(
      // eslint-disable-next-line sonarjs/slow-regex, sonarjs/regex-complexity -- verified via adversarial timing test: anchored to start-of-line (^ with /m) with a literal "Date" prefix; both date-alternation branches use non-overlapping character classes
      /^\s*Date\s*[:.]?\s*([A-Z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}([-/])\d{1,2}\2\d{2,4})/im,
    );
    if (letterDateMatch) {
      data.letterDate = letterDateMatch[1];
    }

    // Per-issue grant/deny/continue outcomes (decision-bearing letters)
    data.decisions = extractPerIssueDecisions(text);

    // Evidence-request section (development letters)
    const evidenceSectionMatch = text.match(
      // eslint-disable-next-line sonarjs/slow-regex, sonarjs/regex-complexity -- verified via adversarial timing test: bounded body ({0,800}) lazily matched up to a blank line or end
      /(?:WHAT\s+WE\s+NEED\s+FROM\s+YOU|EVIDENCE\s+(?:WE\s+)?NEED(?:ED)?|WE\s+NEED\s+THE\s+FOLLOWING)\s*[:.]?\s*([\s\S]{0,800}?)(?:\n\s*\n|\r\n\s*\r\n|$)/i,
    );
    if (evidenceSectionMatch) {
      data.evidenceNeeded = evidenceSectionMatch[1]
        .split(/\r?\n/)
        .map((line) => line.replace(/^[\s•\-*]+/, "").trim())
        .filter((line) => line.length > 3 && !line.endsWith(":"));
    }

    // Response deadline ("you have 30 days", "respond within 60 days")
    const deadlineMatch = text.match(
      /(?:you\s+have|within|respond(?:\s+by)?)\s+(\d{1,3})\s+days/i,
    );
    if (deadlineMatch) {
      data.responseDeadlineDays = Number(deadlineMatch[1]);
    }

    // Overall status derived from the real signals above, not a bare
    // PENDING/APPROVED/DENIED keyword scan (those words rarely appear
    // standalone in real letters).
    const grantedCount = data.decisions.filter((d) =>
      ["granted", "increased", "continued"].includes(d.outcome),
    ).length;
    const deniedCount = data.decisions.filter(
      (d) => d.outcome === "denied",
    ).length;

    if (grantedCount > 0 && deniedCount > 0) {
      data.status = "mixed";
    } else if (grantedCount > 0) {
      data.status = "granted";
    } else if (deniedCount > 0) {
      data.status = "denied";
    } else if (
      data.evidenceNeeded.length > 0 ||
      /PENDING|IN\s+PROGRESS|UNDER\s+REVIEW/i.test(text)
    ) {
      data.status = "pending";
    }
  } catch (error) {
    console.error("Claim letter parsing error:", error);
    data.error = error.message;
  }

  return data;
};

/**
 * Parse DBQ (Disability Benefits Questionnaire)
 */
const parseDBQ = async (text) => {
  const data = {
    type: "dbq",
    condition: null,
    diagnosis: null,
    nexusOpinion: null,
    examDate: null,
    examiner: null,
    raw: text.substring(0, 500),
  };

  try {
    // Extract condition name
    const conditionMatch = text.match(/DBQ\s+FOR\s+([A-Z][A-Z\s]+?)(?:\n|$)/i);
    if (conditionMatch) {
      data.condition = conditionMatch[1].trim();
    }

    // Extract diagnosis
    const diagnosisMatch = text.match(
      // eslint-disable-next-line sonarjs/slow-regex -- verified via adversarial timing test: distinctive literal prefix (or already-bounded quantifier) prevents unanchored-match backtracking blowup at 100k+ chars
      /DIAGNOSIS\s*[:=]?\s*([\s\S]{0,300}?)(?:\n\n|\r\n\r\n)/i,
    );
    if (diagnosisMatch) {
      data.diagnosis = diagnosisMatch[1].trim();
    }

    // Extract nexus opinion
    if (/MORE\s+LIKELY\s+THAN\s+NOT/i.test(text)) {
      data.nexusOpinion = "more_likely_than_not";
    } else if (/AS\s+LIKELY\s+AS\s+NOT/i.test(text)) {
      data.nexusOpinion = "as_likely_as_not";
    } else if (/LESS\s+LIKELY\s+THAN\s+NOT/i.test(text)) {
      data.nexusOpinion = "less_likely_than_not";
    }

    // Extract exam date
    const examDateMatch = text.match(
      // eslint-disable-next-line sonarjs/slow-regex -- verified via adversarial timing test: distinctive literal prefix (or already-bounded quantifier) prevents unanchored-match backtracking blowup at 100k+ chars
      /EXAMINATION\s+DATE\s*[:=]?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
    );
    if (examDateMatch) {
      data.examDate = examDateMatch[1];
    }
  } catch (error) {
    console.error("DBQ parsing error:", error);
    data.error = error.message;
  }

  return data;
};

/**
 * Parse medical records from C-File
 */
const parseMedicalRecord = async (text) => {
  const data = {
    type: "medical_record",
    diagnoses: [],
    treatments: [],
    medications: [],
    dateOfService: null,
    provider: null,
    raw: text.substring(0, 500),
  };

  try {
    // Extract date of service
    const dateMatch = text.match(
      // eslint-disable-next-line sonarjs/slow-regex -- verified via adversarial timing test: distinctive literal prefix (or already-bounded quantifier) prevents unanchored-match backtracking blowup at 100k+ chars
      /(?:DATE\s+OF\s+SERVICE|VISIT\s+DATE)\s*[:=]?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
    );
    if (dateMatch) {
      data.dateOfService = dateMatch[1];
    }

    // Extract diagnoses (ICD codes)
    const icdPattern =
      // eslint-disable-next-line sonarjs/slow-regex, sonarjs/regex-complexity -- verified via adversarial timing test: distinctive literal prefix (or already-bounded quantifier) prevents unanchored-match backtracking blowup at 100k+ chars
      /(?:ICD-?\d{1,2}\s*[:=]?\s*)?([A-Z]\d{2}(?:\.\d{1,2})?)\s+[-–—]\s+([A-Za-z\s,]+)/g;
    let match;
    while ((match = icdPattern.exec(text)) !== null) {
      data.diagnoses.push({
        code: match[1],
        description: match[2].trim(),
      });
    }
  } catch (error) {
    console.error("Medical record parsing error:", error);
    data.error = error.message;
  }

  return data;
};

/**
 * Parse nexus letter
 */
const parseNexusLetter = async (text) => {
  const data = {
    type: "nexus_letter",
    condition: null,
    opinion: null,
    rationale: null,
    provider: null,
    raw: text.substring(0, 500),
  };

  try {
    // Extract nexus opinion strength
    if (/MORE\s+LIKELY\s+THAN\s+NOT/i.test(text)) {
      data.opinion = "more_likely_than_not";
    } else if (/AS\s+LIKELY\s+AS\s+NOT/i.test(text)) {
      data.opinion = "as_likely_as_not";
    }

    // Extract provider info
    const providerMatch = text.match(
      // eslint-disable-next-line sonarjs/slow-regex -- verified via adversarial timing test: distinctive literal prefix (or already-bounded quantifier) prevents unanchored-match backtracking blowup at 100k+ chars
      /(?:Sincerely|Respectfully),?\s*\n\s*([A-Z][A-Z\s.]+,?\s+M\.?D\.?)/i,
    );
    if (providerMatch) {
      data.provider = providerMatch[1].trim();
    }
  } catch (error) {
    console.error("Nexus letter parsing error:", error);
    data.error = error.message;
  }

  return data;
};

/**
 * Process multiple documents in batch with parallel processing
 */
const runConcurrentDocumentProcessing = async (
  validFiles,
  { signal, onProgress, maxConcurrent },
) => {
  const results = [];
  const queue = [...validFiles];
  let completed = 0;
  let processing = 0;

  onProgress?.({
    state: PROCESSING_STATES.LOADING,
    total: queue.length,
    completed: 0,
    processing: 0,
  });

  // Process files with concurrency limit
  const processNext = async () => {
    // Check for abort signal
    if (signal?.aborted) {
      throw new DOMException("Processing aborted", "AbortError");
    }

    if (queue.length === 0) return null;

    const file = queue.shift();
    processing++;

    try {
      const result = await processSingleDocument(file, (fileProgress) => {
        onProgress?.({
          ...fileProgress,
          total: validFiles.length,
          completed,
          processing,
        });
      });

      processing--;
      completed++;
      results.push(result);

      onProgress?.({
        state: PROCESSING_STATES.LOADING,
        total: validFiles.length,
        completed,
        processing,
      });

      return result;
    } catch (error) {
      // Catch any errors that slip through processSingleDocument
      console.error(`Failed to process ${file.name}:`, error);
      processing--;
      completed++;

      // Add error result
      results.push({
        filename: file.name,
        status: "error",
        error: error.message || "Unknown error",
        fileSize: file.size,
      });

      onProgress?.({
        state: PROCESSING_STATES.ERROR,
        total: validFiles.length,
        completed,
        processing,
        filename: file.name,
        error: error.message,
      });

      return null;
    }
  };

  // Start processing with concurrency limit
  const workers = [];
  for (let i = 0; i < Math.min(maxConcurrent, validFiles.length); i++) {
    workers.push(
      (async () => {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          if (queue.length === 0) {
            if (processing === 0) break;
            await new Promise((resolve) => setTimeout(resolve, 100));
            continue;
          }
          const result = await processNext();
          if (result === null && queue.length === 0) break;
        }
      })(),
    );
  }

  await Promise.all(workers);
  return results;
};

const mergeClassificationIntoResults = (results, classified) => {
  results.forEach((result, index) => {
    const classifiedDoc = classified.grouped[
      Object.keys(classified.grouped).find((key) =>
        classified.grouped[key].some((d) => d.index === index),
      )
    ]?.find((d) => d.index === index);

    if (classifiedDoc) {
      result.classification = classifiedDoc.classification;
    }
  });
};

const buildBatchSummary = (validation, results) => ({
  totalFiles: validation.valid.length,
  totalSize: validation.totalSize,
  successful: results.filter((r) => r.status === "complete").length,
  failed: results.filter((r) => r.status === "error").length,
  processingTime: results.reduce((sum, r) => sum + r.processingTime, 0),
});

export const processMusterCallBatch = async (files, options = {}) => {
  const {
    onProgress,
    onComplete,
    signal, // AbortSignal from abort controller
    maxConcurrent = 3, // Process 3 files at a time to avoid memory issues
  } = options;

  // Check if already aborted
  if (signal?.aborted) {
    throw new DOMException("Processing aborted", "AbortError");
  }

  // Validation
  const validation = validateFilesBatch(files);
  if (validation.errors.length > 0 || validation.valid.length === 0) {
    return {
      success: false,
      validation,
      results: [],
    };
  }

  const results = await runConcurrentDocumentProcessing(validation.valid, {
    signal,
    onProgress,
    maxConcurrent,
  });

  // Classify and group results
  onProgress?.({
    state: PROCESSING_STATES.CLASSIFYING,
    total: results.length,
    completed: results.length,
  });

  const classified = classifyDocumentBatch(
    results.map((r) => ({ text: r.text, filename: r.filename })),
  );

  mergeClassificationIntoResults(results, classified);

  onComplete?.({
    results,
    classified,
    validation,
  });

  return {
    success: true,
    validation,
    results,
    classified,
    summary: buildBatchSummary(validation, results),
  };
};

// FIX-9: parseServiceRecord (this file) emits serviceStartDate/
// serviceEndDate/dischargeType. dd214FieldExtractor.js legitimately emits
// entryDate/separationDate/characterOfService for the same concepts.
// applyServiceRecordToProfileUpdates previously only read the second set,
// so every conditional was false whenever the data came from
// parseServiceRecord - the profile silently never got auto-populated.
// Accept both naming conventions.
const applyServiceRecordToProfileUpdates = (updates, extractedData) => {
  // eslint-disable-next-line no-console
  console.log("📝 Found service record, extracting data:", extractedData);

  // FIX-17: extractedData.veteranName/lastName/firstName/middleName were
  // extracted correctly (see _assignParsedName) but never mapped onto the
  // profile update at all, so the Profile tab's First/Last Name fields
  // stayed empty for every Muster Call bulk import regardless of OCR
  // quality.
  if (extractedData.veteranName) updates.fullName = extractedData.veteranName;
  if (extractedData.lastName) updates.lastName = extractedData.lastName;
  if (extractedData.firstName) updates.firstName = extractedData.firstName;
  if (extractedData.middleName) updates.middleName = extractedData.middleName;

  if (extractedData.branch) updates.branch = extractedData.branch;

  const entryDate = extractedData.serviceStartDate || extractedData.entryDate;
  if (entryDate) updates.serviceStartDate = entryDate;

  const separationDate =
    extractedData.serviceEndDate || extractedData.separationDate;
  if (separationDate) updates.serviceEndDate = separationDate;

  if (extractedData.mos) updates.mos = extractedData.mos;
  if (extractedData.mosTitle) updates.mosTitle = extractedData.mosTitle;

  const characterOfService =
    extractedData.dischargeType || extractedData.characterOfService;
  if (characterOfService) updates.characterOfService = characterOfService;

  if (extractedData.separationType)
    updates.separationType = extractedData.separationType;
};

const applyRatingDecisionToProfileUpdates = (updates, extractedData) => {
  // eslint-disable-next-line no-console
  console.log("📊 Found rating decision, extracting data:", extractedData);
  if (extractedData.combinedRating)
    updates.currentCombinedRating = extractedData.combinedRating;
  if (extractedData.effectiveDate)
    updates.effectiveDate = extractedData.effectiveDate;
};

const applyClaimLetterToProfileUpdates = (updates, extractedData) => {
  // eslint-disable-next-line no-console
  console.log("📬 Found claim letter, extracting data:", extractedData);
  if (extractedData.claimNumber)
    updates.claimNumber = extractedData.claimNumber;
};

/**
 * Auto-populate veteran profile from processed documents.
 *
 * FIX-9 overwrite semantics: fill-if-empty; if a field is non-empty and
 * was never user-edited (profileFieldSources[field] !== "user"), document
 * data may keep refining it; if the veteran has manually edited a field,
 * it is NEVER overwritten - a conflict is surfaced instead so the UI can
 * show "your document says X, your profile says Y".
 */
// eslint-disable-next-line max-lines-per-function -- pre-existing (predates this change, unrelated to it); this is the single fill-if-empty/never-overwrite-user-edited pass over every document type (service record, rating decision, claim letter) plus conflict tracking - splitting it apart is a separate, larger task out of scope here
export const autoPopulateProfile = async (processedResults) => {
  // eslint-disable-next-line no-console
  console.log("📋 Auto-populate Profile starting...");
  // eslint-disable-next-line no-console
  console.log("📊 Total results to process:", processedResults?.length);

  const currentProfile = getVeteranProfile();
  const fieldSources = { ...(currentProfile.profileFieldSources || {}) };
  const updates = { ...currentProfile };
  const conflicts = [];

  let updateCount = 0;

  for (const result of processedResults) {
    // eslint-disable-next-line no-console
    console.log(`📄 Checking ${result.filename}:`, {
      status: result.status,
      hasExtractedData: !!result.extractedData,
      extractedDataType: result.extractedData?.type,
      classification: result.classification?.type,
    });

    if (result.status !== "complete" || !result.extractedData) {
      // eslint-disable-next-line no-console
      console.log(
        `⏭️ Skipping ${result.filename} - status: ${result.status}, hasData: ${!!result.extractedData}`,
      );
      continue;
    }

    const { type } = result.extractedData;
    // eslint-disable-next-line no-console
    console.log(`🔍 Processing ${result.filename} with type: ${type}`);

    const documentUpdates = {};
    switch (type) {
      case "service_record":
        applyServiceRecordToProfileUpdates(
          documentUpdates,
          result.extractedData,
        );
        updateCount++;
        break;

      case "rating_decision":
        applyRatingDecisionToProfileUpdates(
          documentUpdates,
          result.extractedData,
        );
        updateCount++;
        break;

      case "claim_letter":
        applyClaimLetterToProfileUpdates(documentUpdates, result.extractedData);
        updateCount++;
        break;

      default:
        // eslint-disable-next-line no-console
        console.log(`⚠️ Unknown document type: ${type} for ${result.filename}`);
        continue;
    }

    Object.keys(documentUpdates).forEach((field) => {
      const newValue = documentUpdates[field];
      if (newValue === undefined || newValue === null || newValue === "") {
        return;
      }
      const currentValue = updates[field];
      const isUserEdited = fieldSources[field] === "user";

      // Fill whenever the field is still empty, or it was never
      // user-edited (a later document may keep refining it). Only a
      // populated, user-edited field is protected - and even then, a
      // genuine conflict is surfaced rather than silently dropped.
      if (isUserEdited && currentValue) {
        if (String(currentValue) !== String(newValue)) {
          conflicts.push({
            field,
            profileValue: currentValue,
            documentValue: newValue,
            source: result.filename,
          });
        }
      } else {
        updates[field] = newValue;
        fieldSources[field] = "document";
      }
    });
  }

  updates.profileFieldSources = fieldSources;

  // Persist newly-found conflicts onto the profile itself (append to
  // whatever's already pending, capped so a veteran who never visits the
  // Profile tab to dismiss them can't grow this unboundedly) so MyPacket's
  // Profile tab can surface them -- this array previously had zero
  // consumers anywhere, so a real conflict (manual edit vs. re-imported
  // document) was silently invisible even though the underlying
  // never-overwrite protection above was already working correctly.
  if (conflicts.length > 0) {
    updates.pendingProfileConflicts = [
      ...(currentProfile.pendingProfileConflicts || []),
      ...conflicts,
    ].slice(-50);
  }

  // eslint-disable-next-line no-console
  console.log(`📊 Auto-populate complete: ${updateCount} documents processed`);
  // eslint-disable-next-line no-console
  console.log("📝 Profile updates:", updates);

  if (updateCount > 0) {
    const success = updateVeteranProfile(updates);
    // eslint-disable-next-line no-console
    console.log(`✅ Profile update ${success ? "successful" : "failed"}`);
    return { success, updates, count: updateCount, conflicts };
  }

  // eslint-disable-next-line no-console
  console.log("⚠️ No profile updates made");
  return { success: false, updates: {}, count: 0, conflicts: [] };
};

const applyServiceRecordToBriefing = (briefingData, serviceData) => {
  // eslint-disable-next-line no-console
  console.log("📝 Extracting service record:", serviceData);

  // Handle array-structured data (indexed 0, 1, 2, etc.)
  if (serviceData[0]) {
    // Data is in numbered keys
    Object.keys(serviceData).forEach((key) => {
      if (!Number.isNaN(Number(key)) && serviceData[key]) {
        const entry = serviceData[key];
        if (entry.branch) briefingData.branch = entry.branch;
        if (entry.entryDate) briefingData.serviceStart = entry.entryDate;
        if (entry.separationDate)
          briefingData.serviceEnd = entry.separationDate;
        if (entry.mos) briefingData.mos = entry.mos;
        if (entry.mosTitle) briefingData.mosTitle = entry.mosTitle;
        if (entry.characterOfService)
          briefingData.characterOfService = entry.characterOfService;
      }
    });
  } else {
    // Direct field structure
    if (serviceData.branch) briefingData.branch = serviceData.branch;
    if (serviceData.entryDate)
      briefingData.serviceStart = serviceData.entryDate;
    if (serviceData.separationDate)
      briefingData.serviceEnd = serviceData.separationDate;
    if (serviceData.mos) briefingData.mos = serviceData.mos;
    if (serviceData.mosTitle) briefingData.mosTitle = serviceData.mosTitle;
    if (serviceData.characterOfService)
      briefingData.characterOfService = serviceData.characterOfService;
  }
};

const applyRatingDecisionToBriefing = (briefingData, extractedData) => {
  // eslint-disable-next-line no-console
  console.log("📊 Extracting rating decision:", extractedData);
  if (extractedData.combinedRating) {
    briefingData.currentCombinedRating = extractedData.combinedRating;
  }
  if (extractedData.conditions && Array.isArray(extractedData.conditions)) {
    extractedData.conditions.forEach((condition) => {
      // Check if condition already exists
      const exists = briefingData.conditions.find(
        (c) => c.name?.toLowerCase() === condition.name?.toLowerCase(),
      );
      if (!exists && condition.name) {
        briefingData.conditions.push({
          name: condition.name,
          rating: condition.rating || null,
          diagnosticCode: condition.diagnosticCode || null,
          effectiveDate:
            condition.effectiveDate || extractedData.effectiveDate || null,
        });
      }
    });
  }
};

const applyClaimLetterToBriefing = (briefingData, extractedData) => {
  // eslint-disable-next-line no-console
  console.log("📬 Extracting claim letter:", extractedData);
  if (
    extractedData.claimNumber &&
    !briefingData.claimNumbers.includes(extractedData.claimNumber)
  ) {
    briefingData.claimNumbers.push(extractedData.claimNumber);
  }
};

/**
 * Extract and consolidate data for Intelligence Briefing
 * Transforms processed document results into structured data for review
 */
export const extractIntelligenceBriefingData = (processedResults) => {
  // eslint-disable-next-line no-console
  console.log("📋 Extracting Intelligence Briefing data...");

  const briefingData = {
    // Personal Information
    fullName: null,
    dob: null,
    ssnLast4: null,
    vaFileNumber: null,

    // Service History
    branch: null,
    serviceStart: null,
    serviceEnd: null,
    characterOfService: null,
    mos: null,
    mosTitle: null,

    // Ratings & Claims
    currentCombinedRating: null,
    conditions: [],
    claimNumbers: [],

    // Documents processed
    documentsProcessed: processedResults?.length || 0,
    documentTypes: {},
  };

  if (!processedResults || processedResults.length === 0) {
    console.warn("⚠️ No results to extract from");
    return briefingData;
  }

  for (const result of processedResults) {
    if (result.status !== "complete" || !result.extractedData) continue;

    const { type } = result.extractedData;

    // Count document types
    if (!briefingData.documentTypes[type]) {
      briefingData.documentTypes[type] = 0;
    }
    briefingData.documentTypes[type]++;

    switch (type) {
      case "service_record":
        applyServiceRecordToBriefing(briefingData, result.extractedData);
        break;

      case "rating_decision":
        applyRatingDecisionToBriefing(briefingData, result.extractedData);
        break;

      case "claim_letter":
        applyClaimLetterToBriefing(briefingData, result.extractedData);
        break;
    }
  }

  // eslint-disable-next-line no-console
  console.log("✅ Intelligence Briefing data extracted:", briefingData);
  return briefingData;
};

/**
 * Analyze processed documents for Evidence Gaps and DTA Violations
 * (NEW in v1.16.0)
 *
 * This runs automatically if we have both a Decision Letter and medical evidence
 * Identifies potential "Duty to Assist" violations under 38 CFR § 3.159
 */
const analyzeDecisionLetterGaps = (decision, evidenceDocs, allGaps) => {
  // eslint-disable-next-line no-console
  console.log(`📋 Analyzing Decision: ${decision.filename}`);

  // Combine all non-decision text as the "C-File equivalent"
  const combinedEvidence = evidenceDocs
    .filter((d) => d.filename !== decision.filename)
    .map((d) => d.text)
    .join("\n\n--- DOCUMENT BREAK ---\n\n");

  try {
    // Use quickGapCheck for faster analysis
    const quickGaps = quickGapCheck(decision.text, {
      documentTypes: evidenceDocs.map((d) => d.classification?.type),
      estimatedDocCount: evidenceDocs.length,
    });

    if (quickGaps.gaps && quickGaps.gaps.length > 0) {
      allGaps.push({
        decisionLetter: decision.filename,
        gaps: quickGaps.gaps,
        severity: quickGaps.overallSeverity,
        recommendations: quickGaps.recommendations,
      });
    }

    // If we have substantial evidence, do full gap analysis
    if (combinedEvidence.length > 5000 && combinedEvidence.length < 500000) {
      const fullAnalysis = findEvidenceGaps(decision.text, combinedEvidence);

      if (fullAnalysis.gapsFound && fullAnalysis.gapsFound.length > 0) {
        // Merge with quick check results
        const existingEntry = allGaps.find(
          (g) => g.decisionLetter === decision.filename,
        );
        if (existingEntry) {
          existingEntry.fullAnalysis = fullAnalysis;
          existingEntry.dtaViolations = fullAnalysis.dtaViolations;
        } else {
          allGaps.push({
            decisionLetter: decision.filename,
            fullAnalysis,
            dtaViolations: fullAnalysis.dtaViolations,
          });
        }
      }
    }
  } catch (err) {
    console.warn(
      `⚠️ Gap analysis error for ${decision.filename}:`,
      err.message,
    );
  }
};

export const analyzeEvidenceGaps = (processedResults) => {
  // eslint-disable-next-line no-console
  console.log("🔍 Analyzing evidence gaps across processed documents...");

  // Find decision letters
  const decisionLetters = processedResults.filter(
    (r) =>
      r.classification?.type === DOCUMENT_TYPES.RATING_DECISION &&
      r.status === "complete" &&
      r.text,
  );

  // Find all medical/service evidence
  const evidenceDocs = processedResults.filter(
    (r) =>
      r.status === "complete" &&
      r.text &&
      r.classification?.category !== "correspondence",
  );

  if (decisionLetters.length === 0) {
    // eslint-disable-next-line no-console
    console.log("ℹ️ No Decision Letters found - skipping gap analysis");
    return {
      success: false,
      reason: "No Decision Letters found in processed documents",
      gapsFound: [],
    };
  }

  if (evidenceDocs.length < 2) {
    // eslint-disable-next-line no-console
    console.log("ℹ️ Insufficient evidence documents for gap analysis");
    return {
      success: false,
      reason: "Need at least 2 documents for meaningful gap analysis",
      gapsFound: [],
    };
  }

  const allGaps = [];

  // For each decision letter, check against all other evidence
  for (const decision of decisionLetters) {
    analyzeDecisionLetterGaps(decision, evidenceDocs, allGaps);
  }

  const result = {
    success: true,
    gapsFound: allGaps,
    totalGaps: allGaps.reduce((sum, g) => sum + (g.gaps?.length || 0), 0),
    hasDTAViolations: allGaps.some(
      (g) => g.dtaViolations && g.dtaViolations.length > 0,
    ),
    analyzedAt: new Date().toISOString(),
    parserVersion: "v1.16.0",
  };

  // eslint-disable-next-line no-console
  console.log(
    `🔍 Evidence gap analysis complete: ${result.totalGaps} potential gaps found`,
  );
  return result;
};

// Summarize extracted data to avoid token overflow
const summarizeExtractedData = (data) => {
  if (!data) return "No data extracted";
  const summary = [];
  if (data.name) summary.push(`Name: ${data.name}`);
  if (data.serviceNumber) summary.push(`Service #: ${data.serviceNumber}`);
  if (data.branch) summary.push(`Branch: ${data.branch}`);
  if (data.entryDate) summary.push(`Entry: ${data.entryDate}`);
  if (data.dischargeDate) summary.push(`Discharge: ${data.dischargeDate}`);
  if (data.mos) summary.push(`MOS: ${data.mos}`);
  if (data.rank) summary.push(`Rank: ${data.rank}`);
  if (data.conditions && Array.isArray(data.conditions)) {
    summary.push(
      `Conditions (${data.conditions.length}): ${data.conditions
        .slice(0, 10)
        .map((c) => c.name || c)
        .join(", ")}`,
    );
  }
  if (data.rating) summary.push(`Rating: ${data.rating}%`);
  if (data.effectiveDate) summary.push(`Effective: ${data.effectiveDate}`);
  return summary.length > 0 ? summary.join(", ") : "Limited data";
};

const groupProcessedDocuments = (processedResults) => ({
  serviceRecords: processedResults.filter(
    (r) =>
      r.classification?.category === "service_record" &&
      r.status === "complete",
  ),
  ratingDocs: processedResults.filter(
    (r) => r.classification?.category === "rating" && r.status === "complete",
  ),
  medicalDocs: processedResults.filter(
    (r) => r.classification?.category === "medical" && r.status === "complete",
  ),
});

// A-H03: filenames and extracted fields are user-uploaded (untrusted). Wrap the
// whole document-derived block in a spotlighted section so an injected
// instruction inside a filename/summary is treated as data, not a command.
const buildMusterCallPrompt = (serviceRecords, ratingDocs, medicalDocs) => {
  const serviceRecordLines = serviceRecords
    .map((r) => `- ${r.filename}: ${summarizeExtractedData(r.extractedData)}`)
    .join("\n");
  const ratingDocLines = ratingDocs
    .map((r) => `- ${r.filename}: ${summarizeExtractedData(r.extractedData)}`)
    .join("\n");
  const medicalDocLines = medicalDocs
    .map((r) => `- ${r.filename}: ${r.classification.type}`)
    .join("\n");

  const documentEvidence = untrustedSection(
    "UPLOADED DOCUMENT EVIDENCE",
    `SERVICE RECORDS (${serviceRecords.length} documents):
${serviceRecordLines}

RATING DECISIONS (${ratingDocs.length} documents):
${ratingDocLines}

MEDICAL RECORDS (${medicalDocs.length} documents):
${medicalDocLines}`,
  );

  return `Analyze this veteran's complete file and provide comprehensive recommendations:

${documentEvidence}

Provide:
1. **Service Connection Opportunities**: What conditions should be claimed based on service records?
2. **Rating Increase Opportunities**: Current ratings that may qualify for increase
3. **Secondary Conditions**: Potential secondary conditions based on service-connected disabilities
4. **Missing Evidence**: What additional evidence would strengthen claims?
5. **Next Steps**: Prioritized action plan

Format as markdown with clear sections.`;
};

/**
 * Generate comprehensive analysis report using LLM
 */
export const generateMusterCallReport = async (
  processedResults,
  _classified,
) => {
  // eslint-disable-next-line no-console
  console.log("🎖️ Starting Muster Call Report generation...");
  // eslint-disable-next-line no-console
  console.log("📊 Total processed results:", processedResults?.length);

  if (!isAnyAIAvailable()) {
    console.warn("⚠️ AI not available for report generation");
    return {
      success: false,
      error: "AI service not available. Report generation requires AI.",
    };
  }

  const { serviceRecords, ratingDocs, medicalDocs } =
    groupProcessedDocuments(processedResults);

  // eslint-disable-next-line no-console
  console.log(
    `📝 Document counts: ${serviceRecords.length} service, ${ratingDocs.length} rating, ${medicalDocs.length} medical`,
  );

  // Check if we have any documents to analyze
  if (
    serviceRecords.length === 0 &&
    ratingDocs.length === 0 &&
    medicalDocs.length === 0
  ) {
    console.warn("⚠️ No completed documents to analyze");
    return {
      success: false,
      error: "No completed documents available for analysis.",
    };
  }

  const prompt = buildMusterCallPrompt(serviceRecords, ratingDocs, medicalDocs);

  // eslint-disable-next-line no-console
  console.log(`📤 Sending prompt to AI (${prompt.length} chars)`);

  try {
    const response = await generateAI(prompt, {
      systemPrompt:
        "You are a VA disability claims expert. Provide actionable, regulation-based guidance.",
      temperature: 0.3,
    });

    // eslint-disable-next-line no-console
    console.log(
      `✅ Report generated successfully (${response?.length || 0} chars)`,
    );

    return {
      success: true,
      report: response,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("❌ Report generation error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};
