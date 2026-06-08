/**
 * Vet-Rate.org - Claim Navigator Engine
 * "The Brain" - State-aware logic controller for VA claims navigation
 *
 * This engine analyzes a veteran's current claim state and generates
 * specific, actionable next steps. Handles the non-linear nature of
 * VA claims including appeals, denials, and multi-claim scenarios.
 *
 * Built by a fellow veteran. "Never miss another deadline."
 *
 * Key Function: determineNextStep(claim)
 * - Analyzes claim state
 * - Returns prioritized action items
 * - Handles deadline warnings (critical for 1-year appeal window)
 */

import {
  CLAIM_PHASES,
  DECISION_OUTCOMES,
  DENIAL_REASONS,
  URGENCY_LEVELS,
  daysUntilDeadline,
  calculateEvidenceCompleteness,
} from "../data/claimNavigatorSchema";

// ============================================
// NEXT STEP ACTION TYPES
// ============================================
export const ACTION_TYPES = {
  FILE_ITF: "FILE_ITF",
  GATHER_EVIDENCE: "GATHER_EVIDENCE",
  GET_DIAGNOSIS: "GET_DIAGNOSIS",
  GET_NEXUS: "GET_NEXUS",
  GET_SERVICE_EVENT: "GET_SERVICE_EVENT",
  GET_DBQ: "GET_DBQ",
  WRITE_STATEMENT: "WRITE_STATEMENT",
  GET_BUDDY_LETTERS: "GET_BUDDY_LETTERS",
  SUBMIT_CLAIM: "SUBMIT_CLAIM",
  ATTEND_EXAM: "ATTEND_EXAM",
  CHECK_STATUS: "CHECK_STATUS",
  REVIEW_DECISION: "REVIEW_DECISION",
  FILE_APPEAL: "FILE_APPEAL",
  PRESERVE_RIGHTS: "PRESERVE_RIGHTS", // Critical deadline action
  WAIT: "WAIT",
  CELEBRATE: "CELEBRATE",
};

/**
 * NextAction - Represents a single recommended action
 * @typedef {Object} NextAction
 * @property {string} type - ACTION_TYPES code
 * @property {string} title - Short action title
 * @property {string} description - Detailed instruction
 * @property {string} urgency - URGENCY_LEVELS code
 * @property {string} form - VA Form number (if applicable)
 * @property {string} link - URL for more info
 * @property {number} deadline - Days until deadline (if applicable)
 * @property {boolean} blocksProgress - If true, must complete before proceeding
 */

// ============================================
// MAIN FUNCTION: determineNextStep
// ============================================

/**
 * Determines the next actions for a veteran based on their claim state
 *
 * @param {Object} claim - The claim object from claimNavigatorSchema
 * @returns {Object} Analysis result with prioritized actions
 */
export const determineNextStep = (claim) => {
  if (!claim) {
    return {
      actions: [
        {
          type: ACTION_TYPES.FILE_ITF,
          title: "Start Your Claim",
          description:
            "Before doing anything else, file an Intent to File to protect your backpay date.",
          urgency: URGENCY_LEVELS.HIGH.code,
          blocksProgress: true,
        },
      ],
      warnings: [],
      overallStatus: "Not Started",
      completeness: 0,
    };
  }

  const result = {
    actions: [],
    warnings: [],
    overallStatus: "",
    completeness: calculateEvidenceCompleteness(claim.evidenceChecklist || {}),
    phase: claim.currentPhase,
    claimType: claim.claimType,
  };

  // CRITICAL: Check for approaching deadlines FIRST
  const deadlineWarnings = checkDeadlines(claim);
  result.warnings = deadlineWarnings;

  // Add deadline actions to the front (highest priority)
  const criticalDeadlineActions = generateDeadlineActions(
    claim,
    deadlineWarnings,
  );
  result.actions = [...criticalDeadlineActions];

  // Now determine phase-specific actions
  const phaseActions = determinePhaseActions(claim);
  result.actions = [...result.actions, ...phaseActions];

  // Set overall status
  result.overallStatus = getOverallStatus(claim, result);

  return result;
};

