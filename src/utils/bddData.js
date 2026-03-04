/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 *
 * BDD (Benefits Delivery at Discharge) Builder Data & Utilities
 * Implements 38 CFR § 3.326 pre-discharge claim filing logic
 *
 * BDD allows active duty service members to file VA disability claims
 * 180-90 days before their separation date, getting C&P exams while
 * still on active duty so benefits start the day after discharge.
 */

// ─────────────────────────────────────────────────────────────
// BDD ELIGIBILITY RULES (38 CFR § 3.326)
// ─────────────────────────────────────────────────────────────
export const BDD_RULES = {
  windowStart: 180,  // Days before separation - earliest you can file
  windowEnd: 90,     // Days before separation - latest for BDD
  // If < 90 days, goes through standard claims (slower)
};

// ─────────────────────────────────────────────────────────────
// BDD TIMELINE MILESTONES
// ─────────────────────────────────────────────────────────────
export const BDD_MILESTONES = [
  {
    id: 'gather-records',
    daysBeforeSep: 210,
    title: 'Gather Service Treatment Records',
    description: 'Request your complete medical records from MHS Genesis / military treatment facilities. You need ALL records - dental, mental health, everything.',
    icon: '📋',
    category: 'preparation',
    details: [
      'Download records from MHS Genesis Patient Portal',
      'Request hard copies from your military treatment facility',
      'Include dental records, mental health records, and all specialty consultations',
      'Get copies of any Line of Duty (LOD) determinations',
      'Collect deployment health assessments and post-deployment screenings'
    ],
    cfr: '38 CFR § 3.159(c)(3)'
  },
  {
    id: 'identify-conditions',
    daysBeforeSep: 200,
    title: 'Identify All Claimable Conditions',
    description: 'Use Vet-Rate tools to identify every condition you should claim. Many veterans only claim their obvious injuries and miss secondary conditions worth thousands.',
    icon: '🔍',
    category: 'preparation',
    details: [
      'Search the Disability Database for your conditions',
      'Use Secondary Scout to find linked conditions',
      'Use MOS Hazard Matcher to identify occupational exposures',
      'Check PACT Act Navigator for toxic exposure presumptives',
      'Review your medical records for diagnosed conditions you forgot about'
    ],
    tools: ['secondary-scout', 'mos-hazard', 'pact-navigator']
  },
  {
    id: 'file-itf',
    daysBeforeSep: 185,
    title: 'File Intent to File (VA Form 21-0966)',
    description: 'Protect your effective date immediately. This gives you one year to submit the full claim while locking in your backpay date.',
    icon: '📅',
    category: 'filing',
    details: [
      'File online at VA.gov or call 1-800-827-1000',
      'This is a 1-minute form that protects your back pay',
      'Your effective date will be the day after separation or ITF date (whichever is later)',
      'You have 1 year from ITF to submit the full claim'
    ],
    cfr: '38 CFR § 3.155',
    critical: true
  },
  {
    id: 'bdd-window-opens',
    daysBeforeSep: 180,
    title: 'BDD Filing Window OPENS',
    description: 'You can now submit your full BDD claim (VA Form 21-526EZ). File as early as possible to give VA time to schedule C&P exams before discharge.',
    icon: '🚀',
    category: 'filing',
    details: [
      'File VA Form 21-526EZ online at VA.gov',
      'Select "BDD" as your claim type',
      'List ALL conditions - do not hold any back',
      'Upload your service treatment records',
      'Provide your separation date and current unit information'
    ],
    cfr: '38 CFR § 3.326',
    critical: true
  },
  {
    id: 'upload-evidence',
    daysBeforeSep: 175,
    title: 'Upload Supporting Evidence',
    description: 'Submit buddy statements, personal statements, and any private medical records that support your claims.',
    icon: '📎',
    category: 'evidence',
    details: [
      'Write personal statements for each condition (use Nexus Builder)',
      'Get buddy/lay statements from fellow service members (use Witness Bench)',
      'Upload private medical records or specialist opinions',
      'Include deployment records showing combat/hazard exposure',
      'Submit any existing nexus letters or Independent Medical Opinions'
    ],
    tools: ['nexus-builder', 'witness-bench', 'forms-helper']
  },
  {
    id: 'cp-exams-scheduled',
    daysBeforeSep: 150,
    title: 'C&P Exams Scheduled',
    description: 'VA will schedule your Compensation & Pension exams while you\'re still on active duty. This is the major advantage of BDD - exams happen before discharge.',
    icon: '🏥',
    category: 'exams',
    details: [
      'VA contracts with VES, QTC, or LHI for exams',
      'You may have multiple exams for different conditions',
      'Prepare using the C&P Exam Simulator tool',
      'Report your WORST days - this is not a fitness test',
      'Bring copies of your medical records to each exam'
    ],
    tools: ['cap-simulator']
  },
  {
    id: 'attend-cp-exams',
    daysBeforeSep: 120,
    title: 'Attend C&P Exams',
    description: 'Attend ALL scheduled exams. Missing an exam can result in automatic denial. Be honest about your worst symptoms - your career is ending, not beginning.',
    icon: '✅',
    category: 'exams',
    details: [
      'Arrive early with your medical records',
      'Describe your WORST days, not your best',
      'Report how conditions affect your daily life and work',
      'Mention all symptoms - even ones you think are minor',
      'Request a copy of the DBQ (Disability Benefits Questionnaire) results',
      'If the exam feels rushed or incomplete, file a request for a new exam'
    ],
    tools: ['cap-simulator'],
    critical: true
  },
  {
    id: 'bdd-window-closes',
    daysBeforeSep: 90,
    title: 'BDD Window CLOSES',
    description: 'Last day to file under BDD. After this, claims go through the standard process which takes much longer (4-6+ months vs. same-day rating).',
    icon: '⚠️',
    category: 'filing',
    critical: true,
    details: [
      'If you missed the BDD window, file immediately as a standard claim',
      'Standard claims can still be filed before discharge',
      'Consider filing an Intent to File if you haven\'t already'
    ],
    cfr: '38 CFR § 3.326(a)'
  },
  {
    id: 'tap-class',
    daysBeforeSep: 60,
    title: 'Complete TAP/TAPS Class',
    description: 'Attend your Transition Assistance Program class. While mandatory, supplement with Vet-Rate tools for much more comprehensive claims preparation.',
    icon: '🎓',
    category: 'transition',
    details: [
      'TAP VA Benefits briefing covers basic claims info',
      'Take notes on any conditions you forgot to claim',
      'Connect with a VSO during the TAP session',
      'Get referrals for any unresolved medical conditions'
    ]
  },
  {
    id: 'final-physical',
    daysBeforeSep: 30,
    title: 'Separation Physical / Final Medical Exam',
    description: 'Report EVERYTHING at your separation physical. Any condition not documented here becomes harder to claim later.',
    icon: '🩺',
    category: 'transition',
    details: [
      'Report ALL conditions - headaches, joint pain, sleep issues, everything',
      'Mention mental health symptoms (anxiety, depression, sleep problems)',
      'Get conditions documented even if you think they\'re minor',
      'This creates a critical "bridge" between service and VA records',
      'Request a copy of your separation physical results'
    ],
    critical: true
  },
  {
    id: 'separation-day',
    daysBeforeSep: 0,
    title: 'Separation / ETS Day',
    description: 'You did it. Your BDD claim should be decided on or very close to your separation date. Benefits begin the day after discharge.',
    icon: '🎖️',
    category: 'transition',
    details: [
      'Check VA.gov for your claim decision',
      'Your effective date should be the day after separation',
      'If not decided yet, it\'s still in the BDD pipeline',
      'Register for VA healthcare at your nearest VA facility',
      'Set up direct deposit on VA.gov for disability payments'
    ]
  },
  {
    id: 'post-separation',
    daysBeforeSep: -30,
    title: 'Post-Separation: Review & Appeal',
    description: 'Review your rating decision. If any condition was underrated or denied, you have options to appeal.',
    icon: '📊',
    category: 'post',
    details: [
      'Review each condition\'s rating against 38 CFR Part 4 criteria',
      'Use Decision Decoder to understand your rating letter',
      'File a Supplemental Claim within 1 year if you disagree',
      'Consider Higher Level Review for clear errors',
      'A Board Appeal is available for complex disputes'
    ],
    tools: ['decision-decoder', 'pathfinder']
  }
];

