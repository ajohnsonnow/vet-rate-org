import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  parseCavcRss,
  dispositionFromSummary,
  citationFromCavcEntry,
} from "../../scripts/legal-ingestion/fetch-cavc.mjs";

/**
 * S33 — CAVC fetcher pure-function coverage. The fixture is a real captured
 * excerpt of the court's recentdecisions.rss feed (3 entries); network-touching
 * code (the fetch() call in main()) is exercised by the bounded live
 * verification, not here.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(__dirname, "fixtures", "cavc-recent.rss");
const fixtureXml = readFileSync(FIXTURE_PATH, "utf8");

describe("parseCavcRss", () => {
  const entries = parseCavcRss(fixtureXml);

  it("parses all 3 entries from the fixture feed", () => {
    expect(entries).toHaveLength(3);
  });

  it("every entry has a non-empty caseNum, parties, and efiling source_url", () => {
    for (const entry of entries) {
      expect(entry.caseNum).toBeTruthy();
      expect(entry.parties).toBeTruthy();
      expect(
        entry.source_url.startsWith("https://efiling.uscourts.cavc.gov"),
      ).toBe(true);
    }
  });

  it("extracts the docket number and party names for the first entry", () => {
    expect(entries[0].caseNum).toBe("25-1124");
    expect(entries[0].parties).toBe("Rocco David Ross v. Douglas A. Collins");
  });

  it("decodes the &amp;-escaped link into a clean source_url", () => {
    expect(entries[0].source_url).not.toContain("&amp;");
    expect(entries[0].source_url).toContain("caseNum=25-1124");
  });
});

describe("dispositionFromSummary", () => {
  it("classifies a single-outcome AFFIRMED summary", () => {
    expect(
      dispositionFromSummary(
        "Memorandum Decision that the January 13, 2025, Board decision is AFFIRMED. (FALVEY)",
      ),
    ).toBe("AFFIRMED");
  });

  it("classifies a DISMISSED summary", () => {
    expect(
      dispositionFromSummary(
        "Memorandum Decision that the appeal ... is dismissed.",
      ),
    ).toBe("DISMISSED");
  });

  it("classifies a SETS ASIDE summary as VACATED", () => {
    expect(
      dispositionFromSummary(
        "The Court SETS ASIDE the February 25, 2025, Board decision.",
      ),
    ).toBe("VACATED");
  });

  it("returns MIXED when more than one distinct outcome verb is present", () => {
    expect(
      dispositionFromSummary(
        "The Board decision is AFFIRMED in part and REMANDED in part for further development.",
      ),
    ).toBe("MIXED");
  });

  it("returns UNKNOWN when no recognized outcome verb is present", () => {
    expect(dispositionFromSummary("The Court held oral argument.")).toBe(
      "UNKNOWN",
    );
  });
});

describe("citationFromCavcEntry", () => {
  it("builds a docket-number citation for a non-precedential memorandum decision", () => {
    const entries = parseCavcRss(fixtureXml);
    const citation = citationFromCavcEntry(entries[0]);
    expect(citation).toContain("No. 25-1124");
    expect(citation).toContain("Vet. App.");
  });
});
