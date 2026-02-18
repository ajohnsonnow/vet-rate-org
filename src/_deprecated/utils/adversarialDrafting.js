/**
 * Vet-Rate.org - Adversarial Drafting System
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * PURPOSE: Generate NOD/HLR arguments from evidence gaps
 * 
 * This module connects:
 * - Evidence Gap Finder (finds the problems)
 * - VA Document Parser (extracts decision details)
 * - Red Team (stress tests statements)
 * 
 * OUTPUT: Ready-to-use arguments for:
 * - Notice of Disagreement (NOD)
 * - Higher-Level Review (HLR)
 * - Supplemental Claim
 * - Board Appeal
 * 
 * LEGAL FRAMEWORK:
 * - 38 CFR § 3.156(b) - New and material evidence
 * - 38 CFR § 3.159 - Duty to assist
 * - 38 CFR § 3.303 - Service connection
 * - 38 CFR § 3.304 - Combat presumption
 * - 38 CFR § 3.310 - Secondary service connection
 */

import { findEvidenceGaps, DTA_VIOLATIONS } from './evidenceGapFinder.js';
import { parseDecisionLetter, parseVADocument } from './vaDocumentParser.js';

/**
 * Argument templates based on 38 CFR and case law
 */
export const ARGUMENT_TEMPLATES = {
  // Duty to Assist violations
  DTA_EVIDENCE_NOT_CONSIDERED: {
    template: `The Regional Office (RO) committed clear error by failing to consider all evidence of record. Per 38 CFR § 3.159(c), the VA has an affirmative duty to consider all evidence. The C-File contains {evidenceDescription} which directly pertains to the claimed condition of {condition}, yet this evidence is not discussed in the Rating Decision dated {decisionDate}. See Gabrielson v. Brown, 7 Vet. App. 36 (1994) (holding that the VA must consider all evidence of record).`,
    cfr: ['38 CFR § 3.159(c)', '38 CFR § 3.303(a)'],
    caselaw: ['Gabrielson v. Brown, 7 Vet. App. 36 (1994)'],
  },

  DTA_NO_EXAM: {
    template: `The RO failed to provide an adequate medical examination as required under 38 CFR § 3.159(c)(4). The McLendon criteria are satisfied: (1) there is competent evidence of a current disability ({currentDisability}); (2) there is evidence of an in-service event ({inServiceEvent}); (3) there is an indication of a possible nexus; and (4) there is insufficient medical evidence to make a decision. See McLendon v. Nicholson, 20 Vet. App. 79 (2006).`,
    cfr: ['38 CFR § 3.159(c)(4)'],
    caselaw: ['McLendon v. Nicholson, 20 Vet. App. 79 (2006)'],
  },

  DTA_INADEQUATE_EXAM: {
    template: `The C&P examination dated {examDate} is inadequate for rating purposes. The examiner {inadequacyReason}. See Barr v. Nicholson, 21 Vet. App. 303 (2007) (holding that once VA undertakes to provide an examination, it must provide an adequate one). A new examination is required.`,
    cfr: ['38 CFR § 3.159(c)(4)'],
    caselaw: ['Barr v. Nicholson, 21 Vet. App. 303 (2007)'],
  },

  // Nexus arguments
  NEXUS_POSITIVE_IGNORED: {
    template: `The RO improperly disregarded the positive nexus opinion from {providerName}. This medical opinion states "{nexusQuote}" and is based on a thorough review of the Veteran's medical history and in-service records. The RO provided no adequate rationale for rejecting this favorable medical evidence. See Nieves-Rodriguez v. Peake, 22 Vet. App. 295 (2008).`,
    cfr: ['38 CFR § 3.303(a)'],
    caselaw: ['Nieves-Rodriguez v. Peake, 22 Vet. App. 295 (2008)'],
  },

  // Service connection arguments
  DIRECT_SERVICE_CONNECTION: {
    template: `Service connection for {condition} is warranted under 38 CFR § 3.303. The evidence establishes: (1) a current diagnosis of {diagnosis}; (2) an in-service event, specifically {inServiceEvent} as documented in the service treatment records; and (3) a nexus between the current condition and service, as established by {nexusEvidence}. All three Hickson elements are satisfied.`,
    cfr: ['38 CFR § 3.303'],
    caselaw: ['Hickson v. West, 12 Vet. App. 247 (1999)'],
  },

  SECONDARY_SERVICE_CONNECTION: {
    template: `Service connection for {secondaryCondition} is warranted on a secondary basis under 38 CFR § 3.310. The evidence demonstrates that this condition is proximately due to or aggravated by the already service-connected {primaryCondition}. Medical evidence from {provider} establishes this relationship. See Allen v. Brown, 7 Vet. App. 439 (1995).`,
    cfr: ['38 CFR § 3.310'],
    caselaw: ['Allen v. Brown, 7 Vet. App. 439 (1995)'],
  },

  // Rating arguments
  HIGHER_RATING: {
    template: `A higher evaluation is warranted for {condition} under Diagnostic Code {diagnosticCode}. The medical evidence demonstrates {symptomDescription} which meets the criteria for a {targetPercent}% evaluation. The current {currentPercent}% rating fails to accurately reflect the severity of the Veteran's disability. Per 38 CFR § 4.7, where there is a question as to which evaluation should apply, the higher evaluation shall be assigned if the disability picture more nearly approximates the criteria.`,
    cfr: ['38 CFR § 4.7', '38 CFR Part 4'],
    caselaw: [],
  },

  COMBAT_PRESUMPTION: {
    template: `The Veteran is entitled to application of the combat presumption under 38 U.S.C. § 1154(b). The Veteran's service records confirm engagement in combat operations during {conflictPeriod}. Under this presumption, lay or other evidence of service incurrence is accepted if consistent with the circumstances of combat service. The VA cannot require corroborating evidence for in-service events related to combat.`,
    cfr: ['38 CFR § 3.304(d)'],
    caselaw: ['Collette v. Brown, 82 F.3d 389 (Fed. Cir. 1996)'],
  },

  // Benefit of the doubt
  BENEFIT_OF_DOUBT: {
    template: `At minimum, the evidence is in equipoise regarding {issue}. Under 38 U.S.C. § 5107(b) and 38 CFR § 3.102, when there is an approximate balance of positive and negative evidence, the benefit of the doubt shall be given to the claimant. The VA must resolve reasonable doubt in favor of the Veteran. See Gilbert v. Derwinski, 1 Vet. App. 49 (1990).`,
    cfr: ['38 CFR § 3.102'],
    caselaw: ['Gilbert v. Derwinski, 1 Vet. App. 49 (1990)'],
  },
};

