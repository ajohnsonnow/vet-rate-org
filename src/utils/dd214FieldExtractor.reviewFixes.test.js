/**
 * D25-4 review fixes: list bounds, caption tails and wrapped awards, in
 * generic fixtures that keep only the line shapes of real OCR.
 */
import { describe, it, expect } from "vitest";
import { extractDD214Fields } from "./dd214FieldExtractor";
import { sanitizeParserFields } from "./dd214ParserTextGuards";

const CAPTION =
  "13. DECORATIONS, MEDALS, BADGES, CITATIONS AND CAMPAIGN RIBBONS AWARDED OR AUTHORIZED (All periods of service)";
const EDU =
  "14. MILITARY EDUCATION (Course title, number of weeks and month and year completed)";

const fieldsOf = (...lines) => extractDD214Fields(lines.join("\n")).fields;
const names = (fields) => (fields.awards ?? []).map((a) => a.name);

describe("D25-4 review: garbled caption tail", () => {
  it("keeps one-per-line awards under a caption with a misread word", () => {
    const fields = fieldsOf(
      "13. DECORATIONS, MEDALS, BADGES, CITATIONS AND CAMPAGN RIBBONS AWARDED OR AUTHORIZED (All periods of service)",
      "ARMY COMMENDATION MEDAL",
      "ARMY SERVICE RIBBON",
      "",
      "14. MILITARY EDUCATION (Course title)",
    );
    expect(names(fields)).toEqual([
      "ARMY COMMENDATION MEDAL",
      "ARMY SERVICE RIBBON",
    ]);
  });

  it("keeps a single award with no note under a misread caption", () => {
    const fields = fieldsOf(
      "13. DECORATIONS, MEDALS, BADGES, CITATIONS AND CAMPAGN RIBBONS AWARDED OR AUTHORIZED (All periods of service)",
      "ARMY SERVICE RIBBON",
      "",
      "14. MILITARY EDUCATION (Course title)",
    );
    expect(names(fields)).toEqual(["ARMY SERVICE RIBBON"]);
  });

  it("keeps a single award under the NGB-22 caption with a wrapped note", () => {
    const fields = fieldsOf(
      "15. DECORATIONS, ,MEDALS,BADGES,COMMENDATIONS,CITATIONS",
      "AND Creep RIBBONS AWARDED THIS PERIOD        (State Awards may",
      "e inciu",
      "ARMY SERVICE RIBBON",
      "",
      "14. HIGHEST EDUCATION LEVEL SUCCESSFULLY COMPLETED",
    );
    expect(names(fields)).toEqual(["ARMY SERVICE RIBBON"]);
  });
});

describe("D25-4 review: first award after an unclosed caption note", () => {
  it("keeps a first award that carries its own bracket", () => {
    const fields = fieldsOf(
      "13. DECORATIONS, MEDALS, BADGES, CITATIONS AND CAMPAIGN RIBBONS AWARDED OR AUTHORIZED (All periods of service",
      "ARCOM (2ND AWARD)//AAM//NDSM//NOTHING FOLLOWS",
    );
    expect(names(fields)).toEqual(["ARCOM", "AAM", "NDSM"]);
    expect(fields.awards[0].deviceCount).toBe(2);
  });

  it("still drops the note's wrapped end", () => {
    const fields = fieldsOf(
      "13. DECORATIONS, MEDALS, BADGES, CITATIONS AND CAMPAIGN RIBBONS AWARDED OR AUTHORIZED (All periods of",
      "service)",
      "ARCOM//AAM//NOTHING FOLLOWS",
    );
    expect(names(fields)).toEqual(["ARCOM", "AAM"]);
  });
});

describe("D25-4 review: a wrapped award stays one entry", () => {
  it.each([
    [
      "MERITORIOUS UNIT",
      "COMMENDATION MEDAL",
      "MERITORIOUS UNIT COMMENDATION MEDAL",
    ],
    [
      "ARMY RESERVE COMPONENTS ACHIEVEMENT",
      "MEDAL (2ND AWARD)",
      "ARMY RESERVE COMPONENTS ACHIEVEMENT MEDAL",
    ],
  ])("%s / %s", (first, second, whole) => {
    const fields = fieldsOf(CAPTION, first, `${second}//NOTHING FOLLOWS`);
    expect(names(fields)).toEqual([whole]);
  });

  it("keeps a count with the whole name", () => {
    const fields = fieldsOf(
      CAPTION,
      "ARMY RESERVE COMPONENTS ACHIEVEMENT",
      "MEDAL (2ND AWARD)//NOTHING FOLLOWS",
    );
    expect(fields.awards[0].deviceCount).toBe(2);
  });

  it("still splits one-per-line lists of whole names and of acronyms", () => {
    const long = fieldsOf(
      CAPTION,
      "ARMY ACHIEVEMENT MEDAL",
      "ARMED FORCES EXPEDITIONARY",
      "MEDAL",
      "NATIONAL DEFENSE SERVICE MEDAL",
      "NOTHING FOLLOWS",
    );
    expect(names(long)).toHaveLength(3);
    const acronyms = fieldsOf(
      CAPTION,
      "ARCOM",
      "AAM",
      "NDSM",
      "NOTHING FOLLOWS",
    );
    expect(names(acronyms)).toEqual(["ARCOM", "AAM", "NDSM"]);
  });
});

