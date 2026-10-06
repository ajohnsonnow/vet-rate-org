/**
 * What the assistant shows under the fixed message when an open question is
 * held: regulation text found by search, quoted with its citation.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import relevance from "./fixtures/regulationSearchRelevance.json";
import {
  OPEN_ADVICE_HELD_MESSAGE,
  NO_MATCHING_REGULATION_TEXT,
  PASSAGE_RELEVANCE_FLOOR,
  REGULATION_SEARCH_DISCLOSURE,
  REGULATION_TEXT_LEAD,
  buildHeldAnswerContent,
  describeRegulationPassages,
} from "../../utils/openAdviceHold";

const PASSAGES = [
  {
    citation: "38 CFR § 3.2500",
    title: "Review of decisions",
    text: "A claimant may request one of the three review options.",
    score: 0.7,
  },
  {
    citation: "38 CFR § 3.2501",
    title: "",
    text: "Supplemental claims.",
    score: 0.65,
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("describeRegulationPassages", () => {
  it("quotes each passage under its citation and says no AI wrote it", () => {
    expect(REGULATION_TEXT_LEAD).toBe(
      "Regulation text found by searching for your question. It is quoted from the regulations, not written by AI, and it may not be the part that applies to you:",
    );
    expect(describeRegulationPassages(PASSAGES)).toBe(
      [
        REGULATION_TEXT_LEAD,
        "**38 CFR § 3.2500 - Review of decisions**",
        "A claimant may request one of the three review options.",
        "**38 CFR § 3.2501**",
        "Supplemental claims.",
        REGULATION_SEARCH_DISCLOSURE,
      ].join("\n\n"),
    );
  });

  it("cuts a very long passage and says the text continues", () => {
    const long = {
      citation: "38 CFR § 4.71a",
      title: "",
      text: "x".repeat(4000),
    };
    const out = describeRegulationPassages([long]);
    expect(out.length).toBeLessThan(2000);
    expect(out).toContain("(The text continues in the regulation.)");
    expect(out.endsWith(REGULATION_SEARCH_DISCLOSURE)).toBe(true);
  });
});

describe("buildHeldAnswerContent", () => {
  it("puts the regulation text under the fixed message", async () => {
    const retrieve = vi.fn().mockResolvedValue(PASSAGES);
    const content = await buildHeldAnswerContent("Can I appeal?", retrieve);
    expect(retrieve).toHaveBeenCalledWith("Can I appeal?");
    expect(content).toBe(
      `${OPEN_ADVICE_HELD_MESSAGE}\n\n${describeRegulationPassages(PASSAGES)}`,
    );
  });

  it("says no closely matching text was found when the search finds nothing", async () => {
    const content = await buildHeldAnswerContent("x", async () => []);
    expect(content).toBe(
      `${OPEN_ADVICE_HELD_MESSAGE}

${NO_MATCHING_REGULATION_TEXT}`,
    );
  });

  it("shows the fixed message alone, and logs, when the search fails", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const content = await buildHeldAnswerContent("x", async () => {
      throw new Error("index not loaded");
    });
    expect(content).toBe(OPEN_ADVICE_HELD_MESSAGE);
    expect(logged).toHaveBeenCalledTimes(1);
  });
});

describe("the relevance floor", () => {
  const passage = (score, over = {}) => ({
    citation: `38 CFR § ${score}`,
    title: "T",
    text: "Some regulation text.",
    score,
    ...over,
  });

  it("is the value chosen from the measured scores", () => {
    expect(PASSAGE_RELEVANCE_FLOOR).toBeCloseTo(0.58, 5);
  });

  it("drops passages below the floor and keeps the rest", async () => {
    const content = await buildHeldAnswerContent("q", async () => [
      passage(0.54),
      passage(0.7),
      passage(0.5799),
      passage(PASSAGE_RELEVANCE_FLOOR),
    ]);
    expect(content).toContain("§ 0.7");
    expect(content).toContain(`§ ${PASSAGE_RELEVANCE_FLOOR}`);
    expect(content).not.toContain("§ 0.54");
    expect(content).not.toContain("§ 0.5799");
  });

  it("shows no passages, and the fixed sentence, when every hit is below the floor", async () => {
    const content = await buildHeldAnswerContent("q", async () => [
      passage(0.5405, { citation: "38 CFR § 3.309" }),
    ]);
    expect(content).toBe(
      `${OPEN_ADVICE_HELD_MESSAGE}

${NO_MATCHING_REGULATION_TEXT}`,
    );
    expect(content).not.toContain("3.309");
    expect(NO_MATCHING_REGULATION_TEXT).toBe(
      "No closely matching regulation text was found; try Ask the Regs with the regulation's words.",
    );
  });

  it("drops a [Reserved] placeholder however well it scores", async () => {
    const content = await buildHeldAnswerContent("q", async () => [
      passage(0.9, { title: "[Reserved]", citation: "38 CFR § 4.47-4.54" }),
    ]);
    expect(content).not.toContain("4.47-4.54");
    expect(content).toContain(NO_MATCHING_REGULATION_TEXT);
  });

  it("drops a passage with no score rather than trusting it", async () => {
    const content = await buildHeldAnswerContent("q", async () => [
      { citation: "38 CFR § 1", title: "", text: "x" },
    ]);
    expect(content).toContain(NO_MATCHING_REGULATION_TEXT);
  });

  it("applies to what the recorded search measured: it drops the lowest-scoring hits, which are mostly not on the question, and also some that were", () => {
    const below = relevance.rows.filter(
      (r) => r.score < PASSAGE_RELEVANCE_FLOOR,
    );
    expect(below.map((r) => r.id).sort()).toEqual(
      ["a07", "a19", "a21", "a23", "a29", "x2", "x3", "x4"].sort(),
    );
    expect(below.filter((r) => r.relevant === "n")).toHaveLength(4);
    expect(below.filter((r) => r.relevant === "y")).toHaveLength(4);
    expect(relevance.rows).toHaveLength(33);
  });
});

describe("what the veteran is told about the search", () => {
  it("says a search model downloads on first use, from where, and that the question stays on the device", () => {
    expect(REGULATION_SEARCH_DISCLOSURE).toMatch(/first time/i);
    expect(REGULATION_SEARCH_DISCLOSURE).toMatch(/Hugging Face/);
    expect(REGULATION_SEARCH_DISCLOSURE).toMatch(/about 34 MB/);
    expect(REGULATION_SEARCH_DISCLOSURE).toMatch(
      /your question is not sent there/i,
    );
  });
});