/**
 * Appeal type configurations
 */
export const APPEAL_TYPES = {
  NOD: {
    name: 'Notice of Disagreement',
    deadline: '1 year from decision date',
    form: 'VA Form 10182',
    description: 'Initiates appeal to Board of Veterans Appeals',
    lanes: ['Direct Review', 'Evidence Submission', 'Hearing'],
  },
  HLR: {
    name: 'Higher-Level Review',
    deadline: '1 year from decision date',
    form: 'VA Form 20-0996',
    description: 'Different senior reviewer re-examines same evidence',
    limitations: ['No new evidence allowed', 'Cannot request exam'],
  },
  SUPPLEMENTAL: {
    name: 'Supplemental Claim',
    deadline: 'Any time with new evidence',
    form: 'VA Form 20-0995',
    description: 'Submit new and relevant evidence',
    advantages: ['Can add evidence', 'Retains effective date if within 1 year'],
  },
  CUE: {
    name: 'Clear and Unmistakable Error',
    deadline: 'No deadline',
    form: 'Written motion',
    description: 'Attack final decision based on obvious error',
    standard: 'Very high - error must be undebatable',
  },
};

/**
 * Generate adversarial arguments from gap analysis
 * 
 * @param {Object} gapReport - Output from findEvidenceGaps()
 * @param {Object} options - Generation options
 * @returns {Object} Adversarial report with ready arguments
 */