// ─────────────────────────────────────────────────────────────
// PRE-DISCHARGE CHECKLIST
// ─────────────────────────────────────────────────────────────
export const BDD_CHECKLIST = [
  {
    id: 'has-separation-date',
    label: 'I have a known separation/ETS date',
    category: 'eligibility',
    required: true,
    helpText: 'You need an established separation date to file BDD'
  },
  {
    id: 'active-duty',
    label: 'I am currently on full-time active duty',
    category: 'eligibility',
    required: true,
    helpText: 'Includes Active Duty, ADOS, or National Guard/Reserve on federal orders (Title 10)'
  },
  {
    id: 'within-window',
    label: 'I am within 180 days of my separation date',
    category: 'eligibility',
    required: true,
    helpText: 'BDD claims must be filed 180-90 days before separation'
  },
  {
    id: 'str-available',
    label: 'Service Treatment Records (STR) are available',
    category: 'documents',
    required: true,
    helpText: 'You must provide your service treatment records with your BDD claim'
  },
  {
    id: 'mhs-genesis-downloaded',
    label: 'Downloaded records from MHS Genesis',
    category: 'documents',
    required: false,
    helpText: 'MHS Genesis Patient Portal has your military health records'
  },
  {
    id: 'conditions-identified',
    label: 'All claimable conditions identified',
    category: 'preparation',
    required: true,
    helpText: 'Use Secondary Scout and MOS Hazard Matcher to find all conditions'
  },
  {
    id: 'itf-filed',
    label: 'Intent to File (21-0966) submitted',
    category: 'filing',
    required: false,
    helpText: 'Protects your effective date - highly recommended before BDD claim'
  },
  {
    id: 'personal-statements',
    label: 'Personal statements written for each condition',
    category: 'evidence',
    required: false,
    helpText: 'Use the Nexus Builder to create compelling personal statements'
  },
  {
    id: 'buddy-statements',
    label: 'Buddy/lay statements collected',
    category: 'evidence',
    required: false,
    helpText: 'Fellow service members can corroborate your conditions'
  },
  {
    id: 'bdd-claim-filed',
    label: 'BDD claim (21-526EZ) submitted on VA.gov',
    category: 'filing',
    required: true,
    helpText: 'The actual BDD claim must be filed at VA.gov'
  },
  {
    id: 'cp-exams-attended',
    label: 'All C&P exams attended',
    category: 'exams',
    required: true,
    helpText: 'Missing a C&P exam can result in automatic denial'
  },
  {
    id: 'separation-physical',
    label: 'Separation physical completed (report ALL conditions)',
    category: 'transition',
    required: true,
    helpText: 'This is your last chance to document conditions in military records'
  }
];

