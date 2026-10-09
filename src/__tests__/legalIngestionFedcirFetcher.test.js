import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  parseFedcirPosts,
  isVeteransOrigin,
  pdfUrlFromContent,
  citationFromFedcirTitle,
} from "../../scripts/legal-ingestion/fetch-fedcir.mjs";
import { FEDCIR_KEY_CASES } from "../../scripts/legal-ingestion/fedcir-key-cases.mjs";

/**
 * S33 — Federal Circuit fetcher pure-function coverage. The fixture is a real
 * captured excerpt of the court's WP-REST Opinion-Order feed (categories=27,
 * 5 posts); network-touching code (fetch()/PDF download in main()) is
 * exercised by the bounded live verification, not here.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(__dirname, "fixtures", "fedcir-posts.json");
const fixturePosts = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));

describe("parseFedcirPosts", () => {
  const parsed = parseFedcirPosts(fixturePosts);

  it("parses all 5 posts from the fixture", () => {
    expect(parsed).toHaveLength(5);
  });

  it("exactly 1 post passes isVeteransOrigin (the CAVC-origin WALKER case)", () => {
    const veteransCases = parsed.filter((p) => isVeteransOrigin(p.origin));
    expect(veteransCases).toHaveLength(1);
    expect(veteransCases[0].appealNumber).toBe("25-1783");
    expect(veteransCases[0].origin).toBe("CAVC");
  });

  it("extracts an absolute PDF url for the CAVC-origin case", () => {
    const walker = parsed.find((p) => p.appealNumber === "25-1783");
    expect(walker.pdfUrl).toMatch(
      /^https:\/\/www\.cafc\.uscourts\.gov\/opinions-orders\/.+\.pdf$/,
    );
  });

  it("marks non-veterans origins (DCT/RIT/CFC/PTO) correctly", () => {
    const origins = parsed.map((p) => p.origin).sort();
    expect(origins).toEqual(["CAVC", "CFC", "DCT", "PTO", "RIT"]);
  });
});

describe("pdfUrlFromContent", () => {
  it("returns an absolute https url, absolutizing a site-relative href", () => {
    const html =
      '<p><a href="/opinions-orders/25-1783.OPINION.7-15-2026_2723053.pdf">link</a></p>';
    expect(pdfUrlFromContent(html)).toBe(
      "https://www.cafc.uscourts.gov/opinions-orders/25-1783.OPINION.7-15-2026_2723053.pdf",
    );
  });

  it("returns null when no pdf href is present", () => {
    expect(pdfUrlFromContent("<p>no link here</p>")).toBeNull();
  });
});

describe("isVeteransOrigin", () => {
  it("is false for DCT (district court)", () => {
    expect(isVeteransOrigin("DCT")).toBe(false);
  });

  it("is true for CAVC", () => {
    expect(isVeteransOrigin("CAVC")).toBe(true);
  });

  it("is true for DVA", () => {
    expect(isVeteransOrigin("DVA")).toBe(true);
  });
});

describe("citationFromFedcirTitle", () => {
  it("builds a parties + docket + year citation", () => {
    const citation = citationFromFedcirTitle(
      "25-1783: WALKER v. COLLINS [OPINION], Nonprecedential",
      2026,
    );
    expect(citation).toBe("WALKER v. COLLINS, No. 25-1783 (Fed. Cir. 2026)");
  });
});

describe("FEDCIR_KEY_CASES", () => {
  it("has at least 20 curated seed cases", () => {
    expect(FEDCIR_KEY_CASES.length).toBeGreaterThanOrEqual(20);
  });

  it("every entry has name/citation/year/holding, with a real reporter or court cite", () => {
    for (const c of FEDCIR_KEY_CASES) {
      expect(c.name).toBeTruthy();
      expect(c.citation).toBeTruthy();
      expect(typeof c.year).toBe("number");
      expect(c.holding).toBeTruthy();
      expect(/F\.(3d|4th|Supp)|Fed\. Cir\./.test(c.citation)).toBe(true);
    }
  });
});
