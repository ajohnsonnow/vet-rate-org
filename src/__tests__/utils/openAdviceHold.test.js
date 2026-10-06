/**
 * ADR-010 sections 11 and 13: an open question held from a small-class model
 * gets the fixed message and nothing else. The regulation search is not run
 * and no passage is shown under it: on the measured golden questions 16 of
 * the 33 top passages were not on the question and no score separated them.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as hold from "../../utils/openAdviceHold";
import relevance from "./fixtures/regulationSearchRelevance.json";

const read = (...parts) => readFileSync(join(process.cwd(), ...parts), "utf8");

describe("the held answer", () => {
  it("is the fixed message, flagged as held, and points to Ask the Regs", () => {
    expect(hold.openAdviceHeldAnswer()).toEqual({
      text: hold.OPEN_ADVICE_HELD_MESSAGE,
      openAdviceHeld: true,
    });
    expect(hold.OPEN_ADVICE_HELD_MESSAGE).toMatch(/Ask the Regs/);
  });

  it("carries no search, passage builder, relevance floor or download line", () => {
    expect(Object.keys(hold).sort()).toEqual([
      "OPEN_ADVICE_HELD_MESSAGE",
      "openAdviceHeldAnswer",
    ]);
  });

  it("is what the assistant shows: it does not load the regulation search", () => {
    const assistant = read("src", "components", "AIAssistant.jsx");
    expect(assistant).not.toMatch(/retrieveRegulationText|legalAnswerer/);
    expect(assistant).not.toMatch(/buildHeldAnswerContent/);
    expect(assistant).toMatch(/OPEN_ADVICE_HELD_MESSAGE/);
  });
});

describe("the evidence kept for the decision", () => {
  it("is the measured table: 33 top passages, 16 not on the question, overlapping scores", () => {
    const rows = relevance.rows;
    expect(rows).toHaveLength(33);
    const off = rows.filter((r) => r.relevant === "n");
    const on = rows.filter((r) => r.relevant === "y");
    expect(off).toHaveLength(16);
    expect(on).toHaveLength(17);
    const highestOff = Math.max(...off.map((r) => r.score));
    const lowestOn = Math.min(...on.map((r) => r.score));
    expect(highestOff).toBeGreaterThan(lowestOn);
  });
});
