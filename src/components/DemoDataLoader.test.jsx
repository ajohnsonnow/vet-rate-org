/**
 * Regression: loadDemoData() wrote the veteran profile and evidence timeline
 * under misspelled localStorage keys ("vetrate_veteran_profile" and
 * "vetrate_evidence_timeline") that no real consumer ever reads — the
 * canonical keys are "vet_rate_veteran_profile" (veteranProfile.js's
 * PROFILE_KEY, read by My Packet, the AI context builder, TDIU/rating tools,
 * etc.) and "vet_rate_timeline_events" (TIMELINE_EVENTS_KEY, read by
 * Evidence Timeline / autoBackup / packetBackup). "Load Gold Standard
 * Example" silently produced a profile and timeline nothing in the app
 * could see.
 */
import { describe, it, expect, afterEach } from "vitest";
import { loadDemoData } from "./DemoDataLoader";
import { getTimelineEvents } from "../utils/veteranProfile";

afterEach(() => {
  localStorage.clear();
});

describe("loadDemoData", () => {
  it("writes the veteran profile under the key veteranProfile.js actually reads", () => {
    loadDemoData();

    expect(localStorage.getItem("vetrate_veteran_profile")).toBeNull();
    const stored = JSON.parse(
      localStorage.getItem("vet_rate_veteran_profile"),
    );
    expect(stored.branch).toBe("Army");
  });

  it("writes timeline events under the key Evidence Timeline actually reads", () => {
    loadDemoData();

    expect(localStorage.getItem("vetrate_evidence_timeline")).toBeNull();
    const events = getTimelineEvents();
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((e) => e.title === "IED Blast Exposure")).toBe(true);
  });
});
