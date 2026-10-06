/**
 * The Forms Helper has one app-built draft per statement form. It holds
 * every answer the form collects, once; prints a select's label, never its
 * code; leaves a bracketed blank for anything not supplied; and offers the
 * model the same passages as before and nothing else. Values are invented.
 */
import { describe, it, expect } from "vitest";
import { _getFormStepsForForm } from "../../components/FormsHelper.jsx";
import {
  formStatementPlan,
  listPlaceholders,
  selectPassages,
} from "../../utils/writerTemplates";
import { occurrences } from "../helpers/draftFileText";
import { fillEveryField } from "../helpers/formMarkers";

const FORMS = ["personal-statement", "ptsd-stressor", "buddy-statement"];
const stepsOf = (formType) => _getFormStepsForForm({ id: formType });
const draftOf = (formType, formData) => {
  const plan = formStatementPlan(formType, formData);
  return plan.build(plan.answers);
};

// Every option of every select, and the line the draft prints for it.
const SELECT_LINES = {
  "personal-statement": {
    claimType: {
      initial: "Claim Type: Initial Service Connection",
      increase: "Claim Type: Claim for Increased Rating",
      secondary: "Claim Type: Secondary Service Connection",
      reopened: "Claim Type: Reopened Claim",
    },
  },
  "ptsd-stressor": {
    branch: {
      Army: "Branch of Service: Army",
      Navy: "Branch of Service: Navy",
      "Air Force": "Branch of Service: Air Force",
      "Marine Corps": "Branch of Service: Marine Corps",
      "Coast Guard": "Branch of Service: Coast Guard",
      "Space Force": "Branch of Service: Space Force",
    },
    stressorType: {
      combat: "Type of Stressor: Combat-Related Trauma",
      mst: "Type of Stressor: Military Sexual Trauma (MST)",
      "personal-assault": "Type of Stressor: Personal Assault",
      accident: "Type of Stressor: Serious Accident/Injury",
      death: "Type of Stressor: Witnessing Death or Serious Injury",
      "fear-hostile":
        "Type of Stressor: Fear of Hostile Military/Terrorist Activity",
      other: "Type of Stressor: Other Traumatic Event",
    },
  },
  "buddy-statement": {
    witnessRelation: {
      "fellow-service-member": "Relationship to Veteran: Fellow Service Member",
      supervisor: "Relationship to Veteran: Military Supervisor/NCO/Officer",
      spouse: "Relationship to Veteran: Spouse",
      family: "Relationship to Veteran: Family Member",
      friend: "Relationship to Veteran: Friend",
      coworker: "Relationship to Veteran: Civilian Coworker",
      caregiver: "Relationship to Veteran: Caregiver",
      other: "Relationship to Veteran: Other",
    },
    veteranBranch: {
      Army: "Branch of Service: Army",
      Navy: "Branch of Service: Navy",
      "Air Force": "Branch of Service: Air Force",
      "Marine Corps": "Branch of Service: Marine Corps",
      "Coast Guard": "Branch of Service: Coast Guard",
      "Space Force": "Branch of Service: Space Force",
      "National Guard": "Branch of Service: National Guard",
    },
    conditionType: {
      "witnessed-incident":
        "Type of Statement: I witnessed the incident/injury",
      "witnessed-symptoms":
        "Type of Statement: I witnessed symptoms/effects of the condition",
      "know-before-after":
        "Type of Statement: I knew the veteran before and after service",
      "daily-impact":
        "Type of Statement: I observe how the condition affects daily life",
      "work-impact":
        "Type of Statement: I observe how the condition affects work/employment",
      "character-change":
        "Type of Statement: I witnessed personality/behavioral changes",
    },
  },
};

const selectCases = FORMS.flatMap((formType) =>
  stepsOf(formType)
    .flatMap((step) => step.fields)
    .filter((field) => field.type === "select")
    .flatMap((field) =>
      field.options
        .filter((option) => option.value !== "")
        .map((option) => [formType, field.name, option.value]),
    ),
);

