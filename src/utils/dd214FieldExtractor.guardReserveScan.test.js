/**
 * A Guard/Reserve-era scan read in columns (final24 D24-2, D24-4): each value
 * comes from its own labelled box, bounded at the next printed box label, and
 * never from a default or from the form title. Fixtures are synthetic; see
 * dd214GuardReserveScan.fixture.js.
 */
import { describe, it, expect } from "vitest";
import { extractDD214Fields } from "./dd214FieldExtractor";
import { sanitizeParserFields } from "./dd214ParserTextGuards";
import {
  AWARD_NAMES,
  COMPONENT_TOKEN,
  COURSE,
  GUARD_RESERVE_SCAN,
  REASON,
} from "./dd214GuardReserveScan.fixture";

const read = (text = GUARD_RESERVE_SCAN) => extractDD214Fields(text);

describe("box 2: the component", () => {
  it("is the Guard token printed away from the label, not the regular component", () => {
    const { fields } = read();
    expect(fields.component).toBe(COMPONENT_TOKEN);
    expect(fields.componentFull).toBe("Army National Guard");
    expect(fields.branch).toBeNull();
  });

  it("never takes the corner notice or the title tail as the box value", () => {
    const { fields } = read();
    expect(JSON.stringify(fields)).not.toMatch(
      /ALTERATIUNDS|RENDER FORM|ROM ACTIVE|Regular/,
    );
  });

  it("is flagged as not read from its own box, so it is never pre-ticked", () => {
    const { fieldChecks } = read();
    for (const key of ["component", "componentFull"]) {
      expect(fieldChecks[key], key).toBe("not-read-from-its-own-box");
    }
  });

  it("is empty when no token can be paired with the label", () => {
    const withoutToken = GUARD_RESERVE_SCAN.replace(
      `\n\n${COMPONENT_TOKEN}\n\n`,
      "\n\n",
    );
    const { fields, fieldChecks } = read(withoutToken);
    expect(fields.component).toBeUndefined();
    expect(fields.componentFull).toBeUndefined();
    expect(fieldChecks.component).toBeUndefined();
  });

  it("is not guessed when two different tokens could pair with the label", () => {
    const twoTokens = GUARD_RESERVE_SCAN.replace(
      "7.b HOME",
      "ANGUS\n\n7.b HOME",
    );
    expect(read(twoTokens).fields.component).toBeUndefined();
  });

  it("is read as before from its own labelled box, and is then trusted", () => {
    const { fields, fieldChecks } = read(
      "2. DEPARTMENT, COMPONENT AND BRANCH: ARMY/ACTIVE\n3. SOCIAL SECURITY NO.\n",
    );
    expect(fields).toMatchObject({
      branch: "Army",
      component: "RA",
      componentFull: "Regular Army",
    });
    expect(fieldChecks.component).toBeUndefined();
  });

  it("does not give a branch word to a value that has none", () => {
    const { fields } = read(
      "2. DEPARTMENT, COMPONENT AND BRANCH\nUSNR\n3. SOCIAL SECURITY NO.\n",
    );
    expect(fields.component).toBe("USNR");
    expect(fields.componentFull).toBe("Navy Reserve");
  });

  it("flags a regular reading that a National Guard form contradicts", () => {
    const { fields, fieldChecks } = read(
      "NATIONAL GUARD BUREAU\nREPORT OF SEPARATION AND RECORD OF SERVICE\n2. DEPARTMENT, COMPONENT AND BRANCH: ARMY/ACTIVE\n3. SOCIAL SECURITY NO.\n",
    );
    expect(fields.component).toBe("RA");
    expect(fieldChecks.component).toBe("page-disagrees");
    expect(fieldChecks.componentFull).toBe("page-disagrees");
  });
});

describe("box 29: days lost", () => {
  it("is NONE, the first token under the label, not the page text after it", () => {
    expect(read().fields.daysLost).toBe("NONE");
  });

  it("is a number when a number is printed", () => {
    expect(
      read("29. DATES OF TIME LOST DURING THIS PERIOD\n12 DAYS\n").fields
        .daysLost,
    ).toBe("12");
  });

  it("is empty when the box holds anything else", () => {
    const text =
      "29. DATES OF TIME LOST DURING THIS PERIOD\nDD FORM 214 AUTOMATED\n30. MEMBER REQUESTS COPY 4\n";
    expect(read(text).fields.daysLost).toBeUndefined();
  });
});