// ============================================
// DEADLINE CHECKING (CRITICAL)
// ============================================

/**
 * Check all critical deadlines and generate warnings
 */
const checkDeadlines = (claim) => {
  const warnings = [];
  // eslint-disable-next-line no-unused-vars
  const { criticalDates, currentPhase, decisionInfo } = claim;

  // 1. Intent to File Expiration (1 year to submit claim)
  if (criticalDates?.itfExpirationDate) {
    const daysLeft = daysUntilDeadline(criticalDates.itfExpirationDate);

    if (daysLeft !== null && daysLeft <= 0) {
      warnings.push({
        type: "ITF_EXPIRED",
        urgency: URGENCY_LEVELS.CRITICAL.code,
        title: "Intent to File EXPIRED",
        message: `Your Intent to File expired ${Math.abs(daysLeft)} days ago. You may lose backpay. File a new ITF immediately and submit your claim ASAP.`,
        daysRemaining: daysLeft,
      });
    } else if (daysLeft !== null && daysLeft <= 30) {
      warnings.push({
        type: "ITF_EXPIRING",
        urgency: URGENCY_LEVELS.CRITICAL.code,
        title: "Intent to File Expiring SOON",
        message: `Your Intent to File expires in ${daysLeft} days! Submit your claim before ${new Date(criticalDates.itfExpirationDate).toLocaleDateString()} to protect your backpay date.`,
        daysRemaining: daysLeft,
      });
    } else if (daysLeft !== null && daysLeft <= 60) {
      warnings.push({
        type: "ITF_EXPIRING_SOON",
        urgency: URGENCY_LEVELS.HIGH.code,
        title: "Intent to File Expiring",
        message: `Your Intent to File expires in ${daysLeft} days. Start gathering your evidence and preparing to submit.`,
        daysRemaining: daysLeft,
      });
    }
  }

  // 2. CRITICAL: Appeal Deadline (1 year from decision)
  if (criticalDates?.appealDeadline && decisionInfo?.outcome === "DENIED") {
    const daysLeft = daysUntilDeadline(criticalDates.appealDeadline);

    if (daysLeft !== null && daysLeft <= 0) {
      warnings.push({
        type: "APPEAL_EXPIRED",
        urgency: URGENCY_LEVELS.CRITICAL.code,
        title: "⚠️ APPEAL DEADLINE PASSED",
        message: `Your appeal window closed ${Math.abs(daysLeft)} days ago. You may need to reopen with new evidence. Consult a VSO immediately.`,
        daysRemaining: daysLeft,
      });
    } else if (daysLeft !== null && daysLeft <= 30) {
      warnings.push({
        type: "APPEAL_CRITICAL",
        urgency: URGENCY_LEVELS.CRITICAL.code,
        title: "🚨 APPEAL DEADLINE IN " + daysLeft + " DAYS",
        message: `URGENT: You have only ${daysLeft} days to appeal! If you can't decide, file VA Form 20-0996 (HLR) to preserve your rights. You can still gather evidence.`,
        daysRemaining: daysLeft,
        preservationForm: "20-0996",
      });
    } else if (daysLeft !== null && daysLeft <= 60) {
      warnings.push({
        type: "APPEAL_APPROACHING",
        urgency: URGENCY_LEVELS.HIGH.code,
        title: "Appeal Deadline Approaching",
        message: `You have ${daysLeft} days to file an appeal. Start gathering new evidence or preparing your HLR argument.`,
        daysRemaining: daysLeft,
      });
    } else if (daysLeft !== null && daysLeft <= 330) {
      warnings.push({
        type: "APPEAL_REMINDER",
        urgency: URGENCY_LEVELS.MEDIUM.code,
        title: "Appeal Window Open",
        message: `You have ${daysLeft} days remaining to appeal your denial. Don't wait too long to decide your next move.`,
        daysRemaining: daysLeft,
      });
    }
  }

  // 3. C&P Exam Date
  if (criticalDates?.cpExamDate) {
    const daysUntil = daysUntilDeadline(criticalDates.cpExamDate);

    if (daysUntil !== null && daysUntil > 0 && daysUntil <= 7) {
      warnings.push({
        type: "CP_EXAM_SOON",
        urgency: URGENCY_LEVELS.HIGH.code,
        title: "C&P Exam in " + daysUntil + " Days",
        message: `Your C&P exam is on ${new Date(criticalDates.cpExamDate).toLocaleDateString()}. Prepare: review your symptoms, bring documentation, and do NOT downplay anything.`,
        daysRemaining: daysUntil,
      });
    }
  }

  return warnings;
};

