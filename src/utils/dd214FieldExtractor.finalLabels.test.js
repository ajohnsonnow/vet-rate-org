/**
 * D25-4: parser rows that carried form label text on scans other than the
 * Guard-era one. Fixtures are generic; they keep the line and spacing shapes
 * of the real OCR (side-by-side boxes, truncated caption words, a wrapped
 * caption, a bare label with no dot) and nothing of any real record.
 */
import { describe, it, expect } from "vitest";
import { extractDD214Fields } from "./dd214FieldExtractor";
import { sanitizeParserFields } from "./dd214ParserTextGuards";

const NGB22_EDUCATION = [
  "19. TERMINAL DATE OF RESERVE/MILITARY               YR MO DA",
  "",
  "SERVICE OBLIGATION                     2001 | 05       31 |",
  "",
  "12. MILITARY EDUCATION (Course Title,number of weeks,month and year          13. PRIMARY SPECIALTY NUMBER, TITLE AND DATE AWARDED",
  "completed)                                                 (Additional specialty numbers and titles)",
  "",
  "SUPPLY ASSIST CRS 4WK 84/NCOC 2WK 86//BLC 3WK 87//          (R)  11B1 RIFLEMAN                   19880412",
  "NOTHING FOLLOWS",
  "",
  "NONE",
  "",
  "15. DECORATIONS, ,MEDALS,BADGES,COMMENDATIONS,CITATIONS",
  "AND Creep RIBBONS AWARDED THIS PERIOD        (State Awards may",
  "e inciu",
  "",
  "BSM//JSAM//KDSM-2//ARCOM-W/M-DEV-2//HSM//AFEM//",
  "RFLMDL-MDL//MSM//MUC-2//JSCM//NDSM//ARCOM//AFSM//",
  "ASR-2//OH-MRTSVC-W/M-DEV-2//VUA-2//NOTHING",
  "FOLLOWS",
  "",
  "14. HIGHEST EDUCATION LEVEL SUCCESSFULLY COMPLETED",
  "SECONDARY/HIGH SCHOOL_4 YRS (Gr 1-12) COLLEGE _0_YRS",
].join("\n");

const DD214_TRUNCATED_CAPTION = [
  "13. DECORATIONS, MEDALS, BADGES, CITATIONS AND CAMPAIGN RIBBONS AWARDED OR AUTHORIZE (All periods of service)",
  "",
  "ARCOM(2ZND AWARD)//AAM//GOOD CONDUCT",
  "MEDAL//NDSM//ARMY SERVICE RIBBON//EXPERT RIFLE W/M",
  "DEVICE//OVERSEAS RIBBON//SHARPSHOOTER BADGE//NOTHING FOLLOWS",
  "",
  "14. MILITARY EDUCATION (Course title, number of weeks and month and year completed)",
  "BASIC CRS 8WK JUN 85//NOTHING FOLLOWS",
  "",
  "15.2. MEMBER CCNTRIBUTED TO POST-VIETNAM ERA              Yes       No",
].join("\n");

const DD214_CUT_OFF_NOTE = [
  "13. DECORATIONS, MEDALS, BADGES, CITATIONS AND CAMPAIGN RIBBONS AWARDED OR AUTHORIZED (A",
  "ARMY ACHIEVEMENT MEDAL//NOTHING FOLLOWS",
  "",
  "14. MILITARY EDUCATION (Course title, number of weeks and month and year completed)",
  "BASIC COURSE, 8 WEEKS, JUN 1985//NOTHING FOLLOWS",
].join("\n");

describe("D25-4 NGB-22 military education beside the specialty box", () => {
  const fields = extractDD214Fields(NGB22_EDUCATION).fields;

  it("reads the three entries and nothing from the captions or box 13", () => {
    expect(fields.militaryEducation).toEqual([
      "SUPPLY ASSIST CRS 4WK 84",
      "NCOC 2WK 86",
      "BLC 3WK 87",
    ]);
  });

  it("keeps every course date through the row's scrub, no mark on a date", () => {
    const shown = sanitizeParserFields(fields).militaryEducation;
    expect(shown).toEqual(fields.militaryEducation);
    expect(shown.join(" ")).not.toContain("REDACTED");
  });
});

