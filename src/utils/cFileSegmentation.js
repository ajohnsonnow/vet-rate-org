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
import { createTimeSlicer } from "./mainThreadScheduler.js";

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
      /\b(?:NCOER|OER|EPR|FITREP)\b/i,
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
      /\bDBQ\s*[-–]\s*[A-Z]/i,
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
      /\bBVA\s*DECISION/i,
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
    patterns: [/SUPPLEMENTAL\s*STATEMENT\s*OF\s*THE\s*CASE/i, /\bSSOC\b/i],
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
      /\b(?:BUDDY|LAY)\s*STATEMENT\b/i,
      /(?:STATEMENT\s*IN\s*SUPPORT|SUPPORTING\s*STATEMENT)/i,
      /VA\s*FORM\s*21-4138/i,
    ],
    priority: 60,
    category: "EVIDENCE",
  },

  // Nexus Letters
  NEXUS_LETTER: {
    patterns: [
      /\b(?:NEXUS|IMO|INDEPENDENT\s*MEDICAL)\s*(?:LETTER|OPINION)/i,
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
// The text is never trimmed at the match: a VBMS export is not ordered with the
// code sheet last, and a stray "code sheet" mention early in a real 2,018-page
// file used to discard everything after it (~90%) before segmentation.
function _extractCodeSheet(text, result) {
  const codeSheetIndex = findLastOccurrence(
    text,
    DOCUMENT_SIGNATURES.CODE_SHEET.patterns,
  );
  if (codeSheetIndex !== -1) {
    result.codeSheet = parseCodeSheet(text.substring(codeSheetIndex));
    result.notes.push(`Code Sheet found at position ${codeSheetIndex}`);
    return;
  }

  result.notes.push("No Code Sheet found - this may be an incomplete C-File");
}

// D19-7: same work as _extractCodeSheet, via the chunked, yielding scan.
async function _extractCodeSheetChunked(text, result, slicer) {
  const codeSheetIndex = await findLastOccurrenceChunked(
    text,
    DOCUMENT_SIGNATURES.CODE_SHEET.patterns,
    slicer,
  );
  if (codeSheetIndex !== -1) {
    result.codeSheet = parseCodeSheet(text.substring(codeSheetIndex));
    result.notes.push(`Code Sheet found at position ${codeSheetIndex}`);
    return;
  }

  result.notes.push("No Code Sheet found - this may be an incomplete C-File");
}

// One boundary -> either a pushed segment or null (fragment too short to
// keep). Shared by the sync and chunked burst loops below.
function _buildSegmentAt(text, boundaries, i, options) {
  const { minSegmentLength, parseDocuments } = options;
  const boundary = boundaries[i];
  const nextBoundary = boundaries[i + 1];
  const endPosition = nextBoundary ? nextBoundary.position : text.length;
  const segmentText = text.substring(boundary.position, endPosition).trim();
  if (segmentText.length < minSegmentLength) return null;

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
  if (parseDocuments) segment.parsed = parseVADocument(segmentText);
  return segment;
}

function _recordSegment(segment, result) {
  result.segments.push(segment);
  result.byCategory[segment.category].push(segment.id);
  result.segmentCount++;
}

function _noteTruncation(boundaries, maxSegments, result) {
  if (boundaries.length > maxSegments) {
    result.notes.push(
      `Stopped at ${maxSegments} segments; ${boundaries.length - maxSegments} later documents were not segmented`,
    );
  }
}

function _burstIntoSegments(text, boundaries, options, result) {
  const { maxSegments } = options;
  for (let i = 0; i < boundaries.length && i < maxSegments; i++) {
    const segment = _buildSegmentAt(text, boundaries, i, options);
    if (segment) _recordSegment(segment, result);
  }
  _noteTruncation(boundaries, maxSegments, result);
}

// D19-7: same work as _burstIntoSegments, yielding between segments once the
// slicer's time budget is spent. parseVADocument (when parseDocuments is
// true) is the expensive part per segment; boundary count drives how many
// yield points there are.
async function _burstIntoSegmentsChunked(
  text,
  boundaries,
  options,
  result,
  slicer,
) {
  const { maxSegments } = options;
  for (let i = 0; i < boundaries.length && i < maxSegments; i++) {
    const segment = _buildSegmentAt(text, boundaries, i, options);
    if (segment) _recordSegment(segment, result);
    await slicer.maybeYield();
  }
  _noteTruncation(boundaries, maxSegments, result);
}

// Shared by segmentCFile and segmentCFileChunked - identical starting shape,
// see the `summary: null` field's own comment for why it must exist upfront.
function _initSegmentResult(text) {
  return {
    success: true,
    processedAt: new Date().toISOString(),
    totalLength: text.length,
    segmentCount: 0,
    codeSheet: null,
    summary: null,
    segments: [],
    byCategory: {
      SERVICE_RECORD: [],
      MEDICAL: [],
      DECISION: [],
      APPEAL: [],
      CORRESPONDENCE: [],
      EVIDENCE: [],
      SUMMARY: [],
      UNKNOWN: [],
    },
    notes: [],
  };
}

function _buildSummary(result) {
  return {
    totalDocuments: result.segmentCount,
    codeSheetFound: result.codeSheet !== null,
    combinedRating: result.codeSheet?.combinedRating || null,
    conditions: result.codeSheet?.conditions || [],
    documentBreakdown: Object.fromEntries(
      Object.entries(result.byCategory).map(([k, v]) => [k, v.length]),
    ),
  };
}

export function segmentCFile(text, options = {}) {
  const {
    maxSegments = 1000,
    minSegmentLength = 200,
    parseDocuments = true,
    prioritizeCodeSheet = true,
  } = options;

  const result = _initSegmentResult(text);

  try {
    // === STEP 1: BACKWARDS SEARCH FOR CODE SHEET ===
    if (prioritizeCodeSheet) {
      _extractCodeSheet(text, result);
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
    result.summary = _buildSummary(result);
  } catch (err) {
    result.success = false;
    result.error = err.message;
  }

  return result;
}

/**
 * D19-7: chunked twin of segmentCFile - same steps, same result shape, but
 * each CPU-bound pass (code-sheet scan, boundary detection, bursting) yields
 * to the main thread on a time budget instead of running as one long task.
 * Byte-identical output to segmentCFile for the same input - see
 * cFileSegmentation.chunked.equivalence.test.js.
 *
 * @param {string} text - Full C-File text
 * @param {Object} options - Same options as segmentCFile, plus budgetMs and
 *   slicer (share one slicer with another chunked call in the same pipeline
 *   so the time budget carries over instead of resetting per call)
 * @returns {Promise<Object>} Same shape segmentCFile returns
 */
export async function segmentCFileChunked(text, options = {}) {
  const {
    maxSegments = 1000,
    minSegmentLength = 200,
    parseDocuments = true,
    prioritizeCodeSheet = true,
    budgetMs,
    slicer = createTimeSlicer(budgetMs),
  } = options;

  const result = _initSegmentResult(text);

  try {
    if (prioritizeCodeSheet) {
      await _extractCodeSheetChunked(text, result, slicer);
    }

    const boundaries = await findDocumentBoundariesChunked(text, slicer);

    await _burstIntoSegmentsChunked(
      text,
      boundaries,
      { maxSegments, minSegmentLength, parseDocuments },
      result,
      slicer,
    );

    result.summary = _buildSummary(result);
  } catch (err) {
    result.success = false;
    result.error = err.message;
  }

  return result;
}

// D19-7 follow-up: a linear scan of every already-accepted match (even
// newest-first, as this used to be) only amortizes well while a signature's
// FIRST pattern is running. For a later pattern, the newest entries in
// `found` are the *earlier* pattern's matches - clustered whenever that
// pattern hit a few common words, and almost always nowhere near this
// pattern's own candidate positions, so the scan still walks back through
// roughly all of them. That keeps total CPU quadratic in match count for a
// signature with more than one pattern (see
// cFileSegmentation.dedupePerf.test.js).
//
// This dedupe's own rule - "reject a candidate within NEARBY_WINDOW_CHARS of
// an already-accepted match" - guarantees every pair of accepted positions
// for a signature ends up >= NEARBY_WINDOW_CHARS apart (a rejected candidate
// never gets recorded, so nothing closer than that ever survives). Bucketing
// position by NEARBY_WINDOW_CHARS therefore holds at most one accepted
// position per bucket, and any position within NEARBY_WINDOW_CHARS of a
// given point can only fall in that point's own bucket or an immediate
// neighbor - so checking those 3 buckets is an exact, O(1)-per-match
// replacement for the full scan, independent of pattern order.
const NEARBY_WINDOW_CHARS = 500;

function _hasNearbyMatch(nearbyIndex, position) {
  const bucket = Math.floor(position / NEARBY_WINDOW_CHARS);
  for (let b = bucket - 1; b <= bucket + 1; b++) {
    const existing = nearbyIndex.get(b);
    if (
      existing !== undefined &&
      Math.abs(existing - position) < NEARBY_WINDOW_CHARS
    ) {
      return true;
    }
  }
  return false;
}

function _recordMatch(nearbyIndex, position) {
  nearbyIndex.set(Math.floor(position / NEARBY_WINDOW_CHARS), position);
}

function _matchToBoundary(typeName, signature, text, match) {
  return {
    type: typeName,
    position: match.index,
    matchedText: match[0],
    priority: signature.priority,
    confidence: calculateMatchConfidence(text, match.index, signature.patterns),
  };
}

// One pattern's matches, appended into the signature's shared `found` list
// so the 500-char dedupe below sees everything found for this signature so
// far - same scope the inline per-signature loop used to keep implicitly.
// `nearbyIndex` is `found`'s companion spatial index (shared across every
// pattern of this signature the same way `found` itself is) - see
// _hasNearbyMatch's doc comment.
function _collectPatternMatches(
  typeName,
  signature,
  pattern,
  text,
  found,
  nearbyIndex,
) {
  let match;
  const globalPattern = new RegExp(
    pattern.source,
    pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g",
  );

  while ((match = globalPattern.exec(text)) !== null) {
    if (!_hasNearbyMatch(nearbyIndex, match.index)) {
      found.push(_matchToBoundary(typeName, signature, text, match));
      _recordMatch(nearbyIndex, match.index);
    }
  }
}

// D19-7: same work as _collectPatternMatches, checking the time budget
// after every raw match so one pathological pattern (thousands of raw
// matches on a few common words, each survivor costing a fresh
// calculateMatchConfidence substring+re-scan) can't itself become a single
// long main-thread task - findDocumentBoundariesChunked's between-pattern
// yield alone isn't enough when ONE pattern's own while-loop is the
// expensive part, and per-match cost is too uneven (duplicate vs. survivor,
// sparse vs. dense regions) for a fixed match-count interval to bound
// reliably. slicer.maybeYield() is a cheap performance.now() comparison
// when the budget isn't spent, so checking every iteration costs nothing
// in the common (non-pathological) case.
async function _collectPatternMatchesChunked(
  typeName,
  signature,
  pattern,
  text,
  found,
  nearbyIndex,
  slicer,
) {
  let match;
  const globalPattern = new RegExp(
    pattern.source,
    pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g",
  );

  while ((match = globalPattern.exec(text)) !== null) {
    if (!_hasNearbyMatch(nearbyIndex, match.index)) {
      found.push(_matchToBoundary(typeName, signature, text, match));
      _recordMatch(nearbyIndex, match.index);
    }
    await slicer.maybeYield();
  }
}

// Find every boundary match for one document-signature's patterns.
// Dedupes matches of the *same* type within 500 chars of each other.
function _collectPatternBoundaries(typeName, signature, text) {
  const found = [];
  const nearbyIndex = new Map();
  for (const pattern of signature.patterns) {
    _collectPatternMatches(
      typeName,
      signature,
      pattern,
      text,
      found,
      nearbyIndex,
    );
  }
  return found;
}

// Every (signature, pattern) pair as one flat list of independent units of
// work, in the same order findDocumentBoundaries has always processed them -
// the chunked scheduler below yields between these instead of between whole
// signatures, since a single signature can carry several expensive patterns.
function _boundaryWorkItems() {
  const items = [];
  for (const [typeName, signature] of Object.entries(DOCUMENT_SIGNATURES)) {
    const found = [];
    const nearbyIndex = new Map();
    for (const pattern of signature.patterns) {
      items.push({ typeName, signature, pattern, found, nearbyIndex });
    }
  }
  return items;
}

// Remove boundaries that are too close together, keeping the
// higher-priority match when two candidates collide.
function _filterCloseBoundaries(boundaries) {
  const filtered = [];
  for (const boundary of boundaries) {
    const lastBoundary = filtered.at(-1);
    if (!lastBoundary || boundary.position - lastBoundary.position > 500) {
      filtered.push(boundary);
    } else if (boundary.priority > lastBoundary.priority) {
      // Replace with higher priority match
      filtered[filtered.length - 1] = boundary;
    }
  }
  return filtered;
}

// Shared tail end of boundary-finding: concatenate each signature's matches
// (in signature order), sort by position, then collapse close collisions.
// Both the sync and chunked finders funnel through this so their final step
// can never drift apart.
function _finalizeBoundaries(foundArrays) {
  let boundaries = [];
  for (const found of foundArrays) {
    boundaries = boundaries.concat(found);
  }
  boundaries.sort((a, b) => a.position - b.position);
  return _filterCloseBoundaries(boundaries);
}

/**
 * Find document boundaries using signature patterns
 */
function findDocumentBoundaries(text) {
  const foundArrays = Object.entries(DOCUMENT_SIGNATURES).map(
    ([typeName, signature]) =>
      _collectPatternBoundaries(typeName, signature, text),
  );
  return _finalizeBoundaries(foundArrays);
}

// Same `found` array is shared by every pattern-item belonging to one
// signature (see _boundaryWorkItems) - collect each signature's array once,
// in first-seen order, so the chunked path concatenates in the same
// signature order the sync path iterates DOCUMENT_SIGNATURES in.
function _foundArraysInOrder(items) {
  const seen = new Set();
  const arrays = [];
  for (const item of items) {
    if (seen.has(item.found)) continue;
    seen.add(item.found);
    arrays.push(item.found);
  }
  return arrays;
}

// D19-7: same work as findDocumentBoundaries, chunked per (signature,
// pattern) pair with a yield to the main thread when the slicer's budget is
// spent. Byte-identical output - see cFileSegmentation.chunked.equivalence.test.js.
async function findDocumentBoundariesChunked(text, slicer) {
  const items = _boundaryWorkItems();
  for (const item of items) {
    await _collectPatternMatchesChunked(
      item.typeName,
      item.signature,
      item.pattern,
      text,
      item.found,
      item.nearbyIndex,
      slicer,
    );
    await slicer.maybeYield();
  }
  return _finalizeBoundaries(_foundArraysInOrder(items));
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

// D19-7: same scan as findLastOccurrence, yielding between patterns.
async function findLastOccurrenceChunked(text, patterns, slicer) {
  let lastIndex = -1;
  for (const pattern of patterns) {
    const globalPattern = new RegExp(pattern.source, "gi");
    let match;
    while ((match = globalPattern.exec(text)) !== null) {
      if (match.index > lastIndex) lastIndex = match.index;
    }
    await slicer.maybeYield();
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
// Build the inventory from an ALREADY-COMPUTED segmentation. Callers that have
// just segmented the text must use this rather than buildDocumentInventory(),
// which re-segments from scratch — a second full pass over what can be several
// million characters.
export function buildInventoryFromSegmentation(segments) {
  if (!segments.success || !segments.summary) {
    return {
      totalDocuments: 0,
      inventory: [],
      categories: {},
      error: segments.error || "segmentation produced no summary",
    };
  }

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

export function buildDocumentInventory(cFileText) {
  return buildInventoryFromSegmentation(
    segmentCFile(cFileText, { parseDocuments: false }),
  );
}

export default {
  segmentCFile,
  segmentCFileChunked,
  extractDBQs,
  extractDecisions,
  quickScanCFile,
  buildDocumentInventory,
  DOCUMENT_SIGNATURES,
};
