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
  DOCUMENT_TYPES,
} from "./documentClassifier";
import { parseDD214Text } from "./ribbonRackData";
import { updateVeteranProfile, getVeteranProfile } from "./veteranProfile";
import { generateAI, isAnyAIAvailable } from "./unifiedAIService";
import { addDocumentToVKB } from "./veteranKnowledgeBase";
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
  buildDocumentInventory,
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
    visionResult.combinedText.trim().length > 100
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
    "⚠️ Vision extraction returned minimal text, falling back to OCR",
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

const runStandardDocumentExtraction = async (
  file,
  onProgress,
  result,
  isPDF,
) => {
  // ============================================================
  // STANDARD PATH: OCR extraction for non-DD214 documents
  // ============================================================
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
      `📦 Large PDF detected (${(file.size / 1024 / 1024).toFixed(1)} MB) — using streaming extraction...`,
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
          message: `Pages ${batch.startPage}–${batch.endPage} of ${batch.totalPages} extracted`,
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
            extractionResult.text.trim().length * 0.5
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
};

const archiveDocumentInPacket = async (file, result) => {
  try {
    const packetType =
      CLASS_TO_PACKET_TYPE[result.classification.type] || PACKET_DOC_TYPES.OTHER;

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

  result.classification = classifyDocument(result.text, file.name);

  // Step 3: Parse based on classification (SecOps Intelligence Briefing - Part 2)
  onProgress?.({
    filename: file.name,
    state: PROCESSING_STATES.ANALYZING,
    progress: 85,
    stage: "intel_extract",
    docType: result.classification.type,
    confidence: result.classification.confidence,
  });

  result.extractedData = await parseDocumentByType(
    result.text,
    result.classification.type,
    file.name,
    extractionResult.visionParsedData, // Pass vision-parsed data if available
  );
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

    // Step 4: Store document in VKB (keeps data separate per document)
    await storeDocumentInVKB(file, result);

    // Step 5: Also save to My Packet (permanent document archive)
    await archiveDocumentInPacket(file, result);

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

  // Return result ready for intelligence briefing
  return {
    ...result,
    readyForReview: result.status === "complete",
    requiresVerification: true,
    vkbSaved: !!result.vkbDocumentId,
  };
};

/**
 * Detect and split multiple DD214s from a multi-page document
 * Each DD214 typically starts with "CERTIFICATE OF RELEASE OR DISCHARGE"
 * Returns array of text segments, one per DD214
 */
const splitMultipleDD214s = (text) => {
  // Split by page markers first
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
    const pageNum = parseInt(pageMatches[i][1]);
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
  const cleanedText = text.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ");

  const namePatterns = [
    // "1. NAME" followed by name: JOHNSON, ANTHONY
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
  // "Johnson Service Records DD214 ALL.pdf" -> "JOHNSON"
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

const buildVisionParsedServiceRecord = (text, visionParsedData) => {
  // eslint-disable-next-line no-console
  console.log("👁️ Using pre-parsed Vision data for DD214");
  const vf = visionParsedData.fields;

  // Convert vision parser format to parseServiceRecord format
  const visionData = {
    type: "service_record",
    // Name
    veteranName:
      vf.name ||
      `${vf.lastName || ""}, ${vf.firstName || ""} ${vf.middleName || ""}`
        .replace(/,\s*$/, "")
        .trim() ||
      null,
    lastName: vf.lastName || null,
    firstName: vf.firstName || null,
    middleName: vf.middleName || null,
    // Branch
    branch: vf.branch || null,
    component: vf.component || null,
    // Rank/Grade
    rank: vf.rank || null,
    payGrade: vf.payGrade || null,
    // MOS
    mos: vf.mos || null,
    mosTitle: vf.mosTitle || null,
    // Dates
    serviceStartDate: vf.entryDateFormatted || vf.entryDate || null,
    serviceEndDate: vf.separationDateFormatted || vf.separationDate || null,
    dateOfBirth: vf.dateOfBirth || null,
    // Awards
    awards: vf.awards || [],
    // Discharge info
    dischargeType: vf.characterOfService || null,
    separationCode: vf.separationCode || null,
    spdCode: vf.separationCode || null,
    reentryCode: vf.reentryCode || null,
    narrativeReason: vf.narrativeReason || null,
    // Combat indicators
    combatService: vf.combatService || null,
    foreignService: vf.foreignService || null,
    foreignServiceLocations: vf.foreignServiceLocations || [],
    // Metadata
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

const parseDD214Document = async (text, filename, visionParsedData) => {
  // ============================================================
  // VISION-FIRST PARSING (v1.16.4)
  // If Florence-2 Vision already parsed this DD214, use that data!
  // This avoids re-parsing with regex which may fail on vision output.
  // ============================================================
  if (visionParsedData?.fields) {
    return buildVisionParsedServiceRecord(text, visionParsedData);
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

    // Select the DD214 that best matches the filename (e.g., "Johnson" in filename)
    const bestSegment = selectBestDD214Segment(dd214Segments, filename);

    if (bestSegment) {
      // Parse just the selected DD214
      const parsed = await parseServiceRecord(bestSegment.text);
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
    return await parseServiceRecord(dd214Segments[0].text);
  }

  // Single DD214
  return await parseServiceRecord(dd214Segments[0]?.text || text);
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
  // Full segmentation for large files
  const segments = segmentCFile(text, { maxSegments: 100 });
  // eslint-disable-next-line no-console
  console.log(
    `✅ Segmented C-File into ${segments.segments.length} documents`,
  );

  // Build inventory for the user
  const inventory = buildDocumentInventory(text);

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
    segments: segments.segments.map((s) => ({
      type: s.type,
      startPage: s.startPage,
      endPage: s.endPage,
      confidence: s.confidence,
      snippet: s.text.substring(0, 200),
    })),
    inventory,
    codeSheet: codeSheet.success ? codeSheet : null,
    aiAnalysis, // Include AI-enhanced analysis if available
    parserVersion: "v1.18.3-enhanced",
  };
};

const parseCFileDocument = async (text) => {
  // Enhanced: Use C-File Segmentation for large claim files
  // eslint-disable-next-line no-console
  console.log("📚 Using enhanced C-File Segmentation...");

  // Quick scan to determine file structure
  const cFileSummary = quickScanCFile(text);
  // eslint-disable-next-line no-console
  console.log(
    `📊 C-File scan: ${cFileSummary.estimatedDocCount} documents, ${cFileSummary.categories.join(", ")}`,
  );

  // Check if this is actually a large C-File (multi-document)
  if (cFileSummary.estimatedDocCount > 5) {
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
      return await parseDD214Document(text, filename, visionParsedData);

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
const parseServiceRecord = async (text) => {
  const data = {
    type: "service_record",
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
    const upperText = text.toUpperCase();

    // ============================================================
    // DD214 FORM STRUCTURE (Critical for parsing):
    //
    // 1. FIELD LABELS = BOLD ALL CAPS (e.g., "NAME", "GRADE", "DECORATIONS")
    // 2. INSTRUCTIONS = (parenthetic, often lowercase or mixed case)
    //    Example: "(Silver Star, Bronze Star, Air Medal, etc.)"
    // 3. ACTUAL DATA = ALL CAPS, not bold, NOT in parentheses
    //    Example: "JOHNSON, ANTHONY DANIEL"
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

    for (const [pattern, replacement] of ocrFixPatterns) {
      cleanedText = cleanedText.replace(pattern, replacement);
    }

    // eslint-disable-next-line no-console
    console.log("🔧 OCR normalization applied to DD214 text");

    // STEP 1: Remove ALL parenthetical content (instructions/examples)
    // This catches "(Silver Star, Bronze Star...)", "(Last, First, Middle)", etc.
    cleanedText = cleanedText.replace(/\([^)]*\)/g, " ");

    // STEP 2: Remove common instructional phrases (not always in parentheses)
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

    for (const pattern of INSTRUCTIONAL_PATTERNS) {
      cleanedText = cleanedText.replace(pattern, " ");
    }

    // STEP 3: Clean up multiple spaces
    cleanedText = cleanedText.replace(/\s+/g, " ").trim();

    // === BOX 1: NAME ===
    // Look for name after "1. NAME" heading - the actual veteran name
    // Format is typically: LAST, FIRST MIDDLE or LAST; FIRST MIDDLE
    //
    // CRITICAL: DD214 forms have field LABELS like "DEPARTMENT, COMPONENT AND BRANCH"
    // that look like names (LASTNAME, FIRSTNAME MIDDLE) but are NOT names!
    // Also exclude address components (counties, cities, states) that look like names
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
    ];

    // ============================================================
    // COMMON NAME ABBREVIATIONS TO EXPAND
    // OCR often truncates names - expand common abbreviations
    // ============================================================
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

    // === BOX 1 NAME EXTRACTION ===
    // CRITICAL: Only extract name from Box 1 area, NOT from addresses (Box 7, 8)
    // Box 1 is always near the top of the document, before "2. DEPARTMENT"

    // First, try to isolate Box 1 content (everything between "1. NAME" and "2. DEPARTMENT")
    const box1Match = cleanedText.match(
      /1\.\s*NAME[^2]*?(?=2\.\s*(?:DEPARTMENT|DEPT))/is,
    );
    const box1Text = box1Match ? box1Match[0] : cleanedText.substring(0, 500); // Fallback: first 500 chars

    const namePatterns = [
      // "JOHNSON, ANTHONY DANIEL" or "JOHNSON; ANTHONY DANIEL" - explicitly after "1. NAME"
      /1\.\s*NAME.*?(?:Last.*?First.*?Middle.*?)?[:\s]+([A-Z]{3,})[,;]\s*([A-Z]{3,})(?:\s+([A-Z]+))?/i,
      // Name on line after "1. NAME" label
      /1\.\s*NAME[^\n]*\n\s*([A-Z]{3,})[,;]?\s+([A-Z]{3,})(?:\s+([A-Z]+))?/i,
      // Look for CAPS name with comma in Box 1 area: "JOHNSON, ANTHONY"
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

        if (!isFieldLabel && !isGarbage) {
          data.lastName = potentialLastName;

          // Check if first name is a common abbreviation that needs expansion hint
          if (potentialFirstName && potentialFirstName.length <= 2) {
            // Very short first name - might be truncated
            const expansion = NAME_EXPANSIONS[potentialFirstName];
            if (expansion) {
              // Mark as potentially abbreviated, keep original but note expansion
              data.firstName = potentialFirstName;
              data.firstNamePossibleExpansions = expansion;
            } else {
              data.firstName = potentialFirstName;
            }
          } else {
            data.firstName = potentialFirstName;
          }

          data.middleName = potentialMiddleName;
          data.veteranName = `${data.lastName}, ${data.firstName}${data.middleName ? " " + data.middleName : ""}`;

          // Flag if first name looks like it might be abbreviated
          if (potentialFirstName && potentialFirstName.length <= 2) {
            data.nameNeedsVerification = true;
            console.warn(
              `⚠️ Short first name detected: "${potentialFirstName}" - may be OCR abbreviation`,
            );
          }

          break;
        }
      }
    }

    // === BOX 2: BRANCH/COMPONENT ===
    // Handle abbreviations like ARNGUS, ORARNG, USMC, etc.
    const branchPatterns = [
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
          if (parseInt(year) >= 1940 && parseInt(year) <= 2010) {
            dob = `${month}/${day}/${year}`;
          } else {
            // Might be MMDDYYYY format instead
            const altYear = dob.substring(4, 8);
            const altMonth = dob.substring(0, 2);
            const altDay = dob.substring(2, 4);
            if (parseInt(altYear) >= 1940 && parseInt(altYear) <= 2010) {
              dob = `${altMonth}/${altDay}/${altYear}`;
            }
          }
        }
        data.dateOfBirth = dob;
        break;
      }
    }

    // ============================================================
    // BOX 12a: DATE ENTERED AD THIS PERIOD (NOT Box 7!)
    // Box 7 is Place of Entry, NOT date!
    // Common formats: YYYYMMDD (compact), YY | MM | DD (table format)
    // ============================================================
    const entryPatterns = [
      // Explicit Box 12a reference
      /12a\.?\s*(?:DATE\s+)?(?:ENTERED|ENTRY|ENTERED\s+AD)[:\s]+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
      // "DATE ENTERED AD" or "ENTERED ACTIVE DUTY" label
      /DATE\s+ENTERED\s+(?:AD|ACTIVE\s+DUTY)\D*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
      // Box 12a with compact YYYYMMDD
      /12a\.?\D*(\d{8})\b/i,
      // Table format: "2004 | 06 | 22" or "04 06 22"
      /12a\.?\D*(\d{2,4})\s*[|/-]\s*(\d{2})\s*[|/-]\s*(\d{2})/i,
      // Fallback: "DATE ENTERED" followed by date anywhere
      /(?:DATE\s+)?ENTERED[:\s]+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
    ];
    for (const pattern of entryPatterns) {
      const match = cleanedText.match(pattern);
      if (match) {
        let dateStr;

        // Handle table format (year, month, day in separate groups)
        if (match[2] && match[3]) {
          let year = match[1];
          const month = match[2];
          const day = match[3];
          // Handle 2-digit year
          if (year.length === 2) {
            year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
          }
          dateStr = `${month}/${day}/${year}`;
        } else {
          dateStr = match[1];
          // Convert YYYYMMDD to readable format
          if (/^\d{8}$/.test(dateStr)) {
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            if (parseInt(year) >= 1950 && parseInt(year) <= 2030) {
              dateStr = `${month}/${day}/${year}`;
            }
          }
        }

        // Sanity check: Entry date should NOT be same as DOB
        if (dateStr !== data.dateOfBirth) {
          data.serviceStartDate = dateStr;
          break;
        }
      }
    }

    // Box 8: Place of Entry
    const placeMatch = cleanedText.match(
      /8\.\s*(?:HOME\s+OF\s+RECORD|PLACE\s+OF\s+ENTRY)[:\s]+([A-Z][A-Z\s,]+?)(?:\s+9\.|$)/i,
    );
    if (placeMatch) {
      data.placeOfEntry = placeMatch[1]?.trim();
    }

    // Box 11: Primary MOS/Specialty (mos) - Handle various formats
    // Examples: "92Y10 UNIT SUPPLY SP", "11B INFANTRY", "0311 RIFLEMAN"
    const mosPatterns = [
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
          // Remove numbers and noise at end, keep just the job title
          title = title.replace(/\s+\d+.*$/, "").trim();
          if (title.length >= 5 && title.length <= 50) {
            data.mosTitle = title;
          }
        }
        break;
      }
    }

    // ============================================================
    // BOX 12b: SEPARATION DATE THIS PERIOD (NOT Box 12a!)
    // Box 12a is Entry Date, Box 12b is Separation Date!
    // Common formats: YYYYMMDD (compact), YY | MM | DD (table format)
    // ============================================================
    const separationPatterns = [
      // Explicit Box 12b reference
      /12b\.?\s*(?:DATE\s+)?(?:SEPARATION|RELEASE)[:\s]+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
      // "SEPARATION DATE" or "DATE OF SEPARATION" label
      /SEPARATION\s+DATE\D*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
      /DATE\s+OF\s+(?:SEPARATION|RELEASE)\D*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
      // Box 12b with compact YYYYMMDD
      /12b\.?\D*(\d{8})\b/i,
      // Table format: "2007 | 06 | 29" or "07 06 29"
      /12b\.?\D*(\d{2,4})\s*[|/-]\s*(\d{2})\s*[|/-]\s*(\d{2})/i,
    ];
    for (const pattern of separationPatterns) {
      const match = cleanedText.match(pattern);
      if (match) {
        let dateStr;

        // Handle table format (year, month, day in separate groups)
        if (match[2] && match[3]) {
          let year = match[1];
          const month = match[2];
          const day = match[3];
          // Handle 2-digit year
          if (year.length === 2) {
            year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
          }
          dateStr = `${month}/${day}/${year}`;
        } else {
          dateStr = match[1];
          // Convert YYYYMMDD to readable format
          if (/^\d{8}$/.test(dateStr)) {
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            if (parseInt(year) >= 1950 && parseInt(year) <= 2030) {
              dateStr = `${month}/${day}/${year}`;
            }
          }
        }

        // Sanity check: Separation date should be AFTER entry date
        // And should NOT be same as DOB
        if (dateStr !== data.dateOfBirth && dateStr !== data.serviceStartDate) {
          data.serviceEndDate = dateStr;
          break;
        }
      }
    }

    // === BOX 12b-d: SERVICE TIME ===
    // CRITICAL: Box 12b is "NET ACTIVE SERVICE THIS PERIOD" - the actual active duty time
    // Box 12c is "TOTAL PRIOR ACTIVE SERVICE" - previous active duty
    // Box 12d is "TOTAL PRIOR INACTIVE SERVICE" - reserve/guard time (not active duty)
    // Box 12e is "FOREIGN SERVICE" - overseas time
    // We need to be VERY specific about which box we're reading

    // Box 12b: NET ACTIVE SERVICE THIS PERIOD (the important one)
    const netActivePatterns = [
      /12b\.?\s*NET\s+ACTIVE\s+SERVICE\s+THIS\s+PERIOD[:\s]+(\d{1,2})\s*(?:YR|YEAR)?S?\s*(\d{1,2})\s*(?:MO|MONTH)?S?\s*(\d{1,2})?\s*(?:DAY)?S?/i,
      /NET\s+ACTIVE\s+SERVICE[:\s]+(\d{1,2})\s*(\d{1,2})/i,
      // Look for pattern: "12b. XX YY ZZ" (years months days)
      /12b\.\s*(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})?/i,
    ];
    for (const pattern of netActivePatterns) {
      const match = cleanedText.match(pattern);
      if (match) {
        const years = parseInt(match[1]) || 0;
        const months = parseInt(match[2]) || 0;
        const days = parseInt(match[3]) || 0;
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
      /12c\.?\s*(?:TOTAL\s+)?PRIOR\s+ACTIVE[:\s]+(\d{1,2})\s*(?:YR)?S?\s*(\d{1,2})/i,
    );
    if (priorActiveMatch) {
      const years = parseInt(priorActiveMatch[1]) || 0;
      const months = parseInt(priorActiveMatch[2]) || 0;
      if (years > 0 || months > 0) {
        data.totalPriorActiveService = `${years} years, ${months} months`;
      }
    }

    // Box 12d: TOTAL PRIOR INACTIVE SERVICE (reserve/guard time)
    const priorInactiveMatch = cleanedText.match(
      /12d\.?\s*(?:TOTAL\s+)?PRIOR\s+INACTIVE[:\s]+(\d{1,2})\s*(?:YR)?S?\s*(\d{1,2})/i,
    );
    if (priorInactiveMatch) {
      const years = parseInt(priorInactiveMatch[1]) || 0;
      const months = parseInt(priorInactiveMatch[2]) || 0;
      if (years > 0 || months > 0) {
        data.totalPriorInactiveService = `${years} years, ${months} months`;
      }
    }

    // === BOX 13: DECORATIONS/MEDALS/AWARDS ===
    // CRITICAL: Only parse Block 13 section, NOT instructional text
    // DD214 forms have INSTRUCTIONAL TEXT listing example awards on the blank form
    // Common instructional awards: Silver Star, Bronze Star, Air Medal, Purple Heart
    // These are NOT the veteran's awards unless they appear WITHOUT the instructional context

    // Awards that commonly appear in DD214 instructions (should be filtered unless clearly real)
    const INSTRUCTIONAL_AWARDS = [
      "SILVER STAR",
      "BRONZE STAR",
      "AIR MEDAL",
      "PURPLE HEART",
      "DISTINGUISHED FLYING CROSS",
      "ARMY COMMENDATION",
    ];

    // Look specifically for Block 13 content
    const block13Match = cleanedText.match(
      /13\.?\s*DECORATIONS.*?(?:BADGES.*?CITATIONS.*?CAMPAIGN.*?)?[:\s]+(.+?)(?=\s*14\.|15\.|---|\[INSTRUCTION)/is,
    );

    if (block13Match) {
      const block13Text = block13Match[1];

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
        const parsedAwards = parseDD214Text(block13Text, data.branch || "Army");
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

    // Fallback: If no awards found in Block 13, look for award patterns in general
    // but be very conservative about what we accept
    if (!data.awards || data.awards.length === 0) {
      // Only parse if we DON'T see ANY classic instructional patterns
      const hasAnyInstructionalText =
        /SILVER\s+STAR.*(?:BRONZE|AIR)|BRONZE\s+STAR.*AIR\s+MEDAL|SUCH\s+AS|EXAMPLE/i.test(
          cleanedText,
        );

      if (!hasAnyInstructionalText) {
        const parsedAwards = parseDD214Text(cleanedText, data.branch || "Army");
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

    // Box 14: Military Education - extract ONLY the structured education portion
    const eduPatterns = [
      /14\.\s*MILITARY\s+EDUCATION[^:]*:\s*(.+?)(?=\s*15\s*[.ab]|\s+HIGH\s+SCHOOL)/is,
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
          /\d+\s*(?:WK|WEEK|MONTH)/i.test(edu)
        ) {
          // Remove trailing noise like NOTHING FOLLOWS
          edu = edu.replace(/\s*\/\/\s*NOTHING\s+FOLLOWS.*$/i, "").trim();
          data.militaryEducation = edu;
        }
        break;
      }
    }

    // Box 18: Remarks - Extract only key deployment/service info, not entire text
    // Look for specific valuable info in remarks rather than dumping entire section
    const remarksKeyInfo = [];

    // Check for deployment info
    const deploymentInfo = text.match(
      /(?:SERVED\s+IN|SERVICE\s+IN|DEPLOYED\s+TO)\s+([A-Z][A-Z\s,]+?)(?:\.|\/\/|$)/gi,
    );
    if (deploymentInfo) {
      remarksKeyInfo.push(...deploymentInfo.map((d) => d.trim()));
    }

    // Check for OEF/OIF/OND service
    if (/OPERATION\s+(?:ENDURING|IRAQI|NEW\s+DAWN)/i.test(text)) {
      const opMatch = text.match(
        /(OPERATION\s+(?:ENDURING|IRAQI|NEW\s+DAWN)\s+FREEDOM?)/i,
      );
      if (opMatch) remarksKeyInfo.push(opMatch[1]);
    }

    // Only store remarks if we found valuable info
    if (remarksKeyInfo.length > 0) {
      data.remarks = remarksKeyInfo.join(" | ");
    }

    // Box 23: Type of Separation
    const sepTypeMatch = text.match(
      /23\.\s*TYPE\s+OF\s+SEPARATION[:\s]+([A-Z\s]+?)(?:\s+24\.|$)/i,
    );
    if (sepTypeMatch) {
      data.separationType = sepTypeMatch[1]?.trim();
    }

    // Box 24: Character of Service - CRITICAL for benefits (dischargeType)
    const characterPatterns = [
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

    // Box 25: Separation Authority (regulation)
    const authMatch = text.match(
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

    // Box 28: Narrative Reason
    const narrativeMatch = text.match(
      /28\.\s*NARRATIVE\s+REASON[:\s]+(.+?)(?:\s+29\.|$)/i,
    );
    if (narrativeMatch) {
      data.narrativeReason = narrativeMatch[1]?.trim();
    }

    // Extract deployments from remarks (Box 18) - common locations
    const deploymentPatterns = [
      /(?:SERVICE\s+IN|SERVED\s+IN|DEPLOYED\s+TO)\s+([A-Z][A-Z\s]+?)(?:\.|,|$)/gi,
      /(IRAQ|AFGHANISTAN|KUWAIT|KOREA|VIETNAM|GERMANY|JAPAN)/gi,
    ];
    for (const pattern of deploymentPatterns) {
      let match;
      while ((match = pattern.exec(upperText)) !== null) {
        const deployment = match[1]?.trim();
        if (deployment && !data.deployments.includes(deployment)) {
          data.deployments.push(deployment);
        }
      }
    }

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
 * Parse VA Rating Decision
 */
const parseRatingDecision = async (text) => {
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
    const combinedMatch = text.match(/COMBINED\s+RATING\s*[:=]?\s*(\d+)%?/i);
    if (combinedMatch) {
      data.combinedRating = parseInt(combinedMatch[1]);
    }

    // Extract effective date
    const effectiveDateMatch = text.match(
      /EFFECTIVE\s+DATE\s*[:=]?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
    );
    if (effectiveDateMatch) {
      data.effectiveDate = effectiveDateMatch[1];
    }

    // Extract decision date
    const decisionDateMatch = text.match(
      /DECISION\s+DATE\s*[:=]?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
    );
    if (decisionDateMatch) {
      data.decisionDate = decisionDateMatch[1];
    }

    // Extract conditions with diagnostic codes
    const conditionPattern =
      /(?:DIAGNOSTIC\s+CODE\s*[:=]?\s*(\d{4}))?[\s\S]{0,200}?([A-Z][A-Z\s,]+?)[\s-]+(\d+)%/gi;
    let match;
    while ((match = conditionPattern.exec(text)) !== null) {
      const [, diagnosticCode, condition, rating] = match;
      data.conditions.push({
        name: condition.trim(),
        rating: parseInt(rating),
        diagnosticCode: diagnosticCode || null,
        serviceConnected: true,
      });
    }
  } catch (error) {
    console.error("Rating decision parsing error:", error);
    data.error = error.message;
  }

  return data;
};

/**
 * Parse VA Claim Letter
 */
const parseClaimLetter = async (text) => {
  const data = {
    type: "claim_letter",
    claimNumber: null,
    claimDate: null,
    contentions: [],
    status: null,
    raw: text.substring(0, 500),
  };

  try {
    // Extract claim number
    const claimNumMatch = text.match(/CLAIM\s+NUMBER\s*[:=]?\s*(\d{8,})/i);
    if (claimNumMatch) {
      data.claimNumber = claimNumMatch[1];
    }

    // Extract claim date
    const claimDateMatch = text.match(
      /(?:DATE\s+OF\s+CLAIM|CLAIM\s+DATE)\s*[:=]?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
    );
    if (claimDateMatch) {
      data.claimDate = claimDateMatch[1];
    }

    // Extract contentions (claimed conditions)
    const contentionMatch = text.match(
      /CONTENTIONS?\s*[:=]?\s*([\s\S]{0,500}?)(?:\n\n|\r\n\r\n)/i,
    );
    if (contentionMatch) {
      const contentions = contentionMatch[1]
        .split(/[\n\r]+/)
        .map((line) => line.trim())
        .filter((line) => line.length > 3 && /^[A-Z]/.test(line));
      data.contentions = contentions;
    }

    // Extract status
    if (/PENDING/i.test(text)) {
      data.status = "pending";
    } else if (/APPROVED/i.test(text)) {
      data.status = "approved";
    } else if (/DENIED/i.test(text)) {
      data.status = "denied";
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
    const conditionMatch = text.match(
      /DBQ\s+FOR\s+([A-Z][A-Z\s]+?)(?:\n|$)/i,
    );
    if (conditionMatch) {
      data.condition = conditionMatch[1].trim();
    }

    // Extract diagnosis
    const diagnosisMatch = text.match(
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
      /(?:DATE\s+OF\s+SERVICE|VISIT\s+DATE)\s*[:=]?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
    );
    if (dateMatch) {
      data.dateOfService = dateMatch[1];
    }

    // Extract diagnoses (ICD codes)
    const icdPattern =
      /(?:ICD-?\d{1,2}\s*[:=]?\s*)?([A-Z]\d{2}(?:\.\d{1,2})?)\s+[–-]\s+([A-Za-z\s,]+)/g;
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

const applyServiceRecordToProfileUpdates = (updates, extractedData) => {
  // eslint-disable-next-line no-console
  console.log("📝 Found service record, extracting data:", extractedData);
  if (extractedData.branch) updates.branch = extractedData.branch;
  if (extractedData.entryDate)
    updates.serviceStartDate = extractedData.entryDate;
  if (extractedData.separationDate)
    updates.serviceEndDate = extractedData.separationDate;
  if (extractedData.mos) updates.mos = extractedData.mos;
  if (extractedData.mosTitle) updates.mosTitle = extractedData.mosTitle;
  if (extractedData.characterOfService)
    updates.characterOfService = extractedData.characterOfService;
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
  if (extractedData.claimNumber) updates.claimNumber = extractedData.claimNumber;
};

/**
 * Auto-populate veteran profile from processed documents
 */
export const autoPopulateProfile = async (processedResults) => {
  // eslint-disable-next-line no-console
  console.log("📋 Auto-populate Profile starting...");
  // eslint-disable-next-line no-console
  console.log("📊 Total results to process:", processedResults?.length);

  const currentProfile = getVeteranProfile();
  const updates = { ...currentProfile };

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

    switch (type) {
      case "service_record":
        applyServiceRecordToProfileUpdates(updates, result.extractedData);
        updateCount++;
        break;

      case "rating_decision":
        applyRatingDecisionToProfileUpdates(updates, result.extractedData);
        updateCount++;
        break;

      case "claim_letter":
        applyClaimLetterToProfileUpdates(updates, result.extractedData);
        updateCount++;
        break;

      default:
        // eslint-disable-next-line no-console
        console.log(`⚠️ Unknown document type: ${type} for ${result.filename}`);
    }
  }

  // eslint-disable-next-line no-console
  console.log(`📊 Auto-populate complete: ${updateCount} documents processed`);
  // eslint-disable-next-line no-console
  console.log("📝 Profile updates:", updates);

  if (updateCount > 0) {
    const success = updateVeteranProfile(updates);
    // eslint-disable-next-line no-console
    console.log(`✅ Profile update ${success ? "successful" : "failed"}`);
    return { success, updates, count: updateCount };
  }

  // eslint-disable-next-line no-console
  console.log("⚠️ No profile updates made");
  return { success: false, updates: {}, count: 0 };
};

const applyServiceRecordToBriefing = (briefingData, serviceData) => {
  // eslint-disable-next-line no-console
  console.log("📝 Extracting service record:", serviceData);

  // Handle array-structured data (indexed 0, 1, 2, etc.)
  if (serviceData[0]) {
    // Data is in numbered keys
    Object.keys(serviceData).forEach((key) => {
      if (!isNaN(key) && serviceData[key]) {
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
