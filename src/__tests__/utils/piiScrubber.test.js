/**
 * scrubPII — last line of defense before veteran text crosses any AI/network
 * boundary. Every detector here corresponds to a real-world leak surface:
 *   - SSN (most common via "they need my social to help")
 *   - email/phone (typical free-text contact info)
 *   - credit cards (slip-throughs from bank screenshots)
 *   - DOB (only with `aggressive` mode, off by default)
 */
import { describe, it, expect } from "vitest";
import { scrubPII } from "../../utils/piiScrubber";

describe("scrubPII — null/empty/safe inputs", () => {
  it("returns unchanged for null", () => {
    const result = scrubPII(null);
    expect(result.piiFound).toBe(false);
    expect(result.scrubbedText).toBeNull();
  });

  it("returns unchanged for empty string", () => {
    const result = scrubPII("");
    expect(result.piiFound).toBe(false);
  });

  it("returns unchanged for non-string input", () => {
    const result = scrubPII(123);
    expect(result.piiFound).toBe(false);
  });

  it("leaves clean text untouched", () => {
    const text = "I have PTSD rated at 70 percent";
    const result = scrubPII(text);
    expect(result.scrubbedText).toBe(text);
    expect(result.piiFound).toBe(false);
  });

  it("returns unchanged text when nothing matches", () => {
    const result = scrubPII("This is a normal sentence.");
    expect(result.scrubbedText).toBe("This is a normal sentence.");
    expect(result.piiFound).toBe(false);
  });
});

describe("scrubPII — detection coverage", () => {
  it("scrubs SSN in XXX-XX-XXXX format", () => {
    const result = scrubPII("My SSN is 123-45-6789");
    expect(result.piiFound).toBe(true);
    expect(result.scrubbedText).not.toContain("123-45-6789");
  });

  it("scrubs email addresses", () => {
    const result = scrubPII("Contact me at john@example.com for details");
    expect(result.piiFound).toBe(true);
    expect(result.scrubbedText).not.toContain("john@example.com");
  });

  it("scrubs phone numbers (dashed)", () => {
    const result = scrubPII("Call me at 555-123-4567");
    expect(result.piiFound).toBe(true);
    expect(result.scrubbedText).not.toContain("555-123-4567");
  });

  it("scrubs phone numbers (parenthesised)", () => {
    const result = scrubPII("Call me at (555) 123-4567");
    expect(result.piiFound).toBe(true);
    expect(result.scrubbedText).not.toContain("555");
  });

  it("scrubs credit card numbers", () => {
    const result = scrubPII("Card: 4111-1111-1111-1111");
    expect(result.piiFound).toBe(true);
    expect(result.scrubbedText).not.toContain("4111-1111-1111-1111");
  });

  it("returns details array describing what was scrubbed", () => {
    const result = scrubPII("SSN: 123-45-6789, email: a@b.com");
    expect(Array.isArray(result.details)).toBe(true);
    expect(result.details.length).toBeGreaterThan(0);
  });

  it("aggressive mode catches DOB (off by default)", () => {
    const result = scrubPII("Born on 01/15/1990", { aggressive: true });
    expect(result.scrubbedText).not.toContain("01/15/1990");
  });
});
