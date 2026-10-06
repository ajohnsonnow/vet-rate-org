/**
 * The Decision Decoder's rule-based reading of a decision letter: fixed
 * patterns over the text, no model. Used when no AI is loaded, when the only
 * AI is off-device (ADR-009), and when the loaded on-device model is
 * small-class (ADR-010 section 9).
 */

const DENIAL_PATTERNS = [
  {
    test: (text) =>
      /no nexus|does not establish a nexus|nexus between.*service|lacks.*nexus|absence of nexus/i.test(
        text,
      ),
    decision_type: "Full Denial",
    plain_english:
      "The VA denied your claim because there is no documented medical link (nexus) between your current condition and your military service.",
    va_reasoning:
      "VA policy requires a 'nexus' - a medical opinion that explicitly links your current diagnosis to a specific event, injury, or illness during service.",
    missing_elements: [
      "A Nexus Letter from a licensed physician stating your condition is 'at least as likely as not' related to service",
      "Medical records documenting in-service treatment or incident",
    ],
    action_plan: [
      "Obtain a Nexus Letter from a private physician familiar with VA claims",
      "Request an Independent Medical Opinion (IMO) from a doctor who reviews your service records",
      "File a Supplemental Claim with the nexus letter as new and relevant evidence",
      "Contact a Veterans Service Organization (VSO) for free claim assistance",
    ],
    deadline_warning:
      "You have 1 year from this decision date to file an appeal. Gather your nexus evidence immediately - do not wait.",
  },
  {
    test: (text) =>
      /not service.connected|no service connection|not connected to.*service|failed to establish service/i.test(
        text,
      ),
    decision_type: "Full Denial",
    plain_english:
      "The VA decided your condition is not related to your military service.",
    va_reasoning:
      "The VA requires proof of three things: (1) a current diagnosis, (2) an in-service event or stressor, and (3) a nexus linking them. One or more of these is missing.",
    missing_elements: [
      "Evidence of an in-service event, injury, or stressor that caused the condition",
      "A medical nexus linking service to the current diagnosis",
      "Buddy letters or lay statements from fellow service members witnessing the event",
    ],
    action_plan: [
      "Pull your service records (DD214, service treatment records) for documentation",
      "Get a buddy letter from fellow veterans who witnessed the incident",
      "Obtain a medical nexus letter from a private physician",
      "Consider filing a direct service connection, secondary service connection, or aggravation claim",
    ],
    deadline_warning:
      "You have 1 year from this decision to appeal. Contact a VSO immediately if you are unsure how to proceed.",
  },
  {
    test: (text) =>
      /insufficient evidence|lack of.*evidence|no probative evidence|evidence does not|evidence is not/i.test(
        text,
      ),
    decision_type: "Full Denial",
    plain_english:
      "The VA says there is not enough evidence in your claim file to approve your request.",
    va_reasoning:
      "VA adjudicators weigh the evidence of record. When the evidence for and against a claim is roughly equal, VA rules require denial.",
    missing_elements: [
      "Additional medical evidence supporting your claim",
      "Private medical opinions or independent medical examinations (IME)",
      "Buddy letters (lay statements) from people who observed your condition",
    ],
    action_plan: [
      "Gather all private medical records not already in your file and submit them",
      "Request a copy of your C-File to see exactly what VA has on record",
      "Submit a personal statement describing your symptoms and their impact on daily life",
      "Seek an IME from a private physician to counter the C&P exam findings",
    ],
    deadline_warning:
      "Appeal deadlines apply. File within 1 year of this decision to preserve your effective date.",
  },
  {
    test: (text, t) =>
      /granted|service.connected.{0,200}at.{0,200}%|assigned.{0,200}rating.{0,200}%|%.{0,200}(combined|combined rating)/i.test(
        text,
      ) && !/denied|not.*service.connected/i.test(t),
    decision_type: "Granted",
    plain_english:
      "Congratulations - the VA approved at least part of your claim!",
    va_reasoning:
      "The VA found sufficient evidence to establish service connection and assigned a disability rating.",
    missing_elements: [],
    action_plan: [
      "Review your rating decision carefully - ensure each condition is rated correctly",
      "If you believe the rating percentage is too low, file a Supplemental Claim or Higher-Level Review",
      "Consider secondary conditions that may be caused or aggravated by your service-connected condition",
      "File an Intent to File immediately if you plan to claim additional conditions",
    ],
    deadline_warning: null,
  },
  {
    test: (text) =>
      /deferred pending|claim deferred|examination.*scheduled/i.test(text),
    decision_type: "Deferred",
    plain_english:
      "The VA has not yet made a final decision on your claim - it is waiting for additional information or a C&P exam.",
    va_reasoning:
      "VA defers claims when it needs additional evidence, such as a Compensation & Pension (C&P) exam or more medical records.",
    missing_elements: [
      "C&P exam results (if an exam has been scheduled)",
      "Additional medical records requested by VA",
    ],
    action_plan: [
      "Attend any scheduled C&P exam - missing it can result in denial",
      "Prepare for your C&P exam using the C&P Simulator in Vet-Rate",
      "Submit any outstanding evidence as soon as possible",
      "Contact VA or your VSO to confirm the status of your deferred claim",
    ],
    deadline_warning:
      "If a C&P exam is scheduled, attend it. Missing a C&P exam without good cause may result in a denial.",
  },
];

