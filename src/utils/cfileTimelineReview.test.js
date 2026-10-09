/**
 * Review follow-ups for the C-File timeline Save: data saved by the previous
 * build, veteran-edited events, dates in loose forms, a knowledge base that
 * cannot be read, and events shared by two documents. Real merge and real
 * convergence; only storage is replaced.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const store = vi.hoisted(() => ({ vkb: null, fail: false }));
vi.mock("./veteranKnowledgeBase", async (importOriginal) => ({
  ...(await importOriginal()),
  loadVKB: vi.fn(async () => {
    if (store.fail) throw new Error("unreadable");
    return structuredClone(store.vkb);
  }),
  saveVKB: vi.fn(async (vkb) => {
    store.vkb = structuredClone(vkb);
    return { success: true };
  }),
  addDocumentToVKB: vi.fn(),
}));

const { mergeAnalysisIntoVkb } = await import("./veteranContextProvider");
const { planCFileSave } = await import("./cfileSavePlan");
const { convergeTimelineStoreWithVKB } = await import("./timelineStoreSync");
const { isRealEventDate, canonicalEventType } = await import("./eventIdentity");
const { getTimelineEvents, saveTimelineEvents } =
  await import("./veteranProfile");

const ev = (date, category, description) => ({ date, category, description });

const save = async (timeline, id = "d1", extraction = {}) => {
  const plan = planCFileSave({ potential_claims: [], timeline }, extraction);
  await mergeAnalysisIntoVkb({
    toolName: "C-File Analyzer",
    vkbMergeData: plan.vkbMergeData,
    sourceDocumentId: id,
  });
  await convergeTimelineStoreWithVKB({
    onlyIfStoreHasEvents: true,
    cfileDocumentIds: [id],
  });
  return plan;
};

const words = (list) => list.map((e) => e.description).sort();
const mine = () => words(store.vkb.evidenceTimeline);
const shown = () =>
  words(getTimelineEvents().filter((e) => e.description !== "By hand"));

beforeEach(() => {
  localStorage.clear();
  store.fail = false;
  store.vkb = { metadata: {}, aiInsights: {} };
  saveTimelineEvents([
    { id: 1, type: "service", date: "2018-01-01", description: "By hand" },
  ]);
});

describe("copies saved by the previous build", () => {
  const oldCopy = (i, date, description) => ({
    id: `vkb_1_${i}`,
    type: "records",
    date,
    description,
    title: description,
    category: "Medical Records",
    sourceDocumentId: "d1",
    eventType: "Decision",
  });
  const seed = (copies) => {
    saveTimelineEvents([...getTimelineEvents(), ...copies]);
    store.vkb.evidenceTimeline = copies.map((e) => ({
      ...e,
      source: "C-File Analysis",
    }));
  };

  it("are replaced as a set when the count shrinks", async () => {
    seed([
      oldCopy(0, "2019-01-05", "A old"),
      oldCopy(1, "2019-02-05", "B old"),
      oldCopy(2, "2019-03-05", "C old"),
    ]);
    const run = [
      ev("2019-01-05", "x", "A new"),
      ev("2019-02-05", "x", "B new"),
    ];
    await save(run);
    expect(shown()).toEqual(["A new", "B new"]);
    await save(run);
    expect(shown()).toEqual(mine());
  });

  it("leave no second copy when an event moves to another day", async () => {
    seed([oldCopy(0, "2019-01-05", "A old")]);
    await save([ev("2019-01-06", "x", "A new")]);
    expect(shown()).toEqual(["A new"]);
  });

  it("are cleared when the new run finds no events", async () => {
    seed([oldCopy(0, "2019-01-05", "A old")]);
    await save([]);
    expect(shown()).toEqual([]);
  });

  it("of another document are never claimed", async () => {
    const other = { ...oldCopy(0, "2019-01-05", "Other doc") };
    other.sourceDocumentId = "d9";
    saveTimelineEvents([...getTimelineEvents(), other]);
    await save([ev("2019-01-06", "x", "A new")]);
    expect(shown()).toEqual(["A new", "Other doc"]);
  });
});

describe("a veteran-edited event", () => {
  const edit = () => {
    store.vkb.evidenceTimeline = store.vkb.evidenceTimeline.map((e) => ({
      ...e,
      description: "Corrected by veteran",
      userEdited: true,
    }));
  };

  it("gets no second copy when the model renames its type", async () => {
    await save([ev("2019-03-05", "service", "Notice sent")]);
    edit();
    await save([ev("2019-03-05", "notice", "VA sent a notice letter")]);
    expect(mine()).toEqual(["Corrected by veteran"]);
    expect(store.vkb.evidence).toEqual([]);
    expect(shown()).toEqual(["Corrected by veteran"]);
  });

  it("is not shadowed by the evidence mirror on a later save", async () => {
    await save([ev("2019-03-05", "service", "Notice sent")]);
    edit();
    await save([ev("2019-03-05", "service", "Notice sent again")]);
    await save([ev("2019-03-05", "service", "Notice sent yet again")]);
    expect(shown()).toEqual(["Corrected by veteran"]);
    expect(store.vkb.evidence).toEqual([]);
  });
});

describe("dates in loose forms", () => {
  it.each([
    "02/31/2019",
    "February 31, 2019",
    "2019-2-31",
    "sometime 2019",
    "unknown 2019",
    "circa 1998",
    "Page 2019",
    "13/45/2019",
    "Smarch 3, 2019",
  ])("%s is not a real date", (text) => {
    expect(isRealEventDate(text)).toBe(false);
  });

  it.each([
    "2019-03-05",
    "2019-3-5",
    "03/05/2019",
    "March 5, 2019",
    "Mar 5 2019",
    "5 March 2019",
    "March 2019",
    "2019-03",
    "2019",
  ])("%s is a real date", (text) => {
    expect(isRealEventDate(text)).toBe(true);
  });

  it("leaves an impossible worded day out of the plan and the stores", async () => {
    const plan = await save([
      ev("February 31, 2019", "x", "Impossible worded day"),
      ev("March 5, 2019", "x", "Real day"),
    ]);
    expect(plan.timelineLeftOut.map((e) => e.description)).toEqual([
      "Impossible worded day",
    ]);
    expect(mine()).toEqual(["Real day"]);
    expect(shown()).toEqual(["Real day"]);
  });
});

describe("a knowledge base that cannot be read", () => {
  it("changes nothing on the timeline", async () => {
    await save([ev("2019-01-05", "x", "Kept")]);
    store.fail = true;
    const result = await convergeTimelineStoreWithVKB();
    expect(result).toEqual({ added: 0 });
    expect(shown()).toEqual(["Kept"]);
  });
});

describe("events two documents share", () => {
  it("survive a re-save of the other document", async () => {
    await save([ev("2019-01-05", "x", "Shared event")], "d1");
    await save(
      [ev("2019-01-05", "x", "Shared event"), ev("2019-01-06", "x", "Only d2")],
      "d2",
    );
    await save([ev("2019-01-07", "x", "d1 changed")], "d1");
    expect(mine()).toContain("Shared event");
    expect(shown()).toEqual(["Only d2", "Shared event", "d1 changed"].sort());
  });
});

describe("one sentence under two categories on one day", () => {
  it("is one event everywhere", async () => {
    const plan = await save([
      ev("2019-01-05", "medical", "Seen for back pain"),
      ev("2019-01-05", "claim", "Seen for back pain"),
    ]);
    expect(plan.timeline).toHaveLength(1);
    expect(mine()).toEqual(["Seen for back pain"]);
    expect(words(store.vkb.evidence)).toEqual(["Seen for back pain"]);
    expect(shown()).toEqual(["Seen for back pain"]);
  });
});

describe("the filing step's entry without a date", () => {
  it("is not listed as saved, and is listed as left out", async () => {
    const plan = await save([], "d1", {
      deferredResult: {
        filename: "generic-letter.pdf",
        classification: { type: "va_rating_decision" },
      },
    });
    expect(plan.timeline).toEqual([]);
    expect(plan.timelineLeftOut).toHaveLength(1);
    expect(plan.timelineLeftOut[0].reason).toMatch(/no real calendar date/);
  });
});

describe("canonical types for the categories the analyzer asks for", () => {
  it.each([
    ["injury", "medical"],
    ["medical_visit", "medical"],
    ["diagnosis", "medical"],
    ["mental_health", "medical"],
    ["service", "service"],
    ["combat_award", "service"],
    ["Denied appeal", "appeal decided"],
    ["Statement of the case", "notice sent"],
    ["Board hearing", "appeal filed"],
    ["Rating decision", "decision issued"],
  ])("%s is %s", (label, type) => {
    expect(canonicalEventType(label)).toBe(type);
  });
});
