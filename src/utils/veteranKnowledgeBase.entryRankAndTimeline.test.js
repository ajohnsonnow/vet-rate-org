/**
 * Observation 2 + D-C (final9/final10 QA, 2026-09-25):
 *  - the VKB's first-period-rank comparator reused _isLaterRecord's
 *    "having a date beats not having one" tie-break, which is backwards
 *    for this case (see mergeDD214RankAndCharacter's own comment) - fixed
 *    with a dedicated MIN-by-date comparator that also never lets a
 *    CALCULATED (serviceStartDateDerived) date claim "first period".
 *  - the evidence-timeline "entered service" event assumed Active Duty
 *    regardless of component, and never marked a calculated date as such.
 *
 * D11-3 (final11 QA, 2026-09-27): a DD214's Box 4a / an NGB-22's rank
 * field is that document's rank AS OF ITS OWN SEPARATION, never as of
 * when the veteran entered that period - the field this describes was
 * renamed from rank.entry/rank.entryAsOf to
 * rank.firstPeriodRank/rank.firstPeriodEntryDate so the app never
 * presents a separation rank as an entry rank. Same real values, honest
 * name; this pipeline never extracts an actual grade-at-entry.
 * Fixture values are generic, not any real veteran's data.
 */
import { describe, it, expect } from "vitest";
import {
  initializeVKB,
  mergeDD214IntoVKB,
  mergeDD214EvidenceTimeline,
  migrateOffSchemaVKB,
} from "./veteranKnowledgeBase";

describe("Observation 2: firstPeriodRank reflects the earliest genuinely dated record", () => {
  it("keeps the earliest record's rank regardless of upload order", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(vkb, {
      rank: "SPC",
      entryDate: "2002-05-06",
      separationDate: "2003-04-30",
    });
    mergeDD214IntoVKB(vkb, {
      rank: "PV1",
      entryDate: "1997-09-29",
      separationDate: "1998-02-27",
    });

    expect(vkb.serviceHistory.rank.firstPeriodRank).toBe("PV1");
  });

  it("never lets a document with no entryDate at all blank out an already-known earliest rank", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(vkb, { rank: "PV1", entryDate: "1997-09-29" });
    mergeDD214IntoVKB(vkb, { rank: "SGT" }); // no entryDate

    expect(vkb.serviceHistory.rank.firstPeriodRank).toBe("PV1");
  });

  // Obs 2 regression (final10 QA correctness re-review, 2026-09-26): the
  // earliest-entry check used to run only `if (dd214Data.rank)`, so a
  // genuinely earlier, dated record whose rank an OCR pass missed never
  // got to claim "earliest" - a LATER, ranked record then wrongly stood in
  // for firstPeriodRank.
  it("reports null, not a later record's rank, when the earliest dated record has no rank", () => {
    const vkb = initializeVKB();
    // Earliest record: dated, but Box 4a wasn't extracted.
    mergeDD214IntoVKB(vkb, {
      entryDate: "1997-09-29",
      separationDate: "1998-02-27",
    });
    // A later record does have a rank - it must not be mistaken for the
    // first period's own rank.
    mergeDD214IntoVKB(vkb, { rank: "SPC", entryDate: "2002-05-06" });

    expect(vkb.serviceHistory.rank.firstPeriodRank).toBeNull();
  });

  it("never lets a CALCULATED entry date claim firstPeriodRank, even when it is numerically earliest", () => {
    const vkb = initializeVKB();
    // A real, dated DD214 for the first known period.
    mergeDD214IntoVKB(vkb, {
      rank: "PV1",
      entryDate: "1997-09-29",
      separationDate: "1998-02-27",
    });
    // An NGB-22 whose entryDate is CALCULATED (separation minus net
    // service) and happens to land earlier - its rank field describes
    // its own separation/report rank, not the rank at that calculated
    // point decades earlier.
    mergeDD214IntoVKB(vkb, {
      rank: "SGT",
      entryDate: "1997-07-30",
      entryDateDerived: true,
      separationDate: "2008-04-04",
    });

    expect(vkb.serviceHistory.rank.firstPeriodRank).toBe("PV1");
  });

  it("stays null when only a calculated entry date has ever been merged", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(vkb, {
      rank: "SGT",
      entryDate: "1997-07-30",
      entryDateDerived: true,
      separationDate: "2008-04-04",
    });

    expect(vkb.serviceHistory.rank.firstPeriodRank).toBeNull();
  });

  it("updates to a genuinely earlier real record found later", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(vkb, { rank: "SPC", entryDate: "2002-05-06" });
    mergeDD214IntoVKB(vkb, { rank: "PV1", entryDate: "1997-09-29" });

    expect(vkb.serviceHistory.rank.firstPeriodRank).toBe("PV1");
  });
});

describe("D11-3: legacy rank.entry/rank.entryAsOf migrates to its honest name", () => {
  it("moves an existing legacy value forward and deletes the mislabeled keys", () => {
    const vkb = initializeVKB();
    delete vkb.serviceHistory.rank.firstPeriodRank;
    vkb.serviceHistory.rank.entry = "SPC";
    vkb.serviceHistory.rank.entryAsOf = "2002-05-06";
    delete vkb.metadata.migratedEntryRankFieldName;

    const { changed } = migrateOffSchemaVKB(vkb);

    expect(changed).toBe(true);
    expect(vkb.serviceHistory.rank.firstPeriodRank).toBe("SPC");
    expect(vkb.serviceHistory.rank.firstPeriodEntryDate).toBe("2002-05-06");
    expect(vkb.serviceHistory.rank.entry).toBeUndefined();
    expect(vkb.serviceHistory.rank.entryAsOf).toBeUndefined();
  });

  it("is idempotent - running twice does not re-flag changed or clobber real data", () => {
    const vkb = initializeVKB();
    delete vkb.serviceHistory.rank.firstPeriodRank;
    vkb.serviceHistory.rank.entry = "SPC";
    delete vkb.metadata.migratedEntryRankFieldName;

    migrateOffSchemaVKB(vkb);
    const second = migrateOffSchemaVKB(vkb);

    expect(second.changed).toBe(false);
    expect(second.vkb.serviceHistory.rank.firstPeriodRank).toBe("SPC");
  });
});

