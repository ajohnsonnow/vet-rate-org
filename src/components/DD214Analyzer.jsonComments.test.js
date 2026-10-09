/**
 * D22-5: a unit or transfer line that contains "//" (or a slash-star) is
 * ordinary model output. The old cleanup stripped "//" to the end of the line
 * even inside a quoted string, which broke the JSON and failed 4 of 7
 * readings of one real scan with "Could not parse AI response".
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

const t = () => "parse error";
const UNIT = "HHC 1-5 INF // TRANSFERRED TO USAR (CONTROL GROUP)";

describe("_parseDd214Json: slashes inside values", () => {
  it("keeps a value that contains a double slash and the rest of its line", () => {
    const reply = `{\n  "lastDutyAssignment": "${UNIT}",\n  "branch": "Army"\n}`;
    const data = _parseDd214Json(reply, t);
    expect(data.lastDutyAssignment).toBe(UNIT);
    expect(data.branch).toBe("Army");
  });

  it("keeps a value that contains a slash-star pair", () => {
    const value = "2ND BN /* 75TH RGR */ REGT";
    const data = _parseDd214Json(
      `{"commandTransferredTo": "${value}", "branch": "Army"}`,
      t,
    );
    expect(data.commandTransferredTo).toBe(value);
    expect(data.branch).toBe("Army");
  });

  it("parses a fenced reply whose value contains a double slash", () => {
    const reply = `\`\`\`json\n{"lastDutyAssignment": "${UNIT}"}\n\`\`\``;
    expect(_parseDd214Json(reply, t).lastDutyAssignment).toBe(UNIT);
  });
});

describe("_parseDd214Json: replies that are not strict JSON", () => {
  it("removes real line and block comments but not slashes inside a value", () => {
    const reply = [
      "{",
      "  // the unit line",
      `  "lastDutyAssignment": "${UNIT}", // block 8`,
      '  /* the branch */ "branch": "Army"',
      "}",
    ].join("\n");
    const data = _parseDd214Json(reply, t);
    expect(data.lastDutyAssignment).toBe(UNIT);
    expect(data.branch).toBe("Army");
  });

  it("removes trailing commas without touching a comma-brace inside a value", () => {
    const value = "UNIT A, }";
    const reply = `{"lastDutyAssignment": "${value}", "branch": "Army",}`;
    const data = _parseDd214Json(reply, t);
    expect(data.lastDutyAssignment).toBe(value);
    expect(data.branch).toBe("Army");
  });

  it("removes a trailing comma in an array", () => {
    const data = _parseDd214Json(
      '{"documentTypes": ["DD214",], "branch": "Navy"}',
      t,
    );
    expect(data.documentTypes).toEqual(["DD214"]);
  });

  it("still fails plainly, without echoing the reply, when nothing parses", () => {
    expect(() => _parseDd214Json('{"branch": "Army" oops', t)).toThrow(
      "parse error",
    );
  });
});
