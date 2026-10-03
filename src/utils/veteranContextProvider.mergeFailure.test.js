/**
 * mergeAnalysisIntoVkb is what the C-File Analyzer's Save relies on to know
 * the conditions and timeline events reached storage. A Knowledge Base that
 * cannot be opened, or a save the store refuses, must come back as a failure
 * rather than a silent no-op, so the screen never says "saved" over lost data.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const kb = vi.hoisted(() => ({
  loadVKB: vi.fn(),
  saveVKB: vi.fn(),
  addDocumentToVKB: vi.fn(),
}));
vi.mock("./veteranKnowledgeBase", async (importOriginal) => ({
  ...(await importOriginal()),
  loadVKB: kb.loadVKB,
  saveVKB: kb.saveVKB,
  addDocumentToVKB: kb.addDocumentToVKB,
}));

const { mergeAnalysisIntoVkb } = await import("./veteranContextProvider");

const MERGE = { claims: [], evidenceTimeline: [] };

function freshVkb() {
  return { metadata: {}, aiInsights: {}, medicalConditions: { current: [] } };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("mergeAnalysisIntoVkb reports a merge that did not reach storage", () => {
  it("rejects when the Knowledge Base cannot be opened", async () => {
    kb.loadVKB.mockResolvedValue(null);
    await expect(
      mergeAnalysisIntoVkb({ toolName: "T", vkbMergeData: MERGE }),
    ).rejects.toThrow(/could not be opened/);
    expect(kb.saveVKB).not.toHaveBeenCalled();
  });

  it("rejects with the store's reason when the save is refused", async () => {
    kb.loadVKB.mockResolvedValue(freshVkb());
    kb.saveVKB.mockResolvedValue({ success: false, error: "storage is full" });
    await expect(
      mergeAnalysisIntoVkb({ toolName: "T", vkbMergeData: MERGE }),
    ).rejects.toThrow(/storage is full/);
  });

  it("rejects when saving throws", async () => {
    kb.loadVKB.mockResolvedValue(freshVkb());
    kb.saveVKB.mockRejectedValue(new Error("aborted"));
    await expect(
      mergeAnalysisIntoVkb({ toolName: "T", vkbMergeData: MERGE }),
    ).rejects.toThrow(/aborted/);
  });

  it("resolves when the save succeeds", async () => {
    kb.loadVKB.mockResolvedValue(freshVkb());
    kb.saveVKB.mockResolvedValue({ success: true });
    await expect(
      mergeAnalysisIntoVkb({ toolName: "T", vkbMergeData: MERGE }),
    ).resolves.toBeUndefined();
    expect(kb.saveVKB).toHaveBeenCalledTimes(1);
  });
});
