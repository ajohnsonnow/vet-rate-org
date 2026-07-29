import { describe, it, expect } from "vitest";
import {
  parseOgcCitation,
  normalizeOgcYear,
  ogcYearIndexUrl,
  ogcCitationText,
  ogcCanonicalUrl,
} from "../../scripts/legal-ingestion/ogc-citation.mjs";

/**
 * S34 — VA OGC citation→url helper coverage. This module is the accuracy-
 * critical piece that rescues the 468 offline-corpus OGC entries whose url +
 * citation are empty (the citation string lives only in `title`).
 */

describe("parseOgcCitation", () => {
  it("parses a 2-digit 19xx year", () => {
    expect(parseOgcCitation("VAOPGCPREC 3-97")).toEqual({
      number: 3,
      year: 1997,
    });
  });

  it("parses a 4-digit 20xx year", () => {
    expect(parseOgcCitation("VAOPGCPREC 27-2003")).toEqual({
      number: 27,
      year: 2003,
    });
  });

  it("parses another 4-digit year", () => {
    expect(parseOgcCitation("VAOPGCPREC 2-2019")).toEqual({
      number: 2,
      year: 2019,
    });
  });
});

describe("normalizeOgcYear", () => {
  it("87 -> 1987", () => {
    expect(normalizeOgcYear(87)).toBe(1987);
  });

  it("19 -> 2019", () => {
    expect(normalizeOgcYear(19)).toBe(2019);
  });

  it("2019 -> 2019", () => {
    expect(normalizeOgcYear(2019)).toBe(2019);
  });

  it("86 -> null (implausible 2-digit)", () => {
    expect(normalizeOgcYear(86)).toBeNull();
  });

  it("800 -> null (malformed)", () => {
    expect(normalizeOgcYear(800)).toBeNull();
  });

  it("2700 -> null (implausible 4-digit)", () => {
    expect(normalizeOgcYear(2700)).toBeNull();
  });
});

describe("ogcYearIndexUrl", () => {
  it("resolves the canonical per-year index url", () => {
    expect(ogcYearIndexUrl("VAOPGCPREC 3-97")).toBe(
      "https://www.va.gov/OGC/opinions/1997PrecedentOpinions.asp",
    );
  });
});

describe("ogcCitationText", () => {
  it("falls back to title when citation is empty", () => {
    expect(
      ogcCitationText({ citation: "", title: "VAOPGCPREC 10-2010" }),
    ).toMatch(/VAOPGCPREC 10-2010/);
  });
});

describe("ogcCanonicalUrl", () => {
  it("backfills the per-year index url when url+citation are empty but title carries the citation", () => {
    expect(
      ogcCanonicalUrl({ url: "", citation: "", title: "VAOPGCPREC 10-2010" }),
    ).toBe("https://www.va.gov/OGC/opinions/2010PrecedentOpinions.asp");
  });

  it("keeps a real va.gov url unchanged", () => {
    const url = "https://www.va.gov/ogc/docs/2003/PREC_27-2003.pdf";
    expect(ogcCanonicalUrl({ url })).toBe(url);
  });
});
