/**
 * BDDBuilder pre-fills the separation date (and branch) from the veteran's
 * own service record - the profile's serviceEndDate/branch fields first,
 * falling back to the most recently-ended service period - so the BDD
 * 90-180-day window calculation runs immediately instead of requiring the
 * setup screen. Any already-saved BDD progress always wins over the
 * records default.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  it("keeps the records banner across a re-open, not just the first render (regression D7)", async () => {
    updateVeteranProfile({ serviceEndDate: futureDate(100), branch: "Army" });

    const first = renderBDDBuilder();
    await screen.findByText(/we filled in your separation date/i);
    // Let the autosave effect (which used to drop the provenance flag) run,
    // the way a real re-open would see it.
    await new Promise((resolve) => setTimeout(resolve, 0));
    first.unmount();

    renderBDDBuilder();

    expect(
      await screen.findByText(/we filled in your separation date/i),
    ).toBeInTheDocument();
  });

  it("stops showing the records banner once the veteran edits the separation date (regression D7)", async () => {
    updateVeteranProfile({ serviceEndDate: futureDate(100), branch: "Army" });

    const first = renderBDDBuilder();
    await screen.findByText(/we filled in your separation date/i);

    fireEvent.click(screen.getByRole("button", { name: /change date/i }));
    fireEvent.change(screen.getByLabelText(/separation or ets date/i), {
      target: { value: futureDate(120) },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /launch bdd builder/i }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    first.unmount();

    renderBDDBuilder();

    await screen.findByText(/days until separation/i);
    expect(
      screen.queryByText(/we filled in your separation date/i),
    ).not.toBeInTheDocument();
  });
});
