/**
 * D19-5 follow-up: InfoBanner's "on-device only" message used to always say
 * "Load an on-device AI to enable this", even for a cloud-configured veteran
 * for whom `SmartAILoadPrompt` (the actual load button, gated on
 * `!isAnyAIAvailable()`) is never rendered at all - the banner pointed at a
 * control that was never on screen. `aiAvailable` (the same
 * `isAnyAIAvailable()` result the real caller already computes) now decides
 * which "on-device only" message shows.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// BlueButtonXRay.jsx imports pdfjs-dist at module scope purely for its
// upload/OCR path - InfoBanner itself never touches it, but the import
// still runs whenever this file loads. pdfjs-dist's canvas backend reaches
// for `DOMMatrix`, which jsdom does not implement, so any import of this
// module in a test environment needs pdfjs-dist stubbed out.
vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  getDocument: vi.fn(),
}));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({
  default: "pdf.worker.min.mjs",
}));

vi.mock("../utils/unifiedAIService", () => ({
  generateAI: vi.fn(),
  isAnyAIAvailable: vi.fn(),
  getAIStatus: vi.fn(() => ({})),
  getDocumentAIRouting: vi.fn(),
}));

const { getDocumentAIRouting } = await import("../utils/unifiedAIService");
const { InfoBanner } = await import("./BlueButtonXRay.jsx");

describe("InfoBanner: on-device-only copy matches whether a load button is on screen", () => {
  it("shows the on-device AI-Powered message when an on-device engine is ready", () => {
    getDocumentAIRouting.mockReturnValue({ onDeviceReady: true });
    render(<InfoBanner aiAvailable={true} />);

    expect(
      screen.getByText(/Uses your on-device AI to intelligently extract/),
    ).toBeTruthy();
  });

  it("shows the load CTA when no AI at all is available (the load button IS on screen)", () => {
    getDocumentAIRouting.mockReturnValue({ onDeviceReady: false });
    render(<InfoBanner aiAvailable={false} />);

    expect(
      screen.getByText(/Load an on-device AI to enable this/),
    ).toBeTruthy();
  });

  it("does not show the load CTA when cloud is configured but on-device isn't ready (no load button is on screen)", () => {
    getDocumentAIRouting.mockReturnValue({ onDeviceReady: false });
    render(<InfoBanner aiAvailable={true} />);

    expect(
      screen.queryByText(/Load an on-device AI to enable this/),
    ).toBeNull();
    expect(screen.getByText(/Your configured AI is cloud-only/)).toBeTruthy();
  });
});
