/**
 * Vision-path fix moves the failure for 2-page PDFs (ADR-009 review):
 * smolVLMService.processMultiplePages joins each page's own JSON object
 * with "\n\n--- Page Break ---\n\n". _parseDd214Json's old greedy
 * /\{[\s\S]{0,100000}\}/ matched from the FIRST page's '{' to the SECOND
 * page's closing '}', swallowing the separator text as invalid JSON - so
 * every 2-page (or more) vision-path DD-214 threw the generic parseError
 * instead of extracting the first page's real fields.
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

import { _parseDd214Json } from "./DD214Analyzer.jsx";

const t = (_ns, key) => key;

describe("_parseDd214Json: multi-page vision JSON", () => {
  it("parses the first page's object out of a 2-page joined vision response", () => {
    const joined = [
      '{"branch":"Army"}',
      '{"characterOfService":"Honorable"}',
    ].join("\n\n--- Page Break ---\n\n");

    expect(_parseDd214Json(joined, t)).toEqual({ branch: "Army" });
  });

  it("still parses a single-object response unaffected", () => {
    expect(_parseDd214Json('{"branch":"Navy"}', t)).toEqual({
      branch: "Navy",
    });
  });

  it("still handles a nested object schema (mos code/title normalization)", () => {
    const result = _parseDd214Json(
      '{"mos":{"code":"11B","title":"Infantryman"}}',
      t,
    );
    expect(result.mos).toBe("11B");
    expect(result.mosTitle).toBe("Infantryman");
  });
});

describe("D19-2: _parseDd214Json's brace-depth scan is string-aware", () => {
  it("does not miscount an UNBALANCED literal '{' inside a quoted string value", () => {
    // A single unmatched '{' inside the string (no closing '}' in the same
    // string) is the case a non-string-aware depth count gets wrong: it
    // increments depth for this one and then needs an EXTRA '}' beyond the
    // object's own real closing brace, running on into the next page's
    // object before it's satisfied.
    const joined = [
      '{"branch":"Army","extractionNotes":["Remarks: CONT ON DD FORM 214 {NGB cont."]}',
      '{"characterOfService":"Honorable"}',
    ].join("\n\n--- Page Break ---\n\n");

    const result = _parseDd214Json(joined, t);
    expect(result.branch).toBe("Army");
    expect(result.extractionNotes).toEqual([
      "Remarks: CONT ON DD FORM 214 {NGB cont.",
    ]);
    expect(result.characterOfService).toBeUndefined();
  });

  it("does not miscount a literal '}' inside a quoted string value", () => {
    const joined = [
      '{"branch":"Navy","extractionNotes":["Block 18: SEE {REMARKS} CONTINUED}"]}',
      '{"characterOfService":"Honorable"}',
    ].join("\n\n--- Page Break ---\n\n");

    const result = _parseDd214Json(joined, t);
    expect(result.branch).toBe("Navy");
    expect(result.extractionNotes).toEqual([
      "Block 18: SEE {REMARKS} CONTINUED}",
    ]);
  });

  it("does not end the string early on an escaped quote immediately before a brace", () => {
    const joined = [
      '{"branch":"Air Force","extractionNotes":["Says \\"CONT{\\" on remarks"]}',
      '{"characterOfService":"Honorable"}',
    ].join("\n\n--- Page Break ---\n\n");

    const result = _parseDd214Json(joined, t);
    expect(result.branch).toBe("Air Force");
    expect(result.extractionNotes).toEqual(['Says "CONT{" on remarks']);
  });
});
