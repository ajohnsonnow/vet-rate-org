/**
 * BDDBuilder pre-fills the separation date (and branch) from the veteran's
 * own service record - the profile's serviceEndDate/branch fields first,
 * falling back to the most recently-ended service period - so the BDD
 * 90-180-day window calculation runs immediately instead of requiring the
 * setup screen. Any already-saved BDD progress always wins over the
 * records default.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import BDDBuilder from "../../components/BDDBuilder.jsx";
import {
  updateVeteranProfile,
  addServicePeriod,
} from "../../utils/veteranProfile.js";
import { saveBDDProgress } from "../../utils/bddData.js";

function renderBDDBuilder(props = {}) {
  return render(<BDDBuilder onClose={() => {}} {...props} />);
}

function futureDate(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

beforeEach(() => {
  localStorage.clear();
});

describe("BDDBuilder prefill from records", () => {
  it("skips the setup screen using the profile's separation date, with a records banner", async () => {
    updateVeteranProfile({ serviceEndDate: futureDate(100), branch: "Army" });

    renderBDDBuilder();

    expect(
      await screen.findByText(/we filled in your separation date/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/enter your anticipated discharge/i),
    ).not.toBeInTheDocument();
  });

  it("falls back to the most recent service period's end date when the profile has none", async () => {
    addServicePeriod({
      serviceStartDate: "2015-01-01",
      serviceEndDate: futureDate(100),
      branch: "Navy",
    });

    renderBDDBuilder();

    expect(
      await screen.findByText(/we filled in your separation date/i),
    ).toBeInTheDocument();
  });

  it("shows the normal setup screen with no records banner when nothing is on file", async () => {
    renderBDDBuilder();

    expect(
      await screen.findByText(/enter your anticipated discharge/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/we filled in your separation date/i),
    ).not.toBeInTheDocument();
  });

  it("never overwrites an already-saved BDD separation date with the records default", async () => {
    saveBDDProgress({ separationDate: "2027-06-15", branch: "navy" });
    updateVeteranProfile({ serviceEndDate: futureDate(100), branch: "Army" });

    renderBDDBuilder();

    await screen.findByText(/days until separation/i);
    expect(
      screen.queryByText(/we filled in your separation date/i),
    ).not.toBeInTheDocument();
  });
});