/**
 * Generate critical deadline-based actions
 */
const generateDeadlineActions = (claim, warnings) => {
  const actions = [];

  warnings.forEach((warning) => {
    if (warning.type === "APPEAL_CRITICAL" && warning.daysRemaining <= 30) {
      actions.push({
        type: ACTION_TYPES.PRESERVE_RIGHTS,
        title: "🚨 PRESERVE YOUR APPEAL RIGHTS NOW",
        description: `You have ${warning.daysRemaining} days left to appeal. Even if you're not ready, file VA Form 20-0996 (Higher-Level Review) to preserve your rights. This stops the clock while you decide.`,
        urgency: URGENCY_LEVELS.CRITICAL.code,
        form: "20-0996",
        link: "https://www.va.gov/decision-reviews/higher-level-review/",
        deadline: warning.daysRemaining,
        blocksProgress: true,
      });
    }

    if (warning.type === "ITF_EXPIRING" && warning.daysRemaining <= 30) {
      actions.push({
        type: ACTION_TYPES.SUBMIT_CLAIM,
        title: "⚠️ SUBMIT CLAIM BEFORE ITF EXPIRES",
        description: `Your Intent to File expires in ${warning.daysRemaining} days. Submit VA Form 21-526EZ now to lock in your effective date, even if your evidence isn't perfect.`,
        urgency: URGENCY_LEVELS.CRITICAL.code,
        form: "21-526EZ",
        link: "https://www.va.gov/disability/file-disability-claim-form-21-526ez/",
        deadline: warning.daysRemaining,
        blocksProgress: true,
      });
    }
  });

  return actions;
};

// ============================================
// PHASE-SPECIFIC ACTION DETERMINATION
// ============================================

/**
 * Determine actions based on current claim phase
 */
