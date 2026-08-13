import { describe, it, expect } from "vitest";
import { sanitizeWeakSpotSuggestions } from "../../utils/aiStatementHelper";

// Regression coverage for a bug found during an independent QA pass on a
// large AI-recommendations refactor: the bare word "manage" was in a flat
// banned-phrase list, so ANY AI suggestion containing it -- including the
// strong, specific, functional-impact language this same tool recommends
// elsewhere ("tasks you can no longer manage") -- was discarded and
// replaced with a generic fallback.

describe("sanitizeWeakSpotSuggestions", () => {
  it("keeps a suggestion that uses 'manage' in the negated/inability sense", () => {
    const result = sanitizeWeakSpotSuggestions([
      {
        quote: "it's fine",
        suggestion:
          "Describe specific tasks you can no longer manage, such as lifting your child or climbing stairs.",
      },
    ]);
    expect(result[0].suggestion).toContain("no longer manage");
  });

  it("still replaces a self-minimizing suggestion that uses 'manage' as coping language", () => {
    const result = sanitizeWeakSpotSuggestions([
      {
        quote: "I manage",
        suggestion: "I have learned to manage its effects effectively",
      },
    ]);
    expect(result[0].suggestion).not.toContain("manage");
    expect(result[0].suggestion).toContain("clinical language");
  });

  it("replaces a suggestion containing an unrelated banned phrase", () => {
    const result = sanitizeWeakSpotSuggestions([
      { quote: "it's ok", suggestion: "Just push through the pain daily." },
    ]);
    expect(result[0].suggestion).toContain("clinical language");
  });

  it("leaves an unrelated suggestion untouched", () => {
    const result = sanitizeWeakSpotSuggestions([
      {
        quote: "it hurts",
        suggestion: "State the exact pain level on a 1-10 scale.",
      },
    ]);
    expect(result[0].suggestion).toBe(
      "State the exact pain level on a 1-10 scale.",
    );
  });
});
