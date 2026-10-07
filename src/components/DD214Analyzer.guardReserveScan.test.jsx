/**
 * Final24 D24-2 and D24-4: on a Guard/Reserve-era scan read in columns the
 * import dialog must not pre-tick a component the parser could not read from
 * box 2, must show Days Lost as the box's own NONE, and must show the
 * education, awards and narrative reason as the form's own words, not label
 * text and redaction marks. The real component, dialog and profile are used;
 * extraction text and the AI answer are the only fakes. Fixtures are
 * synthetic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import {
  COMPONENT_TOKEN,
  COURSE,
  GUARD_RESERVE_SCAN,
  REASON,
} from "../utils/dd214GuardReserveScan.fixture";

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
const { getVeteranProfile } = await import("../utils/veteranProfile");
const { LanguageProvider } = await import("../contexts/LanguageContext");
const { default: DD214Analyzer } = await import("./DD214Analyzer.jsx");

const MODEL_REPLY = JSON.stringify({
  documentCount: 1,
  documentTypes: ["DD214"],
  component: "RA",
  componentFull: "Regular Army",
  daysLost: 366,
  narrativeReason: "Completion of required service",
  militaryEducation: ["Basic Leader Course"],
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.alert = vi.fn();
  generateAI.mockResolvedValue({ text: MODEL_REPLY });
  stores.addDocumentToVKB.mockResolvedValue({
    success: true,
    documentId: "d1",
  });
  stores.saveDocumentToPacket.mockResolvedValue({ success: true });
});

async function readScan() {
  analyzeDocument.mockResolvedValue({
    text: GUARD_RESERVE_SCAN,
    pageCount: 1,
    method: "advanced_ocr",
    ocrUsed: true,
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

const rowOf = (name) =>
  screen.getByRole("checkbox", { name }).closest(".rounded-lg.border");
const rowValue = (name) => rowOf(name).querySelector("input[type=text]").value;

describe("the import dialog for a Guard/Reserve-era scan", () => {
  it("shows the Guard component unticked with a check note, never the regular one", async () => {
    await readScan();
    for (const name of ["Component", "Component (Full Name)"]) {
      expect(screen.getByRole("checkbox", { name }).checked, name).toBe(false);
      expect(rowOf(name).textContent, name).toContain(
        "Check this against your document",
      );
    }
    expect(screen.getByDisplayValue(COMPONENT_TOKEN)).toBeTruthy();
    expect(screen.getByDisplayValue("Army National Guard")).toBeTruthy();
    expect(screen.queryByDisplayValue("RA")).toBeNull();
    expect(screen.queryByDisplayValue("Regular Army")).toBeNull();
  });

  it("shows Days Lost as the box's own NONE, not 366 characters of page text", async () => {
    await readScan();
    expect(screen.getByDisplayValue("NONE")).toBeTruthy();
    expect(screen.queryByDisplayValue("366")).toBeNull();
  });

  it("shows education, awards and the reason as the form's words with no redaction", async () => {
    await readScan();
    expect(screen.getByDisplayValue(REASON)).toBeTruthy();
    expect(rowValue("Military Education")).toBe(COURSE);
    const awards = rowValue("Awards and Decorations");
    expect(awards).toContain("LIMA PURPLE HEART");
    expect(awards.split(";")).toHaveLength(12);
    expect(
      `${document.body.textContent}${rowValue("Military Education")}${awards}`,
    ).not.toContain("[REDACTED]");
    expect(document.body.textContent).not.toMatch(
      /ROM ACTIVE DUTY|RENDER FORM|AWARDED OR AUTHORIZED/,
    );
  });

  it("saves no component when Import is clicked without touching anything", async () => {
    const importButton = await readScan();
    await clickImportAndWaitForSave(importButton);
    const profile = getVeteranProfile();
    expect(profile.component).toBeFalsy();
    expect(profile.componentFull).toBeFalsy();
  });
});
