/**
 * Vet-Rate.org - the Forms Helper's statement drafts
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * One app-built draft per statement form. It holds every answer the form
 * collects, once, under the heading it belongs to, and a square-bracket
 * blank for anything not supplied. The draft is built on the device and is
 * what the veteran sees, edits, downloads and saves.
 *
 * Only the answers named in a form's `passageKeys` are ever offered to the
 * model for rewording. Names, contact details, dates, places and the rest
 * are printed here and go nowhere (ADR-008).
 */

// Above a witness's draft. A witness's words are never reworded by a model:
// they go in as typed, and the witness makes each line a sentence.
export const WITNESS_DRAFT_NOTE =
  "These are your own words, as you typed them. Read every line, make each one a full sentence in your own words, and replace each [bracketed] item before you sign.";

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

const CLAIM_TYPE_LABELS = {
  initial: "Initial Service Connection",
  increase: "Claim for Increased Rating",
  secondary: "Secondary Service Connection",
  reopened: "Reopened Claim",
};

const STATEMENT_TYPE_LABELS = {
  "witnessed-incident": "I witnessed the incident/injury",
  "witnessed-symptoms": "I witnessed symptoms/effects of the condition",
  "know-before-after": "I knew the veteran before and after service",
  "daily-impact": "I observe how the condition affects daily life",
  "work-impact": "I observe how the condition affects work/employment",
  "character-change": "I witnessed personality/behavioral changes",
};

