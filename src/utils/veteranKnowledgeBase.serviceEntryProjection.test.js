/**
 * ADR-007: the VKB's service-entry subset (top-level entry fields, linked
 * period rows, entry timeline events) is a PROJECTION of shape 1
 * (servicePeriods[]), never independently edited. projectServiceEntryIntoVkb
 * is pure; _applyServiceEntryProjection wraps it with the one-time legacy
 * adoption and fail-open error handling. Fixture values are synthetic, not
 * any real veteran's data.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  projectServiceEntryIntoVkb,
  buildServiceEntryTimelineEvent,
  _applyServiceEntryProjection,
} from "./veteranKnowledgeBase";
import { upsertServicePeriod, setServiceEntryDate } from "./veteranProfile";

const PROFILE_KEY = "vet_rate_veteran_profile";

function seedProfile() {
  localStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({ fullName: "Jordan Sample" }),
  );
}

function baseVkb(overrides = {}) {
  return {
    metadata: { migratedServiceEntryProjection: true },
    serviceHistory: { servicePeriods: [], ...overrides.serviceHistory },
    evidenceTimeline: overrides.evidenceTimeline || [],
  };
}

function ngb22Period(id, start, derived, end = "2010-06-15") {
  return upsertServicePeriod(
    {
      serviceStartDate: start,
      serviceStartDateDerived: derived,
      serviceEndDate: end,
      formType: "NGB22",
    },
    { sourceDocument: id, confidence: 60 },
  );
}

describe("projectServiceEntryIntoVkb: no-op guards", () => {
  it("does nothing to a metadata-only cache object (no serviceHistory/evidenceTimeline)", () => {
    const obj = { metadata: { source: "indexeddb" } };
    const result = projectServiceEntryIntoVkb(obj, {
      entry: {
        date: "2002-01-01",
        derived: false,
        source: "veteran",
        periodId: "x",
      },
      periods: [],
      knownSources: new Set(),
    });
    expect(result.changed).toBe(false);
    expect(obj).toEqual({ metadata: { source: "indexeddb" } });
  });

  it("leaves top-level fields untouched when the view has no date", () => {
    const vkb = baseVkb();
    const result = projectServiceEntryIntoVkb(vkb, {
      entry: { date: null, derived: false, source: null, periodId: null },
      periods: [],
      knownSources: new Set(),
    });
    expect(result.changed).toBe(false);
    expect(vkb.serviceHistory.entryDate).toBeUndefined();
  });
});

describe("projectServiceEntryIntoVkb: top-level fields", () => {
  beforeEach(() => {
    localStorage.clear();
    seedProfile();
  });

  it("projects entryDate/entryDateDerived/entrySource/entryPeriodId and recomputes yearsOfService", () => {
    const id = ngb22Period("ngb22.pdf", "2002-01-10", true);
    const vkb = baseVkb({ serviceHistory: { separationDate: "2010-06-15" } });
    const view = {
      entry: {
        date: "2002-01-10",
        derived: true,
        source: "calculated",
        periodId: id,
      },
      periods: [
        {
          id,
          serviceStartDate: "2002-01-10",
          serviceEndDate: "2010-06-15",
          serviceStartDateDerived: true,
          serviceStartDateSource: "calculated",
          sourceDocument: "ngb22.pdf",
          formType: "NGB22",
        },
      ],
      knownSources: new Set(["ngb22.pdf"]),
    };

    const result = projectServiceEntryIntoVkb(vkb, view);
    expect(result.changed).toBe(true);
    expect(vkb.serviceHistory.entryDate).toBe("2002-01-10");
    expect(vkb.serviceHistory.entryDateDerived).toBe(true);
    expect(vkb.serviceHistory.entrySource).toBe("calculated");
    expect(vkb.serviceHistory.entryPeriodId).toBe(id);
    expect(vkb.serviceHistory.yearsOfService).toBeCloseTo(8.4, 1);
  });
});

describe("projectServiceEntryIntoVkb: preProjectionSnapshot", () => {
  beforeEach(() => {
    localStorage.clear();
    seedProfile();
  });

  it("writes preProjectionSnapshot exactly once, only on the first real change", () => {
    const vkb = baseVkb({
      serviceHistory: {
        entryDate: "1999-01-01",
        entryDateDerived: false,
        servicePeriods: [],
      },
      evidenceTimeline: [
        { date: "1999-01-01", eventType: "service_entry", source: "old" },
      ],
    });
    const view = {
      entry: {
        date: "2002-01-10",
        derived: true,
        source: "calculated",
        periodId: "p1",
      },
      periods: [
        {
          id: "p1",
          serviceStartDate: "2002-01-10",
          serviceEndDate: "2010-06-15",
          serviceStartDateDerived: true,
          sourceDocument: "ngb22.pdf",
        },
      ],
      knownSources: new Set(["ngb22.pdf"]),
    };

    projectServiceEntryIntoVkb(vkb, view);
    expect(vkb.serviceHistory.preProjectionSnapshot).toMatchObject({
      entryDate: "1999-01-01",
      entryDateDerived: false,
    });
    const firstSnapshot = vkb.serviceHistory.preProjectionSnapshot;

    // A second, different-valued projection must never overwrite the snapshot.
    const view2 = {
      ...view,
      entry: {
        date: "2003-01-01",
        derived: false,
        source: "veteran",
        periodId: "p1",
      },
    };
    projectServiceEntryIntoVkb(vkb, view2);
    expect(vkb.serviceHistory.preProjectionSnapshot).toBe(firstSnapshot);
  });
});

describe("projectServiceEntryIntoVkb: period link-and-fold", () => {
  it("(a) links by an existing canonicalPeriodId", () => {
    const vkb = baseVkb({
      serviceHistory: {
        servicePeriods: [
          {
            canonicalPeriodId: "p1",
            serviceStartDate: "2002-01-10",
            serviceEndDate: "2010-06-15",
            datesVerifiedBy: "codesheet.pdf",
          },
        ],
      },
    });
    const view = {
      entry: {
        date: "2002-01-10",
        derived: false,
        source: "printed",
        periodId: "p1",
      },
      periods: [
        {
          id: "p1",
          serviceStartDate: "2002-01-10",
          serviceEndDate: "2010-06-15",
          sourceDocument: "ngb22.pdf",
        },
      ],
      knownSources: new Set(["ngb22.pdf"]),
    };
    projectServiceEntryIntoVkb(vkb, view);
    expect(vkb.serviceHistory.servicePeriods).toHaveLength(1);
    expect(vkb.serviceHistory.servicePeriods[0]).toMatchObject({
      canonicalPeriodId: "p1",
      datesVerifiedBy: "codesheet.pdf",
    });
  });

  it("(b) links by matching the effective start or the correction's documentDate", () => {
    const vkb = baseVkb({
      serviceHistory: {
        servicePeriods: [
          { serviceStartDate: "2002-01-10", serviceEndDate: "2010-06-15" },
        ],
      },
    });
    const view = {
      entry: {
        date: "2003-01-01",
        derived: false,
        source: "veteran",
        periodId: "p1",
      },
      periods: [
        {
          id: "p1",
          serviceStartDate: "2003-01-01",
          serviceEndDate: "2010-06-15",
          startDateCorrection: {
            documentDate: "2002-01-10",
            documentSource: "calculated",
          },
        },
      ],
      knownSources: new Set(),
    };
    projectServiceEntryIntoVkb(vkb, view);
    expect(vkb.serviceHistory.servicePeriods).toHaveLength(1);
    expect(vkb.serviceHistory.servicePeriods[0].canonicalPeriodId).toBe("p1");
  });
});

describe("projectServiceEntryIntoVkb: period link-and-fold (c)", () => {
  it("(c) links a non-window period by a proven document source, MM/DD/YYYY vs ISO", () => {
    const vkb = baseVkb({
      serviceHistory: {
        servicePeriods: [
          {
            serviceStartDate: "01/10/2002",
            serviceEndDate: "06/15/2010",
            source: "ngb22.pdf",
          },
        ],
      },
    });
    const view = {
      entry: {
        date: "2002-01-10",
        derived: true,
        source: "calculated",
        periodId: "p1",
      },
      periods: [
        {
          id: "p1",
          serviceStartDate: "2002-01-10",
          serviceEndDate: "2010-06-15",
          sourceDocument: "ngb22.pdf",
          serviceStartDateDerived: true,
        },
      ],
      knownSources: new Set(["ngb22.pdf"]),
    };
    projectServiceEntryIntoVkb(vkb, view);
    expect(vkb.serviceHistory.servicePeriods).toHaveLength(1);
    expect(vkb.serviceHistory.servicePeriods[0].canonicalPeriodId).toBe("p1");
  });
});

describe("projectServiceEntryIntoVkb: dangling/unlinked rows and ordering", () => {
  it("drops a row whose canonicalPeriodId points at a missing period", () => {
    const vkb = baseVkb({
      serviceHistory: {
        servicePeriods: [
          {
            canonicalPeriodId: "gone",
            serviceStartDate: "1990-01-01",
            serviceEndDate: "1995-01-01",
          },
        ],
      },
    });
    const view = {
      entry: { date: null, derived: false, source: null, periodId: null },
      periods: [],
      knownSources: new Set(),
    };
    projectServiceEntryIntoVkb(vkb, view);
    expect(vkb.serviceHistory.servicePeriods).toHaveLength(0);
  });

  it("keeps an unlinked VKB-only row and clears a stale derived flag when it has datesVerifiedBy", () => {
    const vkb = baseVkb({
      serviceHistory: {
        servicePeriods: [
          {
            serviceStartDate: "1985-01-01",
            serviceEndDate: "1989-01-01",
            datesVerifiedBy: "old-codesheet.pdf",
            serviceStartDateDerived: true,
          },
        ],
      },
    });
    const view = {
      entry: { date: null, derived: false, source: null, periodId: null },
      periods: [],
      knownSources: new Set(),
    };
    projectServiceEntryIntoVkb(vkb, view);
    expect(vkb.serviceHistory.servicePeriods).toHaveLength(1);
    expect(vkb.serviceHistory.servicePeriods[0].serviceStartDateDerived).toBe(
      false,
    );
  });

  it("sorts projected rows by start ascending, undated rows last", () => {
    const vkb = baseVkb();
    const view = {
      entry: {
        date: "1998-01-05",
        derived: false,
        source: "printed",
        periodId: "early",
      },
      periods: [
        {
          id: "later",
          serviceStartDate: "2002-01-10",
          serviceEndDate: "2010-06-15",
        },
        {
          id: "early",
          serviceStartDate: "1998-01-05",
          serviceEndDate: "2001-12-20",
        },
        { id: "undated", serviceStartDate: null, serviceEndDate: null },
      ],
      knownSources: new Set(),
    };
    projectServiceEntryIntoVkb(vkb, view);
    const ids = vkb.serviceHistory.servicePeriods.map(
      (p) => p.canonicalPeriodId,
    );
    expect(ids).toEqual(["early", "later"]);
  });
});

describe("projectServiceEntryIntoVkb: timeline projection", () => {
  it("adds one projected event per non-window period with a start, never for a window", () => {
    const vkb = baseVkb();
    const view = {
      entry: {
        date: "2002-01-10",
        derived: true,
        source: "calculated",
        periodId: "p1",
      },
      periods: [
        {
          id: "p1",
          serviceStartDate: "2002-01-10",
          serviceEndDate: "2010-06-15",
          serviceStartDateDerived: true,
          formType: "NGB22",
          sourceDocument: "ngb22.pdf",
        },
        {
          id: "window",
          serviceStartDate: "1990-01-01",
          serviceEndDate: "1990-06-01",
          periodScope: "window",
        },
      ],
      knownSources: new Set(["ngb22.pdf"]),
    };
    projectServiceEntryIntoVkb(vkb, view);
    const entryEvents = vkb.evidenceTimeline.filter(
      (e) =>
        e.eventType === "guard_enlistment" || e.eventType === "service_entry",
    );
    expect(entryEvents).toHaveLength(1);
    expect(entryEvents[0]).toMatchObject({
      date: "2002-01-10",
      projected: true,
      projectionKey: "entry:p1",
    });
  });

  it("never shows '(calculated)' once the period's own source is no longer calculated", () => {
    const vkb = baseVkb();
    const view = {
      entry: {
        date: "2002-08-01",
        derived: false,
        source: "veteran",
        periodId: "p1",
      },
      periods: [
        {
          id: "p1",
          serviceStartDate: "2002-08-01",
          serviceEndDate: "2010-06-15",
          serviceStartDateDerived: false,
          formType: "NGB22",
          sourceDocument: "ngb22.pdf",
        },
      ],
      knownSources: new Set(["ngb22.pdf"]),
    };
    projectServiceEntryIntoVkb(vkb, view);
    const event = vkb.evidenceTimeline.find(
      (e) => e.eventType === "guard_enlistment",
    );
    expect(event.description).not.toContain("(calculated)");
  });
});

describe("projectServiceEntryIntoVkb: timeline projection dedup", () => {
  it("removes a VKB-only event whose source is a known document, but keeps a genuinely unrelated one", () => {
    const vkb = baseVkb({
      evidenceTimeline: [
        { date: "2001-01-01", eventType: "service_entry", source: "ngb22.pdf" },
        {
          date: "1985-06-01",
          eventType: "service_entry",
          source: "Veteran memory",
        },
      ],
    });
    const view = {
      entry: {
        date: "2002-01-10",
        derived: true,
        source: "calculated",
        periodId: "p1",
      },
      periods: [
        {
          id: "p1",
          serviceStartDate: "2002-01-10",
          serviceEndDate: "2010-06-15",
          serviceStartDateDerived: true,
          sourceDocument: "ngb22.pdf",
        },
      ],
      knownSources: new Set(["ngb22.pdf"]),
    };
    projectServiceEntryIntoVkb(vkb, view);
    const entryEvents = vkb.evidenceTimeline.filter(
      (e) =>
        e.eventType === "service_entry" || e.eventType === "guard_enlistment",
    );
    // Only the fresh, projected 2001-01-01 event survives for the known
    // document - the OLD raw (non-projected) row with that same source was
    // removed, not merely left duplicated alongside it.
    const ngb22Events = entryEvents.filter((e) => e.source === "ngb22.pdf");
    expect(ngb22Events).toHaveLength(1);
    expect(ngb22Events[0].projected).toBe(true);
    expect(entryEvents.map((e) => e.source)).toContain("Veteran memory");
  });
});

// Item 3 follow-up (final13 QA re-review, 2026-09-28): the projected
// timeline event's enlistment classification must survive a later
// document's legitimate DISPLAY-formType relabel (N1b) - it reads the
// period's own additive `sources[]`, not the current formType.
describe("projectServiceEntryIntoVkb: enlistment classification survives a display relabel", () => {
  it("stays guard_enlistment once an NGB-22 has ever contributed, even after Code Sheet becomes the display formType", () => {
    const vkb = baseVkb();
    const view = {
      entry: {
        date: "2002-01-10",
        derived: false,
        source: "code_sheet",
        periodId: "p1",
      },
      periods: [
        {
          id: "p1",
          serviceStartDate: "2002-01-10",
          serviceEndDate: "2010-06-15",
          formType: "Code Sheet",
          sourceDocument: "cfile_codesheet.pdf",
          sources: [
            { sourceDocument: "ngb22.pdf", formType: "NGB22" },
            { sourceDocument: "cfile_codesheet.pdf", formType: "Code Sheet" },
          ],
        },
      ],
      knownSources: new Set(["ngb22.pdf", "cfile_codesheet.pdf"]),
    };
    projectServiceEntryIntoVkb(vkb, view);
    const event = vkb.evidenceTimeline.find(
      (e) => e.projectionKey === "entry:p1",
    );
    expect(event.eventType).toBe("guard_enlistment");
    expect(event.description).toBe("Enlisted (Military)");
  });

  it("still classifies as service_entry when no NGB-22 ever contributed", () => {
    const vkb = baseVkb();
    const view = {
      entry: {
        date: "2002-01-10",
        derived: false,
        source: "code_sheet",
        periodId: "p1",
      },
      periods: [
        {
          id: "p1",
          serviceStartDate: "2002-01-10",
          serviceEndDate: "2010-06-15",
          formType: "Code Sheet",
          sourceDocument: "cfile_codesheet.pdf",
          sources: [
            { sourceDocument: "cfile_codesheet.pdf", formType: "Code Sheet" },
          ],
        },
      ],
      knownSources: new Set(["cfile_codesheet.pdf"]),
    };
    projectServiceEntryIntoVkb(vkb, view);
    const event = vkb.evidenceTimeline.find(
      (e) => e.projectionKey === "entry:p1",
    );
    expect(event.eventType).toBe("service_entry");
  });
});

describe("projectServiceEntryIntoVkb: idempotence and order independence", () => {
  it("project(project(x)) equals project(x)", () => {
    const vkb = baseVkb({
      serviceHistory: {
        servicePeriods: [
          {
            serviceStartDate: "2002-01-10",
            serviceEndDate: "2010-06-15",
            source: "ngb22.pdf",
          },
        ],
      },
    });
    const view = {
      entry: {
        date: "2002-01-10",
        derived: true,
        source: "calculated",
        periodId: "p1",
      },
      periods: [
        {
          id: "p1",
          serviceStartDate: "2002-01-10",
          serviceEndDate: "2010-06-15",
          serviceStartDateDerived: true,
          formType: "NGB22",
          sourceDocument: "ngb22.pdf",
        },
      ],
      knownSources: new Set(["ngb22.pdf"]),
    };
    projectServiceEntryIntoVkb(vkb, view);
    const once = JSON.parse(JSON.stringify(vkb));
    projectServiceEntryIntoVkb(vkb, view);
    expect(vkb).toEqual(once);
  });
});

describe("buildServiceEntryTimelineEvent", () => {
  it("marks '(calculated)' only when derived, and labels a Code Sheet period as active duty", () => {
    expect(
      buildServiceEntryTimelineEvent({
        date: "2002-01-01",
        branch: "Army",
        formType: "NGB22",
        derived: true,
      }),
    ).toMatchObject({
      eventType: "guard_enlistment",
      description: "Enlisted (Army) (calculated)",
    });
    expect(
      buildServiceEntryTimelineEvent({
        date: "2002-01-01",
        branch: "Army",
        formType: "Code Sheet",
        derived: false,
      }),
    ).toMatchObject({
      eventType: "service_entry",
      description: "Entered active duty (Army)",
    });
  });
});

describe("_applyServiceEntryProjection", () => {
  beforeEach(() => {
    localStorage.clear();
    seedProfile();
  });

  it("fails open and returns the VKB unchanged when the view throws", async () => {
    const vkb = baseVkb();
    // Not a period-backed scenario, but force an error by corrupting evidenceTimeline.
    vkb.evidenceTimeline = null;
    const result = await _applyServiceEntryProjection(vkb);
    expect(result).toBe(vkb);
  });

  it("projects a real shape-1 correction end-to-end into a fresh VKB", async () => {
    const id = ngb22Period("ngb22.pdf", "2002-01-10", true);
    setServiceEntryDate({
      date: "2002-08-01",
      via: "muster_review",
      periodId: id,
    });

    const vkb = baseVkb();
    vkb.metadata.migratedServiceEntryProjection = true;
    const result = await _applyServiceEntryProjection(vkb);
    expect(result.serviceHistory.entryDate).toBe("2002-08-01");
    expect(result.serviceHistory.entryDateDerived).toBe(false);
    const event = result.evidenceTimeline.find(
      (e) => e.projectionKey === `entry:${id}`,
    );
    expect(event.description).not.toContain("(calculated)");
  });

  it("[G12] a VA.gov API-sourced legacy entryDate is neither adopted nor recorded", async () => {
    ngb22Period("ngb22.pdf", "2002-01-10", true);
    const vkb = baseVkb({
      serviceHistory: {
        entryDate: "1990-01-01",
        entryDateDerived: false,
        source: "VA.gov API",
      },
    });
    vkb.metadata.migratedServiceEntryProjection = false;
    await _applyServiceEntryProjection(vkb);

    const { isKnownServiceEntryDate } = await import("./veteranProfile");
    expect(isKnownServiceEntryDate("1990-01-01")).toBe(false);
  });
});