const determinePhaseActions = (claim) => {
  // eslint-disable-next-line no-unused-vars
  const { currentPhase, evidenceChecklist, claimType, decisionInfo } = claim;
  const actions = [];

  switch (currentPhase) {
    case CLAIM_PHASES.TRIAGE.code:
      actions.push({
        type: ACTION_TYPES.FILE_ITF,
        title: "Complete Triage Assessment",
        description:
          "Answer the intake questions to determine the correct claim lane (Original, Increase, Secondary, or Appeal).",
        urgency: URGENCY_LEVELS.HIGH.code,
        blocksProgress: true,
      });
      break;

    case CLAIM_PHASES.INTENT_TO_FILE.code:
      if (!claim.criticalDates?.itfDate) {
        actions.push({
          type: ACTION_TYPES.FILE_ITF,
          title: "File Intent to File (VA Form 21-0966)",
          description:
            "STOP. Before gathering evidence, file an Intent to File. This protects your backpay date. You have 1 year after this to submit your full claim.",
          urgency: URGENCY_LEVELS.CRITICAL.code,
          form: "21-0966",
          link: "https://www.va.gov/resources/your-intent-to-file-a-va-claim/",
          blocksProgress: true,
        });
      } else {
        actions.push({
          type: ACTION_TYPES.GATHER_EVIDENCE,
          title: "Begin Gathering Evidence",
          description:
            'Your backpay clock is now running. Start collecting the "Big 3": Current Diagnosis, Nexus Letter, and In-Service Event documentation.',
          urgency: URGENCY_LEVELS.HIGH.code,
        });
      }
      break;

    // eslint-disable-next-line no-case-declarations
    case CLAIM_PHASES.GATHERING_EVIDENCE.code:
      // Check each piece of the "Big 3"
      // eslint-disable-next-line no-case-declarations
      const evidenceActions = determineEvidenceActions(
        evidenceChecklist,
        claimType,
      );
      actions.push(...evidenceActions);
      break;

    case CLAIM_PHASES.CLAIM_SUBMITTED.code:
    case CLAIM_PHASES.INITIAL_REVIEW.code:
    case CLAIM_PHASES.EVIDENCE_GATHERING.code:
      actions.push({
        type: ACTION_TYPES.CHECK_STATUS,
        title: "Monitor Your Claim Status",
        description:
          "Check VA.gov weekly for status updates. Respond immediately to any requests for additional evidence (you typically have 30 days).",
        urgency: URGENCY_LEVELS.MEDIUM.code,
        link: "https://www.va.gov/claim-or-appeal-status/",
      });
      break;

    case CLAIM_PHASES.CP_EXAM_SCHEDULED.code:
      actions.push({
        type: ACTION_TYPES.ATTEND_EXAM,
        title: "Prepare for C&P Exam",
        description:
          "Your C&P exam is crucial. DO NOT downplay symptoms. Describe your WORST days. Bring documentation. Arrive early.",
        urgency: URGENCY_LEVELS.CRITICAL.code,
        blocksProgress: true,
      });
      break;

    case CLAIM_PHASES.PREPARATION_FOR_DECISION.code:
      actions.push({
        type: ACTION_TYPES.WAIT,
        title: "Wait for Decision",
        description:
          'Your claim is in "Preparation for Decision" - a rater is reviewing your file. This is the "black box" phase. Decision typically comes within 2-4 weeks.',
        urgency: URGENCY_LEVELS.LOW.code,
      });
      break;
    // eslint-disable-next-line no-case-declarations

    case CLAIM_PHASES.DECISION.code:
      // eslint-disable-next-line no-case-declarations
      const decisionActions = determineDecisionActions(claim);
      actions.push(...decisionActions);
      break;
    // eslint-disable-next-line no-case-declarations

    case CLAIM_PHASES.APPEAL.code:
      // eslint-disable-next-line no-case-declarations
      const appealActions = determineAppealActions(claim);
      actions.push(...appealActions);
      break;

    default:
      actions.push({
        type: ACTION_TYPES.FILE_ITF,
        title: "Start Your Claim Journey",
        description:
          "Let's figure out your next step. Complete the triage questions to get personalized guidance.",
        urgency: URGENCY_LEVELS.HIGH.code,
      });
  }

  return actions;
};

// ============================================
// EVIDENCE-SPECIFIC ACTIONS
// ============================================

/**
 * Determine which evidence the veteran is missing and generate actions
 */
