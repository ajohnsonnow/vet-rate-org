/**
 * An imported timeline event the veteran removes from the Evidence Timeline
 * stays removed when a later import completes the local timeline store from
 * the knowledge base (convergeTimelineStoreWithVKB), while an imported event
 * they kept is untouched and a never-seen one is added.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EvidenceTimeline from "../../components/EvidenceTimeline.jsx";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import {
  getTimelineEvents,
  saveTimelineEvents,
} from "../../utils/veteranProfile.js";
import { convergeTimelineStoreWithVKB } from "../../utils/timelineStoreSync.js";

const mockLoadVKB = vi.fn();
vi.mock("../../utils/veteranKnowledgeBase.js", () => ({
  loadVKB: (...args) => mockLoadVKB(...args),
}));

const imported = (n) => ({
  id: `vkb_1_${n}`,
  type: "records",
  date: `2012-02-0${n}`,
  title: `Generic event ${n}`,
  description: `Generic event ${n}`,
  category: "Medical Records",
});
const vkbEvent = (n) => ({
  date: `2012-02-0${n}`,
  description: `Generic event ${n}`,
  eventType: "clinical",
});

beforeEach(() => {
  localStorage.clear();
  mockLoadVKB.mockReset();
  vi.spyOn(window, "alert").mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    new Proxy({}, { get: () => vi.fn() }),
  );
});

describe("removing an imported timeline event", () => {
  it("is remembered, so completing the store from the knowledge base does not bring it back", async () => {
    saveTimelineEvents([imported(1), imported(2)]);
    mockLoadVKB.mockResolvedValue({
      evidenceTimeline: [vkbEvent(1), vkbEvent(2), vkbEvent(3)],
      evidence: [],
    });
    render(
      <LanguageProvider>
        <EvidenceTimeline onClose={() => {}} />
      </LanguageProvider>,
    );

    const row = (await screen.findByText("Generic event 2")).closest("div");
    fireEvent.click(row.parentElement.querySelector("button"));
    expect(getTimelineEvents().map((e) => e.description)).toEqual([
      "Generic event 1",
    ]);

    await convergeTimelineStoreWithVKB({ onlyIfStoreHasEvents: true });

    expect(getTimelineEvents().map((e) => e.description)).toEqual([
      "Generic event 1",
      "Generic event 3",
    ]);
  });
});
