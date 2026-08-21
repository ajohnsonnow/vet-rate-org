import { describe, it, expect } from "vitest";
import {
  extractChildTopics,
  extractArticles,
  citationFor,
  articlePortalUrl,
} from "../../scripts/legal-ingestion/fetch-m21-4.mjs";

/**
 * S44 follow-up - M21-4 fetcher pure-function coverage. Same KnowVA "Self
 * Service v11" JSON content API as M21-1/M21-5 (extractChildTopics/
 * extractArticles fixtures mirror the identical response shapes), but
 * citationFor differs - M21-4 uses flat "Chapter N. Title" / "Appendix X.
 * Title" naming (verified live against all 15 real articles), not M21-1's
 * Roman-numeral or M21-5's "Chapter N, Section X" conventions.
 * Network-touching functions are exercised by the bounded live verification,
 * not here.
 */

describe("extractChildTopics", () => {
  it("pulls the direct children out of a /topic $level=2 response", () => {
    const json = {
      topicTree: [
        {
          topic: { id: "root", name: "M21-4", articleCount: 0, childCount: 2 },
          topicTree: [
            {
              topic: {
                id: "c1",
                name: "Chapter 1. Overview",
                articleCount: 1,
                childCount: 0,
              },
            },
            {
              topic: {
                id: "c2",
                name: "Appendix A. Station Numbers",
                articleCount: 1,
                childCount: 0,
              },
            },
          ],
        },
      ],
    };
    const kids = extractChildTopics(json);
    expect(kids.map((t) => t.id)).toEqual(["c1", "c2"]);
    expect(kids[1].articleCount).toBe(1);
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
  it("extracts a Chapter reference", () => {
    expect(citationFor("Chapter 1. Overview")).toBe("M21-4 Ch. 1");
    expect(citationFor("Chapter 6.  Quality Review Team (QRT)")).toBe(
      "M21-4 Ch. 6",
    );
  });

  it("extracts an Appendix reference", () => {
    expect(
      citationFor(
        "Appendix A. Regional Office Station Numbers, Payee Codes, and Work-Rate Standards",
      ),
    ).toBe("M21-4 App. A");
    expect(
      citationFor("Appendix F.  Fiduciary Workflow Stage Indicators"),
    ).toBe("M21-4 App. F");
  });

  it("handles a Rescinded chapter the same as any other chapter", () => {
    expect(citationFor("Chapter 4. Rescinded")).toBe("M21-4 Ch. 4");
    expect(citationFor("Chapter 9. Rescinded")).toBe("M21-4 Ch. 9");
  });

  it("falls back to a truncated title when there is no Chapter/Appendix prefix", () => {
    expect(citationFor("M21-4 Manual Overview Page")).toBe(
      "M21-4 - M21-4 Manual Overview Page",
    );
  });

  it("never produces a citation-less record", () => {
    expect(citationFor("")).toBe("M21-4");
    expect(citationFor(null)).toBe("M21-4");
    expect(citationFor(undefined)).toBe("M21-4");
  });
});

describe("articlePortalUrl", () => {
  it("builds a va.gov deep link the sanitizer's gov allow-list preserves", () => {
    const url = articlePortalUrl("554400000004202");
    expect(url).toContain("https://www.knowva.ebenefits.va.gov");
    expect(url).toContain("/article/554400000004202");
    expect(/https:\/\/[^/]*\.va\.gov\//.test(url)).toBe(true);
  });
});