export function generateAdversarialArguments(gapReport, options = {}) {
  const {
    appealType = 'HLR',
    conditionFocus = null,
    includeAllGaps = true,
  } = options;

  const report = {
    generatedAt: new Date().toISOString(),
    appealType: APPEAL_TYPES[appealType],
    
    // Executive summary for quick review
    executiveSummary: {
      totalArguments: 0,
      strongArguments: [],
      moderateArguments: [],
      suggestedApproach: null,
    },
    
    // The meat - actual arguments
    arguments: [],
    
    // Legal citations used
    cfrCitations: new Set(),
    caseLawCitations: new Set(),
    
    // Recommended evidence to gather
    recommendedEvidence: [],
    
    // VKB integration hooks
    vkbIntegration: {
      conditionsAffected: [],
      evidenceTimeline: [],
      gapAlerts: [],
    },
  };

  try {
    // === BUILD DTA ARGUMENTS FROM GAPS ===
    if (gapReport.gaps && gapReport.gaps.length > 0) {
      const dtaArg = buildDTAArgument(gapReport);
      if (dtaArg) {
        report.arguments.push(dtaArg);
        dtaArg.cfr?.forEach(c => report.cfrCitations.add(c));
        dtaArg.caselaw?.forEach(c => report.caseLawCitations.add(c));
      }
    }

    // === BUILD ARGUMENTS FROM VIOLATIONS ===
    for (const violation of gapReport.potentialViolations || []) {
      const violationArg = buildViolationArgument(violation, gapReport);
      if (violationArg) {
        report.arguments.push(violationArg);
        violationArg.cfr?.forEach(c => report.cfrCitations.add(c));
        violationArg.caselaw?.forEach(c => report.caseLawCitations.add(c));
      }
    }

    // === ADD BENEFIT OF DOUBT IF APPROPRIATE ===
    if (report.arguments.length > 0) {
      const bodArg = buildBenefitOfDoubtArgument(gapReport);
      report.arguments.push(bodArg);
      ARGUMENT_TEMPLATES.BENEFIT_OF_DOUBT.cfr.forEach(c => report.cfrCitations.add(c));
      ARGUMENT_TEMPLATES.BENEFIT_OF_DOUBT.caselaw.forEach(c => report.caseLawCitations.add(c));
    }

    // === CATEGORIZE ARGUMENTS ===
    for (const arg of report.arguments) {
      report.executiveSummary.totalArguments++;
      if (arg.strength === 'STRONG') {
        report.executiveSummary.strongArguments.push(arg.title);
      } else {
        report.executiveSummary.moderateArguments.push(arg.title);
      }
    }

    // === SUGGEST APPROACH ===
    const hasStrongDTA = report.arguments.some(a => 
      a.type === 'DTA' && a.strength === 'STRONG'
    );
    
    if (hasStrongDTA) {
      report.executiveSummary.suggestedApproach = 'HLR';
      report.executiveSummary.rationale = 
        'Strong Duty to Assist errors identified. HLR allows senior reviewer to catch obvious errors without submitting new evidence.';
    } else if (report.arguments.length > 2) {
      report.executiveSummary.suggestedApproach = 'SUPPLEMENTAL';
      report.executiveSummary.rationale = 
        'Multiple issues identified. Supplemental Claim allows adding evidence to strengthen each argument.';
    } else {
      report.executiveSummary.suggestedApproach = 'NOD';
      report.executiveSummary.rationale = 
        'Consider Board Appeal for de novo review of all evidence.';
    }

    // === BUILD EVIDENCE RECOMMENDATIONS ===
    report.recommendedEvidence = buildEvidenceRecommendations(gapReport, report.arguments);

    // === VKB INTEGRATION ===
    report.vkbIntegration.conditionsAffected = extractAffectedConditions(gapReport);
    report.vkbIntegration.gapAlerts = gapReport.gaps?.map(g => ({
      type: g.evidenceType,
      impact: g.potentialImpact,
      action: 'Review and potentially use in appeal',
    })) || [];

    // Convert Sets to Arrays for JSON serialization
    report.cfrCitations = [...report.cfrCitations];
    report.caseLawCitations = [...report.caseLawCitations];

  } catch (err) {
    report.error = err.message;
  }

  return report;
}

