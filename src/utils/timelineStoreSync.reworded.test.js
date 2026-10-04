/**
 * Re-saving a re-analysed document updates its events in the knowledge base in
 * place, so the local Evidence Timeline store must not gain a reworded second
 * copy of each. Hand-added events and events of other documents are untouched.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockLoadVKB = vi.hoisted(() => vi.fn());
vi.mock("./veteranKnowledgeBase", async (importOriginal) => ({
  ...(await importOriginal()),
  loadVKB: mockLoadVKB,
}));

const { convergeTimelineStoreWithVKB } = await import("./timelineStoreSync");
const { getTimelineEvents, saveTimelineEvents } =
  await import("./veteranProfile");

const vkbEvent = (date, eventType, description, sourceDocumentId = "d1") => ({
  date,
  eventType,
  description,
  sourceDocumentId,
});

const converge = async (events) => {
  mockLoadVKB.mockResolvedValue({ evidenceTimeline: events, evidence: [] });
  return convergeTimelineStoreWithVKB();
};

const descriptions = () => getTimelineEvents().map((e) => e.description);

beforeEach(() => {
  localStorage.clear();
  mockLoadVKB.mockReset();
  saveTimelineEvents([
    { id: 1, type: "service", date: "2019-03-03", description: "By hand" },
  ]);
});

describe("timeline store convergence after a reworded re-save", () => {
  it("adds each event once, however the model words it on a later run", async () => {
    await converge([
      vkbEvent("2019-04-04", "Medical", "Diagnosed with tinnitus"),
    ]);
    await converge([
      vkbEvent("2019-04-04", "Medical", "Tinnitus diagnosis made"),
    ]);
    await converge([vkbEvent("April 4, 2019", "medical", "A third wording")]);
    expect(descriptions()).toEqual(["By hand", "Diagnosed with tinnitus"]);
  });

  it("still adds a same-day event of the same document that is new", async () => {
    await converge([vkbEvent("2019-04-04", "Medical", "Tinnitus")]);
    await converge([
      vkbEvent("2019-04-04", "Medical", "Tinnitus again"),
      vkbEvent("2019-04-04", "Medical", "Lumbar strain"),
    ]);
    expect(descriptions()).toEqual(["By hand", "Tinnitus", "Lumbar strain"]);
  });

  it("keeps the same day and type from another document as its own event", async () => {
    await converge([vkbEvent("2019-04-04", "Medical", "From file one")]);
    await converge([
      vkbEvent("2019-04-04", "Medical", "From file one reworded"),
      vkbEvent("2019-04-04", "Medical", "From file two", "d2"),
    ]);
    expect(descriptions()).toEqual([
      "By hand",
      "From file one",
      "From file two",
    ]);
  });

  it("never matches a hand-added event on the same day", async () => {
    await converge([vkbEvent("2019-03-03", "Medical", "From the analysis")]);
    expect(descriptions()).toEqual(["By hand", "From the analysis"]);
  });
});
