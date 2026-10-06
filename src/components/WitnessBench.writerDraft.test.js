/**
 * A witness statement is the witness's own words, as typed. The Witness
 * Bench makes no model call to build it: a model rewording a witness's
 * note about the veteran made the witness the subject ("I turned off the
 * lights..."), which in a sworn statement is a false statement. A fragment
 * stays a fragment and the notice tells the witness to make it a sentence.
 * Fixture values are invented.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DRAFT_PATH } from "../utils/writerDraftCheck";

vi.mock("../utils/unifiedAIService", async (importOriginal) => ({
  ...(await importOriginal()),
  isAnyAIAvailable: () => true,
  getAIStatus: () => ({ statusText: "Local AI" }),
  generateAI: vi.fn(async () => ({
    text: "1. I turned off the lights at the desk.",
  })),
}));

const { generateAI } = await import("../utils/unifiedAIService");
const { WITNESS_DRAFT_NOTE } = await import("../utils/writerTemplates");
const { _compileWitnessStatement, _finishWitnessStatement } =
  await import("./WitnessBench.jsx");

const ANSWERS = {
  relationship_context: "I have worked beside the veteran since 2016.",
  q1: "Lights off at the desk, sunglasses indoors, head down on the bench",
  q2: "Fewer shifts and no overtime since the spring",
  q3: "3 March 2022 - left the line mid-shift, sick in the car park, driven home by me",
};

beforeEach(() => {
  generateAI.mockClear();
});

describe("WitnessBench._compileWitnessStatement", () => {
  it("makes no model call, with AI set up and every answer typed", () => {
    _compileWitnessStatement("coworker", "Migraines", ANSWERS);

    expect(generateAI).not.toHaveBeenCalled();
  });

  it("puts each answer in the statement exactly as typed, fragments included", () => {
    const { statement } = _compileWitnessStatement(
      "coworker",
      "Migraines",
      ANSWERS,
    );

    for (const answer of Object.values(ANSWERS)) {
      expect(statement.split(answer)).toHaveLength(2);
    }
    expect(statement).not.toMatch(
      /I turned off|I have had fewer|I left the line/,
    );
  });

  it("says nothing about AI and reports an app-built draft with nothing sent", () => {
    const result = _compileWitnessStatement("coworker", "Migraines", ANSWERS);

    expect(result.statement).not.toMatch(/\bAI\b/);
    expect(result.statement).toContain(
      "WITNESS ATTESTATION (read before you sign)",
    );
    expect(result.draftPath).toBe(DRAFT_PATH.TEMPLATE);
    expect(result.passages).toEqual({
      sent: 0,
      accepted: 0,
      unchanged: 0,
      rejected: 0,
    });
    expect(result.passageOutcomes).toEqual([]);
    expect(result.draftRejectReasons).toEqual([]);
  });

  it("tells the witness to read each line and make it a full sentence in their own words", () => {
    const { draftNote } = _compileWitnessStatement("coworker", "Migraines", {});

    expect(draftNote).toBe(WITNESS_DRAFT_NOTE);
    expect(draftNote).toMatch(/your own words/i);
    expect(draftNote).toMatch(/full sentence/i);
    expect(draftNote).not.toMatch(/\bAI\b/);
  });

  it("leaves a blank to fill in when nothing was typed", () => {
    const { statement } = _compileWitnessStatement("spouse", "PTSD", {});

    expect(statement).toContain(
      "[what you have personally seen or heard, with specific examples]",
    );
    expect(generateAI).not.toHaveBeenCalled();
  });
});

describe("WitnessBench._finishWitnessStatement", () => {
  const { statement } = _compileWitnessStatement("spouse", "PTSD", ANSWERS);

  it("fills in the names the witness and the app already hold, locally", () => {
    const finished = _finishWitnessStatement(statement, {
      veteranName: "Jordan Placeholder",
      witnessName: "Sam Example",
    });

    expect(finished).toContain("observations of Jordan Placeholder.");
    expect(finished).toContain("Sam Example");
    expect(finished).not.toContain("[Witness Printed Name]");
    expect(generateAI).not.toHaveBeenCalled();
  });

  it("leaves the blanks when a name is not known", () => {
    const finished = _finishWitnessStatement(statement, {});

    expect(finished).toContain("[Witness Printed Name]");
  });
});
