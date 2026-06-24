import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A-H11 / D-H03: GoatCounter analytics ships on every page (index.html). Public
 * marketing copy must therefore not claim "no analytics" / "zero data collection"
 * — a demonstrably false claim on an easy item corrodes trust in the privacy
 * claims that carry legal and human stakes. S1 guarded README + faq; the S5
 * residual sweep extends this to the other user-facing trust surfaces (support
 * page, docs landing, and the legal privacy policy).
 */
const read = (p) => readFileSync(join(process.cwd(), p), "utf8");

const SURFACES = [
  "README.md",
  "public/faq.html",
  "public/support.html",
  "docs/index.md",
  "docs/legal/privacy-policy.md",
];
const FALSE_CLAIMS = [
  /no analytics/i,
  /zero data collection/i,
  /zero analytics/i,
];

describe("marketing copy matches shipped analytics (A-H11/D-H03)", () => {
  it("GoatCounter actually ships, so this guard is meaningful", () => {
    expect(read("index.html").toLowerCase()).toContain("goatcounter");
  });

  for (const file of SURFACES) {
    it(`${file} makes no false 'no analytics' / 'zero data collection' claim`, () => {
      const text = read(file);
      for (const claim of FALSE_CLAIMS) {
        expect(
          claim.test(text),
          `${file} still contains a false claim matching ${claim}`,
        ).toBe(false);
      }
    });

    it(`${file} acknowledges GoatCounter analytics`, () => {
      expect(read(file).toLowerCase()).toContain("goatcounter");
    });
  }
});
