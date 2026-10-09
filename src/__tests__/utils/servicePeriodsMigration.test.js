/**
 * C1 migration: consolidate legacy serviceHistory.dd214Data and
 * profile.servicePeriods into the canonical serviceHistory.servicePeriods[]
 * array, registered in MIGRATIONS (migrationManager.js) for schema 1.1.0 →
 * 1.2.0. Must be non-destructive (legacy fields stay in place) and
 * idempotent (running twice adds nothing new).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { migrateUserData } from "../../utils/migrationManager";
import {
  saveServiceHistory,
  saveVeteranProfile,
  getServiceHistory,
} from "../../utils/veteranProfile";
import { SCHEMA_STORAGE_KEY } from "../../utils/version";

function dd214Fixture(overrides = {}) {
  return {
    entryDate: "2010-06-01",
    separationDate: "2015-05-30",
    branch: "Army",
    ...overrides,
  };
}

describe("C1 migration: servicePeriods consolidation", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(SCHEMA_STORAGE_KEY, "1.1.0");
  });

  it("synthesizes one period from legacy dd214Data and folds in manual profile periods", () => {
    saveServiceHistory({ dd214Data: dd214Fixture({ rank: "SGT" }) });
    saveVeteranProfile({
      firstName: "John",
      servicePeriods: [
        {
          serviceStartDate: "2016-01-01",
          serviceEndDate: "2020-01-01",
          branch: "Army National Guard",
          characterOfService: "Honorable",
        },
      ],
    });

    const result = migrateUserData();
    expect(result.success).toBe(true);

    const { servicePeriods, dd214Data } = getServiceHistory();
    expect(servicePeriods).toHaveLength(2);

    const migratedFromDD214 = servicePeriods.find(
      (p) => p.serviceStartDate === "2010-06-01",
    );
    expect(migratedFromDD214).toMatchObject({
      serviceEndDate: "2015-05-30",
      branch: "Army",
      rank: "SGT",
      userEdited: false,
    });

    const migratedFromProfile = servicePeriods.find(
      (p) => p.serviceStartDate === "2016-01-01",
    );
    expect(migratedFromProfile).toMatchObject({
      serviceEndDate: "2020-01-01",
      branch: "Army National Guard",
      userEdited: true,
    });

    // Legacy field stays in place, unread (dual-read pattern)
    expect(dd214Data.entryDate).toBe("2010-06-01");
  });

  it("does not duplicate a period already present in the canonical array", () => {
    saveServiceHistory({
      dd214Data: dd214Fixture(),
      servicePeriods: [
        {
          id: "already_here",
          serviceStartDate: "2010-06-01",
          serviceEndDate: "2015-05-30",
          branch: "Army",
        },
      ],
    });

    migrateUserData();
    expect(getServiceHistory().servicePeriods).toHaveLength(1);
  });

  it("is idempotent - running the migration twice does not duplicate periods", () => {
    saveServiceHistory({ dd214Data: dd214Fixture() });

    migrateUserData();
    const afterFirst = getServiceHistory().servicePeriods.length;

    // Simulate a second migration run against already-migrated data by
    // resetting the schema marker (migrateUserData itself only runs once
    // per version, so this directly re-invokes the migration function).
    localStorage.setItem(SCHEMA_STORAGE_KEY, "1.1.0");
    migrateUserData();

    expect(getServiceHistory().servicePeriods).toHaveLength(afterFirst);
  });

  it("no-ops cleanly when there is no legacy data to migrate", () => {
    const result = migrateUserData();
    expect(result.success).toBe(true);
    expect(getServiceHistory().servicePeriods).toEqual([]);
  });
});
