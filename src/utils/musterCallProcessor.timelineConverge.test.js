/**
 * D21-1 (the 48-of-66 case): an interrupted import followed by a re-import
 * left the local timeline store holding only the events present at its first
 * open, while the knowledge base held all of them. Persisting a document now
 * completes the store from the knowledge base - adding what is missing and
 * nothing else: no duplicate, no change to a hand-added event, and no return
 * of an imported event the veteran removed.
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

const vkbEvent = (n) => ({
  date: `2010-01-${String(n).padStart(2, "0")}`,
  eventType: "clinical",
  description: `Generic clinic visit ${n}`,
  source: "C-File",
  significance: "",
});
const localCopy = (n) => ({
  id: `vkb_1_${n}`,
  type: "records",
  date: `2010-01-${String(n).padStart(2, "0")}`,
  title: `Generic clinic visit ${n}`,
  description: `Generic clinic visit ${n}`,
  category: "Medical Records",
});

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

async function seedVkbWithEvents(count) {
  const vault = await modules.vkb.loadVKB();
  vault.evidenceTimeline = Array.from({ length: count }, (_, i) =>
    vkbEvent(i + 1),
  );
  await modules.vkb.saveVKB(vault);
}

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

const descriptions = () =>
  modules.profile.getTimelineEvents().map((e) => e.description);

describe("persisting a document completes the local timeline store", () => {
  it("brings a partial store (10 of 28 events, the 48-of-66 case in small) up to the full set without duplicates or touching a hand-added event", async () => {
    await seedVkbWithEvents(28);
    const handAdded = {
      id: 1700000000000,
      type: "service",
      date: "2011-05-05",
      title: "My own note",
      description: "My own note",
      category: "Service Event",
    };
    modules.profile.saveTimelineEvents([
      ...Array.from({ length: 10 }, (_, i) => localCopy(i + 1)),
      handAdded,
    ]);

    await modules.processor.persistFormationDocument(FILE, documentResult());

    const events = modules.profile.getTimelineEvents();
    const fromRecords = events.filter((e) => e.id !== handAdded.id);
    expect(fromRecords).toHaveLength(28);
    expect(new Set(descriptions()).size).toBe(events.length);
    const kept = events.find((e) => e.id === handAdded.id);
    expect(kept).toMatchObject({
      date: handAdded.date,
      description: handAdded.description,
    });
  }, 15_000);

  it("is repeatable: persisting again adds nothing more", async () => {
    await seedVkbWithEvents(5);
    modules.profile.saveTimelineEvents([localCopy(1)]);

    await modules.processor.persistFormationDocument(FILE, documentResult());
    const first = descriptions();
    await modules.processor.persistFormationDocument(FILE, documentResult());

    expect(descriptions()).toEqual(first);
  }, 15_000);

  it("does not bring back an imported event the veteran removed", async () => {
    await seedVkbWithEvents(4);
    const copies = [1, 2, 3].map(localCopy);
    modules.profile.saveTimelineEvents(copies);
    modules.sync.recordRemovedTimelineEvent(copies[1]);
    modules.profile.saveTimelineEvents([copies[0], copies[2]]);

    await modules.processor.persistFormationDocument(FILE, documentResult());

    expect(descriptions()).not.toContain("Generic clinic visit 2");
    expect(descriptions()).toContain("Generic clinic visit 4");
  }, 15_000);

  it("leaves an empty store to the timeline's own first open", async () => {
    await seedVkbWithEvents(3);

    await modules.processor.persistFormationDocument(FILE, documentResult());

    expect(modules.profile.getTimelineEvents()).toEqual([]);
  }, 15_000);

  it("does not add a second copy of an event the veteran typed in by hand", async () => {
    await seedVkbWithEvents(2);
    modules.profile.saveTimelineEvents([
      {
        id: 1700000000001,
        type: "service",
        date: "2010-01-02",
        title: "typed",
        description: "generic clinic visit 2",
        category: "Service Event",
      },
    ]);

    await modules.processor.persistFormationDocument(FILE, documentResult());

    const same = modules.profile
      .getTimelineEvents()
      .filter((e) => e.date === "2010-01-02");
    expect(same).toHaveLength(1);
    expect(same[0].id).toBe(1700000000001);
  }, 15_000);
});
