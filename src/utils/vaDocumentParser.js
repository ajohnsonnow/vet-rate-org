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
    /(?:^|\n)\s*(?:BOARD\s*OF\s*VETERANS['']?\s*APPEALS|BVA\s*DECISION)/im,
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
  // Standard format: "Condition Name ... XX percent"
  CONDITION_WITH_PERCENT:
    /([A-Za-z\s\-,()]+?)(?:\s*(?:\.{2,}|–|-)\s*)(\d{1,3})\s*percent/gi,

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
    const nameMatch = text.match(
      /(?:Dear\s+(?:Mr\.|Mrs\.|Ms\.)\s+)?([A-Z][A-Za-z'-]+(?:,?\s+[A-Z][A-Za-z'-]+)*)/,
    );
    if (nameMatch) result.veteranName = nameMatch[1].trim();

    const claimMatch = text.match(
      /(?:claim|file)\s*(?:number|#)[:\s]*([A-Z0-9-]+)/i,
    );
    if (claimMatch) result.claimNumber = claimMatch[1];

    // === EXTRACT COMBINED RATING ===
    const combinedMatch = text.match(CONDITION_PATTERNS.COMBINED_RATING);
    if (combinedMatch) {
      const percentMatch = combinedMatch[0].match(/(\d{1,3})\s*percent/i);
      if (percentMatch) result.combinedRating = parseInt(percentMatch[1]);
    }

    // === EXTRACT SECTIONS ===
    // Find the "DECISION" section
    const decisionStart = text.search(VA_SECTION_HEADERS.DECISION);
    const evidenceStart = text.search(VA_SECTION_HEADERS.EVIDENCE);
    const reasonsStart = text.search(VA_SECTION_HEADERS.REASONS_FOR_DECISION);
    const appealStart = text.search(VA_SECTION_HEADERS.APPEAL_RIGHTS);

    // Extract Decision section
    if (decisionStart !== -1) {
      const decisionEnd =
        evidenceStart !== -1
          ? evidenceStart
          : reasonsStart !== -1
            ? reasonsStart
            : Math.min(decisionStart + 3000, text.length);
      result.sections.decision = text
        .substring(decisionStart, decisionEnd)
        .trim();

      // Parse conditions from decision section
      const conditionMatches = result.sections.decision.matchAll(
        CONDITION_PATTERNS.CONDITION_WITH_PERCENT,
      );
      for (const match of conditionMatches) {
        const conditionName = match[1].trim();
        const percent = parseInt(match[2]);

        // Extract diagnostic code if present nearby
        const codeMatch = result.sections.decision.match(
          new RegExp(
            `${conditionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^]*?DC[:\\s#]*(\\d{4})`,
            "i",
          ),
        );

        result.conditions.push({
          name: conditionName,
          percent,
          diagnosticCode: codeMatch ? codeMatch[1] : null,
          status: "GRANTED",
          effectiveDate: null,
        });
      }
    }

    // Extract Evidence section
    if (evidenceStart !== -1) {
      const evidenceEnd =
        reasonsStart !== -1
          ? reasonsStart
          : appealStart !== -1
            ? appealStart
            : Math.min(evidenceStart + 5000, text.length);
      result.sections.evidence = text
        .substring(evidenceStart, evidenceEnd)
        .trim();

      // Parse evidence items (usually bullet points or numbered lists)
      const evidenceLines = result.sections.evidence.split(/\n/);
      for (const line of evidenceLines) {
        // Look for document references
        const docMatch = line.match(
          /(?:•|\d+\.|-)?\s*(.+?(?:record|report|statement|exam|letter|rating|decision|medical|treatment|VA|private|physician|doctor)[^.]*)/i,
        );
        if (docMatch && docMatch[1].length > 10) {
          result.evidenceConsidered.push(docMatch[1].trim());
        }
      }
    }

    // Extract Reasons section (CRITICAL for appeals)
    if (reasonsStart !== -1) {
      const reasonsEnd =
        appealStart !== -1
          ? appealStart
          : Math.min(reasonsStart + 5000, text.length);
      result.sections.reasons = text.substring(reasonsStart, reasonsEnd).trim();

      // Look for denial language
      const denialPatterns = [
        /(?:not\s+warranted|denied|not\s+established)(?:\s+because|\s+since)?[^.]+\./gi,
        /(?:higher|increased)\s+(?:evaluation|rating)\s+(?:is\s+)?not\s+warranted[^.]+\./gi,
        /(?:no|insufficient)\s+(?:diagnosis|evidence|nexus|link)[^.]+\./gi,
        /(?:does\s+not|doesn't)\s+(?:meet|satisfy|show)[^.]+criteria[^.]+\./gi,
      ];

      for (const pattern of denialPatterns) {
        const matches = result.sections.reasons.matchAll(pattern);
        for (const match of matches) {
          result.reasonsForDenial.push(match[0].trim());
        }
      }
    }

    // === EXTRACT EFFECTIVE DATES ===
    const effectiveDates = text.matchAll(CONDITION_PATTERNS.EFFECTIVE_DATE);
    for (const match of effectiveDates) {
      if (!result.effectiveDate) {
        result.effectiveDate = match[1];
      }
      // Associate with conditions if possible
      const context = text.substring(
        Math.max(0, match.index - 200),
        match.index,
      );
      for (const cond of result.conditions) {
        if (
          context
            .toLowerCase()
            .includes(cond.name.toLowerCase().substring(0, 20))
        ) {
          cond.effectiveDate = match[1];
        }
      }
    }

    // === DETECT DENIED CONDITIONS ===
    const deniedMatches = text.matchAll(CONDITION_PATTERNS.SERVICE_DENIED);
    for (const match of deniedMatches) {
      const context = text.substring(
        Math.max(0, match.index - 100),
        match.index + 200,
      );
      const condMatch = context.match(
        /([A-Za-z\s\-,()]+?)(?:\s+(?:is|was))?\s+(?:denied|not\s+established)/i,
      );
      if (condMatch) {
        const existingCond = result.conditions.find((c) =>
          c.name
            .toLowerCase()
            .includes(condMatch[1].toLowerCase().substring(0, 15)),
        );
        if (existingCond) {
          existingCond.status = "DENIED";
          existingCond.percent = 0;
        } else {
          result.conditions.push({
            name: condMatch[1].trim(),
            percent: 0,
            diagnosticCode: null,
            status: "DENIED",
            effectiveDate: null,
          });
        }
      }
    }

    // === CALCULATE CONFIDENCE ===
    let confidence = 0;
    if (result.combinedRating !== null) confidence += 25;
    if (result.conditions.length > 0) confidence += 25;
    if (result.evidenceConsidered.length > 0) confidence += 25;
    if (result.sections.decision || result.sections.reasons) confidence += 25;
    result.confidence = confidence;

    // === EXTRACTION NOTES ===
    if (result.conditions.length === 0) {
      result.extractionNotes.push(
        "No conditions could be extracted. Document may be a notification letter or different format.",
      );
    }
    if (result.evidenceConsidered.length === 0) {
      result.extractionNotes.push(
        "No evidence items found. Check if this is a summary letter.",
      );
    }
  } catch (err) {
    result.success = false;
    result.error = err.message;
  }

  return result;
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
    // === EXTRACT EXAM DATE ===
    const dateMatch = text.match(
      /(?:exam(?:ination)?\s*date|date\s*of\s*exam)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    );
    if (dateMatch) result.examDate = dateMatch[1];

    // === EXTRACT EXAMINER ===
    const examinerMatch = text.match(
      /(?:examiner|physician|doctor)[:\s]*([A-Z][A-Za-z\s,.]+(?:MD|DO|PA|NP)?)/i,
    );
    if (examinerMatch) result.examinerName = examinerMatch[1].trim();

    // === EXTRACT DIAGNOSES ===
    const diagnosisStart = text.search(VA_SECTION_HEADERS.DIAGNOSIS);
    if (diagnosisStart !== -1) {
      const diagSection = text.substring(diagnosisStart, diagnosisStart + 1000);
      // Look for ICD codes or diagnosis statements
      const diagMatches = diagSection.matchAll(
        /(?:\d+\.|•|-)?\s*([A-Za-z\s-]+)(?:\s*\(?\s*(?:ICD[:\s]*)?([A-Z]\d{2}(?:\.\d+)?)\)?)?/gi,
      );
      for (const match of diagMatches) {
        if (
          match[1] &&
          match[1].length > 5 &&
          !match[1].match(/^(?:the|and|or|with|for|from|this|that)\s*$/i)
        ) {
          result.diagnoses.push({
            name: match[1].trim(),
            icdCode: match[2] || null,
          });
        }
      }
    }

    // === EXTRACT NEXUS OPINION ===
    // This is the most important part for service connection
    const nexusPatterns = [
      /(?:is\s+)?(?:at\s+least\s+as\s+likely\s+as\s+not|more\s+likely\s+than\s+not|less\s+likely\s+than\s+not)[^.]+\./gi,
      /(?:nexus|relationship|connection)\s+(?:to|with|between)[^.]+service[^.]+\./gi,
      /(?:caused\s+by|result\s+of|due\s+to|related\s+to)\s+(?:military|active\s+duty|service)[^.]+\./gi,
    ];

    for (const pattern of nexusPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (!result.nexusOpinion) {
          result.nexusOpinion = match[0].trim();

          // Determine if positive or negative nexus
          if (match[0].match(/at\s+least\s+as\s+likely|more\s+likely/i)) {
            result.nexusRationale = "POSITIVE";
          } else if (match[0].match(/less\s+likely/i)) {
            result.nexusRationale = "NEGATIVE";
          }
        }
      }
    }

    // === EXTRACT FUNCTIONAL IMPACT ===
    const functionalStart = text.search(VA_SECTION_HEADERS.FUNCTIONAL_IMPACT);
    if (functionalStart !== -1) {
      result.sections.functionalImpact = text.substring(
        functionalStart,
        functionalStart + 1500,
      );
      result.functionalImpact = result.sections.functionalImpact.substring(
        0,
        500,
      );
    }

    // === EXTRACT EXAMINER REMARKS ===
    const remarksStart = text.search(VA_SECTION_HEADERS.EXAMINER_REMARKS);
    if (remarksStart !== -1) {
      result.sections.examinerRemarks = text.substring(
        remarksStart,
        remarksStart + 2000,
      );
    }

    // === CALCULATE CONFIDENCE ===
    let confidence = 0;
    if (result.examDate) confidence += 15;
    if (result.diagnoses.length > 0) confidence += 30;
    if (result.nexusOpinion) confidence += 40;
    if (result.functionalImpact) confidence += 15;
    result.confidence = confidence;
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
    const conferenceMatch = text.match(
      /informal\s*conference\s*(?:was\s*)?(?:held|conducted|requested)/i,
    );
    if (conferenceMatch) {
      result.informalConference.held = true;

      // Try to extract conference date
      const confDateMatch = text.match(
        /(?:conference|meeting)\s*(?:held\s*)?(?:on\s*)?(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
      );
      if (confDateMatch) {
        result.informalConference.date = confDateMatch[1];
      }
    }

    // Extract issues reviewed
    const issuePattern =
      /(?:issue(?:s)?|claim(?:s)?)\s*(?:on\s*)?(?:review|reviewed|being\s*reviewed)[:\s]*([^.]+)/gi;
    const issueMatches = text.matchAll(issuePattern);
    for (const match of issueMatches) {
      const issues = match[1]
        .split(/[,;]/)
        .map((i) => i.trim())
        .filter((i) => i.length > 3);
      result.issuesReviewed.push(...issues);
    }

    // Detect outcome
    if (text.match(/(?:decision\s*is\s*)?(?:affirmed|maintained|upheld)/i)) {
      result.outcome = "AFFIRMED";
    } else if (
      text.match(/(?:decision\s*is\s*)?(?:changed|modified|revised|increased)/i)
    ) {
      result.outcome = "CHANGED";
    } else if (
      text.match(/(?:remand|returned\s*for|duty\s*to\s*assist\s*error)/i)
    ) {
      result.outcome = "REMANDED";
    }

    // Extract Duty to Assist errors
    const dtaMatch = text.match(
      /duty\s*to\s*assist\s*(?:error|deficiency)[^.]*\.?/gi,
    );
    if (dtaMatch) {
      result.dutToAssistErrors.push(...dtaMatch.map((m) => m.trim()));
    }

    // Extract CUE claims
    const cueMatch = text.match(
      /clear\s*(?:and\s*)?unmistakable\s*error[^.]*\.?/gi,
    );
    if (cueMatch) {
      result.clearUnmistakableErrors.push(...cueMatch.map((m) => m.trim()));
    }

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
    const cfrMatches = text.matchAll(
      /38\s*(?:C\.?F\.?R\.?|CFR)\s*§?\s*([\d.]+)/g,
    );
    for (const match of cfrMatches) {
      if (!result.legalCitations.includes(match[1])) {
        result.legalCitations.push(`38 CFR § ${match[1]}`);
      }
    }

    // Calculate confidence
    result.confidence = result.outcome
      ? 75
      : result.informalConference.held
        ? 60
        : 35;
  } catch (err) {
    result.success = false;
    result.error = err.message;
  }

  return result;
}

/**
 * Extract the "Big Three" from any VA document
 * Condition, Percentage, Effective Date
 */
export function extractBigThree(text) {
  const results = [];

  // Pattern: Condition ... XX% ... effective DATE
  const bigThreePattern =
    /([A-Za-z\s\-,()]{5,50}?)(?:\s*(?:\.{2,}|–|-|:)\s*)(\d{1,3})\s*(?:percent|%)[^]*?effective\s*(?:date)?[:\s]*(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/gi;

  const matches = text.matchAll(bigThreePattern);
  for (const match of matches) {
    results.push({
      condition: match[1].trim(),
      percent: parseInt(match[2]),
      effectiveDate: match[3],
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
