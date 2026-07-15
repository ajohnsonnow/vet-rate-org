import { describe, it, expect } from "vitest";
import { attemptJSONRepair } from "./cfileAnalyzer";

describe("cfileAnalyzer: attemptJSONRepair", () => {
  it("returns null for empty/non-string input", () => {
    expect(attemptJSONRepair(null)).toBeNull();
    expect(attemptJSONRepair("")).toBeNull();
    expect(attemptJSONRepair(undefined)).toBeNull();
  });

  it("parses already-valid JSON unchanged (no repair needed)", () => {
    const result = attemptJSONRepair('{"summary": "ok", "timeline": []}');
    expect(result).toEqual({ summary: "ok", timeline: [] });
  });

  it("strips literal newlines inside the JSON body (strategy 0)", () => {
    const result = attemptJSONRepair('{"summary":\n"line one\nline two"}');
    expect(result.summary).toBe("line one line two");
  });

  it("closes unclosed braces and brackets (strategy 1)", () => {
    const result = attemptJSONRepair('{"summary": "ok", "timeline": [1, 2');
    expect(result.summary).toBe("ok");
  });

  it("inserts a missing comma between adjacent objects (strategy 1b)", () => {
    const result = attemptJSONRepair('{"a": [{"x": 1}\n{"y": 2}]}');
    expect(result.a).toEqual([{ x: 1 }, { y: 2 }]);
  });

  it("strips a text preamble before the first brace (strategy 1c)", () => {
    const result = attemptJSONRepair('Based on the records: {"summary": "ok"}');
    expect(result.summary).toBe("ok");
  });

  it("finds the last complete top-level object when the tail is garbage (strategy 2)", () => {
    const result = attemptJSONRepair(
      '{"summary": "ok"} some trailing garbage {not json',
    );
    expect(result.summary).toBe("ok");
  });

  it("normalizes single-quoted JS-style objects (strategy 2b)", () => {
    const result = attemptJSONRepair("{'summary': 'ok'}");
    expect(result.summary).toBe("ok");
  });

  it("quotes unquoted property names (strategy 3)", () => {
    const result = attemptJSONRepair('{summary: "ok", timeline: []}');
    expect(result.summary).toBe("ok");
  });

  it("falls back to regex field extraction when structure is unrecoverable (strategy 4)", () => {
    const garbled =
      'garbage garbage "condition": "PTSD" garbage "likelihood": "high" more garbage';
    const result = attemptJSONRepair(garbled);
    expect(result.potential_claims).toEqual([
      {
        condition: "PTSD",
        likelihood: "high",
        inServiceEvent: "",
        currentDiagnosis: "unclear",
        missing_element: "",
      },
    ]);
  });

  it("returns null when every strategy fails", () => {
    expect(attemptJSONRepair("not json at all, no braces anywhere")).toBeNull();
  });
});
