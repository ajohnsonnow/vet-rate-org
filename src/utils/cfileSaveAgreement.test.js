/**
 * Real merge into the knowledge base followed by real convergence of the
 * Evidence Timeline store: after every Save and re-save of one document the
 * two hold the same events, and an event the Save left out is in neither.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const store = vi.hoisted(() => ({ vkb: null }));
vi.mock("./veteranKnowledgeBase", async (importOriginal) => ({
  ...(await importOriginal()),
  loadVKB: vi.fn(async () => structuredClone(store.vkb)),
  saveVKB: vi.fn(async (vkb) => {
    store.vkb = structuredClone(vkb);
    return { success: true };
  }),
  addDocumentToVKB: vi.fn(),
}));

const { mergeAnalysisIntoVkb } = await import("./veteranContextProvider");
const { planCFileSave } = await import("./cfileSavePlan");
const { convergeTimelineStoreWithVKB } = await import("./timelineStoreSync");
const { getTimelineEvents, saveTimelineEvents } =
  await import("./veteranProfile");

const event = (date, category, description) => ({
  date,
  category,
  description,
});

const saveAndConverge = async (timeline) => {
  const plan = planCFileSave({ potential_claims: [], timeline }, {});
  await mergeAnalysisIntoVkb({
    toolName: "C-File Analyzer",
    vkbMergeData: plan.vkbMergeData,
    sourceDocumentId: "d1",
  });
  await convergeTimelineStoreWithVKB({ onlyIfStoreHasEvents: true });
  return plan;
};

const sorted = (list) => list.map((e) => e.description).sort();

beforeEach(() => {
  localStorage.clear();
  store.vkb = { metadata: {}, aiInsights: {} };
  saveTimelineEvents([
    { id: 1, type: "service", date: "2018-01-01", description: "By hand" },
  ]);
});

describe("knowledge base timeline and visible timeline agree", () => {
  it("holds the same events after each of several re-saves", async () => {
    const runs = [
      ["Decision", "Exam", "Notice"],
      ["Rating decision", "C&P exam", "Notice letter", "Claim filed"],
      ["Decision issued", "Examination", "VA letter", "Original claim", "NOD"],
      ["Decision", "Exam", "Letter", "Claim"],
    ];
    for (const [r, types] of runs.entries()) {
      const timeline = types.map((t, i) =>
        event(`2019-0${i + 1}-05`, t, `Run ${r} event ${i}`),
      );
      const plan = await saveAndConverge(timeline);
      const shown = sorted(plan.timeline);
      expect(sorted(store.vkb.evidenceTimeline)).toEqual(shown);
      expect(sorted(getTimelineEvents())).toEqual([...shown, "By hand"].sort());
    }
  });

  it("writes an event without a date or description to neither", async () => {
    const plan = await saveAndConverge([
      event("2019-01-05", "Decision", "Real"),
      event("", "", ""),
      event("2019-02-05", "Exam", ""),
    ]);
    expect(plan.timelineLeftOut).toHaveLength(2);
    expect(sorted(store.vkb.evidenceTimeline)).toEqual(["Real"]);
    expect(sorted(getTimelineEvents())).toEqual(["By hand", "Real"]);
  });
});
