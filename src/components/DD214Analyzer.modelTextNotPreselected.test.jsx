/**
 * Owner decision (F): the text a model writes is identifier-bearing, because a
 * name the app has never seen cannot be recognised in it. So it is never
 * pre-ticked in the import dialog, and it reaches the Knowledge Base and My
 * Packet only when the veteran ticked it. Fixture values are synthetic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../utils/documentAnalyzer", () => ({
  OCR_STATES: {},
  getProgressStyling: () => ({}),
  formatFileSize: (bytes) => `${bytes} bytes`,
  isFileSupported: () => true,
  getAcceptString: () => "",
}));
vi.mock("../utils/musterCallProcessor", () => ({
  processFormationDocument: vi.fn(),
  PROCESSING_STATES: { EXTRACTING: "EXTRACTING", COMPLETE: "COMPLETE" },
}));
vi.mock("../utils/smolVLMService", () => ({
  smolVLMService: {},
  isSmolVLMSupported: () => false,
}));
const stores = vi.hoisted(() => ({
  addDocumentToVKB: vi.fn(),
  mergeDD214IntoVKB: vi.fn(),
  saveDocumentToPacket: vi.fn(),
}));
vi.mock("../utils/veteranKnowledgeBase", async (importOriginal) => ({
  ...(await importOriginal()),
  addDocumentToVKB: stores.addDocumentToVKB,
  mergeDD214IntoVKB: stores.mergeDD214IntoVKB,
  saveVKB: vi.fn().mockResolvedValue(undefined),
  loadVKB: vi.fn().mockResolvedValue({ personal: {} }),
}));
vi.mock("../utils/myPacketManager", async (importOriginal) => ({
  ...(await importOriginal()),
  saveDocumentToPacket: stores.saveDocumentToPacket,
}));

const { default: ProfileImportConfirmModal } =
  await import("./ProfileImportConfirmModal.jsx");
const {
  _parseDd214Json,
  _applyRegexSafetyNet,
  _saveDd214ToVkb,
  _saveDd214ToPacket,
} = await import("./DD214Analyzer.jsx");

const t = () => "parse error";
const MODEL_TEXT = {
  narrativeReason: "Separated per request of Jordan Faketon",
  memberRequests: "Born in Springfield, Illinois; mother Mary Faketon",
  foreignServiceDetails: "Stationed with Jordan Faketon in Germany",
  extractionNotes: ["Name on page 2 reads Faketon, Jordan Alex"],
  lastDutyAssignment: "Commander CPT Jordan Faketon, 3rd Battalion",
  commandTransferredTo: "Reports to Jordan Faketon",
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  stores.addDocumentToVKB.mockResolvedValue({
    success: true,
    documentId: "d1",
  });
  stores.saveDocumentToPacket.mockResolvedValue({ success: true });
});

describe("a name the app has never seen is removed from model text", () => {
  it("is not shown even when the local parser read no name", () => {
    let final;
    const data = _parseDd214Json(
      JSON.stringify({ branch: "Army", ...MODEL_TEXT }),
      t,
    );
    _applyRegexSafetyNet(data, "2. DEPARTMENT: ARMY", (value) => {
      final = value;
    });
    expect(final.fullName).toBe("");
    expect(JSON.stringify(final)).not.toContain("Faketon");
    expect(final.narrativeReason).toContain("Separated per request of");
  });
});

const EXTRACTED = { ...MODEL_TEXT, branch: "Army" };
const SOURCES = {
  ...Object.fromEntries(Object.keys(MODEL_TEXT).map((key) => [key, "model"])),
  branch: "parser",
};
const NO_PROFILE = {};

describe("the import dialog never pre-selects model-written text", () => {
  it("offers it unticked and leaves it out until the veteran ticks it", () => {
    const onConfirm = vi.fn();
    render(
      <ProfileImportConfirmModal
        extractedData={EXTRACTED}
        fieldSources={SOURCES}
        currentProfile={NO_PROFILE}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Import Selected Fields/ }),
    );
    expect(onConfirm.mock.calls[0][0]).toEqual({ branch: "Army" });
  });
});

describe("the Knowledge Base and My Packet only get ticked model text", () => {
  const analysis = {
    branch: "Army",
    fullName: "FAKETON, JORDAN",
    ...MODEL_TEXT,
  };

  it("leaves the narrative reason out of the Knowledge Base when it was not ticked", async () => {
    await _saveDd214ToVkb(analysis, "text", [], { branch: "Army" });
    const filed = stores.addDocumentToVKB.mock.calls[0][0].extractedData;
    expect(filed.branch).toBe("Army");
    expect(filed.narrativeReason).toBeUndefined();
  });

  it("files the narrative reason once the veteran ticked it", async () => {
    const reason = analysis.narrativeReason;
    await _saveDd214ToVkb(analysis, "text", [], { narrativeReason: reason });
    const filed = stores.addDocumentToVKB.mock.calls[0][0].extractedData;
    expect(filed.narrativeReason).toBe(reason);
  });

  it("archives the structured copy in My Packet without unticked text or identifiers", async () => {
    await _saveDd214ToPacket(analysis, "text", [], { branch: "Army" });
    const saved = stores.saveDocumentToPacket.mock.calls[0][0];
    for (const copy of [saved.extractedData, saved.aiAnalysis]) {
      expect(copy.branch).toBe("Army");
      expect(JSON.stringify(copy)).not.toMatch(/faketon|springfield/i);
    }
  });

  it("keeps the ticked ones", async () => {
    await _saveDd214ToPacket(analysis, "text", [], {
      fullName: analysis.fullName,
      narrativeReason: analysis.narrativeReason,
    });
    const saved = stores.saveDocumentToPacket.mock.calls[0][0];
    expect(saved.extractedData.fullName).toBe(analysis.fullName);
    expect(saved.aiAnalysis.narrativeReason).toBe(analysis.narrativeReason);
    expect(saved.extractedData.memberRequests).toBeUndefined();
  });
});
