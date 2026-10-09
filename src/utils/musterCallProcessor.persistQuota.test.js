/**
 * A full device must not look like a saved document. When a write commit is
 * refused for lack of space the document has reached neither the knowledge
 * base nor My Packet, so persisting must fail plainly (naming the storage as
 * full) and a Retry once space is free must complete it without duplicates.
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
  extractedData: {
    type: "rating_decision",
    conditions: [{ name: "Tinnitus", rating: 10, effectiveDate: "2020-01-01" }],
  },
});

let fake;
let modules;

async function loadModules() {
  vi.resetModules();
  vi.stubGlobal("indexedDB", fake.indexedDB);
  const processor = await import("./musterCallProcessor");
  const vkb = await import("./veteranKnowledgeBase");
  return { processor, vkb };
}

beforeEach(async () => {
  localStorage.clear();
  fake = createFakeIndexedDB();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  modules = await loadModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("persisting while the device storage is full", () => {
  it("fails with a storage-full error that names the steps that did not save", async () => {
    fake.control.quotaFull = true;

    const failure = await modules.processor
      .persistFormationDocument(FILE, documentResult())
      .catch((err) => err);

    expect(failure).toBeInstanceOf(
      modules.processor.DocumentPersistIncompleteError,
    );
    expect(failure.quotaExceeded).toBe(true);
    expect(failure.steps).toEqual(
      expect.arrayContaining(["knowledge base", "my packet"]),
    );
  }, 15_000);

  it("says plainly that the storage is full, not that it was slow", async () => {
    fake.control.quotaFull = true;

    const retried = await modules.processor.retryFormationDocumentPersist({
      ...documentResult(),
      filename: FILE.name,
      size: FILE.size,
      status: "error",
      persistIncomplete: true,
    });

    expect(retried.status).toBe("error");
    expect(retried.persistIncomplete).toBe(true);
    expect(retried.error).toContain('"generic-letter.pdf"');
    expect(retried.error).toMatch(/storage is full/i);
    expect(retried.error).not.toMatch(/did not respond/i);
  }, 15_000);

  it("a Retry once space is free completes the document without duplicates", async () => {
    fake.control.quotaFull = true;
    await expect(
      modules.processor.persistFormationDocument(FILE, documentResult()),
    ).rejects.toBeInstanceOf(modules.processor.DocumentPersistIncompleteError);

    fake.control.quotaFull = false;
    await modules.processor.persistFormationDocument(FILE, documentResult());

    const saved = await modules.vkb.loadVKB();
    expect(saved.documentation.cFiles).toHaveLength(1);
    expect(fake.records("VetRateMyPacket", "documents")).toHaveLength(1);
  }, 15_000);
});
