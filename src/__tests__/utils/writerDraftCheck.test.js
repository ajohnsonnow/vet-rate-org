import { describe, it, expect } from "vitest";
import {
  DRAFT_PATH,
  checkWriterDraft,
  classifyDraftKind,
  extractDraft,
  findNewFacts,
  resolveWriterDraft,
} from "../../utils/writerDraftCheck";
import {
  STANDARD_DRAFT_NOTE,
  buildNexusLetterRequestTemplate,
  buildPersonalStatementTemplate,
} from "../../utils/writerTemplates";

// Every value below is invented for these tests.
const ANSWERS = {
  inServiceEvent: "I fell from a cargo ramp during a night loading drill",
  specificExamples: "I cannot stand at the sink long enough to wash dishes",
  workImpact: "I miss about two shifts a month",
  socialImpact: "I stopped coaching my nephew's team",
  hasTreatment: "yes-private",
};
const CONDITION = "Lumbar strain";
const TEMPLATE = buildPersonalStatementTemplate(ANSWERS, CONDITION);
const INPUTS = [
  ANSWERS.inServiceEvent,
  ANSWERS.specificExamples,
  ANSWERS.workImpact,
  ANSWERS.socialImpact,
];

const REWORDED = `PERSONAL STATEMENT IN SUPPORT OF CLAIM (VA Form 21-4138)

I am submitting this statement in support of my claim for service connection for Lumbar strain.

What happened in service
During a night loading drill, I fell from a cargo ramp.

My symptoms now
Because of this condition, I cannot stand at the sink long enough to wash dishes.
Effect on my work: I miss about two shifts a month because of the pain.
Effect on my family and social life: I stopped coaching my nephew's team.
I am currently receiving treatment from a private provider.

How this connects to my service
My symptoms began [date the symptoms began] and have continued ever since.

I respectfully request a Compensation and Pension (C&P) examination to evaluate this condition and its connection to my service.`;

const check = (output, overrides = {}) =>
  checkWriterDraft({
    output,
    template: TEMPLATE,
    inputs: INPUTS,
    keep: [CONDITION],
    ...overrides,
  });

describe("checkWriterDraft accepts a faithful rewording", () => {
  it("accepts the app-built draft itself", () => {
    expect(check(TEMPLATE)).toMatchObject({ accepted: true, reasons: [] });
  });

  it("accepts reworded sentences that keep facts and blanks", () => {
    expect(check(REWORDED)).toMatchObject({ accepted: true, kind: "draft" });
  });

  it("accepts it with the chatter models put around a draft, and drops the chatter", () => {
    const result = check(
      `Certainly! Here is the improved draft:\n\n---\n\n${REWORDED}\n\n---\n\nLet me know if you would like any changes.`,
    );
    expect(result.accepted).toBe(true);
    expect(result.draft).toBe(REWORDED);
  });
});

describe("checkWriterDraft rejects what is not a draft", () => {
  it.each([
    [
      "refusal",
      "I cannot write a personal statement for you because you have not provided the specific facts regarding your service. Per the rules I must rely only on what you entered, and nothing was entered that I can use here.",
    ],
    [
      "asks-for-information",
      "I can help you write a personal statement about your back. To make it accurate, please provide the following details: when the injury happened, what treatment you had, and how it affects your work today.",
    ],
    [
      "advice",
      "A strong personal statement should include three parts. First, describe the event in service. Second, describe the symptoms today. Third, explain how the two connect and how daily life is affected by the condition.",
    ],
    ["empty", "Draft follows."],
  ])("%s", (kind, output) => {
    const result = check(output, { template: "" });
    expect(result).toMatchObject({ accepted: false, kind });
    expect(result.reasons).toEqual([`not a draft: ${kind}`]);
  });

  it("three questions to the veteran are a request for information", () => {
    expect(
      classifyDraftKind(
        "Thank you for sharing this with me today, it helps a great deal. When did the pain begin? Where were you stationed at the time? Who treated you afterwards, and for how long did that go on?",
      ),
    ).toBe("asks-for-information");
  });

  it("an answer much shorter than the app-built draft is empty", () => {
    expect(check("I fell from a cargo ramp.").kind).toBe("empty");
  });
});

