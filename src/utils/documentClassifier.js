/**
 * SupplyLocker.org - Document Classification System
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
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
  DD214: 'DD214',
  DD215: 'DD215',
  NGB22: 'NGB22',
  DD256: 'DD256', // Reserve discharge
  DD257: 'DD257', // Reserve discharge
  RATING_DECISION: 'RATING_DECISION',
  CLAIM_LETTER: 'CLAIM_LETTER',
  C_FILE_MEDICAL: 'C_FILE_MEDICAL',
  DBQ: 'DBQ',
  NEXUS_LETTER: 'NEXUS_LETTER',
  PERSONAL_STATEMENT: 'PERSONAL_STATEMENT',
  VA_CORRESPONDENCE: 'VA_CORRESPONDENCE',
  MEDICAL_RECORD: 'MEDICAL_RECORD',
  EXAM_REPORT: 'EXAM_REPORT',
  UNKNOWN: 'UNKNOWN'
};

/**
 * Classification patterns for each document type
 */
const CLASSIFICATION_PATTERNS = {
  [DOCUMENT_TYPES.DD214]: {
    patterns: [
      /DD\s*FORM\s*214/i,
      /CERTIFICATE\s+OF\s+RELEASE\s+OR\s+DISCHARGE\s+FROM\s+ACTIVE\s+DUTY/i,
      /MEMBER\s+\d\s*-\s*COPY/i,
      /SEPARATION\s+DATE.*\d{8}/i,
      /CHARACTER\s+OF\s+SERVICE/i
    ],
    weight: 5,
    category: 'service_record',
    priority: 10 // Highest priority
  },
  
  [DOCUMENT_TYPES.DD215]: {
    patterns: [
      /DD\s*FORM\s*215/i,
      /CORRECTION\s+TO\s+DD\s+FORM\s+214/i,
      /AMENDED\s+DISCHARGE/i
    ],
    weight: 5,
    category: 'service_record',
    priority: 9
  },
  
  [DOCUMENT_TYPES.NGB22]: {
    patterns: [
      /NGB\s*FORM\s*22/i,
      /NATIONAL\s+GUARD\s+BUREAU/i,
      /REPORT\s+OF\s+SEPARATION\s+AND\s+RECORD\s+OF\s+SERVICE/i,
      /STATE\s+ACTIVE\s+DUTY/i
    ],
    weight: 5,
    category: 'service_record',
    priority: 10
  },
  
  [DOCUMENT_TYPES.DD256]: {
    patterns: [
      /DD\s*FORM\s*256/i,
      /HONORABLE\s+DISCHARGE.*RESERVE/i,
      /RESERVE\s+COMPONENT/i
    ],
    weight: 5,
    category: 'service_record',
    priority: 9
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
      /BILATERAL\s+FACTOR/i
    ],
    weight: 4,
    category: 'rating',
    priority: 9
  },
  
  [DOCUMENT_TYPES.CLAIM_LETTER]: {
    patterns: [
      /CLAIM\s+FOR\s+DISABILITY\s+COMPENSATION/i,
      /VA\s+FORM\s+21-526/i,
      /APPLICATION\s+FOR\s+DISABILITY\s+COMPENSATION/i,
      /CLAIM\s+NUMBER/i,
      /DATE\s+OF\s+CLAIM/i,
      /PENDING\s+CLAIM/i,
      /CONTENTION/i
    ],
    weight: 4,
    category: 'claim',
    priority: 8
  },
  
  [DOCUMENT_TYPES.DBQ]: {
    patterns: [
      /DISABILITY\s+BENEFITS\s+QUESTIONNAIRE/i,
      /DBQ/i,
      /EXAMINATION\s+FOR.*DISABILITY/i,
      /MEDICAL\s+OPINION/i,
      /NEXUS\s+STATEMENT/i,
      /AS\s+LIKELY\s+AS\s+NOT/i,
      /MORE\s+LIKELY\s+THAN\s+NOT/i
    ],
    weight: 4,
    category: 'medical',
    priority: 7
  },
  
  [DOCUMENT_TYPES.C_FILE_MEDICAL]: {
    patterns: [
      /COMPENSATION\s+&\s+PENSION.*EXAM/i,
      /C&P\s+EXAM/i,
      /VA\s+MEDICAL\s+CENTER/i,
      /VETERANS\s+HEALTH\s+ADMINISTRATION/i,
      /TREATMENT\s+RECORD/i,
      /CLINICAL\s+NOTE/i,
      /PROGRESS\s+NOTE/i
    ],
    weight: 3,
    category: 'medical',
    priority: 6
  },
  
  [DOCUMENT_TYPES.NEXUS_LETTER]: {
    patterns: [
      /NEXUS\s+LETTER/i,
      /MEDICAL\s+OPINION/i,
      /IN\s+MY\s+PROFESSIONAL\s+OPINION/i,
      /MORE\s+LIKELY\s+THAN\s+NOT.*SERVICE/i,
      /PROXIMATE\s+CAUSE/i,
      /ETIOLOGY/i,
      /IMO\s*-\s*INDEPENDENT\s+MEDICAL\s+OPINION/i
    ],
    weight: 4,
    category: 'medical_opinion',
    priority: 7
  },
  
  [DOCUMENT_TYPES.PERSONAL_STATEMENT]: {
    patterns: [
      /PERSONAL\s+STATEMENT/i,
      /STATEMENT\s+IN\s+SUPPORT\s+OF\s+CLAIM/i,
      /VA\s+FORM\s+21-4138/i,
      /I.*DECLARE/i,
      /MY\s+NAME\s+IS/i,
      /I\s+AM\s+WRITING\s+TO/i
    ],
    weight: 3,
    category: 'statement',
    priority: 5
  },
  
  [DOCUMENT_TYPES.VA_CORRESPONDENCE]: {
    patterns: [
      /DEPARTMENT\s+OF\s+VETERANS\s+AFFAIRS/i,
      /VETERANS\s+BENEFITS\s+ADMINISTRATION/i,
      /REGIONAL\s+OFFICE/i,
      /VA\s+NOTIFICATION\s+LETTER/i,
      /DECISION\s+REVIEW\s+OFFICER/i
    ],
    weight: 2,
    category: 'correspondence',
    priority: 4
  },
  
  [DOCUMENT_TYPES.EXAM_REPORT]: {
    patterns: [
      /EXAMINATION\s+REPORT/i,
      /PHYSICAL\s+EXAMINATION/i,
      /MENTAL\s+STATUS\s+EXAMINATION/i,
      /DIAGNOSTIC\s+FINDINGS/i,
      /CLINICAL\s+FINDINGS/i,
      /IMPRESSION/i,
      /DIAGNOSIS/i
    ],
    weight: 3,
    category: 'medical',
    priority: 6
  }
};

