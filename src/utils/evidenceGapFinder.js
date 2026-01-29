/**
 * Vet-Rate.org - Evidence Gap Finder
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * PURPOSE: Find "Duty to Assist" errors and evidence gaps
 * 
 * WHAT IS "DUTY TO ASSIST"?
 * Under 38 CFR § 3.159, the VA has a legal duty to:
 * 1. Notify veterans of evidence needed
 * 2. Assist in obtaining evidence
 * 3. Provide medical exams when necessary
 * 4. Consider ALL evidence of record
 * 
 * THE GAP FINDER
 * Compares:
 * - Evidence LISTED in Decision Letter
 * - Evidence ACTUALLY IN the C-File
 * 
 * If C-File has evidence the Decision Letter didn't mention,
 * that's a potential "Duty to Assist" violation!
 * 
 * KEY INSIGHT: VA raters are overworked and miss evidence.
 * This tool catches those misses automatically.
 */

import { parseDecisionLetter } from './vaDocumentParser.js';
import { segmentCFile, quickScanCFile } from './cFileSegmentation.js';

/**
 * Evidence types for categorization
 */
export const EVIDENCE_TYPES = {
  SERVICE_TREATMENT: {
    label: 'Service Treatment Records',
    weight: 10,
    patterns: [/STR/i, /service\s*treatment/i, /military\s*medical/i],
  },
  PRIVATE_MEDICAL: {
    label: 'Private Medical Records',
    weight: 8,
    patterns: [/private\s*(?:medical|records)/i, /outside\s*records/i],
  },
  VA_TREATMENT: {
    label: 'VA Treatment Records',
    weight: 8,
    patterns: [/VA\s*(?:treatment|medical)/i, /VAMC/i],
  },
  CP_EXAM: {
    label: 'C&P Examination',
    weight: 10,
    patterns: [/C&P/i, /compensation.*pension/i, /DBQ/i, /exam(?:ination)?/i],
  },
  BUDDY_STATEMENT: {
    label: 'Buddy/Lay Statement',
    weight: 6,
    patterns: [/buddy/i, /lay\s*statement/i, /21-4138/i],
  },
  NEXUS_LETTER: {
    label: 'Nexus/IMO Letter',
    weight: 10,
    patterns: [/nexus/i, /IMO/i, /independent\s*medical\s*opinion/i],
  },
  DD214: {
    label: 'DD-214',
    weight: 8,
    patterns: [/DD-?214/i, /discharge/i],
  },
  PERSONNEL_RECORD: {
    label: 'Personnel Records',
    weight: 7,
    patterns: [/personnel/i, /201\s*file/i, /service\s*record/i],
  },
  RATING_DECISION: {
    label: 'Prior Rating Decision',
    weight: 9,
    patterns: [/rating\s*decision/i, /prior\s*decision/i],
  },
  BVA_DECISION: {
    label: 'BVA Decision',
    weight: 9,
    patterns: [/BVA/i, /board.*veterans/i],
  },
};

/**
 * Duty to Assist violation categories
 */
export const DTA_VIOLATIONS = {
  EVIDENCE_NOT_CONSIDERED: {
    code: 'DTA-001',
    severity: 'HIGH',
    description: 'Evidence in C-File not considered in decision',
    cfrReference: '38 CFR § 3.159(c)',
    remedy: 'Clear and Unmistakable Error (CUE) claim or appeal',
  },
  NO_EXAM_PROVIDED: {
    code: 'DTA-002',
    severity: 'HIGH',
    description: 'VA failed to provide necessary medical examination',
    cfrReference: '38 CFR § 3.159(c)(4)',
    remedy: 'Request new exam or appeal',
  },
  INADEQUATE_EXAM: {
    code: 'DTA-003',
    severity: 'MEDIUM',
    description: 'C&P exam was inadequate (missing nexus, incomplete)',
    cfrReference: '38 CFR § 3.159(c)(4)',
    remedy: 'Request new exam citing Barr v. Nicholson',
  },
  MISSING_RECORDS: {
    code: 'DTA-004',
    severity: 'MEDIUM',
    description: 'VA failed to obtain identified records',
    cfrReference: '38 CFR § 3.159(c)(1)',
    remedy: 'Submit records directly or appeal',
  },
  FAVORABLE_EVIDENCE_IGNORED: {
    code: 'DTA-005',
    severity: 'HIGH',
    description: 'Favorable evidence was present but not discussed',
    cfrReference: '38 CFR § 3.303(a)',
    remedy: 'Appeal with Notice of Disagreement',
  },
};

