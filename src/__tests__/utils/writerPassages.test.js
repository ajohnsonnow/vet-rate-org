/**
 * Passage rewording: the model is offered only what someone typed, one
 * numbered passage at a time, and the app puts each accepted rewording back
 * in its place. Every value below is invented for these tests.
 */
import { describe, it, expect } from "vitest";
import {
  checkPassageRewrite,
  parsePassageReply,
  resolvePassageDraft,
  standardDraft,
} from "../../utils/writerDraftCheck";
import {
  STANDARD_DRAFT_NOTE,
  STANDARD_DRAFT_NOTE_NO_BLANKS,
  appealStatementPlan,
  buildPassagePrompt,
  buildPTSDStressorTemplate,
  nexusRequestPlan,
  personalStatementPlan,
  ptsdStatementPlan,
  selectPassages,
  standardDraftNote,
} from "../../utils/writerTemplates";

const FRAGMENT = "Startle at engine noise, Broken sleep.";
const SENTENCES = "I startle at engine noise and I have broken sleep.";

describe("parsePassageReply", () => {
  it("reads each passage under its number", () => {
    expect(parsePassageReply("1. First one.\n2. Second one.", 2)).toEqual([
      "First one.",
      "Second one.",
    ]);
  });

  it("ignores chatter before the first number and after a blank line", () => {
    expect(
      parsePassageReply(
        "Here are the rewritten passages:\n\n**1.** First one.\n\n2) Second one.\n\nLet me know if you want changes.",
        2,
      ),
    ).toEqual(["First one.", "Second one."]);
  });

  it("joins a passage that runs over several lines", () => {
    expect(
      parsePassageReply("1. First line\nsecond line.\n2. Other.", 2),
    ).toEqual(["First line second line.", "Other."]);
  });

  it("leaves a missing number empty and ignores numbers it did not ask for", () => {
    expect(parsePassageReply("2. Second.\n7. Extra.", 2)).toEqual([
      null,
      "Second. 7. Extra.",
    ]);
    expect(parsePassageReply("", 2)).toEqual([null, null]);
  });

  it("takes an unnumbered reply to a single passage", () => {
    expect(parsePassageReply('"I startle at engine noise."', 1)).toEqual([
      "I startle at engine noise.",
    ]);
  });
});

describe("checkPassageRewrite accepts", () => {
  it("fragments made into sentences that say only that", () => {
    expect(
      checkPassageRewrite({ original: FRAGMENT, rewrite: SENTENCES }),
    ).toEqual({ status: "accepted", text: SENTENCES, reasons: [] });
  });

  it("a tidier sentence that keeps its numbers", () => {
    const result = checkPassageRewrite({
      original: "miss about 2 shifts a month at the warehouse cause of my back",
      rewrite:
        "I miss about 2 shifts a month at the warehouse because of my back.",
    });
    expect(result.status).toBe("accepted");
  });
});

describe("checkPassageRewrite reports an echo as unchanged", () => {
  it.each([
    FRAGMENT,
    "startle at engine noise, broken sleep",
    `  ${FRAGMENT}  `,
  ])("%s", (rewrite) => {
    expect(checkPassageRewrite({ original: FRAGMENT, rewrite })).toEqual({
      status: "unchanged",
      text: FRAGMENT,
      reasons: [],
    });
  });
});

