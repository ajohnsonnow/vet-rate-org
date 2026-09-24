import { describe, it, expect } from "vitest";
import { parseRatingCodeSheets, latestRatingCodeSheet } from "./vaCodeSheet";

// Shaped like the real 2024 layout after pdf.js extraction: page footers with
// the decision date land in the middle of entries, names carry VA's [tags],
// and each entry lists its full dated percentage history.
const NEW_LAYOUT = `--- PAGE 51 ---
ACTIVE DUTY EOD RAD BRANCH CHARACTER OF DISCHARGE 05/06/2002 04/30/2003 Army Honorable 02/16/2006 06/29/2007 Army Honorable LEGACY CODES
JURISDICTION: New Claim Received 09/15/2023 SUBJECT TO COMPENSATION (1.SC)
9411 POST-TRAUMATIC STRESS DISORDER [PTSD - Combat/Combat Medal] Service Connected, Gulf War, Incurred Static Disability 30% from 06/30/2007 50% from 03/31/2023, Earlier Effective Date Denied
5243 LUMBOSACRAL STRAIN (PREVIOUSLY RATED AS LUMBAGO) Service Connected, Gulf War, Incurred Static Disability 10% from 06/30/2008 (5299-5237) 20% from 09/15/2023 -Intent To File
8726 RADICULOPATHY, LEFT LOWER EXTREMITY (FEMORAL) ASSOCIATED WITH LUMBOSACRAL STRAIN
Rating Decision Department of Veterans Affairs Veterans Benefits Administration Page 1 of 3 05/06/2024 NAME OF VETERAN JANE Q SAMPLE SOCIAL SECURITY NR 000-00-0000 POA SOME ORG COPY TO COPY MADE BY VBA FROM A RECORD IN VA'S POSSESSION
--- PAGE 52 ---
Service Connected, Gulf War, Secondary Static Disability 10% from 03/31/2023 (8526) 20% from 09/15/2023 -Intent To File
6260 TINNITUS Service Connected, Gulf War, Incurred Static Disability 10% from 03/31/2023
6522 RHINITIS [Gulf War Presumptive 3.320/Particulate Matter] Service Connected, Gulf War, Presumptive Static Disability 0% from 08/10/2022 Original Date of Denial: 11/26/2008
COMBINED EVALUATION FOR COMPENSATION : 30% from 06/30/2007 40% from 06/30/2008
Rating Decision Department of Veterans Affairs Veterans Benefits Administration Page 2 of 3 05/06/2024 000 00 0000
--- PAGE 53 ---
70% from 03/31/2023 80% from 09/15/2023 (Bilateral factor of 4.2 Percent)
NOT SERVICE CONNECTED/NOT SUBJECT TO COMPENSATION (8.NSCPeacetime, Gulf War)
6512 SINUSITIS [Toxic Exposure Risk Activity (TERA)/TERA Conceded] Not Service Connected, Gulf War, No Diagnosis Original Date of Denial: 07/06/2023
8100 BILATERAL HEARING LOSS Not Service Connected, Peacetime, Hearing Normal for VA Purposes Original Date of Denial: 07/06/2023
______ eSign: certified by
`;

// Older layout: the dated page header sits above ACTIVE DUTY.
const OLD_LAYOUT = `--- PAGE 1605 ---
Rating Decision Department of Veterans Affairs Regional Office Page 1 11/26/2008 NAME OF VETERAN J. VA FILE NUMBER 000000000 POA COPY TO ACTIVE DUTY EOD RAD BRANCH CHARACTER OF DISCHARGE 02/16/2006 06/29/2007 Army Honorable
SUBJECT TO COMPENSATION (1. SC) 9434-9412 PANIC DISORDER WITHOUT AGORAPHOBIA (NOS) Service Connected, Gulf War, Incurred Future Exam June 2012 30% from 06/30/2007 5299-5237 LUMBAGO Service Connected, Gulf War, Incurred 10% from 06/30/2008 COMBINED EVALUATION FOR COMPENSATION : 30% from 06/30/2007 40% from 06/30/2008 NOT SERVICE CONNECTED/NOT SUBJECT TO COMPENSATION (8.NSC Gulf War) 6847 SLEEP DISORDER Not Service Connected, Not Incurred/Caused by Service
`;

