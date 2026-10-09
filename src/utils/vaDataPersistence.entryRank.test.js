/**
 * D11-3 QA follow-up (2026-09-27): saveServiceHistoryToVKB seeded a missing
 * vkb.serviceHistory.rank with the pre-D11-3 { entry, discharge } shape -
 * mergeDD214RankAndCharacter (veteranKnowledgeBase.js) was renamed to
 * firstPeriodRank/firstPeriodEntryDate specifically because rank.entry
 * mislabeled a separation rank as an entry rank. This writer must seed the
 * same honest shape, not resurrect the old one. Fixture values are generic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockVkb = { serviceHistory: {} };

vi.mock("./veteranKnowledgeBase", () => ({
  loadVKB: vi.fn(() => Promise.resolve(mockVkb)),
  saveVKB: vi.fn(() => Promise.resolve()),
  raceVkb: (promise) => promise,
}));
vi.mock("./persistentStorage", () => ({
  markAsModified: vi.fn(),
}));

const { saveServiceHistoryToVKB } = await import("./vaDataPersistence");

describe("saveServiceHistoryToVKB: rank shape seeded for a VKB with no rank yet", () => {
  beforeEach(() => {
    mockVkb.serviceHistory = {};
  });

  it("seeds firstPeriodRank, not the legacy entry field", async () => {
    await saveServiceHistoryToVKB({ payGrade: "E-5" });

    expect(mockVkb.serviceHistory.rank.discharge).toBe("E-5");
    expect(mockVkb.serviceHistory.rank.entry).toBeUndefined();
    expect(Object.hasOwn(mockVkb.serviceHistory.rank, "firstPeriodRank")).toBe(
      true,
    );
    expect(mockVkb.serviceHistory.rank.firstPeriodRank).toBeNull();
  });
});