describe("box 14: military education", () => {
  it("is the one course, from after the printed instruction to before NOTHING FOLLOWS", () => {
    expect(read().fields.militaryEducation).toEqual([COURSE]);
  });

  it("splits on semicolons, slashes and line breaks", () => {
    const text =
      "14. MILITARY EDUCATION (Course, title)\nFIRST AID COURSE, 1 WEEK, 2008; BASIC DRIVER COURSE, 2 WEEKS, 2009\nUNIT TRAINING, 3 WEEKS, 2010//NOTHING FOLLOWS\n";
    expect(read(text).fields.militaryEducation).toEqual([
      "FIRST AID COURSE, 1 WEEK, 2008",
      "BASIC DRIVER COURSE, 2 WEEKS, 2009",
      "UNIT TRAINING, 3 WEEKS, 2010",
    ]);
  });
});

describe("box 13: awards", () => {
  it("lists every award of a list the scan split in two, all inside box 13", () => {
    const { fields } = read();
    expect(fields.awards.map((award) => award.name)).toEqual(AWARD_NAMES);
  });

  it("reads each award's device and count", () => {
    const byName = Object.fromEntries(
      read().fields.awards.map((award) => [award.name, award]),
    );
    expect(byName["ALPHA SERVICE MEDAL"].deviceCount).toBe(2);
    expect(byName["FOXTROT GOOD CONDUCT MEDAL"].deviceCount).toBe(3);
    expect(byName["GOLF EXPEDITIONARY MEDAL"].devices).toEqual(["M Device"]);
  });

  it("finds the combat decoration in the joined list", () => {
    const { fields } = read();
    expect(fields.combatService.hasVerifiedCombat).toBe(true);
    expect(JSON.stringify(fields.combatService.indicators)).toMatch(
      /PURPLE HEART/i,
    );
  });

  it("keeps none of another box's caption or value", () => {
    const text = JSON.stringify(read().fields.awards);
    expect(text).not.toMatch(
      /DUTY ASSIGNMENT|DATE OF BIRTH|MAJOR COMMAND|ARNGUS|DECORATIONS|AUTHORIZED/,
    );
  });

  it("splits a flat list on single slashes and keeps W/ with its award", () => {
    const text =
      "13. DECORATIONS, MEDALS, BADGES: FIRST MEDAL/SECOND RIBBON W/ V DEVICE//THIRD AWARD //NOTHING FOLLOWS\n14. MILITARY EDUCATION: NONE\n";
    const names = read(text).fields.awards.map((award) => award.name);
    expect(names).toEqual(["FIRST MEDAL", "SECOND RIBBON", "THIRD AWARD"]);
  });

  it("keeps the I of an award that starts with one after a single slash", () => {
    const text =
      "13. DECORATIONS, MEDALS, BADGES: FIRST MEDAL/IRAQ CAMPAIGN MEDAL//NOTHING FOLLOWS\n";
    const names = read(text).fields.awards.map((award) => award.name);
    expect(names).toEqual(["FIRST MEDAL", "IRAQ CAMPAIGN MEDAL"]);
  });
});

describe("box 28: narrative reason", () => {
  it("is the reason printed away from the label, flagged as such", () => {
    const { fields, fieldChecks } = read();
    expect(fields.narrativeReason).toBe(REASON);
    expect(fieldChecks.narrativeReason).toBe("not-read-from-its-own-box");
  });

  it("is empty, not label text, when no reason can be paired", () => {
    const withoutReason = GUARD_RESERVE_SCAN.replace(`| "${REASON} |`, "");
    expect(read(withoutReason).fields.narrativeReason).toBeUndefined();
  });

  it("is read directly, and trusted, when it sits under its label", () => {
    const { fields, fieldChecks } = read(
      `28. NARRATIVE REASON FOR SEPARATION\n${REASON}\n29. DATES OF TIME LOST\n`,
    );
    expect(fields.narrativeReason).toBe(REASON);
    expect(fieldChecks.narrativeReason).toBeUndefined();
  });
});

describe("what reaches the screen after the parser check", () => {
  const sanitized = () =>
    sanitizeParserFields(read().fields, [{ fullName: "QUINDLE, ZORBLAX R" }]);

  it("keeps ordinary capitalised words of a course, award or reason", () => {
    const out = sanitized();
    expect(out.militaryEducation).toEqual([COURSE]);
    expect(out.awards.map((award) => award.name)).toEqual(AWARD_NAMES);
    expect(out.narrativeReason).toBe(REASON);
    expect(JSON.stringify(out)).not.toContain("[REDACTED]");
  });

  it("keeps the Guard component and NONE days lost", () => {
    const out = sanitized();
    expect(out.component).toBe(COMPONENT_TOKEN);
    expect(out.componentFull).toBe("Army National Guard");
    expect(out.daysLost).toBe("NONE");
  });
});
