/**
 * C-File analysis performance guards: the boilerplate page screen must cut
 * LLM work without ever discarding claim-relevant content, and must fail
 * open (analyze everything) when in doubt.
 */
import { describe, it, expect } from "vitest";
import { screenRelevantPages } from "../../utils/cfileAnalyzer";

const page = (num, body) => `--- PAGE ${num} ---\n${body}\n\n`;

const BOILERPLATE = "This page intentionally left blank for filing purposes.";
const RELEVANT =
  "Veteran reports chronic knee pain since deployment, diagnosed 2014-05-12.";

describe("screenRelevantPages", () => {
  it("leaves short documents untouched (under the 10-page floor)", () => {
    const text = page(1, BOILERPLATE) + page(2, BOILERPLATE);
    const out = screenRelevantPages(text);
    expect(out.text).toBe(text);
    expect(out.skippedPages).toBe(0);
  });

  it("drops boilerplate pages and keeps relevant ones with markers intact", () => {
    let text = "";
    for (let i = 1; i <= 12; i++) {
      text += page(i, i % 2 === 0 ? RELEVANT : BOILERPLATE);
    }
    const out = screenRelevantPages(text);
    expect(out.totalPages).toBe(12);
    expect(out.skippedPages).toBe(6);
    expect(out.text).toContain("--- PAGE 2 ---");
    expect(out.text).not.toContain("--- PAGE 1 ---");
    expect(out.text).toContain("knee pain");
  });

  it("keeps pages that only have a date signal", () => {
    let text = "";
    for (let i = 1; i <= 12; i++) {
      text += page(i, i === 5 ? "Entry recorded 03/14/2008." : BOILERPLATE);
    }
    const out = screenRelevantPages(text);
    expect(out.text).toContain("--- PAGE 5 ---");
  });

  it("fails open when the filter would discard nearly everything", () => {
    let text = "";
    for (let i = 1; i <= 20; i++) {
      text += page(i, BOILERPLATE);
    }
    const out = screenRelevantPages(text);
    expect(out.text).toBe(text);
    expect(out.skippedPages).toBe(0);
  });
});
