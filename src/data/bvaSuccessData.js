/**
 * Vet-Rate.org - BVA Success Rate Data
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * Data derived from analysis of 18,609 BVA decisions (2023-2025)
 * Source: Claim Raven BVA Decision Analysis
 * 
 * DISCLAIMER: These are aggregate patterns from cases that made it to BVA.
 * Individual case outcomes depend on specific evidence and circumstances.
 * This is NOT legal advice - work with an accredited representative.
 */

// ============================================================
// OVERALL BVA OUTCOMES (n=14,600 substantive decisions)
// ============================================================
export const BVA_OVERALL_OUTCOMES = {
  remanded: 40,      // Sent back for additional development
  granted: 32,       // Won outright
  denied: 28,        // Denied
  favorableRate: 72, // Grant + Remand (veteran wins or gets another chance)
  sampleSize: 14600,
  note: 'These are cases that made it to BVA - many veterans win at RO level and never appear here.'
};

// ============================================================
// NEXUS PROVIDER COMPARISON
// This is the most significant finding - provider type matters
// ============================================================
export const NEXUS_PROVIDER_OUTCOMES = {
  treatingPhysician: {
    label: 'Treating Physician',
    cases: 625,
    grantRate: 81.3,
    grantPlusRemand: 94.4,
    description: 'Doctor who has ongoing treatment relationship with veteran',
    tip: 'Your regular doctor who knows your history is often the most credible source.'
  },
  privateIME: {
    label: 'Private IME/IMO',
    cases: 1232,
    grantRate: 78.0,
    grantPlusRemand: 92.0,
    description: 'Independent Medical Examiner hired by veteran',
    tip: 'Private doctors often write more detailed opinions with better rationale.'
  },
  vaExaminer: {
    label: 'VA C&P Examiner',
    cases: 6310,
    grantRate: 31.2,
    grantPlusRemand: 77.5,
    description: 'VA examiner during Compensation & Pension exam',
    tip: 'VA examiners process high volumes - consider supplementing with private opinion.'
  }
};

// ============================================================
// NEXUS QUALITY IMPACT
// What judges call "strong" vs "weak" nexus opinions
// ============================================================
export const NEXUS_QUALITY_OUTCOMES = {
  strong: {
    label: 'Strong Nexus',
    cases: 1863,
    grantRate: 97.0,
    grantPlusRemand: 97.4,
    criteria: [
      'Cites specific medical literature',
      'Rules out other potential causes',
      'References veteran\'s actual service records',
      'Explains the biological/medical mechanism',
      'Uses "at least as likely as not" with supporting data'
    ],
    judgeQuote: '"The Board finds the private physician\'s opinion to be more probative, because it is based on an accurate medical history and provides an explanation that contains clear conclusions and supporting data."'
  },
  adequate: {
    label: 'Adequate Nexus',
    cases: 2464,
    grantRate: 69.9,
    grantPlusRemand: 89.2,
    criteria: [
      'Provides basic rationale',
      'Uses correct legal standard',
      'References some medical history',
      'May lack detailed mechanism explanation'
    ],
    judgeQuote: '"The examiner\'s opinion is adequate for rating purposes, though a more detailed rationale would strengthen the analysis."'
  },
  weak: {
    label: 'Weak Nexus',
    cases: 3365,
    grantRate: 1.3,
    grantPlusRemand: 73.4,
    criteria: [
      'Conclusory statement without explanation',
      'No medical literature cited',
      'Generic "less likely than not" without rationale',
      'Does not address veteran\'s specific history'
    ],
    judgeQuote: '"The examiner failed to adequately explain its findings... Without any reconciliation of these conflicting findings, the Board must find that the examination is inadequate."'
  },
  missing: {
    label: 'No Nexus Opinion',
    cases: 2141,
    grantRate: 0.1,
    grantPlusRemand: 61.6,
    criteria: [
      'No medical opinion linking condition to service',
      'Diagnosis exists but no causation opinion',
      'Typically results in remand for new exam'
    ],
    judgeQuote: '"In the absence of a nexus opinion, the claim cannot be granted. The case is remanded for a medical opinion."'
  },
  inadequate: {
    label: 'Inadequate (Remanded)',
    cases: 231,
    grantRate: 0.0,
    grantPlusRemand: 99.6,
    criteria: [
      'Opinion so deficient it cannot be used',
      'Wrong standard applied',
      'Critical evidence not reviewed',
      'Almost always results in remand'
    ],
    judgeQuote: '"Here, the Board finds that the opinion is inadequate, as the examiner did not offer an etiology opinion on the condition."'
  }
};

