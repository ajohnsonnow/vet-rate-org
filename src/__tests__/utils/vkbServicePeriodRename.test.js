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

  it("is idempotent — running twice does not re-flag changed or corrupt data", () => {
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
