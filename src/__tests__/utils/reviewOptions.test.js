import { describe, it, expect } from "vitest";
import {
  REVIEW_OPTIONS,
  withVerifiedReviewOptions,
} from "../../utils/reviewOptions";

describe("withVerifiedReviewOptions", () => {
  it("replaces whatever the model wrote as appeal options", () => {
    const out = withVerifiedReviewOptions({
      decision_type: "Full Denial",
      appeal_options: ["File a Statement of the Case"],
    });
    expect(out).toEqual({
      decision_type: "Full Denial",
      review_options: REVIEW_OPTIONS,
    });
  });

  it("does not change the model's other fields", () => {
    const decoded = {
      plain_english: "VA denied the claim.",
      action_plan: ["File a Supplemental Claim with new evidence."],
    };
    expect(withVerifiedReviewOptions(decoded)).toEqual({
      ...decoded,
      review_options: REVIEW_OPTIONS,
    });
  });

  it("notes each kind of wrong filing instruction once, wherever it appears", () => {
    const out = withVerifiedReviewOptions({
      plain_english:
        "You must file a Statement of the Case to keep the claim alive.",
      action_plan: [
        "Submit a Statement of the Case to the regional office.",
        "Request a Higher-Level Review and include any new evidence you have.",
      ],
    });
    expect(out.review_corrections.map((c) => c.rule)).toEqual([
      "files-statement-of-the-case",
      "higher-level-review-new-evidence",
    ]);
    expect(out.review_corrections[1].note).toContain(
      "the higher-level adjudicator may not consider additional evidence",
    );
  });

  it("returns anything that is not a decoded object unchanged", () => {
    expect(withVerifiedReviewOptions(null)).toBeNull();
    expect(withVerifiedReviewOptions([])).toEqual([]);
    expect(withVerifiedReviewOptions("text")).toBe("text");
  });
});
