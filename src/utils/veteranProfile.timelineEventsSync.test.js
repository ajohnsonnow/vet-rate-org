/**
 * Reviewer finding F1 (final13 QA re-review, 2026-09-28): D13-2 only synced
 * the vet_rate_timeline_events store while EvidenceTimeline.jsx happened to
 * be mounted - My Packet's own Timeline tab reads getTimelineEvents()
 * directly (MyPacket.jsx's _loadTimelineEvents) and kept showing a stale
 * service-entry date until the veteran separately reopened the Evidence
 * Timeline. saveServiceHistory now re-syncs the store itself, synchronously,
 * off servicePeriods[] alone - no VKB/IndexedDB involved - so every editor
 * that corrects a period (VKB viewer, My Packet, FormsHelper, Muster Call,
 * all routing through setServiceEntryDate/updateServicePeriod/
 * saveServiceHistory) fixes the store immediately, without EvidenceTimeline
 * ever having to open. Fixture values are synthetic, not any real veteran's
 * data.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  upsertServicePeriod,
  setServiceEntryDate,
  updateServicePeriod,
  getServicePeriods,
  getTimelineEvents,
  saveTimelineEvents,
} from "./veteranProfile";

const PROFILE_KEY = "vet_rate_veteran_profile";

function seedProfile() {
  localStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({ fullName: "Jordan Sample" }),
  );
}

function upsertNgb22(start, derived, end = "2010-06-15") {
  return upsertServicePeriod(
    {
      serviceStartDate: start,
      serviceStartDateDerived: derived,
      serviceEndDate: end,
      formType: "NGB22",
      branch: "Army National Guard",
    },
    { sourceDocument: "ngb22-synthetic.pdf", confidence: 60 },
  );
}

function seedImportedTimelineCopy(periodId, date, description) {
  saveTimelineEvents([
    {
      id: "vkb_1",
      type: "records",
      date,
      title: "Enlisted",
      description,
      category: "Medical Records",
      eventType: "guard_enlistment",
      sourceKey: `entry:${periodId}`,
    },
  ]);
}

describe("saveServiceHistory: syncs the timeline store without EvidenceTimeline ever mounting", () => {
  beforeEach(() => {
    localStorage.clear();
    seedProfile();
  });

  it("refreshes an already-imported copy the moment setServiceEntryDate corrects the period (VKB viewer / FormsHelper / Muster Call)", () => {
    const id = upsertNgb22("2002-03-05", true);
    seedImportedTimelineCopy(
      id,
      "2002-03-05",
      "Enlisted (Army National Guard) (calculated)",
    );

    const result = setServiceEntryDate({
      date: "2002-02-10",
      via: "vkb_viewer",
      periodId: id,
    });
    expect(result.ok).toBe(true);

    const events = getTimelineEvents();
    expect(events).toHaveLength(1);
    expect(events[0].date).toBe("2002-02-10");
    expect(events[0].description).toBe("Enlisted (Army National Guard)");
  });

  it("refreshes an already-imported copy when My Packet's updateServicePeriod corrects it", () => {
    const id = upsertNgb22("2002-03-05", true);
    seedImportedTimelineCopy(
      id,
      "2002-03-05",
      "Enlisted (Army National Guard) (calculated)",
    );

    const ok = updateServicePeriod(id, { serviceStartDate: "2002-02-15" });
    expect(ok).toBe(true);

    const events = getTimelineEvents();
    expect(events[0].date).toBe("2002-02-15");
  });

  it("keeps refreshing across a chain of corrections, not just the first one", () => {
    const id = upsertNgb22("2002-03-05", true);
    seedImportedTimelineCopy(
      id,
      "2002-03-05",
      "Enlisted (Army National Guard) (calculated)",
    );

    setServiceEntryDate({
      date: "2002-02-10",
      via: "vkb_viewer",
      periodId: id,
    });
    setServiceEntryDate({ date: "2002-02-15", via: "my_packet", periodId: id });
    setServiceEntryDate({
      date: "2002-02-20",
      via: "forms_helper",
      periodId: id,
    });

    expect(getTimelineEvents()[0].date).toBe("2002-02-20");
  });

  it("still reflects the correction in getServicePeriods() itself (sanity check on the fixture)", () => {
    const id = upsertNgb22("2002-03-05", true);
    setServiceEntryDate({
      date: "2002-02-10",
      via: "vkb_viewer",
      periodId: id,
    });
    expect(getServicePeriods().find((p) => p.id === id).serviceStartDate).toBe(
      "2002-02-10",
    );
  });
});

describe("saveServiceHistory: leaves untracked/already-fresh events alone", () => {
  beforeEach(() => {
    localStorage.clear();
    seedProfile();
  });

  it("never touches a veteran-added event (no sourceKey)", () => {
    const id = upsertNgb22("2002-03-05", true);
    saveTimelineEvents([
      {
        id: 1234567890,
        type: "service",
        date: "2002-03-05",
        title: "My own note",
        description: "My own note",
        category: "Service Event",
        eventType: "guard_enlistment",
      },
    ]);

    setServiceEntryDate({
      date: "2002-02-10",
      via: "vkb_viewer",
      periodId: id,
    });

    const events = getTimelineEvents();
    expect(events).toHaveLength(1);
    expect(events[0].description).toBe("My own note");
    expect(events[0].date).toBe("2002-03-05");
  });

  it("is a no-op when the store already matches the projection", () => {
    const id = upsertNgb22("2002-03-05", false);
    saveTimelineEvents([
      {
        id: "vkb_1",
        type: "records",
        date: "2002-03-05",
        title: "Enlisted",
        description: "Enlisted (Army National Guard)",
        category: "Medical Records",
        eventType: "guard_enlistment",
        sourceKey: `entry:${id}`,
      },
    ]);

    updateServicePeriod(id, { notes: "unrelated edit" });

    const events = getTimelineEvents();
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe("vkb_1");
  });
});
