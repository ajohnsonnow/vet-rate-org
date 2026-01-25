/**
 * SupplyLocker.org - Claim Navigator Schema
 * Master VA Claims Workflow Data Structures
 * 
 * This schema represents the complete state of a veteran's claim,
 * enabling state-aware navigation through the VA claims process.
 * 
 * Built by a fellow veteran. "Know exactly where you stand."
 * 
 * References:
 * - 38 CFR Part 4 (Rating Schedule)
 * - VA Form 21-526EZ (Disability Compensation)
 * - VA Form 21-0966 (Intent to File)
 * - Appeals Modernization Act (AMA)
 */

// ============================================
// CLAIM TYPE DEFINITIONS
// ============================================
export const CLAIM_TYPES = {
  ORIGINAL: {
    code: 'ORIGINAL',
    label: 'Original Claim',
    description: 'First time filing for this condition',
    form: 'VA Form 21-526EZ',
    info: 'You\'ve never filed for VA disability compensation for this condition before.',
    icon: 'FileText'
  },
  INCREASE: {
    code: 'INCREASE',
    label: 'Claim for Increase',
    description: 'Currently rated condition has gotten worse',
    form: 'VA Form 21-526EZ',
    info: 'You already have a VA rating for this condition, but your symptoms have worsened.',
    icon: 'TrendingUp'
  },
  SECONDARY: {
    code: 'SECONDARY',
    label: 'Secondary Claim',
    description: 'New condition caused by service-connected disability',
    form: 'VA Form 21-526EZ',
    info: 'This condition was caused or aggravated by a disability you\'re already rated for.',
    icon: 'GitBranch'
  },
  SUPPLEMENTAL: {
    code: 'SUPPLEMENTAL',
    label: 'Supplemental Claim',
    description: 'Re-filing with new and relevant evidence',
    form: 'VA Form 20-0995',
    info: 'You were denied within the last year and have NEW evidence to support your claim.',
    icon: 'FilePlus'
  },
  HLR: {
    code: 'HLR',
    label: 'Higher-Level Review',
    description: 'Requesting review for legal/procedural error',
    form: 'VA Form 20-0996',
    info: 'You believe the VA made an error reviewing your claim. No new evidence allowed.',
    icon: 'Scale'
  },
  BOARD_APPEAL: {
    code: 'BOARD_APPEAL',
    label: 'Board Appeal',
    description: 'Appeal to the Board of Veterans\' Appeals',
    form: 'VA Form 10182',
    info: 'Request a Veterans Law Judge to review your case. Multi-year wait typical.',
    icon: 'Gavel'
  },
  REOPEN: {
    code: 'REOPEN',
    label: 'Reopened Claim',
    description: 'Previously denied claim (>1 year ago)',
    form: 'VA Form 20-0995',
    info: 'Treated as a Supplemental Claim. Need new evidence to reopen.',
    icon: 'RefreshCw'
  }
};

