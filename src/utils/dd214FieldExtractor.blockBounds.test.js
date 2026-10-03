/**
 * A free-text block (education, awards, remarks, unit lines) is captured up to
 * the next box. When that box's number is missing, or the page is flattened to
 * one line, the capture used to take the rest of the page: street, city, ZIP,
 * SSN and birth date. These generic fixtures reproduce that and check the
 * capture ends where the next printed box begins.
 */
import { describe, it, expect } from "vitest";
import { extractDD214Fields } from "./dd214FieldExtractor";

const SSN = "123-45-6789";
const BIRTH = "19800101";
const STREET = "42 SAMPLE AVENUE";
const TAIL = `${STREET} FAKETOWN OH 44444 SOCIAL SECURITY NUMBER ${SSN} DATE OF BIRTH ${BIRTH} MAILING ADDRESS 9 OTHER ROAD NOWHERE OH 44445`;

const flattened = (block) => `DD FORM 214 ${block}`;
const dump = (fields) => JSON.stringify(fields);

describe("a block capture ends at the next printed box", () => {
  it("keeps the SSN, birth date and mailing address out of Military Education", () => {
    const { fields } = extractDD214Fields(
      flattened(
        `14. MILITARY EDUCATION: INFANTRY ONE STATION UNIT TRAINING 2009 ${TAIL}`,
      ),
    );
    const education = fields.militaryEducation.join(" ");
    expect(education).toContain("INFANTRY ONE STATION");
    for (const leaked of [SSN, BIRTH, "OTHER ROAD", STREET, "44444"]) {
      expect(education).not.toContain(leaked);
    }
  });

  it("keeps them out of the Awards list", () => {
    const { fields } = extractDD214Fields(
      flattened(
        `13. DECORATIONS, MEDALS, BADGES: ARMY ACHIEVEMENT MEDAL ${TAIL}`,
      ),
    );
    const awards = JSON.stringify(fields.awards);
    expect(awards).toContain("ARMY ACHIEVEMENT MEDAL");
    for (const leaked of [SSN, BIRTH, "OTHER ROAD", STREET, "44444"]) {
      expect(awards).not.toContain(leaked);
    }
  });

  it("keeps them out of Remarks", () => {
    const { fields } = extractDD214Fields(
      flattened(`18. REMARKS: SERVICE IN KUWAIT 20050101 - 20050601 ${TAIL}`),
    );
    expect(fields.remarks).toContain("SERVICE IN KUWAIT");
    for (const leaked of [SSN, BIRTH, "OTHER ROAD", STREET, "44444"]) {
      expect(fields.remarks).not.toContain(leaked);
      expect(JSON.stringify(fields.deployments)).not.toContain(leaked);
    }
  });

  it("drops a unit line that runs on past any real unit name", () => {
    const run = `${"ALPHA ".repeat(60)}${SSN}`;
    const { fields } = extractDD214Fields(
      `8A. LAST DUTY ASSIGNMENT AND MAJOR COMMAND: ${run}`,
    );
    expect(fields.lastDutyAssignment).toBeUndefined();
    expect(dump(fields)).not.toContain(SSN);
  });

  it("drops an education block that never meets a next box and is far too long", () => {
    const run = `14. MILITARY EDUCATION: ${"WORD ".repeat(300)}`;
    const { fields } = extractDD214Fields(flattened(run));
    expect(fields.militaryEducation).toBeUndefined();
  });

  it("still reads a normal block that is closed by the next box", () => {
    const { fields } = extractDD214Fields(
      "14. MILITARY EDUCATION: BASIC LEADER COURSE 2010 //NOTHING FOLLOWS\n15. MEMBER REQUESTS: NONE\n",
    );
    expect(fields.militaryEducation).toEqual(["BASIC LEADER COURSE 2010"]);
  });
});
