import { describe, it, expect } from "vitest";
import {
  tagCavcEntry,
  CAVC_SINGLE_JUDGE_BASIS,
  CAVC_SINGLE_JUDGE_CAVEAT,
} from "../../services/cavcAuthorityTagging.js";

/**
 * S43 - CAVC authority tagging. The load-bearing guarantee is that a
 * single-judge memorandum decision can never be tagged precedential, and a
 * panel decision always is - the IW_DATABASE split is the ground truth.
 */
describe("CAVC tagging - panel vs single-judge", () => {
  it("tags a panel decision precedential with full citation weight", () => {
    const tag = tagCavcEntry("panel");
    expect(tag.decision_type).toBe("panel");
    expect(tag.precedential).toBe(true);
    expect(tag.citation_weight).toBe(1.0);
    expect(tag.caveat).toBeUndefined();
    expect(tag.authority_basis).toBeUndefined();
  });

  it("tags a single-judge decision non-precedential with a caveat", () => {
    const tag = tagCavcEntry("singlejudge");
    expect(tag.decision_type).toBe("single_judge");
    expect(tag.precedential).toBe(false);
    expect(tag.citation_weight).toBeLessThan(1.0);
    expect(tag.caveat).toBe(CAVC_SINGLE_JUDGE_CAVEAT);
    expect(tag.authority_basis).toBe(CAVC_SINGLE_JUDGE_BASIS);
  });
});
