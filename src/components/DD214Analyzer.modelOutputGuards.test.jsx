/**
 * Owner decision (F), D21-3 and D21-7: the model is never the source of
 * place of birth or any other identifier-bearing field, a model that echoes
 * its prompt's placeholder text has not read anything, and the free text a
 * model writes is scrubbed before it is shown or saved. Fixture values are
 * synthetic.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

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

import ProfileImportConfirmModal from "./ProfileImportConfirmModal.jsx";
import {
  DD214_ANALYSIS_SYSTEM_PROMPT,
  DD214_ANALYSIS_SYSTEM_PROMPT_LOCAL,
  MODEL_SCHEMA_KEYS,
  _applyRegexSafetyNet,
  _parseDd214Json,
} from "./DD214Analyzer.jsx";

const t = () => "parse error";
const PROMPTS = [
  DD214_ANALYSIS_SYSTEM_PROMPT_LOCAL,
  DD214_ANALYSIS_SYSTEM_PROMPT,
];

const IDENTIFYING_KEYS = [
  "placeOfBirth",
  "nextOfKin",
  "nextOfKinName",
  "nearestRelative",
  "nearestRelativeName",
  "nearestRelativeAddress",
  "phone",
  "email",
  "serviceNumber",
  "signature",
  "fullName",
  "lastName",
  "firstName",
  "middleName",
  "ssnLast4",
  "dateOfBirth",
  "homeOfRecord",
  "homeAddress",
];

describe("D21-3: no identifier-bearing key is in the model schema", () => {
  it.each(IDENTIFYING_KEYS)("%s is not an allowed model key", (key) => {
    expect(MODEL_SCHEMA_KEYS.has(key)).toBe(false);
  });

  it.each([
    ["on-device", DD214_ANALYSIS_SYSTEM_PROMPT_LOCAL],
    ["cloud", DD214_ANALYSIS_SYSTEM_PROMPT],
  ])("the %s prompt does not ask for place of birth", (_label, prompt) => {
    expect(prompt).not.toMatch(/placeOfBirth|Place of Birth/);
  });

  it("a place of birth the model returns anyway is ignored", () => {
    const data = _parseDd214Json(
      JSON.stringify({ branch: "Army", placeOfBirth: "Springfield, IL, USA" }),
      t,
    );
    expect(data).toEqual({ branch: "Army" });
  });

  it("the safety net never adds a place of birth", () => {
    const data = { branch: "Army", placeOfBirth: "Springfield, IL, USA" };
    _applyRegexSafetyNet(data, "6. PLACE OF BIRTH: SPRINGFIELD, IL", () => {});
    expect(data).not.toHaveProperty("placeOfBirth");
  });
});

describe("D21-3: the import dialog never pre-selects a place of birth", () => {
  it("offers it unticked and leaves it out of the import", async () => {
    const onConfirm = vi.fn();
    render(
      <ProfileImportConfirmModal
        extractedData={{
          placeOfBirth: "City, State, Country",
          serviceStartDate: "2004-01-10",
        }}
        currentProfile={{}}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    const boxes = await screen.findAllByRole("checkbox");
    expect(boxes.length).toBeGreaterThan(1);
    fireEvent.click(
      screen.getByRole("button", { name: /Import Selected Fields/ }),
    );
    const [payload] = onConfirm.mock.calls[0];
    expect(payload).toEqual({ serviceStartDate: "2004-01-10" });
  });
});

function promptPlaceholderEchoes() {
  const echoes = [];
  for (const prompt of PROMPTS) {
    for (const [, key, literal] of prompt.matchAll(
      /"(\w+)"\s*:\s*"([^"\n]+)"/g,
    )) {
      if (MODEL_SCHEMA_KEYS.has(key) && /[\s|(),]/.test(literal)) {
        echoes.push([key, literal]);
      }
    }
  }
  return echoes;
}

describe("D21-3: a model echoing its prompt placeholder is rejected", () => {
  it("finds the prompt placeholders to echo (guards against a vacuous test)", () => {
    expect(promptPlaceholderEchoes().length).toBeGreaterThan(30);
  });

  it.each(promptPlaceholderEchoes())(
    "%s echoing %j is dropped",
    (key, literal) => {
      const sentinel = key === "mos" ? "mosTitle" : "mos";
      const data = _parseDd214Json(
        JSON.stringify({ [sentinel]: "11B", [key]: literal }),
        t,
      );
      expect(data).not.toHaveProperty(key);
      expect(data[sentinel]).toBe("11B");
    },
  );

  it("drops a placeholder echoed into the wrong field and inside lists", () => {
    const data = _parseDd214Json(
      JSON.stringify({
        branch: "Army",
        rank: "Unit and major command",
        entryDate: "YYYY-MM-DD",
        militaryEducation: ["course names", "Airborne School"],
        extractionNotes: ["important details"],
        awards: [{ name: "Full award name" }, { name: "Purple Heart" }],
        yearsService: "number",
      }),
      t,
    );
    expect(data).not.toHaveProperty("rank");
    expect(data).not.toHaveProperty("entryDate");
    expect(data).not.toHaveProperty("yearsService");
    expect(data.militaryEducation).toEqual(["Airborne School"]);
    expect(data.extractionNotes).toEqual([]);
    expect(data.awards).toEqual([{ name: "Purple Heart" }]);
  });

  it("keeps genuine values that merely resemble prompt examples", () => {
    const real = {
      rank: "SGT",
      componentFull: "Regular Army",
      masterRecordType: "DD214",
      documentTypes: ["DD214", "NGB22"],
      specialQualifications: ["Airborne", "Ranger"],
      separationType: "Honorable Discharge",
      characterOfService: "Honorable",
      reentryCode: "RE-1",
      entryDate: "2004-01-10",
    };
    expect(_parseDd214Json(JSON.stringify(real), t)).toEqual(real);
  });
});
