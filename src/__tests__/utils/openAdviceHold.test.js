/**
 * What the assistant shows under the fixed message when an open question is
 * held: regulation text found by search, quoted with its citation.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  OPEN_ADVICE_HELD_MESSAGE,
  REGULATION_TEXT_LEAD,
  buildHeldAnswerContent,
  describeRegulationPassages,
} from "../../utils/openAdviceHold";

const PASSAGES = [
  {
    citation: "38 CFR § 3.2500",
    title: "Review of decisions",
    text: "A claimant may request one of the three review options.",
  },
  {
    citation: "38 CFR § 3.2501",
    title: "",
    text: "Supplemental claims.",
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
    expect(out.endsWith("(The text continues in the regulation.)")).toBe(true);
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

  it("shows the fixed message alone when the search finds nothing", async () => {
    const content = await buildHeldAnswerContent("x", async () => []);
    expect(content).toBe(OPEN_ADVICE_HELD_MESSAGE);
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