const determineEvidenceActions = (evidenceChecklist, claimType) => {
  const actions = [];
  const checklist = evidenceChecklist || {};

  // CRITICAL: Check "Big 3" first
  if (!checklist.diagnosis) {
    actions.push({
      type: ACTION_TYPES.GET_DIAGNOSIS,
      title: "🔴 GET A CURRENT DIAGNOSIS",
      description:
        "STOP. You cannot win a claim without a current medical diagnosis. See a doctor (VA or private) and get your condition formally diagnosed.",
      urgency: URGENCY_LEVELS.CRITICAL.code,
      blocksProgress: true,
      tip: "Without a diagnosis, your claim WILL be denied. This is not optional.",
    });
  }

  if (!checklist.nexus) {
    const nexusDescription =
      claimType === "SECONDARY"
        ? 'Get a medical opinion stating your condition is "at least as likely as not" caused or aggravated by your service-connected disability.'
        : 'Get a medical opinion stating your condition is "at least as likely as not" related to your military service.';

    actions.push({
      type: ACTION_TYPES.GET_NEXUS,
      title: "🔴 OBTAIN A NEXUS LETTER",
      description: `CRITICAL: ${nexusDescription} This is the "missing link" in most denied claims.`,
      urgency: URGENCY_LEVELS.CRITICAL.code,
      blocksProgress: !checklist.diagnosis, // Diagnosis comes first
      tip: "A nexus letter from a private doctor often carries more weight than hoping the VA examiner will provide one.",
    });
  }

  if (!checklist.inServiceEvent && claimType !== "SECONDARY") {
    actions.push({
      type: ACTION_TYPES.GET_SERVICE_EVENT,
      title: "🔴 DOCUMENT YOUR IN-SERVICE EVENT",
      description:
        "Prove something happened during service. Request your Service Treatment Records, get buddy letters from fellow service members, or document your deployment/MOS hazards.",
      urgency: URGENCY_LEVELS.CRITICAL.code,
      blocksProgress: !checklist.diagnosis,
      tip: "No STR entry? Buddy letters and MOS exposure data can substitute.",
    });
  }

  // If Big 3 complete, suggest supporting evidence
  if (
    checklist.diagnosis &&
    checklist.nexus &&
    (checklist.inServiceEvent || claimType === "SECONDARY")
  ) {
    if (!checklist.dbq) {
      actions.push({
        type: ACTION_TYPES.GET_DBQ,
        title: "Consider Getting a DBQ",
        description:
          "A Disability Benefits Questionnaire (DBQ) filled by your doctor documents your severity using VA criteria. This can support a higher rating.",
        urgency: URGENCY_LEVELS.MEDIUM.code,
        tip: "DBQs are especially helpful for conditions with specific measurement criteria (range of motion, frequency of symptoms, etc.).",
      });
    }

    if (!checklist.personalStatement) {
      actions.push({
        type: ACTION_TYPES.WRITE_STATEMENT,
        title: "Write Your Personal Statement",
        description:
          "Document how your condition affects your daily life. Be specific about symptoms, frequency, and impact. Use VA Form 21-4138.",
        urgency: URGENCY_LEVELS.MEDIUM.code,
        form: "21-4138",
        tip: "The VA must consider your lay testimony. Don't undersell your symptoms.",
      });
    }

    if (!checklist.buddyLetters) {
      actions.push({
        type: ACTION_TYPES.GET_BUDDY_LETTERS,
        title: "Get Buddy/Lay Statements",
        description:
          "Ask family members, coworkers, or fellow veterans to describe how they've observed your condition. Use VA Form 21-10210.",
        urgency: URGENCY_LEVELS.LOW.code,
        form: "21-10210",
        tip: "Third-party observations strengthen your credibility, especially for symptoms others can see.",
      });
    }

    // Ready to submit!
    if (checklist.diagnosis && checklist.nexus) {
      actions.unshift({
        type: ACTION_TYPES.SUBMIT_CLAIM,
        title: "✅ READY TO SUBMIT",
        description:
          "You have the critical evidence. Consider submitting as a Fully Developed Claim (FDC) for faster processing. Use VA Form 21-526EZ.",
        urgency: URGENCY_LEVELS.HIGH.code,
        form: "21-526EZ",
        link: "https://www.va.gov/disability/file-disability-claim-form-21-526ez/",
      });
    }
  }

  return actions;
};

// ============================================
// DECISION-SPECIFIC ACTIONS
// ============================================

/**
 * Determine actions after VA decision received
 */
const determineDecisionActions = (claim) => {
  const { decisionInfo } = claim;
  const actions = [];

  if (!decisionInfo?.outcome) {
    actions.push({
      type: ACTION_TYPES.REVIEW_DECISION,
      title: "Review Your Decision Letter",
      description:
        "Carefully read your decision letter. Note: 1) The rating percentage, 2) The effective date, 3) The reason for any denial.",
      urgency: URGENCY_LEVELS.HIGH.code,
    });
    return actions;
  }

  switch (decisionInfo.outcome) {
    case DECISION_OUTCOMES.GRANTED.code:
      actions.push({
        type: ACTION_TYPES.CELEBRATE,
        title: "🎉 Claim Granted!",
        description: `Congratulations! You were rated at ${decisionInfo.ratingPercentage || "?"}%. Verify: 1) The rating matches your symptoms, 2) The effective date matches your ITF.`,
        urgency: URGENCY_LEVELS.LOW.code,
      });
      // Check if rating seems low
      actions.push({
        type: ACTION_TYPES.REVIEW_DECISION,
        title: "Verify Your Rating",
        description:
          "Compare your rating to 38 CFR criteria. If your symptoms warrant a higher rating, consider filing for an increase.",
        urgency: URGENCY_LEVELS.MEDIUM.code,
      });
      break;

    case DECISION_OUTCOMES.GRANTED_LOW.code:
      actions.push({
        type: ACTION_TYPES.FILE_APPEAL,
        title: "Rating May Be Too Low",
        description: `You were rated at ${decisionInfo.ratingPercentage}%, but your symptoms may warrant higher. Options: 1) File for Increase with more evidence, 2) Request HLR if criteria was misapplied.`,
        urgency: URGENCY_LEVELS.HIGH.code,
      });
      break;
    // eslint-disable-next-line no-case-declarations

    case DECISION_OUTCOMES.DENIED.code:
      // eslint-disable-next-line no-case-declarations
      const denialActions = determineDenialActions(decisionInfo);
      actions.push(...denialActions);
      break;

    case DECISION_OUTCOMES.DEFERRED.code:
      actions.push({
        type: ACTION_TYPES.CHECK_STATUS,
        title: "Decision Deferred",
        description:
          "The VA needs more information. Check for development letters and respond promptly. Ignoring this could result in denial.",
        urgency: URGENCY_LEVELS.HIGH.code,
      });
      break;
  }

  return actions;
};

