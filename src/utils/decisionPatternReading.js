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
      "If you believe a rating percentage is too low, you can ask for a review of that issue. The three review options are set out below",
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

/*
 * Which kinds of outcome the letter's own verbs show. Only whether a kind
 * appears, never how many issues: a letter says "is granted" in its Decision
 * section and again in its reasons for the same issue, so counting phrases
 * overstates, and a wrong count on a decision letter is worse than none.
 */
const OUTCOME_KINDS = [
  {
    kind: "granted",
    pattern: /\bis (?:granted|increased)\b/i,
    says: "grants or increases at least one issue",
  },
  {
    kind: "continued",
    pattern: /\bis continued\b/i,
    says: "continues at least one rating at its current level",
  },
  {
    kind: "denied",
    pattern: /\bis denied\b/i,
    says: "denies at least one issue",
  },
  {
    kind: "deferred",
    pattern: /\b(?:is|are) deferred\b/i,
    says: "defers at least one issue",
  },
];

const outcomesShown = (text) =>
  OUTCOME_KINDS.filter(({ pattern }) => pattern.test(text));

const joinWithAnd = (items) =>
  items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

// The screen shows all three review options, with their forms, under every
// reading. The plan points there, so it never lists only some of them.
const REVIEW_STEP =
  "If you disagree with an issue that was denied or continued, you can ask for a review of just that issue. The three review options are set out below.";
const REVIEW_DEADLINE =
  "You have 1 year from the date of this decision to ask for a review of an issue that was denied or continued while keeping your effective date.";
const VSO_STEP =
  "Contact a VSO to confirm which parts of the decision are final and which can be reviewed";

const STEPS_BY_KIND = {
  granted: [
    "Confirm the rating and effective date for each issue that was granted or increased",
  ],
  denied: ["For a denied issue, note the evidence the letter says is missing"],
  deferred: [
    "For a deferred issue, attend any examination VA schedules and send what it asks for. No decision has been made on that issue yet",
  ],
};

function buildMixedDecisionResult(outcomes) {
  const kinds = new Set(outcomes.map(({ kind }) => kind));
  const reviewable = kinds.has("denied") || kinds.has("continued");
  return {
    decision_type: "Mixed Decision",
    plain_english: `This decision appears to do more than one thing: it ${joinWithAnd(outcomes.map(({ says }) => says))}. The built-in reader cannot count the issues or tell you which is which, so read each numbered item in your letter. You do not need to ask for a review of anything that was granted.`,
    va_reasoning:
      "VA decides each claimed condition separately, so one letter can hold different outcomes.",
    missing_elements: kinds.has("denied")
      ? [
          "Find in the letter exactly which issue or issues were denied - do not assume the whole claim was denied",
        ]
      : [],
    action_plan: [
      ...["granted", "denied", "deferred"].flatMap((kind) =>
        kinds.has(kind) ? STEPS_BY_KIND[kind] : [],
      ),
      ...(reviewable ? [REVIEW_STEP] : []),
      VSO_STEP,
    ],
    deadline_warning: reviewable ? REVIEW_DEADLINE : null,
  };
}

const CONTINUED_RESULT = {
  decision_type: "Rating Continued",
  plain_english:
    "This decision appears to continue at least one rating at its current level: VA did not raise it or lower it. The built-in reader cannot tell you the reasons, so read the Reasons for Decision section of your letter.",
  va_reasoning:
    "VA continues a rating when it finds the evidence does not meet the criteria for a different evaluation.",
  missing_elements: [],
  action_plan: [REVIEW_STEP, VSO_STEP],
  deadline_warning: REVIEW_DEADLINE,
};

export function patternMatchDenial(letterText) {
  // A letter breaks lines mid-phrase ("Service connection is\ndenied").
  const text = String(letterText ?? "").replace(/\s+/g, " ");
  const t = text.toLowerCase();

  const outcomes = outcomesShown(text);
  if (outcomes.length > 1) return buildMixedDecisionResult(outcomes);
  if (outcomes[0]?.kind === "continued") return CONTINUED_RESULT;

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
