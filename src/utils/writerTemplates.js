/**
 * Vet-Rate.org - app-built drafts for the writing tools
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Each builder returns a complete draft assembled only from what the form
 * collected. A fact the form did not supply becomes a square-bracket blank
 * ("[date the symptoms began]") for the veteran to fill in; nothing is
 * guessed. The on-device model is asked to improve the wording of this draft,
 * and the draft itself is what the veteran gets when the model's answer is
 * not usable (see writerDraftCheck.js).
 *
 * Every builder reads exactly the fields its tool already sent to the model,
 * so the data offered to an AI provider does not grow. Name blanks keep the
 * tokens the tools already use ("[Veteran]", "[Veteran Name]"), which the
 * app swaps for the real name locally after generation (ADR-008).
 */

export const STANDARD_DRAFT_NOTE =
  "This is the standard draft with blanks to fill in: replace each [bracketed] item with your own details.";

export const AGGRAVATION_OPTIONS = [
  {
    value: "stress",
    label: "Stress and anxiety from primary condition causes flare-ups",
  },
  {
    value: "medication",
    label: "Medication side effects from treating primary condition",
  },
  {
    value: "physical",
    label: "Physical limitations or compensatory behaviors",
  },
  { value: "sleep", label: "Sleep disruption from primary condition" },
  { value: "weight", label: "Weight gain or metabolic changes" },
  {
    value: "inflammation",
    label: "Chronic inflammation or immune dysfunction",
  },
  { value: "other", label: "Other (please explain below)" },
];

const PLACEHOLDER = /\[[^[\]\n]{2,160}\]/g;

export const listPlaceholders = (draft) =>
  String(draft ?? "").match(PLACEHOLDER) ?? [];

