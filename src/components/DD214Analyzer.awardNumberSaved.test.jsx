/**
 * The awards row on the review screen shows an award's number and devices
 * ("(2nd award) with M Device"). Ticking it must save the same number and
 * devices with the award, in service history and in the Knowledge Base, not
 * only inside the archived document. Fixture awards are invented.
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
  getAllExtractedData: vi.fn().mockResolvedValue({ dd214s: [] }),
}));

const { default: ProfileImportConfirmModal } =
  await import("./ProfileImportConfirmModal.jsx");
const {
  _prepareAndShowProfileImport,
  _saveDd214ToProfile,
  _saveDd214ToVkb,
  _saveDd214ToPacket,
} = await import("./DD214Analyzer.jsx");
const { sourcesForImportRows } = await import("../utils/dd214ValueSources");
const { getServiceHistory } = await import("../utils/veteranProfile");
const { initializeVKB, mergeDD214IntoVKB: realMerge } = await vi.importActual(
  "../utils/veteranKnowledgeBase",
);

const ANALYSIS = {
  fieldSources: { awards: "parser" },
  branch: "Army",
  entryDate: "2002-03-05",
  separationDate: "2010-06-15",
  awards: [
    {
      name: "Sample Service Medal",
      deviceCount: 2,
      devices: [],
      isCombat: false,
    },
    {
      name: "Sample Flight Medal",
      deviceCount: 0,
      devices: ["M Device"],
      isCombat: false,
    },
    {
      name: "Sample Unit Citation",
      deviceCount: 3,
      devices: ["Bronze Service Star", "Bronze Service Star"],
      isCombat: true,
    },
    { name: "Sample Conduct Medal", deviceCount: 0, devices: [] },
  ],
};

function openDialog() {
  let importData;
  _prepareAndShowProfileImport(
    ANALYSIS,
    (data) => {
      importData = data;
    },
    () => {},
  );
  const onConfirm = vi.fn();
  render(
    <ProfileImportConfirmModal
      extractedData={importData}
      fieldSources={sourcesForImportRows(ANALYSIS.fieldSources, importData)}
      currentProfile={{}}
      onConfirm={onConfirm}
      onCancel={vi.fn()}
    />,
  );
  return { importData, onConfirm };
}

async function tickAwardsAndImport() {
  const { importData, onConfirm } = openDialog();
  fireEvent.click(screen.getByRole("button", { name: /Select All/ }));
  fireEvent.click(
    screen.getByRole("button", { name: /Import Selected Fields/ }),
  );
  const [fields, meta] = onConfirm.mock.calls[0];
  _saveDd214ToProfile(ANALYSIS, "text", fields, meta, []);
  await _saveDd214ToVkb(ANALYSIS, "text", [], fields);
  return { row: importData.awards, fields };
}

const savedAward = (name) =>
  getServiceHistory().awards.find((award) => award.name === name);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  stores.addDocumentToVKB.mockResolvedValue({
    success: true,
    documentId: "d1",
  });
});

describe("the awards row and what is saved agree", () => {
  it("shows the award numbers and devices that the ticked row then saves", async () => {
    const { row } = await tickAwardsAndImport();

    expect(row).toContain("Sample Service Medal (2nd award)");
    expect(row).toContain("Sample Flight Medal with M Device");
    expect(row).toContain(
      "Sample Unit Citation (3rd award) with 2 Bronze Service Star",
    );
    for (const [name, shown] of [
      ["Sample Service Medal", "2nd award"],
      ["Sample Unit Citation", "3rd award"],
    ]) {
      expect(row).toContain(`${name} (${shown})`);
      expect(savedAward(name).notes).toContain(shown);
    }
    expect(savedAward("Sample Flight Medal").notes).toBe("Devices: M Device");
    expect(savedAward("Sample Unit Citation").notes).toBe(
      "3rd award; Devices: Bronze Service Star, Bronze Service Star",
    );
    expect(savedAward("Sample Conduct Medal").notes).toBe("");
  });

  it("does not tick the awards row for the veteran", () => {
    openDialog();

    expect(
      screen.getByRole("button", { name: /Import Selected Fields/ }),
    ).toBeDisabled();
  });

  it("keeps the award number with the Knowledge Base award, as it keeps devices", () => {
    const vkb = initializeVKB();

    realMerge(vkb, { awards: ANALYSIS.awards }, { fileName: "invented.pdf" });

    const byName = Object.fromEntries(
      vkb.serviceHistory.awards.map((award) => [award.name, award]),
    );
    expect(byName["Sample Service Medal"].awardNumber).toBe(2);
    expect(byName["Sample Unit Citation"].awardNumber).toBe(3);
    expect(byName["Sample Flight Medal"].devices).toEqual(["M Device"]);
    expect(byName["Sample Flight Medal"]).not.toHaveProperty("awardNumber");
  });

  it("raises a Knowledge Base award's number when a later document shows a higher one", () => {
    const vkb = initializeVKB();
    const award = (deviceCount) => ({
      awards: [{ name: "Sample Service Medal", deviceCount, devices: [] }],
    });

    realMerge(vkb, award(2), { fileName: "first.pdf" });
    realMerge(vkb, award(4), { fileName: "second.pdf" });
    realMerge(vkb, award(1), { fileName: "third.pdf" });

    expect(vkb.serviceHistory.awards).toHaveLength(1);
    expect(vkb.serviceHistory.awards[0].awardNumber).toBe(4);
  });
});
