import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import { generatePDF } from "./pdfGenerator";

// jsPDF's Node build calls fs.writeFileSync(filename, ...) directly inside
// doc.save() with no way to redirect the output path from the caller, so the
// only way to stop this suite from littering real PDFs into the repo root
// (988 had accumulated before this fix) is to intercept the write itself.
let writeFileSyncSpy;

beforeEach(() => {
  writeFileSyncSpy = vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});
});

afterEach(() => {
  writeFileSyncSpy.mockRestore();
});

function makeResult(overrides = {}) {
  return {
    conditionName: "Migraines",
    diagnosticCode: "8100",
    ratingSchedule: "38 CFR 4.124a",
    ecfrUrl: "https://www.ecfr.gov/current/title-38/chapter-I/part-4",
    documentationRequirements:
      "Frequency of attacks\nSeverity and duration\nImpact on work",
    ratingCriteria: {
      type: "prostrating-attacks",
      ratedUnder: "Rated under diagnostic code 8100 for migraine headaches.",
      formula: "Combine ratings using the VA combined ratings table.",
      specialInstructions:
        "Consider secondary conditions such as depression or anxiety.",
      ratings: {
        50: "Very frequent completely prostrating and prolonged attacks.",
        30: "Characteristic prostrating attacks averaging once a month.",
        10: "Characteristic prostrating attacks averaging one in 2 months.",
        0: "Less frequent attacks.",
      },
      notes: [
        "Rating is based on frequency and severity of attacks.",
        "Secondary conditions may qualify for separate ratings.",
      ],
    },
    relatedSecondaryConditions: [
      "Tension Headaches",
      { name: "Depression", diagnosticCode: "9434" },
    ],
    ...overrides,
  };
}

describe("generatePDF", () => {
  it("generates a PDF without throwing for a full result object", () => {
    const result = makeResult();
    const output = generatePDF(result, "migraine");
    expect(output.success).toBe(true);
    expect(output.filename).toContain("VA-Disability-8100-");
    expect(writeFileSyncSpy).toHaveBeenCalledTimes(1);
    expect(writeFileSyncSpy.mock.calls[0][0]).toContain("VA-Disability-8100-");
  });

  it("handles a result with only ratedUnder (no ratings table)", () => {
    const result = makeResult({
      ratingCriteria: {
        type: "rated-under",
        ratedUnder: "Rated under diagnostic code 5299-5290.",
      },
    });
    const output = generatePDF(result, "");
    expect(output.success).toBe(true);
  });

  it("handles string-form notes and no secondary conditions", () => {
    const result = makeResult({
      ratingCriteria: {
        type: "schedular",
        ratings: { 100: "Total occupational and social impairment." },
        notes: "Single string note instead of an array.",
      },
      relatedSecondaryConditions: [],
    });
    const output = generatePDF(result, "");
    expect(output.success).toBe(true);
  });

  it("handles a minimal result with no ratingCriteria at all", () => {
    const result = makeResult({ ratingCriteria: null });
    const output = generatePDF(result, "");
    expect(output.success).toBe(true);
  });
});
