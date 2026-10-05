/**
 * The TDIU Builder hands the model its own app-built analysis to reword and
 * keeps that analysis when the model's answer is not usable. Fixture values
 * are invented for these tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  STANDARD_DRAFT_NOTE,
  buildTdiuAnalysisTemplate,
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
const { _generateVocationalImpact } = await import("./TDIUBuilder.jsx");

const DISABILITIES = [
  { condition: "Lumbar strain", symptoms: ["Cannot sit >30 minutes"] },
  { condition: "Migraines", symptoms: ["Light sensitivity", "Nausea"] },
];
const TEMPLATE = buildTdiuAnalysisTemplate(DISABILITIES);

const draftIn = (prompt) =>
  JSON.parse(/=== DRAFT ===\n([\s\S]*)\n=== END DRAFT ===/.exec(prompt)[1]);
const modelReplies = (reply) =>
  generateAI.mockImplementation(async (prompt) => ({
    text: typeof reply === "function" ? reply(draftIn(prompt)) : reply,
  }));

beforeEach(() => {
  generateAI.mockReset();
});

describe("TDIUBuilder._generateVocationalImpact", () => {
  it("asks the model to reword the app-built analysis as JSON", async () => {
    modelReplies((draft) => JSON.stringify(draft));
    await _generateVocationalImpact(DISABILITIES, "Served 2001 to 2009.");

    const [prompt, options] = generateAI.mock.calls[0];
    expect(draftIn(prompt)).toEqual(TEMPLATE);
    expect(prompt).toMatch(/square brackets/);
    expect(prompt).toContain("Served 2001 to 2009.");
    expect(options).toMatchObject({
      toolId: "tdiu-narrative",
      dataClass: "context",
      expectJSON: true,
    });
  });

  it("returns the model's wording when it passes the check", async () => {
    modelReplies(
      (draft) =>
        `Here is the JSON:\n${JSON.stringify({
          ...draft,
          combined_effect: draft.combined_effect.replace(
            "affect my ability to work together",
            "together affect my ability to work",
          ),
          extra_field: "ignored",
        })}`,
    );
    const result = await _generateVocationalImpact(DISABILITIES);

    expect(result.draftPath).toBe("model");
    expect(result.draftNote).toBeNull();
    expect(result.analysis.combined_effect).toContain(
      "together affect my ability to work",
    );
    expect(result.analysis.limitations).toEqual(TEMPLATE.limitations);
    expect(result.analysis.job_types_precluded).toEqual(
      TEMPLATE.job_types_precluded,
    );
    expect(result.analysis).not.toHaveProperty("extra_field");
  });

  it.each([
    ["is not JSON", () => "I need more details about your work history."],
    [
      "drops a limitation",
      (draft) =>
        JSON.stringify({ ...draft, limitations: draft.limitations.slice(1) }),
    ],
    [
      "invents how a symptom limits work",
      (draft) =>
        JSON.stringify({
          ...draft,
          limitations: draft.limitations.map((limitation) => ({
            ...limitation,
            vocational_impact:
              "This precludes sedentary work; the veteran cannot sit through an 8-hour workday.",
          })),
        }),
    ],
    [
      "decides which kinds of work are ruled out",
      (draft) =>
        JSON.stringify({
          ...draft,
          job_types_precluded: ["Sedentary", "Light", "Medium", "Heavy"],
        }),
    ],
  ])("keeps the app-built analysis when the reply %s", async (_why, reply) => {
    modelReplies(reply);
    const result = await _generateVocationalImpact(DISABILITIES);

    expect(result.analysis).toEqual(TEMPLATE);
    expect(result.draftPath).toBe("template");
    expect(result.draftNote).toBe(STANDARD_DRAFT_NOTE);
    expect(result.draftRejectReasons.length).toBeGreaterThan(0);
  });
});
