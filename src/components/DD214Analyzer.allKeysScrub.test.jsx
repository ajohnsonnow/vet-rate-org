/**
 * Owner decision (F), identifier lens: an identifier a model writes into ANY
 * schema key (not only the free-text ones) is removed before the result is
 * shown, offered in the import dialog or saved. Each key is fed a hostile
 * value in the four shapes a model can return (string, list, object, list of
 * objects) through the real parse and local-parser merge. Fixture values are
 * synthetic.
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
  IDENTIFIER_FIELDS,
  MODEL_SCHEMA_KEYS,
  _applyRegexSafetyNet,
  _parseDd214Json,
} from "./DD214Analyzer.jsx";

const t = () => "parse error";
const OCR_TEXT = "1. NAME: FAKETON, JORDAN\n2. DEPARTMENT: ARMY\n";
const HOSTILE =
  "Jordan Faketon SSN 123-45-6789 of 12 Fake Street, Anytown TX 75001";
const LEAK = /faketon|jordan|123-45-6789|123456789|fake street|75001/i;

const SHAPES = {
  string: (value) => value,
  list: (value) => [value],
  object: (value) => ({ name: value, note: value }),
  objectList: (value) => [{ name: value, abbreviation: value }],
};

const KEYS = [...MODEL_SCHEMA_KEYS];

function runPipeline(key, shape) {
  let final;
  const data = _parseDd214Json(
    JSON.stringify({ branch: "Army", [key]: SHAPES[shape](HOSTILE) }),
    t,
  );
  _applyRegexSafetyNet(data, OCR_TEXT, (value) => {
    final = value;
  });
  return final;
}

describe("the local parser supplies the name used to redact (guards a vacuous run)", () => {
  it("reads the name from the scan text", () => {
    const final = runPipeline("branch", "string");
    expect(final.fullName).toMatch(/faketon/i);
    expect(KEYS.length).toBeGreaterThan(40);
  });
});

describe.each(Object.keys(SHAPES))(
  "a hostile %s in every schema key never survives",
  (shape) => {
    it.each(KEYS)("%s", (key) => {
      const final = runPipeline(key, shape);
      expect(JSON.stringify(final[key] ?? null)).not.toMatch(LEAK);
      const others = Object.entries(final)
        .filter(([k]) => k !== key && !IDENTIFIER_FIELDS.includes(k))
        .map(([, v]) => v);
      expect(JSON.stringify(others)).not.toMatch(LEAK);
    });
  },
);

describe("genuine values of every kind pass through unchanged", () => {
  const REAL = {
    branch: "Army",
    mos: "11B",
    mosTitle: "Infantryman",
    payGrade: "E-5",
    entryDate: "2002-03-05",
    separationDate: "2010-06-15",
    dateOfRank: "2007-01-01",
    netActiveService: { years: 8, months: 3, days: 10 },
    yearsService: 8,
    daysLost: "0",
    foreignService: true,
    separationAuthority: "AR 635-200, Chapter 4",
    lastDutyAssignment: "HHC, 3rd Battalion, 7th Infantry Regiment",
    securityClearance: "Secret",
    militaryEducation: ["Airborne School", "Warrior Leader Course"],
    awards: [
      {
        name: "Bronze Star Medal",
        abbreviation: "BSM",
        devices: ["V Device"],
        deviceCount: 1,
        isCombat: true,
      },
    ],
    combatService: {
      hasVerifiedCombat: true,
      indicators: ["Combat Action Badge"],
      deployments: ["Operation Iraqi Freedom 2005-2006"],
    },
  };

  it("keeps dates, numbers, booleans, service time, awards and combat service", () => {
    expect(_parseDd214Json(JSON.stringify(REAL), t)).toEqual(REAL);
  });
});

describe("size limits keep a paragraph out of a field that holds a code or a name", () => {
  const LONG = `The member ${"x".repeat(100)}`;

  it("drops a long value in a short-code key and a very long one anywhere", () => {
    const data = _parseDd214Json(
      JSON.stringify({
        branch: LONG,
        characterOfService: LONG,
        lastDutyAssignment: LONG.repeat(5),
        militaryEducation: ["Airborne School", LONG.repeat(5)],
        mosTitle: LONG,
      }),
      t,
    );
    expect(data).toEqual({
      militaryEducation: ["Airborne School"],
      mosTitle: LONG,
    });
  });

  it("keeps a fractional length of service", () => {
    const data = _parseDd214Json(
      JSON.stringify({ yearsService: 8.5, monthsService: "102.5" }),
      t,
    );
    expect(data).toEqual({ yearsService: 8.5, monthsService: "102.5" });
  });
});

describe("values of the wrong type for their key are dropped", () => {
  it("drops a non-date in a date key, a non-number in a count and a non-boolean flag", () => {
    const data = _parseDd214Json(
      JSON.stringify({
        branch: "Army",
        entryDate: "sometime in March",
        yearsService: "eight",
        foreignService: "maybe",
        netActiveService: "8 years",
        combatService: "yes",
      }),
      t,
    );
    expect(data).toEqual({ branch: "Army" });
  });
});
