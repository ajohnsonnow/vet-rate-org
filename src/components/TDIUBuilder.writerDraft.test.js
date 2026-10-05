/**
 * The TDIU Builder's analysis comes from chosen conditions and symptoms.
 * Nothing in it is typed by the veteran, so there is nothing for the AI to
 * reword and the builder makes no model call. Fixture values are invented.
 */
import { describe, it, expect, vi } from "vitest";
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

describe("TDIUBuilder._generateVocationalImpact", () => {
  it("returns the app-built analysis without calling the model, AI loaded or not", () => {
    expect(_generateVocationalImpact(DISABILITIES)).toEqual({
      analysis: buildTdiuAnalysisTemplate(DISABILITIES),
      draftPath: "template",
      draftNote: STANDARD_DRAFT_NOTE,
      draftRejectReasons: [],
      passages: { sent: 0, accepted: 0, unchanged: 0, rejected: 0 },
    });
    expect(generateAI).not.toHaveBeenCalled();
  });
});
