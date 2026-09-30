/**
 * Pre-existing DD-214 Analyzer vision-path bug (found during the ADR-009
 * on-device-routing review): _runVisionAnalysis returns
 * `{ content, isVisionResponse: true }` (see its own return statement), but
 * _extractResponseContent only ever read `.text` - so the vision path
 * unconditionally fell through to the empty-response branch and threw
 * "Vision model returned empty response" even when SmolVLM returned real
 * text. The text path (`{ text, mode }` from generateAI) was unaffected.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("../utils/documentAnalyzer", () => ({
  OCR_STATES: {},
  getProgressStyling: () => ({}),
  formatFileSize: (bytes) => `${bytes} bytes`,
  isFileSupported: () => true,
  getAcceptString: () => "",
}));
vi.mock("../utils/musterCallProcessor", () => ({
  processFormationDocument: vi.fn(),
  PROCESSING_STATES: { EXTRACTING: "EXTRACTING", COMPLETE: "COMPLETE" },
}));
vi.mock("../utils/smolVLMService", () => ({
  smolVLMService: {},
  isSmolVLMSupported: () => false,
}));

import { _extractResponseContent } from "./DD214Analyzer.jsx";

describe("_extractResponseContent", () => {
  it("reads .text from a generateAI-shaped response (text path)", () => {
    expect(_extractResponseContent({ text: "hello", mode: "cloud" })).toBe(
      "hello",
    );
  });

  it("reads .content from a vision-shaped response (the bug this fixes)", () => {
    expect(
      _extractResponseContent({
        content: '{"branch":"Army"}',
        isVisionResponse: true,
      }),
    ).toBe('{"branch":"Army"}');
  });

  it("still throws the vision-specific empty-response message when content really is empty", () => {
    expect(() =>
      _extractResponseContent({ content: "", isVisionResponse: true }),
    ).toThrow(/Vision model returned empty response/);
  });

  it("throws the generic message for an empty text-path response", () => {
    expect(() => _extractResponseContent({ text: "", mode: "cloud" })).toThrow(
      /No response received from AI/,
    );
  });

  it("accepts a bare string response", () => {
    expect(_extractResponseContent("plain string")).toBe("plain string");
  });
});
