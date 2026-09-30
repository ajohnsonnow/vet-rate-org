/**
 * ADR-009 spec item: RedTeam's Statement Stress Test accepts a dropped PDF
 * (usePdfDropIn -> analyzePDF), whose extracted text is document-derived,
 * but stressTestStatement always declared dataClass: "context" - so an
 * OCR'd/PDF.js-extracted document would have routed off-device to any
 * configured cloud/off-device AI, contradicting the panel's own "nothing is
 * sent to any server" claim. isDocument lets the caller (RedTeam.jsx) say
 * whether the CURRENT statement text actually came from a dropped file.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("./unifiedAIService", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateAI: vi.fn(),
    isAnyAIAvailable: vi.fn(() => true),
  };
});

const unifiedAIService = await import("./unifiedAIService.js");
const { stressTestStatement } = await import("./aiStatementHelper.js");
const { AI_DATA_CLASS } = await import("./aiDataClassPolicy.js");

const STATEMENT =
  "My back has hurt every day since basic training and I never got it checked out until now, so this is a full 50+ character statement.";

beforeEach(() => {
  vi.clearAllMocks();
  unifiedAIService.generateAI.mockResolvedValue({
    text: JSON.stringify({ overall_score: 80, weak_spots: [] }),
  });
});

describe("stressTestStatement: dataClass follows the statement's actual provenance", () => {
  it("typed/dictated statement (isDocument: false): declares CONTEXT", async () => {
    await stressTestStatement(STATEMENT, { isDocument: false });

    expect(unifiedAIService.generateAI.mock.calls[0][1].dataClass).toBe(
      AI_DATA_CLASS.CONTEXT,
    );
  });

  it("dropped-PDF-extracted statement (isDocument: true): declares DOCUMENT", async () => {
    await stressTestStatement(STATEMENT, { isDocument: true });

    expect(unifiedAIService.generateAI.mock.calls[0][1].dataClass).toBe(
      AI_DATA_CLASS.DOCUMENT,
    );
  });

  it("caller omits the option entirely: fails closed to DOCUMENT", async () => {
    await stressTestStatement(STATEMENT);

    expect(unifiedAIService.generateAI.mock.calls[0][1].dataClass).toBe(
      AI_DATA_CLASS.DOCUMENT,
    );
  });
});
