import { describe, it, expect } from "vitest";
import { APP_TRANSLATIONS } from "../../i18n/translations";
import {
  STANDARD_DRAFT_NOTE,
  buildAppealStatementTemplate,
  buildBuddyStatementTemplate,
  buildNexusLetterRequestTemplate,
  buildPTSDStressorTemplate,
  buildPersonalStatementTemplate,
  buildTdiuAnalysisTemplate,
  buildWitnessStatementBody,
  buildWitnessStatementTemplate,
  formStatementInputs,
  listPlaceholders,
  witnessRelationshipLabel,
  tdiuAnalysisText,
  tdiuSavePayload,
  tdiuUnfilledBlanks,
} from "../../utils/writerTemplates";

// Every value below is invented for these tests.
const PERSONAL = {
  inServiceEvent: "I fell from a cargo ramp during a night loading drill",
  specificExamples: "I cannot stand at the sink long enough to wash dishes",
  workImpact: "I miss about two shifts a month",
  socialImpact: "I stopped coaching my nephew's team",
  symptomOnsetDate: "March 2011",
  hasTreatment: "yes-private",
};

const EMPTY_BUILDS = {
  personal: () => buildPersonalStatementTemplate({}, ""),
  secondary: () => buildPersonalStatementTemplate({}, "", "Left knee strain"),
  ptsd: () => buildPTSDStressorTemplate({}),
  buddy: () => buildBuddyStatementTemplate({}, ""),
  witness: () => buildWitnessStatementTemplate("", "", {}),
  appeal: () => buildAppealStatementTemplate({}),
  nexus: () => buildNexusLetterRequestTemplate({}),
  tdiu: () => tdiuAnalysisText(buildTdiuAnalysisTemplate([])),
};

const ASSERTED_NUMBERS = /21-4138|21-0781|21-10210|21-8940|38 CFR|50%/g;