/**
 * Determine actions for denied claims based on denial reason
 */
const determineDenialActions = (decisionInfo) => {
  const actions = [];
  const denialReason = decisionInfo.denialReason;

  actions.push({
    type: ACTION_TYPES.REVIEW_DECISION,
    title: "Analyze Your Denial",
    description:
      "Don't panic. Most denials can be appealed successfully with the right evidence. Read your letter to understand WHY you were denied.",
    urgency: URGENCY_LEVELS.HIGH.code,
  });

  // Specific guidance based on denial reason
  switch (denialReason) {
    case DENIAL_REASONS.NO_DIAGNOSIS.code:
      actions.push({
        type: ACTION_TYPES.FILE_APPEAL,
        title: "Appeal Path: Get a Diagnosis",
        description:
          "You were denied because VA found no current diagnosis. Fix: Get diagnosed by a doctor, then file a SUPPLEMENTAL CLAIM (VA Form 20-0995) with the new diagnosis.",
        urgency: URGENCY_LEVELS.HIGH.code,
        form: "20-0995",
        recommendedLane: "SUPPLEMENTAL",
      });
      break;

    case DENIAL_REASONS.NO_NEXUS.code:
      actions.push({
        type: ACTION_TYPES.FILE_APPEAL,
        title: "Appeal Path: Get a Nexus Letter",
        description:
          "You were denied because there's no link to service. Fix: Get an Independent Medical Opinion (IMO) / Nexus Letter from a private doctor, then file a SUPPLEMENTAL CLAIM.",
        urgency: URGENCY_LEVELS.HIGH.code,
        form: "20-0995",
        recommendedLane: "SUPPLEMENTAL",
      });
      break;

    case DENIAL_REASONS.NO_EVENT.code:
      actions.push({
        type: ACTION_TYPES.FILE_APPEAL,
        title: "Appeal Path: Document In-Service Event",
        description:
          "You were denied because VA found no in-service event. Fix: Get buddy letters, unit records, or MOS hazard documentation, then file a SUPPLEMENTAL CLAIM.",
        urgency: URGENCY_LEVELS.HIGH.code,
        form: "20-0995",
        recommendedLane: "SUPPLEMENTAL",
      });
      break;

    case DENIAL_REASONS.RATER_ERROR.code:
    case DENIAL_REASONS.LEGAL_ERROR.code:
      actions.push({
        type: ACTION_TYPES.FILE_APPEAL,
        title: "Appeal Path: Higher-Level Review",
        description:
          "The VA made an error. The evidence was there but wasn't considered. File a HIGHER-LEVEL REVIEW (VA Form 20-0996). A senior rater will review your case.",
        urgency: URGENCY_LEVELS.HIGH.code,
        form: "20-0996",
        recommendedLane: "HLR",
      });
      break;

    default:
      actions.push({
        type: ACTION_TYPES.FILE_APPEAL,
        title: "Choose Your Appeal Lane",
        description:
          "You have 3 options: 1) Supplemental Claim - if you have NEW evidence, 2) Higher-Level Review - if VA made an error, 3) Board Appeal - if you want a judge to decide.",
        urgency: URGENCY_LEVELS.HIGH.code,
      });
  }

  return actions;
};

