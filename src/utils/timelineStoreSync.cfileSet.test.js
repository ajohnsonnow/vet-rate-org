/**
 * The visible Evidence Timeline store must hold exactly the C-File events the
 * knowledge base holds after every Save and re-save, however the model words
 * them and however many it finds, without touching anything that is not a
 * tool-written copy.
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

const kbEvent = (date, eventType, description, sourceDocumentId = "d1") => ({
  date,
  eventType,
  description,
  sourceDocumentId,
  source: "C-File Analysis",
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

describe("store follows the knowledge base set after each re-save", () => {
  it("matches the knowledge base as the count grows and shrinks", async () => {
    const runs = [
      ["A1", "A2", "A3"],
      ["B1", "B2", "B3", "B4"],
      ["C1", "C2", "C3", "C4", "C5"],
      ["D1", "D2"],
    ];
    for (const words of runs) {
      const kb = words.map((w, i) =>
        kbEvent(`2019-0${i + 1}-01`, `Type ${w}`, w),
      );
      await converge(kb);
      expect(descriptions()).toEqual(["By hand", ...words]);
    }
  });

  it("drops a document's copies when the knowledge base holds none for it", async () => {
    await converge([kbEvent("2019-01-01", "Decision", "Gone soon")]);
    await converge([]);
    expect(descriptions()).toEqual(["By hand"]);
  });

  it("does not drop anything when the knowledge base did not load", async () => {
    await converge([kbEvent("2019-01-01", "Decision", "Kept")]);
    mockLoadVKB.mockRejectedValue(new Error("unreadable"));
    await convergeTimelineStoreWithVKB();
    expect(descriptions()).toEqual(["By hand", "Kept"]);
  });

  it("keeps other documents' copies and a copy the veteran edited", async () => {
    await converge([
      kbEvent("2019-01-01", "Decision", "Doc one first"),
      kbEvent("2019-01-01", "Decision", "Doc two", "d2"),
    ]);
    const edited = getTimelineEvents().map((e) =>
      e.description === "Doc one first"
        ? { ...e, description: "My words", userEdited: true }
        : e,
    );
    saveTimelineEvents(edited);
    await converge([
      kbEvent("2019-01-01", "Rating decision", "Doc one reworded"),
      kbEvent("2019-01-01", "Decision", "Doc two", "d2"),
    ]);
    expect(descriptions()).toEqual(["By hand", "My words", "Doc two"]);
  });
});
