/**
 * D-9: saveTimelineEvents and addTimelineEvent both dropped `title` even
 * though EvidenceTimeline.jsx produces it.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  saveTimelineEvents,
  addTimelineEvent,
  getTimelineEvents,
} from "../../utils/veteranProfile";

describe("D-9: timeline event title", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saveTimelineEvents persists title", () => {
    saveTimelineEvents([
      {
        type: "service",
        date: "2010-06-01",
        title: "Deployed to Iraq",
        description: "...",
      },
    ]);
    expect(getTimelineEvents()[0].title).toBe("Deployed to Iraq");
  });

  it("addTimelineEvent persists title", () => {
    addTimelineEvent({
      type: "medical",
      date: "2012-01-01",
      title: "Diagnosed with PTSD",
    });
    expect(getTimelineEvents()[0].title).toBe("Diagnosed with PTSD");
  });

  // D-C (final10 QA, 2026-09-25; coverage gap closed in final10 QA's tests
  // lens re-review, 2026-09-26): a VKB-imported event's eventType (e.g.
  // "guard_enlistment") must survive a save/reload round-trip, or
  // EvidenceTimeline.jsx's gap-detection exclusion for it silently comes
  // back on the next visit.
  it("saveTimelineEvents persists eventType across a save/reload round-trip", () => {
    saveTimelineEvents([
      {
        type: "service",
        date: "2003-01-15",
        title: "Enlisted (Army National Guard)",
        eventType: "guard_enlistment",
      },
    ]);
    expect(getTimelineEvents()[0].eventType).toBe("guard_enlistment");
  });
});
