/**
 * Fail closed on store errors (ADR-009): when the profile, the service
 * history, the knowledge base or My Packet cannot be read to build the
 * known-identifier set, nothing the model wrote for that reading (dates and
 * free text included) is shown, and the veteran is told plainly that only the
 * values the app read itself are shown. Each store read is made to reject in
 * turn. Fixture values are synthetic.
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
const reads = vi.hoisted(() => ({
  getVeteranProfile: vi.fn(),
  getServiceHistory: vi.fn(),
  loadVKB: vi.fn(),
  getAllExtractedData: vi.fn(),
}));
vi.mock("../utils/veteranProfile", async (importOriginal) => {
  const actual = await importOriginal();
  reads.getVeteranProfile.mockImplementation(actual.getVeteranProfile);
  reads.getServiceHistory.mockImplementation(actual.getServiceHistory);
  return {
    ...actual,
    getVeteranProfile: reads.getVeteranProfile,
    getServiceHistory: reads.getServiceHistory,
  };
});
vi.mock("../utils/veteranKnowledgeBase", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    addDocumentToVKB: vi.fn().mockResolvedValue({ documentId: "d1" }),
    saveVKB: vi.fn().mockResolvedValue(undefined),
    loadVKB: reads.loadVKB,
  };
});
vi.mock("../utils/myPacketManager", async (importOriginal) => ({
  ...(await importOriginal()),
  saveDocumentToPacket: vi.fn().mockResolvedValue({ success: true }),
  getAllExtractedData: reads.getAllExtractedData,
}));

const { analyzeDocument } = await import("../utils/documentAnalyzer");
const { generateAI } = await import("../utils/unifiedAIService");
const { LanguageProvider } = await import("../contexts/LanguageContext");
const { default: DD214Analyzer, STORE_READ_FAILED_NOTICE } =
  await import("./DD214Analyzer.jsx");

const SCAN_TEXT = `--- PAGE 1 ---
DD FORM 214 CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY
12A. DATE ENTERED ACTIVE DUTY THIS PERIOD: 20020305
12B. SEPARATION DATE THIS PERIOD: 20100615
`;
const MODEL_ANSWER = JSON.stringify({
  branch: "Army",
  rank: "SGT",
  entryDate: "2003-02-02",
  dateOfRank: "2005-01-01",
  masterRecordDate: "1984-03-15",
  narrativeReason: "Completion of required service",
  militaryEducation: ["Basic Leader Course"],
  extractionNotes: ["Unit as read by the AI"],
});
const MODEL_TEXT = "Completion of required service";

async function analyse(failRead) {
  analyzeDocument.mockResolvedValue({
    text: SCAN_TEXT,
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
  failRead?.();
  fireEvent.click(analyze);
  await screen.findByRole(
    "button",
    { name: /Import Selected Fields/ },
    { timeout: 5000 },
  );
}

const FAILING_READS = [
  [
    "profile",
    () =>
      reads.getVeteranProfile.mockImplementationOnce(() => {
        throw new Error("profile read failed");
      }),
  ],
  [
    "service history",
    () =>
      reads.getServiceHistory.mockImplementationOnce(() => {
        throw new Error("service history read failed");
      }),
  ],
  [
    "knowledge base",
    () => reads.loadVKB.mockRejectedValueOnce(new Error("kb read failed")),
  ],
  [
    "My Packet",
    () =>
      reads.getAllExtractedData.mockRejectedValueOnce(
        new Error("packet read failed"),
      ),
  ],
];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.alert = vi.fn();
  generateAI.mockResolvedValue({ text: MODEL_ANSWER });
  reads.loadVKB.mockResolvedValue({ personal: {} });
  reads.getAllExtractedData.mockResolvedValue({ dd214s: [] });
});

describe("with every store readable", () => {
  it("shows the model's dates and text, labelled and unticked, and no notice", async () => {
    await analyse();
    expect(screen.getByDisplayValue(MODEL_TEXT)).toBeTruthy();
    expect(screen.getByDisplayValue("2005-01-01")).toBeTruthy();
    expect(screen.queryByText(STORE_READ_FAILED_NOTICE)).toBeNull();
  });
});

describe.each(FAILING_READS)("when the %s read rejects", (_store, failRead) => {
  it("drops every model-written date and all model text and says so plainly", async () => {
    await analyse(failRead);
    expect(screen.getByText(STORE_READ_FAILED_NOTICE)).toBeTruthy();
    expect(STORE_READ_FAILED_NOTICE).toContain(
      "only the values the app read itself are shown",
    );

    const shown = [
      document.body.textContent,
      ...screen.getAllByRole("textbox").map((box) => box.value),
    ].join("\n");
    for (const modelWritten of [
      "2005-01-01",
      "2003-02-02",
      "1984-03-15",
      MODEL_TEXT,
      "Basic Leader Course",
      "Unit as read by the AI",
    ]) {
      expect(shown, modelWritten).not.toContain(modelWritten);
    }
    expect(screen.queryByDisplayValue("SGT")).toBeNull();
    expect(screen.getByDisplayValue("2002-03-05")).toBeTruthy();
    expect(screen.getByTestId("import-source-counts").textContent).toContain(
      "0 values read by the AI",
    );
  });
});