// ============================================
// CLAIM PHASES (The VA Lifecycle)
// ============================================
export const CLAIM_PHASES = {
  TRIAGE: {
    code: 'TRIAGE',
    label: 'Triage',
    step: 0,
    description: 'Determining the right claim lane',
    vaStatus: null,
    userAction: 'Answer intake questions to determine claim type'
  },
  INTENT_TO_FILE: {
    code: 'INTENT_TO_FILE',
    label: 'Intent to File',
    step: 1,
    description: 'Clock is started for potential backpay',
    vaStatus: 'Intent to File on Record',
    userAction: 'Submit VA Form 21-0966 to lock in your effective date',
    form: '21-0966',
    critical: true,
    criticalReason: 'Protects your potential backpay date!'
  },
  GATHERING_EVIDENCE: {
    code: 'GATHERING_EVIDENCE',
    label: 'Gathering Evidence',
    step: 2,
    description: 'Building the "Big 3" (Diagnosis, Nexus, Service Event)',
    vaStatus: null,
    userAction: 'Collect medical records, nexus letters, and lay statements',
    substeps: ['diagnosis', 'nexus', 'dbq', 'personalStatement', 'buddyLetters']
  },
  CLAIM_SUBMITTED: {
    code: 'CLAIM_SUBMITTED',
    label: 'Claim Submitted',
    step: 3,
    description: 'Claim is with the VA',
    vaStatus: 'Claim Received',
    userAction: 'Monitor status on VA.gov. Respond promptly to any requests.'
  },
  INITIAL_REVIEW: {
    code: 'INITIAL_REVIEW',
    label: 'Initial Review',
    step: 4,
    description: 'VA is reviewing for completeness',
    vaStatus: 'Initial Review',
    userAction: 'Watch for requests for additional evidence'
  },
  EVIDENCE_GATHERING: {
    code: 'EVIDENCE_GATHERING',
    label: 'Evidence Gathering',
    step: 5,
    description: 'VA is collecting/reviewing evidence',
    vaStatus: 'Evidence Gathering, Review, and Decision',
    userAction: 'Check if VA sent requests. Respond within 30 days.'
  },
  CP_EXAM_SCHEDULED: {
    code: 'CP_EXAM_SCHEDULED',
    label: 'C&P Exam',
    step: 6,
    description: 'Compensation & Pension Exam',
    vaStatus: 'C&P Exam Scheduled',
    userAction: 'Attend ALL exams. Do NOT downplay symptoms. Be honest.',
    critical: true,
    criticalReason: 'The C&P exam often determines your rating percentage!'
  },
  PREPARATION_FOR_DECISION: {
    code: 'PREPARATION_FOR_DECISION',
    label: 'Preparation for Decision',
    step: 7,
    description: 'Rater is reviewing and making decision',
    vaStatus: 'Preparation for Decision',
    userAction: 'Wait. This is the "Black Box" phase. Decision coming soon.'
  },
  DECISION: {
    code: 'DECISION',
    label: 'Decision',
    step: 8,
    description: 'VA has made a decision',
    vaStatus: 'Pending Decision Approval',
    userAction: 'Check your decision letter. Review rating vs. evidence.',
    substeps: ['granted', 'denied', 'deferred']
  },
  APPEAL: {
    code: 'APPEAL',
    label: 'Appeal',
    step: 9,
    description: 'Challenging the VA decision',
    vaStatus: 'Appeal Filed',
    userAction: 'Choose appeal lane (Supplemental, HLR, Board)',
    critical: true,
    criticalReason: 'You have ONE YEAR from decision date to appeal!'
  }
};