/**
 * Classify a document based on its text content
 * @param {string} text - The document text
 * @param {string} filename - Optional filename for additional hints
 * @returns {Object} Classification result with type, confidence, and metadata
 */
export const classifyDocument = (text, filename = '') => {
  if (!text || typeof text !== 'string') {
    return {
      type: DOCUMENT_TYPES.UNKNOWN,
      confidence: 0,
      category: 'unknown',
      priority: 0,
      matches: []
    };
  }

  // Normalize text for analysis
  const normalizedText = text.substring(0, 5000); // Analyze first 5KB for speed
  const filenameHints = filename.toLowerCase();

  const scores = {};
  const matches = {};

  // Score each document type
  for (const [docType, config] of Object.entries(CLASSIFICATION_PATTERNS)) {
    let score = 0;
    const matchedPatterns = [];

    // Check patterns
    for (const pattern of config.patterns) {
      if (pattern.test(normalizedText)) {
        score += config.weight;
        matchedPatterns.push(pattern.source);
      }
    }

    // Filename hints (small boost)
    if (filenameHints.includes(docType.toLowerCase())) {
      score += 1;
    }

    if (score > 0) {
      scores[docType] = score;
      matches[docType] = matchedPatterns;
    }
  }

  // Find best match
  let bestType = DOCUMENT_TYPES.UNKNOWN;
  let bestScore = 0;
  let bestCategory = 'unknown';
  let bestPriority = 0;

  for (const [docType, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestType = docType;
      bestCategory = CLASSIFICATION_PATTERNS[docType].category;
      bestPriority = CLASSIFICATION_PATTERNS[docType].priority;
    }
  }

  // Calculate confidence (0-100)
  const maxPossibleScore = Math.max(...Object.values(CLASSIFICATION_PATTERNS).map(c => c.weight * c.patterns.length));
  const confidence = Math.min(100, Math.round((bestScore / maxPossibleScore) * 100));

  return {
    type: bestType,
    confidence,
    category: bestCategory,
    priority: bestPriority,
    matches: matches[bestType] || [],
    allScores: scores
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
    size: doc.text.length
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
      classified: classified.filter(d => d.classification.type !== DOCUMENT_TYPES.UNKNOWN).length,
      unknown: classified.filter(d => d.classification.type === DOCUMENT_TYPES.UNKNOWN).length,
      types: Object.keys(grouped)
    }
  };
};