// Counts per-issue outcome verbs ("is granted", "is increased", "is
// continued", "is denied") so a letter with both grants and denials isn't
// misclassified as a "Full Denial" just because one denial phrase appears
// somewhere in the text.
function countDecisionOutcomes(text) {
  const granted = (text.match(/\bis (?:granted|increased|continued)\b/gi) || [])
    .length;
  const denied = (text.match(/\bis denied\b/gi) || []).length;
  return { granted, denied };
}

function buildMixedDecisionResult(granted, denied) {
  return {
    decision_type: "Mixed Decision",
    plain_english: `This decision is a mix of outcomes: ${granted} issue(s) granted or increased, and ${denied} issue(s) denied. Read each numbered item in your letter carefully - you don't need to appeal the parts that were already granted.`,
    va_reasoning:
      "The VA evaluated each claimed condition separately. Some had enough evidence to grant or increase; others did not.",
    missing_elements: [
      "Review the letter to identify exactly which issue(s) were denied - do not assume the whole claim was denied",
    ],
    action_plan: [
      "Confirm your new combined rating and effective date for the granted/increased issues",
      "For the denied issue(s) only, gather the specific evidence VA says is missing",
      "File a Supplemental Claim or Higher-Level Review for just the denied issue(s) if you disagree",
      "Contact a VSO to confirm you understand which parts of the decision are final vs. appealable",
    ],
    deadline_warning:
      "You have 1 year from this decision date to appeal the denied issue(s) while preserving your effective date.",
  };
}

export function patternMatchDenial(text) {
  const t = text.toLowerCase();

  const { granted, denied } = countDecisionOutcomes(text);
  if (granted > 0 && denied > 0) {
    return buildMixedDecisionResult(granted, denied);
  }

  for (const pattern of DENIAL_PATTERNS) {
    if (pattern.test(text, t)) {
      return pattern;
    }
  }

  // Generic fallback when no specific pattern matches
  const isDenied = /denied|denial|not.*granted|not.*service.connected/i.test(
    text,
  );
  if (isDenied) {
    return {
      decision_type: "Full Denial",
      plain_english:
        "The VA denied your claim. Load the Warrant Council AI for a detailed analysis of the specific reasons.",
      va_reasoning:
        "Pattern matching identified a denial but could not determine the specific reason. AI analysis will provide more detail.",
      missing_elements: [
        "Specific denial reason not detected - load AI for full analysis",
      ],
      action_plan: [
        "Load the Warrant Council AI (button above) for a full plain-English translation",
        "Contact a VSO for free claim assistance",
        "Request a copy of your C-File to understand what evidence VA used",
        "You have 1 year from this decision to file an appeal",
      ],
      deadline_warning:
        "You have 1 year from this decision date to file an appeal. Do not let the deadline pass.",
    };
  }

  return null;
}

export const SMALL_MODEL_FALLBACK_NOTE =
  "This device's AI model is too small to read a decision letter reliably, so it was not used. Below is what the app can match by pattern in the text you gave, and the review options as the regulations state them.";

const NOTHING_MATCHED_MESSAGE =
  "The built-in reader found no decision language in this text, so there is nothing to translate yet. If this is a VA decision letter, paste the Decision and Reasons for Decision sections.";

/** What the Decision Decoder shows in place of a small-class model's reading. */
export function smallModelReading(denialText) {
  const matched = patternMatchDenial(denialText);
  return {
    ...(matched || { plain_english: NOTHING_MATCHED_MESSAGE }),
    _usedFallback: true,
    _fallbackReason: "small_model",
    _fallbackNote: SMALL_MODEL_FALLBACK_NOTE,
  };
}
