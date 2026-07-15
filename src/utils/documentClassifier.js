/**
 * Vet-Rate.org - Document Classification System
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Intelligent document classifier for Muster Call system.
 * Analyzes document content to determine type:
 * - DD214/DD215/NGB22 (Service Records)
 * - VA Rating Decision Letters
 * - VA Claim Letters (Pending Claims)
 * - C-File Documents (Medical Records)
 * - DBQ Forms (Disability Benefits Questionnaires)
 * - Nexus Letters (Medical Opinions)
 * - Personal Statements
 * - VA Correspondence
 * - Unknown/Other
 */

/**
 * Document type constants
 */
export const DOCUMENT_TYPES = {
  DD214: "DD214",
  DD215: "DD215",
  NGB22: "NGB22",
  DD256: "DD256", // Reserve discharge
  DD257: "DD257", // Reserve discharge
  RATING_DECISION: "RATING_DECISION",
  CLAIM_LETTER: "CLAIM_LETTER",
  C_FILE_MEDICAL: "C_FILE_MEDICAL",
  DBQ: "DBQ",
  NEXUS_LETTER: "NEXUS_LETTER",
  PERSONAL_STATEMENT: "PERSONAL_STATEMENT",
  VA_CORRESPONDENCE: "VA_CORRESPONDENCE",
  MEDICAL_RECORD: "MEDICAL_RECORD",
  EXAM_REPORT: "EXAM_REPORT",
  UNKNOWN: "UNKNOWN",
};

/**
 * Classification patterns for each document type
 */
