import { describe, it, expect } from "vitest";

// musterCallProcessor transitively imports pdfjs, which references canvas
// globals jsdom doesn't provide. Stub them so the module loads in the test
// environment (same pattern as src/__tests__/utils/musterCallReport.test.js).
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const { parseRatingDecision } = await import("./musterCallProcessor");

describe("musterCallProcessor: parseRatingDecision (legacy fallback parser)", () => {
  it("extracts conditions with an adjacent diagnostic code", async () => {
    const text =
      "COMBINED RATING: 70%\n" +
      "EFFECTIVE DATE: 01-01-2020\n" +
      "DIAGNOSTIC CODE: 5237 Lumbosacral strain - 40%\n" +
      "Tinnitus - 10%\n";

    const result = await parseRatingDecision(text);

    expect(result.combinedRating).toBe(70);
    expect(result.effectiveDate).toBe("01-01-2020");
    expect(result.conditions.length).toBeGreaterThanOrEqual(2);

    const strain = result.conditions.find((c) =>
      c.name.toLowerCase().includes("lumbosacral"),
    );
    expect(strain).toBeDefined();
    expect(strain.rating).toBe(40);
    expect(strain.diagnosticCode).toBe("5237");

    const tinnitus = result.conditions.find((c) =>
      c.name.toLowerCase().includes("tinnitus"),
    );
    expect(tinnitus).toBeDefined();
    expect(tinnitus.rating).toBe(10);
  });

  it("returns null diagnosticCode when none precedes the condition", async () => {
    const text = "Tinnitus - 10%, PTSD - 70%";
    const result = await parseRatingDecision(text);
    expect(result.conditions.every((c) => c.diagnosticCode === null)).toBe(
      true,
    );
  });

  it("does not hang on a long run of letters with no percent anywhere (regression: ReDoS)", async () => {
    const pathological = "A".repeat(100000);
    const start = Date.now();
    const result = await parseRatingDecision(pathological);
    const elapsed = Date.now() - start;
    expect(result.conditions).toEqual([]);
    expect(elapsed).toBeLessThan(1000);
  });

  it("does not hang on a long run of whitespace with no match anywhere (regression: ReDoS)", async () => {
    const pathological = " ".repeat(100000);
    const start = Date.now();
    const result = await parseRatingDecision(pathological);
    const elapsed = Date.now() - start;
    expect(result.conditions).toEqual([]);
    expect(elapsed).toBeLessThan(1000);
  });

  it("does not hang on many conditions in a large document (regression: ReDoS)", async () => {
    // Condition names are letters/spaces/commas only (same character class
    // the original regex used) -- a numeral in the name was never matched
    // by either version, so use a letter suffix instead of the loop index.
    const lines = [];
    for (let i = 0; i < 500; i++) {
      const suffix = String.fromCharCode(65 + (i % 26)).repeat(3);
      lines.push(
        `DIAGNOSTIC CODE: ${1000 + i} Condition ${suffix} - ${10 + (i % 90)}%`,
      );
    }
    const text = lines.join("\n");
    const start = Date.now();
    const result = await parseRatingDecision(text);
    const elapsed = Date.now() - start;
    expect(result.conditions).toHaveLength(500);
    expect(elapsed).toBeLessThan(1000);
  });
});
