import { describe, it, expect } from "vitest";
import {
  extractChildTopics,
  extractArticles,
  citationFor,
  articlePortalUrl,
} from "../../scripts/legal-ingestion/fetch-m21-5.mjs";

/**
 * S44 — M21-5 fetcher pure-function coverage. Same KnowVA "Self Service v11"
 * JSON content API as M21-1 (extractChildTopics/extractArticles fixtures
 * mirror the identical response shapes), but citationFor differs — M21-5
 * article names use "Chapter N, Section X" (verified live against real
 * articles), not M21-1's Roman-numeral Part.Chapter.Section convention.
 * Network-touching functions are exercised by the bounded live verification,
 * not here.
 */

describe("extractChildTopics", () => {
  it("pulls the direct children out of a /topic $level=2 response", () => {
    const json = {
      topicTree: [
        {
          topic: { id: "root", name: "M21-5", articleCount: 0, childCount: 2 },
          topicTree: [
            {
              topic: {
                id: "c1",
                name: "Chapter 1",
                articleCount: 0,
                childCount: 3,
              },
            },
            {
              topic: {
                id: "c2",
                name: "Chapter 2",
                articleCount: 5,
                childCount: 0,
              },
            },
          ],
        },
      ],
    };
    const kids = extractChildTopics(json);
    expect(kids.map((t) => t.id)).toEqual(["c1", "c2"]);
    expect(kids[1].articleCount).toBe(5);
  });

  it("returns [] when the root has no children or the shape is empty", () => {
    expect(extractChildTopics({ topicTree: [{ topic: { id: "x" } }] })).toEqual(
      [],
    );
    expect(extractChildTopics({ topicTree: [] })).toEqual([]);
    expect(extractChildTopics({})).toEqual([]);
    expect(extractChildTopics(null)).toEqual([]);
  });
});

describe("extractArticles", () => {
  it("normalizes an array of articles", () => {
    const json = { article: [{ id: "a1" }, { id: "a2" }], pagingInfo: {} };
    expect(extractArticles(json).map((a) => a.id)).toEqual(["a1", "a2"]);
  });

  it("wraps a single article object into an array", () => {
    expect(extractArticles({ article: { id: "solo" } })).toEqual([
      { id: "solo" },
    ]);
  });

  it("returns [] for an empty / missing article field", () => {
    expect(extractArticles({ article: [] })).toEqual([]);
    expect(extractArticles({})).toEqual([]);
    expect(extractArticles(null)).toEqual([]);
  });
});

describe("citationFor", () => {
  it("extracts an M21-5 Chapter/Section reference when present", () => {
    expect(
      citationFor("M21-5, Chapter 7, Section B - Notice of Disagreement (NOD)"),
    ).toBe("M21-5 Ch. 7, Sec. B");
    expect(
      citationFor("M21-5, Chapter 5 Section A - General Information on HLRs"),
    ).toBe("M21-5 Ch. 5, Sec. A");
  });

  it("falls back to a truncated title when there is no Chapter/Section reference", () => {
    expect(citationFor("M21-5, Appeals and Reviews, Overview")).toBe(
      "M21-5 — M21-5, Appeals and Reviews, Overview",
    );
  });

  it("never produces a citation-less record", () => {
    expect(citationFor("")).toBe("M21-5");
    expect(citationFor(null)).toBe("M21-5");
    expect(citationFor(undefined)).toBe("M21-5");
  });
});

describe("articlePortalUrl", () => {
  it("builds a va.gov deep link the sanitizer's gov allow-list preserves", () => {
    const url = articlePortalUrl("554400000029706");
    expect(url).toContain("https://www.knowva.ebenefits.va.gov");
    expect(url).toContain("/article/554400000029706");
    // must be a .va.gov host so sanitize-html.mjs keeps it as a real citation
    expect(/https:\/\/[^/]*\.va\.gov\//.test(url)).toBe(true);
  });
});