/**
 * Find evidence gaps between Decision Letter and C-File
 * 
 * @param {string} decisionLetterText - Text from Decision Letter
 * @param {string} cFileText - Text from full C-File
 * @returns {Object} Gap analysis report
 */
export function findEvidenceGaps(decisionLetterText, cFileText) {
  const report = {
    success: true,
    analyzedAt: new Date().toISOString(),
    
    // Evidence comparison
    evidenceInDecision: [],
    evidenceInCFile: [],
    
    // THE GAPS - this is what we're looking for!
    gaps: [],
    
    // Potential violations
    potentialViolations: [],
    
    // Summary
    gapCount: 0,
    severityScore: 0,
    
    // Recommendations
    recommendations: [],
    
    // Legal arguments for appeal
    legalArguments: [],
  };

  try {
    // === PARSE DECISION LETTER ===
    const decisionData = parseDecisionLetter(decisionLetterText);
    report.evidenceInDecision = decisionData.evidenceConsidered || [];

    // === PARSE C-FILE ===
    const cFileData = segmentCFile(cFileText, { parseDocuments: false });
    
    // Build list of evidence actually in C-File
    for (const segment of cFileData.segments) {
      const evidenceItem = {
        type: segment.type,
        category: segment.category,
        preview: segment.preview,
        id: segment.id,
        mentioned: false,
      };
      
      // Check if this evidence was mentioned in the decision
      for (const mentioned of report.evidenceInDecision) {
        const mentionedLower = mentioned.toLowerCase();
        const previewLower = segment.preview.toLowerCase();
        
        // Check for matching keywords
        for (const [typeName, typeInfo] of Object.entries(EVIDENCE_TYPES)) {
          for (const pattern of typeInfo.patterns) {
            if (mentionedLower.match(pattern) && previewLower.match(pattern)) {
              evidenceItem.mentioned = true;
              break;
            }
          }
          if (evidenceItem.mentioned) break;
        }
        if (evidenceItem.mentioned) break;
      }
      
      report.evidenceInCFile.push(evidenceItem);
    }

    // === FIND THE GAPS ===
    for (const evidence of report.evidenceInCFile) {
      if (!evidence.mentioned) {
        // This is a gap!
        const gap = {
          evidenceType: evidence.type,
          category: evidence.category,
          preview: evidence.preview,
          importance: calculateEvidenceImportance(evidence),
          potentialImpact: assessPotentialImpact(evidence, decisionData),
        };
        
        report.gaps.push(gap);
        report.gapCount++;
        report.severityScore += gap.importance;
      }
    }

    // === IDENTIFY POTENTIAL VIOLATIONS ===
    if (report.gapCount > 0) {
      report.potentialViolations.push({
        ...DTA_VIOLATIONS.EVIDENCE_NOT_CONSIDERED,
        affectedEvidence: report.gaps.map(g => g.preview.substring(0, 50)),
      });
    }

    // Check for missing exam
    const hasConditionDenied = decisionData.conditions?.some(c => c.status === 'DENIED');
    const hasCPExam = report.evidenceInCFile.some(e => e.type === 'DBQ');
    if (hasConditionDenied && !hasCPExam) {
      report.potentialViolations.push({
        ...DTA_VIOLATIONS.NO_EXAM_PROVIDED,
        note: 'Condition was denied without a C&P examination',
      });
    }

    // Check for favorable evidence ignored
    const hasNexusLetter = report.evidenceInCFile.some(e => 
      e.preview.toLowerCase().includes('nexus') || 
      e.preview.toLowerCase().includes('more likely')
    );
    const wasDenied = decisionData.conditions?.some(c => c.status === 'DENIED');
    if (hasNexusLetter && wasDenied) {
      const nexusEvidence = report.gaps.find(g => 
        g.preview.toLowerCase().includes('nexus') ||
        g.preview.toLowerCase().includes('likely')
      );
      if (nexusEvidence) {
        report.potentialViolations.push({
          ...DTA_VIOLATIONS.FAVORABLE_EVIDENCE_IGNORED,
          note: 'Nexus letter present but not discussed in denial',
        });
      }
    }

    // === GENERATE RECOMMENDATIONS ===
    if (report.gapCount > 5) {
      report.recommendations.push({
        priority: 'HIGH',
        action: 'File Supplemental Claim or Higher-Level Review',
        reasoning: `${report.gapCount} pieces of evidence were not considered in your decision.`,
      });
    }

    if (report.potentialViolations.some(v => v.severity === 'HIGH')) {
      report.recommendations.push({
        priority: 'HIGH',
        action: 'Consider Notice of Disagreement (NOD)',
        reasoning: 'Significant Duty to Assist errors identified.',
      });
    }

    // === BUILD LEGAL ARGUMENTS ===
    if (report.potentialViolations.length > 0) {
      report.legalArguments.push({
        argument: 'The VA failed to consider all evidence of record.',
        support: `Per 38 CFR § 3.159(c), the VA must consider all evidence. ${report.gapCount} documents in the C-File were not mentioned in the decision.`,
        caselaw: 'See Gabrielson v. Brown, 7 Vet. App. 36 (1994)',
      });
    }

    if (report.potentialViolations.some(v => v.code === 'DTA-002')) {
      report.legalArguments.push({
        argument: 'The VA failed to provide a medical examination.',
        support: 'Under 38 CFR § 3.159(c)(4), an examination is required when there is: (1) competent evidence of current disability; (2) evidence of an in-service event; (3) indication of a possible nexus; and (4) insufficient medical evidence.',
        caselaw: 'See McLendon v. Nicholson, 20 Vet. App. 79 (2006)',
      });
    }

    // === GENERATE ADVERSARIAL REPORT ===
    report.adversarialReport = generateAdversarialReport(report, decisionData);

  } catch (err) {
    report.success = false;
    report.error = err.message;
  }

  return report;
}

