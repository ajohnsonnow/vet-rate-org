/**
 * Duty stations — user-entered locations, one-to-many by reference into
 * servicePeriods[] (periodId, null = unassigned). Same reference pattern as
 * deployments[].periodId, sanitizer contract modeled after
 * servicePeriodsModel.test.js / dd214DataWhitelist.test.js in this
 * directory. No cascade-delete when a linked period is removed (C-file/
 * duty-stations spec §2, acceptance criterion 4).
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  getServiceHistory,
  saveServiceHistory,
  getDutyStations,
  addDutyStation,
  updateDutyStation,
  removeDutyStation,
  addServicePeriod,
  removeServicePeriod,
} from "../../utils/veteranProfile";

describe("Duty stations — three-path normalization", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns dutyStations: [] when no data has ever been saved", () => {
    expect(getServiceHistory().dutyStations).toEqual([]);
  });

  it("returns dutyStations: [] for pre-existing data saved before this feature existed", () => {
    localStorage.setItem(
      "vet_rate_service_history",
      JSON.stringify({
        deployments: [],
        awards: [],
        dd214Data: null,
        serviceInfo: null,
        servicePeriods: [],
        dateUpdated: "2026-01-01T00:00:00.000Z",
      }),
    );
    expect(getServiceHistory().dutyStations).toEqual([]);
  });

  it("returns dutyStations: [] when the saved JSON is corrupt", () => {
    localStorage.setItem("vet_rate_service_history", "{not valid json");
    expect(getServiceHistory().dutyStations).toEqual([]);
  });
});

describe("Duty stations — CRUD round-trip", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("adds, reads, updates, and removes a duty station", () => {
    const id = addDutyStation({
      name: "Fort Bragg",
      periodId: null,
      latitude: 35.139,
      longitude: -79.006,
      country: "United States of America",
      startDate: "2010-01-01",
      endDate: "2012-01-01",
      notes: "AIT",
    });

    expect(id).toBeTruthy();
    let stations = getDutyStations();
    expect(stations).toHaveLength(1);
    expect(stations[0].name).toBe("Fort Bragg");
    expect(stations[0].latitude).toBe(35.139);

    const updated = updateDutyStation(id, { name: "Fort Liberty" });
    expect(updated).toBe(true);
    stations = getDutyStations();
    expect(stations[0].name).toBe("Fort Liberty");

    const removed = removeDutyStation(id);
    expect(removed).toBe(true);
    expect(getDutyStations()).toHaveLength(0);
  });

  it("updateDutyStation returns false for an unknown id", () => {
    expect(updateDutyStation("nope", { name: "x" })).toBe(false);
  });

  it("removeDutyStation only deletes the targeted station", () => {
    const idA = addDutyStation({ name: "Station A" });
    addDutyStation({ name: "Station B" });

    removeDutyStation(idA);
    const stations = getDutyStations();
    expect(stations).toHaveLength(1);
    expect(stations[0].name).toBe("Station B");
  });
});

describe("Duty stations — sanitizer (saveServiceHistory whitelist)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("strips any field not in the allowlist", () => {
    saveServiceHistory({
      dutyStations: [
        {
          id: "duty_1",
          name: "Camp Pendleton",
          maliciousField: "<script>alert(1)</script>",
          ssn: "123-45-6789",
        },
      ],
    });

    const [station] = getDutyStations();
    expect(station.name).toBe("Camp Pendleton");
    expect(station.maliciousField).toBeUndefined();
    expect(station.ssn).toBeUndefined();
  });

  it("truncates strings at their documented caps", () => {
    saveServiceHistory({
      dutyStations: [
        {
          id: "duty_1",
          name: "N".repeat(300),
          country: "C".repeat(200),
          notes: "X".repeat(2000),
        },
      ],
    });

    const [station] = getDutyStations();
    expect(station.name).toHaveLength(200);
    expect(station.country).toHaveLength(100);
    expect(station.notes).toHaveLength(1000);
  });

  it("nulls out-of-range, NaN, and Infinity coordinates", () => {
    saveServiceHistory({
      dutyStations: [
        { id: "duty_1", name: "A", latitude: 91, longitude: 0 },
        { id: "duty_2", name: "B", latitude: 0, longitude: -181 },
        { id: "duty_3", name: "C", latitude: NaN, longitude: 10 },
        { id: "duty_4", name: "D", latitude: Infinity, longitude: -10 },
        { id: "duty_5", name: "E", latitude: 45.5, longitude: -122.6 },
      ],
    });

    const stations = getDutyStations();
    expect(stations[0].latitude).toBeNull();
    expect(stations[1].longitude).toBeNull();
    expect(stations[2].latitude).toBeNull();
    expect(stations[3].latitude).toBeNull();
    expect(stations[4].latitude).toBe(45.5);
    expect(stations[4].longitude).toBe(-122.6);
  });

  it("caps the array at 100 entries", () => {
    const dutyStations = Array.from({ length: 150 }, (_, i) => ({
      id: `duty_${i}`,
      name: `Station ${i}`,
    }));
    saveServiceHistory({ dutyStations });

    expect(getDutyStations()).toHaveLength(100);
  });
});

describe("Duty stations — orphaned periodId survival (no cascade-delete)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps a duty station assigned to a period that later gets removed", () => {
    const periodId = addServicePeriod({
      serviceStartDate: "2010-01-01",
      serviceEndDate: "2014-01-01",
      branch: "Army",
    });
    const stationId = addDutyStation({
      name: "Fort Bragg",
      periodId,
    });

    removeServicePeriod(periodId);

    const stations = getDutyStations();
    expect(stations).toHaveLength(1);
    expect(stations[0].id).toBe(stationId);
    expect(stations[0].periodId).toBe(periodId);
  });
});