describe("parseRatingCodeSheets", () => {
  it("reads every service-connected condition with its current percentage", () => {
    const [sheet] = parseRatingCodeSheets(NEW_LAYOUT);
    expect(sheet.sheetDate).toBe("2024-05-06");
    expect(
      sheet.conditions.map((c) => [
        c.diagnosticCode,
        c.rating,
        c.effectiveDate,
      ]),
    ).toEqual([
      ["9411", 50, "2023-03-31"],
      ["5243", 20, "2023-09-15"],
      ["8726", 20, "2023-09-15"],
      ["6260", 10, "2023-03-31"],
      ["6522", 0, "2022-08-10"],
    ]);
  });

  it("strips VA tags and page furniture from names and recases them", () => {
    const [sheet] = parseRatingCodeSheets(NEW_LAYOUT);
    const names = sheet.conditions.map((c) => c.name);
    expect(names[0]).toBe("Post-traumatic stress disorder");
    expect(sheet.conditions[0].tags).toEqual(["PTSD - Combat/Combat Medal"]);
    expect(names[2]).toBe(
      "Radiculopathy, left lower extremity (femoral) associated with lumbosacral strain",
    );
    expect(names.join(" ")).not.toMatch(/SAMPLE|000|NAME OF VETERAN|COPY/);
  });

  it("keeps each condition's dated history", () => {
    const [sheet] = parseRatingCodeSheets(NEW_LAYOUT);
    expect(sheet.conditions[0].history).toEqual([
      { percentage: 30, effectiveDate: "2007-06-30" },
      { percentage: 50, effectiveDate: "2023-03-31" },
    ]);
  });

  it("reads the combined rating history across a page break", () => {
    const [sheet] = parseRatingCodeSheets(NEW_LAYOUT);
    expect(sheet.combinedRating).toBe(80);
    expect(sheet.combinedRatingHistory.map((h) => h.percentage)).toEqual([
      30, 40, 70, 80,
    ]);
  });

  it("lists not-service-connected conditions with their denial dates", () => {
    const [sheet] = parseRatingCodeSheets(NEW_LAYOUT);
    expect(sheet.notServiceConnected).toEqual([
      {
        name: "Sinusitis",
        diagnosticCode: "6512",
        originalDenialDate: "2023-07-06",
      },
      {
        name: "Bilateral hearing loss",
        diagnosticCode: "8100",
        originalDenialDate: "2023-07-06",
      },
    ]);
  });

  it("reads the active-duty periods", () => {
    const [sheet] = parseRatingCodeSheets(NEW_LAYOUT);
    expect(sheet.servicePeriods).toEqual([
      {
        entryDate: "2002-05-06",
        separationDate: "2003-04-30",
        branch: "Army",
        characterOfDischarge: "Honorable",
      },
      {
        entryDate: "2006-02-16",
        separationDate: "2007-06-29",
        branch: "Army",
        characterOfDischarge: "Honorable",
      },
    ]);
  });
});

describe("parseRatingCodeSheets: older layout and edge cases", () => {
  it("reads the older layout, including hyphenated diagnostic codes", () => {
    const [sheet] = parseRatingCodeSheets(OLD_LAYOUT);
    expect(sheet.sheetDate).toBe("2008-11-26");
    expect(sheet.conditions.map((c) => [c.diagnosticCode, c.rating])).toEqual([
      ["9434-9412", 30],
      ["5299-5237", 10],
    ]);
    expect(sheet.combinedRating).toBe(40);
    expect(sheet.notServiceConnected[0].name).toBe("Sleep disorder");
    expect(sheet.notServiceConnected[0].originalDenialDate).toBeNull();
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
    expect(latest.sheetDate).toBe("2024-05-06");
    expect(latest.combinedRating).toBe(80);
    expect(
      latestRatingCodeSheet(`${NEW_LAYOUT}\n${OLD_LAYOUT}`).sheetDate,
    ).toBe("2024-05-06");
  });
});