// ============================================================
// C&P EXAM ADEQUACY PARADOX
// Inadequate exams often lead to remand (another chance)
// ============================================================
export const EXAM_ADEQUACY_OUTCOMES = {
  adequate: {
    label: 'Exam Found Adequate',
    cases: 4974,
    granted: 42.1,
    remanded: 1.4,
    denied: 55.1,
    note: 'When VA says exam is adequate, denial rate is higher - but evidence was properly considered.'
  },
  inadequate: {
    label: 'Exam Found Inadequate',
    cases: 6872,
    granted: 25.1,
    remanded: 67.8,
    denied: 6.1,
    note: 'Inadequate exams rarely result in denial - usually remanded for new exam.'
  }
};

// ============================================================
// COMMON EXAM DEFICIENCIES (What gets exams thrown out)
// ============================================================
export const EXAM_DEFICIENCIES = [
  { type: 'No rationale provided', count: 4044, description: 'Examiner gave conclusion without explaining why' },
  { type: 'Conclusory opinion', count: 2415, description: 'Just checked a box without analysis' },
  { type: 'Incomplete physical exam', count: 2352, description: 'Did not fully evaluate the condition' },
  { type: 'Missing review of records', count: 2280, description: 'Did not review C-File or medical history' },
  { type: 'Inadequate specialist', count: 1693, description: 'Wrong type of doctor for the condition' },
  { type: 'Wrong standard used', count: 595, description: 'Did not apply "at least as likely as not" standard' }
];

// ============================================================
// LAY EVIDENCE IMPACT
// How judges characterize the impact of personal/buddy statements
// ============================================================
export const LAY_EVIDENCE_IMPACT = {
  decisive: {
    label: 'Lay Evidence Decisive',
    cases: 1249,
    grantRate: 72.9,
    grantPlusRemand: 99.6,
    characteristics: [
      'Specific about timing of onset',
      'Detailed symptom descriptions',
      'Establishes continuity from service to present',
      'Corroborated by multiple witnesses'
    ],
    judgeQuote: '"The Veteran\'s credible and competent lay statements establish that his tinnitus onset during his active service."'
  },
  supportive: {
    label: 'Lay Evidence Supportive',
    cases: 3280,
    grantRate: 44.3,
    grantPlusRemand: 94.0,
    characteristics: [
      'Provides helpful context',
      'Supports but doesn\'t prove nexus alone',
      'Describes observable symptoms'
    ],
    judgeQuote: '"The lay statements are competent evidence regarding observable symptoms and lend support to the veteran\'s claim."'
  },
  mentioned: {
    label: 'Lay Evidence Mentioned',
    cases: 1582,
    grantRate: 10.0,
    grantPlusRemand: 55.9,
    characteristics: [
      'Acknowledged but not heavily weighted',
      'May lack specificity',
      'General statements without details'
    ],
    judgeQuote: '"The Board has considered the veteran\'s statements, however, they do not establish the required nexus."'
  },
  notAddressed: {
    label: 'Lay Evidence Not Addressed',
    cases: 6447,
    grantRate: 20.8,
    grantPlusRemand: 60.4,
    characteristics: [
      'No lay statements submitted',
      'Or statements not discussed in decision'
    ],
    note: 'Missing lay evidence is a common gap that can be fixed on appeal.'
  }
};

