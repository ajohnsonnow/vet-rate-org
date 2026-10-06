import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PresetSelector from "./PresetSelector";

describe("PresetSelector", () => {
  it("gives the preset select an accessible name from its visible label", () => {
    render(<PresetSelector value="LEGAL" onChange={() => {}} />);
    expect(
      screen.getByRole("combobox", { name: "AI Configuration Preset" }),
    ).toBeTruthy();
  });
});
