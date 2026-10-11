/**
 * A VA file number is 7 to 9 digits (cFilePageSegmenter, useScreenshot and the
 * VSO label rule all agree). The scrubber only treated 8 to 9 as a file
 * number, so a labelled or C-prefixed 7-digit number reached cloud AI
 * request bodies. A bare 7-digit run must still survive.
 *
 * Fixture identifiers are synthetic.
 */
import { describe, it, expect } from "vitest";
import { scrubPII } from "./piiScrubber";

describe("7-digit VA file numbers", () => {
  it.each([
    ["C1234567", "1234567"],
    ["C-1234567", "1234567"],
    ["c 1234567", "1234567"],
    ["Your file is C1234567 as of today", "1234567"],
    ["File Number: 1234567", "1234567"],
    ["VA file no. 1234567", "1234567"],
    ["Claim number: 1234567", "1234567"],
    ["C12345678", "12345678"],
    ["C123456789", "123456789"],
  ])("scrubs %j", (text, digits) => {
    for (const aggressive of [false, true]) {
      const { scrubbedText, piiFound } = scrubPII(text, { aggressive });
      expect(piiFound).toBe(true);
      expect(scrubbedText).not.toContain(digits);
    }
  });

  it.each([
    ["Awarded $1234567 in back pay"],
    ["Total of 1234567 records"],
    ["Pub. L. 117-168 section 1234567"],
    ["Call the clinic at 555-1234 today"],
    ["Call 555 1234567 x"],
    ["Building C 555-1234"],
    ["Medicare Part C 2023-2024"],
    ["Vitamin C 1000 1000 mg"],
    ["Seen on C 2019-03-15"],
    ["Rated 70 percent under DC 9411 from 2019-03-15"],
  ])("leaves %j intact", (text) => {
    for (const aggressive of [false, true]) {
      const { scrubbedText } = scrubPII(text, { aggressive });
      expect(scrubbedText).toBe(text);
    }
  });

  it("does not redact a bare 7-digit run even in aggressive mode", () => {
    const { scrubbedText } = scrubPII("Reference 1234567.", {
      aggressive: true,
    });
    expect(scrubbedText).toBe("Reference 1234567.");
  });

  it("stays fast on pathological C-prefixed input", () => {
    const inputs = [
      `${"C".repeat(50000)}1234567`,
      "C 1 ".repeat(20000),
      `C${"1".repeat(50000)}`,
    ];
    for (const input of inputs) {
      const start = performance.now();
      scrubPII(input);
      expect(performance.now() - start).toBeLessThan(2000);
    }
  });
});