describe("D25-4 review: a box number with its dot dropped ends a list", () => {
  it("ends education before '16 DAYS ACCRUED LEAVE PAID' and what follows", () => {
    const fields = fieldsOf(
      EDU,
      "BASIC CRS 8WK JUN 85//NCOC 2WK MAR 86",
      "16 DAYS ACCRUED LEAVE PAID",
      "PUBLIC, JOHN Q",
      "SPRINGFIELD, IL",
    );
    expect(sanitizeParserFields(fields).militaryEducation).toEqual([
      "BASIC CRS 8WK JUN 85",
      "NCOC 2WK MAR 86",
    ]);
  });

  it("ends awards before '14 MILITARY EDUCATION' without 'NDSM 14'", () => {
    const fields = fieldsOf(
      CAPTION,
      "ARCOM//NDSM 14 MILITARY EDUCATION (Course title)",
      "BASIC CRS 8WK JUN 85//NOTHING FOLLOWS",
    );
    expect(names(fields)).toEqual(["ARCOM", "NDSM"]);
  });

  it("ends education before '15aMEMBER CONTRIBUTED'", () => {
    const fields = fieldsOf(
      EDU,
      "BASIC CRS 8WK JUN 85",
      "15aMEMBER CONTRIBUTED TO POST-VIETNAM ERA",
    );
    expect(fields.militaryEducation).toEqual(["BASIC CRS 8WK JUN 85"]);
  });

  it('ends NGB-22 awards before "16 SERVICEMAN\'S | 17 PERSONNEL SECURITY"', () => {
    const fields = fieldsOf(
      "15. DECORATIONS, ,MEDALS,BADGES,COMMENDATIONS,CITATIONS",
      "AND CAMPAIGN RIBBONS AWARDED THIS PERIOD (State Awards may be included)",
      "ARCOM//NDSM 16 SERVICEMAN'S | 17 PERSONNEL SECURITY",
    );
    expect(names(fields)).toEqual(["ARCOM", "NDSM"]);
  });
});

describe("D25-4 review: a course named like a caption is kept", () => {
  it.each([
    "PERSONNEL SECURITY CRS 2WK JUN 85",
    "PRIMARY LEADERSHIP DEV CRS 4WK MAR 86",
    "GROUP LIFE INSURANCE COUNSELOR CRS 1WK 86",
    "HIGHEST EDUCATION COUNSELOR CRS 1WK 86",
    "PRIMARY SPECIALTY SKILLS CRS 3WK 87",
  ])("%s", (course) => {
    const fields = fieldsOf(EDU, `${course}//NOTHING FOLLOWS`);
    expect(fields.militaryEducation).toEqual([course]);
  });
});

const ngb22Education = (valueLine, noteLine) =>
  [
    `12. MILITARY EDUCATION (Course Title,number of weeks,month and year${" ".repeat(10)}13. PRIMARY SPECIALTY NUMBER, TITLE AND DATE AWARDED`,
    noteLine ??
      "completed)                                                 (Additional specialty numbers and titles)",
    "",
    valueLine,
    "NOTHING FOLLOWS",
    "",
    "NONE",
  ].join("\n");

describe("D25-4 review: NGB-22 education beside the specialty box", () => {
  const courses = ["SUPPLY ASSIST CRS 4WK 84", "NCOC 2WK 86", "BLC 3WK 87"];
  const sameRow =
    "SUPPLY ASSIST CRS 4WK 84/NCOC 2WK 86//BLC 3WK 87//          (R)  11B1 RIFLEMAN                   19880412";

  it("reads the courses when a wide line ends the instruction window inside box 13", () => {
    const text = [
      `12. MILITARY EDUCATION (Course Title,number of weeks,month and year${" ".repeat(120)}13. PRIMARY SPECIALTY NUMBER, TITLE AND DATE AWARDED`,
      "completed)",
      "",
      sameRow,
      "NOTHING FOLLOWS",
    ].join("\n");
    expect(extractDD214Fields(text).fields.militaryEducation).toEqual(courses);
  });

  it("keeps weeks and year printed in columns with wide gaps", () => {
    const wide =
      "SUPPLY ASSIST CRS       4WK      84      (R) 11B1 RIFLEMAN      19880412";
    const fields = extractDD214Fields(ngb22Education(wide)).fields;
    expect(fields.militaryEducation).toEqual(["SUPPLY ASSIST CRS 4WK 84"]);
  });

  it("does not let box 13's value in on a gap of a few spaces", () => {
    const narrow = "BLC 3WK 87    11B1 RIFLEMAN   19880412";
    const fields = extractDD214Fields(ngb22Education(narrow)).fields;
    expect(fields.militaryEducation).toEqual(["BLC 3WK 87"]);
  });

  it("drops the wrap line when the neighbour's note lost its bracket", () => {
    const note =
      "completed)                                                 Additional specialty numbers and titles)";
    const fields = extractDD214Fields(ngb22Education(sameRow, note)).fields;
    expect(sanitizeParserFields(fields).militaryEducation).toEqual(courses);
  });
});

describe("D25-4 review: label-only specialty and numeric dates", () => {
  it("drops a primary specialty that is only the box caption", () => {
    const shown = sanitizeParserFields({
      primarySpecialty: "NUMBER, TITLE AND DATE AWARDED",
    });
    expect(shown.primarySpecialty).toBeUndefined();
  });

  it("keeps a real primary specialty", () => {
    const shown = sanitizeParserFields({ primarySpecialty: "11B1 RIFLEMAN" });
    expect(shown.primarySpecialty).toBe("11B1 RIFLEMAN");
  });

  it("does not read a week count and a month/year as one numeric date", () => {
    const shown = sanitizeParserFields({
      militaryEducation: ["BASIC CRS 4 6/1986"],
    });
    expect(shown.militaryEducation).toEqual(["BASIC CRS 4 6/1986"]);
  });

  it("still removes a full numeric date in one separator style", () => {
    const shown = sanitizeParserFields({
      militaryEducation: ["BASIC CRS 6/15/1986 ARMY"],
    });
    expect(shown.militaryEducation.join(" ")).not.toContain("6/15/1986");
  });
});