/**
 * Build a Duty to Assist argument from gaps
 */
function buildDTAArgument(gapReport) {
  if (!gapReport.gaps || gapReport.gaps.length === 0) return null;

  const evidenceList = gapReport.gaps
    .slice(0, 5) // Top 5 most important
    .map(g => g.preview?.substring(0, 100))
    .filter(Boolean)
    .join('; ');

  const template = ARGUMENT_TEMPLATES.DTA_EVIDENCE_NOT_CONSIDERED;
  
  return {
    type: 'DTA',
    title: 'Failure to Consider All Evidence of Record',
    strength: gapReport.gaps.length >= 3 ? 'STRONG' : 'MODERATE',
    
    // The argument text (to be customized)
    argument: template.template
      .replace('{evidenceDescription}', evidenceList || 'multiple relevant documents')
      .replace('{condition}', '[CONDITION]')
      .replace('{decisionDate}', '[DECISION DATE]'),
    
    cfr: template.cfr,
    caselaw: template.caselaw,
    
    // Supporting details
    supportingEvidence: gapReport.gaps.map(g => ({
      type: g.evidenceType,
      preview: g.preview?.substring(0, 200),
      impact: g.potentialImpact,
    })),
    
    // Customization prompts for user
    customizationNeeded: [
      'Replace [CONDITION] with the specific claimed condition',
      'Replace [DECISION DATE] with the actual date from the rating decision',
    ],
  };
}

/**
 * Build argument from a specific violation
 */
function buildViolationArgument(violation, gapReport) {
  let template;
  let title;
  let customFields = {};

  switch (violation.code) {
    case 'DTA-002':
      template = ARGUMENT_TEMPLATES.DTA_NO_EXAM;
      title = 'Failure to Provide Medical Examination';
      customFields = {
        '[currentDisability]': 'the claimed condition',
        '[inServiceEvent]': 'documented in service records',
      };
      break;
      
    case 'DTA-003':
      template = ARGUMENT_TEMPLATES.DTA_INADEQUATE_EXAM;
      title = 'Inadequate C&P Examination';
      customFields = {
        '[examDate]': 'the exam date',
        '[inadequacyReason]': 'failed to provide adequate rationale for the nexus opinion',
      };
      break;
      
    case 'DTA-005':
      template = ARGUMENT_TEMPLATES.NEXUS_POSITIVE_IGNORED;
      title = 'Favorable Nexus Evidence Ignored';
      customFields = {
        '[providerName]': 'the medical provider',
        '[nexusQuote]': 'the relevant nexus statement',
      };
      break;
      
    default:
      return null;
  }

  let argumentText = template.template;
  for (const [placeholder, defaultValue] of Object.entries(customFields)) {
    argumentText = argumentText.replace(placeholder, defaultValue);
  }

  return {
    type: violation.code,
    title,
    strength: violation.severity === 'HIGH' ? 'STRONG' : 'MODERATE',
    argument: argumentText,
    cfr: template.cfr,
    caselaw: template.caselaw,
    customizationNeeded: Object.keys(customFields).map(k => `Replace ${k} with actual value`),
  };
}

/**
 * Build benefit of the doubt argument
 */
function buildBenefitOfDoubtArgument(gapReport) {
  const template = ARGUMENT_TEMPLATES.BENEFIT_OF_DOUBT;
  
  return {
    type: 'CLOSING',
    title: 'Benefit of the Doubt',
    strength: 'SUPPORTING',
    argument: template.template.replace('{issue}', 'service connection'),
    cfr: template.cfr,
    caselaw: template.caselaw,
    note: 'Use this as a closing argument - always include benefit of doubt language.',
  };
}

/**
 * Build evidence recommendations based on gaps
 */
