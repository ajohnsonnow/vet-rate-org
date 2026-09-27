/**
 * An NGB-22 that prints no entry date gets one calculated (separation date
 * minus net service - musterCallProcessor.js's serviceStartDateDerived
 * flag). archiveDocumentInPacket stores that flag straight onto the VKB
 * document's extractedData, and packetSummary.js's "Entered service" scalar
 * finding carries it through as `derived`. The Documents tab must show it
 * as calculated rather than as if it were printed on the form.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { VaAuthProvider } from "../../contexts/VaAuthContext.jsx";
import {
  loadVKB,
  getAllDocumentsByCategory,
} from "../../utils/veteranKnowledgeBase.js";

vi.mock("../../utils/veteranKnowledgeBase.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, loadVKB: vi.fn(), getAllDocumentsByCategory: vi.fn() };
});

// MyPacket transitively imports pdfjs, which references canvas globals
// jsdom doesn't provide (same pattern as MyPacketCombinedRatingSummary.test.jsx).
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};
const { default: MyPacket } = await import("../../components/MyPacket.jsx");

function buildVkb(serviceStartDateDerived) {
  const dd214Doc = {
    id: "doc_1",
    fileName: "ngb22.pdf",
    uploadDate: "2026-07-30T18:04:11.000Z",
    classification: "NGB22",
    extractedData: {
      formType: "NGB22",
      branch: "Army National Guard",
      serviceStartDate: "2012-03-14",
      serviceStartDateDerived,
      separationDate: "2020-03-14",
    },
  };
  return {
    documentation: {
      dd214s: [dd214Doc],
      blueButtonReports: [],
      cFiles: [],
      privateRecords: [],
      otherEvidence: [],
    },
    serviceHistory: { separationDate: "2020-03-14" },
    medicalConditions: { current: [] },
    evidenceTimeline: [],
  };
}

function renderMyPacket() {
  return render(
    <LanguageProvider>
      <VaAuthProvider>
        <MyPacket onClose={() => {}} />
      </VaAuthProvider>
    </LanguageProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(cleanup);

describe("MyPacket Documents tab: calculated entry date marker", () => {
  it("marks an NGB-22's calculated entry date instead of showing it as printed", async () => {
    const vkb = buildVkb(true);
    loadVKB.mockResolvedValue(vkb);
    getAllDocumentsByCategory.mockResolvedValue(
      (
        await vi.importActual("../../utils/veteranKnowledgeBase.js")
      ).groupDocumentationByCategory(vkb),
    );

    renderMyPacket();
    fireEvent.click(await screen.findByText("Documents"));

    expect(
      await screen.findByText(/calculated from net service/),
    ).toBeInTheDocument();
  });

  it("shows no marker for a printed entry date", async () => {
    const vkb = buildVkb(false);
    loadVKB.mockResolvedValue(vkb);
    getAllDocumentsByCategory.mockResolvedValue(
      (
        await vi.importActual("../../utils/veteranKnowledgeBase.js")
      ).groupDocumentationByCategory(vkb),
    );

    renderMyPacket();
    fireEvent.click(await screen.findByText("Documents"));

    await screen.findByText("Entered service:");
    expect(
      screen.queryByText(/calculated from net service/),
    ).not.toBeInTheDocument();
  });
});
