/**
 * Owner decision (G), 2026-10-03: nothing the model read from a document is
 * pre-selected in any field. A confident parser value is shown first and is
 * the only thing that may be pre-ticked, a model value appears only where the
 * parser has none (labelled, unticked), and the card and the dialog say how
 * many values came from each source. Also D23-1: a block the parser captured
 * past its own box never reaches the screen, the import rows, My Packet or the
 * Knowledge Base. The real component, import dialog and profile (localStorage)
 * are used; extraction and the AI answer are the only fakes. Fixture values
 * are synthetic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

vi.mock("../utils/documentAnalyzer", async (importOriginal) => ({
  ...(await importOriginal()),
  analyzeDocument: vi.fn(),
}));
vi.mock("../utils/smolVLMService", () => ({
  smolVLMService: {},
  isSmolVLMSupported: () => false,
}));
vi.mock("../utils/unifiedAIService", async (importOriginal) => ({
  ...(await importOriginal()),
  getAIStatus: () => ({ anyAvailable: true }),
  getDocumentAIRouting: () => ({ onDeviceReady: true }),
  generateAI: vi.fn(),
}));
const stores = vi.hoisted(() => ({
  addDocumentToVKB: vi.fn(),
  mergeDD214IntoVKB: vi.fn(),
  saveDocumentToPacket: vi.fn(),
}));
vi.mock("../utils/veteranKnowledgeBase", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    addDocumentToVKB: stores.addDocumentToVKB,
    mergeDD214IntoVKB: stores.mergeDD214IntoVKB,
    saveVKB: vi.fn().mockResolvedValue(undefined),
    loadVKB: vi.fn(async () => actual.initializeVKB()),
  };
});
vi.mock("../utils/myPacketManager", async (importOriginal) => ({
  ...(await importOriginal()),
  saveDocumentToPacket: stores.saveDocumentToPacket,
  getAllExtractedData: vi.fn(async () => ({ dd214s: [] })),
}));

const { analyzeDocument } = await import("../utils/documentAnalyzer");
const { generateAI } = await import("../utils/unifiedAIService");
const { getVeteranProfile, getServiceHistory } =
  await import("../utils/veteranProfile");
const { LanguageProvider } = await import("../contexts/LanguageContext");
const {
  default: DD214Analyzer,
  _saveDd214ToProfile,
  _saveDd214ToVkb,
  _saveDd214ToPacket,
} = await import("./DD214Analyzer.jsx");

const PARSER_THREE_TEXT = `--- PAGE 1 ---
DD FORM 214 CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY
12A. DATE ENTERED ACTIVE DUTY THIS PERIOD: 20020305
12B. SEPARATION DATE THIS PERIOD: 20100615
24. CHARACTER OF SERVICE: HONORABLE
`;

const MODEL_FILLS_EVERYTHING = JSON.stringify({
  documentCount: 1,
  documentTypes: ["DD214"],
  masterRecordType: "DD214",
  component: "RA",
  componentFull: "Regular Army",
  branch: "Navy",
  rank: "SGT",
  payGrade: "E-9",
  dateOfRank: "2005-01-01",
  mos: "11B",
  mosTitle: "Rifleman",
  lastDutyAssignment: "Alpha Company",
  commandTransferredTo: "Reserve Control Group",
  sglCoverage: "$400,000",
  entryDate: "2003-02-02",
  separationDate: "2011-07-07",
  reserveObligationDate: "2016-07-07",
  separationAuthority: "AR 635-200, Chapter 4",
  separationCode: "MBK",
  reentryCode: "RE-1",
  separationType: "Honorable Discharge",
  characterOfService: "General",
  narrativeReason: "Completion of required service",
  militaryEducation: ["Basic Leader Course"],
  specialQualifications: ["Airborne"],
  awards: [{ name: "Army Achievement Medal", devices: [] }],
  securityClearance: "Secret",
});

const PARSER_ROWS = [
  "Service Start Date",
  "Separation Date",
  "Character of Service",
];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.alert = vi.fn();
  generateAI.mockResolvedValue({ text: MODEL_FILLS_EVERYTHING });
  stores.addDocumentToVKB.mockResolvedValue({
    success: true,
    documentId: "d1",
  });
  stores.saveDocumentToPacket.mockResolvedValue({ success: true });
});

async function readScan(scanText) {
  analyzeDocument.mockResolvedValue({
    text: scanText,
    pageCount: 1,
    method: "text",
    ocrUsed: false,
  });
  render(
    <LanguageProvider>
      <DD214Analyzer
        onClose={vi.fn()}
        initialFile={
          new File(["x"], "sample-dd214.pdf", { type: "application/pdf" })
        }
      />
    </LanguageProvider>,
  );
  const analyze = await screen.findByRole("button", {
    name: /analyze with ai/i,
  });
  await waitFor(() => expect(analyzeDocument).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(analyze.disabled).toBe(false));
  fireEvent.click(analyze);
  const importButton = await screen.findByRole(
    "button",
    { name: /Import Selected Fields/ },
    { timeout: 5000 },
  );
  // The dialog commits its buttons first and its rows, with their ticks, in
  // a later effect. Every test here goes on to use the rows.
  await screen.findAllByRole("checkbox");
  return importButton;
}

// Import is disabled until a row is ticked, and a click on a disabled button
// does nothing. Wait for the button the click needs, then for the alert,
// which the component raises only after every store write has finished.
async function clickImportAndWaitForSave(importButton) {
  await waitFor(() => expect(importButton.disabled).toBe(false));
  fireEvent.click(importButton);
  await waitFor(() => expect(window.alert).toHaveBeenCalled());
}

// The dialog also persists what the Muster Call reader found (its own parser,
// not the AI) through its own functions; these pick out the analyzer's saves.
const ownVkbDocument = () =>
  stores.addDocumentToVKB.mock.calls
    .map(([doc]) => doc)
    .find((doc) => "specialQualifications" in (doc.extractedData ?? {}));
const ownPacketDocument = () =>
  stores.saveDocumentToPacket.mock.calls
    .map(([saved]) => saved)
    .find((saved) => saved.aiAnalysis);

const ticked = () =>
  screen
    .getAllByRole("checkbox")
    .filter((box) => box.checked)
    .map((box) => box.getAttribute("aria-label"))
    .sort();

const AI_ONLY_KEYS = ["branch", "rank", "payGrade", "mos", "mosTitle"];

describe("a model reply that fills every field and a parser that fills three: the dialog", () => {
  it("pre-ticks exactly the three parser values", async () => {
    await readScan(PARSER_THREE_TEXT);
    expect(ticked()).toEqual([...PARSER_ROWS].sort());
  });

  it("shows the parser's value, never the model's, where they disagree", async () => {
    await readScan(PARSER_THREE_TEXT);
    expect(screen.getByDisplayValue("2002-03-05")).toBeTruthy();
    expect(screen.queryByDisplayValue("2003-02-02")).toBeNull();
    expect(screen.getByDisplayValue("2010-06-15")).toBeTruthy();
    expect(screen.queryByDisplayValue("2011-07-07")).toBeNull();
    expect(screen.getByDisplayValue("HONORABLE")).toBeTruthy();
    expect(screen.queryByDisplayValue("General")).toBeNull();
  });

  it("labels an AI-read value and leaves it unticked", async () => {
    await readScan(PARSER_THREE_TEXT);
    const rank = screen.getByRole("checkbox", { name: "Rank" });
    expect(rank.checked).toBe(false);
    const row = rank.closest(".rounded-lg.border");
    expect(row.textContent).toContain("Read by the AI");
    expect(row.textContent).toContain("Check it against your document");
    const start = screen.getByRole("checkbox", { name: "Service Start Date" });
    expect(start.closest(".rounded-lg.border").textContent).toContain(
      "Read from your document by the app's own parser",
    );
  });

  it("says how many values came from each source, in the dialog and on the card", async () => {
    await readScan(PARSER_THREE_TEXT);
    const inDialog = screen.getByTestId("import-source-counts").textContent;
    expect(inDialog).toContain("3 values read by the app's own parser");
    const aiPart = inDialog.slice(
      0,
      inDialog.indexOf(" values read by the AI"),
    );
    const aiCount = Number(aiPart.split(", ").pop());
    expect(aiCount).toBeGreaterThanOrEqual(10);

    fireEvent.click(screen.getByRole("button", { name: /Cancel Import/ }));
    const onCard = screen.getByTestId("dd214-source-counts").textContent;
    expect(onCard).toContain("3 values read by the app's own parser");
    expect(onCard).toContain(`${aiCount} values read by the AI`);
  });
});

describe("a model reply that fills every field and a parser that fills three: Import without touching anything", () => {
  beforeEach(async () => {
    const importButton = await readScan(PARSER_THREE_TEXT);
    await clickImportAndWaitForSave(importButton);
  });

  it("saves exactly those three to the profile", () => {
    const profile = getVeteranProfile();
    expect(profile.serviceStartDate).toBeTruthy();
    expect(profile.serviceEndDate).toBeTruthy();
    expect(profile.characterOfService).toMatch(/honorable/i);
    for (const key of [
      ...AI_ONLY_KEYS,
      "component",
      "dateOfRank",
      "separationType",
      "securityClearance",
    ]) {
      expect(profile[key], key).toBeFalsy();
    }
  });

  it("saves only those three to the service history record", () => {
    const record = getServiceHistory().dd214Data;
    expect(record.characterOfService).toMatch(/honorable/i);
    for (const key of AI_ONLY_KEYS) expect(record[key], key).toBeFalsy();
  });

  it("files only those three in the Knowledge Base", () => {
    const filed = ownVkbDocument().extractedData;
    expect(filed.entryDate).toBe("2002-03-05");
    for (const key of AI_ONLY_KEYS) expect(filed[key], key).toBeUndefined();
    expect(filed.education).toBeUndefined();
    expect(filed.awards).toEqual([]);
  });

  it("archives only those three, plus the form type, in My Packet", () => {
    const archived = ownPacketDocument();
    const keys = Object.keys(archived.extractedData).sort();
    expect(keys).toEqual(
      [
        "awards",
        "characterOfService",
        "entryDate",
        "formType",
        "separationDate",
      ].sort(),
    );
    expect(JSON.stringify(archived)).not.toMatch(/Navy|E-9|masterRecordDate/);
  });
});

describe("Import with no row ticked saves nothing", () => {
  it("leaves the Import button disabled after Select None", async () => {
    const importButton = await readScan(PARSER_THREE_TEXT);
    fireEvent.click(screen.getByRole("button", { name: /Select None/ }));
    expect(importButton.disabled).toBe(true);
    fireEvent.click(importButton);
    expect(window.alert).not.toHaveBeenCalled();
    expect(getServiceHistory().dd214Data).toBeNull();
    expect(stores.addDocumentToVKB).not.toHaveBeenCalled();
    expect(stores.saveDocumentToPacket).not.toHaveBeenCalled();
  });

  it("writes nothing even when the save functions are called with no ticks", async () => {
    const analysis = {
      branch: "Army",
      rank: "SGT",
      entryDate: "2002-03-05",
      separationDate: "2010-06-15",
      militaryEducation: ["Basic Leader Course"],
      awards: [{ name: "Army Achievement Medal" }],
    };
    _saveDd214ToProfile(analysis, "text", {}, {}, []);
    await _saveDd214ToVkb(analysis, "text", [], {});
    await _saveDd214ToPacket(analysis, "text", [], {});
    expect(getServiceHistory().dd214Data).toBeNull();
    expect(getServiceHistory().servicePeriods).toEqual([]);
    expect(getVeteranProfile().branch).toBeFalsy();
    expect(stores.addDocumentToVKB).not.toHaveBeenCalled();
    expect(stores.saveDocumentToPacket).not.toHaveBeenCalled();
  });
});

const SSN = "123-45-6789";
const FLATTENED_SCAN =
  "DD FORM 214 CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY " +
  "2. DEPARTMENT, COMPONENT AND BRANCH: ARMY/ACTIVE " +
  "13. DECORATIONS, MEDALS, BADGES: ARMY ACHIEVEMENT MEDAL //NOTHING FOLLOWS " +
  "14. MILITARY EDUCATION: BASIC LEADER COURSE 2010 42 SAMPLE AVENUE FAKETOWN OH 44444 " +
  `SOCIAL SECURITY NUMBER ${SSN} DATE OF BIRTH 19800101 ` +
  "18. REMARKS: SERVICE IN KUWAIT 20050101 - 20050601 42 SAMPLE AVENUE FAKETOWN OH 44444";
const LEAKS = /SAMPLE AVENUE|FAKETOWN|44444|123-45-6789|123456789|19800101/;

describe("a block the parser captured past its own box", () => {
  it("never reaches the screen, the import rows, My Packet or the Knowledge Base", async () => {
    generateAI.mockResolvedValue({ text: JSON.stringify({ branch: "Army" }) });
    await readScan(FLATTENED_SCAN);

    const rows = screen
      .getAllByRole("checkbox")
      .map((box) => box.closest(".rounded-lg.border")?.textContent ?? "");
    const inputs = screen
      .getAllByRole("textbox")
      .filter((input) => !input.id?.startsWith("dd214-identifier-"))
      .map((input) => input.value);
    expect(
      [document.body.textContent, ...rows, ...inputs].join("\n"),
    ).not.toMatch(LEAKS);

    fireEvent.click(screen.getByRole("button", { name: /Select All/ }));
    fireEvent.click(
      screen.getByRole("button", { name: /Import Selected Fields/ }),
    );
    await waitFor(() => expect(window.alert).toHaveBeenCalled());

    const kb = JSON.stringify([
      ownVkbDocument().extractedData,
      stores.mergeDD214IntoVKB.mock.calls
        .filter(([, , options]) => options?.vkbDocumentId)
        .map(([, data]) => data),
    ]);
    const archived = ownPacketDocument();
    const packet = JSON.stringify([
      archived.extractedData,
      archived.aiAnalysis,
    ]);
    // The Muster Call reader files the raw page text itself; only the
    // structured fields are checked here.
    const { extractedText: _rawText, ...structured } =
      getServiceHistory().dd214Data;
    const profile = JSON.stringify(structured);
    const kbSansIdentifiers = kb.replaceAll("6789", "");
    expect(kbSansIdentifiers).not.toMatch(LEAKS);
    expect(packet.replaceAll("6789", "")).not.toMatch(LEAKS);
    expect(profile).not.toMatch(LEAKS);
    expect(kb).toContain("BASIC LEADER COURSE");
  });
});

describe("a model value the veteran corrects and ticks", () => {
  beforeEach(() => {
    generateAI.mockResolvedValue({
      text: JSON.stringify({ payGrade: "E-9", reenlisted: true }),
    });
  });

  it("is stored in the corrected form everywhere", async () => {
    const importButton = await readScan(PARSER_THREE_TEXT);
    fireEvent.change(screen.getByDisplayValue("E-9"), {
      target: { value: "E-5" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Pay Grade" }));
    await clickImportAndWaitForSave(importButton);

    expect(getVeteranProfile().payGrade).toBe("E-5");
    expect(getServiceHistory().dd214Data.payGrade).toBe("E-5");
    expect(ownVkbDocument().extractedData.payGrade).toBe("E-5");
    expect(ownPacketDocument().extractedData.payGrade).toBe("E-5");
    expect(ownPacketDocument().aiAnalysis.payGrade).toBe("E-5");
    expect(stores.mergeDD214IntoVKB.mock.calls[0][1].payGrade).toBe("E-5");
  });

  it("labels the model-written Re-enlisted row and counts it", async () => {
    await readScan(PARSER_THREE_TEXT);
    const row = screen
      .getByRole("checkbox", { name: "Re-enlisted" })
      .closest(".rounded-lg.border");
    expect(row.textContent).toContain("Read by the AI");
    expect(screen.getByTestId("import-source-counts").textContent).toContain(
      "2 values read by the AI",
    );
  });
});
