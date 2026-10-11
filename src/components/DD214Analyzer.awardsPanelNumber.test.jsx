/**
 * The results panel lists each award's name and devices; it must also show the
 * award number the review row and the save carry, in the same words. Award
 * names here are invented.
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
const { awardNumberText } = await import("../utils/dd214AwardRowText");

const t = (_section, key) => key;

describe("DD214AwardsSection award number", () => {
  const awards = [
    { name: "Sample Service Medal", deviceCount: 2, devices: [] },
    { name: "Sample Flight Medal", deviceCount: 0, devices: ["M Device"] },
    { name: "Sample Unit Citation", deviceCount: 12, devices: [] },
  ];

  it("shows each award's number in the review row's words", () => {
    render(<DD214AwardsSection analysisResult={{ awards }} t={t} />);
    expect(screen.getByText("2nd award")).toBeTruthy();
    expect(screen.getByText("12th award")).toBeTruthy();
    expect(awardNumberText(awards[0])).toBe("2nd award");
  });

  it("shows no number line for an award that printed none", () => {
    const { container } = render(
      <DD214AwardsSection analysisResult={{ awards }} t={t} />,
    );
    const flight = screen.getByText("Sample Flight Medal").closest("div");
    expect(flight.textContent).not.toMatch(/award$/);
    expect(container.textContent).toContain("M Device");
  });
});
