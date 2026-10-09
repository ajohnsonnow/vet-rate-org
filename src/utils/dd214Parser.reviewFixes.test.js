/**
 * Review fixes for the DD-214 parser (final24): a real value that shares a
 * word with a printed caption is kept, a box takes only its own text, and a
 * printed caption is never read as a value. Fixtures are synthetic.
 */
import { describe, it, expect } from "vitest";
import {
  extractDD214Fields,
  splitAwardEntries,
  splitEducationEntries,
} from "./dd214FieldExtractor";
import { sanitizeParserFields } from "./dd214ParserTextGuards";

const read = (text) => extractDD214Fields(text);
const names = (out) => out.awards.map((award) => award.name);

describe("a real value that shares a word with a caption is kept", () => {
  it("keeps reasons, units, titles, courses and awards", () => {
    const out = sanitizeParserFields({
      narrativeReason: "SPECIAL SEPARATION BENEFIT",
      lastDutyAssignment: "MILITARY ASSISTANCE COMMAND VIETNAM",
      commandTransferredTo: "SPECIAL OPERATIONS COMMAND",
      mosTitle: "COMMAND SERGEANT MAJOR",
      militaryEducation: [
        "HIGH SCHOOL EQUIVALENCY PROGRAM, 2001",
        "MILITARY POLICE SCHOOL",
      ],
      awards: [{ name: "SPECIAL DUTY ASSIGNMENT RIBBON", devices: [] }],
    });
    expect(out.narrativeReason).toBe("SPECIAL SEPARATION BENEFIT");
    expect(out.lastDutyAssignment).toBe("MILITARY ASSISTANCE COMMAND VIETNAM");
    expect(out.commandTransferredTo).toBe("SPECIAL OPERATIONS COMMAND");
    expect(out.mosTitle).toBe("COMMAND SERGEANT MAJOR");
    expect(out.militaryEducation).toHaveLength(2);
    expect(names(out)).toEqual(["SPECIAL DUTY ASSIGNMENT RIBBON"]);
  });

  it("still drops an entry that is only caption text", () => {
    const out = sanitizeParserFields({
      militaryEducation: [
        "LAST DUTY ASSIGNMENT AND MAJOR COMMAND",
        "SPECIAL ADDITIONAL INFORMATION",
        "15A. COMMISSIONED THROUGH SERVICE ACADEMY YES NO X",
      ],
      narrativeReason: "NARRATIVE REASON FOR SEPARATION",
    });
    expect(out.militaryEducation).toEqual([]);
    expect(out.narrativeReason).toBeUndefined();
  });

  it("reads a reason that holds a caption word from box 28", () => {
    for (const reason of [
      "SPECIAL SEPARATION BENEFIT",
      "EARLY SEPARATION PROGRAM",
    ]) {
      const out = read(
        `28. NARRATIVE REASON FOR SEPARATION\n${reason}\n29. DATES OF TIME LOST\nNONE`,
      );
      expect(sanitizeParserFields(out.fields).narrativeReason, reason).toBe(
        reason,
      );
    }
  });

  it("reads a reason with a comma, parentheses or a hyphen", () => {
    for (const reason of [
      "DISABILITY, SEVERANCE PAY",
      "DISABILITY, PERMANENT (ENHANCED)",
      "NON-RETENTION ON ACTIVE DUTY",
      "MISCONDUCT (SERIOUS OFFENSE)",
    ]) {
      const out = read(
        `28. NARRATIVE REASON FOR SEPARATION\n${reason}\n29. DATES OF TIME LOST\nNONE`,
      );
      expect(out.fields.narrativeReason, reason).toBe(reason);
      expect(out.fieldChecks.narrativeReason, reason).toBeUndefined();
    }
  });
});

describe("box 29, days lost", () => {
  const withLabel = (after) =>
    read(`29. DATES OF TIME LOST DURING THIS PERIOD${after}`);

  it("does not take the first number of another box's text", () => {
    for (const after of [
      "\n\n16   DAYS ACCRUED LEAVE PAID",
      "\n\n2009   SOMETHING",
      "\n\n123   45   6789",
      "\n12345   X",
    ]) {
      expect(withLabel(after).fields.daysLost, after).toBeUndefined();
    }
  });

  it("stops at the next numbered box label", () => {
    expect(
      withLabel("\n\n30. MEMBER REQUESTS COPY\n16\n").fields.daysLost,
    ).toBeUndefined();
  });

  it("reads a count or NONE standing alone or beside the next label", () => {
    expect(withLabel("\nNONE\n").fields.daysLost).toBe("NONE");
    expect(withLabel("\n12\n").fields.daysLost).toBe("12");
    expect(withLabel("\nNONE    30. MEMBER REQUESTS").fields.daysLost).toBe(
      "NONE",
    );
  });

  it("reads the current edition's caption with its date format note", () => {
    const out = read(
      "29. DATES OF TIME LOST DURING THIS PERIOD (YYYYMMDD)\nNONE\n30. MEMBER",
    );
    expect(out.fields.daysLost).toBe("NONE");
  });
});

