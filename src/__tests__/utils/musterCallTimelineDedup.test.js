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
import { describe, it, expect, afterEach, vi } from "vitest";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const { findDuplicateTimelineEntry, resolveTimelineDate, _toIsoDay } =
  await import("../../utils/musterCallProcessor");

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
    const files = ["dd214_1.pdf", "dd214_2.pdf", "dd214_3.pdf", "dd214_4.pdf"];
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

describe("resolveTimelineDate", () => {
  it.each([
    ["July 31, 2015", "2015-07-31"],
    ["4/20/2023", "2023-04-20"],
    ["2024-05-08", "2024-05-08"],
  ])("stores the letter date %s as %s", (decisionDate, expected) => {
    const { date, dateIsProcessingDate } = resolveTimelineDate(
      { extractedData: { decisionDate } },
      "ClaimLetter-2010-1-1.pdf",
    );
    expect(date).toBe(expected);
    expect(dateIsProcessingDate).toBe(false);
  });
});

// D-4 (final7 QA, 2026-09-24): appendMusterCallTimelineEntry's "imported"
// fallback date used new Date().toISOString().split("T")[0] - the UTC
// calendar day, already tomorrow for an evening import anywhere west of
// UTC. It now uses _toIsoDay(new Date()), which reads the LOCAL calendar
// day instead.
describe("_toIsoDay: today's fallback date is a local calendar day, not UTC", () => {
  const originalTZ = process.env.TZ;

  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = originalTZ;
  });

  it("reports the previous local day for a late-evening US-Pacific instant already past UTC midnight", () => {
    process.env.TZ = "America/Los_Angeles";
    vi.useFakeTimers();
    // 7:30 PM Sep 24 Pacific == 2:30 AM Sep 25 UTC.
    vi.setSystemTime(new Date("2026-09-25T02:30:00Z"));

    const now = new Date();
    expect(now.toISOString().split("T")[0]).toBe("2026-09-25");
    expect(_toIsoDay(now)).toBe("2026-09-24");
  });

  it("agrees with the UTC day when local and UTC calendar days coincide", () => {
    process.env.TZ = "America/Los_Angeles";
    vi.useFakeTimers();
    // Midday Pacific has no UTC/local day mismatch either way.
    vi.setSystemTime(new Date("2026-09-24T18:00:00Z"));

    const now = new Date();
    expect(_toIsoDay(now)).toBe(now.toISOString().split("T")[0]);
  });
});