describe("checkWriterDraft rejects invented facts", () => {
  it.each([
    ["number", "I miss about two shifts a month", "I miss 6 shifts a month"],
    [
      "date",
      "[date the symptoms began] and",
      "[date the symptoms began], around October, and",
    ],
    [
      "quantity",
      "have continued ever since",
      "have continued for several years",
    ],
    [
      "service",
      "During a night loading drill",
      "During a night loading drill in the Navy",
    ],
    ["diagnosis", "because of the pain", "because of the pain and my sciatica"],
    ["name", "from a private provider", "from a private provider, Dr. Okonkwo"],
  ])("a new %s", (kind, from, to) => {
    expect(REWORDED).toContain(from);
    const result = check(REWORDED.replace(from, to));
    expect(result.accepted).toBe(false);
    expect(result.newFacts.map((fact) => fact.kind)).toContain(kind);
  });

  it("a new 38 CFR citation is a new number", () => {
    const result = check(
      REWORDED.replace(
        "to evaluate this condition",
        "under 38 CFR § 3.303 to evaluate this condition",
      ),
    );
    expect(result.newFacts.map((fact) => fact.value)).toEqual(
      expect.arrayContaining(["38", "303"]),
    );
  });

  it("an invented account with no number or name is new material", () => {
    const invented = REWORDED.replace(
      "During a night loading drill, I fell from a cargo ramp.",
      "During a night loading drill, I fell from a cargo ramp. Medics rushed over immediately, strapped me onto a stretcher, carried me toward the clinic, and physicians ordered scans, prescribed painkillers, scheduled rehabilitation, and warned that lifting heavy equipment again might permanently worsen everything. Afterwards my sergeant reassigned me toward administrative duties, colleagues noticed constant grimacing, and sleeping became nearly impossible without medication, heating pads, stretching routines, and frequent repositioning throughout each exhausting evening.",
    );
    const result = check(invented);
    expect(result.accepted).toBe(false);
    expect(result.newMaterial.join(" ")).toMatch(/wording is new|the length/);
  });

  it("ignores numbered list markers and bracketed blanks", () => {
    expect(
      findNewFacts(
        "1. First point.\n2. Second point about [Date] and [Unit 4].",
        "",
      ),
    ).toEqual([]);
  });

  it("ignores title-case headings and bold labels", () => {
    expect(
      findNewFacts(
        "**Current Symptoms:** the pain is constant.\n\nWork History And Impact\nthe pain is constant, and it limits my work.",
        "",
      ),
    ).toEqual([]);
  });
});

describe("checkWriterDraft rejects lost facts and lost blanks", () => {
  it("a supplied number that disappears", () => {
    const result = checkWriterDraft({
      output: REWORDED.replace("Lumbar strain.", "my lower back."),
      template: TEMPLATE.replace("Lumbar strain.", "Lumbar strain since 2011."),
      inputs: [...INPUTS, "2011"],
    });
    expect(result.missingFacts).toContainEqual({
      kind: "number",
      value: "2011",
    });
  });

  it("a condition name that disappears", () => {
    const result = check(REWORDED.replace("Lumbar strain", "my back problem"));
    expect(result.accepted).toBe(false);
    expect(result.missingFacts).toContainEqual({
      kind: "phrase",
      value: CONDITION,
    });
  });

  it("supplied wording that is mostly replaced", () => {
    const result = check(
      REWORDED.replace(
        "During a night loading drill, I fell from a cargo ramp.",
        "I was hurt.",
      )
        .replace(
          "I cannot stand at the sink long enough to wash dishes",
          "chores are hard",
        )
        .replace("I miss about two shifts a month", "I am absent sometimes")
        .replace("I stopped coaching my nephew's team", "I do less"),
    );
    expect(result.accepted).toBe(false);
    expect(result.missingFacts.map((fact) => fact.kind)).toContain("wording");
  });

  it("a blank the model filled in or deleted", () => {
    const result = check(
      REWORDED.replace("[date the symptoms began]", "during my service"),
    );
    expect(result.accepted).toBe(false);
    expect(result.missingPlaceholders).toEqual(["[date the symptoms began]"]);
  });
});

