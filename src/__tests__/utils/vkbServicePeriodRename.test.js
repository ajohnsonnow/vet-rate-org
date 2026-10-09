/**
 * C1: rename vkb.serviceHistory.servicePeriods[].entryDate/separationDate
 * to serviceStartDate/serviceEndDate (dual-read, nothing deleted), and fix
 * the both-dates-required bug in mergeDD214ServicePeriodTracking that
 * previously silently dropped a period when only one date was extractable.
 */
import { describe, it, expect } from "vitest";
import {
  migrateOffSchemaVKB,
  initializeVKB,
  mergeDD214IntoVKB,
  mergeServicePeriodsIntoVKB,
} from "../../utils/veteranKnowledgeBase";

describe("C1: VKB servicePeriods field rename migration", () => {
  it("adds serviceStartDate/serviceEndDate without deleting entryDate/separationDate", () => {
    const vkb = initializeVKB();
    vkb.serviceHistory.servicePeriods = [
      {
        entryDate: "2010-06-01",
        separationDate: "2015-05-30",
        branch: "Army",
      },
    ];

    const { vkb: migrated, changed } = migrateOffSchemaVKB(vkb);
    expect(changed).toBe(true);

    const period = migrated.serviceHistory.servicePeriods[0];
    expect(period.serviceStartDate).toBe("2010-06-01");
    expect(period.serviceEndDate).toBe("2015-05-30");
    // Legacy fields stay in place (dual-read, nothing deleted)
    expect(period.entryDate).toBe("2010-06-01");
    expect(period.separationDate).toBe("2015-05-30");
  });

  it("is idempotent - running twice does not re-flag changed or corrupt data", () => {
    const vkb = initializeVKB();
    vkb.serviceHistory.servicePeriods = [
      { entryDate: "2010-06-01", separationDate: "2015-05-30" },
    ];

    migrateOffSchemaVKB(vkb);
    const second = migrateOffSchemaVKB(vkb);
    expect(second.changed).toBe(false);
    expect(second.vkb.serviceHistory.servicePeriods).toHaveLength(1);
  });

  it("runs the rename step even for a VKB that already completed the older claims/evidence migration", () => {
    const vkb = initializeVKB();
    vkb.metadata.migratedOffSchema = true; // simulates a pre-existing migrated VKB
    vkb.serviceHistory.servicePeriods = [
      { entryDate: "2004-01-01", separationDate: "2008-01-01" },
    ];

    const { vkb: migrated, changed } = migrateOffSchemaVKB(vkb);
    expect(changed).toBe(true);
    expect(migrated.serviceHistory.servicePeriods[0].serviceStartDate).toBe(
      "2004-01-01",
    );
    expect(migrated.metadata.migratedServicePeriodFieldNames).toBe(true);
  });

  it("no-ops when there are no service periods to rename", () => {
    const { vkb, changed } = migrateOffSchemaVKB(initializeVKB());
    expect(changed).toBe(false);
    expect(vkb.metadata.migratedServicePeriodFieldNames).toBe(true);
  });
});

describe("C1: mergeDD214ServicePeriodTracking single-date bug fix", () => {
  it("does not drop a period when only the entry date is extractable", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(
      vkb,
      { entryDate: "2010-06-01", branch: "Army" },
      { fileName: "torn_page.pdf" },
    );

    expect(vkb.serviceHistory.servicePeriods).toHaveLength(1);
    const period = vkb.serviceHistory.servicePeriods[0];
    expect(period.serviceStartDate).toBe("2010-06-01");
    expect(period.serviceEndDate).toBeNull();
    expect(period.incomplete).toBe(true);
  });

  it("does not drop a period when only the separation date is extractable", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(
      vkb,
      { separationDate: "2015-05-30", branch: "Navy" },
      { fileName: "torn_page2.pdf" },
    );

    expect(vkb.serviceHistory.servicePeriods).toHaveLength(1);
    expect(vkb.serviceHistory.servicePeriods[0].incomplete).toBe(true);
  });

  it("marks a period with both dates as not incomplete", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(
      vkb,
      { entryDate: "2010-06-01", separationDate: "2015-05-30" },
      { fileName: "complete.pdf" },
    );

    expect(vkb.serviceHistory.servicePeriods[0].incomplete).toBe(false);
  });
});

describe("VKB service periods from scanned forms and VA's code sheet", () => {
  it("records the NGB-22's remark periods when Box 12 lost its dates", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(
      vkb,
      {
        branch: "Army",
        additionalPeriods: [
          {
            component: "IADT",
            serviceStartDate: "1997-09-05",
            serviceEndDate: "1997-11-26",
          },
          {
            component: "AD",
            serviceStartDate: "2006-01-22",
            serviceEndDate: "2007-06-03",
          },
        ],
      },
      { fileName: "ngb22.pdf" },
    );
    expect(
      vkb.serviceHistory.servicePeriods.map((p) => [
        p.serviceStartDate,
        p.serviceEndDate,
        p.component,
      ]),
    ).toEqual([
      ["1997-09-05", "1997-11-26", "IADT"],
      ["2006-01-22", "2007-06-03", "AD"],
    ]);
  });

  it("lets the code sheet's dates settle a period the NGB-22 dated three days off", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(
      vkb,
      {
        additionalPeriods: [
          { serviceStartDate: "2006-01-22", serviceEndDate: "2007-06-03" },
        ],
      },
      { fileName: "ngb22.pdf" },
    );
    mergeServicePeriodsIntoVKB(
      vkb,
      [
        {
          entryDate: "2006-01-25",
          separationDate: "2007-06-03",
          branch: "Army",
          characterOfDischarge: "Honorable",
        },
        {
          entryDate: "2002-04-27",
          separationDate: "2003-04-16",
          branch: "Army",
          characterOfDischarge: "Honorable",
        },
      ],
      { fileName: "cfile.pdf" },
    );
    const periods = vkb.serviceHistory.servicePeriods;
    expect(periods).toHaveLength(2);
    expect(periods[0]).toMatchObject({
      serviceStartDate: "2006-01-25",
      characterOfService: "Honorable",
      datesVerifiedBy: "cfile.pdf",
    });
  });
});

describe("VKB rank at discharge follows the latest service, not upload order", () => {
  it("keeps the later separation's rank when an older DD214 is processed last", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(vkb, {
      rank: "SGT",
      payGrade: "E-5",
      entryDate: "2006-01-25",
      separationDate: "2007-06-03",
    });
    mergeDD214IntoVKB(vkb, {
      rank: "SPC",
      payGrade: "E-4",
      entryDate: "2002-04-27",
      separationDate: "2003-04-16",
    });
    expect(vkb.serviceHistory.rank.discharge).toBe("SGT");
    expect(vkb.serviceHistory.rank.firstPeriodRank).toBe("SPC");
  });

  it("falls back to the higher pay grade when the forms lost their dates", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(vkb, { rank: "SGT", payGrade: "E-5" });
    mergeDD214IntoVKB(vkb, { rank: "SPC", payGrade: "E-4" });
    expect(vkb.serviceHistory.rank.discharge).toBe("SGT");
  });
});

describe("VKB remark periods don't inherit the form's final rank", () => {
  it("leaves rank off the earlier periods an NGB-22 lists", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(vkb, {
      rank: "SGT",
      payGrade: "E-5",
      additionalPeriods: [
        { serviceStartDate: "1997-09-05", serviceEndDate: "1997-11-26" },
      ],
    });
    expect(vkb.serviceHistory.servicePeriods[0].rank).toBeUndefined();
  });
});
