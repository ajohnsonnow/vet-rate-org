import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRedditClipboard } from "./useRedditClipboard";

// Covers the PERSEC redaction regexes bounded for sonarjs/super-linear-regex
// (File/VA File Number and Claim Number/#/ID patterns). Samples are synthetic.
describe("useRedditClipboard: PERSEC redaction", () => {
  it("redacts a VA File Number reference", () => {
    const { result } = renderHook(() => useRedditClipboard());
    const text =
      "Please reference my VA File Number 123456789 when responding.";
    expect(result.current.sanitizeText(text)).toBe(
      "Please reference my File #[REDACTED] when responding.",
    );
  });

  it("redacts a 'File #' reference", () => {
    const { result } = renderHook(() => useRedditClipboard());
    expect(result.current.sanitizeText("File #1234567 was reviewed.")).toBe(
      "File #[REDACTED] was reviewed.",
    );
  });

  it("redacts Claim Number and Claim ID references", () => {
    const { result } = renderHook(() => useRedditClipboard());
    expect(
      result.current.sanitizeText("My Claim Number: 987654321 is pending."),
    ).toBe("My Claim #[REDACTED] is pending.");
    expect(result.current.sanitizeText("ClaimID:42")).toBe("Claim #[REDACTED]");
  });
});
