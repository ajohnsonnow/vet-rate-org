/**
 * Final-23 item 1: saving a re-analysed document again must update the event
 * it saved before, even though the model words it differently. An event from
 * this tool is identified by its source document, day and type; events from
 * other documents, other tools or by hand are never merged or overwritten.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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

const { mergeAnalysisIntoVkb, buildVkbMergeFromCFile } =
  await import("./veteranContextProvider");

const analysisWith = (events) => ({ potential_claims: [], timeline: events });

const event = (date, category, description) => ({
  date,
  category,
  description,
  significance: "medium",
});

const save = (events, sourceDocumentId) =>
  mergeAnalysisIntoVkb({
    toolName: "C-File Analyzer",
    vkbMergeData: buildVkbMergeFromCFile(analysisWith(events), {}),
    sourceDocumentId,
  });

beforeEach(() => {
  store.vkb = { metadata: {}, aiInsights: {} };
});

describe("C-File Save: one event per document, day and type", () => {
  it("updates the earlier event when the model words it differently", async () => {
    await save(
      [event("2019-03-03", "Medical", "Knee pain seen at clinic")],
      "d1",
    );
    await save(
      [event("March 3, 2019", "medical", "Clinic visit for knee complaints")],
      "d1",
    );
    expect(store.vkb.evidenceTimeline).toHaveLength(1);
    expect(store.vkb.evidenceTimeline[0].description).toBe(
      "Clinic visit for knee complaints",
    );
    expect(store.vkb.evidence).toHaveLength(1);
    expect(store.vkb.evidence[0].description).toBe(
      "Clinic visit for knee complaints",
    );
  });

  it("keeps the same day and type from another document as its own event", async () => {
    await save([event("2019-03-03", "Medical", "From the first file")], "d1");
    await save([event("2019-03-03", "Medical", "From the second file")], "d2");
    expect(store.vkb.evidenceTimeline.map((e) => e.description)).toEqual([
      "From the first file",
      "From the second file",
    ]);
  });

  it("adds a different type or day on the same document", async () => {
    await save([event("2019-03-03", "Medical", "A")], "d1");
    await save(
      [
        event("2019-03-03", "Service", "B"),
        event("2019-04-04", "Medical", "C"),
      ],
      "d1",
    );
    expect(store.vkb.evidenceTimeline).toHaveLength(3);
  });

  it("never overwrites another tool's event on the same day and type", async () => {
    store.vkb.evidenceTimeline = [
      {
        date: "2019-03-03",
        eventType: "Medical",
        description: "Added elsewhere",
        source: "Muster Call",
        sourceDocumentId: "d1",
      },
    ];
    await save([event("2019-03-03", "Medical", "From the analysis")], "d1");
    expect(store.vkb.evidenceTimeline.map((e) => e.description)).toEqual([
      "Added elsewhere",
      "From the analysis",
    ]);
  });

  it("lists one event per day and type from a single analysis", () => {
    const merge = buildVkbMergeFromCFile(
      analysisWith([
        event("2019-03-03", "Medical", "First wording"),
        event("March 3, 2019", "medical", "Second wording"),
        event("", "Medical", "Undated one"),
        event("", "Medical", "Undated two"),
      ]),
      {},
    );
    expect(merge.evidenceTimeline.map((e) => e.description)).toEqual([
      "First wording",
      "Undated one",
      "Undated two",
    ]);
    expect(merge.evidence).toHaveLength(3);
  });
});
