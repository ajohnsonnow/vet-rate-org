/**
 * The results-panel awards list scrolls when it overflows (max-h-48) but was
 * not focusable, so a keyboard user could not scroll it. It is a named,
 * focusable region, the same pattern as the review dialog's long-awards
 * disclosure. Award names here are invented.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../utils/documentAnalyzer", () => ({
  OCR_STATES: {},
  getProgressStyling: () => ({}),
  formatFileSize: (bytes) => `${bytes} bytes`,
  isFileSupported: () => true,
  getAcceptString: () => "",
}));
vi.mock("../utils/musterCallProcessor", () => ({
  processFormationDocument: vi.fn(),
  PROCESSING_STATES: { EXTRACTING: "EXTRACTING", COMPLETE: "COMPLETE" },
}));
vi.mock("../utils/smolVLMService", () => ({
  smolVLMService: {},
  isSmolVLMSupported: () => false,
}));

const { DD214AwardsSection } = await import("./DD214Analyzer.jsx");

const t = (_ns, key) => (key === "awardsDecorations" ? "Awards" : key);
const awards = Array.from({ length: 12 }, (_, i) => ({
  name: `Sample Invented Medal ${i + 1}`,
}));

describe("DD214AwardsSection keyboard access", () => {
  it("exposes the scrollable list as a focusable, named region", () => {
    render(<DD214AwardsSection analysisResult={{ awards }} t={t} />);
    const region = screen.getByRole("region", { name: "Awards (12)" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region).toContainElement(
      screen.getByText("Sample Invented Medal 1"),
    );
    region.focus();
    expect(region).toHaveFocus();
  });

  it("renders nothing when there are no awards", () => {
    const { container } = render(
      <DD214AwardsSection analysisResult={{ awards: [] }} t={t} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
