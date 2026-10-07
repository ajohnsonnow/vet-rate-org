/**
 * WCAG 2.2: DecisionDecoder's "On-Device AI Only" notice had no role/aria-live
 * (a screen-reader user was never told why they got a parser result instead
 * of an AI one - 4.1.3) and its body text (text-amber-600 on bg-amber-50,
 * ~3.07:1) failed the 4.5:1 AA minimum for small text (1.4.3). Fixed to
 * role="status" and text-amber-700 (~4.85:1).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../utils/ocr", () => ({
  analyzePDF: vi.fn(),
  analyzeImage: vi.fn(),
  OCR_STATES: {},
  formatFileSize: (bytes) => `${bytes} bytes`,
  isImageFile: () => false,
  isPDFFile: () => false,
}));
vi.mock("../utils/aiStatementHelper", () => ({
  decodeDecision: vi.fn(),
  isAIAvailable: () => false,
}));

const { OffDeviceFallbackNotice } = await import("./DecisionDecoder.jsx");

const results = {
  _usedFallback: true,
  _fallbackReason: "off_device_blocked",
  _fallbackNote: "Your documents are only read by the on-device AI.",
};

describe("OffDeviceFallbackNotice: accessibility", () => {
  it("is announced to assistive tech via role=status", () => {
    render(<OffDeviceFallbackNotice results={results} />);

    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("uses the AA-passing amber-700 shade, not the failing amber-600", () => {
    render(<OffDeviceFallbackNotice results={results} />);

    const notice = screen.getByText(results._fallbackNote);
    expect(notice.className).toContain("text-amber-700");
    expect(notice.className).not.toContain("text-amber-600");
  });
});
