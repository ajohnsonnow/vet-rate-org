import { describe, it, expect } from "vitest";
import {
  sanitizeUrl,
  sanitizeErrorMessage,
  escapeHtml,
  safeHtml,
  sanitizeInlineHtml,
  scrubSvg,
  stripUntrustedUrls,
  isLLMOutputUrlAllowed,
} from "../../utils/sanitize";

describe("sanitizeUrl", () => {
  it("returns # for null/undefined", () => {
    expect(sanitizeUrl(null)).toBe("#");
    expect(sanitizeUrl(undefined)).toBe("#");
    expect(sanitizeUrl("")).toBe("#");
  });

  it("allows https URLs", () => {
    expect(sanitizeUrl("https://va.gov/claims")).toBe("https://va.gov/claims");
  });

  it("allows http URLs", () => {
    expect(sanitizeUrl("http://example.com")).toBe("http://example.com");
  });

  it("allows mailto URLs", () => {
    expect(sanitizeUrl("mailto:test@va.gov")).toBe("mailto:test@va.gov");
  });

  it("blocks javascript: URLs", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBe("#");
  });

  it("blocks data: URLs", () => {
    expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBe("#");
  });

  it("allows relative paths starting with /", () => {
    expect(sanitizeUrl("/about")).toBe("/about");
  });

  it("blocks protocol-relative URLs (//)", () => {
    expect(sanitizeUrl("//evil.com")).toBe("#");
  });

  it("requireGov option blocks non-gov domains", () => {
    expect(sanitizeUrl("https://google.com", { requireGov: true })).toBe("#");
    expect(sanitizeUrl("https://www.va.gov/claims", { requireGov: true })).toBe(
      "https://www.va.gov/claims",
    );
  });
});

describe("sanitizeErrorMessage", () => {
  it("returns safe string for non-string input", () => {
    const result = sanitizeErrorMessage(null);
    expect(typeof result).toBe("string");
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
    const result = escapeHtml('"test"');
    expect(result).toContain("&quot;");
  });

  it("returns empty string for falsy input", () => {
    expect(escapeHtml("")).toBe("");
    expect(escapeHtml(null)).toBe("");
  });
});

