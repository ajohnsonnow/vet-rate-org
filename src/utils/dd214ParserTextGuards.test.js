/**
 * Text the local parser read gets the same treatment as text a model wrote
 * (ADR-009 decision G). Fixtures are generic, not any real veteran's data.
 */
import { describe, it, expect } from "vitest";
import {
  PARSER_TEXT_CAPS,
  sanitizeParserFields,
} from "./dd214ParserTextGuards";

const SSN = "123-45-6789";
const STREET_RUN = "42 SAMPLE AVENUE FAKETOWN OH 44444";

describe("parser lists are scrubbed entry by entry", () => {
  it("removes an SSN, a labelled birth date and an address from an education entry", () => {
    const out = sanitizeParserFields({
      militaryEducation: [
        "BASIC LEADER COURSE 2010",
        `AIR ASSAULT SCHOOL ${SSN}`,
        `WARRIOR LEADER COURSE DATE OF BIRTH 19800101`,
        STREET_RUN,
      ],
    });
    const text = JSON.stringify(out);
    expect(text).toContain("BASIC LEADER COURSE 2010");
    for (const leaked of [SSN, "19800101", "SAMPLE AVENUE", "44444"]) {
      expect(text).not.toContain(leaked);
    }
  });

  it("drops an entry that is mostly redaction marks", () => {
    const out = sanitizeParserFields({
      militaryEducation: [`${SSN} ${STREET_RUN}`, "BASIC LEADER COURSE 2010"],
    });
    expect(out.militaryEducation).toEqual(["BASIC LEADER COURSE 2010"]);
  });

  it("drops an entry longer than a real entry of its kind", () => {
    const longCourse = `ADVANCED ${"TRAINING ".repeat(40)}`;
    expect(longCourse.length).toBeGreaterThan(
      PARSER_TEXT_CAPS.militaryEducation,
    );
    const out = sanitizeParserFields({
      militaryEducation: [longCourse, "BASIC LEADER COURSE 2010"],
      specialQualifications: [
        "X".repeat(PARSER_TEXT_CAPS.specialQualifications + 1),
      ],
    });
    expect(out.militaryEducation).toEqual(["BASIC LEADER COURSE 2010"]);
    expect(out.specialQualifications).toEqual([]);
  });

  it("redacts a name the parser read elsewhere on the page", () => {
    const out = sanitizeParserFields(
      { militaryEducation: ["COURSE TAUGHT BY QUINDLE ZORBLAX"] },
      [{ fullName: "QUINDLE, ZORBLAX" }],
    );
    expect(JSON.stringify(out)).not.toMatch(/QUINDLE|ZORBLAX/);
  });
});

describe("parser awards, unit lines and deployments", () => {
  it("keeps real awards, scrubs the name, and drops the raw capture", () => {
    const out = sanitizeParserFields({
      awards: [
        {
          raw: `ARMY ACHIEVEMENT MEDAL ${SSN} ${STREET_RUN}`,
          name: "ARMY ACHIEVEMENT MEDAL",
          abbreviation: "",
          devices: ["M Device"],
          deviceCount: 2,
          isCombat: false,
        },
        { raw: SSN, name: `${SSN} ${STREET_RUN}`, devices: [] },
      ],
    });
    expect(out.awards).toEqual([
      {
        name: "ARMY ACHIEVEMENT MEDAL",
        abbreviation: "",
        devices: ["M Device"],
        deviceCount: 2,
        isCombat: false,
      },
    ]);
    expect(JSON.stringify(out)).not.toContain(SSN);
  });

  it("scrubs the unit and duty lines and keeps clean ones", () => {
    const out = sanitizeParserFields({
      lastDutyAssignment: `HHC 3RD BN ${SSN}`,
      commandTransferredTo: "US ARMY RESERVE CONTROL GROUP",
    });
    expect(out.lastDutyAssignment ?? "").not.toContain(SSN);
    expect(out.commandTransferredTo).toBe("US ARMY RESERVE CONTROL GROUP");
  });

  it("drops a remarks run that is mostly an SSN, a birth date and a street", () => {
    const out = sanitizeParserFields({
      remarks: `${SSN} DATE OF BIRTH 19800101 ${STREET_RUN}`,
    });
    expect(out.remarks).toBeUndefined();
  });

  it("rebuilds the combat deployments from clean parts and keeps their dates", () => {
    const out = sanitizeParserFields({
      deployments: [
        {
          location: "KUWAIT",
          startDate: "2013-01-01",
          endDate: "2013-06-01",
          raw: `SERVICE IN KUWAIT 20130101 - 20130601 ${SSN}`,
        },
      ],
      combatService: {
        hasVerifiedCombat: true,
        indicators: ["COMBAT ACTION BADGE"],
        deployments: ["KUWAIT 2013-01-01-2013-06-01"],
      },
    });
    expect(out.deployments).toEqual([
      { location: "KUWAIT", startDate: "2013-01-01", endDate: "2013-06-01" },
    ]);
    expect(out.combatService.deployments).toEqual([
      "KUWAIT 2013-01-01-2013-06-01",
    ]);
    expect(JSON.stringify(out)).not.toContain(SSN);
  });
});

describe("identifier fields and absent keys are left alone", () => {
  it("does not touch the identifiers the parser read, and adds no keys", () => {
    const fields = {
      fullName: "FAKETON, JORDAN",
      ssnLast4: "6789",
      dateOfBirth: "1984-03-15",
      mailingAddress: STREET_RUN,
      branch: "Army",
    };
    expect(sanitizeParserFields(fields)).toEqual(fields);
  });

  it("returns a missing result as it is", () => {
    expect(sanitizeParserFields(undefined)).toBeUndefined();
    expect(sanitizeParserFields(null)).toBeNull();
  });
});