describe("checkPassageRewrite rejects, and keeps the writer's words", () => {
  const original =
    "I miss about two shifts a month and I stopped coaching my nephew's team";
  const base =
    "I miss about two shifts a month, and I stopped coaching my nephew's team";

  it.each([
    ["a new number", `${base} in 2019.`, /number "2019"/],
    ["a new date", `${base} last October.`, /date "October"/],
    ["a new counted quantity", `${base} for several years.`, /quantity/],
    ["a new service detail", `${base} after my deployment.`, /service/],
    ["a new diagnosis", `${base} because of my sciatica.`, /diagnosis/],
    ["a new name mid-sentence", `${base} with Coach Okonkwo.`, /name/],
    [
      "a new name opening a sentence",
      `${base}. Okonkwo took over the team.`,
      /name "Okonkwo"/,
    ],
    [
      "certification wording",
      `${base}. I certify this is true and correct.`,
      /attestation/,
    ],
    [
      "an invented fact inside brackets",
      `${base} [at Camp Placeholder].`,
      /adds bracketed text \[at Camp Placeholder\]/,
    ],
    [
      "a blank of its own",
      `${base} since [date].`,
      /adds bracketed text \[date\]/,
    ],
    [
      "a redaction marker",
      "I miss about two shifts a month and I stopped coaching [REDACTED]'s team.",
      /redaction marker/,
    ],
    ["a lost number word", "I miss shifts and stopped coaching.", /drops/],
    [
      "a refusal",
      "I cannot write this statement for you without more facts.",
      /not a rewording: refusal/,
    ],
    [
      "a request for information",
      "Please provide more details about the shifts you missed.",
      /not a rewording: asks-for-information/,
    ],
    [
      "an invented account",
      `${base}. Afterwards supervisors reassigned duties, colleagues noticed constant grimacing, and sleeping became nearly impossible without medication, heating pads and stretching routines.`,
      /longer than the passage|main words are new/,
    ],
    ["nothing", "", /no rewording returned/],
  ])("%s", (_what, rewrite, reason) => {
    const result = checkPassageRewrite({ original, rewrite });
    expect(result.status).toBe("rejected");
    expect(result.text).toBe(original);
    expect(result.reasons.join("; ")).toMatch(reason);
  });
});

describe("checkPassageRewrite rejects a lost fact", () => {
  it("a supplied number that disappears", () => {
    const result = checkPassageRewrite({
      original: "I sleep about 4 hours a night",
      rewrite: "I sleep only a few hours each night.",
    });
    expect(result.reasons.join("; ")).toMatch(/number "4"/);
  });

  it("a condition name the passage had", () => {
    const result = checkPassageRewrite({
      original: "My Lumbar strain flares when I lift boxes at work",
      rewrite: "My back problem flares when I lift boxes at work.",
      keep: ["Lumbar strain", "PTSD"],
    });
    expect(result.reasons.join("; ")).toMatch(/phrase "Lumbar strain"/);
    expect(result.reasons.join("; ")).not.toMatch(/PTSD/);
  });

  it("keeps brackets the writer typed", () => {
    expect(
      checkPassageRewrite({
        original: "pain is worse [see my log] on work days at the depot",
        rewrite: "My pain is worse [see my log] on work days at the depot.",
      }).status,
    ).toBe("accepted");
  });
});

describe("selectPassages", () => {
  it("offers only answered free text that the draft prints", () => {
    const plan = ptsdStatementPlan({
      stressorType: "Training accident on the range",
      eventDescription: "A vehicle rolled over beside me on the range",
      currentSymptoms: FRAGMENT,
      dailyImpact: "None",
      immediateImpact: "   ",
    });
    expect(selectPassages(plan)).toEqual([
      {
        key: "eventDescription",
        text: "A vehicle rolled over beside me on the range",
      },
      { key: "currentSymptoms", text: FRAGMENT },
    ]);
  });

  it("does not offer text the lane keeps out of the draft", () => {
    const plan = appealStatementPlan({
      appealType: "hlr",
      whyIncorrect: "The decision did not consider my headache log",
      newEvidence: "A note from my employer I have not sent yet",
    });
    expect(selectPassages(plan).map((p) => p.key)).toEqual(["whyIncorrect"]);
  });

  it("finds nothing in a form with no free text", () => {
    expect(
      selectPassages(
        personalStatementPlan(
          { symptomOnsetDate: "March 2011", hasTreatment: "no" },
          "Tinnitus",
        ),
      ),
    ).toEqual([]);
  });
});

