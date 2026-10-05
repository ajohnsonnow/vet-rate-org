import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { checkBilateralFactorCompliance } from "../utils/vaCalculator";
import {
  BilateralCheckCard,
  buildRetroPayAlerts,
  formatBilateralPromptBlock,
  bilateralSaveFields,
} from "./RetroPayHunter";

const knees = checkBilateralFactorCompliance([
  { name: "Left knee", rating: 10, side: "left", bodyPart: "knee" },
  { name: "Right knee", rating: 10, side: "right", bodyPart: "knee" },
]);
const none = checkBilateralFactorCompliance([
  { name: "PTSD", rating: 50, side: "none", bodyPart: "mental" },
]);

describe("RetroPayHunter presents the bilateral factor as something to check", () => {
  it("titles the card as a check, not a finding", () => {
    render(<BilateralCheckCard bilateralCheck={knees} />);
    expect(
      screen.getByRole("heading", {
        name: "Check that the bilateral factor was applied",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/not applied/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/issue/i)).not.toBeInTheDocument();
  });

  it("uses a neutral title when no factor applies", () => {
    render(<BilateralCheckCard bilateralCheck={none} />);
    expect(
      screen.getByRole("heading", { name: "Bilateral factor" }),
    ).toBeInTheDocument();
  });

  it("keeps the bilateral check out of the issues list", () => {
    expect(buildRetroPayAlerts()).toEqual([]);
  });

  it("gives the AI a block that says to check, with no issue or CUE wording", () => {
    const block = formatBilateralPromptBlock(knees);
    expect(block).toContain("Left knee, Right knee");
    expect(block).toContain("has not been checked");
    expect(block).not.toMatch(/issue|CUE|error|detected/i);
    expect(formatBilateralPromptBlock(none)).toBe("");
    expect(formatBilateralPromptBlock(null)).toBe("");
  });

  it("stores a neutrally named flag", () => {
    expect(bilateralSaveFields(knees)).toEqual({
      bilateralFactorApplies: true,
    });
    expect(bilateralSaveFields(null)).toEqual({
      bilateralFactorApplies: false,
    });
  });
});