// ─────────────────────────────────────────────────────────────
// COMMON BDD MISTAKES
// ─────────────────────────────────────────────────────────────
export const BDD_COMMON_MISTAKES = [
  {
    id: 'missing-window',
    title: 'Missing the 180-90 Day Window',
    description: 'Many service members don\'t know about BDD until it\'s too late. If you\'re past 90 days, you can still file a standard claim, but rating decisions come after separation.',
    impact: 'HIGH',
    fix: 'Set a calendar reminder at 180 days before ETS. File ITF immediately.'
  },
  {
    id: 'not-claiming-everything',
    title: 'Not Claiming All Conditions',
    description: 'Veterans often only claim their "big" injuries and miss secondary conditions, mental health, and seemingly minor issues worth significant ratings.',
    impact: 'HIGH',
    fix: 'Use Secondary Scout, MOS Hazard Matcher, and PACT Act Navigator to find everything.'
  },
  {
    id: 'sandbagging-at-cp',
    title: 'Downplaying Symptoms at C&P Exams',
    description: 'Active duty military culture teaches you to be tough. At a C&P exam, report your WORST days - this isn\'t a fitness report.',
    impact: 'HIGH',
    fix: 'Practice with the C&P Exam Simulator. Report worst-day symptoms.'
  },
  {
    id: 'missing-cp-exam',
    title: 'Missing a C&P Exam',
    description: 'If you miss a C&P exam without rescheduling, that condition will likely be denied. No exam = no rating.',
    impact: 'CRITICAL',
    fix: 'Never miss a C&P exam. Reschedule if absolutely necessary, but attend every one.'
  },
  {
    id: 'no-personal-statements',
    title: 'Filing Without Personal Statements',
    description: 'The 21-526EZ form doesn\'t tell the rater your story. Personal statements explain how your conditions affect your daily life.',
    impact: 'MEDIUM',
    fix: 'Use the Nexus Builder to write statements for each condition.'
  },
  {
    id: 'no-buddy-statements',
    title: 'No Buddy/Lay Statements',
    description: 'Fellow service members can corroborate your conditions, injuries, and how they\'ve worsened. This is powerful evidence.',
    impact: 'MEDIUM',
    fix: 'Use the Witness Bench to generate buddy statement templates.'
  },
  {
    id: 'skip-separation-physical',
    title: 'Not Reporting Conditions at Separation Physical',
    description: 'Your separation physical is the last military medical document. Any condition not listed here becomes harder to prove was service-connected.',
    impact: 'HIGH',
    fix: 'Report EVERYTHING at your separation physical, even minor complaints.'
  },
  {
    id: 'waiting-after-discharge',
    title: 'Waiting to File After Discharge',
    description: 'The longer you wait, the harder service connection becomes. A gap between service and filing creates a "continuity" problem.',
    impact: 'HIGH',
    fix: 'File BDD before discharge. If missed, file within 1 year of separation for presumptive conditions.'
  }
];

