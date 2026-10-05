import { describe, it, expect } from "vitest";
import {
  collectSections,
  extractFormTitle,
  parseJsonl,
  sectionParagraphs,
  selectParagraphs,
  sliceTopic,
  stitchChunks,
  tidyRegulationText,
} from "../../../scripts/verified-reference/lib/extract.js";

const chunk = (citation, index, text) => ({
  id: `ecfr_${citation.replaceAll(" ", "_")}_${index}`,
  citation,
  text,
  fetched_at: "2026-07-10T01:32:09.234Z",
});

describe("parseJsonl", () => {
  it("parses one record per line and skips blank lines", () => {
    expect(parseJsonl('{"a":1}\n\n{"a":2}\n')).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("refuses a git-lfs pointer instead of returning nothing", () => {
    expect(() =>
      parseJsonl(
        "version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 1\n",
        "ecfr.jsonl",
      ),
    ).toThrow(/git-lfs pointer/);
  });
});

describe("tidyRegulationText", () => {
  it("closes up the spaces the source leaves around designators and links", () => {
    expect(
      tidyRegulationText("( b ) See § 3.160(a) . Thus ( i.e., not combined)"),
    ).toBe("(b) See § 3.160(a). Thus (i.e., not combined)");
  });
});

describe("sectionParagraphs", () => {
  const records = [
    chunk("38 CFR § 9.2", 1, "( b ) Second.\n\n( 1 ) Inner one."),
    chunk(
      "38 CFR § 9.2",
      0,
      "Editorial Note on Part 9\n\nNote text.\n\n§ 9.2 Heading.\n\nIntro text.\n\n( a ) First.",
    ),
    chunk("38 CFR § 9.20", 0, "§ 9.20 Other.\n\n( a ) Not this one."),
  ];

  it("joins a section's chunks in index order and drops text above the heading", () => {
    expect(sectionParagraphs(records, "9.2")).toEqual([
      "§ 9.2 Heading.",
      "Intro text.",
      "(a) First.",
      "(b) Second.",
      "(1) Inner one.",
    ]);
  });

  it("throws when the section is not in the index", () => {
    expect(() => sectionParagraphs(records, "9.99")).toThrow(/9\.99/);
  });
});

describe("selectParagraphs", () => {
  const paragraphs = [
    "§ 9.2 Heading.",
    "Intro text.",
    "(a) First. More of a. Last of a.",
    "(b) Second.",
    "(1) Inner one.",
    "(c) Third.",
  ];

  it("takes paragraphs by their opening words and marks what it skipped", () => {
    expect(selectParagraphs(paragraphs, ["Intro text", "(b) Second"])).toBe(
      "Intro text.\n[...]\n(b) Second.",
    );
  });

  it("takes an inclusive run", () => {
    expect(
      selectParagraphs(paragraphs, [{ from: "(b)", through: "(c)" }]),
    ).toBe("(b) Second.\n(1) Inner one.\n(c) Third.");
  });

  it("splits one paragraph at a sentence boundary", () => {
    expect(
      selectParagraphs(paragraphs, [{ start: "(a) First", firstSentences: 1 }]),
    ).toBe("(a) First.\n[...]");
    expect(
      selectParagraphs(paragraphs, [{ start: "(a) First", afterSentences: 1 }]),
    ).toBe("[...]\nMore of a. Last of a.");
  });

  it("throws when a selector matches nothing or more than one paragraph", () => {
    expect(() => selectParagraphs(paragraphs, ["(z)"])).toThrow(/no paragraph/);
    expect(() => selectParagraphs(paragraphs, ["("])).toThrow(/4 paragraphs/);
  });
});

describe("stitchChunks", () => {
  it("joins overlapping chunks without repeating the overlap", () => {
    const records = [
      { id: "m_1", text: "three four five six" },
      { id: "m_0", text: "one two three four" },
    ];
    expect(stitchChunks(records)).toBe("one two three four five six");
  });

  it("joins chunks that do not overlap with a space", () => {
    expect(
      stitchChunks([
        { id: "m_0", text: "one two" },
        { id: "m_1", text: "three" },
      ]),
    ).toBe("one two three");
  });
});

describe("sliceTopic", () => {
  const text =
    "X.1.a. First Topic Body a. References: see b. X.1.b. Second Topic Body b. X.1.c. Third";

  it("returns a topic up to the next heading, cut at the stop marker", () => {
    expect(
      sliceTopic(text, {
        start: "X.1.a.",
        end: "X.1.b.",
        stopAt: [" References:"],
      }),
    ).toBe("X.1.a. First Topic Body a.");
    expect(sliceTopic(text, { start: "X.1.b.", end: "X.1.c." })).toBe(
      "X.1.b. Second Topic Body b.",
    );
  });

  it("throws when a heading is missing or repeated", () => {
    expect(() => sliceTopic(text, { start: "X.9.", end: "X.1.b." })).toThrow(
      /X\.9\./,
    );
    expect(() =>
      sliceTopic(`${text} X.1.a.`, { start: "X.1.a.", end: "X.1.b." }),
    ).toThrow(/more than once/);
  });
});

describe("extractFormTitle", () => {
  const texts = [
    "send VA Form 20-0995, Decision Review Request: Supplemental Claim, within one year",
    "a VA Form 20-0995, Decision Review Request: Supplemental Claim. When received",
    "VA Form 20-0995, Decision Review Request: Supplemental Claim VA Form 21-4138, Statement in Support",
    "VA Form 20-0995, or other prescribed form",
    "see VA Form 20-0996, Decision Review Request: Higher-Level Review, and",
  ];

  it("returns the words that follow the form number in most mentions", () => {
    expect(extractFormTitle(texts, "20-0995")).toEqual({
      title: "Decision Review Request: Supplemental Claim",
      mentions: 3,
    });
  });

  it("returns null when the title is not stated at least twice", () => {
    expect(extractFormTitle(texts, "20-0996")).toBeNull();
    expect(extractFormTitle(texts, "21-9999")).toBeNull();
  });
});

describe("collectSections", () => {
  it("lists the sections of the requested parts, expanding reserved ranges", () => {
    const records = [
      { citation: "38 CFR § 3.310" },
      { citation: "38 CFR § 3.310" },
      { citation: "38 CFR § 3.18-3.19" },
      { citation: "38 CFR § 3.456-461" },
      { citation: "38 CFR § 4.71a" },
      { citation: "38 CFR § 20.1" },
    ];
    expect(collectSections(records, [3, 4])).toEqual({
      3: [
        "3.18",
        "3.19",
        "3.310",
        "3.456",
        "3.457",
        "3.458",
        "3.459",
        "3.460",
        "3.461",
      ],
      4: ["4.71a"],
    });
  });
});
