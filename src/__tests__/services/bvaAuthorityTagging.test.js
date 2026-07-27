import { describe, it, expect } from "vitest";
import {
  tagBvaEntry,
  parseDecisionYear,
  parseDisposition,
  citesBindingAuthority,
  citationWeight,
  BVA_AUTHORITY_BASIS,
  BVA_CAVEAT,
} from "../../services/bvaAuthorityTagging.js";

/**
 * S32 — BVA authority tagging. The load-bearing guarantee is that EVERY BVA
 * entry is tagged non-precedential / non-binding (38 CFR § 20.1303) — asserted
 * over a representative spread of dispositions/years so no code path can emit a
 * BVA tag that reads as binding authority.
 */

const entry = (over = {}) => ({
  title: "BVA DENIED - Sleep Apnea",
  content:
    "ORDER: Service connection for sleep apnea is denied. FINDING: The Veteran's " +
    "sleep apnea is not related to service. See 38 C.F.R. § 3.303 and Shedden v. " +
    "Principi, 381 F.3d 1163 (Fed. Cir. 2004).",
  url: "https://www.va.gov/vetapp25/Files1/19167246.txt",
  ...over,
});

describe("BVA tagging — the never-binding guarantee", () => {
  it("marks every entry non-precedential and non-binding, whatever the disposition", () => {
    const samples = [
      entry(),
      entry({
        title: "BVA GRANTED - PTSD",
        content: "ORDER: Service connection for PTSD is granted.",
      }),
      entry({
        title: "BVA REMANDED - Knee",
        content: "ORDER: The claim is remanded.",
      }),
      entry({
        title: "Some Untagged Title",
        content: "No disposition language here at all.",
      }),
      entry({ url: "https://www.va.gov/vetapp92/files/9200123.txt" }),
      entry({ url: "not-a-vetapp-url", content: "short" }),
    ];
    for (const s of samples) {
      const tag = tagBvaEntry(s);
      expect(tag.precedential).toBe(false);
      expect(tag.binding).toBe(false);
      expect(tag.precedential_confidence).toBe(1.0);
      expect(tag.authority_basis).toBe(BVA_AUTHORITY_BASIS);
      expect(tag.caveat).toBe(BVA_CAVEAT);
      expect(tag.citation_weight).toBeGreaterThanOrEqual(0);
      expect(tag.citation_weight).toBeLessThanOrEqual(1);
    }
  });

  it("authority basis cites the controlling regulation", () => {
    expect(BVA_AUTHORITY_BASIS).toMatch(/20\.1303/);
    expect(BVA_CAVEAT.toLowerCase()).toContain("non-precedential");
    expect(BVA_CAVEAT.toLowerCase()).toContain("never binding");
  });
});

describe("parseDecisionYear", () => {
  it("reads the year from a vetapp URL segment", () => {
    expect(
      parseDecisionYear("https://www.va.gov/vetapp25/Files1/19167246.txt"),
    ).toBe(2025);
    expect(
      parseDecisionYear("https://www.va.gov/vetapp99/files/9900001.txt"),
    ).toBe(1999);
    expect(parseDecisionYear("https://www.va.gov/vetapp00/files/x.txt")).toBe(
      2000,
    );
  });
  it("returns null when there is no vetapp segment", () => {
    expect(parseDecisionYear("https://example.com/x")).toBeNull();
    expect(parseDecisionYear("")).toBeNull();
    expect(parseDecisionYear(null)).toBeNull();
  });
});

describe("parseDisposition", () => {
  it("prefers the title marker", () => {
    expect(parseDisposition("BVA GRANTED - X", "irrelevant")).toBe("granted");
    expect(parseDisposition("BVA DENIED - X", "irrelevant")).toBe("denied");
    expect(parseDisposition("BVA REMANDED - X", "")).toBe("remanded");
  });
  it("falls back to ORDER-line body language and detects mixed", () => {
    expect(parseDisposition("", "ORDER: the claim is granted.")).toBe(
      "granted",
    );
    expect(parseDisposition("", "ORDER: service connection is denied.")).toBe(
      "denied",
    );
    expect(
      parseDisposition(
        "",
        "ORDER: hearing loss is granted. Tinnitus is denied.",
      ),
    ).toBe("mixed");
    expect(parseDisposition("", "no disposition words")).toBe("unknown");
  });
});

describe("citesBindingAuthority", () => {
  it("detects statute, regulation, and court citations", () => {
    expect(citesBindingAuthority("per 38 C.F.R. § 3.303")).toBe(true);
    expect(citesBindingAuthority("under 38 U.S.C. 1110")).toBe(true);
    expect(citesBindingAuthority("see 12 Vet. App. 247")).toBe(true);
    expect(citesBindingAuthority("381 F.3d 1163 (Fed. Cir. 2004)")).toBe(true);
    expect(citesBindingAuthority("just facts, no citations")).toBe(false);
  });
});

describe("citationWeight", () => {
  it("is bounded and rewards recency + binding-authority grounding", () => {
    const recentGrounded = citationWeight({
      year: 2025,
      citesBinding: true,
      disposition: "granted",
      contentLength: 4000,
    });
    const oldBare = citationWeight({
      year: 1992,
      citesBinding: false,
      disposition: "unknown",
      contentLength: 100,
    });
    expect(recentGrounded).toBeGreaterThan(oldBare);
    expect(recentGrounded).toBeLessThanOrEqual(1);
    expect(oldBare).toBeGreaterThanOrEqual(0);
  });
  it("is deterministic (no wall-clock dependence)", () => {
    const args = {
      year: 2010,
      citesBinding: true,
      disposition: "denied",
      contentLength: 2000,
    };
    expect(citationWeight(args)).toBe(citationWeight(args));
  });
});
