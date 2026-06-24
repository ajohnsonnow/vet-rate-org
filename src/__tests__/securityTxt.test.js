import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * D-H06 / D-H07: a deployed RFC 9116 security.txt gives researchers a real
 * disclosure channel. The Expires field is the footgun — once it lapses the file
 * is non-compliant and scanners flag it — so this guards presence + required
 * fields + a still-future expiry.
 */
const text = readFileSync(
  join(process.cwd(), "public/.well-known/security.txt"),
  "utf8",
);

describe("security.txt (RFC 9116) — D-H06/D-H07", () => {
  it("declares at least one Contact", () => {
    expect(text).toMatch(/^Contact:\s*\S+/m);
  });

  it("has a parseable, still-future Expires field", () => {
    const m = /^Expires:\s*(\S+)/m.exec(text);
    expect(m, "Expires is required by RFC 9116").toBeTruthy();
    const expires = Date.parse(m[1]);
    expect(Number.isNaN(expires), `unparseable Expires: ${m?.[1]}`).toBe(false);
    expect(expires).toBeGreaterThan(Date.now());
  });
});
