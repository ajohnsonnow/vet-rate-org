import { describe, it, expect } from "vitest";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const { extractIntelligenceBriefingData } =
  await import("../../utils/musterCallProcessor");

describe("extractIntelligenceBriefingData", () => {
  it("returns an empty briefing when there are no results", () => {
    const briefing = extractIntelligenceBriefingData([]);
    expect(briefing.documentsProcessed).toBe(0);
    expect(briefing.conditions).toEqual([]);
  });

  it("pulls the combined rating and de-duplicates conditions from a rating decision", () => {
    const briefing = extractIntelligenceBriefingData([
      {
        status: "complete",
        extractedData: {
          type: "rating_decision",
          combinedRating: 70,
          effectiveDate: "2023-09-15",
          conditions: [
            { name: "Tinnitus", rating: 10, diagnosticCode: "6260" },
            { name: "Tinnitus", rating: 10, diagnosticCode: "6260" },
          ],
        },
      },
    ]);
    expect(briefing.currentCombinedRating).toBe(70);
    expect(briefing.conditions).toEqual([
      {
        name: "Tinnitus",
        rating: 10,
        diagnosticCode: "6260",
        effectiveDate: "2023-09-15",
      },
    ]);
    expect(briefing.documentTypes).toEqual({ rating_decision: 1 });
  });

  it("collects claim numbers from claim letters without duplicating a repeated one", () => {
    const briefing = extractIntelligenceBriefingData([
      {
        status: "complete",
        extractedData: { type: "claim_letter", claimNumber: "600123456" },
      },
      {
        status: "complete",
        extractedData: { type: "claim_letter", claimNumber: "600123456" },
      },
      {
        status: "complete",
        extractedData: { type: "claim_letter", claimNumber: "600999999" },
      },
    ]);
    expect(briefing.claimNumbers).toEqual(["600123456", "600999999"]);
  });

  it("skips a result that never finished processing", () => {
    const briefing = extractIntelligenceBriefingData([
      {
        status: "error",
        extractedData: { type: "rating_decision", combinedRating: 50 },
      },
    ]);
    expect(briefing.currentCombinedRating).toBeNull();
    expect(briefing.documentsProcessed).toBe(1);
  });
});
