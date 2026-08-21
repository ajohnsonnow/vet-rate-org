import { describe, it, expect } from "vitest";
import {
  extractChildTopics,
  extractArticles,
  citationFor,
  articlePortalUrl,
} from "../../scripts/legal-ingestion/fetch-m21-1.mjs";

/**
 * S31 - M21-1 fetcher pure-function coverage. The fetcher drives the KnowVA
 * "Self Service v11" JSON content API; these fixtures mirror the exact response
 * shapes observed against the live portal (topicTree nesting, article wrapper
 * that is an array or a lone object). Network-touching functions are exercised
 * by the bounded live verification, not here.
 */

describe("extractChildTopics", () => {
  it("pulls the direct children out of a /topic $level=2 response", () => {
    const json = {
      topicTree: [
        {
          topic: { id: "root", name: "M21-1", articleCount: 0, childCount: 2 },
          topicTree: [
            {
              topic: {
                id: "p1",
                name: "Part 01",
                articleCount: 0,
                childCount: 3,
              },
            },
            {
              topic: {
                id: "p2",
                name: "Part 02",
                articleCount: 5,
                childCount: 0,
              },
            },
          ],
        },
      ],
    };
    const kids = extractChildTopics(json);
    expect(kids.map((t) => t.id)).toEqual(["p1", "p2"]);
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
  it("extracts an M21-1 roman-numeral section reference when present", () => {
    expect(citationFor("III.iv.4.B - Evaluating Claims")).toBe(
      "M21-1 III.iv.4.B",
    );
    expect(citationFor("Part IV.ii.1.A Overview")).toBe("M21-1 IV.ii.1.A");
  });

  it("falls back to a truncated title when there is no section reference", () => {
    expect(citationFor("2016-02-05 Memorandum of Changes")).toBe(
      "M21-1 - 2016-02-05 Memorandum of Changes",
    );
  });

  it("never produces a citation-less record", () => {
    expect(citationFor("")).toBe("M21-1");
    expect(citationFor(null)).toBe("M21-1");
    expect(citationFor(undefined)).toBe("M21-1");
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
