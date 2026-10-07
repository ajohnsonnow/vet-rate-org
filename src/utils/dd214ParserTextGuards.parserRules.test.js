/**
 * ADR-009 section 3, final24: a parser value is held to the same check a model's value
 * for the same key passes, and parser text is cleaned with its own rules (no
 * wide name shapes), unlike model text. Fixtures are synthetic.
 */
import { describe, it, expect } from "vitest";
import { sanitizeParserFields } from "./dd214ParserTextGuards";
import { makeScrubber } from "./dd214ModelOutputGuards";
import { removeLabelledNames } from "./dd214ModelTextScrub";
import {
  VALUE_SOURCE,
  buildValueSources,
  countBySource,
} from "./dd214ValueSources";

const SSN = "123-45-6789";
const TITLE_TAIL =
  "ANY ALTERATIUNDS IN DNMUCY AREAS RENDER FORM VOID ROM ACTIVE DUTY";

describe("parser values must pass the model's own check", () => {
  it("drops a component or full name that is page text, not a component", () => {
    const out = sanitizeParserFields({
      component: TITLE_TAIL,
      componentFull: TITLE_TAIL,
      branch: "Army",
    });
    expect(out.component).toBeUndefined();
    expect(out.componentFull).toBeUndefined();
    expect(out.branch).toBe("Army");
  });

  it("keeps the Guard component and its full name", () => {
    const out = sanitizeParserFields({
      component: "ARNGUS",
      componentFull: "Army National Guard",
    });
    expect(out).toEqual({
      component: "ARNGUS",
      componentFull: "Army National Guard",
    });
  });

  it("keeps NONE or a number for days lost and drops anything else", () => {
    expect(sanitizeParserFields({ daysLost: "NONE" }).daysLost).toBe("NONE");
    expect(sanitizeParserFields({ daysLost: "12" }).daysLost).toBe("12");
    for (const bad of [
      `DURING THIS PERIOD NONE ${TITLE_TAIL}`,
      "-",
      "1e9",
      "",
    ]) {
      expect(
        sanitizeParserFields({ daysLost: bad }).daysLost,
        bad,
      ).toBeUndefined();
    }
  });

  it("drops a date that is not a real date in range", () => {
    const out = sanitizeParserFields({
      entryDate: "2010-02-30",
      separationDate: "2099-01-01",
      dateOfRank: "2004-06-15",
    });
    expect(out.entryDate).toBeUndefined();
    expect(out.separationDate).toBeUndefined();
    expect(out.dateOfRank).toBe("2004-06-15");
  });

  it("drops a service date that is the veteran's known birth date", () => {
    const out = sanitizeParserFields(
      { entryDate: "1984-03-15", separationDate: "2010-06-15" },
      [{ dateOfBirth: "1984-03-15" }],
    );
    expect(out.entryDate).toBeUndefined();
    expect(out.separationDate).toBe("2010-06-15");
  });

  it("drops a count out of range and a MOS that is not a code", () => {
    const out = sanitizeParserFields({
      yearsService: 8,
      monthsService: 123456789,
      mos: "WARRIOR LEADER",
    });
    expect(out.yearsService).toBe(8);
    expect(out.monthsService).toBeUndefined();
    expect(out.mos).toBeUndefined();
    expect(sanitizeParserFields({ mos: "11B" }).mos).toBe("11B");
  });
});

