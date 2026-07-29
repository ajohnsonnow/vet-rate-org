/**
 * Vet-Rate.org - C-File Segmentation & Bursting Utility
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PURPOSE: Burst the "monster file" (C-File) into usable segments
 *
 * WHAT IS A C-FILE?
 * The "Claims File" or "C-File" is a massive PDF (often 500-5000+ pages)
 * containing EVERY document the VA has on a veteran:
 * - DD-214s
 * - Service Treatment Records (STRs)
 * - C&P Exam Reports (DBQs)
 * - Decision Letters
 * - Private Medical Records
 * - Buddy Statements
 * - Code Sheet (at the END)
 *
 * STRATEGY: "Backwards Search" + "Regex Bursting"
 * 1. Start from the END - Code Sheet is always last
 * 2. Identify document boundaries via header patterns
 * 3. Burst into individual "dossiers" for targeted analysis
 *
 * KEY INSIGHT: The Code Sheet at the end is the "single source of truth"
 * for current ratings. Work backwards from there.
 */

import { parseVADocument, parseCodeSheet } from "./vaDocumentParser.js";

/**
 * Document type signatures for segmentation
 */
export const DOCUMENT_SIGNATURES = {
  // Military service records
  DD214: {
    patterns: [
      /DD\s*(?:FORM\s*)?214/i,
      /CERTIFICATE\s*OF\s*(?:RELEASE|DISCHARGE)/i,
      /(?:CHARACTER\s*OF\s*)?SERVICE:\s*(?:HONORABLE|GENERAL|OTHER)/i,
    ],
    priority: 100,
    category: "SERVICE_RECORD",
  },

  // Performance reports
  PERFORMANCE_EVAL: {
    patterns: [
      /(?:ENLISTED|OFFICER)\s*(?:PERFORMANCE|EVALUATION)\s*REPORT/i,
      /(?:NCOER|OER|EPR|FITREP)/i,
      /EVALUATION\s*(?:PERIOD|RATING)/i,
    ],
    priority: 80,
    category: "SERVICE_RECORD",
  },

  // Service Treatment Records
  STR: {
    patterns: [
      /(?:SERVICE\s*)?TREATMENT\s*RECORD/i,
      /CHRONOLOGICAL\s*RECORD\s*OF\s*MEDICAL\s*CARE/i,
      /SF[-\s]?600/i,
      /(?:SICK\s*CALL|CLINICAL\s*NOTE)/i,
    ],
    priority: 90,
    category: "MEDICAL",
  },

  // C&P Exams / DBQs
  DBQ: {
    patterns: [
      /DISABILITY\s*BENEFITS\s*QUESTIONNAIRE/i,
      /DBQ\s*[-–]\s*[A-Z]/i,
      /(?:C&P|COMPENSATION\s*(?:AND|&)\s*PENSION)\s*EXAM/i,
    ],
    priority: 95,
    category: "MEDICAL",
  },

  // Rating decisions
  RATING_DECISION: {
    patterns: [
      /RATING\s*DECISION/i,
      /(?:COMBINED|OVERALL)\s*(?:EVALUATION|RATING)/i,
      /(?:GRANT|DENIAL)\s*(?:OF\s*)?SERVICE\s*CONNECTION/i,
    ],
    priority: 95,
    category: "DECISION",
  },

  // Code Sheet (always at END)
  CODE_SHEET: {
    patterns: [
      /CODE\s*SHEET/i,
      /RATING\s*CODE\s*SHEET/i,
      /(?:MASTER\s*)?RECORD\s*BRIEF/i,
    ],
    priority: 100,
    category: "SUMMARY",
  },

  // BVA Decisions
  BVA_DECISION: {
    patterns: [
      /BOARD\s*OF\s*VETERANS'?\s*APPEALS/i,
      /BVA\s*DECISION/i,
      /DOCKET\s*NO/i,
    ],
    priority: 90,
    category: "DECISION",
  },

  // Statement of the Case
  SOC: {
    patterns: [/STATEMENT\s*OF\s*THE\s*CASE/i, /ISSUES?\s*ON\s*APPEAL/i],
    priority: 85,
    category: "APPEAL",
  },

  // Supplemental SOC
  SSOC: {
    patterns: [/SUPPLEMENTAL\s*STATEMENT\s*OF\s*THE\s*CASE/i, /SSOC/i],
    priority: 85,
    category: "APPEAL",
  },

  // VA Notification Letters
  VA_LETTER: {
    patterns: [
      /DEPARTMENT\s*OF\s*VETERANS\s*AFFAIRS/i,
      /(?:DEAR\s*)?(?:MR\.|MRS\.|MS\.)\s+[A-Z]{2,}:/i,
      /(?:YOUR\s*)?CLAIM\s*(?:NUMBER|#)/i,
    ],
    priority: 50,
    category: "CORRESPONDENCE",
  },

  // Private Medical Records
  PRIVATE_MEDICAL: {
    patterns: [
      /(?:PRIVATE|OUTSIDE)\s*(?:MEDICAL\s*)?RECORDS?/i,
      /(?:HOSPITAL|CLINIC|MEDICAL\s*CENTER)\s*RECORDS/i,
      /(?:PATIENT|OFFICE)\s*(?:VISIT|NOTE)/i,
    ],
    priority: 70,
    category: "MEDICAL",
  },

  // Buddy/Lay Statements
  BUDDY_STATEMENT: {
    patterns: [
      /(?:BUDDY|LAY)\s*STATEMENT/i,
      /(?:STATEMENT\s*IN\s*SUPPORT|SUPPORTING\s*STATEMENT)/i,
      /VA\s*FORM\s*21-4138/i,
    ],
    priority: 60,
    category: "EVIDENCE",
  },

  // Nexus Letters
  NEXUS_LETTER: {
    patterns: [
      /(?:NEXUS|IMO|INDEPENDENT\s*MEDICAL)\s*(?:LETTER|OPINION)/i,
      /(?:AT\s*LEAST\s*AS\s*LIKELY|MORE\s*LIKELY\s*THAN\s*NOT)/i,
      /(?:MEDICAL\s*)?(?:NEXUS|OPINION)/i,
    ],
    priority: 95,
    category: "EVIDENCE",
  },
};

/**
 * Segment a C-File into individual documents
 * Uses backwards search strategy
 *
 * @param {string} text - Full C-File text
 * @param {Object} options - Segmentation options
 * @returns {Object} Segmented C-File with parsed documents
 */
function _extractCodeSheet(text, result) {
  const codeSheetIndex = findLastOccurrence(
    text,
    DOCUMENT_SIGNATURES.CODE_SHEET.patterns,
  );
  if (codeSheetIndex !== -1) {
    const codeSheetText = text.substring(codeSheetIndex);
    result.codeSheet = parseCodeSheet(codeSheetText);
    result.notes.push(`Code Sheet found at position ${codeSheetIndex}`);

    // Trim the text to exclude the code sheet from further processing
    return text.substring(0, codeSheetIndex);
  }

  result.notes.push("No Code Sheet found - this may be an incomplete C-File");
  return text;
}

function _burstIntoSegments(text, boundaries, options, result) {
  const { maxSegments, minSegmentLength, parseDocuments } = options;

  for (let i = 0; i < boundaries.length && i < maxSegments; i++) {
    const boundary = boundaries[i];
    const nextBoundary = boundaries[i + 1];
    const endPosition = nextBoundary ? nextBoundary.position : text.length;

    const segmentText = text.substring(boundary.position, endPosition).trim();

    if (segmentText.length < minSegmentLength) {
      continue; // Skip tiny fragments
    }

    const segment = {
      id: `segment_${i + 1}`,
      type: boundary.type,
      category: DOCUMENT_SIGNATURES[boundary.type]?.category || "UNKNOWN",
      position: boundary.position,
      length: segmentText.length,
      preview: segmentText.substring(0, 300),
      confidence: boundary.confidence,
      rawText: segmentText,
      parsed: null,
    };

    if (parseDocuments) {
      segment.parsed = parseVADocument(segmentText);
    }

    result.segments.push(segment);
    result.byCategory[segment.category].push(segment.id);
    result.segmentCount++;
  }
}

export function segmentCFile(text, options = {}) {
  const {
    maxSegments = 1000,
    minSegmentLength = 200,
    parseDocuments = true,
    prioritizeCodeSheet = true,
  } = options;

  const result = {
    success: true,
    processedAt: new Date().toISOString(),

    // Summary statistics
    totalLength: text.length,
    segmentCount: 0,

    // The holy grail - Code Sheet data
    codeSheet: null,

    // Categorized segments
    segments: [],

    // By category for quick access
    byCategory: {
      SERVICE_RECORD: [],
      MEDICAL: [],
      DECISION: [],
      APPEAL: [],
      CORRESPONDENCE: [],
      EVIDENCE: [],
      UNKNOWN: [],
    },

    // Processing notes
    notes: [],
  };

  try {
    // === STEP 1: BACKWARDS SEARCH FOR CODE SHEET ===
    if (prioritizeCodeSheet) {
      text = _extractCodeSheet(text, result);
    }

    // === STEP 2: IDENTIFY DOCUMENT BOUNDARIES ===
    const boundaries = findDocumentBoundaries(text);

    // === STEP 3-4: BURST INTO SEGMENTS + PARSE ===
    _burstIntoSegments(
      text,
      boundaries,
      { maxSegments, minSegmentLength, parseDocuments },
      result,
    );

    // === STEP 5: BUILD SUMMARY ===
    result.summary = {
      totalDocuments: result.segmentCount,
      codeSheetFound: result.codeSheet !== null,
      combinedRating: result.codeSheet?.combinedRating || null,
      conditions: result.codeSheet?.conditions || [],
      documentBreakdown: Object.fromEntries(
        Object.entries(result.byCategory).map(([k, v]) => [k, v.length]),
      ),
    };
  } catch (err) {
    result.success = false;
    result.error = err.message;
  }

  return result;
}

/**
 * Find document boundaries using signature patterns
 */
function findDocumentBoundaries(text) {
  const boundaries = [];

  for (const [typeName, signature] of Object.entries(DOCUMENT_SIGNATURES)) {
    for (const pattern of signature.patterns) {
      let match;
      const globalPattern = new RegExp(
        pattern.source,
        pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g",
      );

      while ((match = globalPattern.exec(text)) !== null) {
        // Check for duplicates within 500 chars
        const isDuplicate = boundaries.some(
          (b) =>
            Math.abs(b.position - match.index) < 500 && b.type === typeName,
        );

        if (!isDuplicate) {
          boundaries.push({
            type: typeName,
            position: match.index,
            matchedText: match[0],
            priority: signature.priority,
            confidence: calculateMatchConfidence(
              text,
              match.index,
              signature.patterns,
            ),
          });
        }
      }
    }
  }

  // Sort by position
  boundaries.sort((a, b) => a.position - b.position);

  // Remove boundaries that are too close together
  const filtered = [];
  for (const boundary of boundaries) {
    const lastBoundary = filtered[filtered.length - 1];
    if (!lastBoundary || boundary.position - lastBoundary.position > 500) {
      filtered.push(boundary);
    } else if (boundary.priority > lastBoundary.priority) {
      // Replace with higher priority match
      filtered[filtered.length - 1] = boundary;
    }
  }

  return filtered;
}

/**
 * Find the last occurrence of any pattern in text
 */
function findLastOccurrence(text, patterns) {
  let lastIndex = -1;

  for (const pattern of patterns) {
    const globalPattern = new RegExp(pattern.source, "gi");
    let match;
    while ((match = globalPattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        lastIndex = match.index;
      }
    }
  }

  return lastIndex;
}

/**
 * Calculate confidence score for a match
 */
function calculateMatchConfidence(text, position, patterns) {
  const context = text.substring(Math.max(0, position - 200), position + 500);

  let matchCount = 0;
  for (const pattern of patterns) {
    if (context.match(pattern)) {
      matchCount++;
    }
  }

  return Math.min(100, (matchCount / patterns.length) * 100);
}

/**
 * Extract all DBQs from a C-File
 * DBQs are critical for understanding how the VA rated conditions
 */
export function extractDBQs(cFileText) {
  const segments = segmentCFile(cFileText, { parseDocuments: true });

  return segments.segments.filter(
    (seg) => seg.type === "DBQ" || seg.category === "MEDICAL",
  );
}

/**
 * Extract all decision documents from C-File
 */
export function extractDecisions(cFileText) {
  const segments = segmentCFile(cFileText, { parseDocuments: true });

  return segments.segments.filter(
    (seg) => seg.category === "DECISION" || seg.category === "APPEAL",
  );
}

const QUICK_SCAN_FLAGS = {
  CODE_SHEET: "hasCodeSheet",
  DD214: "hasDD214",
  DBQ: "hasDBQs",
  BVA_DECISION: "hasBVA",
};

function _markDetectedType(scan, typeName) {
  if (!scan.detectedTypes.includes(typeName)) {
    scan.detectedTypes.push(typeName);
  }
  const flag = QUICK_SCAN_FLAGS[typeName];
  if (flag) scan[flag] = true;
}

/**
 * Quick scan to get C-File overview without full parsing
 */
export function quickScanCFile(text) {
  const scan = {
    estimatedPages: Math.ceil(text.length / 3000),
    hasCodeSheet: false,
    hasDD214: false,
    hasDBQs: false,
    hasBVA: false,
    detectedTypes: [],
  };

  for (const [typeName, signature] of Object.entries(DOCUMENT_SIGNATURES)) {
    const isDetected = signature.patterns.some((pattern) =>
      text.match(pattern),
    );
    if (isDetected) {
      _markDetectedType(scan, typeName);
    }
  }

  return scan;
}

/**
 * Build a document inventory from C-File
 * Returns a table of contents for navigation
 */
export function buildDocumentInventory(cFileText) {
  const segments = segmentCFile(cFileText, { parseDocuments: false });

  return {
    totalDocuments: segments.segmentCount,
    inventory: segments.segments.map((seg) => ({
      id: seg.id,
      type: seg.type,
      category: seg.category,
      preview: seg.preview.substring(0, 100) + "...",
      position: seg.position,
      length: seg.length,
    })),
    categories: segments.summary.documentBreakdown,
  };
}

export default {
  segmentCFile,
  extractDBQs,
  extractDecisions,
  quickScanCFile,
  buildDocumentInventory,
  DOCUMENT_SIGNATURES,
};
