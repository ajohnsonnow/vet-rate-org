/**
 * The statement tools in aiStatementHelper offer the model only the
 * passages someone typed, place each accepted rewording into the app-built
 * draft, and return that draft unchanged when nothing reworded is usable.
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
  appealStatementPlan,
  buddyStatementPlan,
  buildPassagePrompt,
  buildPTSDStressorTemplate,
  buildPersonalStatementTemplate,
  nexusRequestPlan,
  personalStatementPlan,
  ptsdStatementPlan,
  selectPassages,
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
  relationship: "Spouse",
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
    personalStatementPlan(PERSONAL, "Lumbar strain"),
    "personal-statement",
  ],
  [
    "enhancePTSDStatement",
    () => enhancePTSDStatement(PTSD),
    ptsdStatementPlan(PTSD),
    "personal-statement",
  ],
  [
    "enhanceBuddyStatement",
    () => enhanceBuddyStatement(BUDDY, "PTSD"),
    buddyStatementPlan(BUDDY, "PTSD"),
    "buddy-statement",
  ],
  [
    "enhanceAppealStatement",
    () => enhanceAppealStatement(APPEAL),
    appealStatementPlan(APPEAL),
    "appeal-statement",
  ],
  [
    "generateNexusLetterRequest",
    () => generateNexusLetterRequest(NEXUS),
    nexusRequestPlan(NEXUS),
    "nexus-builder",
  ],
];

const passagesIn = (prompt) =>
  prompt
    .split("\n")
    .filter((line) => /^\d+\. /.test(line))
    .map((line) => line.replace(/^\d+\. /, ""));
const numbered = (passages) =>
  passages.map((passage, i) => `${i + 1}. ${passage}`).join("\n");
/** A rewording that changes the wording and adds no fact. */
const reword = (passage) => {
  const body = /^I\b/.test(passage)
    ? passage
    : passage[0].toLowerCase() + passage.slice(1);
  return `To put it plainly, ${body}${/[.!?]$/.test(body) ? "" : "."}`;
};
const modelReplies = (reply) =>
  generateAI.mockImplementation(async (prompt) => ({
    text: typeof reply === "function" ? reply(passagesIn(prompt)) : reply,
    mode: "swarm",
  }));

beforeEach(() => {
  localStorage.clear();
  generateAI.mockReset();
});

