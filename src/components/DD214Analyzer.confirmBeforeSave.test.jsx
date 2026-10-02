/**
 * D21-4: dropping a scan into the DD-214 Analyzer wrote the name to the
 * profile and the name and DOB to the Knowledge Base before the veteran ticked
 * anything. Reading a scan now writes nothing; the veteran's confirmation in
 * the import dialog is what stores it, and name and DOB are never part of
 * that automatic write. Extraction is the only fake; the import itself, the
 * profile (localStorage) and the component are real. Fixture values are
 * synthetic.
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
const vkb = vi.hoisted(() => ({
  addDocumentToVKB: vi.fn(),
  saveVKB: vi.fn(),
  mergeDD214IntoVKB: vi.fn(),
  saveDocumentToPacket: vi.fn(),
}));
vi.mock("../utils/veteranKnowledgeBase", async (importOriginal) => ({
  ...(await importOriginal()),
  addDocumentToVKB: vkb.addDocumentToVKB,
  saveVKB: vkb.saveVKB,
  mergeDD214IntoVKB: vkb.mergeDD214IntoVKB,
  loadVKB: vi.fn().mockResolvedValue({ personal: {} }),
}));
vi.mock("../utils/myPacketManager", async (importOriginal) => ({
  ...(await importOriginal()),
  saveDocumentToPacket: vkb.saveDocumentToPacket,
}));

const { analyzeDocument } = await import("../utils/documentAnalyzer");
const { processFormationDocument } =
  await import("../utils/musterCallProcessor");
const { getVeteranProfile } = await import("../utils/veteranProfile");
const { LanguageProvider } = await import("../contexts/LanguageContext");
const { default: DD214Analyzer, _persistDeferredFormationResults } =
  await import("./DD214Analyzer.jsx");

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

const makeFile = () =>
  new File(["x"], "sample-dd214.pdf", { type: "application/pdf" });

function wholeStore() {
  return Array.from({ length: localStorage.length }, (_, i) =>
    localStorage.getItem(localStorage.key(i)),
  ).join("\n");
}

const IDENTIFIER_KEYS = [
  "veteranName",
  "fullName",
  "lastName",
  "firstName",
  "middleName",
  "dateOfBirth",
];

function expectNoStructuredIdentifiers(data) {
  IDENTIFIER_KEYS.forEach((key) => expect(data).not.toHaveProperty(key));
}

function expectNothingWritten() {
  expect(vkb.addDocumentToVKB).not.toHaveBeenCalled();
  expect(vkb.mergeDD214IntoVKB).not.toHaveBeenCalled();
  expect(vkb.saveVKB).not.toHaveBeenCalled();
  expect(vkb.saveDocumentToPacket).not.toHaveBeenCalled();
  expect(localStorage).toHaveLength(0);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  analyzeDocument.mockResolvedValue({
    text: SCAN_TEXT,
    pageCount: 1,
    method: "text",
    ocrUsed: false,
  });
  vkb.addDocumentToVKB.mockResolvedValue({ success: true, documentId: "d1" });
  vkb.saveVKB.mockResolvedValue(undefined);
  vkb.saveDocumentToPacket.mockResolvedValue({ success: true });
});

describe("D21-4: dropping a scan writes nothing until the veteran confirms", () => {
  it("leaves the profile and Knowledge Base untouched after the drop and after closing", async () => {
    const onClose = vi.fn();
    render(
      <LanguageProvider>
        <DD214Analyzer onClose={onClose} initialFile={makeFile()} />
      </LanguageProvider>,
    );

    await waitFor(() => expect(analyzeDocument).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /run ocr/i })).toBeNull(),
    );
    expectNothingWritten();

    fireEvent.click(screen.getAllByRole("button", { name: /close/i })[0]);
    expect(onClose).toHaveBeenCalled();
    expectNothingWritten();
    expect(wholeStore()).not.toMatch(/FAKETON|1984/);
  });
});

describe("D21-4: the processor's write options", () => {
  it("default (Muster Call) path still saves the name to the profile", async () => {
    await processFormationDocument(makeFile(), () => {});
    expect(getVeteranProfile().lastName).toBe("FAKETON");
    expect(vkb.addDocumentToVKB).toHaveBeenCalled();
  });

  it("deferPersist reads the scan and writes nothing", async () => {
    const result = await processFormationDocument(makeFile(), () => {}, {
      deferPersist: true,
    });
    expect(result.status).toBe("complete");
    expect(result.extractedData.lastName).toBe("FAKETON");
    expectNothingWritten();
  });

  it("omitIdentifiers saves the document without name or date of birth", async () => {
    const result = await processFormationDocument(makeFile(), () => {}, {
      omitIdentifiers: true,
    });
    expect(result.status).toBe("complete");
    expect(vkb.addDocumentToVKB).toHaveBeenCalled();
    const filed = vkb.addDocumentToVKB.mock.calls[0][0].extractedData;
    expect(filed.branch).toBeTruthy();
    expectNoStructuredIdentifiers(filed);
    const profile = getVeteranProfile();
    expect(profile.fullName || profile.lastName).toBeFalsy();
    expect(profile.dateOfBirth).toBeFalsy();
  });
});

describe("D21-4: confirming stores the service data but never the name or DOB", () => {
  it("persists a deferred read without any identifier", async () => {
    const deferredResult = await processFormationDocument(
      makeFile(),
      () => {},
      { deferPersist: true },
    );
    expectNothingWritten();

    await _persistDeferredFormationResults([
      { filename: "sample-dd214.pdf", deferredResult },
    ]);

    expect(vkb.addDocumentToVKB).toHaveBeenCalledTimes(1);
    const filed = vkb.addDocumentToVKB.mock.calls[0][0].extractedData;
    expect(filed.branch).toBeTruthy();
    expectNoStructuredIdentifiers(filed);
    const profile = getVeteranProfile();
    expect(profile.branch).toBeTruthy();
    expect(profile.fullName || profile.lastName).toBeFalsy();
    expect(profile.dateOfBirth).toBeFalsy();
  });

  it("does nothing for a pasted text with no scan", async () => {
    await _persistDeferredFormationResults([
      { filename: "x", deferredResult: null },
    ]);
    expectNothingWritten();
  });
});