/**
 * Calculate importance score for evidence
 */
function calculateEvidenceImportance(evidence) {
  const typeInfo = EVIDENCE_TYPES[evidence.type];
  if (typeInfo) {
    return typeInfo.weight;
  }
  
  // Default scoring based on category
  switch (evidence.category) {
    case 'MEDICAL': return 8;
    case 'DECISION': return 9;
    case 'SERVICE_RECORD': return 7;
    case 'EVIDENCE': return 6;
    default: return 4;
  }
}

/**
 * Assess potential impact of missing evidence
 */
function assessPotentialImpact(evidence, decisionData) {
  // Check if this evidence relates to a denied condition
  if (!decisionData.conditions) return 'UNKNOWN';
  
  const deniedConditions = decisionData.conditions.filter(c => c.status === 'DENIED');
  const previewLower = evidence.preview.toLowerCase();
  
  for (const condition of deniedConditions) {
    const condLower = condition.name.toLowerCase();
    // Check for keyword overlap
    const condWords = condLower.split(/\s+/).filter(w => w.length > 3);
    for (const word of condWords) {
      if (previewLower.includes(word)) {
        return 'HIGH'; // Evidence relates to denied condition
      }
    }
  }

  // Check if it's a nexus letter
  if (previewLower.includes('nexus') || previewLower.includes('likely')) {
    return 'HIGH';
  }

  return 'MEDIUM';
}

/**
 * Generate Adversarial Report JSON (per user spec)
 */