describe("parser text keeps ordinary capitalised words", () => {
  const PERSON_SHAPED = "ZORBLAX QUINDLE LEADER COURSE, 4 WEEK, 2009";

  it("keeps a course, award and reason that look like a person's name", () => {
    const out = sanitizeParserFields({
      militaryEducation: [PERSON_SHAPED],
      awards: [{ name: "ZORBLAX QUINDLE MEMORIAL AWARD", devices: [] }],
      narrativeReason: "QUINDLE ZORBLAX EARLY RELEASE",
    });
    expect(out.militaryEducation).toEqual([PERSON_SHAPED]);
    expect(out.awards[0].name).toBe("ZORBLAX QUINDLE MEMORIAL AWARD");
    expect(out.narrativeReason).toBe("QUINDLE ZORBLAX EARLY RELEASE");
  });

  it("still removes it from model text", () => {
    const { scrubShort } = makeScrubber([]);
    expect(scrubShort(PERSON_SHAPED)).toContain("[REDACTED]");
  });

  it("removes the name the parser read as an identifier, wherever it appears", () => {
    const out = sanitizeParserFields(
      { remarks: "SEE FILE OF QUINDLE ZORBLAX FOR DETAILS" },
      [{ fullName: "QUINDLE, ZORBLAX R" }],
    );
    expect(out.remarks).not.toMatch(/QUINDLE|ZORBLAX/);
  });

  it("removes a Last, First M name beside an identifier label only", () => {
    expect(removeLabelledNames("NAME: QUINDLE, ZORBLAX R REST")).toBe(
      "NAME: [REDACTED] REST",
    );
    expect(removeLabelledNames("QUINDLE, ZORBLAX R SSN 123")).toBe(
      "[REDACTED] SSN 123",
    );
    expect(removeLabelledNames("BASIC COURSE, ADVANCED PHASE")).toBe(
      "BASIC COURSE, ADVANCED PHASE",
    );
  });

  it("never lets an SSN, birth date, phone, email or street through", () => {
    const out = sanitizeParserFields({
      remarks: `CALL 555-123-4567 OR MAIL FAKE.PERSON@EXAMPLE.COM ${SSN} DATE OF BIRTH 19800101 SERVICE IN KUWAIT`,
      militaryEducation: [
        `FIRST AID COURSE 42 SAMPLE AVENUE FAKETOWN OH 44444`,
      ],
    });
    const text = JSON.stringify(out);
    for (const leaked of [
      "555-123-4567",
      "EXAMPLE.COM",
      SSN,
      "19800101",
      "SAMPLE AVENUE",
      "44444",
    ]) {
      expect(text, leaked).not.toContain(leaked);
    }
  });
});

describe("an entry that is mostly redaction marks or form label words is dropped", () => {
  it("drops caption entries and keeps the real one", () => {
    const out = sanitizeParserFields({
      militaryEducation: [
        "VETERANS EDUCATIONAL ASSISTANCE PROGRAM",
        "MILITARY EDUCATION",
        "BASIC LEADER COURSE, 4 WEEK, 2009",
      ],
      awards: [
        { name: "DECORATIONS MEDALS BADGES CITATIONS", devices: [] },
        { name: "ARMY SERVICE RIBBON", devices: [] },
      ],
      narrativeReason: "FOR SEPARATION",
    });
    expect(out.militaryEducation).toEqual([
      "BASIC LEADER COURSE, 4 WEEK, 2009",
    ]);
    expect(out.awards.map((award) => award.name)).toEqual([
      "ARMY SERVICE RIBBON",
    ]);
    expect(out.narrativeReason).toBeUndefined();
  });

  it("keeps real reasons that use one caption word", () => {
    expect(
      sanitizeParserFields({
        narrativeReason: "COMPLETION OF REQUIRED ACTIVE SERVICE",
      }).narrativeReason,
    ).toBe("COMPLETION OF REQUIRED ACTIVE SERVICE");
  });
});

describe("a parser value that needs a check is never counted as a plain parser value", () => {
  const data = { component: "ARNGUS", rank: "SGT" };
  const sources = buildValueSources(data, {
    modelKeys: new Set(["rank"]),
    parserKeys: new Set(["component", "rank"]),
    checkKeys: new Set(["component"]),
    rowKeys: ["component", "rank"],
  });

  it("is labelled parser-check, and a plain parser value stays parser", () => {
    expect(sources).toEqual({
      component: VALUE_SOURCE.PARSER_CHECK,
      rank: VALUE_SOURCE.PARSER,
    });
  });

  it("counts as one value read by the parser", () => {
    expect(countBySource(sources)).toEqual({ parser: 2, model: 0, veteran: 0 });
  });
});
