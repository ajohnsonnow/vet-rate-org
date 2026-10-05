/**
 * The writing tools in aiStatementHelper hand the model an app-built draft
 * to reword, and return that draft when the model's answer is not usable.
 * Fixture values are invented for these tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  enhanceAppealStatement,
  enhanceBuddyStatement,
  enhanceFormStatement,
  enhancePTSDStatement,
  enhancePersonalStatement,
  generateNexusLetterRequest,
} from "../../utils/aiStatementHelper";
import { saveVeteranProfile } from "../../utils/veteranProfile";
import {
  STANDARD_DRAFT_NOTE,
  buildAppealStatementTemplate,
  buildBuddyStatementTemplate,
  buildNexusLetterRequestTemplate,
  buildPTSDStressorTemplate,
  buildPersonalStatementTemplate,
} from "../../utils/writerTemplates";

vi.mock("../../utils/unifiedAIService", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isAnyAIAvailable: () => true,
    getAIStatus: () => ({ statusText: "Local AI" }),
    generateAI: vi.fn(),
  };
});
const { generateAI } = await import("../../utils/unifiedAIService");

const PERSONAL = {
  inServiceEvent: "I fell from a cargo ramp during a night loading drill",
  specificExamples: "I cannot stand at the sink long enough to wash dishes",
  workImpact: "I miss about two shifts a month",
  socialImpact: "I stopped coaching my nephew's team",
  symptomOnsetDate: "March 2011",
  hasTreatment: "yes-private",
};
const PTSD = {
  stressorType: "Training accident",
  eventDescription: "A vehicle rolled over beside me on the range",
  currentSymptoms: "I startle at engine noise and sleep about four hours",
};
const BUDDY = {
  relationship: "spouse",
  knownDuration: "since 2015",
  observations: "I see them wake up shouting several nights a week",
};
const APPEAL = {
  appealType: "hlr",
  conditionName: "Migraines",
  originalRating: "10%",
  desiredRating: "30%",
  whyIncorrect: "The decision did not consider my headache log",
};
const NEXUS = {
  conditionName: "Hypertension",
  inServiceEvent: "Readings were first high during my final year",
};

const TOOLS = [
  [
    "enhancePersonalStatement",
    () => enhancePersonalStatement(PERSONAL, "Lumbar strain"),
    buildPersonalStatementTemplate(PERSONAL, "Lumbar strain"),
    "personal-statement",
  ],
  [
    "enhancePTSDStatement",
    () => enhancePTSDStatement(PTSD),
    buildPTSDStressorTemplate(PTSD),
    "personal-statement",
  ],
  [
    "enhanceBuddyStatement",
    () => enhanceBuddyStatement(BUDDY, "PTSD"),
    buildBuddyStatementTemplate(BUDDY, "PTSD"),
    "buddy-statement",
  ],
  [
    "enhanceAppealStatement",
    () => enhanceAppealStatement(APPEAL),
    buildAppealStatementTemplate(APPEAL),
    "appeal-statement",
  ],
  [
    "generateNexusLetterRequest",
    () => generateNexusLetterRequest(NEXUS),
    buildNexusLetterRequestTemplate(NEXUS),
    "nexus-builder",
  ],
];

const draftIn = (prompt) =>
  /=== DRAFT ===\n([\s\S]*)\n=== END DRAFT ===/.exec(prompt)[1];
const modelReplies = (reply) =>
  generateAI.mockImplementation(async (prompt) => ({
    text: typeof reply === "function" ? reply(prompt) : reply,
    mode: "swarm",
  }));

beforeEach(() => {
  localStorage.clear();
  generateAI.mockReset();
});

describe.each(TOOLS)("%s", (_name, run, template, toolId) => {
  it("asks the model to reword the app-built draft, not to write from nothing", async () => {
    modelReplies(draftIn);
    await run();

    expect(generateAI).toHaveBeenCalledTimes(1);
    const [prompt, options] = generateAI.mock.calls[0];
    expect(draftIn(prompt)).toBe(template);
    expect(prompt).toMatch(/Improve (its|the) wording/i);
    expect(prompt).toMatch(/square brackets/i);
    expect(prompt).not.toMatch(/Write the (statement|letter request) now/);
    expect(options.toolId).toBe(toolId);
    expect(options.dataClass).toBe("context");
  });

  it("returns the model's wording when it passes the check", async () => {
    modelReplies(
      (prompt) =>
        `Certainly! Here is the improved draft:\n\n${draftIn(prompt)}`,
    );
    const result = await run();

    expect(result).toMatchObject({
      success: true,
      content: template,
      draftPath: "model",
      draftNote: null,
    });
  });

  it("returns the app-built draft with the note when the model asks for information", async () => {
    modelReplies(
      "I can help with that. To make it accurate, please provide the following details: your branch of service, the dates you served, and the name of the provider who treats you.",
    );
    const result = await run();

    expect(result).toMatchObject({
      success: true,
      content: template,
      draftPath: "template",
      draftNote: STANDARD_DRAFT_NOTE,
    });
    // A nexus request is itself a request to its reader, so there the reply
    // is rejected for being too short to be the draft.
    expect(result.draftRejectReasons).toEqual([
      toolId === "nexus-builder"
        ? "not a draft: empty"
        : "not a draft: asks-for-information",
    ]);
  });

  it("returns the app-built draft when the model adds a fact", async () => {
    modelReplies(
      (prompt) =>
        `${draftIn(prompt)}\n\nI served in the Navy from 2005 to 2010.`,
    );
    const result = await run();

    expect(result.draftPath).toBe("template");
    expect(result.content).toBe(template);
    expect(result.draftRejectReasons.join(" ")).toMatch(/2005/);
  });
});

describe("an empty form", () => {
  it("still yields a draft made of blanks", async () => {
    modelReplies("Please provide more details about your service.");
    const result = await enhancePTSDStatement(undefined);

    expect(result.draftPath).toBe("template");
    expect(result.content).toBe(buildPTSDStressorTemplate({}));
  });
});

describe("failures stay failures", () => {
  it("an engine error is reported, with no draft path", async () => {
    generateAI.mockRejectedValue(new Error("Local AI not initialized"));
    const result = await enhancePersonalStatement(PERSONAL, "Lumbar strain");

    expect(result.success).toBe(false);
    expect(result.errorType).toBe("not_initialized");
    expect(result.draftPath).toBeUndefined();
  });
});

describe("identifiers stay out of the AI context (ADR-008)", () => {
  it("redacts a name the veteran typed, and still returns their own words", async () => {
    saveVeteranProfile({ firstName: "Jordan", lastName: "Faketon" });
    const answers = {
      ...BUDDY,
      observations: "I see Jordan Faketon wake up shouting most nights",
    };
    modelReplies("Please provide more details about the veteran.");
    const result = await enhanceBuddyStatement(answers, "PTSD");

    const [prompt] = generateAI.mock.calls[0];
    expect(prompt).not.toContain("Jordan");
    expect(prompt).not.toContain("Faketon");
    expect(prompt).toContain("[Veteran]");
    expect(result.content).toBe(buildBuddyStatementTemplate(answers, "PTSD"));
  });

  it("accepts a rewording of the redacted draft", async () => {
    saveVeteranProfile({ firstName: "Jordan", lastName: "Faketon" });
    modelReplies(draftIn);
    const result = await enhanceBuddyStatement(
      {
        ...BUDDY,
        observations: "I see Jordan Faketon wake up shouting most nights",
      },
      "PTSD",
    );

    expect(result.draftPath).toBe("model");
    expect(result.content).not.toContain("Faketon");
  });
});

describe("enhanceFormStatement", () => {
  it("does not claim VA treatment the veteran did not state", async () => {
    modelReplies(draftIn);
    await enhanceFormStatement("personal-statement", {
      conditionName: "Tinnitus",
      currentTreatment: "Hearing aids from a private audiologist",
    });
    const treated = draftIn(generateAI.mock.calls[0][0]);
    expect(treated).toContain("receiving treatment for this condition");
    expect(treated).not.toContain("from the VA");
    expect(treated).not.toContain("audiologist");

    localStorage.clear();
    await enhanceFormStatement("personal-statement", {
      conditionName: "Tinnitus",
    });
    expect(draftIn(generateAI.mock.calls[1][0])).toContain(
      "[whether you are being treated for this condition, and where]",
    );
  });
});