function buildEvidenceRecommendations(gapReport, arguments_) {
  const recommendations = [];

  // If no exam was provided, recommend getting one
  const noExamArg = arguments_.find(a => a.type === 'DTA-002');
  if (noExamArg) {
    recommendations.push({
      type: 'NEXUS_LETTER',
      description: 'Obtain Independent Medical Opinion (IMO) establishing nexus',
      priority: 'HIGH',
      estimatedCost: '$500-$1500',
    });
  }

  // If evidence was ignored, recommend buddy statements
  if (gapReport.gaps?.length > 0) {
    recommendations.push({
      type: 'BUDDY_STATEMENT',
      description: 'Obtain buddy statements from fellow service members who witnessed condition/events',
      priority: 'MEDIUM',
      estimatedCost: 'Free',
    });
  }

  // Always recommend getting complete records
  recommendations.push({
    type: 'RECORDS',
    description: 'Request complete copy of C-File to identify all available evidence',
    priority: 'HIGH',
    estimatedCost: 'Free (VA Form 20-10206)',
  });

  return recommendations;
}

/**
 * Extract affected conditions from gap report
 */
function extractAffectedConditions(gapReport) {
  // Get from adversarial report if available
  if (gapReport.adversarialReport?.vkbIntegration?.conditionsAffected) {
    return gapReport.adversarialReport.vkbIntegration.conditionsAffected;
  }
  return [];
}

/**
 * Generate a complete HLR brief from evidence gaps
 */
export function generateHLRBrief(decisionText, cFileText) {
  // Run gap analysis
  const gapReport = findEvidenceGaps(decisionText, cFileText);
  
  // Generate arguments
  const adversarialReport = generateAdversarialArguments(gapReport, {
    appealType: 'HLR',
  });

  // Build the brief
  return {
    type: 'HLR_BRIEF',
    generatedAt: new Date().toISOString(),
    
    // Header info
    form: 'VA Form 20-0996',
    deadline: '1 year from decision date',
    
    // Analysis summary
    gapAnalysis: {
      gapsFound: gapReport.gapCount,
      violations: gapReport.potentialViolations?.length || 0,
      severityScore: gapReport.severityScore,
    },
    
    // Ready-to-use arguments
    arguments: adversarialReport.arguments,
    
    // Legal support
    citations: {
      cfr: adversarialReport.cfrCitations,
      caselaw: adversarialReport.caseLawCitations,
    },
    
    // Action items
    recommendations: adversarialReport.recommendedEvidence,
    suggestedApproach: adversarialReport.executiveSummary,
    
    // Raw data for advanced users
    rawGapReport: gapReport,
  };
}

/**
 * Generate a NOD brief
 */
export function generateNODBrief(decisionText, cFileText, lane = 'Direct Review') {
  const gapReport = findEvidenceGaps(decisionText, cFileText);
  const adversarialReport = generateAdversarialArguments(gapReport, {
    appealType: 'NOD',
  });

  return {
    type: 'NOD_BRIEF',
    lane,
    generatedAt: new Date().toISOString(),
    form: 'VA Form 10182',
    
    // Lane-specific guidance
    laneGuidance: {
      'Direct Review': 'Board reviews existing record only. Best for clear errors.',
      'Evidence Submission': 'Can submit new evidence to Board. 90-day window.',
      'Hearing': 'Virtual or in-person hearing with Veterans Law Judge.',
    }[lane],
    
    gapAnalysis: {
      gapsFound: gapReport.gapCount,
      violations: gapReport.potentialViolations?.length || 0,
    },
    
    arguments: adversarialReport.arguments,
    citations: {
      cfr: adversarialReport.cfrCitations,
      caselaw: adversarialReport.caseLawCitations,
    },
    
    recommendations: adversarialReport.recommendedEvidence,
  };
}

export default {
  generateAdversarialArguments,
  generateHLRBrief,
  generateNODBrief,
  ARGUMENT_TEMPLATES,
  APPEAL_TYPES,
};
