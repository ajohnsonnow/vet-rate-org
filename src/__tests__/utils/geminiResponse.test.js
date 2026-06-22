import { describe, it, expect } from "vitest";
import { interpretGeminiResponse } from "../../utils/geminiResponse.js";

/**
 * C-H05: a SAFETY block has no `content` and MAX_TOKENS returns partial text that
 * looks complete. The old parser read only `.content.parts[0].text`, so both
 * degraded to a generic "No response generated". The interpreter must surface why.
 */
describe("interpretGeminiResponse (C-H05)", () => {
  it("returns the text on a normal STOP finish", () => {
    const out = interpretGeminiResponse({
      candidates: [
        { finishReason: "STOP", content: { parts: [{ text: "hello" }] } },
      ],
    });
    expect(out).toBe("hello");
  });

  it("throws a clear error when the prompt is blocked", () => {
    expect(() =>
      interpretGeminiResponse({ promptFeedback: { blockReason: "SAFETY" } }),
    ).toThrow(/blocked this request \(SAFETY\)/i);
  });

  it("throws a clear error on a SAFETY-blocked response with no content", () => {
    expect(() =>
      interpretGeminiResponse({
        candidates: [{ finishReason: "SAFETY", safetyRatings: [] }],
      }),
    ).toThrow(/stopped the response \(SAFETY\)/i);
  });

  it("appends a truncation notice on MAX_TOKENS instead of looking complete", () => {
    const out = interpretGeminiResponse({
      candidates: [
        { finishReason: "MAX_TOKENS", content: { parts: [{ text: "partial" }] } },
      ],
    });
    expect(out).toContain("partial");
    expect(out).toMatch(/cut off at the output token limit/i);
  });

  it("reports the finishReason when there is no text", () => {
    expect(() =>
      interpretGeminiResponse({ candidates: [{ finishReason: "OTHER" }] }),
    ).toThrow(/finishReason: OTHER/);
  });

  it("falls back to the generic message when the body is empty", () => {
    expect(() => interpretGeminiResponse({})).toThrow(/No response generated/);
  });
});
