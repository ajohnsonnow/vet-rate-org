/**
 * FIX-12: re-importing the same 4 DD214 files produced 4 duplicate
 * "DD214 (Service Record): ..." evidence timeline entries (5 -> 9), because
 * appendMusterCallTimelineEntry (musterCallProcessor.js) unconditionally
 * pushed a new entry on every import with no identity check, unlike
 * addDocumentToVKB's own (fileName, fileSize) idempotency guard for the
 * Documents tab.
 *
 * appendMusterCallTimelineEntry itself requires IndexedDB (loadVKB/saveVKB),
 * which isn't available under jsdom — same gap documented for
 * addDocumentToVKB in vkbDd214DocumentDedup.test.js. findDuplicateTimelineEntry
 * is the pure identity-check helper factored out of it specifically so the
 * actual dedup logic is unit-testable without IndexedDB; real end-to-end
 * proof (re-importing real DD214s twice via the browser's real IndexedDB)
 * comes from the Playwright real-document-corpus run, not this file.
 */
import { describe, it, expect } from "vitest";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const { findDuplicateTimelineEntry } = await import(
  "../../utils/musterCallProcessor"
);

const importEntry = (overrides = {}) => ({
  date: "05/30/2015",
  dateIsProcessingDate: false,
  eventType: "document_import",
  description: "DD214 (Service Record): williams_dd214.pdf",
  source: "Muster Call",
  significance: "",
  ...overrides,
});

describe("FIX-12: findDuplicateTimelineEntry", () => {
  it("finds an existing document_import entry with the same description", () => {
    const timeline = [importEntry()];
    const found = findDuplicateTimelineEntry(
      timeline,
      "DD214 (Service Record): williams_dd214.pdf",
    );
    expect(found).toBe(timeline[0]);
  });

  it("returns undefined when no entry matches (first import)", () => {
    const timeline = [];
    const found = findDuplicateTimelineEntry(
      timeline,
      "DD214 (Service Record): williams_dd214.pdf",
    );
    expect(found).toBeUndefined();
  });

  it("does not match a different file's description", () => {
    const timeline = [importEntry()];
    const found = findDuplicateTimelineEntry(
      timeline,
      "DD214 (Service Record): other_dd214.pdf",
    );
    expect(found).toBeUndefined();
  });

  it("does not match a non-document_import entry that happens to share a description-shaped string", () => {
    const timeline = [
      importEntry({
        eventType: "service_entry",
        description: "DD214 (Service Record): williams_dd214.pdf",
      }),
    ];
    const found = findDuplicateTimelineEntry(
      timeline,
      "DD214 (Service Record): williams_dd214.pdf",
    );
    expect(found).toBeUndefined();
  });

  it("does not match an entry from a different source (e.g. the DD214Analyzer review-screen merge path)", () => {
    const timeline = [
      importEntry({ source: "williams_dd214.pdf" }), // mergeDD214EvidenceTimeline uses options.fileName as source
    ];
    const found = findDuplicateTimelineEntry(
      timeline,
      "DD214 (Service Record): williams_dd214.pdf",
    );
    expect(found).toBeUndefined();
  });

  it("re-importing 4 documents twice each still resolves to 4 stable identities, not 8", () => {
    const files = [
      "dd214_1.pdf",
      "dd214_2.pdf",
      "dd214_3.pdf",
      "dd214_4.pdf",
    ];
    const timeline = [];
    for (let pass = 1; pass <= 2; pass += 1) {
      for (const fileName of files) {
        const description = `DD214 (Service Record): ${fileName}`;
        const existing = findDuplicateTimelineEntry(timeline, description);
        if (!existing) {
          timeline.push(importEntry({ description }));
        }
      }
    }
    expect(timeline).toHaveLength(4);
  });
});
