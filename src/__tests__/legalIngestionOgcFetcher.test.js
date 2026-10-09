import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  parseOgcLanding,
  parseOgcYearPage,
} from "../../scripts/legal-ingestion/fetch-ogc.mjs";

/**
 * S34 — VA OGC fetcher pure-function coverage. Fixtures are real captured
 * excerpts of the two-level va.gov crawl (landing page's 26 year-index
 * anchors; one year page's 2 real VAOPGCPREC PDF anchors, trimmed of the
 * unrelated VBA-form/ethics-contact PDFs the live page also links).
 * Network-touching code (fetch()/PDF download in main()) is exercised by the
 * bounded live verification, not here.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const landingHtml = readFileSync(
  path.join(__dirname, "fixtures", "ogc-landing.html"),
  "utf8",
);
const yearHtml = readFileSync(
  path.join(__dirname, "fixtures", "ogc-year-2019.html"),
  "utf8",
);

describe("parseOgcLanding", () => {
  const years = parseOgcLanding(landingHtml);

  it("returns 26 year-index entries", () => {
    expect(years).toHaveLength(26);
  });

  it("every entry has a 4-digit year in 1987..2019 and an absolute va.gov url", () => {
    for (const y of years) {
      expect(y.year).toBeGreaterThanOrEqual(1987);
      expect(y.year).toBeLessThanOrEqual(2019);
      expect(y.url.startsWith("https://www.va.gov")).toBe(true);
    }
  });

  it("includes both 2019 and 1987", () => {
    const yearNumbers = years.map((y) => y.year);
    expect(yearNumbers).toContain(2019);
    expect(yearNumbers).toContain(1987);
  });
});

describe("parseOgcYearPage", () => {
  const opinions = parseOgcYearPage(yearHtml);

  it("returns 2 opinions from the 2019 year page", () => {
    expect(opinions).toHaveLength(2);
  });

  it("every citation matches VAOPGCPREC <n>-2019", () => {
    for (const o of opinions) {
      expect(o.citation).toMatch(/VAOPGCPREC \d+-2019/);
    }
  });

  it("every pdfUrl is absolute under https://www.va.gov/OGC/docs/2019/ and contains VAOPGCPREC", () => {
    for (const o of opinions) {
      expect(o.pdfUrl.startsWith("https://www.va.gov/OGC/docs/2019/")).toBe(
        true,
      );
      expect(o.pdfUrl.endsWith(".pdf")).toBe(true);
      expect(o.pdfUrl).toContain("VAOPGCPREC");
    }
  });

  it("populates number/year for both opinions (2 & 3, year 2019)", () => {
    const numbers = opinions.map((o) => o.number).sort();
    expect(numbers).toEqual([2, 3]);
    for (const o of opinions) {
      expect(o.year).toBe(2019);
    }
  });
});
