import { describe, it, expect } from "vitest";
import {
  codeSheetRecordEvents,
  latestRatingCodeSheet,
  parseRatingCodeSheets,
} from "./vaCodeSheet";

// Shaped like a recent code-sheet layout after pdf.js extraction: page footers
// with the decision date land in the middle of entries, names carry VA's
// [tags], and each entry lists its full dated percentage history.
const NEW_LAYOUT = `--- PAGE 90416 ---
ACTIVE DUTY EOD RAD BRANCH CHARACTER OF DISCHARGE 03/25/1993 03/14/1994 Army Honorable 12/23/1996 05/01/1998 Army Honorable LEGACY CODES
JURISDICTION: New Claim Received 07/20/2014 SUBJECT TO COMPENSATION (1.SC)
7319 IRRITABLE BOWEL SYNDROME [IBS - Gulf War/Undiagnosed Illness] Service Connected, Peacetime, Incurred Dynamic Disability 10% from 05/02/1998 30% from 12/24/2013, Effective Date Under Review
5237 CERVICAL STRAIN (PREVIOUSLY RATED AS NECK SPRAIN) Service Connected, Peacetime, Incurred Dynamic Disability 10% from 05/12/1999 (5299-5290) 20% from 07/20/2014 -Informal Claim
8715 NEUROPATHY, LEFT UPPER EXTREMITY (MEDIAN) ASSOCIATED WITH CERVICAL STRAIN
Rating Decision Department of Veterans Affairs Veterans Benefits Administration Page 23 of 41 12/31/2014 NAME OF VETERAN JANE Q SAMPLE SOCIAL SECURITY NR 000-00-0000 POA SOME ORG COPY TO COPY MADE BY VBA FROM A RECORD IN VA'S POSSESSION
--- PAGE 90417 ---
Service Connected, Peacetime, Secondary Dynamic Disability 10% from 12/24/2013 (8516) 20% from 07/20/2014 -Informal Claim
6602 BRONCHIAL ASTHMA Service Connected, Peacetime, Incurred Dynamic Disability 10% from 12/24/2013
6513 CHRONIC SINUSITIS [Presumptive 3.317/Environmental Hazard] Service Connected, Peacetime, Presumptive Dynamic Disability 0% from 07/21/2012 Original Date of Denial: 03/08/1999
COMBINED EVALUATION FOR COMPENSATION : 10% from 05/02/1998 20% from 05/12/1999
Rating Decision Department of Veterans Affairs Veterans Benefits Administration Page 24 of 41 12/31/2014 000 00 0000
--- PAGE 90418 ---
50% from 12/24/2013 60% from 07/20/2014 (Bilateral factor of 3.6 Percent)
NOT SERVICE CONNECTED/NOT SUBJECT TO COMPENSATION (8.NSCPeacetime, Gulf War)
7346 HIATAL HERNIA [Toxic Exposure Risk Activity (TERA)/TERA Conceded] Not Service Connected, Gulf War, No Diagnosis Original Date of Denial: 04/06/2014
5024 TENDINITIS, LEFT WRIST Not Service Connected, Peacetime, No Current Disability Original Date of Denial: 04/06/2014
______ eSign: certified by
`;

// A diagnostic-code-shaped fragment ("5301 Prior Muscle Injury Reference")
// sits inside 7101's continuation text before its own "Service Connected"
// phrase appears, so it looks like a new entry start with no status of its
// own. It must fold back into the preceding entry instead of becoming a
// phantom condition.
const SPURIOUS_CODE_FRAGMENT = `SUBJECT TO COMPENSATION (1.SC) 7101 HYPERTENSION Service Connected, Peacetime, Incurred 10% from 11/29/2010 5301 Prior Muscle Injury Reference 5237 CERVICAL STRAIN Service Connected, Peacetime, Incurred 20% from 11/29/2010`;

// Older layout: the dated page header sits above ACTIVE DUTY.
const OLD_LAYOUT = `--- PAGE 1204 ---
Rating Decision Department of Veterans Affairs Regional Office Page 7 09/23/1999 NAME OF VETERAN J. VA FILE NUMBER 000000000 POA COPY TO ACTIVE DUTY EOD RAD BRANCH CHARACTER OF DISCHARGE 12/23/1996 05/01/1998 Army Honorable
SUBJECT TO COMPENSATION (1. SC) 7399-7319 SPASTIC COLON (NOS) Service Connected, Peacetime, Incurred Future Exam February 2004 10% from 05/02/1998 5299-5290 NECK SPRAIN Service Connected, Peacetime, Incurred 10% from 05/12/1999 COMBINED EVALUATION FOR COMPENSATION : 10% from 05/02/1998 20% from 05/12/1999 NOT SERVICE CONNECTED/NOT SUBJECT TO COMPENSATION (8.NSC Gulf War) 7101 HYPERTENSION Not Service Connected, Not Incurred/Caused by Service
`;