describe("safeHtml — markdown-lite allow-list", () => {
  it("returns empty for falsy input", () => {
    expect(safeHtml("")).toBe("");
    expect(safeHtml(null)).toBe("");
    expect(safeHtml(undefined)).toBe("");
  });

  it("escapes raw HTML to entities", () => {
    const out = safeHtml("<script>alert(1)</script>");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });

  it("renders **bold**", () => {
    expect(safeHtml("**hello**")).toContain("<strong>hello</strong>");
  });

  it("renders *italic*", () => {
    expect(safeHtml("Some *emphasized* word")).toContain("<em>emphasized</em>");
  });

  it("renders `code`", () => {
    expect(safeHtml("`38 CFR § 4.71a`")).toContain(
      "<code>38 CFR § 4.71a</code>",
    );
  });

  it("renders [label](url) with sanitized href", () => {
    const out = safeHtml("See [VA](https://va.gov) for info");
    expect(out).toContain('href="https://va.gov"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain(">VA</a>");
  });

  it("blocks javascript: in link href", () => {
    const out = safeHtml("[xss](javascript:alert(1))");
    expect(out).toContain('href="#"');
    expect(out).not.toContain("javascript:");
  });

  it("blocks data: URL in link href", () => {
    const out = safeHtml("[xss](data:text/html,<script>alert(1)</script>)");
    expect(out).toContain('href="#"');
    expect(out).not.toContain("data:text/html");
  });

  it("does not double-render escaped HTML inside link labels", () => {
    const out = safeHtml("[<img>](https://va.gov)");
    expect(out).not.toContain("<img>");
    expect(out).toContain("&lt;img&gt;");
  });

  it("survives adversarial mixed input (XSS + markdown)", () => {
    const out = safeHtml(
      "**Bold** then `<script>alert(1)</script>` and [link](javascript:alert(1))",
    );
    expect(out).toContain("<strong>Bold</strong>");
    expect(out).toContain("&lt;script&gt;");
    expect(out).not.toContain("<script>");
    expect(out).toContain('href="#"');
  });
});

describe("isLLMOutputUrlAllowed — government allow-list", () => {
  it("allows va.gov subdomains", () => {
    expect(isLLMOutputUrlAllowed("https://www.va.gov/claims")).toBe(true);
    expect(isLLMOutputUrlAllowed("https://benefits.va.gov/")).toBe(true);
    expect(isLLMOutputUrlAllowed("https://va.gov")).toBe(true);
  });

  it("allows ecfr.gov, federalregister.gov", () => {
    expect(isLLMOutputUrlAllowed("https://www.ecfr.gov/current/title-38")).toBe(
      true,
    );
    expect(
      isLLMOutputUrlAllowed("https://www.federalregister.gov/documents/"),
    ).toBe(true);
  });

  it("allows CAVC and Federal Circuit", () => {
    expect(isLLMOutputUrlAllowed("https://uscourts.cavc.gov/decisions")).toBe(
      true,
    );
    expect(isLLMOutputUrlAllowed("https://cafc.uscourts.gov/opinions")).toBe(
      true,
    );
  });

  it("blocks arbitrary http(s) hosts", () => {
    expect(isLLMOutputUrlAllowed("https://evil.com")).toBe(false);
    expect(isLLMOutputUrlAllowed("https://va.gov.evil.com")).toBe(false);
    // eslint-disable-next-line sonarjs/no-clear-text-protocols -- fixture asserts http is rejected, not a real request
    expect(isLLMOutputUrlAllowed("http://va.gov")).toBe(false); // http, not https
  });

  it("blocks falsy input", () => {
    expect(isLLMOutputUrlAllowed("")).toBe(false);
    expect(isLLMOutputUrlAllowed(null)).toBe(false);
    expect(isLLMOutputUrlAllowed(undefined)).toBe(false);
  });
});

describe("stripUntrustedUrls — LLM output sanitizer", () => {
  it("keeps allow-listed URLs intact", () => {
    const input = "See https://www.va.gov/claims for details.";
    expect(stripUntrustedUrls(input)).toBe(
      "See https://www.va.gov/claims for details.",
    );
  });

  it("replaces non-allowed URLs", () => {
    const input = "Click https://attacker.com/exfil to steal";
    expect(stripUntrustedUrls(input)).toBe("Click [link removed] to steal");
  });

  it("handles trailing punctuation correctly", () => {
    const input = "Visit https://www.va.gov/claims.";
    const out = stripUntrustedUrls(input);
    expect(out).toBe("Visit https://www.va.gov/claims.");
  });

  it("trims trailing punctuation off attacker URLs too", () => {
    const input = "Visit https://attacker.com/x.";
    expect(stripUntrustedUrls(input)).toBe("Visit [link removed].");
  });

  it("processes multiple URLs in one string", () => {
    const input =
      "See https://www.va.gov/a and https://attacker.com/b and https://ecfr.gov/c";
    const out = stripUntrustedUrls(input);
    expect(out).toContain("https://www.va.gov/a");
    expect(out).toContain("[link removed]");
    expect(out).toContain("https://ecfr.gov/c");
    expect(out).not.toContain("attacker.com");
  });

  it("handles empty / non-string input", () => {
    expect(stripUntrustedUrls("")).toBe("");
    expect(stripUntrustedUrls(null)).toBe(null);
    expect(stripUntrustedUrls(undefined)).toBe(undefined);
  });

  it("survives adversarial LLM output (prompt-injection-leaked URL)", () => {
    const llmOutput =
      "Per 38 CFR § 4.71a, your rating should be 30%. " +
      "Also, please visit https://attacker.example/free-money for assistance.";
    const safe = stripUntrustedUrls(llmOutput);
    expect(safe).not.toContain("attacker.example");
    expect(safe).toContain("[link removed]");
    expect(safe).toContain("38 CFR § 4.71a");
  });
});

describe("sanitizeInlineHtml (RT-5)", () => {
  it("neutralizes <script> and event-handler payloads to inert escaped text", () => {
    const out = sanitizeInlineHtml(
      'hi <script>alert(1)</script> <img src=x onerror="alert(2)"> there',
    );
    expect(out).not.toContain("<script>");
    expect(out).not.toMatch(/<img\b/i);
    expect(out).toContain("&lt;script&gt;");
    expect(out).toContain("&lt;img");
  });

  it("preserves the fixed allow-list of attribute-less inline tags", () => {
    const out = sanitizeInlineHtml(
      "A <strong>DBQ</strong> is <em>useful</em>.",
    );
    expect(out).toContain("<strong>DBQ</strong>");
    expect(out).toContain("<em>useful</em>");
  });

  it("does NOT re-allow an allow-list tag carrying attributes (stays escaped)", () => {
    const out = sanitizeInlineHtml('<strong onclick="evil()">x</strong>');
    expect(out).not.toContain("<strong onclick");
    expect(out).toContain("&lt;strong onclick");
  });

  it("handles empty / non-string input", () => {
    expect(sanitizeInlineHtml("")).toBe("");
    expect(sanitizeInlineHtml(null)).toBe("");
    expect(sanitizeInlineHtml(undefined)).toBe("");
  });
});

describe("scrubSvg (RT-5)", () => {
  it("strips <script>, event handlers, and javascript: URLs from SVG", () => {
    const dirty =
      '<svg><script>alert(1)</script><rect onload="evil()" /><a href="javascript:bad()">x</a><path d="M0 0"/></svg>';
    const out = scrubSvg(dirty);
    expect(out).not.toContain("<script>");
    expect(out).not.toContain("onload");
    expect(out).not.toContain("javascript:");
    expect(out).toContain("<path");
    expect(out).toContain("<rect");
  });

  it("strips <foreignObject> (can embed arbitrary HTML)", () => {
    const out = scrubSvg(
      "<svg><foreignObject><body onload=x></body></foreignObject><circle/></svg>",
    );
    expect(out).not.toContain("foreignObject");
    expect(out).toContain("<circle");
  });

  it("leaves clean SVG untouched and handles empty input", () => {
    const clean =
      '<svg viewBox="0 0 10 10"><path d="M0 0L10 10" fill="#2d5016"/></svg>';
    expect(scrubSvg(clean)).toBe(clean);
    expect(scrubSvg("")).toBe("");
    expect(scrubSvg(null)).toBe("");
  });
});