const text = (value) => (typeof value === "string" ? value.trim() : "");
const blank = (description) => `[${description}]`;
const orBlank = (value, description) => text(value) || blank(description);
const sentence = (value) => {
  const trimmed = text(value);
  return /[.!?]["')\]]?$/.test(trimmed) ? trimmed : `${trimmed}.`;
};
const said = (value, description) =>
  text(value) ? sentence(value) : blank(description);
const paragraphs = (parts) => parts.filter(Boolean).join("\n\n");

const TREATMENT = {
  "yes-va": "I am currently receiving treatment from the VA.",
  "yes-private": "I am currently receiving treatment from a private provider.",
  both: "I am currently receiving treatment from both the VA and a private provider.",
  yes: "I am currently receiving treatment for this condition.",
  no: "I am not currently in formal treatment for this condition.",
};

const treatmentLine = (hasTreatment) =>
  TREATMENT[hasTreatment] ??
  blank("whether you are being treated for this condition, and where");

function secondaryLink(answers) {
  const mechanism = text(answers.aggravationMechanism);
  const label =
    mechanism === "other"
      ? ""
      : (AGGRAVATION_OPTIONS.find((option) => option.value === mechanism)
          ?.label ?? mechanism);
  const supplied = [
    label,
    answers.aggravationExplanation,
    answers.specificIncident,
  ]
    .filter((part) => text(part))
    .map(sentence);
  return supplied.length > 0
    ? supplied.join(" ")
    : blank("how your service-connected condition causes or worsens this one");
}

function directLink(answers) {
  if (text(answers.nexusExplanation)) return sentence(answers.nexusExplanation);
  const onset = orBlank(answers.symptomOnsetDate, "date the symptoms began");
  return `My symptoms began ${onset} and have continued since then.`;
}

const impactLines = (answers) =>
  [
    said(
      answers.specificExamples,
      "specific examples of how this condition limits your daily activities",
    ),
    `Effect on my work: ${said(answers.workImpact, "how this condition affects your work")}`,
    `Effect on my family and social life: ${said(answers.socialImpact, "how this condition affects your family and social life")}`,
    treatmentLine(answers.hasTreatment),
  ].join("\n");

/**
 * Personal statement (VA Form 21-4138). `primaryCondition` set means a
 * secondary claim.
 */
export function buildPersonalStatementTemplate(
  answers = {},
  condition = "",
  primaryCondition = null,
) {
  const claimed = orBlank(condition, "condition you are claiming");
  const primary = text(primaryCondition);

  if (primary) {
    return paragraphs([
      "PERSONAL STATEMENT IN SUPPORT OF CLAIM (VA Form 21-4138)",
      `I am submitting this statement in support of my claim for ${claimed} as secondary to my service-connected ${primary}.`,
      `My service-connected condition\nI have a service-connected condition: ${primary}.`,
      `My symptoms now\n${impactLines(answers)}`,
      `How my ${primary} causes or worsens my ${claimed}\n${secondaryLink(answers)}`,
      "I respectfully request a Compensation and Pension (C&P) examination to evaluate this condition and its connection to my service-connected disability.",
    ]);
  }

  return paragraphs([
    "PERSONAL STATEMENT IN SUPPORT OF CLAIM (VA Form 21-4138)",
    `I am submitting this statement in support of my claim for service connection for ${claimed}.`,
    `What happened in service\n${said(
      text(answers.inServiceEvent) || answers.specificIncident,
      "what happened during your service that caused or started this condition",
    )}`,
    `My symptoms now\n${impactLines(answers)}`,
    `How this connects to my service\n${directLink(answers)}`,
    "I respectfully request a Compensation and Pension (C&P) examination to evaluate this condition and its connection to my service.",
  ]);
}

/** PTSD stressor statement (VA Form 21-0781). */
export function buildPTSDStressorTemplate(answers = {}) {
  const event = text(answers.eventDescription);
  const type = text(answers.stressorType);
  return paragraphs([
    "STATEMENT IN SUPPORT OF CLAIM FOR PTSD (VA Form 21-0781)",
    `Type of stressor: ${orBlank(type, "type of stressful event")}`,
    `What happened\n${said(event, "what happened, in as much detail as you are comfortable giving")}`,
    `How it affected me at the time\n${said(answers.immediateImpact, "how the event affected you right afterwards")}`,
    `My symptoms now\n${said(answers.currentSymptoms, "the symptoms you have now")}`,
    `How it affects my life now\n${said(answers.dailyImpact, "how these symptoms affect your daily life, work and relationships")}`,
    "Recounting these events is difficult for me. I respectfully request an evaluation for this condition.",
  ]);
}

/** Buddy / lay statement (VA Form 21-10210) from the Forms Helper fields. */
export function buildBuddyStatementTemplate(answers = {}, conditionName = "") {
  return paragraphs([
    "STATEMENT IN SUPPORT OF CLAIM (VA Form 21-10210)",
    `Regarding: [Veteran]'s ${orBlank(conditionName, "the veteran's condition")}`,
    [
      `My relationship to [Veteran]: ${orBlank(answers.relationship, "your relationship to the veteran")}`,
      `How long I have known [Veteran]: ${orBlank(answers.knownDuration, "how long you have known the veteran")}`,
    ].join("\n"),
    `What I have personally observed\n${said(answers.observations, "what you have personally seen or heard, with specific examples")}`,
    `Changes I have noticed\n${said(answers.changesNoticed, "changes you have noticed in the veteran over time")}`,
    `Effect on daily life that I have witnessed\n${said(answers.dailyImpact, "how you have seen the condition affect the veteran's daily life")}`,
    "This statement describes only what I have personally observed. It is true to the best of my knowledge.",
  ]);
}

/**
 * The narrative part of a Witness Bench statement: the witness's own
 * answers, in the order given. `relationship_context` leads; every other
 * answered question follows as an observation.
 */
export function buildWitnessStatementBody(condition = "", answers = {}) {
  const claimed = orBlank(condition, "the veteran's condition");
  const context = text(answers.relationship_context);
  const observations = Object.entries(answers)
    .filter(([key, value]) => key !== "relationship_context" && text(value))
    .map(([, value]) => text(value));

  return paragraphs([
    context,
    `I am writing to provide my personal observations regarding [Veteran]'s ${claimed}.`,
    "Based on my direct observations:",
    ...(observations.length > 0
      ? observations
      : [
          blank(
            "what you have personally seen or heard, with specific examples",
          ),
        ]),
  ]);
}

/**
 * Witness Bench statement as offered to the model: heading plus narrative.
 * `relationship` is the stored choice ("spouse"); its label is printed.
 */
export function buildWitnessStatementTemplate(
  relationship = "",
  condition = "",
  answers = {},
) {
  const relationshipLabel = witnessRelationshipLabel(relationship);
  return paragraphs([
    [
      "STATEMENT IN SUPPORT OF CLAIM (VA FORM 21-10210)",
      `Witness Type: ${orBlank(relationshipLabel, "your relationship to the veteran")}`,
      `Regarding: ${orBlank(condition, "the veteran's condition")}`,
    ].join("\n"),
    buildWitnessStatementBody(condition, answers),
  ]);
}

const APPEAL_TYPE_LABELS = {
  nod: "Notice of Disagreement (NOD) / Board Appeal",
  hlr: "Higher-Level Review (HLR)",
  supplemental: "Supplemental Claim with New Evidence",
};

/** Appeal statement (Board Appeal, Higher-Level Review or Supplemental Claim). */
export function buildAppealStatementTemplate(answers = {}) {
  const claimed = orBlank(answers.conditionName, "condition under appeal");
  const appealType =
    APPEAL_TYPE_LABELS[answers.appealType] ||
    orBlank(
      answers.appealType,
      "type of appeal: Board Appeal, Higher-Level Review or Supplemental Claim",
    );
  return paragraphs([
    "APPEAL STATEMENT",
    [
      `Appeal type: ${appealType}`,
      `Condition: ${claimed}`,
      `Date of the decision: ${orBlank(answers.decisionDate, "date of the decision you are appealing")}`,
      `Rating assigned: ${orBlank(answers.originalRating, "rating the VA assigned")}`,
      `Rating I believe is correct: ${orBlank(answers.desiredRating, "rating you believe the evidence supports")}`,
    ].join("\n"),
    `I disagree with the decision on my claim for ${claimed}.`,
    `Why the decision is incorrect\n${said(answers.whyIncorrect, "why you believe the decision is wrong")}`,
    `Evidence that supports my appeal\n${said(answers.supportingEvidence, "the evidence that supports a different decision")}`,
    text(answers.newEvidence)
      ? `New evidence\n${sentence(answers.newEvidence)}`
      : "",
    `What I am asking for\n${said(answers.desiredOutcome, "the outcome you are asking for")}`,
    "I respectfully ask that the evidence be reviewed against the rating criteria in 38 CFR and that the decision be corrected.",
  ]);
}

/** A request the veteran gives their doctor asking for a nexus letter. */
export function buildNexusLetterRequestTemplate(answers = {}) {
  const claimed = orBlank(answers.conditionName, "condition you are claiming");
  const primary = text(answers.primaryCondition);
  const connection = primary
    ? `Whether my ${claimed} was caused or aggravated by my service-connected ${primary}. ${said(answers.connectionTheory, "how your service-connected condition causes or worsens this one")}`
    : `Whether my ${claimed} is connected to my military service. ${said(answers.inServiceEvent, "what happened during your service that caused or started this condition")}`;

  return paragraphs([
    "REQUEST FOR A MEDICAL OPINION (NEXUS LETTER)",
    "Dear Doctor,",
    `I am your patient, [Veteran Name]. I am filing a VA disability claim for ${claimed} and I am asking whether you would write a medical opinion letter, often called a nexus letter. A nexus letter is a doctor's written opinion on whether a condition is connected to military service. It matters because the VA weighs it as medical evidence when it decides the claim.`,
    `The connection I am asking you to address\n${connection}`,
    `My symptoms\n${said(answers.symptoms, "your current symptoms")}`,
    `Relevant medical history\n${said(answers.medicalHistory, "relevant treatment and medical history")}`,
    `The standard of proof\nThe VA standard is "at least as likely as not" (50% or greater probability). If you agree, the letter should say whether it is at least as likely as not that the connection described above exists, and explain your reasoning.`,
    "Please base your opinion only on your professional medical judgment and my records. Thank you for considering this request.",
    "Sincerely,\n[Veteran Name]",
  ]);
}

/**
 * TDIU analysis (VA Form 21-8940, Box 18) in the shape the TDIU Builder
 * renders. The veteran selects conditions and symptoms; how each one limits
 * their work is theirs to say, so those stay blank.
 */
export function buildTdiuAnalysisTemplate(disabilities = []) {
  const listed = disabilities.filter((d) => text(d?.condition));
  const names =
    listed.map((d) => text(d.condition)).join(", ") ||
    blank("your service-connected conditions");
  return {
    limitations: listed.flatMap((d) =>
      (d.symptoms ?? []).filter(text).map((symptom) => ({
        condition: text(d.condition),
        symptom: text(symptom),
        vocational_impact: `Because of this symptom, ${blank("the work tasks this stops you from doing, and how often")}.`,
      })),
    ),
    combined_effect: `My service-connected conditions (${names}) affect my ability to work together. ${blank("how these conditions combine to limit the work you can do")}`,
    summary_argument: `Due to my service-connected disabilities (${names}), I am unable to secure and maintain substantially gainful employment. ${blank("the main reasons you cannot keep a job, in your own words")}`,
    job_types_precluded: [
      blank("types of work you cannot do: Sedentary, Light, Medium or Heavy"),
    ],
  };
}

/** The TDIU analysis as one block of text, for wording checks. */
export const tdiuAnalysisText = (analysis) =>
  [
    ...(analysis?.limitations ?? []).flatMap((item) => [
      item?.condition,
      item?.symptom,
      item?.vocational_impact,
    ]),
    analysis?.combined_effect,
    analysis?.summary_argument,
    ...(analysis?.job_types_precluded ?? []),
  ]
    .filter((part) => typeof part === "string")
    .join("\n");

/*
 * A form stores a select's code ("fellow-service-member"); a statement
 * prints its label. These are the labels the Forms Helper's own statements
 * print, and the Witness Bench's English relationship labels.
 */
export const WITNESS_RELATION_LABELS = {
  "fellow-service-member": "Fellow Service Member",
  supervisor: "Military Supervisor/NCO/Officer",
  spouse: "Spouse",
  family: "Family Member",
  friend: "Friend",
  coworker: "Civilian Coworker",
  caregiver: "Caregiver",
  other: "Other",
};

export const STRESSOR_TYPE_LABELS = {
  combat: "Combat-Related Trauma",
  mst: "Military Sexual Trauma (MST)",
  "personal-assault": "Personal Assault",
  accident: "Serious Accident/Injury",
  death: "Witnessing Death or Serious Injury",
  "fear-hostile": "Fear of Hostile Military/Terrorist Activity",
  other: "Other Traumatic Event",
};

const WITNESS_BENCH_RELATIONSHIP_LABELS = {
  spouse: "Spouse / Partner",
  parent: "Parent",
  child: "Adult Child",
  sibling: "Sibling",
  friend: "Close Friend",
  buddy: "Battle Buddy / Fellow Veteran",
  coworker: "Coworker / Supervisor",
  neighbor: "Neighbor",
};

const labelFor = (labels, value) =>
  Object.hasOwn(labels, value ?? "") ? labels[value] : value;

export const witnessRelationshipLabel = (value) =>
  labelFor(WITNESS_BENCH_RELATIONSHIP_LABELS, value);

/**
 * The Forms Helper's field names mapped to the answers each statement
 * builder reads, or null for a form with no AI wording step.
 */
export function formStatementInputs(formType, formData = {}) {
  switch (formType) {
    case "buddy-statement":
      return {
        kind: "buddy",
        answers: {
          relationship: labelFor(
            WITNESS_RELATION_LABELS,
            formData.witnessRelation,
          ),
          knownDuration: formData.knownSince,
          observations: formData.whatObserved,
          changesNoticed: formData.specificExamples,
          dailyImpact: formData.dailyImpact,
        },
        condition: formData.conditionName,
      };
    case "personal-statement":
      return {
        kind: "personal",
        answers: {
          inServiceEvent: formData.inServiceEvent,
          specificExamples: formData.worstDays,
          workImpact: formData.workImpact,
          socialImpact: formData.socialImpact,
          symptomOnsetDate: formData.onsetDate,
          // The form asks what treatment, not where: say only that there is
          // some, and leave a blank when the field was left empty.
          hasTreatment: text(formData.currentTreatment) ? "yes" : undefined,
        },
        condition: formData.conditionName,
        primaryCondition: formData.primaryCondition ?? null,
      };
    case "ptsd-stressor":
      return {
        kind: "ptsd",
        answers: {
          stressorType: labelFor(STRESSOR_TYPE_LABELS, formData.stressorType),
          eventDescription: formData.eventDescription,
          currentSymptoms: Array.isArray(formData.symptoms)
            ? formData.symptoms.join(", ")
            : formData.symptomDetails,
          dailyImpact: formData.symptomDetails,
        },
      };
    default:
      return null;
  }
}

/** The answers that appear, as entered, in `template`. */
export const suppliedIn = (template, values) =>
  values
    .map(text)
    .filter((value) => value.length > 1 && template.includes(value));

const REWORD_RULES = `Rules:
- Keep every fact exactly as written: every number, date, rating, condition name and described event.
- Keep every item in square brackets exactly as written, for example [date the symptoms began]. Those are blanks the veteran will fill in. Do not fill them in, remove them or add new ones.
- Do not add any fact, date, unit, place, diagnosis, name, rating or legal citation that is not already in the draft.
- Do not add a certification, attestation, date or signature line.
- Do not ask questions, give advice or explain your changes.`;

/** The request sent to the model: reword this draft, change nothing else. */
export const buildRewordPrompt = (template) =>
  `Below is a draft the app built from the veteran's own answers. Improve its wording so it reads clearly and naturally, and reply with the complete improved draft and nothing else.

${REWORD_RULES}
- Keep the headings and the order of the sections.

=== DRAFT ===
${template}
=== END DRAFT ===`;

/** The same request for the TDIU analysis, which the app reads as JSON. */
export const buildTdiuRewordPrompt = (analysis) =>
  `Below is a draft TDIU analysis (VA Form 21-8940, Box 18) the app built from the conditions and symptoms the veteran selected. Improve the wording of the "vocational_impact", "combined_effect" and "summary_argument" text so it reads clearly and professionally.

${REWORD_RULES}
- Keep every "condition" and "symptom" value, the number and order of the limitations, and "job_types_precluded" exactly as given.
- Reply only with a JSON object in exactly the same shape as the draft.

=== DRAFT ===
${JSON.stringify(analysis, null, 2)}
=== END DRAFT ===`;
