/**
 * A model that copies the example values out of its own prompt has not read the
 * document. Whole-list echoes, "true/false", two-way alternatives and lightly
 * varied templates are rejected like the exact-text echoes; genuine values that
 * merely resemble an example survive. Fixture values come from the real prompts.
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

import {
  DD214_ANALYSIS_SYSTEM_PROMPT,
  DD214_ANALYSIS_SYSTEM_PROMPT_LOCAL,
  MODEL_SCHEMA_KEYS,
  _parseDd214Json,
} from "./DD214Analyzer.jsx";

const t = () => "parse error";
const parse = (value) => _parseDd214Json(JSON.stringify(value), t);
const PROMPTS = [
  DD214_ANALYSIS_SYSTEM_PROMPT_LOCAL,
  DD214_ANALYSIS_SYSTEM_PROMPT,
];

function promptListEchoes() {
  const echoes = [];
  for (const prompt of PROMPTS) {
    for (const [, key, body] of prompt.matchAll(
      /"(\w+)"\s*:\s*\[([^\][{}]*)\]/g,
    )) {
      const items = [...body.matchAll(/"([^"\n]+)"/g)].map((m) => m[1]);
      if (MODEL_SCHEMA_KEYS.has(key) && items.length >= 2) {
        echoes.push([key, items]);
      }
    }
  }
  return echoes;
}

describe("a whole list copied from the prompt is rejected", () => {
  it("finds the prompt lists to echo (guards against a vacuous test)", () => {
    expect(promptListEchoes().length).toBeGreaterThanOrEqual(2);
  });

  it.each(promptListEchoes())("%s echoing %j is dropped", (key, items) => {
    const data = parse({ branch: "Army", [key]: items });
    expect(data[key] ?? []).toEqual([]);
    expect(data.branch).toBe("Army");
  });

  it("drops the example devices, indicators and deployments inside an award and combat service", () => {
    const data = parse({
      awards: [
        {
          name: "Purple Heart",
          devices: ["Oak Leaf Cluster", "V Device", "Bronze Service Star"],
          isCombat: "true/false",
        },
      ],
      combatService: {
        hasVerifiedCombat: "true/false",
        indicators: [
          "Combat Action Badge",
          "Purple Heart",
          "Iraq Campaign Medal",
        ],
        deployments: ["Iraq 2003-2004", "Afghanistan 2010-2011"],
      },
    });
    expect(data.awards).toEqual([{ name: "Purple Heart" }]);
    expect(data.combatService).toEqual({ indicators: [], deployments: [] });
  });

  it("keeps a genuine shorter list that resembles the examples", () => {
    const real = {
      documentTypes: ["DD214", "NGB22"],
      specialQualifications: ["Airborne", "Ranger"],
      combatService: {
        hasVerifiedCombat: true,
        indicators: ["Purple Heart"],
        deployments: ["Iraq 2016-2017"],
      },
    };
    expect(parse(real)).toEqual(real);
  });
});

describe("two-way alternatives and varied templates are rejected", () => {
  it.each([
    ["reentryCode", "RE-1|RE-2"],
    ["characterOfService", "Honorable|General"],
    ["rank", "PV1|SGT"],
    ["lastDutyAssignment", "Unit and major command."],
    ["lastDutyAssignment", "Block 8: Unit and major command"],
    ["lastDutyAssignment", "  UNIT   AND MAJOR COMMAND  "],
    ["foreignService", "true/false"],
    ["reenlisted", "true/false"],
    ["narrativeReason", "narrative reason text."],
  ])("%s with %j is dropped", (key, value) => {
    const data = parse({ branch: "Army", [key]: value });
    expect(data).not.toHaveProperty(key);
  });

  it("keeps a real value that contains a pipe or shares words with a template", () => {
    const real = {
      lastDutyAssignment: "HHC | 3-7 INF",
      reentryCode: "RE-1",
      characterOfService: "Honorable",
      separationType: "Honorable Discharge",
    };
    expect(parse(real)).toEqual(real);
  });
});
