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
});