// ============================================
// EVIDENCE CHECKLIST ITEMS
// ============================================
export const EVIDENCE_ITEMS = {
  // The "Big 3" - Required for any claim
  diagnosis: {
    id: 'diagnosis',
    label: 'Current Diagnosis',
    category: 'medical',
    required: true,
    description: 'A formal diagnosis from a licensed medical provider',
    examples: ['Doctor\'s diagnosis letter', 'VA treatment records', 'Private medical records'],
    weight: 'critical',
    tip: 'Without a current diagnosis, your claim WILL be denied.'
  },
  nexus: {
    id: 'nexus',
    label: 'Nexus Letter',
    category: 'medical',
    required: true,
    description: 'Medical opinion linking your condition to military service',
    examples: ['Private medical opinion', 'VA examiner opinion', 'IMO/IME'],
    weight: 'critical',
    tip: 'The nexus is the "missing link" - it connects your diagnosis to your service.'
  },
  inServiceEvent: {
    id: 'inServiceEvent',
    label: 'In-Service Event',
    category: 'service',
    required: true,
    description: 'Documentation of the event/exposure during service',
    examples: ['Service treatment records', 'Incident reports', 'Line of duty determination'],
    weight: 'critical',
    tip: 'This proves something happened during service that caused your condition.'
  },

  // Supporting Evidence - Highly Recommended
  dbq: {
    id: 'dbq',
    label: 'DBQ (Disability Benefits Questionnaire)',
    category: 'medical',
    required: false,
    recommended: true,
    description: 'VA form filled out by doctor documenting severity',
    examples: ['Completed DBQ for specific condition'],
    weight: 'high',
    tip: 'A DBQ filled by your doctor shows exactly how severe your condition is.'
  },
  personalStatement: {
    id: 'personalStatement',
    label: 'Personal Statement',
    category: 'lay',
    required: false,
    recommended: true,
    description: 'Your detailed account of symptoms and how they affect daily life',
    examples: ['VA Form 21-4138', 'Written statement'],
    weight: 'medium',
    tip: 'The VA MUST consider your testimony. Be detailed and honest.'
  },
  buddyLetters: {
    id: 'buddyLetters',
    label: 'Buddy/Lay Statements',
    category: 'lay',
    required: false,
    recommended: true,
    description: 'Statements from others who witnessed your condition/event',
    examples: ['VA Form 21-10210', 'Spouse statement', 'Fellow service member statement'],
    weight: 'medium',
    tip: 'Third-party observations strengthen your credibility.'
  },

  // Service Records
  strs: {
    id: 'strs',
    label: 'Service Treatment Records (STRs)',
    category: 'service',
    required: false,
    recommended: true,
    description: 'Your medical records from military service',
    examples: ['Sick call records', 'Deployment health assessments', 'Separation physical'],
    weight: 'high',
    tip: 'The VA should already have these, but verify they\'re in your file.'
  },
  dd214: {
    id: 'dd214',
    label: 'DD-214',
    category: 'service',
    required: true,
    description: 'Certificate of Release or Discharge from Active Duty',
    examples: ['Member Copy 4', 'Any service copy'],
    weight: 'critical',
    tip: 'Proves you served. Check your characterization of discharge.'
  },
  personnelRecords: {
    id: 'personnelRecords',
    label: 'Personnel Records',
    category: 'service',
    required: false,
    recommended: true,
    description: 'Military personnel file (201 file)',
    examples: ['Performance evaluations', 'Deployment records', 'MOS records'],
    weight: 'medium',
    tip: 'Can show deployment locations, hazardous duty, etc.'
  },

  // Private Medical Evidence
  privateMedical: {
    id: 'privateMedical',
    label: 'Private Medical Records',
    category: 'medical',
    required: false,
    recommended: true,
    description: 'Treatment records from civilian doctors',
    examples: ['Doctor visits', 'Hospital records', 'Specialist consultations'],
    weight: 'high',
    tip: 'Submit VA Form 21-4142 to authorize VA to obtain these.'
  },
  vaRecords: {
    id: 'vaRecords',
    label: 'VA Treatment Records',
    category: 'medical',
    required: false,
    recommended: true,
    description: 'Records from VA medical facilities',
    examples: ['VA clinic visits', 'VA hospital records', 'VA prescriptions'],
    weight: 'high',
    tip: 'If you\'ve been seen at a VA facility, these records exist.'
  },

  // Specialized Evidence
  photos: {
    id: 'photos',
    label: 'Photographs/Imaging',
    category: 'medical',
    required: false,
    description: 'Visual documentation of condition',
    examples: ['Scar photos', 'X-rays', 'MRI results'],
    weight: 'low',
    tip: 'Photos can show visible conditions (scars, skin conditions, etc.).'
  }
};

// ============================================
// DECISION OUTCOMES
// ============================================
export const DECISION_OUTCOMES = {
  GRANTED: {
    code: 'GRANTED',
    label: 'Granted',
    color: 'green',
    description: 'Your claim was approved',
    nextSteps: [
      'Verify the rating percentage is correct for your symptoms',
      'Check the effective date matches your Intent to File',
      'Review for any secondary conditions to file'
    ]
  },
  GRANTED_LOW: {
    code: 'GRANTED_LOW',
    label: 'Granted - Rating Too Low',
    color: 'yellow',
    description: 'Approved but rating doesn\'t match symptoms',
    nextSteps: [
      'Compare your symptoms to 38 CFR rating criteria',
      'Consider filing for increase with more evidence',
      'Request Higher-Level Review if rating criteria was misapplied'
    ]
  },
  DENIED: {
    code: 'DENIED',
    label: 'Denied',
    color: 'red',
    description: 'Your claim was not approved',
    nextSteps: [
      'Read the denial reason carefully',
      'Determine which element was missing (diagnosis, nexus, or event)',
      'Choose appeal lane within 1 year'
    ]
  },
  DEFERRED: {
    code: 'DEFERRED',
    label: 'Deferred',
    color: 'orange',
    description: 'Decision postponed - more info needed',
    nextSteps: [
      'Check for development letters',
      'Provide requested evidence ASAP',
      'Do not ignore - could result in denial'
    ]
  }
};