describe.each(TOOLS)("%s", (_name, run, plan, toolId) => {
  const template = plan.build(plan.answers);
  const sent = selectPassages(plan);

  it("offers the model the typed passages and nothing else of the draft", async () => {
    modelReplies(numbered);
    await run();

    expect(generateAI).toHaveBeenCalledTimes(1);
    const [prompt, options] = generateAI.mock.calls[0];
    expect(sent.length).toBeGreaterThan(0);
    expect(prompt).toBe(
      buildPassagePrompt(
        sent.map((p) => p.text),
        plan.voice,
      ),
    );
    expect(prompt).not.toMatch(/VA Form|Dear Doctor|38 CFR|\[/);
    expect(options.toolId).toBe(toolId);
    expect(options.dataClass).toBe("context");
  });

  it("places the accepted rewordings in the app-built draft", async () => {
    modelReplies((passages) => numbered(passages.map(reword)));
    const result = await run();

    const reworded = Object.fromEntries(
      sent.map((p) => [p.key, reword(p.text)]),
    );
    expect(result).toMatchObject({
      success: true,
      content: plan.build({ ...plan.answers, ...reworded }),
      draftPath: "model",
      draftNote: null,
      passages: { sent: sent.length, accepted: sent.length, rejected: 0 },
    });
    expect(result.content).not.toBe(template);
  });

  it("returns the app draft, with no AI claim, when the model only echoes", async () => {
    modelReplies(numbered);
    const result = await run();

    expect(result).toMatchObject({
      success: true,
      content: template,
      draftPath: "template",
      passages: { sent: sent.length, accepted: 0, unchanged: sent.length },
    });
    expect(result.draftNote).toBeTruthy();
    expect(result.draftRejectReasons).toEqual([]);
  });

  it("returns the app draft when the model asks for information", async () => {
    modelReplies(
      "I can help with that. To make it accurate, please provide the following details: your branch of service and the dates you served.",
    );
    const result = await run();

    expect(result).toMatchObject({
      success: true,
      content: template,
      draftPath: "template",
      passages: { accepted: 0, rejected: sent.length },
    });
    expect(result.draftRejectReasons).toHaveLength(sent.length);
  });

  it("keeps the writer's words where a rewording adds a fact", async () => {
    modelReplies((passages) =>
      numbered(
        passages.map((p) => `${reword(p)} This was in the Navy in 2005.`),
      ),
    );
    const result = await run();

    expect(result.draftPath).toBe("template");
    expect(result.content).toBe(template);
    expect(result.draftRejectReasons.join(" ")).toMatch(/2005/);
  });
});

describe.each(TOOLS)("%s when the model cannot answer", (_name, run, plan) => {
  const template = plan.build(plan.answers);

  it("returns the app draft and names the engine error", async () => {
    generateAI.mockRejectedValue(new Error("WebGPU inference timed out"));
    const result = await run();

    expect(result).toMatchObject({
      success: true,
      content: template,
      draftPath: "template",
      draftRejectReasons: [],
      errorType: "timeout",
    });
    expect(result.draftErrorReason).toMatch(/timed out/i);
  });

  it("returns the app draft during the request cooldown", async () => {
    modelReplies(numbered);
    await run();
    const second = await run();

    expect(generateAI).toHaveBeenCalledTimes(1);
    expect(second).toMatchObject({
      success: true,
      content: template,
      draftPath: "template",
    });
    expect(second.draftErrorReason).toMatch(/cooling down/i);
  });
});

describe("a form with no free text", () => {
  it("makes no model call, uses no request allowance, and returns the app draft", async () => {
    const answers = { symptomOnsetDate: "March 2011", hasTreatment: "no" };
    const first = await enhancePersonalStatement(answers, "Tinnitus");
    const second = await enhancePersonalStatement(answers, "Tinnitus");

    expect(generateAI).not.toHaveBeenCalled();
    for (const result of [first, second]) {
      expect(result).toMatchObject({
        success: true,
        content: buildPersonalStatementTemplate(answers, "Tinnitus"),
        draftPath: "template",
        draftNote: STANDARD_DRAFT_NOTE,
        passages: { sent: 0, accepted: 0, unchanged: 0, rejected: 0 },
      });
      expect(result.draftErrorReason).toBeUndefined();
    }
  });

  it("an empty form still yields a draft made of blanks", async () => {
    const result = await enhancePTSDStatement(undefined);
    expect(result.draftPath).toBe("template");
    expect(result.content).toBe(buildPTSDStressorTemplate({}));
    expect(generateAI).not.toHaveBeenCalled();
  });
});

describe("crisis language stops every statement tool before the model", () => {
  const CRISIS = "Some nights I think I want to kill myself";
  const withCrisis = [
    [
      "enhancePersonalStatement",
      () =>
        enhancePersonalStatement({ ...PERSONAL, socialImpact: CRISIS }, "PTSD"),
    ],
    [
      "enhancePTSDStatement",
      () => enhancePTSDStatement({ ...PTSD, dailyImpact: CRISIS }),
    ],
    [
      "enhanceBuddyStatement",
      () => enhanceBuddyStatement({ ...BUDDY, observations: CRISIS }, "PTSD"),
    ],
    [
      "enhanceAppealStatement",
      () => enhanceAppealStatement({ ...APPEAL, whyIncorrect: CRISIS }),
    ],
    [
      "generateNexusLetterRequest",
      () => generateNexusLetterRequest({ ...NEXUS, symptoms: CRISIS }),
    ],
    [
      "a form whose only text is a short field",
      () => enhancePTSDStatement({ stressorType: CRISIS }),
    ],
  ];

  it.each(withCrisis)("%s", async (_name, run) => {
    const seen = vi.fn();
    window.addEventListener("vetrate:crisis", seen);
    const result = await run();
    window.removeEventListener("vetrate:crisis", seen);

    expect(result.success).toBe(false);
    expect(result.crisisDetected).toBe(true);
    expect(result.content).toBeUndefined();
    expect(result.draftPath).toBeUndefined();
    expect(generateAI).not.toHaveBeenCalled();
    expect(seen).toHaveBeenCalledTimes(1);
  });
});

describe("identifiers stay out of the AI context (ADR-008)", () => {
  const named = {
    ...BUDDY,
    observations: "I see Jordan Faketon wake up shouting most nights",
    changesNoticed: "They stopped going to the weekly card game",
  };

  it("does not send a passage that names the veteran, and keeps it as typed", async () => {
    saveVeteranProfile({ firstName: "Jordan", lastName: "Faketon" });
    modelReplies((passages) => numbered(passages.map(reword)));
    const result = await enhanceBuddyStatement(named, "PTSD");

    const [prompt] = generateAI.mock.calls[0];
    expect(prompt).not.toMatch(/Jordan|Faketon/);
    expect(passagesIn(prompt)).toEqual([named.changesNoticed]);
    expect(result.draftPath).toBe("model");
    expect(result.passages).toMatchObject({
      sent: 1,
      accepted: 1,
      withheld: 1,
    });
    expect(result.content).toContain(
      "I see Jordan Faketon wake up shouting most nights.",
    );
    expect(result.content).toContain(reword(named.changesNoticed));
    expect(result.content).not.toMatch(/REDACTED/);
  });

  it("makes no call when every passage names the veteran", async () => {
    saveVeteranProfile({ firstName: "Jordan", lastName: "Faketon" });
    const result = await enhanceBuddyStatement(
      { ...BUDDY, observations: named.observations },
      "PTSD",
    );

    expect(generateAI).not.toHaveBeenCalled();
    expect(result.draftPath).toBe("template");
    expect(result.passages).toMatchObject({ sent: 0, withheld: 1 });
    expect(result.content).toContain("Jordan Faketon");
  });
});

describe("fixed text never comes back altered", () => {
  it("the nexus request keeps its greeting when a passage is reworded", async () => {
    modelReplies((passages) => numbered(passages.map(reword)));
    const result = await generateNexusLetterRequest(NEXUS);

    expect(result.draftPath).toBe("model");
    expect(result.content).toContain("Dear Doctor,");
    expect(result.content).toContain("[Veteran Name]");
    expect(result.content).not.toMatch(/REDACTED/);
  });

  it("a redaction marker in a rewording is rejected", async () => {
    modelReplies(
      () =>
        "1. To put it plainly, [REDACTED] were first high during my final year.",
    );
    const result = await generateNexusLetterRequest(NEXUS);

    expect(result.draftPath).toBe("template");
    expect(result.content).not.toMatch(/REDACTED/);
    expect(result.draftRejectReasons[0]).toMatch(/redaction marker/);
  });
});

describe("enhanceFormStatement", () => {
  it("prints the treatment answer as typed, without asking the model", async () => {
    const treated = await enhanceFormStatement("personal-statement", {
      conditionName: "Tinnitus",
      currentTreatment: "Hearing aids from a private audiologist",
    });
    expect(treated.content).toContain(
      "A. Current treatment:\nHearing aids from a private audiologist.",
    );
    expect(treated.content).not.toMatch(/from the VA|receiving treatment/);

    const none = await enhanceFormStatement("personal-statement", {
      conditionName: "Tinnitus",
      currentTreatment: "None right now",
    });
    expect(none.content).toContain("A. Current treatment:\nNone right now.");
    expect(none.content).not.toMatch(/receiving treatment/);
    expect(generateAI).not.toHaveBeenCalled();
  });

  it("sends the model the typed passages and nothing else the form holds", async () => {
    const formData = {
      witnessName: "Sam Placeholder",
      witnessPhone: "555-0100",
      witnessEmail: "sam@example.invalid",
      veteranName: "Jordan Placeholder",
      conditionName: "Migraines",
      witnessRelation: "coworker",
      knownSince: "since 2016",
      howKnown: "We worked the same line at the Placeholder plant",
      whatObserved: "Lights off at the desk, sunglasses indoors",
      whenObserved: "Spring 2022",
      whereObserved: "The Placeholder plant",
      workImpact: "Fewer shifts and no overtime",
      additionalInfo: "Happy to answer questions",
    };
    generateAI.mockResolvedValue({
      text: "1. They sat at the desk with the lights off and wore sunglasses indoors.",
      mode: "swarm",
    });
    const result = await enhanceFormStatement("buddy-statement", formData);

    const [prompt, options] = generateAI.mock.calls[0];
    expect(prompt).toContain("1. Lights off at the desk, sunglasses indoors");
    expect(prompt).not.toMatch(
      /Placeholder|555-0100|example\.invalid|2016|Spring 2022|Fewer shifts|Happy to answer/,
    );
    expect(options.toolId).toBe("buddy-statement");

    expect(result.draftPath).toBe("model");
    expect(result.content).toContain(
      "They sat at the desk with the lights off and wore sunglasses indoors.",
    );
    expect(result.content).toContain("Veteran's Full Name: Jordan Placeholder");
    expect(result.content).toContain("Contact Phone: 555-0100");
  });

  it("refuses a form with no wording step", async () => {
    expect(await enhanceFormStatement("intent-to-file", {})).toEqual({
      success: false,
      error: "Unsupported form type for AI enhancement",
    });
  });
});
