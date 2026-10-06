import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./BilateralIssuesSummary", () => ({ default: () => null }));

import TimeMachine from "./TimeMachine";

describe("Time Machine form fields show a visible focus indicator", () => {
  it.each([
    ["the Intent to File date", /When did you file your Intent to File/],
    ["the estimated rating select", /Estimated Combined Rating/],
  ])("%s", (_name, label) => {
    render(<TimeMachine onClose={() => {}} onReportBug={() => {}} />);
    const field = screen.getByLabelText(label);
    expect(field.className).toMatch(/focus-visible:ring-2/);
    expect(field.className).not.toMatch(/outline-none/);
  });
});