describe("parseRatingCodeSheets", () => {
  it("reads every service-connected condition with its current percentage", () => {
    const [sheet] = parseRatingCodeSheets(NEW_LAYOUT);
    expect(sheet.sheetDate).toBe("2014-12-31");
    expect(
      sheet.conditions.map((c) => [
        c.diagnosticCode,
        c.rating,
        c.effectiveDate,
      ]),
    ).toEqual([
      ["7319", 30, "2013-12-24"],
      ["5237", 20, "2014-07-20"],
      ["8715", 20, "2014-07-20"],
      ["6602", 10, "2013-12-24"],
      ["6513", 0, "2012-07-21"],
    ]);
  });

  it("strips VA tags and page furniture from names and recases them", () => {
    const [sheet] = parseRatingCodeSheets(NEW_LAYOUT);
    const names = sheet.conditions.map((c) => c.name);
    expect(names[0]).toBe("Irritable bowel syndrome");
    expect(sheet.conditions[0].tags).toEqual([
      "IBS - Gulf War/Undiagnosed Illness",
    ]);
    expect(names[2]).toBe(
      "Neuropathy, left upper extremity (median) associated with cervical strain",
    );
    expect(names.join(" ")).not.toMatch(/SAMPLE|000|NAME OF VETERAN|COPY/);
  });

  it("keeps each condition's dated history", () => {
    const [sheet] = parseRatingCodeSheets(NEW_LAYOUT);
    expect(sheet.conditions[0].history).toEqual([
      { percentage: 10, effectiveDate: "1998-05-02" },
      { percentage: 30, effectiveDate: "2013-12-24" },
    ]);
  });

  it("reads the combined rating history across a page break", () => {
    const [sheet] = parseRatingCodeSheets(NEW_LAYOUT);
    expect(sheet.combinedRating).toBe(60);
    expect(sheet.combinedRatingHistory.map((h) => h.percentage)).toEqual([
      10, 20, 50, 60,
    ]);
  });

  it("lists not-service-connected conditions with their denial dates", () => {
    const [sheet] = parseRatingCodeSheets(NEW_LAYOUT);
    expect(sheet.notServiceConnected).toEqual([
      {
        name: "Hiatal hernia",
        diagnosticCode: "7346",
        originalDenialDate: "2014-04-06",
      },
      {
        name: "Tendinitis, left wrist",
        diagnosticCode: "5024",
        originalDenialDate: "2014-04-06",
      },
    ]);
  });
});

describe("parseRatingCodeSheets: header fields", () => {
  it("names the power of attorney, and none when the field is empty", () => {
    expect(parseRatingCodeSheets(NEW_LAYOUT)[0].representative).toBe(
      "Some Org",
    );
    expect(parseRatingCodeSheets(OLD_LAYOUT)[0].representative).toBeNull();
  });

  it("reads the active-duty periods", () => {
    const [sheet] = parseRatingCodeSheets(NEW_LAYOUT);
    expect(sheet.servicePeriods).toEqual([
      {
        entryDate: "1993-03-25",
        separationDate: "1994-03-14",
        branch: "Army",
        characterOfDischarge: "Honorable",
      },
      {
        entryDate: "1996-12-23",
        separationDate: "1998-05-01",
        branch: "Army",
        characterOfDischarge: "Honorable",
      },
    ]);
  });
});

describe("parseRatingCodeSheets: older layout and edge cases", () => {
  it("reads the older layout, including hyphenated diagnostic codes", () => {
    const [sheet] = parseRatingCodeSheets(OLD_LAYOUT);
    expect(sheet.sheetDate).toBe("1999-09-23");
    expect(sheet.conditions.map((c) => [c.diagnosticCode, c.rating])).toEqual([
      ["7399-7319", 10],
      ["5299-5290", 10],
    ]);
    expect(sheet.combinedRating).toBe(20);
    expect(sheet.notServiceConnected[0].name).toBe("Hypertension");
    expect(sheet.notServiceConnected[0].originalDenialDate).toBeNull();
  });

  it("folds a diagnostic-code-shaped fragment inside an entry's continuation into that entry instead of a phantom condition", () => {
    const [sheet] = parseRatingCodeSheets(SPURIOUS_CODE_FRAGMENT);
    expect(sheet.conditions.map((c) => c.diagnosticCode)).toEqual([
      "7101",
      "5237",
    ]);
    expect(sheet.conditions[1].name).toBe("Cervical strain");
    expect(sheet.conditions[0].rating).toBe(10);
  });

  it("returns nothing for text without a code sheet", () => {
    expect(parseRatingCodeSheets("We made a decision on your claim.")).toEqual(
      [],
    );
    expect(parseRatingCodeSheets(null)).toEqual([]);
    expect(latestRatingCodeSheet("")).toBeNull();
  });
});

describe("latestRatingCodeSheet", () => {
  it("picks the newest sheet whatever order they appear in", () => {
    const latest = latestRatingCodeSheet(`${OLD_LAYOUT}\n${NEW_LAYOUT}`);
    expect(latest.sheetDate).toBe("2014-12-31");
    expect(latest.combinedRating).toBe(60);
    expect(
      latestRatingCodeSheet(`${NEW_LAYOUT}\n${OLD_LAYOUT}`).sheetDate,
    ).toBe("2014-12-31");
  });
});

describe("codeSheetRecordEvents", () => {
  it("dates every rating decision and the claim each one answered", () => {
    expect(codeSheetRecordEvents(`${OLD_LAYOUT}\n${NEW_LAYOUT}`)).toEqual([
      {
        date: "1999-09-23",
        eventType: "rating_decision",
        description: "VA rating decision",
      },
      {
        date: "2014-07-20",
        eventType: "claim_received",
        description: "New Claim received by VA",
      },
      {
        date: "2014-12-31",
        eventType: "rating_decision",
        description: "VA rating decision",
      },
    ]);
  });
});