const text = (value) => (typeof value === "string" ? value.trim() : "");
const blank = (description) => `[${description}]`;
const orBlank = (value, description) => text(value) || blank(description);
const sentence = (value) => {
  const trimmed = text(value);
  return /[.!?]["')\]]?$/.test(trimmed) ? trimmed : `${trimmed}.`;
};
const said = (value, description) =>
  text(value) ? sentence(value) : blank(description);
const labelled = (labels, value, description) => {
  const chosen = text(value);
  if (!chosen) return blank(description);
  return Object.hasOwn(labels, chosen) ? labels[chosen] : chosen;
};
const lines = (parts) => parts.filter(Boolean).join("\n");
const paragraphs = (parts) => parts.filter(Boolean).join("\n\n");

const CERTIFICATION =
  "I hereby certify that the statements made herein are true and correct to the best of my knowledge and belief. I understand that a false statement may be grounds for punishment as provided by 18 U.S.C. 1001.";

const signatureBlock = (heading, alsoStated) =>
  paragraphs([
    heading,
    CERTIFICATION,
    alsoStated,
    "Signature: ______________________________",
    "Date signed: ______________________________",
  ]);

const PERSONAL_INSTRUCTIONS = `INSTRUCTIONS:

1. Review this statement for accuracy and completeness.

2. Print and sign where indicated.

3. Submit with VA Form 21-4138 or as an attachment to your VA disability claim.

4. Submit online at: https://www.va.gov/disability/file-disability-claim-form-21-526ez/
   Or mail to your VA Regional Office.

5. Retain a copy for your records.`;

const BUDDY_INSTRUCTIONS = `INSTRUCTIONS:

1. The witness should review this statement for accuracy, then print and sign it.

2. This statement should be submitted as an attachment to VA Form 21-10210
   (Lay/Witness Statement).

3. Submit online at: https://www.va.gov/supporting-forms-for-claims/lay-witness-statement-form-21-10210/
   Or mail to your VA Regional Office.

4. Retain a copy of this signed statement for your records.

5. The veteran should include this statement with their VA disability claim.`;

const PTSD_INSTRUCTIONS = `INSTRUCTIONS:

1. This statement should accompany VA Form 21-0781 (Statement in Support of
   Claim for Service Connection for PTSD).

2. Submit online at: https://www.va.gov/disability/file-disability-claim-form-21-526ez/
   Or mail to your VA Regional Office.

3. Retain a copy for your records.

IMPORTANT NOTES:

- Combat veterans may have reduced evidentiary requirements under 38 CFR 3.304(f)(2)
- MST claims have special evidence provisions under 38 CFR 3.304(f)(5)
- Fear of hostile activity claims: 38 CFR 3.304(f)(3)

CRISIS RESOURCES:

- Veterans Crisis Line: Dial 988, Press 1
- Crisis Text Line: Text 838255
- VA PTSD Resources: https://www.ptsd.va.gov/`;

/** Personal statement (VA Form 21-4138) from the Forms Helper's fields. */
export function buildPersonalFormDraft(a = {}) {
  return paragraphs([
    "STATEMENT IN SUPPORT OF CLAIM\n(To Be Submitted with VA Form 21-4138)",
    lines([
      "SECTION I - CLAIMANT INFORMATION",
      `Full Name: ${orBlank(a.veteranName, "your full name")}`,
      `Claim Type: ${labelled(CLAIM_TYPE_LABELS, a.claimType, "type of claim")}`,
      `Condition Claimed: ${orBlank(a.conditionName, "condition you are claiming")}`,
      a.claimType === "secondary" &&
        `Secondary to (Primary Condition): ${orBlank(a.primaryCondition, "the service-connected condition this one is secondary to")}`,
    ]),
    "SECTION II - IN-SERVICE EVENT, INJURY OR ONSET",
    `A. When my symptoms first began:\n${orBlank(a.onsetDate, "date the symptoms began")}`,
    `B. In-service event, injury or exposure:\n${said(a.inServiceEvent, "what happened during your service that caused or started this condition")}`,
    `C. When I first sought treatment:\n${orBlank(a.firstTreatment, "when you first sought treatment")}`,
    "SECTION III - CURRENT SYMPTOMS AND SEVERITY",
    `A. My symptoms:\n${said(a.symptoms, "the symptoms you have now: how often, how severe, and what sets them off")}`,
    `B. My worst days:\n${said(a.worstDays, "what your worst days with this condition are like")}`,
    `C. Flare-ups:\n${said(a.flareUps, "whether you have flare-ups, how often and how severe")}`,
    "SECTION IV - FUNCTIONAL IMPACT",
    `A. Effect on my work:\n${said(a.workImpact, "how this condition affects your work")}`,
    `B. Effect on my daily activities:\n${said(a.dailyImpact, "how this condition affects your daily activities")}`,
    `C. Effect on my relationships and social life:\n${said(a.socialImpact, "how this condition affects your family and social life")}`,
    "SECTION V - TREATMENT",
    `A. Current treatment:\n${said(a.currentTreatment, "the treatment you are getting now, or none")}`,
    `B. Current medications:\n${said(a.medications, "the medications you take for this condition, or none")}`,
    `C. How well treatment has worked:\n${said(a.treatmentEffectiveness, "how well treatment has worked")}`,
    signatureBlock("CERTIFICATION AND SIGNATURE"),
    PERSONAL_INSTRUCTIONS,
  ]);
}

/** PTSD stressor statement (VA Form 21-0781) from the Forms Helper's fields. */
export function buildPtsdFormDraft(a = {}) {
  return paragraphs([
    "STATEMENT IN SUPPORT OF CLAIM FOR PTSD\n(To Be Submitted with VA Form 21-0781)",
    lines([
      "SECTION I - VETERAN IDENTIFICATION",
      `Full Name: ${orBlank(a.veteranName, "your full name")}`,
      `Branch of Service: ${orBlank(a.branch, "branch of service")}`,
      `Dates of Military Service: ${orBlank(a.serviceDates, "dates of service")}`,
    ]),
    lines([
      "SECTION II - STRESSOR EVENT INFORMATION",
      `Type of Stressor: ${labelled(STRESSOR_TYPE_LABELS, a.stressorType, "type of stressful event")}`,
      `Date of Incident: ${orBlank(a.eventDate, "date of the event, as exact as you can give")}`,
      `Location of Incident: ${orBlank(a.eventLocation, "where the event happened")}`,
      `Unit Assignment at Time of Event: ${orBlank(a.unitInfo, "your unit at the time")}`,
    ]),
    `SECTION III - DETAILED DESCRIPTION OF STRESSOR EVENT\n${said(a.eventDescription, "what happened, in as much detail as you are comfortable giving")}`,
    "SECTION IV - CORROBORATING EVIDENCE",
    `A. Witnesses to the event:\n${said(a.witnesses, "anyone who saw the event or can confirm it, or none known")}`,
    `B. Supporting documentation:\n${said(a.documentation, "any records that might confirm the event, or none known")}`,
    `C. Who I reported the event to:\n${said(a.reportedTo, "who you reported the event to, or that you did not report it")}`,
    "SECTION V - CURRENT PTSD SYMPTOMS",
    `Symptoms I have now: ${said(a.currentSymptoms, "the symptoms you have now")}`,
    `My most severe symptoms:\n${said(a.symptomDetails, "your most severe symptoms, how often they happen and how they affect you")}`,
    signatureBlock("CERTIFICATION AND SIGNATURE"),
    PTSD_INSTRUCTIONS,
  ]);
}

/** Buddy / lay statement (VA Form 21-10210) from the Forms Helper's fields. */
export function buildBuddyFormDraft(a = {}) {
  return paragraphs([
    "STATEMENT IN SUPPORT OF CLAIM\n(To Be Submitted with VA Form 21-10210)",
    lines([
      "SECTION I - PERSON PROVIDING STATEMENT (WITNESS)",
      `Full Name: ${orBlank(a.witnessName, "witness's full name")}`,
      `Relationship to Veteran: ${labelled(WITNESS_RELATION_LABELS, a.witnessRelation, "your relationship to the veteran")}`,
      `Contact Phone: ${orBlank(a.witnessPhone, "phone number, if you wish to give one")}`,
      `Contact Email: ${orBlank(a.witnessEmail, "email address, if you wish to give one")}`,
    ]),
    lines([
      "SECTION II - VETERAN INFORMATION",
      `Veteran's Full Name: ${orBlank(a.veteranName, "veteran's full name")}`,
      `Branch of Service: ${orBlank(a.veteranBranch, "veteran's branch of service")}`,
      `Condition/Disability Claimed: ${orBlank(a.conditionName, "the veteran's condition")}`,
      `Type of Statement: ${labelled(STATEMENT_TYPE_LABELS, a.conditionType, "what this statement is based on")}`,
    ]),
    "SECTION III - STATEMENT",
    `A. How I know the veteran:\n${said(a.howKnown, "how you came to know the veteran")}\nLength of acquaintance: ${orBlank(a.knownSince, "how long you have known the veteran")}`,
    `B. What I personally witnessed or observed:\n${said(a.whatObserved, "what you have personally seen or heard, with specific examples")}`,
    lines([
      "C. When and where these observations occurred:",
      `Timeframe: ${orBlank(a.whenObserved, "when this happened")}`,
      `Location: ${orBlank(a.whereObserved, "where this happened")}`,
    ]),
    "D. Effect of the condition on the veteran's life:",
    `Daily activities:\n${said(a.dailyImpact, "how you have seen the condition affect the veteran's daily activities")}`,
    `Work:\n${said(a.workImpact, "how you have seen the condition affect the veteran's work")}`,
    `Specific incidents or examples:\n${said(a.specificExamples, "specific incidents you saw, with dates if you know them")}`,
    `E. Additional information:\n${said(a.additionalInfo, "anything else that might help, or delete this section")}`,
    signatureBlock(
      "SECTION IV - CERTIFICATION AND SIGNATURE",
      a.willingToTestify === true &&
        "I am willing to provide additional testimony or clarification if requested.",
    ),
    BUDDY_INSTRUCTIONS,
  ]);
}

const joined = (value) =>
  Array.isArray(value) ? value.map(text).filter(Boolean).join(", ") : "";

/*
 * Per form: how its draft is built, which answers are passages (the same
 * free text the form has always offered to the model, and no other), the
 * phrases a rewording must keep, and the tool it runs as.
 */
const FORM_DRAFTS = {
  "personal-statement": (formData) => ({
    build: buildPersonalFormDraft,
    answers: formData,
    // A secondary claim's draft did not print the in-service event before
    // this form had one draft, so that answer was not offered to the model
    // for a secondary claim, and still is not.
    passageKeys: [
      ...(formData.claimType === "secondary" ? [] : ["inServiceEvent"]),
      "worstDays",
      "workImpact",
      "socialImpact",
    ],
    keep: [
      formData.conditionName,
      formData.claimType === "secondary" ? formData.primaryCondition : "",
    ],
    toolId: "personal-statement",
  }),
  "ptsd-stressor": (formData) => ({
    build: buildPtsdFormDraft,
    answers: { ...formData, currentSymptoms: joined(formData.symptoms) },
    passageKeys: ["eventDescription", "currentSymptoms", "symptomDetails"],
    keep: [],
    toolId: "personal-statement",
  }),
  "buddy-statement": (formData) => ({
    build: buildBuddyFormDraft,
    answers: formData,
    // No passages: nothing a witness typed is offered to a model. A model
    // rewording a witness's note about the veteran wrote it as the witness's
    // own act, which a sworn statement cannot carry.
    passageKeys: [],
    keep: [],
    note: WITNESS_DRAFT_NOTE,
    toolId: "buddy-statement",
  }),
};

/** The writing plan for a Forms Helper form, or null when it has none. */
export function formStatementPlan(formType, formData = {}) {
  if (!Object.hasOwn(FORM_DRAFTS, formType ?? "")) return null;
  const draft = FORM_DRAFTS[formType](formData ?? {});
  return { ...draft, keep: draft.keep.map(text).filter(Boolean) };
}

const answered = (pairs) =>
  pairs
    .map(([label, value]) => [label, text(value)])
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n\n");

const labelOf = (labels, value) => {
  const chosen = text(value);
  return Object.hasOwn(labels, chosen) ? labels[chosen] : chosen;
};

/*
 * For the official PDF: the answers that have no box of their own on the
 * form, as labelled paragraphs for its remarks or statement area. Only
 * what was answered is printed; there are no blanks here, because the
 * veteran completes the official form by hand.
 */
const OFFICIAL_FORM_NARRATIVES = {
  "personal-statement": (a) => [
    ["Claim type", labelOf(CLAIM_TYPE_LABELS, a.claimType)],
    ["Condition claimed", a.conditionName],
    ["Secondary to", a.claimType === "secondary" ? a.primaryCondition : ""],
    ["When my symptoms first began", a.onsetDate],
    ["In-service event, injury or exposure", a.inServiceEvent],
    ["When I first sought treatment", a.firstTreatment],
    ["My symptoms", a.symptoms],
    ["My worst days", a.worstDays],
    ["Flare-ups", a.flareUps],
    ["Effect on my work", a.workImpact],
    ["Effect on my daily activities", a.dailyImpact],
    ["Effect on my relationships and social life", a.socialImpact],
    ["Current treatment", a.currentTreatment],
    ["Current medications", a.medications],
    ["How well treatment has worked", a.treatmentEffectiveness],
  ],
  "ptsd-stressor": (a) => [
    ["Branch of service", a.branch],
    ["Dates of military service", a.serviceDates],
    ["Type of stressor", labelOf(STRESSOR_TYPE_LABELS, a.stressorType)],
    ["Unit at the time of the event", a.unitInfo],
    ["Witnesses to the event", a.witnesses],
    ["Supporting documentation", a.documentation],
    ["Who I reported the event to", a.reportedTo],
    ["Symptoms I have now", joined(a.symptoms)],
    ["My most severe symptoms", a.symptomDetails],
  ],
  "buddy-statement": (a) => [
    ["Condition this statement is about", a.conditionName],
    ["Veteran's branch of service", a.veteranBranch],
    ["Type of statement", labelOf(STATEMENT_TYPE_LABELS, a.conditionType)],
    ["How I know the veteran", a.howKnown],
    ["Length of acquaintance", a.knownSince],
    ["What I personally witnessed or observed", a.whatObserved],
    ["When", a.whenObserved],
    ["Where", a.whereObserved],
    ["Effect on the veteran's daily activities", a.dailyImpact],
    ["Effect on the veteran's work", a.workImpact],
    ["Specific incidents or examples", a.specificExamples],
    ["Additional information", a.additionalInfo],
    [
      "Further testimony",
      a.willingToTestify === true
        ? "I am willing to provide additional testimony or clarification if requested."
        : "",
    ],
  ],
};

/** The narrative for a statement form's official PDF, or "" for others. */
export function officialFormNarrative(formType, formData = {}) {
  return Object.hasOwn(OFFICIAL_FORM_NARRATIVES, formType ?? "")
    ? answered(OFFICIAL_FORM_NARRATIVES[formType](formData ?? {}))
    : "";
}
