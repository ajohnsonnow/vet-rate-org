/**
 * D21-1: under load one import stalled for good at 85% with no message - the
 * step after the knowledge-base save never finished. Every step of persisting
 * a document must be bounded, a stall must come back as a plain, document-
 * naming failure the veteran can Retry, and a Retry must complete the data
 * without duplicating anything. The faults are injected into a fake IndexedDB
 * (a write transaction that never completes, an open that is blocked and
 * never settles); persistFormationDocument and the real stores are untouched.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createFakeIndexedDB } from "../__tests__/helpers/fakeIndexedDB";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const FILE = { name: "generic-letter.pdf", size: 4096 };
const result = () => ({
  pageCount: 1,
  text: "RATING DECISION generic text",
  classification: { type: "rating_decision", confidence: 90 },
  extractedData: {
    type: "rating_decision",
    conditions: [{ name: "Tinnitus", rating: 10, effectiveDate: "2020-01-01" }],
  },
});

let fake;

async function loadModules() {
  vi.resetModules();
  vi.stubGlobal("indexedDB", fake.indexedDB);
  const processor = await import("./musterCallProcessor");
  const vkb = await import("./veteranKnowledgeBase");
  const profile = await import("./veteranProfile");
  return { processor, vkb, profile };
}

beforeEach(() => {
  localStorage.clear();
  fake = createFakeIndexedDB();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const FAULTS = {
  "a write transaction that never completes": () => {
    fake.control.stallWrites = true;
  },
  "a database open that is blocked and never settles": () => {
    fake.control.blockOpen = true;
  },
};

describe.each(Object.entries(FAULTS))(
  "persisting under %s",
  (_name, inject) => {
    it("gives up in bounded time, names what did not finish, and still saves what needs no storage", async () => {
      const { processor, profile } = await loadModules();
      inject();

      const started = Date.now();
      const failure = await processor
        .persistFormationDocument(FILE, result(), { stepTimeoutMs: 100 })
        .catch((err) => err);

      expect(Date.now() - started).toBeLessThan(3000);
      expect(failure).toBeInstanceOf(processor.DocumentPersistIncompleteError);
      expect(failure.steps).toContain("knowledge base");
      expect(profile.getMyRatings()).toHaveLength(1);
    }, 10_000);

    it("a Retry after the fault clears completes the data and never duplicates it", async () => {
      const { processor, vkb } = await loadModules();
      inject();
      await expect(
        processor.persistFormationDocument(FILE, result(), {
          stepTimeoutMs: 100,
        }),
      ).rejects.toBeInstanceOf(processor.DocumentPersistIncompleteError);

      fake.control.stallWrites = false;
      fake.control.blockOpen = false;
      await processor.persistFormationDocument(FILE, result());
      await processor.persistFormationDocument(FILE, result());

      const saved = await vkb.loadVKB();
      expect(saved.documentation.cFiles).toHaveLength(1);
      expect(
        saved.evidenceTimeline.filter((e) => e.eventType === "document_import"),
      ).toHaveLength(1);
      expect(fake.records("VetRateMyPacket", "documents")).toHaveLength(1);
    }, 15_000);
  },
);

describe("describePersistIncomplete", () => {
  it("names the document and offers the Retry", async () => {
    const { processor } = await loadModules();
    const message = processor.describePersistIncomplete("generic-letter.pdf");
    expect(message).toContain('"generic-letter.pdf"');
    expect(message).toContain("Retry");
  });
});

describe("retryFormationDocumentPersist", () => {
  it("saves a document whose first save did not finish and hands back a result ready for review", async () => {
    const { processor, vkb } = await loadModules();
    fake.control.stallWrites = true;
    const first = await processor
      .persistFormationDocument(FILE, result(), { stepTimeoutMs: 100 })
      .catch((err) => err);
    expect(first).toBeInstanceOf(processor.DocumentPersistIncompleteError);

    fake.control.stallWrites = false;
    const retried = await processor.retryFormationDocumentPersist({
      ...result(),
      filename: FILE.name,
      size: FILE.size,
      status: "error",
      persistIncomplete: true,
    });

    expect(retried.status).toBe("complete");
    expect(retried.readyForReview).toBe(true);
    expect(retried.persistIncomplete).toBe(false);
    expect(retried.vkbSaved).toBe(true);
    expect((await vkb.loadVKB()).documentation.cFiles).toHaveLength(1);
  }, 15_000);
});