describe("writer templates with nothing supplied", () => {
  it.each(Object.entries(EMPTY_BUILDS))(
    "%s is a draft made of blanks, with no invented fact",
    (_name, build) => {
      const draft = build();
      expect(listPlaceholders(draft).length).toBeGreaterThan(0);
      expect(draft.replace(ASSERTED_NUMBERS, "")).not.toMatch(/\d/);
      expect(draft).not.toMatch(/undefined|null|\[\]|\[object/);
    },
  );

  it("does not carry over the old prompts' assumed answers", () => {
    const all = Object.values(EMPTY_BUILDS)
      .map((build) => build())
      .join("\n");
    for (const assumed of [
      "several years",
      "Not currently in formal treatment",
      "Ongoing symptoms",
      "significantly affects",
      "Medical records and personal statements demonstrate",
      "Higher rating warranted",
      "Recent",
    ]) {
      expect(all).not.toContain(assumed);
    }
  });

  it("names the missing fact in each blank", () => {
    expect(buildPersonalStatementTemplate({}, "Tinnitus")).toContain(
      "[date the symptoms began]",
    );
    expect(buildPersonalStatementTemplate({}, "Tinnitus")).toContain(
      "[whether you are being treated for this condition, and where]",
    );
    expect(buildAppealStatementTemplate({})).toContain(
      "[date of the decision you are appealing]",
    );
  });
});

describe("personal statement template", () => {
  it("uses every supplied answer and leaves no blank", () => {
    const draft = buildPersonalStatementTemplate(PERSONAL, "Lumbar strain");
    for (const value of [
      PERSONAL.inServiceEvent,
      PERSONAL.specificExamples,
      PERSONAL.workImpact,
      PERSONAL.socialImpact,
      "March 2011",
      "Lumbar strain",
      "from a private provider",
      "VA Form 21-4138",
      "Compensation and Pension (C&P) examination",
    ]) {
      expect(draft).toContain(value);
    }
    expect(listPlaceholders(draft)).toEqual([]);
  });

  it("states the treatment the veteran selected, including both", () => {
    const draft = (hasTreatment) =>
      buildPersonalStatementTemplate({ hasTreatment }, "Tinnitus");
    expect(draft("yes-va")).toContain("treatment from the VA.");
    expect(draft("both")).toContain("both the VA and a private provider");
    expect(draft("yes")).toContain("receiving treatment for this condition");
    expect(draft("no")).toContain("not currently in formal treatment");
  });

  it("frames a secondary claim and leaves out the onset date, as before", () => {
    const draft = buildPersonalStatementTemplate(
      {
        ...PERSONAL,
        aggravationMechanism: "sleep",
        aggravationExplanation: "Knee pain wakes me most nights",
      },
      "Insomnia",
      "Left knee strain",
    );
    expect(draft).toContain(
      "Insomnia as secondary to my service-connected Left knee strain",
    );
    expect(draft).toContain("Sleep disruption from primary condition.");
    expect(draft).toContain("Knee pain wakes me most nights.");
    expect(draft).not.toContain("March 2011");
    expect(draft).not.toContain(PERSONAL.inServiceEvent);
  });

  it("reads only the fields the tool already sent to the model", () => {
    const draft = buildPersonalStatementTemplate(
      { ...PERSONAL, treatmentType: "SENTINEL-A", witnessName: "SENTINEL-B" },
      "Lumbar strain",
    );
    expect(draft).not.toContain("SENTINEL");
  });
});

describe("other statement templates", () => {
  it("PTSD stressor: supplied answers in, blanks for the rest", () => {
    const draft = buildPTSDStressorTemplate({
      stressorType: "Training accident",
      eventDescription: "A vehicle rolled over beside me on the range",
    });
    expect(draft).toContain("VA Form 21-0781");
    expect(draft).toContain("Type of stressor: Training accident");
    expect(draft).toContain("A vehicle rolled over beside me on the range.");
    expect(draft).toContain("[the symptoms you have now]");
  });

  it("buddy statement keeps the [Veteran] token and never a name", () => {
    const draft = buildBuddyStatementTemplate(
      {
        relationship: "spouse",
        knownDuration: "since 2015",
        observations: "I see them wake up shouting several nights a week",
      },
      "PTSD",
    );
    expect(draft).toContain("Regarding: [Veteran]'s PTSD");
    expect(draft).toContain("My relationship to [Veteran]: spouse");
    expect(draft).toContain("How long I have known [Veteran]: since 2015");
    expect(draft).toContain(
      "[changes you have noticed in the veteran over time]",
    );
    expect(draft).toContain("true to the best of my knowledge");
  });

  it("witness statement lists the witness's answers in order", () => {
    const answers = {
      relationship_context: "I have been married to the veteran since 2012.",
      q1: "They leave the room when fireworks start.",
      q2: "   ",
      q3: "They no longer drive at night.",
    };
    const body = buildWitnessStatementBody("PTSD", answers);
    expect(body).toBe(
      [
        "I have been married to the veteran since 2012.",
        "I am writing to provide my personal observations regarding [Veteran]'s PTSD.",
        "Based on my direct observations:",
        "They leave the room when fireworks start.",
        "They no longer drive at night.",
      ].join("\n\n"),
    );
    const draft = buildWitnessStatementTemplate("Spouse", "PTSD", answers);
    expect(draft).toContain("Witness Type: Spouse");
    expect(draft).toContain(body);
    expect(draft).not.toMatch(/certify|true and correct|Date:/i);
  });
});

describe("appeal and nexus request templates", () => {
  it("appeal statement asserts only the tool's general 38 CFR reference", () => {
    const draft = buildAppealStatementTemplate({
      appealType: "hlr",
      conditionName: "Migraines",
      originalRating: "10%",
      desiredRating: "30%",
      whyIncorrect: "The decision did not consider my headache log",
      newEvidence: "A headache log covering six months",
    });
    expect(draft).toContain("Appeal type: Higher-Level Review (HLR)");
    expect(draft).toContain("Rating assigned: 10%");
    expect(draft).toContain("Rating I believe is correct: 30%");
    expect(draft).toContain(
      "New evidence\nA headache log covering six months.",
    );
    expect(draft).toContain("rating criteria in 38 CFR");
    expect(draft).not.toMatch(/§|38 CFR \d|Part 4|diagnostic code/i);
    expect(buildAppealStatementTemplate({})).not.toContain("New evidence");
  });

  it("nexus request states the tool's standard of proof and nothing more", () => {
    const direct = buildNexusLetterRequestTemplate({
      conditionName: "Hypertension",
      inServiceEvent: "Readings were first high during my final year",
    });
    expect(direct).toContain("[Veteran Name]");
    expect(direct).toContain('"at least as likely as not" (50% or greater');
    expect(direct).toContain("Readings were first high during my final year.");
    expect(direct).toContain("[your current symptoms]");

    const secondary = buildNexusLetterRequestTemplate({
      conditionName: "Sleep apnea",
      primaryCondition: "PTSD",
    });
    expect(secondary).toContain(
      "Sleep apnea was caused or aggravated by my service-connected PTSD",
    );
    expect(secondary).toContain(
      "[how your service-connected condition causes or worsens this one]",
    );
    expect(secondary).not.toContain("[what happened during your service");
  });
});

describe("TDIU analysis template", () => {
  const disabilities = [
    { condition: "Lumbar strain", symptoms: ["Cannot sit >30 minutes"] },
    { condition: "Migraines", symptoms: ["Light sensitivity", "Nausea"] },
  ];

  it("keeps the shape the TDIU Builder renders", () => {
    const analysis = buildTdiuAnalysisTemplate(disabilities);
    expect(analysis.limitations.map((l) => [l.condition, l.symptom])).toEqual([
      ["Lumbar strain", "Cannot sit >30 minutes"],
      ["Migraines", "Light sensitivity"],
      ["Migraines", "Nausea"],
    ]);
    expect(typeof analysis.combined_effect).toBe("string");
    expect(analysis.summary_argument).toContain(
      "unable to secure and maintain substantially gainful employment",
    );
    expect(Array.isArray(analysis.job_types_precluded)).toBe(true);
  });

  it("leaves how each symptom limits work for the veteran to say", () => {
    const analysis = buildTdiuAnalysisTemplate(disabilities);
    for (const limitation of analysis.limitations) {
      expect(listPlaceholders(limitation.vocational_impact)).toHaveLength(1);
    }
    expect(listPlaceholders(analysis.job_types_precluded[0])).toHaveLength(1);
    expect(tdiuAnalysisText(analysis)).not.toMatch(
      /8-hour|exceed employer tolerance|No reasonable accommodations/,
    );
  });
});

describe("standard draft note", () => {
  it("is one plain line", () => {
    expect(STANDARD_DRAFT_NOTE).not.toContain("\n");
    expect(STANDARD_DRAFT_NOTE).toMatch(/standard draft with blanks to fill/);
  });
});

describe("stored codes are printed as the form's own labels", () => {
  it("Forms Helper witness relationship", () => {
    const { answers, condition } = formStatementInputs("buddy-statement", {
      witnessRelation: "fellow-service-member",
      conditionName: "PTSD",
    });
    const draft = buildBuddyStatementTemplate(answers, condition);
    expect(draft).toContain(
      "My relationship to [Veteran]: Fellow Service Member",
    );
    expect(draft).not.toContain("fellow-service-member");
  });

  it("Forms Helper stressor type", () => {
    const { answers } = formStatementInputs("ptsd-stressor", {
      stressorType: "fear-hostile",
    });
    const draft = buildPTSDStressorTemplate(answers);
    expect(draft).toContain(
      "Type of stressor: Fear of Hostile Military/Terrorist Activity",
    );
    expect(draft).not.toContain("fear-hostile");
  });

  it("a value with no label, and an empty one, are left as they are", () => {
    expect(
      formStatementInputs("buddy-statement", { witnessRelation: "godparent" })
        .answers.relationship,
    ).toBe("godparent");
    expect(
      buildBuddyStatementTemplate(
        formStatementInputs("buddy-statement", {}).answers,
        "",
      ),
    ).toContain("[your relationship to the veteran]");
  });

  it("Witness Bench relationship, in the app's English wording", () => {
    const draft = buildWitnessStatementTemplate("buddy", "PTSD", {});
    expect(draft).toContain("Witness Type: Battle Buddy / Fellow Veteran");
    expect(witnessRelationshipLabel("unlisted")).toBe("unlisted");
    for (const [value, key] of [
      ["spouse", "relationshipSpouse"],
      ["parent", "relationshipParent"],
      ["child", "relationshipChild"],
      ["sibling", "relationshipSibling"],
      ["friend", "relationshipFriend"],
      ["buddy", "relationshipBuddy"],
      ["coworker", "relationshipCoworker"],
      ["neighbor", "relationshipNeighbor"],
    ]) {
      expect(witnessRelationshipLabel(value)).toBe(
        APP_TRANSLATIONS.witnessBench[key].en,
      );
    }
  });
});

describe("saving a TDIU analysis", () => {
  const template = buildTdiuAnalysisTemplate([
    { condition: "Migraines", symptoms: ["Light sensitivity"] },
  ]);
  const filled = {
    limitations: [
      {
        condition: "Migraines",
        symptom: "Light sensitivity",
        vocational_impact: "I cannot look at a screen for a full shift.",
      },
    ],
    combined_effect: "I cannot finish a working day.",
    summary_argument: "I cannot keep a job because of my migraines.",
    job_types_precluded: ["Medium", "Heavy"],
  };

  it("counts every blank still standing", () => {
    expect(tdiuUnfilledBlanks(template)).toHaveLength(4);
    expect(tdiuUnfilledBlanks(filled)).toEqual([]);
  });

  it("saves what the veteran sees, and all insights once nothing is blank", () => {
    expect(tdiuSavePayload(filled)).toEqual({
      rawText: filled.summary_argument,
      extractedData: filled,
      vkbMergeData: {
        aiInsights: {
          tdiuSummary: filled.summary_argument,
          tdiuJobsPrecluded: ["Medium", "Heavy"],
        },
      },
    });
  });

  it("keeps bracket text out of the insights", () => {
    const untouched = tdiuSavePayload(template);
    expect(untouched.extractedData).toBe(template);
    expect(untouched.rawText).toBe(template.summary_argument);
    expect(untouched).not.toHaveProperty("vkbMergeData");

    const partly = tdiuSavePayload({
      ...template,
      job_types_precluded: ["Heavy"],
    });
    expect(partly.vkbMergeData).toEqual({
      aiInsights: { tdiuJobsPrecluded: ["Heavy"] },
    });
    expect(JSON.stringify(partly.vkbMergeData)).not.toMatch(/\[[a-z]/);
  });
});
