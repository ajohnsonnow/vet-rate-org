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
      "FROM 20130418 TO 20140903",
    ],
    ["a real word containing a lowercase o", "from a place to another"],
    ["a bare pipe character", "UNIT A|B COMPANY"],
  ])(
    // A context-free, case-insensitive "O" -> "0" substitution (and a
    // "|" -> "1" one) used to run here on every OCR pass, turning
    // "FROM"/"TO" into "FR0M"/"T0" in the stored text of a scanned DD214.
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

  // Regression (Vera re-verification, 2026-09-24): correctDigitConfusionInNumberTokens
  // rewrote any [0-9OIB]-only token that contained a digit, so real Army MOS
  // codes (digit-digit-LETTER, with a letter that happens to be B/I/O) got
  // silently corrupted right alongside genuine numeric OCR noise.
  it.each([
    ["11B10", "MOS 11B10 INFANTRYMAN"],
    ["13B20", "MOS 13B20 CANNON CREWMEMBER"],
    ["12B", "PRIMARY SPECIALTY 12B COMBAT ENGINEER"],
  ])(
    "leaves the Army MOS code %s alone (does not read B as 8)",
    (mos, input) => {
      expect(applyVATerminologyCorrection(input)).toBe(input);
    },
  );

  it("leaves a Y-lettered MOS code (12Y20) alone", () => {
    const input = "MOS 12Y20 GEOSPATIAL ENGINEER";
    expect(applyVATerminologyCorrection(input)).toBe(input);
  });

  it.each([["O-3"], ["O3"]])(
    "leaves the officer pay grade %s alone (does not read O as 0)",
    (grade) => {
      const input = `4b PAY GRADE ${grade}`;
      expect(applyVATerminologyCorrection(input)).toBe(input);
    },
  );

  it("still repairs an 8-digit date with two O-for-zero confusions (2O13O418 -> 20130418)", () => {
    const input = "SERVICE IN AFGHANISTAN FROM 2O13O418 TO 20140903";
    expect(applyVATerminologyCorrection(input)).toBe(
      "SERVICE IN AFGHANISTAN FROM 20130418 TO 20140903",
    );
  });

  it("still repairs an O-for-zero confusion next to a percent sign (1O% -> 10%)", () => {
    const input = "DISABILITY RATING 1O% SERVICE CONNECTED";
    expect(applyVATerminologyCorrection(input)).toBe(
      "DISABILITY RATING 10% SERVICE CONNECTED",
    );
  });
});