// ============================================
// DENIAL REASONS (Common)
// ============================================
export const DENIAL_REASONS = {
  NO_DIAGNOSIS: {
    code: 'NO_DIAGNOSIS',
    label: 'No Current Diagnosis',
    description: 'VA found no evidence of a current disability',
    fix: 'Obtain a formal diagnosis from a licensed medical provider',
    appealLane: 'SUPPLEMENTAL'
  },
  NO_NEXUS: {
    code: 'NO_NEXUS',
    label: 'No Service Connection',
    description: 'VA found no link between condition and military service',
    fix: 'Obtain a nexus letter/Independent Medical Opinion (IMO)',
    appealLane: 'SUPPLEMENTAL'
  },
  NO_EVENT: {
    code: 'NO_EVENT',
    label: 'No In-Service Event',
    description: 'VA found no evidence of in-service occurrence',
    fix: 'Obtain buddy letters, personnel records, or unit history',
    appealLane: 'SUPPLEMENTAL'
  },
  RATER_ERROR: {
    code: 'RATER_ERROR',
    label: 'Rater Overlooked Evidence',
    description: 'Evidence was in the file but not considered',
    fix: 'Request Higher-Level Review citing specific evidence',
    appealLane: 'HLR'
  },
  LEGAL_ERROR: {
    code: 'LEGAL_ERROR',
    label: 'Legal/Procedural Error',
    description: 'VA did not follow proper procedures',
    fix: 'Request Higher-Level Review citing the error',
    appealLane: 'HLR'
  },
  RATING_TOO_LOW: {
    code: 'RATING_TOO_LOW',
    label: 'Rating Criteria Misapplied',
    description: 'Rating doesn\'t match symptoms documented',
    fix: 'Request HLR or file for increase with more evidence',
    appealLane: 'HLR'
  }
};

// ============================================
// VA FORMS REFERENCE
// ============================================
export const VA_FORMS = {
  '21-0966': {
    number: '21-0966',
    name: 'Intent to File',
    purpose: 'Locks in your effective date for backpay',
    whenToUse: 'BEFORE gathering evidence - as soon as you decide to file',
    url: 'https://www.va.gov/find-forms/about-form-21-0966/',
    critical: true
  },
  '21-526EZ': {
    number: '21-526EZ',
    name: 'Application for Disability Compensation',
    purpose: 'The main claim form',
    whenToUse: 'When you have all evidence ready to submit',
    url: 'https://www.va.gov/find-forms/about-form-21-526ez/',
    critical: true
  },
  '20-0995': {
    number: '20-0995',
    name: 'Supplemental Claim',
    purpose: 'Submit new and relevant evidence after denial',
    whenToUse: 'When denied and you have NEW evidence',
    url: 'https://www.va.gov/find-forms/about-form-20-0995/',
    deadline: 365
  },
  '20-0996': {
    number: '20-0996',
    name: 'Higher-Level Review',
    purpose: 'Request senior rater review for error',
    whenToUse: 'When VA made a mistake - NO new evidence allowed',
    url: 'https://www.va.gov/find-forms/about-form-20-0996/',
    deadline: 365
  },
  '10182': {
    number: '10182',
    name: 'Board Appeal (NOD)',
    purpose: 'Appeal to Board of Veterans\' Appeals',
    whenToUse: 'When you want a Veterans Law Judge to decide',
    url: 'https://www.va.gov/find-forms/about-form-10182/',
    deadline: 365,
    note: 'Multi-year wait typical'
  },
  '21-4138': {
    number: '21-4138',
    name: 'Statement in Support of Claim',
    purpose: 'Personal statement/lay evidence',
    whenToUse: 'To explain symptoms and impact on daily life',
    url: 'https://www.va.gov/find-forms/about-form-21-4138/'
  },
  '21-10210': {
    number: '21-10210',
    name: 'Lay/Witness Statement',
    purpose: 'Third-party statement (buddy letter)',
    whenToUse: 'For spouse, family, or fellow service member statements',
    url: 'https://www.va.gov/find-forms/about-form-21-10210/'
  },
  '21-4142': {
    number: '21-4142',
    name: 'Authorization to Release Information',
    purpose: 'Authorize VA to obtain private medical records',
    whenToUse: 'When VA needs to request records from private doctors',
    url: 'https://www.va.gov/find-forms/about-form-21-4142/'
  }
};

