/**
 * D21-4: the Blue Button X-Ray filed the whole health record in the Knowledge
 * Base the moment AI Scan was clicked, with no confirmation. Scanning now
 * writes nothing; only the explicit Save to My Packet button stores it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  getDocument: vi.fn(),
}));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({
  default: "pdf.worker.min.mjs",
}));
vi.mock("../utils/unifiedAIService", async (importOriginal) => ({
  ...(await importOriginal()),
  generateAI: vi.fn(),
  isAnyAIAvailable: vi.fn(() => true),
  getAIStatus: vi.fn(() => ({})),
  getDocumentAIRouting: vi.fn(() => ({
    onDeviceReady: false,
    blockedProviderLabel: "cloud",
  })),
}));
const store = vi.hoisted(() => ({
  addDocumentToVKB: vi.fn(),
  saveDocumentToPacket: vi.fn(),
}));
vi.mock("../utils/veteranKnowledgeBase", () => ({
  addDocumentToVKB: store.addDocumentToVKB,
}));
vi.mock("../utils/myPacketManager", async (importOriginal) => ({
  ...(await importOriginal()),
  saveDocumentToPacket: store.saveDocumentToPacket,
}));

const { default: BlueButtonXRay } = await import("./BlueButtonXRay.jsx");

const REPORT = `Blue Button health record. Problem list: hypertension, tinnitus,
sleep apnea, lumbar strain. Diagnosis: migraine. ${"Visit note. ".repeat(20)}`;

beforeEach(() => {
  vi.clearAllMocks();
  store.addDocumentToVKB.mockResolvedValue({ success: true });
  store.saveDocumentToPacket.mockResolvedValue({ success: true });
});

async function uploadReport() {
  const { container } = render(<BlueButtonXRay onClose={vi.fn()} />);
  const input = container.ownerDocument.querySelector('input[type="file"]');
  fireEvent.change(input, {
    target: {
      files: [new File([REPORT], "report.txt", { type: "text/plain" })],
    },
  });
}

describe("D21-4: Blue Button X-Ray stores nothing until the veteran asks", () => {
  it("AI Scan reads the record and writes nothing", async () => {
    await uploadReport();
    fireEvent.click(
      await screen.findByRole("button", { name: /AI Scan for Diagnoses/i }),
    );
    await waitFor(() =>
      expect(screen.getByText(/was not sent to/i)).toBeTruthy(),
    );
    expect(store.addDocumentToVKB).not.toHaveBeenCalled();
    expect(store.saveDocumentToPacket).not.toHaveBeenCalled();
  });

  it("Save to My Packet is what files the record", async () => {
    await uploadReport();
    const buttons = await screen.findAllByRole("button", {
      name: /Save to My Packet/i,
    });
    fireEvent.click(buttons[0]);
    await waitFor(() =>
      expect(store.addDocumentToVKB).toHaveBeenCalledTimes(1),
    );
  });
});
