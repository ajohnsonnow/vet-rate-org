/**
 * Owner decision F: nothing a model wrote reaches the profile, service
 * history, Knowledge Base or My Packet until the veteran ticks that row, and
 * every model-written row (lists and objects included) can be ticked. Fixture
 * values are synthetic.
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

const ANALYSIS = {
  fieldSources: {
    branch: "parser",
    entryDate: "parser",
    separationDate: "parser",
    mos: "model",
    mosTitle: "model",
    militaryEducation: "model",
    specialQualifications: "model",
    awards: "model",
    combatService: "model",
  },
  branch: "Army",
  mos: "11B",
  mosTitle: "Zzmarker rifleman",
  entryDate: "2002-03-05",
  separationDate: "2010-06-15",
  militaryEducation: ["Zzmarker Airborne Course"],
  specialQualifications: ["Zzmarker Ranger"],
  awards: [{ name: "Zzmarker Medal", sourceDocument: "scan.pdf" }],
  deployments: ["Zzmarker Theater"],
  combatService: {
    hasVerifiedCombat: true,
    indicators: ["Zzmarker indicator"],
    deployments: ["Zzmarker Theater"],
  },
};
const MARKER = /Zzmarker/;
const LIST_KEYS = [
  "militaryEducation",
  "specialQualifications",
  "awards",
  "combatService",
];

const dumpLocalStorage = () =>
  JSON.stringify(
    Object.fromEntries(
      Array.from({ length: localStorage.length }, (_, i) => {
        const key = localStorage.key(i);
        return [key, localStorage.getItem(key)];
      }),
    ),
  );

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

async function importWith(tickAll) {
  const { onConfirm } = openDialog();
  if (tickAll)
    fireEvent.click(screen.getByRole("button", { name: /Select All/ }));
  fireEvent.click(
    screen.getByRole("button", { name: /Import Selected Fields/ }),
  );
  const [fields, meta] = onConfirm.mock.calls[0];
  _saveDd214ToProfile(ANALYSIS, "text", fields, meta, []);
  await _saveDd214ToVkb(ANALYSIS, "text", [], fields);
  await _saveDd214ToPacket(ANALYSIS, "text", [], fields);
  return fields;
}

const storedByStores = () =>
  JSON.stringify([
    stores.addDocumentToVKB.mock.calls,
    stores.mergeDD214IntoVKB.mock.calls,
    stores.saveDocumentToPacket.mock.calls,
  ]);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  stores.addDocumentToVKB.mockResolvedValue({
    success: true,
    documentId: "d1",
  });
  stores.saveDocumentToPacket.mockResolvedValue({ success: true });
});

describe("model-written rows are offered, never pre-ticked", () => {
  it("shows a row for every list and object value, unticked", () => {
    const { importData, onConfirm } = openDialog();
    for (const key of LIST_KEYS) expect(Object.keys(importData)).toContain(key);
    fireEvent.click(
      screen.getByRole("button", { name: /Import Selected Fields/ }),
    );
    const preTicked = Object.keys(onConfirm.mock.calls[0][0]);
    for (const key of [...LIST_KEYS, "mosTitle"]) {
      expect(preTicked).not.toContain(key);
    }
  });
});

describe("a plain Import with nothing extra ticked", () => {
  it("writes no model-written text to localStorage, the KB or My Packet", async () => {
    await importWith(false);
    expect(dumpLocalStorage()).toContain("vet_rate_service_history");
    expect(dumpLocalStorage()).not.toMatch(MARKER);
    expect(dumpLocalStorage()).not.toContain("11B");
    expect(storedByStores()).not.toMatch(MARKER);
    expect(storedByStores()).not.toContain("11B");
    expect(stores.addDocumentToVKB).toHaveBeenCalled();
    expect(stores.saveDocumentToPacket).toHaveBeenCalled();
  });
});

describe("Select All then Import", () => {
  it("saves the lists and objects the veteran ticked", async () => {
    const fields = await importWith(true);
    for (const key of LIST_KEYS) expect(Object.keys(fields)).toContain(key);
    const stored = storedByStores();
    for (const text of [
      "Zzmarker Airborne Course",
      "Zzmarker Ranger",
      "Zzmarker Medal",
      "Zzmarker indicator",
    ]) {
      expect(stored).toContain(text);
    }
    expect(dumpLocalStorage()).toContain("Zzmarker rifleman");
  });
});
