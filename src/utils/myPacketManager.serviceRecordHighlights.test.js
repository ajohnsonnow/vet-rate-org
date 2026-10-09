/**
 * D11-5 (final11 QA, 2026-09-27): _formatServiceRecordHighlights printed
 * "Awards: [object Object]; ..." into the packet AI context sent to every
 * AI tool, because `a.name || a` fell through to the whole award object
 * whenever it had no flat `.name` - the real shape award objects have when
 * they came from ribbonRackData.parseDD214Text (Muster Call's regex path).
 * Fixture values are synthetic.
 */
import { describe, it, expect } from "vitest";
import { _formatServiceRecordHighlights } from "./myPacketManager";

// Shape ribbonRackData.parseDD214Text emits (Muster Call's regex path) -
// what actually reaches the packet doc's extractedData.awards for a
// document processed through musterCallProcessor.parseServiceRecord.
const rackAward = (name, matchedText = "") => ({
  award: { name },
  matchedText,
  devices: [],
});

// Shape DD214Analyzer's AI/dd214FieldExtractor path emits - already flat.
const flatAward = (name, abbreviation = "") => ({
  name,
  abbreviation,
  devices: [],
  deviceCount: 0,
  isCombat: false,
});

describe("_formatServiceRecordHighlights: awards line", () => {
  it("prints the real award name for ribbonRackData's nested {award: {name}} shape", () => {
    const out = _formatServiceRecordHighlights({
      awards: [rackAward("Army Commendation Medal", "ARCOM")],
    });
    expect(out).toContain("Awards: Army Commendation Medal");
    expect(out).not.toContain("[object Object]");
  });

  it("prints the real award name for the flat {name} shape", () => {
    const out = _formatServiceRecordHighlights({
      awards: [flatAward("Army Achievement Medal", "AAM")],
    });
    expect(out).toContain("Awards: Army Achievement Medal");
    expect(out).not.toContain("[object Object]");
  });

  it("joins multiple awards of mixed shapes by their real names", () => {
    const out = _formatServiceRecordHighlights({
      awards: [
        rackAward("National Defense Service Medal"),
        flatAward("Good Conduct Medal"),
      ],
    });
    expect(out).toContain(
      "Awards: National Defense Service Medal; Good Conduct Medal",
    );
  });

  it("falls back to a plain string award unchanged", () => {
    const out = _formatServiceRecordHighlights({
      awards: ["Combat Action Badge"],
    });
    expect(out).toContain("Awards: Combat Action Badge");
  });

  it("prints nothing for the awards line when there are no awards", () => {
    const out = _formatServiceRecordHighlights({ awards: [] });
    expect(out).not.toContain("Awards:");
  });
});
