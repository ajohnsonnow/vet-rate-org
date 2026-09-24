/**
 * MOSHazardMatcher auto-selects the veteran's own MOS on first open (the
 * same way clicking a "Popular searches" code does), reading the profile's
 * top-level mos/branch fields first and falling back to the most recently-
 * ended service period with an MOS on file. Only an exact code match
 * auto-selects; an unrecognized saved code is treated as nothing on file.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import MOSHazardMatcher from "../../components/MOSHazardMatcher.jsx";
import {
  updateVeteranProfile,
  addServicePeriod,
} from "../../utils/veteranProfile.js";

function renderMatcher(props = {}) {
  return render(<MOSHazardMatcher onClose={() => {}} {...props} />);
}

beforeEach(() => {
  localStorage.clear();
});

describe("MOSHazardMatcher prefill from records", () => {
  it("auto-selects the veteran's MOS from the profile, with a records banner", async () => {
    updateVeteranProfile({ mos: "11B", branch: "Army" });

    renderMatcher();

    expect(
      await screen.findByText(/we filled this in from your service record/i),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("11B")).toBeInTheDocument();
    expect(screen.getByText("Infantryman")).toBeInTheDocument();
  });

  it("falls back to the most recent service period's MOS when the profile has none", async () => {
    addServicePeriod({
      serviceStartDate: "2010-01-01",
      serviceEndDate: "2014-01-01",
      mos: "11B",
      branch: "Army",
    });

    renderMatcher();

    expect(await screen.findByDisplayValue("11B")).toBeInTheDocument();
  });

  it("leaves the search blank for an unrecognized saved MOS code", async () => {
    updateVeteranProfile({ mos: "ZZ999-NOT-REAL", branch: "Army" });

    renderMatcher();

    await screen.findByPlaceholderText(/enter your mos code/i);
    expect(screen.getByPlaceholderText(/enter your mos code/i)).toHaveValue("");
    expect(
      screen.queryByText(/we filled this in from your service record/i),
    ).not.toBeInTheDocument();
  });

  it("leaves the search blank when no service record is on file", async () => {
    renderMatcher();

    await screen.findByPlaceholderText(/enter your mos code/i);
    expect(screen.getByPlaceholderText(/enter your mos code/i)).toHaveValue("");
    expect(
      screen.queryByText(/we filled this in from your service record/i),
    ).not.toBeInTheDocument();
  });
});
