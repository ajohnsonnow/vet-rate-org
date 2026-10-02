/**
 * D21-4: the C-File Analyzer has no import dialog, so reading the file must
 * never write the veteran's name or date of birth to the profile or the
 * Knowledge Base. Extraction is the only fake; the import and the profile
 * (localStorage) are real. Fixture values are synthetic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

vi.mock("../utils/documentAnalyzer", async (importOriginal) => ({
  ...(await importOriginal()),
  analyzeDocument: vi.fn(),
}));
const store = vi.hoisted(() => ({ addDocumentToVKB: vi.fn() }));
vi.mock("../utils/veteranKnowledgeBase", async (importOriginal) => ({
  ...(await importOriginal()),
  addDocumentToVKB: store.addDocumentToVKB,
  saveVKB: vi.fn().mockResolvedValue(undefined),
  loadVKB: vi.fn().mockResolvedValue({ personal: {} }),
}));
vi.mock("../utils/myPacketManager", async (importOriginal) => ({
  ...(await importOriginal()),
  saveDocumentToPacket: vi.fn().mockResolvedValue({ success: true }),
}));

const { analyzeDocument } = await import("../utils/documentAnalyzer");
const { getVeteranProfile } = await import("../utils/veteranProfile");
const { _extractTextForAnalysis } = await import("./CFileAnalyzer.jsx");

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
${"Service treatment record page text. ".repeat(10)}
`;

const ctx = () => ({
  setExtractionProgress: vi.fn(),
  setProcessingStage: vi.fn(),
  setError: vi.fn(),
  setIsProcessing: vi.fn(),
  setExtractedText: vi.fn(),
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  analyzeDocument.mockResolvedValue({
    text: SCAN_TEXT,
    pageCount: 1,
    method: "text",
    ocrUsed: false,
  });
  store.addDocumentToVKB.mockResolvedValue({ success: true, documentId: "d1" });
});

describe("D21-4: reading a C-File never stores the name or date of birth", () => {
  it("files the document and service data without any identifier", async () => {
    const result = await _extractTextForAnalysis(
      new File(["x"], "sample-dd214.pdf", { type: "application/pdf" }),
      ctx(),
      {},
    );

    expect(result.hasText).toBe(true);
    expect(store.addDocumentToVKB).toHaveBeenCalledTimes(1);
    const filed = store.addDocumentToVKB.mock.calls[0][0].extractedData;
    expect(filed.branch).toBeTruthy();
    [
      "veteranName",
      "lastName",
      "firstName",
      "middleName",
      "dateOfBirth",
    ].forEach((key) => expect(filed).not.toHaveProperty(key));
    const profile = getVeteranProfile();
    expect(profile.branch).toBeTruthy();
    expect(profile.fullName || profile.lastName).toBeFalsy();
    expect(profile.dateOfBirth).toBeFalsy();
  });
});