// ─────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────

const BDD_STORAGE_KEY = 'vetrate_bdd_data';

/**
 * Calculate BDD eligibility and status
 * @param {string} separationDate - ISO date string of separation
 * @returns {Object} - Eligibility info
 */
export function calculateBDDEligibility(separationDate) {
  if (!separationDate) return { eligible: false, reason: 'No separation date provided' };

  const sep = new Date(separationDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  sep.setHours(0, 0, 0, 0);

  const diffMs = sep.getTime() - today.getTime();
  const daysUntilSep = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysUntilSep < 0) {
    return {
      eligible: false,
      daysUntilSep,
      reason: 'Separation date has passed. File a standard claim immediately.',
      recommendation: 'standard-claim',
      phase: 'post-separation'
    };
  }

  if (daysUntilSep > BDD_RULES.windowStart) {
    return {
      eligible: false,
      daysUntilSep,
      daysUntilWindowOpens: daysUntilSep - BDD_RULES.windowStart,
      reason: `BDD window opens in ${daysUntilSep - BDD_RULES.windowStart} days. Start preparing now!`,
      recommendation: 'prepare',
      phase: 'pre-window'
    };
  }

  if (daysUntilSep >= BDD_RULES.windowEnd && daysUntilSep <= BDD_RULES.windowStart) {
    return {
      eligible: true,
      daysUntilSep,
      daysLeft: daysUntilSep - BDD_RULES.windowEnd,
      reason: `You are IN the BDD window! ${daysUntilSep - BDD_RULES.windowEnd} days left to file.`,
      recommendation: 'file-now',
      phase: 'bdd-window',
      urgency: daysUntilSep - BDD_RULES.windowEnd < 30 ? 'high' : 'normal'
    };
  }

  // < 90 days
  return {
    eligible: false,
    daysUntilSep,
    reason: 'BDD window has closed. File a standard claim (pre-discharge) immediately.',
    recommendation: 'standard-claim-urgent',
    phase: 'post-window'
  };
}

/**
 * Get relevant milestones based on days until separation
 */
export function getRelevantMilestones(daysUntilSep) {
  return BDD_MILESTONES.map(m => ({
    ...m,
    status: daysUntilSep <= m.daysBeforeSep ? 'due' : 'upcoming',
    isPast: daysUntilSep < m.daysBeforeSep - 15, // 15 day grace
    isCurrent: Math.abs(daysUntilSep - m.daysBeforeSep) <= 15,
    isUpcoming: daysUntilSep > m.daysBeforeSep
  }));
}

/**
 * Save BDD progress to local storage
 */
export function saveBDDProgress(data) {
  try {
    const existing = loadBDDProgress();
    const updated = { ...existing, ...data, lastUpdated: new Date().toISOString() };
    localStorage.setItem(BDD_STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}

/**
 * Load BDD progress from local storage
 */
export function loadBDDProgress() {
  try {
    const stored = localStorage.getItem(BDD_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {
      separationDate: '',
      branch: '',
      checkedItems: [],
      conditions: [],
      notes: '',
      lastUpdated: null
    };
  } catch {
    return {
      separationDate: '',
      branch: '',
      checkedItems: [],
      conditions: [],
      notes: '',
      lastUpdated: null
    };
  }
}

/**
 * Calculate completion percentage of BDD checklist
 */
export function getChecklistCompletion(checkedItems) {
  const total = BDD_CHECKLIST.length;
  const completed = checkedItems.length;
  return Math.round((completed / total) * 100);
}