describe("a document addressed to its reader", () => {
  const answers = {
    conditionName: "Hypertension",
    inServiceEvent: "Readings were first high during my final year",
  };
  const template = buildNexusLetterRequestTemplate(answers);
  const reworded = template
    .replace(
      "the letter should say whether",
      "your letter should include a statement on whether",
    )
    .replace(
      "Thank you for considering this request.",
      "Could you please provide this opinion in writing? Thank you for considering this request.",
    );
  const args = {
    output: reworded,
    template,
    inputs: [answers.inServiceEvent],
    keep: [answers.conditionName],
  };

  it("is not mistaken for advice or a request to the veteran", () => {
    expect(
      checkWriterDraft({ ...args, addressedToReader: true }),
    ).toMatchObject({ accepted: true });
    expect(checkWriterDraft(args).kind).toBe("asks-for-information");
  });

  it("is still rejected when it refuses", () => {
    expect(
      checkWriterDraft({
        ...args,
        addressedToReader: true,
        output: `I cannot generate a nexus letter for you. ${reworded}`,
      }).kind,
    ).toBe("refusal");
  });
});

describe("extractDraft", () => {
  it("unwraps a code fence", () => {
    expect(extractDraft("```\nBody line.\n```")).toBe("Body line.");
  });

  it("keeps a body paragraph that merely starts like a remark", () => {
    const body =
      "Note the date of the fall.\n\nI fell from a cargo ramp.\n\nI request an examination.";
    expect(extractDraft(body)).toBe(body);
  });
});

describe("resolveWriterDraft", () => {
  it("returns the model's wording and records the model path", () => {
    expect(
      resolveWriterDraft({
        output: REWORDED,
        template: TEMPLATE,
        inputs: INPUTS,
        keep: [CONDITION],
      }),
    ).toEqual({
      content: REWORDED,
      draftPath: DRAFT_PATH.MODEL,
      draftNote: null,
      draftRejectReasons: [],
    });
  });

  it("returns the app-built draft with the one-line note otherwise", () => {
    const result = resolveWriterDraft({
      output: "Please provide more details about your injury.",
      template: TEMPLATE,
      inputs: INPUTS,
      keep: [CONDITION],
    });
    expect(result).toMatchObject({
      content: TEMPLATE,
      draftPath: DRAFT_PATH.TEMPLATE,
      draftNote: STANDARD_DRAFT_NOTE,
    });
    expect(result.draftRejectReasons.length).toBeGreaterThan(0);
  });

  it("returns the caller's fuller standard draft when one is given", () => {
    expect(
      resolveWriterDraft({
        output: "",
        template: TEMPLATE,
        fallback: `${TEMPLATE}\n\nSignature: ______`,
      }).content,
    ).toContain("Signature: ______");
  });
});

describe("a veteran's own 'I cannot' sentences are not refusals", () => {
  it.each([
    "I cannot write for long periods because my hand cramps, and I cannot help my children with their homework the way I used to before the injury. I am unable to complete a full shift, and I cannot prepare meals without sitting down to rest every few minutes.",
    "I am unable to provide for my family the way I did before, and I can't build furniture any more, which was my trade for most of my working life. I won't drive at night because the glare makes the headaches worse.",
  ])("%s", (statement) => {
    expect(classifyDraftKind(statement)).toBe("draft");
  });
});

describe("reference text", () => {
  it("may be drawn on without counting as an invented fact", () => {
    const withPlace = REWORDED.replace(
      "During a night loading drill",
      "During a night loading drill at Camp Placeholder",
    );
    expect(check(withPlace).accepted).toBe(false);
    expect(
      check(withPlace, { reference: ["Stationed at Camp Placeholder."] })
        .accepted,
    ).toBe(true);
  });
});

describe("certification wording", () => {
  it("is rejected when the app-built draft has none", () => {
    const result = check(
      `${REWORDED}\n\nI certify that the above is true and correct.`,
    );
    expect(result.accepted).toBe(false);
    expect(result.newFacts.map((fact) => fact.kind)).toContain("attestation");
  });
});
