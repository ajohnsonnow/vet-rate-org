/**
 * Parser values that are pre-tickable are held to the same lists and shapes a
 * model's values are, and ordinary all-capital DD-214 text is not mistaken for
 * a person. Fixtures are generic, not any real veteran's data.
 */
import { describe, it, expect } from "vitest";
import { sanitizeParserFields } from "./dd214ParserTextGuards";
import { extractDD214Fields } from "./dd214FieldExtractor";

const RUN_ON = "ZORBLAX QUINDLE T 02 03 1980 44 ELMWOOD PLACE FAKETOWN OHIO";

describe("a coded parser value that ran on into a name, date and street", () => {
  it.each([
    ["separationAuthority", `AR 635-200 CHAP 4 ${RUN_ON}`],
    ["separationType", `RELEASE FROM ACTIVE DUTY ${RUN_ON}`],
    ["characterOfService", `HONORABLE ${RUN_ON}`],
    ["rank", `SERGEANT ${RUN_ON}`],
    ["branch", `ARMY ${RUN_ON}`],
    ["securityClearance", `SECRET ${RUN_ON}`],
  ])("%s is dropped, not pre-ticked", (key, value) => {
    expect(sanitizeParserFields({ [key]: value })).not.toHaveProperty(key);
  });

  it("keeps the same fields when they hold only their own words", () => {
    const fields = {
      separationAuthority: "AR 635-200 CHAP 4",
      separationType: "RELEASE FROM ACTIVE DUTY",
      characterOfService: "HONORABLE",
      rank: "SERGEANT",
      branch: "ARMY",
      payGrade: "E-5",
      reentryCode: "RE-1",
      separationCode: "MBK",
    };
    expect(sanitizeParserFields(fields)).toEqual(fields);
  });
});

describe("ordinary all-capital entries are kept", () => {
  const read = (text) => sanitizeParserFields(extractDD214Fields(text).fields);

  it.each([
    ["mosTitle", "UNIT SUPPLY SPECIALIST"],
    ["lastDutyAssignment", "A CO 1ST BN 506TH INF REGT FC"],
    ["lastDutyAssignment", "HHC 2ND BN 3RD INF DIV FC"],
  ])("%s %s", (key, value) => {
    expect(sanitizeParserFields({ [key]: value })[key]).toBe(value);
  });

  it.each([
    "UNIT SUPPLY SPECIALIST COURSE, 8 WEEKS, 2002",
    "WHEELED VEHICLE MECHANIC COURSE, 13 WEEKS, 2001",
    "88M MOTOR TRANSPORT OPERATOR DRIVE COURSE, 7 WEEKS, 2000",
  ])("education %s", (entry) => {
    expect(
      sanitizeParserFields({ militaryEducation: [entry] }).militaryEducation,
    ).toEqual([entry]);
  });

  it("keeps a remark that states a completed term", () => {
    const remark = "MEMBER HAS COMPLETED FIRST FULL TERM OF SERVICE";
    expect(sanitizeParserFields({ remarks: remark }).remarks).toBe(remark);
  });

  it("keeps the awards on a page and not the caption residue", () => {
    const out = read(
      [
        "13. DECORATIONS, MEDALS, BADGES, CITATIONS AND CAMPAIGN RIBBONS AWARDED OR AUTHORIZED:",
        "ARMY COMMENDATION MEDAL",
        "14. MILITARY EDUCATION: BASIC LEADER COURSE, 4 WEEKS, 2009",
      ].join("\n"),
    );
    expect(JSON.stringify(out.awards)).toContain("ARMY COMMENDATION MEDAL");
    expect(JSON.stringify(out.awards)).not.toContain("REDACTED");
  });
});

describe("an unlabelled date left after a name", () => {
  it("is removed from an award name", () => {
    const out = sanitizeParserFields({
      awards: [{ name: "ARMY ACHIEVEMENT MEDAL 02 03 1980 FAKETOWN" }],
    });
    expect(JSON.stringify(out)).not.toContain("1980");
    expect(JSON.stringify(out)).toContain("ARMY ACHIEVEMENT MEDAL");
  });
});