describe("D25-4 awards with the caption in each edition's wording", () => {
  it("NGB-22 box 15: drops the whole caption, keeps 16 entries", () => {
    const awards = extractDD214Fields(NGB22_EDUCATION).fields.awards;
    expect(awards.map((a) => a.name)).toEqual([
      "BSM",
      "JSAM",
      "KDSM",
      "ARCOM",
      "HSM",
      "AFEM",
      "RFLMDL-MDL",
      "MSM",
      "MUC",
      "JSCM",
      "NDSM",
      "ARCOM",
      "AFSM",
      "ASR",
      "OH-MRTSVC",
      "VUA",
    ]);
    const counted = awards.filter((a) => a.deviceCount === 2).length;
    expect(counted).toBe(6);
    expect(awards[3].devices).toEqual(["M Device"]);
    expect(awards[14].devices).toEqual(["M Device"]);
  });

  it("DD-214 with the caption's last word cut short and a wrapped list", () => {
    const awards = extractDD214Fields(DD214_TRUNCATED_CAPTION).fields.awards;
    expect(awards.map((a) => a.name)).toEqual([
      "ARCOM",
      "AAM",
      "GOOD CONDUCT MEDAL",
      "NDSM",
      "ARMY SERVICE RIBBON",
      "EXPERT RIFLE",
      "OVERSEAS RIBBON",
      "SHARPSHOOTER BADGE",
    ]);
    expect(awards[0].deviceCount).toBe(2);
    expect(awards[5].devices).toEqual(["M Device"]);
  });

  it("DD-214 whose caption note is cut off to '(A' at the line end", () => {
    const fields = extractDD214Fields(DD214_CUT_OFF_NOTE).fields;
    expect(fields.awards.map((a) => a.name)).toEqual([
      "ARMY ACHIEVEMENT MEDAL",
    ]);
    expect(fields.militaryEducation).toEqual([
      "BASIC COURSE, 8 WEEKS, JUN 1985",
    ]);
  });

  it("never lets a bare year or month-year be redacted in an entry", () => {
    const shown = sanitizeParserFields({
      militaryEducation: [
        "BASIC CRS 8WK JUN 85",
        "NCOC 2WK 1986",
        "ABC 3WK 87",
      ],
      awards: [{ name: "ARCOM 1987", devices: [], deviceCount: 0 }],
    });
    expect(shown.militaryEducation).toHaveLength(3);
    expect(shown.militaryEducation.join(" ")).not.toContain("REDACTED");
    expect(shown.awards[0].name).toBe("ARCOM 1987");
  });
});

describe("D25-4 a list printed one entry to a line", () => {
  it("splits awards on line breaks when no separator is printed", () => {
    const text = [
      "13. DECORATIONS, MEDALS, BADGES, CITATIONS AND CAMPAIGN RIBBONS AWARDED OR AUTHORIZED (All periods of service)",
      "ARMY ACHIEVEMENT MEDAL",
      "NATIONAL DEFENSE SERVICE MEDAL",
      "NOTHING FOLLOWS",
      "14. MILITARY EDUCATION (Course title, number of weeks and month and year completed)",
      "NONE",
    ].join("\n");
    const names = extractDD214Fields(text).fields.awards.map((a) => a.name);
    expect(names).toEqual([
      "ARMY ACHIEVEMENT MEDAL",
      "NATIONAL DEFENSE SERVICE MEDAL",
    ]);
  });

  it("keeps a wrapped single award whole", () => {
    const text = [
      "13. DECORATIONS, MEDALS, BADGES, CITATIONS AND CAMPAIGN RIBBONS AWARDED OR AUTHORIZED (All periods of service)",
      "ARMY COMMENDATION MEDAL FOR",
      "MERITORIOUS SERVICE",
      "NOTHING FOLLOWS",
    ].join("\n");
    const names = extractDD214Fields(text).fields.awards.map((a) => a.name);
    expect(names).toEqual(["ARMY COMMENDATION MEDAL FOR MERITORIOUS SERVICE"]);
  });
});

describe("D25-4 branch tokens keep their own component", () => {
  const read = (box) =>
    extractDD214Fields(`2. DEPARTMENT, COMPONENT AND BRANCH\n${box}\n`).fields;

  it.each([
    ["USN", "USN"],
    ["USMC", "USMC"],
    ["USAF", "USAF"],
  ])("%s is not the Regular Army component", (token, component) => {
    const fields = read(token);
    expect(fields.component).toBe(component);
    expect(fields.componentFull).not.toMatch(/Army/);
  });

  it("a Navy page marked ACTIVE leaves the component empty", () => {
    expect(read("NAVY ACTIVE").component ?? null).toBeNull();
  });

  it("an Army page marked RA keeps RA", () => {
    expect(read("ARMY RA").component).toBe("RA");
  });
});