/**
 * Get human-readable label for document type
 */
export const getDocumentTypeLabel = (type) => {
  const labels = {
    [DOCUMENT_TYPES.DD214]: 'DD214 (Service Record)',
    [DOCUMENT_TYPES.DD215]: 'DD215 (Corrected DD214)',
    [DOCUMENT_TYPES.NGB22]: 'NGB22 (National Guard)',
    [DOCUMENT_TYPES.DD256]: 'DD256 (Reserve Discharge)',
    [DOCUMENT_TYPES.DD257]: 'DD257 (Reserve Discharge)',
    [DOCUMENT_TYPES.RATING_DECISION]: 'VA Rating Decision',
    [DOCUMENT_TYPES.CLAIM_LETTER]: 'VA Claim Letter',
    [DOCUMENT_TYPES.C_FILE_MEDICAL]: 'C-File Medical Record',
    [DOCUMENT_TYPES.DBQ]: 'Disability Benefits Questionnaire',
    [DOCUMENT_TYPES.NEXUS_LETTER]: 'Nexus Letter',
    [DOCUMENT_TYPES.PERSONAL_STATEMENT]: 'Personal Statement',
    [DOCUMENT_TYPES.VA_CORRESPONDENCE]: 'VA Correspondence',
    [DOCUMENT_TYPES.MEDICAL_RECORD]: 'Medical Record',
    [DOCUMENT_TYPES.EXAM_REPORT]: 'Examination Report',
    [DOCUMENT_TYPES.UNKNOWN]: 'Unknown Document'
  };
  
  return labels[type] || 'Unknown Document';
};

/**
 * Determine processing strategy based on document type
 */
export const getProcessingStrategy = (documentType) => {
  const strategies = {
    [DOCUMENT_TYPES.DD214]: {
      priority: 'critical',
      processor: 'dd214Analyzer',
      extractors: ['serviceInfo', 'awards', 'dates', 'mos'],
      autoFill: ['branch', 'serviceStartDate', 'serviceEndDate', 'characterOfService']
    },
    [DOCUMENT_TYPES.RATING_DECISION]: {
      priority: 'critical',
      processor: 'ratingParser',
      extractors: ['conditions', 'ratings', 'effectiveDate', 'combinedRating'],
      autoFill: ['currentCombinedRating', 'effectiveDate']
    },
    [DOCUMENT_TYPES.CLAIM_LETTER]: {
      priority: 'high',
      processor: 'claimParser',
      extractors: ['claimedConditions', 'claimNumber', 'claimDate'],
      autoFill: ['claimNumber']
    },
    [DOCUMENT_TYPES.DBQ]: {
      priority: 'high',
      processor: 'dbqParser',
      extractors: ['condition', 'diagnosis', 'nexusOpinion', 'limitations'],
      autoFill: []
    },
    [DOCUMENT_TYPES.C_FILE_MEDICAL]: {
      priority: 'medium',
      processor: 'medicalRecordParser',
      extractors: ['diagnoses', 'treatments', 'symptoms', 'dates'],
      autoFill: []
    },
    [DOCUMENT_TYPES.NEXUS_LETTER]: {
      priority: 'high',
      processor: 'nexusParser',
      extractors: ['condition', 'opinion', 'rationale', 'provider'],
      autoFill: []
    }
  };
  
  return strategies[documentType] || {
    priority: 'low',
    processor: 'genericParser',
    extractors: ['text'],
    autoFill: []
  };
};