describe("buildPassagePrompt", () => {
  it("numbers the passages and sends nothing else of the draft", () => {
    const prompt = buildPassagePrompt([FRAGMENT, "Second passage here"]);
    expect(prompt).toContain(`1. ${FRAGMENT}\n2. Second passage here`);
    expect(prompt).toMatch(/Say only what the passage says/);
    expect(prompt).not.toMatch(/VA Form|Dear|\[/);
  });

  it("tells the model a fragment must become a full sentence", () => {
    const prompt = buildPassagePrompt([FRAGMENT]);
    expect(prompt).toContain(
      "A passage that is not a full sentence (a list, a phrase with no subject or no verb) must be rewritten as one or more full sentences beginning with its subject",
    );
    expect(prompt).toContain(
      "Return a passage unchanged only if every part of it is already a full sentence.",
    );
    expect(prompt).not.toMatch(/already clear, complete sentences/);
  });

  it("has no instruction for a witness: a witness's words are never sent", () => {
    const prompt = buildPassagePrompt([FRAGMENT]);
    expect(prompt).not.toMatch(/witness|"they" for the person/);
    for (const plan of [
      ptsdStatementPlan({}),
      personalStatementPlan({}, "Tinnitus"),
      appealStatementPlan({}),
      nexusRequestPlan({}),
    ]) {
      expect(plan).not.toHaveProperty("voice");
    }
  });

  it('gives a veteran\'s own statement "I" as the subject', () => {
    const prompt = buildPassagePrompt([FRAGMENT]);
    expect(prompt).toContain('beginning with its subject, for example "I".');
  });
});

describe("resolvePassageDraft", () => {
  const answers = {
    stressorType: "Training accident",
    eventDescription: "A vehicle rolled over beside me on the range",
    currentSymptoms: FRAGMENT,
  };
  const plan = ptsdStatementPlan(answers);
  const sent = selectPassages(plan);
  const template = buildPTSDStressorTemplate(answers);

  it("places an accepted rewording in its slot and touches nothing else", () => {
    const result = resolvePassageDraft({
      plan,
      sent,
      reply: `1. A vehicle rolled over beside me on the range.\n2. ${SENTENCES}`,
    });
    expect(result.draftPath).toBe("model");
    expect(result.draftNote).toBeNull();
    expect(result.passages).toEqual({
      sent: 2,
      accepted: 1,
      unchanged: 1,
      rejected: 0,
    });
    expect(result.content).toBe(template.replace(FRAGMENT, SENTENCES));
  });

  it("keeps the writer's words for a rejected passage and says why", () => {
    const result = resolvePassageDraft({
      plan,
      sent,
      reply: `1. In 2009 a Humvee rolled over beside me at Camp Lejeune.\n2. ${SENTENCES}`,
    });
    expect(result.draftPath).toBe("model");
    expect(result.passages).toMatchObject({ accepted: 1, rejected: 1 });
    expect(result.draftRejectReasons).toHaveLength(1);
    expect(result.draftRejectReasons[0]).toMatch(/^passage 1: adds .*2009/);
    expect(result.content).toContain(
      "A vehicle rolled over beside me on the range.",
    );
    expect(result.content).not.toMatch(/2009|Lejeune|Humvee/);
  });

  it.each([
    [
      "every passage came back unchanged",
      `1. ${answers.eventDescription}\n2. ${FRAGMENT}`,
      { unchanged: 2, rejected: 0 },
    ],
    [
      "every rewording was rejected",
      "I need more details before I can help.",
      { unchanged: 0, rejected: 2 },
    ],
  ])(
    "returns the app draft with no AI claim when %s",
    (_why, reply, counts) => {
      const result = resolvePassageDraft({ plan, sent, reply });
      expect(result).toMatchObject({
        content: template,
        draftPath: "template",
        draftNote: STANDARD_DRAFT_NOTE,
        passages: { sent: 2, accepted: 0, ...counts },
      });
    },
  );
});

describe("fixed text never changes, whatever the model returns", () => {
  it("a nexus request keeps its greeting, standard of proof and closing", () => {
    const answers = {
      conditionName: "Sleep apnea",
      primaryCondition: "PTSD",
      connectionTheory:
        "nightmares wake me, stop breathing more often those nights",
    };
    const plan = nexusRequestPlan(answers);
    const sent = selectPassages(plan);
    const reworded =
      "Nightmares wake me, and I stop breathing more often on those nights.";
    const result = resolvePassageDraft({ plan, sent, reply: `1. ${reworded}` });

    expect(result.draftPath).toBe("model");
    expect(result.content).toBe(
      plan.build(answers).replace(`${answers.connectionTheory}.`, reworded),
    );
    expect(result.content).toContain("Dear Doctor,");
    expect(result.content).not.toMatch(/REDACTED/);
  });
});

describe("standardDraft", () => {
  it("says there are blanks only when there are", () => {
    expect(standardDraftNote("Fill in [this].")).toBe(STANDARD_DRAFT_NOTE);
    expect(standardDraftNote("Nothing to fill in.")).toBe(
      STANDARD_DRAFT_NOTE_NO_BLANKS,
    );
  });

  it("is the app draft with no passages counted", () => {
    const plan = ptsdStatementPlan({});
    expect(standardDraft(plan)).toEqual({
      content: buildPTSDStressorTemplate({}),
      draftPath: "template",
      draftNote: STANDARD_DRAFT_NOTE,
      draftRejectReasons: [],
      passages: { sent: 0, accepted: 0, unchanged: 0, rejected: 0 },
      passageOutcomes: [],
    });
  });
});

describe("rewordings the real model produced (Witness Bench, t04)", () => {
  const original =
    "They leave the room when the fireworks start and do not come back for the evening.";

  it("accepts a change of verb and word order that keeps 'they'", () => {
    const rewrite =
      "When the fireworks start, they leave the room and do not return for the evening.";
    expect(checkPassageRewrite({ original, rewrite })).toEqual({
      status: "accepted",
      text: rewrite,
      reasons: [],
    });
  });

  it.each([
    "The veteran leaves the room when the fireworks start and does not return for the evening.",
    "When fireworks start, the veteran leaves the room and does not return for the evening.",
  ])(
    "rejects 'they' turned into 'the veteran', and for that alone: %s",
    (rewrite) => {
      expect(checkPassageRewrite({ original, rewrite })).toEqual({
        status: "rejected",
        text: original,
        reasons: [
          'refers to people differently from the passage: "they" is gone, "veteran" is new',
        ],
      });
    },
  );

  it.each([
    [
      "a different place and a new act",
      "The veteran leaves the house when the fireworks start and sleeps in the garage for the evening.",
    ],
    [
      "an added cause",
      "The veteran leaves the room when the fireworks start because the explosions remind them of mortar attacks, and does not return for the evening.",
    ],
    ["a dropped half", "The veteran leaves the room when the fireworks start."],
  ])("still rejects %s", (_what, rewrite) => {
    expect(checkPassageRewrite({ original, rewrite }).status).toBe("rejected");
  });
});

describe("parsePassageReply with no numbers", () => {
  it("takes one line per passage, in order, when the count matches", () => {
    expect(
      parsePassageReply(
        "I see them wake up shouting several nights a week.\nThey used to host game nights.",
        2,
      ),
    ).toEqual([
      "I see them wake up shouting several nights a week.",
      "They used to host game nights.",
    ]);
  });

  it("does not guess when the line count does not match", () => {
    expect(
      parsePassageReply("I need more details before I can help.", 2),
    ).toEqual([null, null]);
    expect(parsePassageReply("One.\nTwo.\nThree.", 2)).toEqual([null, null]);
  });
});

describe("resolvePassageDraft records each passage", () => {
  it("before, after, verdict and reasons, in the order sent", () => {
    const plan = ptsdStatementPlan({
      eventDescription: "A vehicle rolled over beside me on the range",
      currentSymptoms: FRAGMENT,
    });
    const result = resolvePassageDraft({
      plan,
      sent: selectPassages(plan),
      reply: `1. In 2009 a vehicle rolled over beside me on the range.\n2. ${SENTENCES}`,
    });
    expect(result.passageOutcomes).toEqual([
      {
        number: 1,
        before: "A vehicle rolled over beside me on the range",
        after: "In 2009 a vehicle rolled over beside me on the range.",
        verdict: "rejected",
        reasons: ['adds number "2009"'],
      },
      {
        number: 2,
        before: FRAGMENT,
        after: SENTENCES,
        verdict: "accepted",
        reasons: [],
      },
    ]);
    expect(standardDraft(plan).passageOutcomes).toEqual([]);
  });
});

describe("a rewording refers to people the way its passage does", () => {
  const reject = (args) => {
    const result = checkPassageRewrite(args);
    expect(result.status).toBe("rejected");
    expect(result.text).toBe(args.original);
    return result.reasons.join("; ");
  };

  it.each([
    [
      "They check the door locks three or four times before bed.",
      "The veteran checks the door locks three or four times before bed.",
    ],
    [
      "They no longer drive at night, so I do all of the evening driving.",
      "The veteran no longer drives at night, so I perform all of the evening driving.",
    ],
    [
      "They leave the room when the fireworks start and do not come back for the evening.",
      "When fireworks start, the veteran leaves the room and does not return for the evening.",
    ],
  ])("rejects a pronoun replaced by a noun: %s", (original, rewrite) => {
    expect(reject({ original, rewrite })).toMatch(
      /refers to people differently/,
    );
  });

  it("rejects a noun replaced by a pronoun", () => {
    expect(
      reject({
        original:
          "The veteran checks the door locks three or four times before bed",
        rewrite: "They check the door locks three or four times before bed.",
      }),
    ).toMatch(/refers to people differently/);
  });

  it("rejects one pronoun swapped for another", () => {
    expect(
      reject({
        original: "They leave the room when the fireworks start",
        rewrite: "He leaves the room when the fireworks start.",
      }),
    ).toMatch(/refers to people differently/);
  });

  it("rejects first person turned into third, and the reverse", () => {
    expect(
      reject({
        original: "I miss about two shifts a month at the warehouse",
        rewrite: "They miss about two shifts a month at the warehouse.",
      }),
    ).toMatch(/refers to people differently/);
    expect(
      reject({
        original: "They miss about two shifts a month at the warehouse",
        rewrite: "I miss about two shifts a month at the warehouse.",
      }),
    ).toMatch(/refers to people differently/);
  });

  it("rejects a veteran's own fragment turned into third person", () => {
    expect(
      reject({
        original: FRAGMENT,
        rewrite: "They startle at engine noise and have broken sleep.",
      }),
    ).toMatch(/refers to people differently/);
  });
});

describe("a rewording that keeps the passage's way of referring to people", () => {
  it("lets a fragment with no subject take the writer's own", () => {
    expect(
      checkPassageRewrite({
        original: FRAGMENT,
        rewrite: SENTENCES,
      }).status,
    ).toBe("accepted");
    expect(
      checkPassageRewrite({
        original:
          "Lights off at the desk, sunglasses indoors, head down on the bench",
        rewrite:
          "They keep the lights off at the desk, wear sunglasses indoors and put their head down on the bench.",
      }).status,
    ).toBe("rejected");
  });

  it("accepts a rewording that keeps every pronoun the writer used", () => {
    expect(
      checkPassageRewrite({
        original:
          "They leave the room when the fireworks start and do not come back for the evening.",
        rewrite:
          "When the fireworks start, they leave the room and do not return for the evening.",
      }).status,
    ).toBe("accepted");
    expect(
      checkPassageRewrite({
        original: "I see them wake up shouting several nights a week",
        rewrite: "Several nights a week, I see them wake up shouting.",
      }).status,
    ).toBe("accepted");
  });

  it("the request tells the model to keep the writer's pronouns", () => {
    expect(buildPassagePrompt([FRAGMENT])).toContain(
      'Keep "I", "they", "he" and "she" exactly as the writer used them. Do not replace one with a name or with a description such as "the veteran", or the other way round.',
    );
  });
});
