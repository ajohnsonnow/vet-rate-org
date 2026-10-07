import { describe, it, expect, beforeEach } from "vitest";

import { migrateUserData } from "./migrationManager";
import {
  saveServiceHistory,
  getServiceHistory,
  getServicePeriods,
} from "./veteranProfile";
import { SCHEMA_STORAGE_KEY } from "./version";

// C1 migration (1.1.0 -> 1.2.0) synthesizes a servicePeriods[] entry from
// legacy serviceHistory.dd214Data - its own foreignService mapping used to
// re-coerce a genuine null (unknown) into a fabricated false.
describe("migrationManager: C1 service-period migration preserves foreignService tri-state", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const runMigrationFrom = (dd214Data) => {
    const history = getServiceHistory();
    history.dd214Data = {
      entryDate: "2010-01-01",
      separationDate: "2015-01-01",
      ...dd214Data,
    };
    saveServiceHistory(history);
    localStorage.setItem(SCHEMA_STORAGE_KEY, "1.1.0");
    migrateUserData();
    return getServicePeriods();
  };

  it("carries an unknown (null) foreignService through, not a fabricated false", () => {
    const periods = runMigrationFrom({ foreignService: null });
    expect(periods[0].foreignService).toBeNull();
  });

  it("carries an explicit false through", () => {
    const periods = runMigrationFrom({ foreignService: false });
    expect(periods[0].foreignService).toBe(false);
  });

  it("carries an explicit true through", () => {
    const periods = runMigrationFrom({ foreignService: true });
    expect(periods[0].foreignService).toBe(true);
  });
});
