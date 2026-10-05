/**
 * Witness Bench hands the model its own app-built statement to reword and
 * falls back to its standard statement when the model's answer is not
 * usable. Fixture values are invented for these tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  STANDARD_DRAFT_NOTE,
  buildWitnessStatementTemplate,
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
const { _compileStatementWithAI } = await import("./WitnessBench.jsx");

const ANSWERS = {
  relationship_context: "I have been married to the veteran since 2012.",
  q1: "They leave the room when fireworks start.",
  q2: "They no longer drive at night.",
};
// RELATIONSHIP_TYPES carries translation keys, not labels, so the statement
// shows the stored value.
const TEMPLATE = buildWitnessStatementTemplate("spouse", "PTSD", ANSWERS);

const draftIn = (prompt) =>
  /=== DRAFT ===\n([\s\S]*)\n=== END DRAFT ===/.exec(prompt)[1];

beforeEach(() => {
  generateAI.mockReset();
});

describe("WitnessBench._compileStatementWithAI", () => {
  it("asks the model to reword the app-built statement", async () => {
    generateAI.mockImplementation(async (prompt) => ({
      text: draftIn(prompt),
    }));
    await _compileStatementWithAI("spouse", "PTSD", ANSWERS);

    const [prompt, options] = generateAI.mock.calls[0];
    expect(draftIn(prompt)).toBe(TEMPLATE);
    expect(prompt).toMatch(/square brackets/);
    expect(options).toMatchObject({
      toolId: "buddy-statement",
      dataClass: "context",
    });
  });

  it("returns the model's wording when it passes the check", async () => {
    generateAI.mockImplementation(async (prompt) => ({
      text: draftIn(prompt).replace(
        "They no longer drive at night.",
        "At night, they no longer drive.",
      ),
    }));
    const result = await _compileStatementWithAI("spouse", "PTSD", ANSWERS);

    expect(result.draftPath).toBe("model");
    expect(result.draftNote).toBeNull();
    expect(result.statement).toContain("At night, they no longer drive.");
    expect(result.statement).toContain("[Veteran]");
    expect(result.statement).not.toMatch(/WITNESS ATTESTATION/);
  });

  it("returns the standard statement, attestation included, when the model refuses", async () => {
    generateAI.mockResolvedValue({
      text: "I cannot draft a buddy statement because you have not provided the specific details of the incident.",
    });
    const result = await _compileStatementWithAI("spouse", "PTSD", ANSWERS);

    expect(result.draftPath).toBe("template");
    expect(result.draftNote).toBe(STANDARD_DRAFT_NOTE);
    expect(result.draftRejectReasons).toEqual(["not a draft: refusal"]);
    expect(result.statement).toContain(
      "They leave the room when fireworks start.",
    );
    expect(result.statement).toContain(
      "WITNESS ATTESTATION (read before you sign)",
    );
    expect(result.statement).toContain("18 U.S.C. § 1001");
  });

  it("returns the standard statement when the model writes its own attestation", async () => {
    generateAI.mockImplementation(async (prompt) => ({
      text: `${draftIn(prompt)}\n\nI certify that the foregoing is true and correct.`,
    }));
    const result = await _compileStatementWithAI("spouse", "PTSD", ANSWERS);

    expect(result.draftPath).toBe("template");
    expect(result.draftRejectReasons.join(" ")).toMatch(/attestation/);
    expect(result.statement).not.toContain("the foregoing");
  });
});

describe("WitnessBench._compileStatementWithAI when the model cannot answer", () => {
  it("returns the standard statement and names the engine error", async () => {
    generateAI.mockRejectedValue(new Error("WebGPU inference timed out"));
    const result = await _compileStatementWithAI("spouse", "PTSD", ANSWERS);

    expect(result).toMatchObject({
      draftPath: "template",
      draftNote: STANDARD_DRAFT_NOTE,
      draftRejectReasons: [],
      draftErrorReason: "WebGPU inference timed out",
    });
    expect(result.statement).toContain(
      "They leave the room when fireworks start.",
    );
    expect(result.statement).toContain(
      "WITNESS ATTESTATION (read before you sign)",
    );
  });
});