// ============================================
// APPEAL-SPECIFIC ACTIONS
// ============================================

/**
 * Determine actions for claims in appeal phase
 */
const determineAppealActions = (claim) => {
  // eslint-disable-next-line no-unused-vars
  const { appealInfo, criticalDates } = claim;
  const actions = [];

  if (!appealInfo?.appealLane) {
    actions.push({
      type: ACTION_TYPES.FILE_APPEAL,
      title: "Choose Your Appeal Lane",
      description:
        "Decide: 1) SUPPLEMENTAL (new evidence) - VA Form 20-0995, 2) HLR (VA error) - VA Form 20-0996, 3) BOARD (judge review) - VA Form 10182.",
      urgency: URGENCY_LEVELS.HIGH.code,
    });
  } else {
    switch (appealInfo.appealLane) {
      case "SUPPLEMENTAL":
        actions.push({
          type: ACTION_TYPES.GATHER_EVIDENCE,
          title: "Gather NEW Evidence for Supplemental",
          description:
            "You chose Supplemental Claim. You MUST have new and relevant evidence. Get that nexus letter, updated diagnosis, or buddy statement.",
          urgency: URGENCY_LEVELS.HIGH.code,
          form: "20-0995",
        });
        break;

      case "HLR":
        actions.push({
          type: ACTION_TYPES.CHECK_STATUS,
          title: "Higher-Level Review Submitted",
          description:
            "A senior rater will review your case. You may request an informal conference to explain why the original decision was wrong. Wait time: typically 4-5 months.",
          urgency: URGENCY_LEVELS.MEDIUM.code,
        });
        break;

      case "BOARD_APPEAL":
        actions.push({
          type: ACTION_TYPES.WAIT,
          title: "Board Appeal In Progress",
          description:
            "Your case is with the Board of Veterans' Appeals. A Veterans Law Judge will review it. Wait time: often 1-2+ years. You can check status on VA.gov.",
          urgency: URGENCY_LEVELS.LOW.code,
        });
        break;
    }
  }

  return actions;
};

// ============================================
// STATUS HELPERS
// ============================================

/**
 * Generate overall status message
 */
const getOverallStatus = (claim, result) => {
  // eslint-disable-next-line no-unused-vars
  const { currentPhase, decisionInfo, claimType } = claim;
  const { completeness, warnings } = result;

  // Check for critical warnings first
  const criticalWarning = warnings.find(
    (w) => w.urgency === URGENCY_LEVELS.CRITICAL.code,
  );
  if (criticalWarning) {
    return `⚠️ ACTION REQUIRED: ${criticalWarning.title}`;
  }

  // Phase-based status
  switch (currentPhase) {
    case CLAIM_PHASES.TRIAGE.code:
      return "Getting Started - Answer intake questions";

    case CLAIM_PHASES.INTENT_TO_FILE.code:
      return claim.criticalDates?.itfDate
        ? "✅ ITF Filed - Backpay clock started"
        : "⏳ Need to file Intent to File";

    case CLAIM_PHASES.GATHERING_EVIDENCE.code:
      if (completeness >= 90) {
        return "✅ Evidence Ready - Consider submitting";
      } else if (completeness >= 60) {
        return `📋 Evidence ${completeness}% Complete - Getting close`;
      } else {
        return `📋 Evidence ${completeness}% Complete - Key items missing`;
      }

    case CLAIM_PHASES.CLAIM_SUBMITTED.code:
    case CLAIM_PHASES.INITIAL_REVIEW.code:
      return "📬 Claim Submitted - VA is processing";

    case CLAIM_PHASES.EVIDENCE_GATHERING.code:
      return "🔍 VA Reviewing Evidence";

    case CLAIM_PHASES.CP_EXAM_SCHEDULED.code:
      return "🏥 C&P Exam Phase - Crucial step";

    case CLAIM_PHASES.PREPARATION_FOR_DECISION.code:
      return "⏳ Preparation for Decision - Almost there";

    case CLAIM_PHASES.DECISION.code:
      if (decisionInfo?.outcome === "GRANTED") {
        return `🎉 Granted at ${decisionInfo.ratingPercentage || "?"}%`;
      } else if (decisionInfo?.outcome === "DENIED") {
        return "❌ Denied - Review appeal options";
      }
      return "📋 Decision Received - Review needed";

    case CLAIM_PHASES.APPEAL.code:
      return "⚖️ Appeal In Progress";

    default:
      return "Ready to begin";
  }
};

