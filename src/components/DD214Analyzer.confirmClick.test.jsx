/**
 * The real component, end to end: drop a scan, read it, run the analysis,
 * untick fields in the import dialog and click Import Selected Fields. What the
 * click writes is exactly what was ticked; an unticked service field, the name
 * and the date of birth never reach the profile. Extraction and the AI answer
 * are the only fakes; the import dialog, the profile (localStorage) and the
 * component are real. Fixture values are synthetic.
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
  saveDocumentToPacket: vi.fn(),
}));
vi.mock("../utils/veteranKnowledgeBase", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    addDocumentToVKB: stores.addDocumentToVKB,
    saveVKB: vi.fn().mockResolvedValue(undefined),
    loadVKB: vi.fn(async () => actual.initializeVKB()),
  };
});
vi.mock("../utils/myPacketManager", async (importOriginal) => ({
  ...(await importOriginal()),
  saveDocumentToPacket: stores.saveDocumentToPacket,
}));

const { analyzeDocument } = await import("../utils/documentAnalyzer");
const { generateAI } = await import("../utils/unifiedAIService");
const { getVeteranProfile } = await import("../utils/veteranProfile");
const { LanguageProvider } = await import("../contexts/LanguageContext");
const { default: DD214Analyzer } = await import("./DD214Analyzer.jsx");

const SCAN_TEXT = `--- PAGE 1 ---
DD FORM 214 CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY
1. NAME (LAST, FIRST, MIDDLE):
FAKETON, JORDAN ALEX
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY/ACTIVE
4A. GRADE, RATE OR RANK: SGT
5. DATE OF BIRTH: 19840315
12A. DATE ENTERED ACTIVE DUTY THIS PERIOD: 20020305
12B. SEPARATION DATE THIS PERIOD: 20100615
24. CHARACTER OF SERVICE: HONORABLE
`;
const MODEL_ANSWER = JSON.stringify({
  branch: "Army",
  rank: "SGT",
  mos: "11B",
  entryDate: "2002-03-05",
  separationDate: "2010-06-15",
  characterOfService: "Honorable",
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.alert = vi.fn();
  analyzeDocument.mockResolvedValue({
    text: SCAN_TEXT,
    pageCount: 1,
    method: "text",
    ocrUsed: false,
  });
  generateAI.mockResolvedValue({ text: MODEL_ANSWER });
  stores.addDocumentToVKB.mockResolvedValue({
    success: true,
    documentId: "d1",
  });
  stores.saveDocumentToPacket.mockResolvedValue({ success: true });
});

async function dropScanAndOpenImportDialog() {
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
  return screen.findByRole(
    "button",
    { name: /Import Selected Fields/ },
    { timeout: 5000 },
  );
}

const tick = (name) => screen.getByRole("checkbox", { name });

describe("clicking Import Selected Fields writes exactly what was ticked", () => {
  it("leaves unticked service fields, the name and the date of birth out of the profile", async () => {
    const importButton = await dropScanAndOpenImportDialog();
    expect(tick("Full Name").checked).toBe(false);
    expect(tick("Date of Birth").checked).toBe(false);
    expect(tick("Branch of Service").checked).toBe(true);
    ["Branch of Service", "Separation Date", "Character of Service"].forEach(
      (label) => fireEvent.click(tick(label)),
    );

    fireEvent.click(importButton);
    await waitFor(() => expect(window.alert).toHaveBeenCalled());

    const profile = getVeteranProfile();
    expect(profile.branch).toBeFalsy();
    expect(profile.serviceEndDate).toBeFalsy();
    expect(profile.characterOfService).toBeFalsy();
    expect(profile.mos).toBe("11B");
    expect(profile.serviceStartDate).toBeTruthy();
    expect(profile.fullName || profile.lastName).toBeFalsy();
    expect(profile.dateOfBirth).toBeFalsy();
    expect(profile.profileFieldSources?.branch).toBeUndefined();
  });

  it("files the name in the Knowledge Base only when its box was ticked", async () => {
    const importButton = await dropScanAndOpenImportDialog();
    fireEvent.click(importButton);
    await waitFor(() => expect(window.alert).toHaveBeenCalled());

    const filed = stores.addDocumentToVKB.mock.calls[0][0].extractedData;
    expect(filed.fullName).toBeUndefined();
    expect(filed.dateOfBirth).toBeUndefined();
    const packet = stores.saveDocumentToPacket.mock.calls
      .map(([saved]) => saved)
      .find((saved) => saved.aiAnalysis);
    expect(JSON.stringify(packet.extractedData)).not.toMatch(/faketon|1984/i);
    expect(JSON.stringify(packet.aiAnalysis)).not.toMatch(/faketon|1984/i);
  });
});