const CLASSIFICATION_PATTERNS = {
  [DOCUMENT_TYPES.DD214]: {
    patterns: [
      // ===== DD214 / DISCHARGE DOCUMENT PATTERNS =====
      // Core identifiers - these should ONLY appear on actual DD214s
      /DD\s*(?:-\s*)?FORM\s*(?:-\s*)?214/i, // DD FORM 214, DD-FORM-214, etc.
      /DD[-\s]?214/i, // DD214, DD-214, DD 214
      /CERTIFICATE\s+OF\s+RELEASE/i, // Shorter version (OCR friendly)
      /RELEASE\s+OR\s+DISCHARGE\s+FROM\s+ACTIVE\s+DUTY/i,
      /MEMBER\s*(?:-\s*)?\d\s*[-:]\s*COPY/i, // MEMBER 4 - COPY, MEMBER-1: COPY
      /SEPARATION\s+DATE/i, // Generic separation date
      /CHARACTER\s+OF\s+(SERVICE|DISCHARGE)/i, // Character of service/discharge

      // DD214 specific fields (boxes)
      /DATE\s+ENTERED\s+(?:ACTIVE\s+)?(?:DUTY|SERVICE)/i, // Box 12a
      /DECORATIONS.*MEDALS.*BADGES/i, // Box 13 (awards section)
      /PRIMARY\s+SPECIALTY/i, // Box 11 (MOS)
      /PAY\s+GRADE/i, // Box 4a
      /GRADE.*RATE.*RANK/i, // Box 4
      /NET\s+ACTIVE\s+SERVICE/i, // Box 12c
      /TOTAL\s+PRIOR\s+(?:ACTIVE|INACTIVE)\s+SERVICE/i, // Box 12d/e
      /PLACE\s+OF\s+ENTRY\s+INTO\s+ACTIVE\s+DUTY/i, // Box 12b
      /HOME\s+OF\s+RECORD/i, // Box 6
      /RE[-\s]?CODE|REENLISTMENT\s+(?:CODE|ELIGIBILITY)/i, // Box 27
      /SPD\s+CODE|SEPARATION\s+(?:PROGRAM\s+)?DESIGNATOR/i, // Box 28
      /NARRATIVE\s+REASON\s+FOR\s+SEPARATION/i, // Box 28
    ],
    weight: 5,
    category: "service_record",
    priority: 10, // Highest priority
    // Negative patterns - if these appear, it's probably NOT a DD214
    negativePatterns: [
      /WE\s+RECEIVED\s+YOUR\s+CLAIM/i,
      /WHAT\s+WE\s+NEED\s+FROM\s+YOU/i,
      /CLAIM\s+HAS\s+BEEN\s+RECEIVED/i,
      /PENDING\s+CLAIM/i,
      /C&P\s+EXAM(?:INATION)?\s+(?:HAS\s+BEEN\s+)?SCHEDULED/i,
      /WE\s+WILL\s+REVIEW\s+YOUR\s+CLAIM/i,
      /INTENT\s+TO\s+FILE/i,
      /RATING\s+DECISION/i,
      /COMBINED\s+RATING/i,
      /DIAGNOSTIC\s+CODE\s*\d{4}/i,
      /SERVICE\s+CONNECTION.*GRANTED/i,
    ],
  },

  [DOCUMENT_TYPES.DD215]: {
    patterns: [
      /DD\s*FORM\s*215/i,
      /CORRECTION\s+TO\s+DD\s+FORM\s+214/i,
      /AMENDED\s+DISCHARGE/i,
    ],
    weight: 5,
    category: "service_record",
    priority: 9,
  },

  [DOCUMENT_TYPES.NGB22]: {
    patterns: [
      /NGB\s*FORM\s*22/i,
      /NATIONAL\s+GUARD\s+BUREAU/i,
      /REPORT\s+OF\s+SEPARATION\s+AND\s+RECORD\s+OF\s+SERVICE/i,
      /STATE\s+ACTIVE\s+DUTY/i,
    ],
    weight: 5,
    category: "service_record",
    priority: 10,
  },

  [DOCUMENT_TYPES.DD256]: {
    patterns: [
      /DD\s*FORM\s*256/i,
      /HONORABLE\s+DISCHARGE.*RESERVE/i,
      /RESERVE\s+COMPONENT/i,
    ],
    weight: 5,
    category: "service_record",
    priority: 9,
  },

  [DOCUMENT_TYPES.RATING_DECISION]: {
    patterns: [
      /RATING\s+DECISION/i,
      /DEPARTMENT\s+OF\s+VETERANS\s+AFFAIRS.*RATING/i,
      /COMBINED\s+RATING/i,
      /DIAGNOSTIC\s+CODE\s*\d{4}/i,
      /38\s+CFR/i,
      /SERVICE\s+CONNECTION.*GRANTED/i,
      /EFFECTIVE\s+DATE.*ENTITLEMENT/i,
      /BILATERAL\s+FACTOR/i,
    ],
    weight: 4,
    category: "rating",
    priority: 9,
  },

  [DOCUMENT_TYPES.CLAIM_LETTER]: {
    patterns: [
      // ===== VA CLAIM LETTER SPECIFIC PATTERNS =====
      // These are VERY distinctive to claim letters and should NOT appear in DD214s

      // Development letter / Initial claim acknowledgment
      /WE\s+RECEIVED\s+YOUR\s+CLAIM/i,
      /YOUR\s+CLAIM\s+(?:HAS\s+BEEN\s+)?RECEIVED/i,
      /WE\s+ARE\s+WORKING\s+ON\s+YOUR\s+CLAIM/i,
      /ACKNOWLEDGMENT\s+(?:OF\s+)?(?:YOUR\s+)?CLAIM/i,
      /DEVELOPMENT\s+LETTER/i,
      /CLAIM\s+RECEIVED/i,

      // What we need from you sections
      /WHAT\s+WE\s+NEED\s+FROM\s+YOU/i,
      /WHAT\s+WE\s+(?:STILL\s+)?NEED/i,
      /EVIDENCE\s+(?:WE\s+)?NEED(?:ED)?/i,
      /PLEASE\s+(?:SEND|PROVIDE|SUBMIT)/i,
      /WE\s+NEED\s+(?:THE\s+FOLLOWING|YOU\s+TO)/i,
      /ADDITIONAL\s+(?:EVIDENCE|INFORMATION)\s+(?:IS\s+)?(?:REQUIRED|NEEDED)/i,
      /SUBMIT\s+(?:THE\s+FOLLOWING|EVIDENCE)/i,

      // Response deadlines (common in all eras)
      /YOU\s+HAVE\s+\d+\s+DAYS/i,
      /RESPOND\s+(?:BY|WITHIN)/i,
      /REPLY\s+(?:BY|WITHIN|TO)/i,
      /(?:SUSPENSE|DUE|RESPONSE)\s+DATE/i,
      /DAYS\s+TO\s+(?:RESPOND|REPLY|SUBMIT)/i,

      // What happens next
      /WHAT\s+(?:HAPPENS|TO\s+EXPECT)\s+NEXT/i,
      /NEXT\s+STEPS/i,
      /WE\s+WILL\s+(?:REVIEW|PROCESS)\s+YOUR\s+CLAIM/i,
      /YOUR\s+CLAIM\s+(?:IS|WILL\s+BE)\s+(?:BEING\s+)?REVIEWED/i,

      // Claim status language (broader matching)
      /(?:PENDING|OPEN|ACTIVE)\s+CLAIM/i,
      /CLAIM\s+(?:STATUS|NUMBER|FILE)/i,
      /CLAIM\s+(?:IS\s+)?IN\s+PROGRESS/i,
      /UNDER\s+(?:REVIEW|CONSIDERATION)/i,
      /STATUS\s+OF\s+YOUR\s+CLAIM/i,

      // Exam scheduling
      /C&P\s+EXAM(?:INATION)?/i,
      /COMPENSATION\s+(?:AND|&)\s+PENSION\s+EXAM/i,
      /WE\s+(?:HAVE\s+)?SCHEDULED?\s+(?:AN?\s+)?EXAM/i,
      /EXAM(?:INATION)?\s+(?:HAS\s+BEEN\s+|IS\s+)?SCHEDULED/i,
      /MEDICAL\s+EXAM(?:INATION)?\s+(?:WILL\s+BE\s+)?SCHEDULED/i,
      /(?:QTC|VES|LHI)\s+(?:EXAM|APPOINTMENT|MEDICAL)/i,
      /SCHEDULED\s+(?:WITH|AT|BY|FOR)\s+(?:AN?\s+)?(?:QTC|VES|LHI|EXAM)/i,

      // File/claim number formats (VA specific)
      /FILE\s+(?:NUMBER|NO\.?|#)/i,
      /CLAIM\s+(?:NUMBER|#|NO\.?)/i,
      /VA\s+FILE/i,
      /YOUR\s+(?:VA\s+)?FILE\s+NUMBER/i,

      // Intent to File
      /INTENT\s+TO\s+FILE/i,

      // Original patterns (kept + enhanced)
      /CLAIM\s+FOR\s+(?:DISABILITY\s+)?COMPENSATION/i,
      /VA\s+FORM\s+21-526/i,
      /APPLICATION\s+FOR\s+(?:DISABILITY\s+)?COMPENSATION/i,
      /CONTENTION(?:S)?/i,
      /CLAIMED\s+(?:CONDITION|DISABILITY)/i,

      // Older VA letter patterns (pre-2010)
      /DEPARTMENT\s+OF\s+VETERANS\s+AFFAIRS.*(?:CLAIM|FILE)/i,
      /VETERANS\s+BENEFITS\s+ADMINISTRATION.*(?:CLAIM|FILE)/i,
      /REGIONAL\s+(?:OFFICE|PROCESSING)/i,
      /AWARD\s+(?:OR\s+)?DENIAL/i,
      /DECISION\s+ON\s+YOUR\s+CLAIM/i,
      /(?:SERVICED?[-\s]?)?CONNECTED\s+(?:DISABILITY|CLAIM)/i,
      /DISABILITY\s+CLAIM/i,

      // VA letterhead/header patterns
      /VETERANS\s+BENEFITS\s+ADMINISTRATION/i,
      /VA\s+REGIONAL\s+(?:OFFICE|CENTER)/i,
    ],
    // Higher weight to compete with DD214
    weight: 5,
    category: "claim",
    // Higher priority than before - claim letters are important!
    priority: 9,
    // Negative patterns that should REDUCE score if found (DD214 indicators)
    negativePatterns: [
      /DD\s*FORM\s*214/i,
      /CERTIFICATE\s+OF\s+RELEASE\s+OR\s+DISCHARGE/i,
      /CHARACTER\s+OF\s+SERVICE/i,
      /MEMBER\s+\d\s*-\s*COPY/i,
      /DECORATIONS.*MEDALS.*BADGES/i,
      /PRIMARY\s+(?:SPECIALTY|MOS)/i,
      /NGB\s*FORM\s*22/i,
    ],
  },

  [DOCUMENT_TYPES.DBQ]: {
    patterns: [
      /DISABILITY\s+BENEFITS\s+QUESTIONNAIRE/i,
      /DBQ/i,
      /EXAMINATION\s+FOR.*DISABILITY/i,
      /MEDICAL\s+OPINION/i,
      /NEXUS\s+STATEMENT/i,
      /AS\s+LIKELY\s+AS\s+NOT/i,
      /MORE\s+LIKELY\s+THAN\s+NOT/i,
    ],
    weight: 4,
    category: "medical",
    priority: 7,
  },

  [DOCUMENT_TYPES.C_FILE_MEDICAL]: {
    patterns: [
      // C-File medical records are ACTUAL medical exam/treatment records
      // NOT letters ABOUT exams - they are the exams themselves
      /COMPENSATION\s+&\s+PENSION.*EXAM.*FINDINGS/i, // Require findings to be actual exam
      /C&P\s+EXAM(?:INATION)?\s+(?:RESULTS|FINDINGS|REPORT)/i, // Actual exam results
      /VA\s+MEDICAL\s+CENTER/i,
      /VETERANS\s+HEALTH\s+ADMINISTRATION/i,
      /TREATMENT\s+RECORD/i,
      /CLINICAL\s+NOTE/i,
      /PROGRESS\s+NOTE/i,
      /CHIEF\s+COMPLAINT/i, // Actual medical record language
      /PHYSICAL\s+EXAM(?:INATION)?/i, // Actual exam
      /MEDICAL\s+HISTORY/i,
      /ASSESSMENT\s+AND\s+PLAN/i,
    ],
    weight: 3,
    category: "medical",
    priority: 6,
    // Negative patterns - if these appear, it's probably a CLAIM LETTER not a medical record
    negativePatterns: [
      /WE\s+RECEIVED\s+YOUR\s+CLAIM/i,
      /WHAT\s+WE\s+NEED\s+FROM\s+YOU/i,
      /YOUR\s+CLAIM\s+(?:HAS\s+BEEN|IS)/i,
      /WE\s+(?:HAVE\s+)?SCHEDULED?\s+(?:AN?\s+)?EXAM/i,
      /RESPOND\s+WITHIN\s+\d+\s+DAYS/i,
      /CLAIM\s+(?:NUMBER|STATUS)/i,
      /PENDING\s+CLAIM/i,
      /EVIDENCE\s+NEEDED/i,
    ],
  },

  [DOCUMENT_TYPES.NEXUS_LETTER]: {
    patterns: [
      /NEXUS\s+LETTER/i,
      /MEDICAL\s+OPINION/i,
      /IN\s+MY\s+PROFESSIONAL\s+OPINION/i,
      /MORE\s+LIKELY\s+THAN\s+NOT.*SERVICE/i,
      /PROXIMATE\s+CAUSE/i,
      /ETIOLOGY/i,
      /IMO\s*-\s*INDEPENDENT\s+MEDICAL\s+OPINION/i,
    ],
    weight: 4,
    category: "medical_opinion",
    priority: 7,
  },

  [DOCUMENT_TYPES.PERSONAL_STATEMENT]: {
    patterns: [
      /PERSONAL\s+STATEMENT/i,
      /STATEMENT\s+IN\s+SUPPORT\s+OF\s+CLAIM/i,
      /VA\s+FORM\s+21-4138/i,
      // eslint-disable-next-line sonarjs/slow-regex -- input is the user's own uploaded document text, not attacker-controlled, and classification only scans a bounded excerpt
      /I.*DECLARE/i,
      /MY\s+NAME\s+IS/i,
      /I\s+AM\s+WRITING\s+TO/i,
    ],
    weight: 3,
    category: "statement",
    priority: 5,
  },

  [DOCUMENT_TYPES.VA_CORRESPONDENCE]: {
    patterns: [
      /DEPARTMENT\s+OF\s+VETERANS\s+AFFAIRS/i,
      /VETERANS\s+BENEFITS\s+ADMINISTRATION/i,
      /REGIONAL\s+OFFICE/i,
      /VA\s+NOTIFICATION\s+LETTER/i,
      /DECISION\s+REVIEW\s+OFFICER/i,
    ],
    weight: 2,
    category: "correspondence",
    priority: 4,
  },

  [DOCUMENT_TYPES.EXAM_REPORT]: {
    patterns: [
      // Actual exam reports have specific medical documentation language
      /EXAMINATION\s+REPORT/i,
      /PHYSICAL\s+EXAMINATION/i,
      /MENTAL\s+STATUS\s+EXAMINATION/i,
      /DIAGNOSTIC\s+FINDINGS/i,
      /CLINICAL\s+FINDINGS/i,
      /IMPRESSION/i,
      /DIAGNOSIS/i,
      /CHIEF\s+COMPLAINT/i,
      /OBJECTIVE\s+FINDINGS/i,
      /HISTORY\s+OF\s+PRESENT\s+ILLNESS/i,
    ],
    weight: 3,
    category: "medical",
    priority: 6,
    // Negative patterns - exam REPORTS are the actual exams, not letters about them
    negativePatterns: [
      /WE\s+RECEIVED\s+YOUR\s+CLAIM/i,
      /WHAT\s+WE\s+NEED\s+FROM\s+YOU/i,
      /WE\s+(?:HAVE\s+)?SCHEDULED?\s+(?:AN?\s+)?EXAM/i,
      /CLAIM\s+(?:NUMBER|STATUS)/i,
      /RESPOND\s+(?:BY|WITHIN)/i,
    ],
  },
};

function logClassificationStart(filename, text, normalizedText) {
  // eslint-disable-next-line no-console
  console.log("🔍 [CLASSIFIER DEBUG] Starting document classification");
  // eslint-disable-next-line no-console
  console.log("🔍 [CLASSIFIER DEBUG] Filename:", filename);
  // eslint-disable-next-line no-console
  console.log("🔍 [CLASSIFIER DEBUG] Text length:", text.length);
  // eslint-disable-next-line no-console
  console.log(
    "🔍 [CLASSIFIER DEBUG] First 500 chars:",
    normalizedText.substring(0, 500),
  );
}

// Special filename pattern matching for common naming conventions
function getFilenameTypeBoost(docType, filename) {
  if (docType === DOCUMENT_TYPES.CLAIM_LETTER) {
    // Match: claimletter, claim-letter, claim_letter, claim letter
    if (
      /claim[-_\s]?letter/i.test(filename) ||
      /va[-_\s]?claim/i.test(filename) ||
      /development[-_\s]?letter/i.test(filename)
    ) {
      return 3; // Stronger boost for claim letters
    }
  }
  if (docType === DOCUMENT_TYPES.DD214) {
    // Match: dd214, dd-214, dd_214, dd 214
    if (/dd[-_\s]?214/i.test(filename)) {
      return 3;
    }
  }
  if (docType === DOCUMENT_TYPES.RATING_DECISION) {
    // Match: rating, decision, ratingdecision
    if (
      /rating[-_\s]?decision/i.test(filename) ||
      /decision[-_\s]?letter/i.test(filename)
    ) {
      return 3;
    }
  }
  return 0;
}

function scoreDocumentType(
  docType,
  config,
  normalizedText,
  filenameHints,
  filename,
) {
  let score = 0;
  const matchedPatterns = [];
  const matchedNegativePatterns = [];

  // Check positive patterns
  for (const pattern of config.patterns) {
    if (pattern.test(normalizedText)) {
      score += config.weight;
      matchedPatterns.push(pattern.source);
    }
  }

  // Check negative patterns (reduce score if found)
  // This helps disambiguate similar document types
  if (config.negativePatterns) {
    for (const negPattern of config.negativePatterns) {
      if (negPattern.test(normalizedText)) {
        // Heavy penalty for finding negative patterns
        score -= config.weight * 2;
        matchedNegativePatterns.push(negPattern.source);
      }
    }
  }

  // Filename hints (small boost)
  // Check for document type in filename with flexible matching
  if (filenameHints.includes(docType.toLowerCase())) {
    score += 1;
  }

  score += getFilenameTypeBoost(docType, filename);

  return { score, matchedPatterns, matchedNegativePatterns };
}

function logDocTypeScore(
  docType,
  matchedPatterns,
  matchedNegativePatterns,
  score,
) {
  if (matchedPatterns.length === 0 && matchedNegativePatterns.length === 0) {
    return;
  }
  // eslint-disable-next-line no-console
  console.log(`🔍 [CLASSIFIER DEBUG] ${docType}:`);
  // eslint-disable-next-line no-console
  console.log(
    `   ✅ Matched patterns (${matchedPatterns.length}):`,
    matchedPatterns,
  );
  // eslint-disable-next-line no-console
  console.log(
    `   ❌ Negative patterns (${matchedNegativePatterns.length}):`,
    matchedNegativePatterns,
  );
  // eslint-disable-next-line no-console
  console.log(`   📊 Final score: ${score}`);
}

function findBestMatch(scores) {
  let bestType = DOCUMENT_TYPES.UNKNOWN;
  let bestScore = 0;
  let bestCategory = "unknown";
  let bestPriority = 0;

  for (const [docType, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestType = docType;
      bestCategory = CLASSIFICATION_PATTERNS[docType].category;
      bestPriority = CLASSIFICATION_PATTERNS[docType].priority;
    }
  }

  return { bestType, bestScore, bestCategory, bestPriority };
}

// ============================================================
// IMPROVED CONFIDENCE CALCULATION FOR DD214s
//
// Old method was dividing by ALL possible patterns across ALL doc types
// which gave artificially low scores (34% for a valid DD214).
//
// New method: Score relative to the SPECIFIC document type's maximum,
// with bonuses for finding multiple key indicators.
// ============================================================
function computeConfidence(bestType, bestScore, matches, filenameHints) {
  if (bestType === DOCUMENT_TYPES.UNKNOWN) {
    return 0;
  }

  const docConfig = CLASSIFICATION_PATTERNS[bestType];
  const maxForThisType = docConfig.weight * docConfig.patterns.length;
  const baseConfidence = Math.round((bestScore / maxForThisType) * 100);

  // Bonus confidence for finding multiple patterns (more = more certain)
  const matchedCount = matches[bestType]?.length || 0;
  const patternBonus = Math.min(20, matchedCount * 5); // Up to 20% bonus

  // Bonus for high-priority document types (DD214, rating decisions)
  const priorityBonus = docConfig.priority >= 9 ? 10 : 0;

  // Filename match bonus
  const filenameBonus = filenameHints.includes(bestType.toLowerCase()) ? 10 : 0;

  let confidence = Math.min(
    100,
    baseConfidence + patternBonus + priorityBonus + filenameBonus,
  );

  // Floor: If we matched ANY DD214/service record pattern, minimum 60% confidence
  if (
    (bestType === DOCUMENT_TYPES.DD214 ||
      bestType === DOCUMENT_TYPES.NGB22 ||
      bestType === DOCUMENT_TYPES.DD215) &&
    matchedCount >= 1
  ) {
    confidence = Math.max(60, confidence);
  }

  // If we matched 2+ patterns on critical docs, minimum 75%
  if (
    (bestType === DOCUMENT_TYPES.DD214 ||
      bestType === DOCUMENT_TYPES.RATING_DECISION) &&
    matchedCount >= 2
  ) {
    confidence = Math.max(75, confidence);
  }

  return confidence;
}

function logClassificationResult(
  bestType,
  bestScore,
  confidence,
  matches,
  scores,
) {
  // eslint-disable-next-line no-console
  console.log("🏆 [CLASSIFIER DEBUG] ==== CLASSIFICATION RESULT ====");
  // eslint-disable-next-line no-console
  console.log(`🏆 [CLASSIFIER DEBUG] WINNER: ${bestType}`);
  // eslint-disable-next-line no-console
  console.log(`🏆 [CLASSIFIER DEBUG] Score: ${bestScore}`);
  // eslint-disable-next-line no-console
  console.log(`🏆 [CLASSIFIER DEBUG] Confidence: ${confidence}%`);
  // eslint-disable-next-line no-console
  console.log(
    `🏆 [CLASSIFIER DEBUG] Matched patterns:`,
    matches[bestType] || [],
  );
  // eslint-disable-next-line no-console
  console.log("🏆 [CLASSIFIER DEBUG] ================================");

  // Also log if there were close competitors
  const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (sortedScores.length > 1) {
    // eslint-disable-next-line no-console
    console.log(
      "🥈 [CLASSIFIER DEBUG] Runner-up:",
      sortedScores[1]?.[0],
      "with score",
      sortedScores[1]?.[1],
    );
  }
}

/**
 * Classify a document based on its text content
 * @param {string} text - The document text
 * @param {string} filename - Optional filename for additional hints
 * @returns {Object} Classification result with type, confidence, and metadata
 */
export const classifyDocument = (text, filename = "") => {
  // Enable debug mode for classification troubleshooting
  const DEBUG_CLASSIFICATION = true;

  if (!text || typeof text !== "string") {
    return {
      type: DOCUMENT_TYPES.UNKNOWN,
      confidence: 0,
      category: "unknown",
      priority: 0,
      matches: [],
    };
  }

  // Normalize text for analysis - INCREASED to 10KB to catch more content
  const normalizedText = text.substring(0, 10000);
  const filenameHints = filename.toLowerCase();

  if (DEBUG_CLASSIFICATION) {
    logClassificationStart(filename, text, normalizedText);
  }

  const scores = {};
  const matches = {};
  const negativeMatches = {};
  const debugInfo = {};

  // Score each document type
  for (const [docType, config] of Object.entries(CLASSIFICATION_PATTERNS)) {
    const { score, matchedPatterns, matchedNegativePatterns } =
      scoreDocumentType(
        docType,
        config,
        normalizedText,
        filenameHints,
        filename,
      );

    if (DEBUG_CLASSIFICATION) {
      logDocTypeScore(docType, matchedPatterns, matchedNegativePatterns, score);
    }

    // Store debug info
    debugInfo[docType] = {
      positiveMatches: matchedPatterns,
      negativeMatches: matchedNegativePatterns,
      rawScore: score,
    };

    // IMPORTANT: Only add to scores if score > 0 (after penalties)
    if (score > 0) {
      scores[docType] = score;
      matches[docType] = matchedPatterns;
      negativeMatches[docType] = matchedNegativePatterns;
    }
  }

  if (DEBUG_CLASSIFICATION) {
    // eslint-disable-next-line no-console
    console.log("🔍 [CLASSIFIER DEBUG] Final scores:", scores);
  }

  // Find best match
  const { bestType, bestScore, bestCategory, bestPriority } =
    findBestMatch(scores);

  const confidence = computeConfidence(
    bestType,
    bestScore,
    matches,
    filenameHints,
  );

  // Final debug output showing the winner
  if (DEBUG_CLASSIFICATION) {
    logClassificationResult(bestType, bestScore, confidence, matches, scores);
  }

  return {
    type: bestType,
    confidence,
    category: bestCategory,
    priority: bestPriority,
    matches: matches[bestType] || [],
    allScores: scores,
    matchedPatternCount: matches[bestType]?.length || 0,
    // Include debug info in result for troubleshooting
    _debug: DEBUG_CLASSIFICATION ? debugInfo : undefined,
  };
};

/**
 * Classify multiple documents and group by type
 * @param {Array<{text: string, filename: string}>} documents
 * @returns {Object} Grouped documents by type
 */
export const classifyDocumentBatch = (documents) => {
  const classified = documents.map((doc, index) => ({
    index,
    filename: doc.filename || `Document ${index + 1}`,
    text: doc.text,
    classification: classifyDocument(doc.text, doc.filename),
    size: doc.text.length,
  }));

  // Group by type
  const grouped = {};
  for (const doc of classified) {
    const type = doc.classification.type;
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(doc);
  }

  // Sort each group by priority then confidence
  for (const type in grouped) {
    grouped[type].sort((a, b) => {
      if (a.classification.priority !== b.classification.priority) {
        return b.classification.priority - a.classification.priority;
      }
      return b.classification.confidence - a.classification.confidence;
    });
  }

  return {
    grouped,
    summary: {
      total: documents.length,
      classified: classified.filter(
        (d) => d.classification.type !== DOCUMENT_TYPES.UNKNOWN,
      ).length,
      unknown: classified.filter(
        (d) => d.classification.type === DOCUMENT_TYPES.UNKNOWN,
      ).length,
      types: Object.keys(grouped),
    },
  };
};

/**
 * Get human-readable label for document type
 */
export const getDocumentTypeLabel = (type) => {
  const labels = {
    [DOCUMENT_TYPES.DD214]: "DD214 (Service Record)",
    [DOCUMENT_TYPES.DD215]: "DD215 (Corrected DD214)",
    [DOCUMENT_TYPES.NGB22]: "NGB22 (National Guard)",
    [DOCUMENT_TYPES.DD256]: "DD256 (Reserve Discharge)",
    [DOCUMENT_TYPES.DD257]: "DD257 (Reserve Discharge)",
    [DOCUMENT_TYPES.RATING_DECISION]: "VA Rating Decision",
    [DOCUMENT_TYPES.CLAIM_LETTER]: "VA Claim Letter",
    [DOCUMENT_TYPES.C_FILE_MEDICAL]: "C-File Medical Record",
    [DOCUMENT_TYPES.DBQ]: "Disability Benefits Questionnaire",
    [DOCUMENT_TYPES.NEXUS_LETTER]: "Nexus Letter",
    [DOCUMENT_TYPES.PERSONAL_STATEMENT]: "Personal Statement",
    [DOCUMENT_TYPES.VA_CORRESPONDENCE]: "VA Correspondence",
    [DOCUMENT_TYPES.MEDICAL_RECORD]: "Medical Record",
    [DOCUMENT_TYPES.EXAM_REPORT]: "Examination Report",
    [DOCUMENT_TYPES.UNKNOWN]: "Unknown Document",
  };

  return labels[type] || "Unknown Document";
};

/**
 * Determine processing strategy based on document type
 */
export const getProcessingStrategy = (documentType) => {
  const strategies = {
    [DOCUMENT_TYPES.DD214]: {
      priority: "critical",
      processor: "dd214Analyzer",
      extractors: ["serviceInfo", "awards", "dates", "mos"],
      autoFill: [
        "branch",
        "serviceStartDate",
        "serviceEndDate",
        "characterOfService",
      ],
    },
    [DOCUMENT_TYPES.RATING_DECISION]: {
      priority: "critical",
      processor: "ratingParser",
      extractors: ["conditions", "ratings", "effectiveDate", "combinedRating"],
      autoFill: ["currentCombinedRating", "effectiveDate"],
    },
    [DOCUMENT_TYPES.CLAIM_LETTER]: {
      priority: "high",
      processor: "claimParser",
      extractors: ["claimedConditions", "claimNumber", "claimDate"],
      autoFill: ["claimNumber"],
    },
    [DOCUMENT_TYPES.DBQ]: {
      priority: "high",
      processor: "dbqParser",
      extractors: ["condition", "diagnosis", "nexusOpinion", "limitations"],
      autoFill: [],
    },
    [DOCUMENT_TYPES.C_FILE_MEDICAL]: {
      priority: "medium",
      processor: "medicalRecordParser",
      extractors: ["diagnoses", "treatments", "symptoms", "dates"],
      autoFill: [],
    },
    [DOCUMENT_TYPES.NEXUS_LETTER]: {
      priority: "high",
      processor: "nexusParser",
      extractors: ["condition", "opinion", "rationale", "provider"],
      autoFill: [],
    },
  };

  return (
    strategies[documentType] || {
      priority: "low",
      processor: "genericParser",
      extractors: ["text"],
      autoFill: [],
    }
  );
};
