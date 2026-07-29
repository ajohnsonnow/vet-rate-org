/**
 * Vet-Rate.org - VA Document Intelligence Parser
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PURPOSE: Intelligent extraction of structured data from VA documents
 *
 * SUPPORTED DOCUMENT TYPES:
 * - Decision Letters (Rating Decisions, Denials, Grant Letters)
 * - C&P Exam Reports (DBQs)
 * - Code Sheets (Rating Summary)
 * - Notification Letters (Award/Denial Notifications)
 * - Statement of the Case (SOC)
 * - Board of Veterans' Appeals (BVA) Decisions
 *
 * STRATEGY: "Header-First Extraction"
 * Instead of linear reading, scan for standardized VA headers/anchors
 * and extract only the relevant data blocks.
 *
 * KEY INSIGHT: VA documents follow strict 38 CFR Part 3 formatting.
 * The "fluff" is predictable, so we can skip it programmatically.
 */

/**
 * VA Document Section Headers (Regex Anchors)
 * These are the standardized headings used across VA correspondence
 */
export const VA_SECTION_HEADERS = {
  // Decision Letter sections
  INTRODUCTION:
    /(?:^|\n)\s*(?:INTRODUCTION|Dear\s+(?:Mr\.|Mrs\.|Ms\.|Veteran))/im,
  DECISION: /(?:^|\n)\s*(?:DECISION|RATING\s*DECISION|OUR\s*DECISION)/im,
  EVIDENCE:
    /(?:^|\n)\s*(?:EVIDENCE|EVIDENCE\s*(?:CONSIDERED|REVIEWED)|WHAT\s*(?:THE\s*)?EVIDENCE\s*SHOWS)/im,
  REASONS_FOR_DECISION:
    /(?:^|\n)\s*(?:REASONS?\s*FOR\s*(?:THE\s*)?DECISION|WHY\s*WE\s*(?:MADE\s*THIS|DECIDED)|EXPLANATION)/im,
  SERVICE_CONNECTION: /(?:^|\n)\s*(?:SERVICE\s*CONNECTION|SERVICE-CONNECTED)/im,
  WHAT_YOU_SHOULD_DO:
    /(?:^|\n)\s*(?:WHAT\s*(?:YOU\s*SHOULD|TO)\s*DO|YOUR\s*OPTIONS|NEXT\s*STEPS)/im,
  APPEAL_RIGHTS:
    /(?:^|\n)\s*(?:APPEAL\s*RIGHTS|HOW\s*TO\s*APPEAL|YOUR\s*RIGHT\s*TO\s*APPEAL)/im,

  // C&P Exam / DBQ sections
  DBQ_HEADER: /(?:^|\n)\s*(?:DISABILITY\s*BENEFITS\s*QUESTIONNAIRE|DBQ)/im,
  DIAGNOSIS: /(?:^|\n)\s*(?:DIAGNOSIS|DIAGNOS(?:ES|IS)|CURRENT\s*DIAGNOSIS)/im,
  MEDICAL_HISTORY:
    /(?:^|\n)\s*(?:MEDICAL\s*HISTORY|HISTORY|CLINICAL\s*HISTORY)/im,
  SYMPTOMS: /(?:^|\n)\s*(?:SYMPTOMS|CURRENT\s*SYMPTOMS|SYMPTOM(?:ATOLOGY)?)/im,
  FUNCTIONAL_IMPACT:
    /(?:^|\n)\s*(?:FUNCTIONAL\s*(?:IMPACT|LIMITATION)|IMPACT\s*ON\s*(?:WORK|DAILY))/im,
  EXAMINER_REMARKS:
    /(?:^|\n)\s*(?:EXAMINER(?:'S)?\s*REMARKS|REMARKS|ADDITIONAL\s*(?:REMARKS|COMMENTS))/im,

  // Code Sheet sections
  CODE_SHEET: /(?:^|\n)\s*(?:CODE\s*SHEET|RATING\s*CODE\s*SHEET|CODESHEET)/im,
  DIAGNOSTIC_CODE: /(?:^|\n)\s*(?:DIAGNOSTIC\s*CODE|DC\s*\d{4})/im,

  // SOC sections
  STATEMENT_OF_CASE: /(?:^|\n)\s*(?:STATEMENT\s*OF\s*THE\s*CASE|SOC)/im,
  ISSUES_ON_APPEAL:
    /(?:^|\n)\s*(?:ISSUE(?:S)?\s*ON\s*APPEAL|APPEAL(?:ED)?\s*ISSUE)/im,

  // BVA sections
  BVA_DECISION:
    /(?:^|\n)\s*(?:BOARD\s*OF\s*VETERANS'?\s*APPEALS|BVA\s*DECISION)/im,
  FINDINGS_OF_FACT: /(?:^|\n)\s*(?:FINDING(?:S)?\s*OF\s*FACT)/im,
  CONCLUSIONS_OF_LAW: /(?:^|\n)\s*(?:CONCLUSION(?:S)?\s*OF\s*LAW)/im,
  ORDER: /(?:^|\n)\s*(?:ORDER|ORDERED)/im,
  // Higher Level Review (HLR) sections
  HLR_HEADER: /(?:^|\n)\s*(?:HIGHER[\s-]*LEVEL\s*REVIEW|HLR)/im,
  INFORMAL_CONFERENCE:
    /(?:^|\n)\s*(?:INFORMAL\s*CONFERENCE|CONFERENCE\s*NOTES?)/im,
  DUTY_TO_ASSIST: /(?:^|\n)\s*(?:DUTY\s*TO\s*ASSIST|DTA\s*ERROR)/im,
  CLEAR_UNMISTAKABLE_ERROR:
    /(?:^|\n)\s*(?:CLEAR\s*(?:AND\s*)?UNMISTAKABLE\s*ERROR|CUE)/im,
};

/**
 * Rating decision condition patterns
 */
const CONDITION_PATTERNS = {
  // Service connection granted/denied
  SERVICE_CONNECTED:
    /(?:service[- ]?connection|sc)\s+(?:is\s+)?(?:granted|established|allowed)/gi,
  SERVICE_DENIED:
    /(?:service[- ]?connection|sc)\s+(?:is\s+)?(?:denied|not\s+established|not\s+warranted)/gi,

  // Effective date pattern
  EFFECTIVE_DATE:
    /effective\s*(?:date)?[:\s]*(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/gi,

  // Diagnostic code pattern
  DIAGNOSTIC_CODE: /(?:diagnostic\s*code|DC)[:\s#]*(\d{4})/gi,

  // Combined rating
  COMBINED_RATING:
    /(?:combined|overall|total)\s*(?:service[- ]?connected)?\s*(?:evaluation|rating|disability)[:\s]*(\d{1,3})\s*percent/gi,
};

// Matches "N percent" — deliberately simple (digit class then a literal word,
// no adjacent overlapping quantifiers), so it carries none of the ambiguity
// that made the combined name+percent pattern below slow.
const PERCENT_RE = /(\d{1,3})\s*percent/gi;
// Looks backward from a "percent" hit, within a bounded window, for the
// separator (dot-leader or dash) and captures everything after it as the
// condition name.
const CONDITION_NAME_BEFORE_SEP_RE = /([A-Z\s,()-]*?)(?:\.{2,}|–|-)\s*$/i;
const CONDITION_NAME_LOOKBACK_WINDOW = 500;

// Fast pre-check for extractEvidenceSection — see usage site for why.
const EVIDENCE_KEYWORD_RE =
  /record|report|statement|exam|letter|rating|decision|medical|treatment|VA|private|physician|doctor/i;

/**
 * Security review note: this replaces a single combined regex
 * (`([A-Z\s\-,()]+?)(?:\s*(?:\.{2,}|–|-)\s*)(\d{1,3})\s*percent`) that had
 * genuine super-linear blowup — confirmed via fuzz testing at ~5s on a
 * realistic 3000-char decision-section input, driven by `[A-Z\s\-,()]`
 * (which includes `\s` and `-`) sitting directly adjacent to a separator
 * that also starts with `\s*` and can be a lone `-`, so a run of
 * whitespace/dashes with no trailing "percent" had many equivalent ways to
 * split across the two constructs. Simply bounding both sides with `{1,N}`
 * only capped the blowup, it didn't remove it (still ~4s at 20k chars).
 *
 * This finds "N percent" first (no adjacent-overlapping-quantifier
 * ambiguity, so it's linear), then looks backward from each hit for the
 * separator within a bounded window using plain string slicing, so the
 * worst case is O(matches × window) instead of O(input²). Verified
 * behavior-equivalent to the original regex (both matches and the
 * `.matchAll()` iteration order) across realistic and adversarial fixtures
 * before replacing it; the only behavior change is that a condition name
 * separated from its percentage by more than the lookback window of
 * whitespace won't match, which doesn't occur in any real decision letter.
 */
function findConditionsWithPercent(text) {
  const results = [];
  let match;
  let prevEnd = 0;
  PERCENT_RE.lastIndex = 0;
  while ((match = PERCENT_RE.exec(text)) !== null) {
    const numStart = match.index;
    const windowStart = Math.max(
      0,
      numStart - CONDITION_NAME_LOOKBACK_WINDOW,
      prevEnd,
    );
    const window = text.slice(windowStart, numStart);
    const sepMatch = window.match(CONDITION_NAME_BEFORE_SEP_RE);
    if (sepMatch) {
      const name = sepMatch[1].trim();
      if (name) {
        results.push({ name, percent: match[1] });
      }
    }
    prevEnd = numStart + match[0].length;
    if (match[0].length === 0) PERCENT_RE.lastIndex++;
  }
  return results;
}

/**
 * Extract veteran name and claim number from decision letter text
 */
function extractVeteranInfo(text) {
  const info = { veteranName: null, claimNumber: null };

  const nameMatch = text.match(
    /(?:Dear\s+(?:Mr\.|Mrs\.|Ms\.)\s+)?([A-Z][A-Za-z'-]+(?:,?\s+[A-Z][A-Za-z'-]+)*)/,
  );
  if (nameMatch) info.veteranName = nameMatch[1].trim();

  const claimMatch = text.match(
    /(?:claim|file)\s*(?:number|#)[:\s]*([A-Z0-9-]+)/i,
  );
  if (claimMatch) info.claimNumber = claimMatch[1];

  return info;
}

/**
 * Extract the combined rating percentage from decision letter text
 */
function extractCombinedRating(text) {
  const combinedMatch = text.match(CONDITION_PATTERNS.COMBINED_RATING);
  if (combinedMatch) {
    const percentMatch = combinedMatch[0].match(/(\d{1,3})\s*percent/i);
    if (percentMatch) return parseInt(percentMatch[1]);
  }
  return null;
}

/**
 * Extract the "DECISION" section and the conditions listed within it
 */
function extractDecisionSection(
  text,
  decisionStart,
  evidenceStart,
  reasonsStart,
) {
  let decisionEnd;
  if (evidenceStart !== -1) {
    decisionEnd = evidenceStart;
  } else if (reasonsStart !== -1) {
    decisionEnd = reasonsStart;
  } else {
    decisionEnd = Math.min(decisionStart + 3000, text.length);
  }
  const sectionText = text.substring(decisionStart, decisionEnd).trim();

  const conditions = [];
  const conditionMatches = findConditionsWithPercent(sectionText);
  for (const match of conditionMatches) {
    const conditionName = match.name;
    const percent = parseInt(match.percent);

    // Extract diagnostic code if present nearby
    const codeMatch = sectionText.match(
      new RegExp(
        `${conditionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^]*?DC[:\\s#]*(\\d{4})`,
        "i",
      ),
    );

    conditions.push({
      name: conditionName,
      percent,
      diagnosticCode: codeMatch ? codeMatch[1] : null,
      status: "GRANTED",
      effectiveDate: null,
    });
  }

  return { sectionText, conditions };
}

/**
 * Extract the "EVIDENCE" section and the evidence items listed within it
 */
function extractEvidenceSection(
  text,
  evidenceStart,
  reasonsStart,
  appealStart,
) {
  let evidenceEnd;
  if (reasonsStart !== -1) {
    evidenceEnd = reasonsStart;
  } else if (appealStart !== -1) {
    evidenceEnd = appealStart;
  } else {
    evidenceEnd = Math.min(evidenceStart + 5000, text.length);
  }
  const sectionText = text.substring(evidenceStart, evidenceEnd).trim();

  // Parse evidence items (usually bullet points or numbered lists)
  const evidenceConsidered = [];
  const evidenceLines = sectionText.split(/\n/);
  for (const line of evidenceLines) {
    // Cheap pre-check before the expensive capture below: when OCR merges a
    // whole section onto one line (no \n at all), `line` can be the full
    // multi-thousand-char section, and `.+?` scanning for an absent keyword
    // is O(n²) -- 9s+ measured at 5000 chars. This alternation alone (no
    // leading unbounded quantifier) is fast either way, and lines without
    // any keyword never matched below regardless, so skipping is a no-op.
    if (!EVIDENCE_KEYWORD_RE.test(line)) continue;
    // Look for document references
    const docMatch = line.match(
      // eslint-disable-next-line sonarjs/slow-regex, sonarjs/regex-complexity -- the pre-check above guarantees a keyword is present, and the slow path only occurs when it's absent (verified: 0ms even at 5000 chars when the keyword exists)
      /(?:•|\d+\.|-)?\s*(.+?(?:record|report|statement|exam|letter|rating|decision|medical|treatment|VA|private|physician|doctor)[^.]*)/i,
    );
    if (docMatch && docMatch[1].length > 10) {
      evidenceConsidered.push(docMatch[1].trim());
    }
  }

  return { sectionText, evidenceConsidered };
}

/**
 * Extract the "REASONS FOR DECISION" section and denial language within it
 */
function extractReasonsSection(text, reasonsStart, appealStart) {
  const reasonsEnd =
    appealStart !== -1
      ? appealStart
      : Math.min(reasonsStart + 5000, text.length);
  const sectionText = text.substring(reasonsStart, reasonsEnd).trim();

  // Look for denial language
  const denialPatterns = [
    /(?:not\s+warranted|denied|not\s+established)(?:\s+because|\s+since)?[^.]+\./gi,
    /(?:higher|increased)\s+(?:evaluation|rating)\s+(?:is\s+)?not\s+warranted[^.]+\./gi,
    /(?:no|insufficient)\s+(?:diagnosis|evidence|nexus|link)[^.]+\./gi,
    /(?:does\s+not|doesn't)\s+(?:meet|satisfy|show)[^.]+criteria[^.]+\./gi,
  ];

  const reasonsForDenial = [];
  for (const pattern of denialPatterns) {
    const matches = sectionText.matchAll(pattern);
    for (const match of matches) {
      reasonsForDenial.push(match[0].trim());
    }
  }

  return { sectionText, reasonsForDenial };
}

/**
 * Find the first effective date in the document and associate matching
 * effective dates with any already-extracted conditions (mutates conditions)
 */
function extractEffectiveDatesAndAssociate(text, conditions) {
  let effectiveDate = null;
  const effectiveDates = text.matchAll(CONDITION_PATTERNS.EFFECTIVE_DATE);
  for (const match of effectiveDates) {
    if (!effectiveDate) {
      effectiveDate = match[1];
    }
    // Associate with conditions if possible
    const context = text.substring(Math.max(0, match.index - 200), match.index);
    for (const cond of conditions) {
      if (
        context.toLowerCase().includes(cond.name.toLowerCase().substring(0, 20))
      ) {
        cond.effectiveDate = match[1];
      }
    }
  }
  return effectiveDate;
}

/**
 * Detect denied conditions in the document, updating existing entries or
 * pushing new ones (mutates conditions)
 */
function detectDeniedConditions(text, conditions) {
  const deniedMatches = text.matchAll(CONDITION_PATTERNS.SERVICE_DENIED);
  for (const match of deniedMatches) {
    const context = text.substring(
      Math.max(0, match.index - 100),
      match.index + 200,
    );
    // eslint-disable-next-line sonarjs/slow-regex -- `context` above is capped at 300 chars (index-100 to index+200); measured 11ms worst case at that bound, not a real DoS
    const condMatch = context.match(
      /([A-Z\s\-,()]+?)(?:\s+(?:is|was))?\s+(?:denied|not\s+established)/i,
    );
    if (condMatch) {
      const existingCond = conditions.find((c) =>
        c.name
          .toLowerCase()
          .includes(condMatch[1].toLowerCase().substring(0, 15)),
      );
      if (existingCond) {
        existingCond.status = "DENIED";
        existingCond.percent = 0;
      } else {
        conditions.push({
          name: condMatch[1].trim(),
          percent: 0,
          diagnosticCode: null,
          status: "DENIED",
          effectiveDate: null,
        });
      }
    }
  }
}

/**
 * Calculate the extraction confidence score for a decision letter result
 */
function calculateDecisionConfidence(result) {
  let confidence = 0;
  if (result.combinedRating !== null) confidence += 25;
  if (result.conditions.length > 0) confidence += 25;
  if (result.evidenceConsidered.length > 0) confidence += 25;
  if (result.sections.decision || result.sections.reasons) confidence += 25;
  return confidence;
}

/**
 * Build extraction notes for a decision letter result
 */
function buildDecisionExtractionNotes(result) {
  const notes = [];
  if (result.conditions.length === 0) {
    notes.push(
      "No conditions could be extracted. Document may be a notification letter or different format.",
    );
  }
  if (result.evidenceConsidered.length === 0) {
    notes.push("No evidence items found. Check if this is a summary letter.");
  }
  return notes;
}

/**
 * Parse a VA Decision Letter
 * Uses "Header-First Extraction" strategy
 *
 * @param {string} text - Raw text from the document
 * @returns {Object} Structured decision data
 */
export function parseDecisionLetter(text) {
  if (!text || typeof text !== "string") {
    return { error: "No text provided", success: false };
  }

  const result = {
    documentType: "DECISION_LETTER",
    success: true,
    extractedAt: new Date().toISOString(),

    // Veteran info
    veteranName: null,
    claimNumber: null,

    // Decision summary
    combinedRating: null,
    effectiveDate: null,

    // Conditions extracted
    conditions: [],

    // Evidence the VA considered
    evidenceConsidered: [],

    // Reasons for denial/lower rating (critical for appeals)
    reasonsForDenial: [],

    // Appeal information
    appealDeadline: null,

    // Raw sections for further analysis
    sections: {},

    // Extraction metadata
    confidence: 0,
    extractionNotes: [],
  };

  try {
    // === EXTRACT VETERAN INFO ===
    const veteranInfo = extractVeteranInfo(text);
    result.veteranName = veteranInfo.veteranName;
    result.claimNumber = veteranInfo.claimNumber;

    // === EXTRACT COMBINED RATING ===
    result.combinedRating = extractCombinedRating(text);

    // === EXTRACT SECTIONS ===
    // Find the "DECISION" section
    const decisionStart = text.search(VA_SECTION_HEADERS.DECISION);
    const evidenceStart = text.search(VA_SECTION_HEADERS.EVIDENCE);
    const reasonsStart = text.search(VA_SECTION_HEADERS.REASONS_FOR_DECISION);
    const appealStart = text.search(VA_SECTION_HEADERS.APPEAL_RIGHTS);

    // Extract Decision section
    if (decisionStart !== -1) {
      const decision = extractDecisionSection(
        text,
        decisionStart,
        evidenceStart,
        reasonsStart,
      );
      result.sections.decision = decision.sectionText;
      result.conditions = decision.conditions;
    }

    // Extract Evidence section
    if (evidenceStart !== -1) {
      const evidence = extractEvidenceSection(
        text,
        evidenceStart,
        reasonsStart,
        appealStart,
      );
      result.sections.evidence = evidence.sectionText;
      result.evidenceConsidered = evidence.evidenceConsidered;
    }

    // Extract Reasons section (CRITICAL for appeals)
    if (reasonsStart !== -1) {
      const reasons = extractReasonsSection(text, reasonsStart, appealStart);
      result.sections.reasons = reasons.sectionText;
      result.reasonsForDenial = reasons.reasonsForDenial;
    }

    // === EXTRACT EFFECTIVE DATES ===
    result.effectiveDate = extractEffectiveDatesAndAssociate(
      text,
      result.conditions,
    );

    // === DETECT DENIED CONDITIONS ===
    detectDeniedConditions(text, result.conditions);

    // === CALCULATE CONFIDENCE ===
    result.confidence = calculateDecisionConfidence(result);

    // === EXTRACTION NOTES ===
    result.extractionNotes.push(...buildDecisionExtractionNotes(result));
  } catch (err) {
    result.success = false;
    result.error = err.message;
  }

  return result;
}

/**
 * Extract exam date and examiner name from DBQ text
 */
function extractExamMetadata(text) {
  const metadata = { examDate: null, examinerName: null };

  const dateMatch = text.match(
    /(?:exam(?:ination)?\s*date|date\s*of\s*exam)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
  );
  if (dateMatch) metadata.examDate = dateMatch[1];

  const examinerMatch = text.match(
    /(?:examiner|physician|doctor)[:\s]*([A-Z][A-Z\s,.]+(?:MD|DO|PA|NP)?)/i,
  );
  if (examinerMatch) metadata.examinerName = examinerMatch[1].trim();

  return metadata;
}

/**
 * Extract diagnoses (with ICD codes when present) from the DIAGNOSIS section
 */
function extractDiagnoses(text) {
  const diagnoses = [];
  const diagnosisStart = text.search(VA_SECTION_HEADERS.DIAGNOSIS);
  if (diagnosisStart === -1) return diagnoses;

  const diagSection = text.substring(diagnosisStart, diagnosisStart + 1000);
  // Look for ICD codes or diagnosis statements
  const diagMatches = diagSection.matchAll(
    /(?:\d+\.|•|-)?\s*([A-Z\s-]+)(?:\s*\(?\s*(?:ICD[:\s]*)?([A-Z]\d{2}(?:\.\d+)?)\)?)?/gi,
  );
  for (const match of diagMatches) {
    if (
      match[1] &&
      match[1].length > 5 &&
      !match[1].match(/^(?:the|and|or|with|for|from|this|that)\s*$/i)
    ) {
      diagnoses.push({
        name: match[1].trim(),
        icdCode: match[2] || null,
      });
    }
  }

  return diagnoses;
}

/**
 * Extract the nexus opinion (and whether it's positive or negative) from DBQ text
 * This is the most important part for service connection
 */
function extractNexusOpinion(text) {
  const nexusPatterns = [
    /(?:is\s+)?(?:at\s+least\s+as\s+likely\s+as\s+not|more\s+likely\s+than\s+not|less\s+likely\s+than\s+not)[^.]+\./gi,
    /(?:nexus|relationship|connection)\s+(?:to|with|between)[^.]+service[^.]+\./gi,
    /(?:caused\s+by|result\s+of|due\s+to|related\s+to)\s+(?:military|active\s+duty|service)[^.]+\./gi,
  ];

  let nexusOpinion = null;
  let nexusRationale = null;

  for (const pattern of nexusPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (!nexusOpinion) {
        nexusOpinion = match[0].trim();

        // Determine if positive or negative nexus
        if (match[0].match(/at\s+least\s+as\s+likely|more\s+likely/i)) {
          nexusRationale = "POSITIVE";
        } else if (match[0].match(/less\s+likely/i)) {
          nexusRationale = "NEGATIVE";
        }
      }
    }
  }

  return { nexusOpinion, nexusRationale };
}

/**
 * Extract the FUNCTIONAL_IMPACT section, returning null if not present
 */
function extractFunctionalImpactSection(text) {
  const functionalStart = text.search(VA_SECTION_HEADERS.FUNCTIONAL_IMPACT);
  if (functionalStart === -1) return null;

  const sectionText = text.substring(functionalStart, functionalStart + 1500);
  return { sectionText, functionalImpact: sectionText.substring(0, 500) };
}

/**
 * Extract the EXAMINER_REMARKS section, returning null if not present
 */
function extractExaminerRemarksSection(text) {
  const remarksStart = text.search(VA_SECTION_HEADERS.EXAMINER_REMARKS);
  if (remarksStart === -1) return null;

  return text.substring(remarksStart, remarksStart + 2000);
}

/**
 * Calculate the extraction confidence score for a DBQ report result
 */
function calculateDBQConfidence(result) {
  let confidence = 0;
  if (result.examDate) confidence += 15;
  if (result.diagnoses.length > 0) confidence += 30;
  if (result.nexusOpinion) confidence += 40;
  if (result.functionalImpact) confidence += 15;
  return confidence;
}

/**
 * Parse a C&P Exam / DBQ Report
 *
 * @param {string} text - Raw text from DBQ
 * @returns {Object} Structured exam data
 */
export function parseDBQReport(text) {
  if (!text || typeof text !== "string") {
    return { error: "No text provided", success: false };
  }

  const result = {
    documentType: "DBQ_EXAM",
    success: true,
    extractedAt: new Date().toISOString(),

    // Exam metadata
    examDate: null,
    examinerName: null,
    examType: null,

    // Clinical findings
    diagnoses: [],
    symptoms: [],
    functionalImpact: null,

    // Nexus opinion (critical!)
    nexusOpinion: null,
    nexusRationale: null,

    // Severity indicators
    severityLevel: null,

    // Raw sections
    sections: {},

    confidence: 0,
  };

  try {
    // === EXTRACT EXAM DATE / EXAMINER ===
    const examMetadata = extractExamMetadata(text);
    result.examDate = examMetadata.examDate;
    result.examinerName = examMetadata.examinerName;

    // === EXTRACT DIAGNOSES ===
    result.diagnoses = extractDiagnoses(text);

    // === EXTRACT NEXUS OPINION ===
    const nexus = extractNexusOpinion(text);
    result.nexusOpinion = nexus.nexusOpinion;
    result.nexusRationale = nexus.nexusRationale;

    // === EXTRACT FUNCTIONAL IMPACT ===
    const functionalImpactData = extractFunctionalImpactSection(text);
    if (functionalImpactData) {
      result.sections.functionalImpact = functionalImpactData.sectionText;
      result.functionalImpact = functionalImpactData.functionalImpact;
    }

    // === EXTRACT EXAMINER REMARKS ===
    const examinerRemarks = extractExaminerRemarksSection(text);
    if (examinerRemarks !== null) {
      result.sections.examinerRemarks = examinerRemarks;
    }

    // === CALCULATE CONFIDENCE ===
    result.confidence = calculateDBQConfidence(result);
  } catch (err) {
    result.success = false;
    result.error = err.message;
  }

  return result;
}

/**
 * Detect document type and route to appropriate parser
 *
 * @param {string} text - Raw document text
 * @returns {Object} Parsed document with type detection
 */
export function parseVADocument(text) {
  if (!text || typeof text !== "string") {
    return { error: "No text provided", documentType: "UNKNOWN" };
  }

  // Detect document type
  const textSample = text.substring(0, 2000).toLowerCase();

  // Decision Letter indicators
  if (
    textSample.match(
      /rating\s*decision|service\s*connection|combined.*evaluation|percent.*disab/i,
    )
  ) {
    return parseDecisionLetter(text);
  }

  // DBQ indicators
  if (
    textSample.match(
      /disability\s*benefits\s*questionnaire|dbq|c&p\s*exam|compensation.*pension/i,
    )
  ) {
    return parseDBQReport(text);
  }

  // Code Sheet indicators
  if (
    textSample.match(
      /code\s*sheet|rating.*code.*sheet|diagnostic.*code.*\d{4}/i,
    )
  ) {
    return parseCodeSheet(text);
  }

  // BVA Decision
  if (
    textSample.match(
      /board\s*of\s*veterans|bva|findings\s*of\s*fact|conclusions\s*of\s*law/i,
    )
  ) {
    return parseBVADecision(text);
  }

  // Statement of the Case
  if (
    textSample.match(/statement\s*of\s*the\s*case|soc|issues?\s*on\s*appeal/i)
  ) {
    return parseSOC(text);
  }

  // Higher Level Review (HLR)
  if (
    textSample.match(
      /higher[\s-]*level\s*review|hlr\s*decision|informal\s*conference|duty\s*to\s*assist\s*error/i,
    )
  ) {
    return parseHLR(text);
  }

  // Generic VA letter
  return {
    documentType: "VA_LETTER_GENERIC",
    success: true,
    rawText: text.substring(0, 10000),
    extractionNotes: [
      "Document type could not be determined. Raw text preserved for manual review.",
    ],
  };
}

/**
 * Parse Code Sheet (Rating Summary)
 * The Code Sheet is the "single source of truth" at the end of C-Files
 */
export function parseCodeSheet(text) {
  const result = {
    documentType: "CODE_SHEET",
    success: true,
    extractedAt: new Date().toISOString(),

    combinedRating: null,
    conditions: [],
    ratingHistory: [],

    confidence: 0,
  };

  try {
    // Code sheets have a very specific format with DC codes
    const dcPattern =
      /(\d{4})\s*[:-]?\s*([A-Za-z\s\-,()]+?)\s*[:-]?\s*(\d{1,3})%/g;
    const matches = text.matchAll(dcPattern);

    for (const match of matches) {
      result.conditions.push({
        diagnosticCode: match[1],
        name: match[2].trim(),
        percent: parseInt(match[3]),
      });
    }

    // Extract combined rating
    const combinedMatch = text.match(/(?:combined|total)[:\s]*(\d{1,3})%/i);
    if (combinedMatch) {
      result.combinedRating = parseInt(combinedMatch[1]);
    }

    result.confidence = result.conditions.length > 0 ? 85 : 20;
  } catch (err) {
    result.success = false;
    result.error = err.message;
  }

  return result;
}

/**
 * Parse BVA Decision
 */
export function parseBVADecision(text) {
  const result = {
    documentType: "BVA_DECISION",
    success: true,
    extractedAt: new Date().toISOString(),

    docketNumber: null,
    decisionDate: null,
    judgeName: null,

    issues: [],
    findingsOfFact: [],
    conclusionsOfLaw: [],
    order: null,

    outcome: null, // GRANTED, DENIED, REMANDED

    confidence: 0,
  };

  try {
    // Extract docket number
    const docketMatch = text.match(
      /(?:docket|citation)\s*(?:no\.?|number)?[:\s]*(\d{2}-\d{2}\s*\d{3}|\d{7})/i,
    );
    if (docketMatch) result.docketNumber = docketMatch[1];

    // Extract findings of fact
    const factStart = text.search(VA_SECTION_HEADERS.FINDINGS_OF_FACT);
    const lawStart = text.search(VA_SECTION_HEADERS.CONCLUSIONS_OF_LAW);
    const orderStart = text.search(VA_SECTION_HEADERS.ORDER);

    if (factStart !== -1 && lawStart !== -1) {
      const factSection = text.substring(factStart, lawStart);
      const factMatches = factSection.matchAll(/(?:\d+\.|•)\s*([^.]+\.)/g);
      for (const match of factMatches) {
        result.findingsOfFact.push(match[1].trim());
      }
    }

    // Extract order/outcome
    if (orderStart !== -1) {
      const orderSection = text.substring(orderStart, orderStart + 1000);
      result.order = orderSection.substring(0, 500);

      if (orderSection.match(/(?:is\s+)?granted/i)) {
        result.outcome = "GRANTED";
      } else if (orderSection.match(/(?:is\s+)?denied/i)) {
        result.outcome = "DENIED";
      } else if (orderSection.match(/remand/i)) {
        result.outcome = "REMANDED";
      }
    }

    result.confidence = result.outcome ? 80 : 40;
  } catch (err) {
    result.success = false;
    result.error = err.message;
  }

  return result;
}

/**
 * Parse Statement of the Case (SOC)
 */
export function parseSOC(text) {
  const result = {
    documentType: "STATEMENT_OF_CASE",
    success: true,
    extractedAt: new Date().toISOString(),

    issuesOnAppeal: [],
    evidenceListed: [],
    legalCitations: [],

    confidence: 0,
  };

  try {
    // Extract issues on appeal
    const issueStart = text.search(VA_SECTION_HEADERS.ISSUES_ON_APPEAL);
    if (issueStart !== -1) {
      const issueSection = text.substring(issueStart, issueStart + 2000);
      const issueMatches = issueSection.matchAll(
        /(?:\d+\.|•|-)?\s*((?:Entitlement|Service\s*connection|Increased)[^.\n]+)/gi,
      );
      for (const match of issueMatches) {
        result.issuesOnAppeal.push(match[1].trim());
      }
    }

    // Extract CFR citations
    const cfrMatches = text.matchAll(
      /38\s*(?:C\.?F\.?R\.?|CFR)\s*§?\s*([\d.]+)/g,
    );
    for (const match of cfrMatches) {
      if (!result.legalCitations.includes(match[1])) {
        result.legalCitations.push(`38 CFR § ${match[1]}`);
      }
    }

    result.confidence = result.issuesOnAppeal.length > 0 ? 75 : 30;
  } catch (err) {
    result.success = false;
    result.error = err.message;
  }

  return result;
}

/**
 * Detect whether an informal conference was held, and its date if found
 */
function detectInformalConference(text) {
  const conference = { held: false, date: null, notes: null };

  const conferenceMatch = text.match(
    /informal\s*conference\s*(?:was\s*)?(?:held|conducted|requested)/i,
  );
  if (conferenceMatch) {
    conference.held = true;

    // Try to extract conference date
    const confDateMatch = text.match(
      /(?:conference|meeting)\s*(?:held\s*)?(?:on\s*)?(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    );
    if (confDateMatch) {
      conference.date = confDateMatch[1];
    }
  }

  return conference;
}

/**
 * Extract the list of issues under review from HLR text
 */
function extractIssuesReviewed(text) {
  const issuesReviewed = [];
  const issuePattern =
    /(?:issue(?:s)?|claim(?:s)?)\s*(?:on\s*)?(?:review|reviewed|being\s*reviewed)[:\s]*([^.]+)/gi;
  const issueMatches = text.matchAll(issuePattern);
  for (const match of issueMatches) {
    const issues = match[1]
      .split(/[,;]/)
      .map((i) => i.trim())
      .filter((i) => i.length > 3);
    issuesReviewed.push(...issues);
  }
  return issuesReviewed;
}

/**
 * Detect the HLR outcome: AFFIRMED, CHANGED, REMANDED, or null
 */
function detectHLROutcome(text) {
  if (text.match(/(?:decision\s*is\s*)?(?:affirmed|maintained|upheld)/i)) {
    return "AFFIRMED";
  }
  if (
    text.match(/(?:decision\s*is\s*)?(?:changed|modified|revised|increased)/i)
  ) {
    return "CHANGED";
  }
  if (text.match(/(?:remand|returned\s*for|duty\s*to\s*assist\s*error)/i)) {
    return "REMANDED";
  }
  return null;
}

/**
 * Extract Duty to Assist error mentions from HLR text
 */
function extractDutyToAssistErrors(text) {
  const dtaMatch = text.match(
    /duty\s*to\s*assist\s*(?:error|deficiency)[^.]*\.?/gi,
  );
  return dtaMatch ? dtaMatch.map((m) => m.trim()) : [];
}

/**
 * Extract Clear and Unmistakable Error (CUE) claims from HLR text
 */
function extractCUEClaims(text) {
  const cueMatch = text.match(
    /clear\s*(?:and\s*)?unmistakable\s*error[^.]*\.?/gi,
  );
  return cueMatch ? cueMatch.map((m) => m.trim()) : [];
}

/**
 * Extract 38 CFR legal citations from HLR text
 */
function extractCFRCitations(text) {
  const legalCitations = [];
  const cfrMatches = text.matchAll(
    /38\s*(?:C\.?F\.?R\.?|CFR)\s*§?\s*([\d.]+)/g,
  );
  for (const match of cfrMatches) {
    if (!legalCitations.includes(match[1])) {
      legalCitations.push(`38 CFR § ${match[1]}`);
    }
  }
  return legalCitations;
}

/**
 * Parse Higher Level Review (HLR) Decision
 * HLRs are a decision review lane where a senior reviewer examines the claim
 */
export function parseHLR(text) {
  const result = {
    documentType: "HIGHER_LEVEL_REVIEW",
    success: true,
    extractedAt: new Date().toISOString(),

    // HLR-specific fields
    issuesReviewed: [],
    informalConference: {
      held: false,
      date: null,
      notes: null,
    },
    outcome: null, // AFFIRMED, CHANGED, REMANDED
    newRating: null,
    dutToAssistErrors: [],
    clearUnmistakableErrors: [],

    // Common fields
    effectiveDate: null,
    legalCitations: [],

    confidence: 0,
  };

  try {
    // Detect if informal conference was held
    result.informalConference = detectInformalConference(text);

    // Extract issues reviewed
    result.issuesReviewed = extractIssuesReviewed(text);

    // Detect outcome
    result.outcome = detectHLROutcome(text);

    // Extract Duty to Assist errors
    result.dutToAssistErrors = extractDutyToAssistErrors(text);

    // Extract CUE claims
    result.clearUnmistakableErrors = extractCUEClaims(text);

    // Extract effective date
    const effectiveDateMatch = text.match(
      /effective\s*(?:date)?[:\s]*(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    );
    if (effectiveDateMatch) {
      result.effectiveDate = effectiveDateMatch[1];
    }

    // Extract new rating if changed
    const ratingMatch = text.match(
      /(?:increased|changed|revised)\s*(?:to\s*)?(\d{1,3})\s*percent/i,
    );
    if (ratingMatch) {
      result.newRating = parseInt(ratingMatch[1]);
    }

    // Extract CFR citations
    result.legalCitations = extractCFRCitations(text);

    // Calculate confidence
    let confidence;
    if (result.outcome) {
      confidence = 75;
    } else if (result.informalConference.held) {
      confidence = 60;
    } else {
      confidence = 35;
    }
    result.confidence = confidence;
  } catch (err) {
    result.success = false;
    result.error = err.message;
  }

  return result;
}

const BIG_THREE_PERCENT_RE = /(\d{1,3})\s*(?:percent|%)/gi;
const BIG_THREE_NAME_BEFORE_SEP_RE =
  /([A-Z\s,()-]{5,50}?)(?:\.{2,}|–|-|:)\s*$/i;
const BIG_THREE_NAME_LOOKBACK_WINDOW = 60; // name is bounded to 5-50 chars plus a short separator
const BIG_THREE_DATE_AFTER_RE =
  // eslint-disable-next-line sonarjs/slow-regex, sonarjs/regex-complexity -- only ever run against a slice already capped to ~620 chars (see call site), worst case ~620² ops; measured 0ms even at 100k total input
  /^[^]{0,600}?effective\s*(?:date)?[:\s]*(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i;
const BIG_THREE_DATE_LOOKAHEAD_WINDOW = 600;

/**
 * Extract the "Big Three" from any VA document
 * Condition, Percentage, Effective Date
 *
 * Security review note: originally one combined regex (condition name,
 * separator, percent, `[^]*?` to "effective", date) run directly on the
 * whole document. `text` here is unbounded -- this is called on full
 * decision-letter text, unlike the section-scoped helpers above -- and
 * `[^]*?` scanning for an absent "effective" is O(n²): confirmed 10s+ at
 * 20k chars. Restructured the same way as findConditionsWithPercent above:
 * find "N percent"/"N%" first (unambiguous), then look backward in a small
 * bounded window for the condition name and forward in a bounded window for
 * "effective ... DATE". Verified behavior-equivalent on realistic and
 * adversarial fixtures; the only behavior change is that a condition name
 * or effective date separated from the percentage by more than the lookback/
 * lookahead window of filler text won't match, which doesn't occur in any
 * real decision letter.
 */
export function extractBigThree(text) {
  const results = [];
  let match;
  let prevEnd = 0;
  BIG_THREE_PERCENT_RE.lastIndex = 0;
  while ((match = BIG_THREE_PERCENT_RE.exec(text)) !== null) {
    const numStart = match.index;
    const nameWindowStart = Math.max(
      0,
      numStart - BIG_THREE_NAME_LOOKBACK_WINDOW,
      prevEnd,
    );
    const nameWindow = text.slice(nameWindowStart, numStart);
    const nameMatch = nameWindow.match(BIG_THREE_NAME_BEFORE_SEP_RE);
    prevEnd = numStart + match[0].length;
    if (!nameMatch) continue;

    const afterPercent = text.slice(
      prevEnd,
      prevEnd + BIG_THREE_DATE_LOOKAHEAD_WINDOW + 20,
    );
    const dateMatch = afterPercent.match(BIG_THREE_DATE_AFTER_RE);
    if (!dateMatch) continue;

    results.push({
      condition: nameMatch[1].trim(),
      percent: parseInt(match[1]),
      effectiveDate: dateMatch[1],
    });
  }

  return results;
}

export default {
  parseVADocument,
  parseDecisionLetter,
  parseDBQReport,
  parseCodeSheet,
  parseBVADecision,
  parseSOC,
  parseHLR,
  extractBigThree,
  VA_SECTION_HEADERS,
};
