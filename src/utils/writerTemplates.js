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
  // The form asks when the symptoms began, not whether they have gone on
  // since, so that part is the veteran's to state.
  return [
    `When my symptoms began: ${orBlank(answers.symptomOnsetDate, "date the symptoms began")}`,
    `Since then: ${blank("whether the symptoms have continued since then")}`,
  ].join("\n");
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
    "I respectfully request an evaluation for this condition.",
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

/*
 * What each review lane lets the statement say about evidence.
 *
 * Higher-Level Review, 38 CFR 3.2601(f): "The evidentiary record in a
 * higher-level review is limited to the evidence of record as of the date
 * the agency of original jurisdiction issued notice of the prior decision
 * under review and the higher-level adjudicator may not consider additional
 * evidence." So the statement points only at what is already in the file,
 * and evidence the veteran lists as new is not carried into it.
 *
 * Supplemental Claim, 38 CFR 3.2501: "If new and relevant evidence is
 * presented or secured with respect to the supplemental claim, the agency of
 * original jurisdiction will readjudicate the claim". The statement asks for
 * that evidence first.
 *
 * Board Appeal, 38 CFR 20.202(b): the claimant chooses direct review, a
 * hearing, or evidence submission, and that choice sets what evidence the
 * Board considers. The form does not collect the choice, so it is a blank.
 */
function appealEvidenceSections(answers) {
  const supporting = text(answers.supportingEvidence);
  const fresh = text(answers.newEvidence);
  switch (answers.appealType) {
    case "hlr":
      return [
        `Evidence already in my file that supports my appeal\n${said(supporting, "the evidence already in your VA file that supports a different decision")}`,
        fresh
          ? blank(
              "evidence that is not yet in your VA file cannot be considered in a Higher-Level Review; to have it considered, file a Supplemental Claim instead",
            )
          : "",
      ];
    case "supplemental":
      return [
        `New and relevant evidence\n${said(fresh, "the new and relevant evidence you are submitting or asking VA to obtain")}`,
        supporting
          ? `Evidence already in my file\n${sentence(supporting)}`
          : "",
      ];
    case "nod":
      return [
        `Board review option: ${blank("the option you chose on your Notice of Disagreement: direct review, evidence submission, or a hearing")}`,
        `Evidence that supports my appeal\n${said(supporting, "the evidence that supports a different decision, as the review option you chose allows")}`,
        fresh ? `Additional evidence\n${sentence(fresh)}` : "",
      ];
    default:
      return [
        `Evidence that supports my appeal\n${said(supporting, "the evidence that supports a different decision")}`,
        fresh ? `Additional evidence\n${sentence(fresh)}` : "",
      ];
  }
}

/** Appeal statement (Board Appeal, Higher-Level Review or Supplemental Claim). */
export function buildAppealStatementTemplate(answers = {}) {
  const claimed = orBlank(answers.conditionName, "condition under appeal");
  const appealType =
    APPEAL_TYPE_LABELS[answers.appealType] ||
    orBlank(
      answers.appealType,
      "type of appeal: Board Appeal, Higher-Level Review or Supplemental Claim",
    );
  const evidence =
    answers.appealType === "hlr" ? "evidence of record" : "evidence";
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
    ...appealEvidenceSections(answers),
    `What I am asking for\n${said(answers.desiredOutcome, "the outcome you are asking for")}`,
    `I respectfully ask that the ${evidence} be reviewed against the rating criteria in 38 CFR and that the decision be corrected.`,
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
    `My name is [Veteran Name]. I am filing a VA disability claim for ${claimed} and I am asking whether you would write a medical opinion letter, often called a nexus letter. A nexus letter is a doctor's written opinion on whether a condition is connected to military service. It matters because the VA weighs it as medical evidence when it decides the claim.`,
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
    combined_effect: `My service-connected conditions (${names}) together affect my ability to work. ${blank("how these conditions combine to limit the work you can do")}`,
    summary_argument: `Due to my service-connected disabilities (${names}), I am unable to secure and maintain substantially gainful employment. ${blank("the main reasons you cannot keep a job, in your own words")}`,
    job_types_precluded: [
      blank("types of work you cannot do: Sedentary, Light, Medium or Heavy"),
    ],
  };
}

export const TDIU_WORK_TYPES = ["Sedentary", "Light", "Medium", "Heavy"];

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

/** Every blank still standing in a TDIU analysis, one entry per occurrence. */
export const tdiuUnfilledBlanks = (analysis) =>
  listPlaceholders(tdiuAnalysisText(analysis));

const hasBlank = (value) =>
  listPlaceholders([value].flat().join("\n")).length > 0;

/**
 * What the TDIU Builder saves: the analysis as the veteran sees it for My
 * Packet, and for the knowledge base's insights only the parts with no
 * blank left in them. A bracketed blank is a prompt to the veteran, not
 * something the app has learned.
 */
