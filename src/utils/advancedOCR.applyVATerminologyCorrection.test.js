import { describe, it, expect } from "vitest";

// advancedOCR transitively imports pdfjs, which references canvas globals
// jsdom doesn't provide. Stub them so the module loads in the test
// environment (same pattern as musterCallProcessor.serviceRecord.test.js).
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const { applyVATerminologyCorrection } = await import("./advancedOCR");

describe("advancedOCR: applyVATerminologyCorrection", () => {
  it.each([
    [
      "a real word containing an uppercase O (regression: whole-text O->0)",
      "FROM 20040808 TO 20050727",
    ],
    ["a real word containing a lowercase o", "from a place to another"],
    ["a bare pipe character", "UNIT A|B COMPANY"],
  ])(
    // A context-free, case-insensitive "O" -> "0" substitution (and a
    // "|" -> "1" one) used to run here on every OCR pass, turning
    // "FROM"/"TO" into "FR0M"/"T0" - confirmed against a real scanned
    // DD214 whose stored text read "FR0M 20040808 T0 20050727".
    "leaves %s unchanged",
    (_label, input) => {
      expect(applyVATerminologyCorrection(input)).toBe(input);
    },
  );

  it("still repairs a digit-confused year inside an otherwise-numeric token (19B5 -> 1985)", () => {
    const input = "ENTERED SERVICE 19B5";
    expect(applyVATerminologyCorrection(input)).toBe("ENTERED SERVICE 1985");
  });

  it("still repairs an O misread as a zero inside an 8-digit date token", () => {
    const input = "FROM 20O40915 TO 20050101";
    expect(applyVATerminologyCorrection(input)).toBe(
      "FROM 20040915 TO 20050101",
    );
  });

  it("still applies real VA terminology corrections (DD-214 form number OCR variants)", () => {
    expect(applyVATerminologyCorrection("CERTIFICATE OO-214")).toBe(
      "CERTIFICATE DD-214",
    );
  });
});
