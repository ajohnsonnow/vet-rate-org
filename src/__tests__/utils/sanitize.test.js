/**
 * sanitize — URL/HTML/error sanitization. Anchored against the threats that
 * actually fire in this app:
 *   - javascript:/data: URLs in user-pasted profile links
 *   - protocol-relative URLs that bypass scheme allowlists
 *   - HTML tags echoed in error toasts
 *   - requireGov gate for "official VA link" rendering
 */
import { describe, it, expect } from "vitest";
import {
  sanitizeUrl,
  sanitizeErrorMessage,
  escapeHtml,
} from "../../utils/sanitize";

describe("sanitizeUrl — null/empty handling", () => {
  it("returns # for null/undefined/empty", () => {
    expect(sanitizeUrl(null)).toBe("#");
    expect(sanitizeUrl(undefined)).toBe("#");
    expect(sanitizeUrl("")).toBe("#");
  });

  it("returns # for whitespace-only input", () => {
    expect(sanitizeUrl("   ")).toBe("#");
  });

  it("trims surrounding whitespace", () => {
    expect(sanitizeUrl("  https://va.gov  ")).toBe("https://va.gov");
  });
});

describe("sanitizeUrl — allowed schemes", () => {
  it("allows https", () => {
    expect(sanitizeUrl("https://va.gov/claims")).toBe("https://va.gov/claims");
  });

  it("allows http", () => {
    expect(sanitizeUrl("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("allows mailto", () => {
    expect(sanitizeUrl("mailto:test@va.gov")).toBe("mailto:test@va.gov");
  });

  it("allows tel", () => {
    expect(sanitizeUrl("tel:+18001234567")).toBe("tel:+18001234567");
  });

  it("allows relative paths starting with /", () => {
    expect(sanitizeUrl("/about")).toBe("/about");
  });
});

describe("sanitizeUrl — blocked schemes", () => {
  it("blocks javascript:", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBe("#");
  });

  it("blocks data:", () => {
    expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBe("#");
  });

  it("blocks protocol-relative URLs (//evil.com)", () => {
    expect(sanitizeUrl("//evil.com")).not.toBe("//evil.com");
  });
});

describe("sanitizeUrl — requireGov gate", () => {
  it("allows va.gov URLs", () => {
    expect(sanitizeUrl("https://va.gov/path", { requireGov: true })).toBe(
      "https://va.gov/path",
    );
    expect(sanitizeUrl("https://www.va.gov/claims", { requireGov: true })).toBe(
      "https://www.va.gov/claims",
    );
  });

  it("blocks non-gov URLs", () => {
    expect(sanitizeUrl("https://google.com", { requireGov: true })).toBe("#");
    expect(sanitizeUrl("https://evil.com", { requireGov: true })).toBe("#");
  });
});

describe("sanitizeErrorMessage", () => {
  it("returns safe string for non-string input", () => {
    expect(typeof sanitizeErrorMessage(null)).toBe("string");
  });

  it("strips HTML tags from error messages", () => {
    const result = sanitizeErrorMessage("<script>alert(1)</script>Error");
    expect(result).not.toContain("<script>");
  });
});

describe("escapeHtml", () => {
  it("escapes angle brackets", () => {
    const result = escapeHtml("<div>test</div>");
    expect(result).toContain("&lt;");
    expect(result).toContain("&gt;");
  });

  it("escapes ampersands", () => {
    expect(escapeHtml("a & b")).toContain("&amp;");
  });

  it("escapes quotes", () => {
    expect(escapeHtml('"test"')).toContain("&quot;");
  });

  it("returns empty string for falsy input", () => {
    expect(escapeHtml("")).toBe("");
    expect(escapeHtml(null)).toBe("");
  });
});