describe("D-C: entryDateDerived propagates onto vkb.serviceHistory.entryDate", () => {
  it("carries the derived flag alongside the earliest entryDate", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(vkb, {
      entryDate: "1997-07-30",
      entryDateDerived: true,
      separationDate: "2008-04-04",
    });

    expect(vkb.serviceHistory.entryDate).toBe("1997-07-30");
    expect(vkb.serviceHistory.entryDateDerived).toBe(true);
  });

  it("clears the flag once a real, non-derived earliest date is found", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(vkb, {
      entryDate: "1997-07-30",
      entryDateDerived: true,
    });
    mergeDD214IntoVKB(vkb, {
      entryDate: "1997-06-01",
      entryDateDerived: false,
    });

    expect(vkb.serviceHistory.entryDate).toBe("1997-06-01");
    expect(vkb.serviceHistory.entryDateDerived).toBe(false);
  });
});

describe("D-C: evidence-timeline entry event is labeled by component and marks a calculated date", () => {
  it("labels an NGB-22's own enlistment instead of assuming active duty", () => {
    const vkb = initializeVKB();
    mergeDD214EvidenceTimeline(
      vkb,
      {
        entryDate: "1997-07-30",
        branch: "Army",
        component: "National Guard",
        formType: "NGB22",
      },
      { fileName: "ngb22.pdf" },
    );

    const event = vkb.evidenceTimeline.find((e) => e.date === "1997-07-30");
    expect(event).toBeDefined();
    expect(event.eventType).toBe("guard_enlistment");
    expect(event.description).toBe("Enlisted (Army National Guard)");
  });

  it("marks a calculated entry date as calculated", () => {
    const vkb = initializeVKB();
    mergeDD214EvidenceTimeline(
      vkb,
      {
        entryDate: "1997-07-30",
        entryDateDerived: true,
        branch: "Army",
        component: "National Guard",
      },
      { fileName: "ngb22.pdf" },
    );

    const event = vkb.evidenceTimeline.find((e) => e.date === "1997-07-30");
    expect(event.derived).toBe(true);
    expect(event.description).toBe(
      "Enlisted (Army National Guard) (calculated)",
    );
  });

  it("still labels a real Active Duty entry as entering active duty", () => {
    const vkb = initializeVKB();
    mergeDD214EvidenceTimeline(
      vkb,
      { entryDate: "2004-06-22", branch: "Army", component: "Active Duty" },
      { fileName: "dd214.pdf" },
    );

    const event = vkb.evidenceTimeline.find((e) => e.date === "2004-06-22");
    expect(event.eventType).toBe("service_entry");
    expect(event.description).toBe("Entered active duty (Army)");
    expect(event.derived).toBe(false);
  });

  // D-C regression (final10 QA correctness re-review, 2026-09-26): a real
  // DD214 for a Guard/Reserve mobilization also carries component
  // "National Guard"/"Reserve" (_resolveComponentFromDocument tags it from
  // the text alone, not from which form it is), so keying eventType off
  // component alone relabeled its real, printed active-duty entry as an
  // enlistment and dropped it from evidence-gap detection.
  it("labels a Guard mobilization DD214's real active-duty entry as entering active duty, not enlisting", () => {
    const vkb = initializeVKB();
    mergeDD214EvidenceTimeline(
      vkb,
      {
        entryDate: "2003-01-15",
        branch: "Army",
        component: "National Guard",
        formType: "DD214",
        entryDateDerived: false,
      },
      { fileName: "dd214_mobilization.pdf" },
    );

    const event = vkb.evidenceTimeline.find((e) => e.date === "2003-01-15");
    expect(event.eventType).toBe("service_entry");
    expect(event.description).toBe("Entered active duty (Army)");
    expect(event.derived).toBe(false);
  });
});

describe("D11-1: a corrected entry date replaces its own timeline event instead of duplicating it", () => {
  it("re-processing the same NGB-22 with a corrected date updates the existing event, in place", () => {
    const vkb = initializeVKB();
    mergeDD214EvidenceTimeline(
      vkb,
      {
        entryDate: "2002-03-08",
        entryDateDerived: true,
        branch: "Army",
        component: "National Guard",
        formType: "NGB22",
      },
      { fileName: "ngb22.pdf" },
    );
    // Muster Call's Verify & Save re-runs the same merge for the same file
    // with the veteran's corrected fields spliced in.
    mergeDD214EvidenceTimeline(
      vkb,
      {
        entryDate: "2002-03-05",
        entryDateDerived: false,
        branch: "Army",
        component: "National Guard",
        formType: "NGB22",
      },
      { fileName: "ngb22.pdf" },
    );

    const enlistmentEvents = vkb.evidenceTimeline.filter((e) =>
      e.description.startsWith("Enlisted"),
    );
    expect(enlistmentEvents).toHaveLength(1);
    expect(enlistmentEvents[0]).toMatchObject({
      date: "2002-03-05",
      derived: false,
      description: "Enlisted (Army National Guard)",
    });
  });
});
