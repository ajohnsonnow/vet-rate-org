import { describe, it, expect } from "vitest";
import { sanitizeUrl } from "../utils/sanitize";

describe("sanitizeUrl", () => {
  it("returns # for empty input", () => {
    expect(sanitizeUrl("")).toBe("#");
  });

  it("returns # for null input", () => {
    expect(sanitizeUrl(null)).toBe("#");
  });

  it("returns # for undefined", () => {
    expect(sanitizeUrl(undefined)).toBe("#");
  });

  it("allows https URLs", () => {
    expect(sanitizeUrl("https://va.gov")).toBe("https://va.gov");
  });

  it("allows http URLs", () => {
    expect(sanitizeUrl("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("allows mailto links", () => {
    expect(sanitizeUrl("mailto:test@va.gov")).toBe("mailto:test@va.gov");
  });

  it("allows tel links", () => {
    expect(sanitizeUrl("tel:+18001234567")).toBe("tel:+18001234567");
  });

  it("blocks javascript: URLs", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBe("#");
  });

  it("blocks data: URLs", () => {
    expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBe("#");
  });

  it("allows relative URLs starting with /", () => {
    expect(sanitizeUrl("/about")).toBe("/about");
  });

  it("blocks protocol-relative URLs //", () => {
    // Should not allow //evil.com
    const result = sanitizeUrl("//evil.com");
    // Relative URLs starting with // should be blocked
    expect(result).not.toBe("//evil.com");
  });

  it("requireGov option restricts to .gov domains", () => {
    expect(sanitizeUrl("https://va.gov/path", { requireGov: true })).toBe(
      "https://va.gov/path",
    );
    expect(sanitizeUrl("https://evil.com", { requireGov: true })).toBe("#");
  });

  it("handles whitespace trimming", () => {
    expect(sanitizeUrl("  https://va.gov  ")).toBe("https://va.gov");
  });

  it("returns # for whitespace-only input", () => {
    expect(sanitizeUrl("   ")).toBe("#");
  });
});
