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

  it("notes a wrong filing instruction once for each field it appears in", () => {
    const out = withVerifiedReviewOptions({
      plain_english:
        "You must file a Statement of the Case to keep the claim alive.",
      action_plan: [
        "Submit a Statement of the Case to the regional office.",
        "Then file a Statement of the Case again if needed.",
        "Request a Higher-Level Review and include any new evidence you have.",
      ],
    });
    expect(out.review_corrections.map((c) => [c.field, c.rule])).toEqual([
      ["plain_english", "files-statement-of-the-case"],
      ["action_plan", "files-statement-of-the-case"],
      ["action_plan", "higher-level-review-new-evidence"],
    ]);
    expect(out.review_corrections[2].note).toContain(
      "the higher-level adjudicator may not consider additional evidence",
    );
  });

  it("checks every text field the model returns, not a fixed list", () => {
    const out = withVerifiedReviewOptions({
      decision_type: "Full Denial",
      deadline_warning:
        "You have one year from the date of this letter to file a Supplemental Claim.",
      next_steps_summary:
        "File a Supplemental Claim with new and material evidence.",
      extra: { nested: "ignored" },
    });
    expect(out.review_corrections.map((c) => [c.field, c.rule])).toEqual([
      ["deadline_warning", "supplemental-claim-deadline"],
      ["next_steps_summary", "new-and-material-standard"],
    ]);
  });

  it("never checks the verified options it attaches", () => {
    const out = withVerifiedReviewOptions({
      review_options: "File a Statement of the Case with the Board.",
    });
    expect(out).not.toHaveProperty("review_corrections");
  });

  it("returns anything that is not a decoded object unchanged", () => {
    expect(withVerifiedReviewOptions(null)).toBeNull();
    expect(withVerifiedReviewOptions([])).toEqual([]);
    expect(withVerifiedReviewOptions("text")).toBe("text");
  });
});
