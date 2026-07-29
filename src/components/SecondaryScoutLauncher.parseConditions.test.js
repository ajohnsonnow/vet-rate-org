import { describe, it, expect } from "vitest";

// SecondaryScoutLauncher transitively imports pdfjs, which references
// canvas globals jsdom doesn't provide. Stub them so the module loads in
// the test environment (same pattern as
// src/__tests__/utils/musterCallReport.test.js).
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const { parseConditionsFromText } = await import("./SecondaryScoutLauncher");

describe("SecondaryScoutLauncher: parseConditionsFromText", () => {
  // Pre-existing bug, confirmed present in the original unmodified regex too
  // (unrelated to the ReDoS fixes in this file -- `condition = match[1]?.trim()
  // || match[2]?.trim()` always prefers match[1], which for this one pattern
  // is the rating *number*, not the condition name, so it's always truthy and
  // match[2] -- the actual name -- is never reached; the wrongly-captured
  // number is then itself dropped by the `condition.length < 3` filter since
  // ratings are 1-2 digits). Net effect: the "XX% rating for [condition]"
  // format documented in the code comment never actually extracts anything.
  // Documenting the real behavior rather than silently fixing it, since
  // that's outside this pass's scope (see conversation notes / final report).
  it("'% rating for' format extracts nothing due to a pre-existing capture-group bug", () => {
    const text = "70% rating for PTSD\n10% rating for Tinnitus";
    expect(parseConditionsFromText(text)).toEqual([]);
  });

  it("extracts conditions from 'service connection for ... is granted' format", () => {
    const text = "Service connection for lumbosacral strain is granted.";
    const conditions = parseConditionsFromText(text);
    expect(
      conditions.some((c) => c.toLowerCase().includes("lumbosacral")),
    ).toBe(true);
  });

  it("extracts conditions from 'Condition, Diagnostic Code XXXX' format", () => {
    const text = "Migraine headaches, Diagnostic Code 8100";
    const conditions = parseConditionsFromText(text);
    expect(conditions.some((c) => c.toLowerCase().includes("migraine"))).toBe(
      true,
    );
  });

  it("extracts conditions from '[Condition] (DC XXXX)' format", () => {
    const text = "Rotator cuff tear (DC 5201)";
    const conditions = parseConditionsFromText(text);
    expect(
      conditions.some((c) => c.toLowerCase().includes("rotator cuff")),
    ).toBe(true);
  });

  it("extracts conditions from leading-dash percent-list format", () => {
    const text = "- Tinnitus - 10%\n- PTSD - 70%";
    const conditions = parseConditionsFromText(text);
    expect(conditions.some((c) => c.toLowerCase().includes("tinnitus"))).toBe(
      true,
    );
    expect(conditions.some((c) => c.toLowerCase().includes("ptsd"))).toBe(true);
  });

  it("returns an empty list for text with no recognizable conditions", () => {
    expect(parseConditionsFromText("just some unrelated text")).toEqual([]);
  });

  it("does not hang on a large all-letters document (regression: ReDoS)", () => {
    const pathological = "A".repeat(150000);
    const start = Date.now();
    const conditions = parseConditionsFromText(pathological);
    const elapsed = Date.now() - start;
    expect(Array.isArray(conditions)).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });

  it("does not hang on a large all-whitespace document (regression: ReDoS)", () => {
    const pathological = " ".repeat(150000);
    const start = Date.now();
    const conditions = parseConditionsFromText(pathological);
    const elapsed = Date.now() - start;
    expect(Array.isArray(conditions)).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });

  it("does not hang on a large all-newlines document (regression: ReDoS)", () => {
    const pathological = "\n".repeat(150000);
    const start = Date.now();
    const conditions = parseConditionsFromText(pathological);
    const elapsed = Date.now() - start;
    expect(Array.isArray(conditions)).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });

  it("extracts many conditions from a large realistic document quickly", () => {
    const lines = [];
    for (let i = 0; i < 300; i++) {
      lines.push(
        `- Condition ${String.fromCharCode(65 + (i % 26)).repeat(3)} - ${10 + (i % 90)}%`,
      );
    }
    const text = lines.join("\n");
    const start = Date.now();
    const conditions = parseConditionsFromText(text);
    const elapsed = Date.now() - start;
    expect(conditions.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(1000);
  });
});