// ============================================================
// CONNECTION TYPE COMPARISON
// ============================================================
export const CONNECTION_TYPE_OUTCOMES = {
  presumptive: {
    label: 'Presumptive Service Connection',
    cases: 1172,
    grantPlusRemand: 82.4,
    description: 'VA presumes service connection (e.g., Agent Orange, Gulf War)',
    tip: 'Check if your condition qualifies for presumptive service connection.'
  },
  secondary: {
    label: 'Secondary Service Connection',
    cases: 3636,
    grantPlusRemand: 81.0,
    description: 'Condition caused or aggravated by already service-connected disability',
    tip: 'Secondary claims have high success rates - document the medical link.'
  },
  direct: {
    label: 'Direct Service Connection',
    cases: 7359,
    grantPlusRemand: 71.6,
    description: 'Condition directly caused by something during service',
    tip: 'Requires nexus opinion linking current condition to in-service event.'
  }
};

// ============================================================
// SPECIFIC SECONDARY CONDITION OUTCOMES
// ============================================================
export const SECONDARY_CONDITION_OUTCOMES = {
  'Radiculopathy secondary to DDD': { cases: 422, grantRate: 43.8, grantPlusRemand: 72.5 },
  'Sleep apnea secondary to obesity': { cases: 407, grantRate: 42.5, grantPlusRemand: 78.1 },
  'Neuropathy secondary to diabetes': { cases: 330, grantRate: 24.5, grantPlusRemand: 75.7 },
  'Sleep apnea secondary to weight gain': { cases: 316, grantRate: 36.4, grantPlusRemand: 82.3 },
  'Hypertension secondary to sleep apnea': { cases: 155, grantRate: 10.3, grantPlusRemand: 79.4 }
};

// ============================================================
// PRIOR DENIALS AND PERSISTENCE
// Veterans who keep fighting often eventually win
// ============================================================
export const PRIOR_DENIAL_OUTCOMES = {
  0: { label: 'No Prior Denials', cases: 2589, grantRate: 30.2, grantPlusRemand: 67.2 },
  1: { label: '1 Prior Denial', cases: 8504, grantRate: 31.5, grantPlusRemand: 74.6 },
  2: { label: '2 Prior Denials', cases: 1744, grantRate: 32.9, grantPlusRemand: 72.7 },
  '3+': { label: '3+ Prior Denials', cases: 399, grantRate: 41.4, grantPlusRemand: 71.7 }
};

// ============================================================
// TOP DENIAL REASONS
// ============================================================
export const TOP_DENIAL_REASONS = [
  { reason: 'Severity insufficient', count: 2063, description: 'Condition doesn\'t meet rating criteria threshold' },
  { reason: 'Nexus gap', count: 1813, description: 'No credible medical link to service' },
  { reason: 'Service connection missing', count: 1278, description: 'Can\'t establish service connection' },
  { reason: 'Procedural issue', count: 1179, description: 'Claim filed incorrectly or timeline issues' },
  { reason: 'Diagnosis missing', count: 1142, description: 'No current diagnosis of claimed condition' },
  { reason: 'In-service event missing', count: 936, description: 'No evidence of event during service' },
  { reason: 'Timeliness issue', count: 815, description: 'Missed deadlines or continuity gaps' }
];

// ============================================================
// TOP REMAND REASONS (Why BVA sends cases back)
// ============================================================
export const TOP_REMAND_REASONS = [
  { reason: 'Inadequate examination', count: 1303, remedy: 'Request new C&P exam with adequate specialist' },
  { reason: 'Duty to assist error', count: 1250, remedy: 'VA failed to help gather evidence - point this out' },
  { reason: 'Inadequate nexus opinion', count: 704, remedy: 'Get private nexus letter with full rationale' },
  { reason: 'Inadequate C&P exam', count: 412, remedy: 'Document exam deficiencies specifically' },
  { reason: 'Missing nexus opinion', count: 240, remedy: 'Obtain nexus opinion before resubmitting' },
  { reason: 'Inadequate examiner rationale', count: 176, remedy: 'Challenge lack of explanation in opinion' }
];

