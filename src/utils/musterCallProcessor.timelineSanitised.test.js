/**
 * The local timeline store writes every description through the profile's
 * sanitiser (1000-character cap, control characters and "on<word>=" runs
 * removed). Convergence must compare an event the way the store keeps it,
 * otherwise every persisted document adds one more copy of any event whose
 * text the sanitiser changes, and an event the veteran removed comes back.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createFakeIndexedDB } from "../__tests__/helpers/fakeIndexedDB";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const FILE = { name: "generic-letter.pdf", size: 4096 };
const documentResult = () => ({
  pageCount: 1,
  text: "RATING DECISION generic text",
  classification: { type: "rating_decision", confidence: 90 },
  extractedData: { type: "rating_decision", conditions: [] },
});

const PLAIN = { date: "2010-02-01", description: "Plain clinic visit" };
const LONG = { date: "2010-02-02", description: "Long note. ".repeat(120) };
const EQUALS = {
  date: "2010-02-03",
  description: "Exam noted condition = chronic strain",
};
const CONTROL = {
  date: "2010-02-04",
  description: "Scan text\fwith a form feed",
};
const ALL = [PLAIN, LONG, EQUALS, CONTROL];

let modules;

async function loadModules() {
  vi.resetModules();
  vi.stubGlobal("indexedDB", createFakeIndexedDB().indexedDB);
  const processor = await import("./musterCallProcessor");
  const vkb = await import("./veteranKnowledgeBase");
  const profile = await import("./veteranProfile");
  const sync = await import("./timelineStoreSync");
  return { processor, vkb, profile, sync };
}

async function seedVkb(events) {
  const vault = await modules.vkb.loadVKB();
  vault.evidenceTimeline = events.map((e) => ({
    ...e,
    eventType: "clinical",
    source: "C-File",
    significance: "",
  }));
  await modules.vkb.saveVKB(vault);
}

const persist = () =>
  modules.processor.persistFormationDocument(FILE, documentResult());
const copiesOn = (date) =>
  modules.profile.getTimelineEvents().filter((e) => e.date === date).length;

beforeEach(async () => {
  localStorage.clear();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  modules = await loadModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("convergence compares events the way the store keeps them", () => {
  it("adds one copy of each event however many documents persist", async () => {
    await seedVkb(ALL);
    modules.profile.saveTimelineEvents([
      { id: "vkb_1_0", type: "records", ...PLAIN, title: "Plain" },
    ]);

    await persist();
    await persist();
    await persist();

    expect(ALL.map((e) => copiesOn(e.date))).toEqual([1, 1, 1, 1]);
  }, 30_000);

  it("keeps an event the veteran removed out, even when its text is sanitised", async () => {
    await seedVkb(ALL);
    modules.profile.saveTimelineEvents([
      { id: "vkb_1_0", type: "records", ...PLAIN, title: "Plain" },
    ]);
    await persist();
    const stored = modules.profile.getTimelineEvents();
    const removed = stored.filter((e) => e.date === EQUALS.date);
    expect(removed).toHaveLength(1);
    modules.sync.recordRemovedTimelineEvent(removed[0]);
    modules.profile.saveTimelineEvents(
      stored.filter((e) => e.date !== EQUALS.date),
    );

    await persist();

    expect(copiesOn(EQUALS.date)).toBe(0);
    expect(copiesOn(LONG.date)).toBe(1);
  }, 30_000);
});