export function tdiuSavePayload(analysis) {
  const insights = {
    ...(hasBlank(analysis.summary_argument)
      ? {}
      : { tdiuSummary: analysis.summary_argument }),
    ...(hasBlank(analysis.job_types_precluded)
      ? {}
      : { tdiuJobsPrecluded: analysis.job_types_precluded }),
  };
  return {
    rawText: analysis.summary_argument || "",
    extractedData: analysis,
    ...(Object.keys(insights).length > 0
      ? { vkbMergeData: { aiInsights: insights } }
      : {}),
  };
}

export const STANDARD_DRAFT_NOTE_NO_BLANKS =
  "This is the standard draft, built from your answers as you entered them.";

/** The one-line note for an app-built draft, with or without blanks. */
export const standardDraftNote = (draft) =>
  listPlaceholders(draft).length > 0
    ? STANDARD_DRAFT_NOTE
    : STANDARD_DRAFT_NOTE_NO_BLANKS;

/*
 * A writing plan: how one tool's draft is built, and which of its answers
 * are passages, the veteran's (or witness's) own free text. Only passages
 * are ever offered to the model, one by one, for rewording; the app then
 * builds the draft again with the accepted rewordings in their place.
 * Headings, fixed sentences, blanks, labels, greeting and closing are the
 * builder's and never pass through the model.
 *
 *   build(answers)   the draft for a set of answers
 *   answers          what the form supplied
 *   passageKeys      the answers that are free-text passages
 *   keep             phrases a rewording must not lose (condition names)
 */
const plan = (build, answers, passageKeys, keep = []) => ({
  build,
  answers: answers ?? {},
  passageKeys,
  keep: keep.map(text).filter(Boolean),
});

export const personalStatementPlan = (
  answers,
  condition,
  primaryCondition = null,
) =>
  plan(
    (a) => buildPersonalStatementTemplate(a, condition, primaryCondition),
    answers,
    [
      "inServiceEvent",
      "specificIncident",
      "specificExamples",
      "workImpact",
      "socialImpact",
      "nexusExplanation",
      "aggravationExplanation",
    ],
    [condition, primaryCondition],
  );

export const ptsdStatementPlan = (answers) =>
  plan(buildPTSDStressorTemplate, answers, [
    "eventDescription",
    "immediateImpact",
    "currentSymptoms",
    "dailyImpact",
  ]);

export const buddyStatementPlan = (answers, conditionName) =>
  plan(
    (a) => buildBuddyStatementTemplate(a, conditionName),
    answers,
    ["observations", "changesNoticed", "dailyImpact"],
    [conditionName],
  );

export const appealStatementPlan = (answers) =>
  plan(
    buildAppealStatementTemplate,
    answers,
    ["whyIncorrect", "supportingEvidence", "newEvidence", "desiredOutcome"],
    [answers?.conditionName],
  );

export const nexusRequestPlan = (answers) =>
  plan(
    buildNexusLetterRequestTemplate,
    answers,
    ["connectionTheory", "inServiceEvent", "symptoms", "medicalHistory"],
    [answers?.conditionName, answers?.primaryCondition],
  );

/** Every answer a witness typed is a passage. */
export const witnessStatementPlan = (relationship, condition, answers) =>
  plan(
    (a) => buildWitnessStatementTemplate(relationship, condition, a),
    answers,
    Object.keys(answers ?? {}),
    [condition],
  );

/** The plan for a Forms Helper form, or null when it has no wording step. */
export function formStatementPlan(formType, formData) {
  const mapped = formStatementInputs(formType, formData);
  switch (mapped?.kind) {
    case "buddy":
      return buddyStatementPlan(mapped.answers, mapped.condition);
    case "personal":
      return personalStatementPlan(
        mapped.answers,
        mapped.condition,
        mapped.primaryCondition,
      );
    case "ptsd":
      return ptsdStatementPlan(mapped.answers);
    default:
      return null;
  }
}

// A passage this short ("None", "Daily") has nothing to reword.
const MIN_PASSAGE_WORDS = 3;

/**
 * The passages of a plan that are worth offering to the model: answered,
 * long enough to reword, and actually printed in the draft. Each entry is
 * { key, text }.
 */
export function selectPassages({ build, answers, passageKeys }) {
  const draft = build(answers);
  return passageKeys
    .map((key) => ({ key, text: text(answers[key]) }))
    .filter(
      (passage) =>
        passage.text.split(/\s+/).length >= MIN_PASSAGE_WORDS &&
        draft.includes(passage.text),
    );
}

/** The request sent to the model: reword these passages, add nothing. */
export function buildPassagePrompt(passages) {
  const numbered = passages
    .map((passage, i) => `${i + 1}. ${passage}`)
    .join("\n");
  return `Someone typed the numbered passages below into a VA disability claim form. Rewrite each passage as clear, complete sentences in the first person, in plain words.

Rules:
- Say only what the passage says. Do not add any fact, number, date, place, name, unit, diagnosis, rating, cause, feeling or detail that is not in it.
- Keep every number, date and name exactly as written.
- Keep who is speaking, and who is spoken about, the same.
- If a passage is already clear, complete sentences, return it unchanged.
- Do not use square brackets. Do not ask questions, give advice, or add a heading, a greeting, a closing or a certification.
- Reply with the same numbers, one rewritten passage after each number, and nothing else.

${numbered}`;
}
