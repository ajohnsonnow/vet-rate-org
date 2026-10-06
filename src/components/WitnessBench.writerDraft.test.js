/**
 * Witness Bench offers the model only the witness's own answers, one
 * numbered passage each, and puts each accepted rewording back into its
 * standard statement. Fixture values are invented for these tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  STANDARD_DRAFT_NOTE,
  buildPassagePrompt,
} from "../utils/writerTemplates";

vi.mock("../utils/unifiedAIService", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isAnyAIAvailable: () => true,
    getAIStatus: () => ({ statusText: "Local AI" }),
    generateAI: vi.fn(),
  };
});
const { generateAI } = await import("../utils/unifiedAIService");
const { _compileStatementWithAI, _finishWitnessStatement } =
  await import("./WitnessBench.jsx");

const ANSWERS = {
  relationship_context: "I have been married to the veteran since 2012.",
  q1: "leave the room when fireworks start, dont come back all evening",
  q2: "They no longer drive at night.",
  q3: "   ",
};
const TYPED = [ANSWERS.relationship_context, ANSWERS.q1, ANSWERS.q2];
const Q1_REWORDED =
  "They leave the room when fireworks start and do not come back all evening.";

const reply = (passages) =>
  passages.map((passage, i) => `${i + 1}. ${passage}`).join("\n");
const compile = () => _compileStatementWithAI("spouse", "PTSD", ANSWERS);

beforeEach(() => {
  generateAI.mockReset();
});

describe("WitnessBench._compileStatementWithAI", () => {
  it("sends the witness's answers as numbered passages and nothing else", async () => {
    generateAI.mockResolvedValue({ text: reply(TYPED) });
    await compile();

    const [prompt, options] = generateAI.mock.calls[0];
    expect(prompt).toBe(buildPassagePrompt(TYPED));
    expect(prompt).not.toMatch(/VA FORM|Witness Type|ATTESTATION|\[Veteran\]/);
    expect(options).toMatchObject({
      toolId: "buddy-statement",
      dataClass: "context",
    });
  });

  it("puts an accepted rewording in its answer's place in the standard statement", async () => {
    generateAI.mockResolvedValue({
      text: reply([TYPED[0], Q1_REWORDED, TYPED[2]]),
    });
    const result = await compile();

    expect(result.draftPath).toBe("model");
    expect(result.draftNote).toBeNull();
    expect(result.passages).toEqual({
      sent: 3,
      accepted: 1,
      unchanged: 2,
      rejected: 0,
    });
    expect(result.statement).toContain(Q1_REWORDED);
    expect(result.statement).not.toContain(ANSWERS.q1);
    expect(result.statement).toContain("Witness Type: Spouse / Partner");
    expect(result.statement).toContain("[Veteran]'s PTSD");
    expect(result.statement).toContain(
      "WITNESS ATTESTATION (read before you sign)",
    );
    expect(result.statement).toContain("18 U.S.C. § 1001");
    expect(result.statement).toContain(
      "The wording of some passages in this statement was suggested by AI. Review each one: it is your statement.",
    );
    expect(result.statement).not.toMatch(/drafted with AI/i);
  });

  it("returns the standard statement, with no AI claim, when the model only echoes", async () => {
    generateAI.mockResolvedValue({ text: reply(TYPED) });
    const result = await compile();

    expect(result.draftPath).toBe("template");
    expect(result.draftNote).toBe(STANDARD_DRAFT_NOTE);
    expect(result.passages).toMatchObject({ accepted: 0, unchanged: 3 });
    expect(result.statement).toContain(ANSWERS.q1);
    expect(result.statement).not.toMatch(/\bAI\b/);
  });

  it("returns the standard statement when the model refuses", async () => {
    generateAI.mockResolvedValue({
      text: "I cannot draft a buddy statement because you have not provided the specific details of the incident.",
    });
    const result = await compile();

    expect(result.draftPath).toBe("template");
    expect(result.passages).toMatchObject({ accepted: 0, rejected: 3 });
    expect(result.statement).toContain(ANSWERS.q1);
    expect(result.statement).not.toMatch(/cannot draft/);
  });

  it("keeps the witness's words where a rewording adds an attestation or a fact", async () => {
    generateAI.mockResolvedValue({
      text: reply([
        TYPED[0],
        `${Q1_REWORDED} I certify that this is true and correct.`,
        "They stopped driving at night in 2019.",
      ]),
    });
    const result = await compile();

    expect(result.draftPath).toBe("template");
    expect(result.draftRejectReasons.join(" | ")).toMatch(
      /passage 2: .*attestation.*\| passage 3: .*2019/,
    );
    expect(result.statement).toContain(ANSWERS.q1);
    expect(result.statement).not.toMatch(/I certify that this|2019/);
  });
});

describe("WitnessBench._compileStatementWithAI with nothing typed", () => {
  it("makes no model call when the witness answered nothing", async () => {
    const result = await _compileStatementWithAI("spouse", "PTSD", {});

    expect(generateAI).not.toHaveBeenCalled();
    expect(result.draftPath).toBe("template");
    expect(result.statement).toContain(
      "[what you have personally seen or heard, with specific examples]",
    );
  });
});

describe("WitnessBench._compileStatementWithAI when the model cannot answer", () => {
  it("returns the standard statement and names the engine error", async () => {
    generateAI.mockRejectedValue(new Error("WebGPU inference timed out"));
    const result = await compile();

    expect(result).toMatchObject({
      draftPath: "template",
      draftNote: STANDARD_DRAFT_NOTE,
      draftRejectReasons: [],
      draftErrorReason: "WebGPU inference timed out",
      passages: { sent: 3, accepted: 0 },
    });
    expect(result.statement).toContain(ANSWERS.q2);
    expect(result.statement).toContain(
      "WITNESS ATTESTATION (read before you sign)",
    );
    expect(result.statement).not.toMatch(/\bAI\b/);
  });
});

describe("WitnessBench._finishWitnessStatement", () => {
  const draft =
    "I have observed [Veteran] at home." +
    "\n[Witness Signature]\n[Witness Printed Name]\n[Date]";

  it("fills in the names the witness and the app already hold, locally", () => {
    expect(
      _finishWitnessStatement(draft, {
        veteranName: "Jordan Faketon",
        witnessName: "  Sam Example ",
      }),
    ).toBe(
      "I have observed Jordan Faketon at home.\n[Witness Signature]\nSam Example\n[Date]",
    );
  });

  it("leaves the blanks when a name is not known", () => {
    expect(_finishWitnessStatement(draft, {})).toBe(draft);
  });
});