function generateAdversarialReport(gapReport, decisionData) {
  return {
    executiveSummary: {
      gapsIdentified: gapReport.gapCount,
      dtaViolations: gapReport.potentialViolations.length,
      severityScore: gapReport.severityScore,
      recommendation: gapReport.recommendations[0]?.action || 'Review required',
    },
    identifiedGaps: gapReport.gaps.map(g => ({
      evidenceType: g.evidenceType,
      impact: g.potentialImpact,
      preview: g.preview.substring(0, 100),
    })),
    dutytToAssistErrors: gapReport.potentialViolations.map(v => ({
      code: v.code,
      severity: v.severity,
      description: v.description,
      cfrReference: v.cfrReference,
    })),
    legalArguments: gapReport.legalArguments,
    suggestedActions: gapReport.recommendations,
    vkbIntegration: {
      conditionsAffected: decisionData.conditions?.map(c => c.name) || [],
      evidenceTimeline: gapReport.evidenceInCFile.map(e => ({
        type: e.type,
        wasConsidered: e.mentioned,
      })),
      needsRedTeamReview: gapReport.potentialViolations.some(v => v.severity === 'HIGH'),
    },
  };
}

/**
 * Quick gap check without full C-File parsing
 * Useful for initial triage
 */
export function quickGapCheck(decisionText, cFileSummary) {
  const decision = parseDecisionLetter(decisionText);
  const evidenceCount = decision.evidenceConsidered?.length || 0;
  
  // Quick scan tells us what's in C-File
  const scan = typeof cFileSummary === 'string' 
    ? quickScanCFile(cFileSummary) 
    : cFileSummary;

  const quickReport = {
    evidenceMentioned: evidenceCount,
    documentsDetected: scan.detectedTypes.length,
    possibleGaps: Math.max(0, scan.detectedTypes.length - evidenceCount),
    flagsRaised: [],
  };

  // Flag if DBQs exist but not mentioned
  if (scan.hasDBQs && !decision.evidenceConsidered?.some(e => e.match(/exam|dbq|c&p/i))) {
    quickReport.flagsRaised.push('C&P exams may not have been considered');
  }

  // Flag if BVA decision exists
  if (scan.hasBVA) {
    quickReport.flagsRaised.push('Prior BVA decision exists - check for compliance');
  }

  return quickReport;
}

/**
 * Compare two decision letters (before/after appeal)
 */
export function compareDecisions(beforeText, afterText) {
  const before = parseDecisionLetter(beforeText);
  const after = parseDecisionLetter(afterText);

  return {
    ratingChange: {
      before: before.combinedRating,
      after: after.combinedRating,
      difference: (after.combinedRating || 0) - (before.combinedRating || 0),
    },
    conditionChanges: compareConditions(before.conditions, after.conditions),
    newEvidence: after.evidenceConsidered?.filter(e => 
      !before.evidenceConsidered?.includes(e)
    ) || [],
  };
}

/**
 * Compare condition lists between decisions
 */
function compareConditions(beforeConditions, afterConditions) {
  const changes = [];
  
  for (const after of afterConditions || []) {
    const before = beforeConditions?.find(b => 
      b.name.toLowerCase().includes(after.name.toLowerCase().substring(0, 15))
    );
    
    if (!before) {
      changes.push({ 
        condition: after.name, 
        change: 'NEW', 
        newPercent: after.percent 
      });
    } else if (before.percent !== after.percent) {
      changes.push({
        condition: after.name,
        change: 'INCREASED',
        oldPercent: before.percent,
        newPercent: after.percent,
      });
    } else if (before.status !== after.status) {
      changes.push({
        condition: after.name,
        change: 'STATUS_CHANGED',
        oldStatus: before.status,
        newStatus: after.status,
      });
    }
  }

  return changes;
}

export default {
  findEvidenceGaps,
  quickGapCheck,
  compareDecisions,
  EVIDENCE_TYPES,
  DTA_VIOLATIONS,
};