// ============================================================
// CONDITION-SPECIFIC OUTCOMES
// ============================================================
export const CONDITION_OUTCOMES = {
  'TDIU': { cases: 454, grantRate: 51.1, grantPlusRemand: 76.7 },
  'Effective Date': { cases: 411, grantRate: 46.7, grantPlusRemand: 59.6 },
  'Leukemia': { cases: 488, grantRate: 43.9, grantPlusRemand: 79.7 },
  'Radiculopathy (secondary)': { cases: 422, grantRate: 43.8, grantPlusRemand: 72.5 },
  'SMC': { cases: 482, grantRate: 43.2, grantPlusRemand: 72.4 },
  'Sleep Apnea (secondary/obesity)': { cases: 407, grantRate: 42.5, grantPlusRemand: 78.1 },
  'Tinnitus': { cases: 1107, grantRate: 41.0, grantPlusRemand: 65.2 },
  'PTSD': { cases: 668, grantRate: 39.2, grantPlusRemand: 63.2 },
  'Knee': { cases: 462, grantRate: 37.9, grantPlusRemand: 66.2 },
  'Lymphoma': { cases: 459, grantRate: 34.4, grantPlusRemand: 73.4 },
  'Cancer': { cases: 500, grantRate: 33.2, grantPlusRemand: 77.6 },
  'Scars': { cases: 377, grantRate: 53.3, denialRate: 46.7, note: 'Highest denial rate' },
  'Rating Increase': { cases: 137, grantRate: 60.6, denialRate: 39.4, note: 'High denial for increases' }
};

