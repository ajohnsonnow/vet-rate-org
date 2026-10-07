import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const reads = vi.hoisted(() => ({
  getVeteranProfile: vi.fn(),
  getServiceHistory: vi.fn(),
  loadVKB: vi.fn(),
  getAllExtractedData: vi.fn(),
}));
vi.mock("./veteranProfile", () => ({
  getVeteranProfile: reads.getVeteranProfile,
  getServiceHistory: reads.getServiceHistory,
}));
vi.mock("./veteranKnowledgeBase", () => ({ loadVKB: reads.loadVKB }));
vi.mock("./myPacketManager", () => ({
  getAllExtractedData: reads.getAllExtractedData,
}));

const { loadKnownIdentifierSources, loadKnownIdentifierSourcesChecked } =
  await import("./dd214KnownIdentifierSources");

beforeEach(() => {
  reads.getVeteranProfile.mockReturnValue({ fullName: "Profile Name" });
  reads.getServiceHistory.mockReturnValue({ servicePeriods: [] });
  reads.loadVKB.mockResolvedValue({
    personal: { dateOfBirth: "1984-03-15" },
    serviceHistory: { periods: [] },
  });
  reads.getAllExtractedData.mockResolvedValue({
    dd214s: [{ extractedData: { fullName: "Packet Name" }, aiAnalysis: null }],
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("loadKnownIdentifierSourcesChecked", () => {
  it("is complete when all four stores read", async () => {
    const { sources, complete } = await loadKnownIdentifierSourcesChecked();
    expect(complete).toBe(true);
    expect(JSON.stringify(sources)).toContain("Profile Name");
    expect(JSON.stringify(sources)).toContain("1984-03-15");
    expect(JSON.stringify(sources)).toContain("Packet Name");
  });

  it.each([
    [
      "profile",
      () =>
        reads.getVeteranProfile.mockImplementation(() => {
          throw new Error("profile read failed");
        }),
    ],
    [
      "service history",
      () =>
        reads.getServiceHistory.mockImplementation(() => {
          throw new Error("history read failed");
        }),
    ],
    ["knowledge base", () => reads.loadVKB.mockRejectedValue(new Error("kb"))],
    [
      "My Packet",
      () => reads.getAllExtractedData.mockRejectedValue(new Error("packet")),
    ],
  ])(
    "is incomplete when the %s read rejects, and keeps the rest",
    async (_name, fail) => {
      fail();
      const { sources, complete } = await loadKnownIdentifierSourcesChecked();
      expect(complete).toBe(false);
      expect(sources.length).toBeGreaterThan(0);
    },
  );

  it("is incomplete when a store never answers within the limit", async () => {
    vi.useFakeTimers();
    reads.loadVKB.mockReturnValue(new Promise(() => {}));
    const pending = loadKnownIdentifierSourcesChecked();
    await vi.advanceTimersByTimeAsync(4001);
    const { complete } = await pending;
    expect(complete).toBe(false);
  });

  it("loadKnownIdentifierSources still returns just the sources", async () => {
    const sources = await loadKnownIdentifierSources();
    expect(Array.isArray(sources)).toBe(true);
    expect(sources.length).toBeGreaterThan(0);
  });
});