// ============================================
// TRIAGE DECISION TREE
// ============================================
export const TRIAGE_QUESTIONS = [
  {
    id: 'filed_before',
    question: 'Have you ever filed a VA disability claim for this condition?',
    options: [
      { value: 'never', label: 'No, this is my first time', next: 'ORIGINAL' },
      { value: 'yes_rated', label: 'Yes, I have a current rating for it', next: 'condition_worse' },
      { value: 'yes_denied', label: 'Yes, but it was denied', next: 'denial_timing' }
    ]
  },
  {
    id: 'condition_worse',
    question: 'Has your service-connected condition gotten worse?',
    options: [
      { value: 'yes', label: 'Yes, my symptoms have worsened', next: 'INCREASE' },
      { value: 'no', label: 'No, but I have a new related condition', next: 'caused_by_rated' }
    ]
  },
  {
    id: 'caused_by_rated',
    question: 'Is this new condition caused or aggravated by a condition you\'re already rated for?',
    options: [
      { value: 'yes', label: 'Yes, it\'s related to my rated condition', next: 'SECONDARY' },
      { value: 'no', label: 'No, it\'s a separate issue from service', next: 'ORIGINAL' }
    ]
  },
  {
    id: 'denial_timing',
    question: 'When were you denied?',
    options: [
      { value: 'under_year', label: 'Less than 1 year ago', next: 'appeal_evidence' },
      { value: 'over_year', label: 'More than 1 year ago', next: 'REOPEN' }
    ]
  },
  {
    id: 'appeal_evidence',
    question: 'Do you have NEW evidence to support your claim?',
    options: [
      { value: 'yes', label: 'Yes, I have new evidence (new doctor notes, nexus, etc.)', next: 'SUPPLEMENTAL' },
      { value: 'no_error', label: 'No, but the VA made an error reviewing my case', next: 'HLR' },
      { value: 'want_judge', label: 'I want a judge to review my case', next: 'BOARD_APPEAL' }
    ]
  }
];

// ============================================
// CLAIM OBJECT SCHEMA (The Main Data Structure)
// ============================================

/**
 * ClaimSchema - The complete representation of a veteran's claim
 * 
 * @typedef {Object} Claim
 * @property {string} id - Unique identifier
 * @property {string} conditionName - Name of the condition being claimed
 * @property {string} diagnosticCode - 38 CFR Diagnostic Code (if known)
 * @property {string} claimType - CLAIM_TYPES code
 * @property {string} currentPhase - CLAIM_PHASES code
 * @property {Object} evidenceChecklist - Boolean flags for each evidence item
 * @property {Object} criticalDates - Important dates for the claim
 * @property {Object} decisionInfo - Information about VA decision (if received)
 * @property {Object} appealInfo - Appeal tracking (if applicable)
 * @property {Array} notes - User notes/timeline entries
 * @property {Object} metadata - Creation/update timestamps
 */
export const createClaimSchema = () => ({
  id: null,
  conditionName: '',
  diagnosticCode: null,
  claimType: null,  // CLAIM_TYPES code
  currentPhase: CLAIM_PHASES.TRIAGE.code,

  // Evidence tracking - the "Big 3" plus supporting docs
  evidenceChecklist: {
    diagnosis: false,
    nexus: false,
    inServiceEvent: false,
    dbq: false,
    personalStatement: false,
    buddyLetters: false,
    strs: false,
    dd214: false,
    privateMedical: false,
    vaRecords: false
  },

  // Critical dates
  criticalDates: {
    itfDate: null,              // Intent to File date (CRITICAL for backpay)
    itfExpirationDate: null,    // ITF expires 1 year after filing
    submissionDate: null,       // When claim was submitted
    decisionDate: null,         // When VA decision was received
    appealDeadline: null,       // 1 year from decision date
    cpExamDate: null,           // Scheduled C&P exam date
    lastStatusCheck: null       // Last time user checked VA.gov
  },

  // Decision details (populated after VA decision)
  decisionInfo: {
    outcome: null,              // DECISION_OUTCOMES code
    ratingPercentage: null,     // Granted percentage (0, 10, 20, etc.)
    effectiveDate: null,        // When rating takes effect
    denialReason: null,         // DENIAL_REASONS code (if denied)
    denialDetails: '',          // User notes on denial
    decisionLetterUploaded: false
  },

  // Appeal tracking
  appealInfo: {
    isAppeal: false,
    originalClaimId: null,      // Link to original claim
    appealLane: null,           // 'SUPPLEMENTAL', 'HLR', 'BOARD_APPEAL'
    appealDate: null,
    appealStatus: null
  },

  // Parent claim (for secondary conditions)
  parentClaimId: null,
  parentConditionName: null,

  // User notes
  notes: [],  // Array of { date, text, type }

  // Metadata
  metadata: {
    createdAt: null,
    updatedAt: null,
    version: 1
  }
});

