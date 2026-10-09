/**
 * Characterization coverage for resolveAwardsContinuationText (internal to
 * dd214FieldExtractor.js's parseAwardsString), added while splitting it up
 * to satisfy sonarjs/cognitive-complexity. No existing test exercised this
 * helper directly, so these pin its three reachable outcomes before the
 * refactor: no continuation marker (no-op), the primary "CONT...BLOCK 13"
 * match terminated by a "//", and the broader fallback match with no "//"
 * terminator at all.
 */
import { describe, it, expect } from "vitest";
import { extractDD214Fields } from "../../utils/dd214FieldExtractor";

const dd214 = (block13, block18 = "") => `
CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY
1. NAME (Last, First, Middle): SMITH, JOHN A
4a. GRADE, RATE OR RANK: SGT
BLOCK 13: ${block13}
14. MILITARY EDUCATION: NONE
BLOCK 18: ${block18}
`;

const awardNamesOf = (block13, block18) =>
  extractDD214Fields(dd214(block13, block18)).fields.awards.map((a) => a.name);

describe("dd214FieldExtractor: awards continuation resolution", () => {
  it("with no continuation marker, Block 18 remarks are not pulled into the awards list", () => {
    const names = awardNamesOf(
      "ARMY SERVICE RIBBON//NATIONAL DEFENSE SERVICE MEDAL//NOTHING FOLLOWS",
      "GOOD CONDUCT MEDAL",
    );
    expect(names).toContain("ARMY SERVICE RIBBON");
    expect(names).toContain("NATIONAL DEFENSE SERVICE MEDAL");
    expect(names).not.toContain("GOOD CONDUCT MEDAL");
  });

  it("pulls in the Block 18 continuation when it's terminated by '//NOTHING FOLLOWS'", () => {
    const names = awardNamesOf(
      "ARMY SERVICE RIBBON CONT FROM BLOCK 13",
      "CONT FROM BLOCK 13: ARMY ACHIEVEMENT MEDAL//NOTHING FOLLOWS",
    );
    expect(names).toContain("ARMY ACHIEVEMENT MEDAL");
  });

  it("the strict match accepts a continuation label with no FROM/IN, which the broad fallback cannot", () => {
    const names = awardNamesOf(
      "ARMY SERVICE RIBBON",
      "SEE REMARKS CONT BLOCK 13: ARMY ACHIEVEMENT MEDAL//NOTHING FOLLOWS",
    );
    expect(names).toContain("ARMY ACHIEVEMENT MEDAL");
  });

  it("falls back to the broader match when the continuation has no '//' terminator at all", () => {
    const names = awardNamesOf(
      "ARMY SERVICE RIBBON CONT FROM BLOCK 13",
      "CONT FROM BLOCK 13: ARMY ACHIEVEMENT MEDAL",
    );
    expect(names).toContain("ARMY ACHIEVEMENT MEDAL");
  });
});