describe("box 2 takes only a line made of its own words", () => {
  const box2 = (under) =>
    read(
      `2. DEPARTMENT, COMPONENT AND BRANCH\n${under}\n3. SOCIAL SECURITY NUMBER`,
    );

  it("ignores another box's line printed under the label", () => {
    for (const line of [
      "USAR CONTROL GROUP (REINF)",
      "NAVY UNIT COMMENDATION//NAVY AND MARINE CORPS ACHIEVEMENT MEDAL",
      "ARNG OF TEXAS",
    ]) {
      const { fields } = box2(line);
      expect(fields.component, line).toBeUndefined();
      expect(fields.branch, line).toBeUndefined();
    }
  });

  it("reads a line made wholly of its own words", () => {
    expect(box2("ARMY/ARNGUS").fields.component).toBe("ARNGUS");
    expect(box2("ARMY NATIONAL GUARD").fields).toMatchObject({
      branch: "Army",
      component: "ARNG",
      componentFull: "Army National Guard",
    });
  });

  it("keeps a Guard token printed on the value row of a row layout, unticked", () => {
    const out = read(
      "1. NAME   2. DEPARTMENT, COMPONENT AND BRANCH   3. SOCIAL SECURITY NUMBER\nDOE, JOHN    ARMY/ARNGUS    000\n",
    );
    expect(out.fields).toMatchObject({ branch: "Army", component: "ARNGUS" });
    expect(out.fieldChecks.component).toBe("not-read-from-its-own-box");
  });

  it("flags a located component that a Guard page contradicts", () => {
    const out = read(
      "2. DEPARTMENT, COMPONENT AND BRANCH\nARMY/USAR\n3. SOCIAL SECURITY NUMBER\n9. COMMAND TO WHICH TRANSFERRED REVERT TO ARNG OF TEXAS",
    );
    expect(out.fieldChecks.component).toBe("page-disagrees");
  });
});

describe("printed captions never become awards or courses", () => {
  const FORM = (awards, education) =>
    [
      "13. DECORATIONS, MEDALS, BADGES, CITATIONS AND CAMPAIGN RIBBONS AWARDED OR AUTHORIZED (All periods of service)",
      awards,
      "14. MILITARY EDUCATION (Course title, number of weeks, and month and",
      "year completed)",
      education,
      "15A. COMMISSIONED THROUGH SERVICE ACADEMY YES NO X",
      "15B. COMMISSIONED THROUGH ROTC SCHOLARSHIP",
      "18. REMARKS",
    ].join("\n");

  it("skips the box 13 note and the wrapped box 14 instruction", () => {
    const out = read(
      FORM("ARMY COMMENDATION MEDAL", "AIRBORNE COURSE, 3 WEEKS, 2001"),
    );
    expect(names(out.fields)).toEqual(["ARMY COMMENDATION MEDAL"]);
    expect(out.fields.militaryEducation).toEqual([
      "AIRBORNE COURSE, 3 WEEKS, 2001",
    ]);
  });

  it("ends the education list at a lettered box 15 label", () => {
    const out = read(
      FORM("ARMY COMMENDATION MEDAL", "AIRBORNE COURSE, 3 WEEKS, 2001//15A."),
    );
    expect(out.fields.militaryEducation).toEqual([
      "AIRBORNE COURSE, 3 WEEKS, 2001",
    ]);
  });
});

describe("a ZIP+4 or phone number inside an award name", () => {
  it("is not left behind as digits", () => {
    const out = read(
      "13. DECORATIONS, MEDALS, BADGES\nARMY COMMENDATION MEDAL//PLANO TX 75023-1234//CALL 555-123-4567\n14. MILITARY EDUCATION\n",
    );
    const shown = JSON.stringify(sanitizeParserFields(out.fields).awards);
    expect(shown).not.toMatch(/7502|555-|4567|1234|750234/);
    expect(shown).toContain("ARMY COMMENDATION MEDAL");
  });
});

describe("splitting awards and courses", () => {
  it("keeps a service pair and a parenthesis whole", () => {
    expect(splitAwardEntries("NAVY/MARINE CORPS ACHIEVEMENT MEDAL")).toEqual([
      "NAVY/MARINE CORPS ACHIEVEMENT MEDAL",
    ]);
    expect(
      splitAwardEntries("RIFLE BAR (M16/M4)//ARMY SERVICE RIBBON"),
    ).toEqual(["RIFLE BAR (M16/M4)", "ARMY SERVICE RIBBON"]);
  });

  it("does not make an award of the word NONE", () => {
    const out = read(
      "13. DECORATIONS, MEDALS, BADGES\nNONE//NOTHING FOLLOWS\n14. MILITARY EDUCATION\n",
    );
    expect(out.fields.awards).toEqual([]);
  });

  it("keeps the I of ICELAND and INTER-AMERICAN after a separator", () => {
    expect(
      splitAwardEntries(
        "ARMY SERVICE RIBBON/ICELAND DEFENSE MEDAL/INTER-AMERICAN DEFENSE BOARD MEDAL",
      ),
    ).toEqual([
      "ARMY SERVICE RIBBON",
      "ICELAND DEFENSE MEDAL",
      "INTER-AMERICAN DEFENSE BOARD MEDAL",
    ]);
  });

  it("splits education on a single slash as well as //", () => {
    expect(
      splitEducationEntries(
        "COURSE A BASIC, 2 WEEKS, 2005/COURSE B ADVANCED, 1 WEEK, 2006",
      ),
    ).toEqual([
      "COURSE A BASIC, 2 WEEKS, 2005",
      "COURSE B ADVANCED, 1 WEEK, 2006",
    ]);
  });
});