// ============================================
// URGENCY LEVELS
// ============================================
export const URGENCY_LEVELS = {
  CRITICAL: {
    code: 'CRITICAL',
    label: 'URGENT',
    color: 'red',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-500',
    textColor: 'text-red-700',
    icon: 'AlertTriangle',
    description: 'Immediate action required - deadline approaching'
  },
  HIGH: {
    code: 'HIGH',
    label: 'Important',
    color: 'orange',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-500',
    textColor: 'text-orange-700',
    icon: 'AlertCircle',
    description: 'Action needed soon'
  },
  MEDIUM: {
    code: 'MEDIUM',
    label: 'Recommended',
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-500',
    textColor: 'text-yellow-700',
    icon: 'Clock',
    description: 'Important but not time-sensitive'
  },
  LOW: {
    code: 'LOW',
    label: 'Optional',
    color: 'blue',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-500',
    textColor: 'text-blue-700',
    icon: 'Info',
    description: 'Nice to have'
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate days until a deadline
 */
export const daysUntilDeadline = (deadlineDate) => {
  if (!deadlineDate) return null;
  const deadline = new Date(deadlineDate);
  const today = new Date();
  const diffTime = deadline - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

/**
 * Check if a deadline is approaching (within 30 days)
 */
export const isDeadlineApproaching = (deadlineDate, warningDays = 30) => {
  const days = daysUntilDeadline(deadlineDate);
  return days !== null && days <= warningDays && days > 0;
};

/**
 * Check if a deadline has passed
 */
export const isDeadlinePassed = (deadlineDate) => {
  const days = daysUntilDeadline(deadlineDate);
  return days !== null && days < 0;
};

/**
 * Calculate ITF expiration date (1 year from filing)
 */
export const calculateItfExpiration = (itfDate) => {
  if (!itfDate) return null;
  const date = new Date(itfDate);
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString();
};

/**
 * Calculate appeal deadline (1 year from decision)
 */
export const calculateAppealDeadline = (decisionDate) => {
  if (!decisionDate) return null;
  const date = new Date(decisionDate);
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString();
};

/**
 * Get completeness percentage based on evidence checklist
 */
export const calculateEvidenceCompleteness = (evidenceChecklist) => {
  const criticalItems = ['diagnosis', 'nexus', 'inServiceEvent'];
  const recommendedItems = ['dbq', 'personalStatement', 'buddyLetters'];
  
  let score = 0;
  let maxScore = 0;

  // Critical items worth 30 points each (90 total)
  criticalItems.forEach(item => {
    maxScore += 30;
    if (evidenceChecklist[item]) score += 30;
  });

  // Recommended items worth 3.33 points each (10 total)
  recommendedItems.forEach(item => {
    maxScore += 3.33;
    if (evidenceChecklist[item]) score += 3.33;
  });

  return Math.round((score / maxScore) * 100);
};

/**
 * Check if "Big 3" evidence is complete
 */
export const hasBigThree = (evidenceChecklist) => {
  return (
    evidenceChecklist.diagnosis &&
    evidenceChecklist.nexus &&
    evidenceChecklist.inServiceEvent
  );
};

export default {
  CLAIM_TYPES,
  CLAIM_PHASES,
  EVIDENCE_ITEMS,
  DECISION_OUTCOMES,
  DENIAL_REASONS,
  VA_FORMS,
  TRIAGE_QUESTIONS,
  URGENCY_LEVELS,
  createClaimSchema,
  daysUntilDeadline,
  isDeadlineApproaching,
  isDeadlinePassed,
  calculateItfExpiration,
  calculateAppealDeadline,
  calculateEvidenceCompleteness,
  hasBigThree
};
