/**
 * Final-24 D24-3: saving a re-analysed document again replaces that document's
 * tool-written events as a set, however many events the new run found and
 * however it worded their types. Events by hand, from other documents or
 * tools, or edited by the veteran are never deleted or overwritten.
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

const { mergeAnalysisIntoVkb, buildVkbMergeFromCFile, splitCFileTimeline } =
  await import("./veteranContextProvider");

const event = (date, category, description) => ({
  date,
  category,
  description,
  significance: "medium",
});

const save = (events, sourceDocumentId) =>
  mergeAnalysisIntoVkb({
    toolName: "C-File Analyzer",
    vkbMergeData: buildVkbMergeFromCFile(
      { potential_claims: [], timeline: events },
      {},
    ),
    sourceDocumentId,
  });

const texts = (list) => list.map((e) => e.description);

beforeEach(() => {
  store.vkb = { metadata: {}, aiInsights: {} };
});

describe("re-saving one document replaces its events as a set", () => {
  it("leaves exactly the last run's events as the count grows and shrinks", async () => {
    const runs = [
      ["Decision", "Exam", "Notice"],
      ["Rating decision", "C&P exam", "Notice letter", "Claim filed"],
      ["Decision issued", "Examination", "VA letter", "Original claim", "NOD"],
      ["Decision", "Exam", "Letter", "Claim"],
    ];
    const days = ["2019-01-01", "2019-02-02", "2019-03-03", "2019-04-04"];
    for (const [r, types] of runs.entries()) {
      const events = types.map((t, i) =>
        event(days[i % 4], t, `Run ${r} event ${i}`),
      );
      await save(events, "d1");
      expect(texts(store.vkb.evidenceTimeline)).toEqual(texts(events));
      expect(texts(store.vkb.evidence)).toEqual(texts(events));
    }
  });

  it("deletes the document's earlier events when the new run finds none", async () => {
    await save([event("2019-01-01", "Decision", "Old")], "d1");
    await save([], "d1");
    expect(store.vkb.evidenceTimeline).toEqual([]);
  });

  it("never deletes hand-added events, other documents or other tools", async () => {
    store.vkb.evidenceTimeline = [
      { date: "2019-01-01", eventType: "Decision", description: "By hand" },
      {
        date: "2019-01-01",
        eventType: "Decision",
        description: "Muster",
        source: "Muster Call",
        sourceDocumentId: "d1",
      },
    ];
    await save([event("2019-01-01", "Decision", "Other doc")], "d2");
    await save([event("2019-01-01", "Decision", "First")], "d1");
    await save([event("2019-01-01", "Decision", "Second")], "d1");
    expect(texts(store.vkb.evidenceTimeline)).toEqual([
      "By hand",
      "Muster",
      "Other doc",
      "Second",
    ]);
  });

  it("treats an event the veteran edited as theirs and does not write it twice", async () => {
    await save(
      [
        event("2019-01-01", "Decision", "Original"),
        event("2019-02-02", "Exam", "Other"),
      ],
      "d1",
    );
    store.vkb.evidenceTimeline[0].description = "My own words";
    store.vkb.evidenceTimeline[0].userEdited = true;
    await save(
      [
        event("2019-01-01", "Rating decision", "Reworded"),
        event("2019-03-03", "Exam", "New"),
      ],
      "d1",
    );
    expect(texts(store.vkb.evidenceTimeline)).toEqual(["My own words", "New"]);
  });
});

describe("events the Save cannot write", () => {
  it("lists an event without a real date or without a description, with the reason", () => {
    const { events, leftOut } = splitCFileTimeline([
      event("2019-01-01", "Decision", "Fine"),
      event("", "Decision", "No date"),
      event("unknown", "Decision", "Not a date"),
      event("2019-02-02", "Decision", "   "),
      event("", "", ""),
    ]);
    expect(texts(events)).toEqual(["Fine"]);
    expect(leftOut.map((l) => l.reason)).toEqual([
      "no real calendar date",
      "no real calendar date",
      "no description",
      "no real calendar date and no description",
    ]);
  });

  it("never writes them to either store", async () => {
    await save(
      [event("", "Decision", "No date"), event("2019-02-02", "Decision", "")],
      "d1",
    );
    expect(store.vkb.evidenceTimeline).toEqual([]);
    expect(store.vkb.evidence).toEqual([]);
  });
});
