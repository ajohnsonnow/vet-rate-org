/**
 * The building blocks of the passage check: what a piece of model text is,
 * which facts it adds, and which it loses. The passage check itself is in
 * writerPassages.test.js. Every value below is invented for these tests.
 */
import { describe, it, expect } from "vitest";
import {
  classifyReplyKind,
  findMissingFacts,
  findNewFacts,
} from "../../utils/writerDraftCheck";

describe("classifyReplyKind", () => {
  it.each([
    [
      "refusal",
      "I cannot write a personal statement for you because you have not provided the specific facts regarding your service.",
    ],
    [
      "refusal",
      "I do not have access to your specific medical records or service history.",
    ],
    [
      "asks-for-information",
      "I can help you write a personal statement about your back. To make it accurate, please provide the following details: when the injury happened and what treatment you had.",
    ],
    [
      "asks-for-information",
      "Thank you for sharing this. When did the pain begin? Where were you stationed at the time? Who treated you afterwards?",
    ],
    [
      "advice",
      "A strong personal statement should include three parts. First, describe the event in service.",
    ],
    ["empty", "   "],
    ["rewording", "I startle at engine noise and I have broken sleep."],
  ])("%s", (kind, text) => {
    expect(classifyReplyKind(text)).toBe(kind);
  });

  it.each([
    "I cannot write for long periods because my hand cramps, and I cannot help my children with their homework the way I used to before the injury. I am unable to complete a full shift, and I cannot prepare meals without sitting down to rest every few minutes.",
    "I am unable to provide for my family the way I did before, and I can't build furniture any more, which was my trade for most of my working life. I won't drive at night because the glare makes the headaches worse.",
  ])("a veteran's own 'I cannot' sentences are not a refusal: %s", (text) => {
    expect(classifyReplyKind(text)).toBe("rewording");
  });
});

describe("findNewFacts", () => {
  const passage = "I fell from a cargo ramp during a night loading drill";
  const kinds = (text, options) =>
    findNewFacts(text, passage, options).map((fact) => fact.kind);

  it("finds nothing in the passage itself", () => {
    expect(findNewFacts(passage, passage, { prose: true })).toEqual([]);
  });

  it.each([
    ["number", "I fell 6 feet from a cargo ramp."],
    ["date", "I fell from a cargo ramp in October."],
    ["quantity", "I fell from a cargo ramp several years ago."],
    ["service", "I fell from a cargo ramp in the Navy."],
    ["diagnosis", "I fell from a cargo ramp and got sciatica."],
    ["attestation", "I certify that I fell from a cargo ramp."],
    ["name", "I fell from a cargo ramp with Dr. Okonkwo watching."],
  ])("a new %s", (kind, text) => {
    expect(kinds(text, { prose: true })).toContain(kind);
  });

  it("a 38 CFR citation is two new numbers", () => {
    expect(
      findNewFacts("I fell, see 38 CFR 3.303.", passage).map((f) => f.value),
    ).toEqual(expect.arrayContaining(["38", "303"]));
  });

  it("ignores numbered list markers", () => {
    expect(findNewFacts("1. First point.\n2. Second point.", "")).toEqual([]);
  });

  it("in a document, skips headings and sentence openings", () => {
    expect(
      findNewFacts(
        "Work History And Impact\nOkonkwo is not flagged at the start of a sentence here.",
        "",
      ).map((fact) => fact.kind),
    ).not.toContain("name");
  });

  it("in a passage, a name counts wherever it stands", () => {
    expect(
      findNewFacts("Okonkwo saw me fall", passage, { prose: true }),
    ).toContainEqual({ kind: "name", value: "Okonkwo" });
    expect(kinds("When I fell, my back hurt.", { prose: true })).not.toContain(
      "name",
    );
  });
});

describe("findMissingFacts", () => {
  const passage = "I sleep about 4 hours a night because of my Lumbar strain";

  it("finds nothing lost in a faithful rewording", () => {
    expect(
      findMissingFacts(
        "Because of my Lumbar strain, I sleep about 4 hours a night.",
        [passage],
        ["Lumbar strain"],
      ),
    ).toEqual([]);
  });

  it("reports a lost number, a lost phrase and lost wording", () => {
    const missing = findMissingFacts(
      "I am tired.",
      [passage],
      ["Lumbar strain"],
    );
    expect(missing).toContainEqual({ kind: "number", value: "4" });
    expect(missing).toContainEqual({ kind: "phrase", value: "Lumbar strain" });
    expect(missing.map((fact) => fact.kind)).toContain("wording");
  });
});