// ============================================
// MULTI-CLAIM ANALYSIS
// ============================================

/**
 * Analyze multiple claims and provide prioritized dashboard view
 * @param {Array} claims - Array of claim objects
 * @returns {Object} Dashboard summary with prioritized items
 */
export const analyzeMultipleClaims = (claims) => {
  if (!claims || claims.length === 0) {
    return {
      totalClaims: 0,
      criticalActions: [],
      activeClaimsSummary: [],
      overallRecommendation: "Start by adding your first claim.",
    };
  }

  const analyses = claims.map((claim) => ({
    claim,
    analysis: determineNextStep(claim),
  }));

  // Collect all critical actions
  const criticalActions = [];
  analyses.forEach(({ claim, analysis }) => {
    analysis.actions
      .filter((a) => a.urgency === URGENCY_LEVELS.CRITICAL.code)
      .forEach((action) => {
        criticalActions.push({
          ...action,
          claimId: claim.id,
          conditionName: claim.conditionName,
        });
      });
  });

  // Sort by deadline (most urgent first)
  criticalActions.sort((a, b) => (a.deadline || 999) - (b.deadline || 999));

  // Generate summary for each claim
  const activeClaimsSummary = analyses.map(({ claim, analysis }) => ({
    id: claim.id,
    conditionName: claim.conditionName,
    claimType: claim.claimType,
    phase: claim.currentPhase,
    status: analysis.overallStatus,
    completeness: analysis.completeness,
    hasWarnings: analysis.warnings.length > 0,
    topAction: analysis.actions[0],
  }));

  // Sort: Critical warnings first, then by phase progression
  activeClaimsSummary.sort((a, b) => {
    if (a.hasWarnings && !b.hasWarnings) return -1;
    if (!a.hasWarnings && b.hasWarnings) return 1;
    return a.completeness - b.completeness; // Least complete first (needs attention)
  });

  return {
    totalClaims: claims.length,
    criticalActions,
    activeClaimsSummary,
    overallRecommendation: generateOverallRecommendation(analyses),
  };
};

/**
 * Generate overall recommendation for multi-claim dashboard
 */
const generateOverallRecommendation = (analyses) => {
  // Check for critical deadline
  const hasDeadline = analyses.some(({ analysis }) =>
    analysis.warnings.some(
      (w) => w.type === "APPEAL_CRITICAL" || w.type === "ITF_EXPIRING",
    ),
  );

  if (hasDeadline) {
    return "🚨 URGENT: You have a critical deadline approaching. Address this immediately.";
  }

  // Check for denied claims
  const deniedClaims = analyses.filter(
    ({ claim }) => claim.decisionInfo?.outcome === "DENIED",
  );

  if (deniedClaims.length > 0) {
    return `You have ${deniedClaims.length} denied claim(s) that need attention. Review your appeal options.`;
  }

  // Check for incomplete evidence
  const incompleteEvidence = analyses.filter(
    ({ analysis }) =>
      analysis.completeness < 90 &&
      analysis.phase === CLAIM_PHASES.GATHERING_EVIDENCE.code,
  );

  if (incompleteEvidence.length > 0) {
    return `Focus on gathering evidence for ${incompleteEvidence.length} claim(s). The "Big 3" are critical.`;
  }

  // Default
  return "Your claims are on track. Keep monitoring your status on VA.gov.";
};

// ============================================
// EXPORTS
// ============================================

export default {
  determineNextStep,
  analyzeMultipleClaims,
  ACTION_TYPES,
};