describe.each(FORMS)("%s draft", (formType) => {
  const { formData, markers } = fillEveryField(stepsOf(formType));
  const draft = draftOf(formType, formData);

  it.each(markers)("holds the answer to $name exactly once", ({ printed }) => {
    expect(occurrences(draft, printed)).toBe(1);
  });

  it("has no blank left when every field is answered", () => {
    expect(listPlaceholders(draft)).toEqual([]);
  });

  it("leaves a bracketed blank, not a line of underscores, for each unanswered field", () => {
    const empty = draftOf(formType, {});
    const fields = stepsOf(formType).flatMap((step) => step.fields);
    const optionalOrConditional = fields.filter(
      (field) => field.type === "checkbox" || field.name === "primaryCondition",
    );

    expect(listPlaceholders(empty)).toHaveLength(
      fields.length - optionalOrConditional.length,
    );
    expect(empty.match(/_{5,}/g)).toHaveLength(2);
    expect(empty).toMatch(/Signature: _+\n\nDate signed: _+/);
  });

  it("carries no box for the VA to fill in, and no date before it is signed", () => {
    expect(draft).not.toMatch(/FOR VA USE ONLY|Received by|File Number/);
    expect(draft).not.toMatch(/Date Signed: [A-Z][a-z]+ \d/);
    expect(draft).not.toMatch(/\[Veteran/);
  });
});

describe("a select prints the label of the option chosen", () => {
  it("covers every select the three forms have", () => {
    for (const [formType, field, value] of selectCases) {
      expect(SELECT_LINES[formType]?.[field]?.[value]).toEqual(
        expect.any(String),
      );
    }
    expect(selectCases).toHaveLength(38);
  });

  it.each(selectCases)("%s %s = %s", (formType, field, value) => {
    const draft = draftOf(formType, { [field]: value });
    expect(occurrences(draft, SELECT_LINES[formType][field][value])).toBe(1);
  });

  it("prints a value it does not know as typed, and a blank for none", () => {
    expect(
      draftOf("ptsd-stressor", { stressorType: "Training accident" }),
    ).toContain("Type of Stressor: Training accident");
    expect(draftOf("ptsd-stressor", {})).toContain(
      "Type of Stressor: [type of stressful event]",
    );
  });
});

describe("personal statement draft", () => {
  it.each(["None right now", "none", "Physical therapy twice a month"])(
    "prints the treatment answer %s as typed, claiming nothing more",
    (answer) => {
      const draft = draftOf("personal-statement", {
        currentTreatment: answer,
      });
      expect(draft).toContain(`A. Current treatment:\n${answer}.`);
      expect(draft).not.toMatch(/receiving treatment|sought medical treatment/);
    },
  );

  it("names the primary condition once, and only for a secondary claim", () => {
    const answers = { conditionName: "Sleep apnea", primaryCondition: "PTSD" };
    const secondary = draftOf("personal-statement", {
      ...answers,
      claimType: "secondary",
    });
    expect(occurrences(secondary, "PTSD")).toBe(1);
    expect(secondary).toContain("Secondary to (Primary Condition): PTSD");

    for (const claimType of [
      "initial",
      "increase",
      "reopened",
      "",
      undefined,
    ]) {
      expect(
        draftOf("personal-statement", { ...answers, claimType }),
      ).not.toMatch(/PTSD|Secondary to/);
    }
  });
});

describe("buddy statement draft", () => {
  it("prints the veteran's name from the form, with no [Veteran] left", () => {
    const draft = draftOf("buddy-statement", {
      veteranName: "Jordan Placeholder",
      conditionName: "Migraines",
    });
    expect(draft).toContain("Veteran's Full Name: Jordan Placeholder");
    expect(occurrences(draft, "Jordan Placeholder")).toBe(1);
    expect(draft).not.toContain("[Veteran]");
  });

  it("states willingness to testify only when the box was ticked", () => {
    expect(draftOf("buddy-statement", {})).not.toMatch(/willing to provide/);
    expect(draftOf("buddy-statement", { willingToTestify: false })).not.toMatch(
      /willing to provide/,
    );
  });
});

describe("what the model is offered", () => {
  const passages = (formType, formData) =>
    selectPassages(formStatementPlan(formType, formData)).map((p) => p.text);

  it("is, for every field filled, the same typed answers as before", () => {
    const filled = (formType) => fillEveryField(stepsOf(formType)).formData;
    const personal = filled("personal-statement");
    expect(passages("personal-statement", personal)).toEqual([
      personal.worstDays,
      personal.workImpact,
      personal.socialImpact,
    ]);
    expect(
      passages("personal-statement", { ...personal, claimType: "initial" }),
    ).toEqual([
      personal.inServiceEvent,
      personal.worstDays,
      personal.workImpact,
      personal.socialImpact,
    ]);

    const ptsd = filled("ptsd-stressor");
    expect(passages("ptsd-stressor", ptsd)).toEqual([
      ptsd.eventDescription,
      ptsd.symptoms.join(", "),
      ptsd.symptomDetails,
    ]);

    const buddy = filled("buddy-statement");
    expect(passages("buddy-statement", buddy)).toEqual([
      buddy.whatObserved,
      buddy.specificExamples,
      buddy.dailyImpact,
    ]);
  });

  it("never includes a name, a contact detail, a date or a place field", () => {
    const local = [
      "veteranName",
      "witnessName",
      "witnessPhone",
      "witnessEmail",
      "serviceDates",
      "eventDate",
      "eventLocation",
      "unitInfo",
      "witnesses",
      "reportedTo",
      "whenObserved",
      "whereObserved",
      "medications",
    ];
    for (const formType of FORMS) {
      const plan = formStatementPlan(formType, {});
      expect(plan.passageKeys.filter((key) => local.includes(key))).toEqual([]);
    }
  });

  it("is nothing at all for a form with no wording step", () => {
    expect(formStatementPlan("intent-to-file", {})).toBeNull();
    expect(formStatementPlan(undefined, {})).toBeNull();
  });
});
