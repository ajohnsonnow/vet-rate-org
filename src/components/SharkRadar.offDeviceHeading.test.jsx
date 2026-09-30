/**
 * ADR-009: Shark Radar's fallback-notice heading always said
 * "Keyword Analysis (No AI Loaded)", even when an off-device AI WAS
 * configured and simply couldn't see the pasted contract text - directly
 * contradicting the notice sentence shown right below it, which names that
 * very provider. DecisionDecoder already has a distinct "On-Device AI Only"
 * variant for the same case; Shark Radar didn't.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScanResults } from "./SharkRadar.jsx";

function baseData(overrides = {}) {
  return {
    risk_level: "LOW",
    score: 0,
    flags: [],
    positive_signs: [],
    verdict_summary: "",
    recommendation: "",
    _usedFallback: true,
    _fallbackNote: "some note",
    ...overrides,
  };
}

describe("ScanResults: fallback-notice heading matches the actual reason", () => {
  it("says 'No AI Loaded' when there really is no AI configured", () => {
    render(<ScanResults results={{ success: true, data: baseData() }} />);

    expect(screen.getByText("Keyword Analysis (No AI Loaded)")).toBeTruthy();
  });

  it("says 'On-Device AI Only' when an off-device AI IS configured but blocked", () => {
    render(
      <ScanResults
        results={{
          success: true,
          data: baseData({
            _fallbackNote:
              "Your documents are only read by the on-device AI, so this file was not sent to Cloud AI (Gemini).",
          }),
          offDeviceBlocked: true,
        }}
      />,
    );

    expect(
      screen.getByText("Keyword Analysis (On-Device AI Only)"),
    ).toBeTruthy();
    expect(screen.queryByText("Keyword Analysis (No AI Loaded)")).toBeNull();
  });
});