// ============================================================
// BVA JUDGE QUOTES - What wins and what loses
// ============================================================
export const BVA_JUDGE_QUOTES = {
  privateOpinionWins: [
    '"The Board finds the private physician\'s opinion to be more probative, because it is based on an accurate medical history and provides an explanation that contains clear conclusions and supporting data."',
    '"While the VA medical opinions are not void of probative value, their persuasiveness is outweighed by the thorough analysis proffered in the private medical opinion."',
    '"In this case, the VA examiners\' opinions are assigned less probative weight because, unlike the private clinicians, the VA examiners did not adequately consider the Veteran\'s reports concerning the history and symptoms of his disabilities."',
    '"Given the private examiner\'s thorough analysis, the Board finds the opinion highly probative. The examiner discussed and summarized relevant STRs as well as pertinent post-service treatment records."'
  ],
  inadequateExam: [
    '"The examiner failed to adequately explain its findings... Without any reconciliation of these conflicting findings, the Board must find that the examination is inadequate for adjudication purposes."',
    '"The examiner did not address the Veteran\'s competent and credible reports of [symptoms] that first onset in service and have persisted to the present."',
    '"The clinician found that a thorough review of medical literature failed to demonstrate a causal relationship - however, he also failed to indicate which studies/medical literature he relied on."',
    '"Opinions based on inaccurate facts, particularly when the inaccurate facts are directly related to the basis of the opinion, have no probative value."'
  ],
  layEvidenceWins: [
    '"The Veteran\'s credible and competent lay statements establish that his tinnitus onset during his active service."',
    '"The competent and credible evidence of record persuasively establishes a finding that the Veteran\'s lumbar spine disability is a result of his continuous heavy lifting while on active-duty service."',
    '"Thus, the Board finds that the Veteran\'s competent and credible lay evidence is sufficient to establish a nexus between service and tinnitus."',
    '"There is no reason for the Board to question the veracity of the lay statements submitted in support of this claim."'
  ],
  benefitOfDoubt: [
    '"The benefit of the doubt rule provides that a veteran will prevail in a case where the positive evidence is in a relative balance with the negative evidence."',
    '"As the reasonable doubt created by this relative equipoise in the evidence of record must be resolved in the Veteran\'s favor, entitlement to service connection is warranted."'
  ],
  secondaryConnection: [
    '"Obesity resulting from a service-connected disability can be an intermediate step in establishing secondary service connection for a non-service-connected current disability."',
    '"These opinions sufficiently explain that the risk of developing sleep apnea is significantly increased by obesity; that the Veteran\'s inactive lifestyle due to his gout caused him to gain weight and become obese; and that his obesity caused sleep apnea."'
  ]
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get success probability badge based on grant rate
 */
export function getSuccessBadge(grantRate) {
  if (grantRate >= 70) return { label: 'High Success', color: 'green', emoji: '🟢' };
  if (grantRate >= 40) return { label: 'Moderate Success', color: 'yellow', emoji: '🟡' };
  if (grantRate >= 20) return { label: 'Lower Success', color: 'orange', emoji: '🟠' };
  return { label: 'Difficult', color: 'red', emoji: '🔴' };
}

/**
 * Get nexus quality score based on characteristics
 */
export function scoreNexusQuality(nexusText) {
  let score = 0;
  const checks = {
    hasLikelyAsNot: /at least as likely as not|more likely than not|50%|fifty percent/i.test(nexusText),
    citesMedicalLit: /study|studies|research|literature|journal|published/i.test(nexusText),
    explainsMechanism: /mechanism|pathway|causes|results in|leads to|due to/i.test(nexusText),
    referencesRecords: /service (treatment )?records|STR|medical history|review of/i.test(nexusText),
    rulesOutOther: /rule out|other causes|no other|not due to other/i.test(nexusText),
    hasRationale: nexusText.length > 500 && /because|therefore|based on|as a result/i.test(nexusText)
  };
  
  if (checks.hasLikelyAsNot) score += 20;
  if (checks.citesMedicalLit) score += 20;
  if (checks.explainsMechanism) score += 20;
  if (checks.referencesRecords) score += 15;
  if (checks.rulesOutOther) score += 15;
  if (checks.hasRationale) score += 10;
  
  return {
    score,
    quality: score >= 80 ? 'strong' : score >= 50 ? 'adequate' : 'weak',
    checks,
    recommendations: Object.entries(checks)
      .filter(([_, passed]) => !passed)
      .map(([check]) => {
        const recommendations = {
          hasLikelyAsNot: 'Add "at least as likely as not (50% or greater probability)" language',
          citesMedicalLit: 'Reference specific medical studies or literature',
          explainsMechanism: 'Explain the medical mechanism connecting conditions',
          referencesRecords: 'Reference the veteran\'s specific service records',
          rulesOutOther: 'Discuss and rule out other potential causes',
          hasRationale: 'Provide more detailed rationale for the conclusion'
        };
        return recommendations[check];
      })
  };
}

/**
 * Get persistence encouragement based on prior denials
 */
export function getPersistenceMessage(priorDenials) {
  const data = PRIOR_DENIAL_OUTCOMES[priorDenials >= 3 ? '3+' : priorDenials];
  if (priorDenials >= 3) {
    return {
      message: `Veterans with 3+ prior denials have a ${data.grantRate}% grant rate - HIGHER than first-time claims! Your persistence is paying off.`,
      emoji: '💪',
      encouragement: 'The data shows veterans who keep fighting often eventually win. You\'ve gathered more evidence each time.'
    };
  }
  if (priorDenials >= 1) {
    return {
      message: `Don't give up! Veterans with ${priorDenials} prior denial(s) still have a ${data.grantPlusRemand}% favorable outcome rate at BVA.`,
      emoji: '🎯',
      encouragement: 'Each appeal is a chance to add stronger evidence. Focus on what was missing before.'
    };
  }
  return {
    message: 'Building a strong case from the start gives you the best chance of success.',
    emoji: '📋',
    encouragement: 'Use this tool to identify gaps before you file.'
  };
}

export default {
  BVA_OVERALL_OUTCOMES,
  NEXUS_PROVIDER_OUTCOMES,
  NEXUS_QUALITY_OUTCOMES,
  EXAM_ADEQUACY_OUTCOMES,
  EXAM_DEFICIENCIES,
  LAY_EVIDENCE_IMPACT,
  CONNECTION_TYPE_OUTCOMES,
  SECONDARY_CONDITION_OUTCOMES,
  PRIOR_DENIAL_OUTCOMES,
  TOP_DENIAL_REASONS,
  TOP_REMAND_REASONS,
  CONDITION_OUTCOMES,
  BVA_JUDGE_QUOTES,
  getSuccessBadge,
  scoreNexusQuality,
  getPersistenceMessage
};
