/**
 * Observation 2 + D-C (final9/final10 QA, 2026-09-25):
 *  - the VKB's entry-rank comparator reused _isLaterRecord's "having a
 *    date beats not having one" tie-break, which is backwards for the
 *    ENTRY case (see mergeDD214RankAndCharacter's own comment) - fixed
 *    with a dedicated MIN-by-date comparator that also never lets a
 *    CALCULATED (serviceStartDateDerived) date claim "entry rank".
 *  - the evidence-timeline "entered service" event assumed Active Duty
 *    regardless of component, and never marked a calculated date as such.
 * Fixture values are generic, not any real veteran's data.
 */
import { describe, it, expect } from "vitest";
import {
  initializeVKB,
  mergeDD214IntoVKB,
  mergeDD214EvidenceTimeline,
} from "./veteranKnowledgeBase";

describe("Observation 2: entry rank reflects the earliest genuinely dated record", () => {
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

    expect(vkb.serviceHistory.rank.entry).toBe("PV1");
  });

  it("never lets a document with no entryDate at all blank out an already-known earliest rank", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(vkb, { rank: "PV1", entryDate: "1997-09-29" });
    mergeDD214IntoVKB(vkb, { rank: "SGT" }); // no entryDate

    expect(vkb.serviceHistory.rank.entry).toBe("PV1");
  });

  it("never lets a CALCULATED entry date claim entry rank, even when it is numerically earliest", () => {
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

    expect(vkb.serviceHistory.rank.entry).toBe("PV1");
  });

  it("stays null when only a calculated entry date has ever been merged", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(vkb, {
      rank: "SGT",
      entryDate: "1997-07-30",
      entryDateDerived: true,
      separationDate: "2008-04-04",
    });

    expect(vkb.serviceHistory.rank.entry).toBeNull();
  });

  it("updates to a genuinely earlier real record found later", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(vkb, { rank: "SPC", entryDate: "2002-05-06" });
    mergeDD214IntoVKB(vkb, { rank: "PV1", entryDate: "1997-09-29" });

    expect(vkb.serviceHistory.rank.entry).toBe("PV1");
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
  it("labels a National Guard enlistment instead of assuming active duty", () => {
    const vkb = initializeVKB();
    mergeDD214EvidenceTimeline(
      vkb,
      { entryDate: "1997-07-30", branch: "Army", component: "National Guard" },
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
});
