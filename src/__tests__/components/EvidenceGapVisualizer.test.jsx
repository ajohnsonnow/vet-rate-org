/**
 * EvidenceGapVisualizer offers the veteran's own rated conditions (My
 * Ratings) and saved claims as one-click quick-picks instead of manual
 * dropdown entry each time. A rated condition's chip suggests the next
 * rating tier above its current percentage; a saved claim with no rating on
 * file falls back to the same default a manual pick would get. Nothing not
 * covered by the evidence-requirements schema shows up as a pick, and
 * clicking never happens automatically - the veteran always chooses.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EvidenceGapVisualizer from "../../components/EvidenceGapVisualizer.jsx";
import { saveMyRatings } from "../../utils/veteranProfile.js";
import { saveClaim } from "../../utils/claimsStorage.js";

function renderVisualizer(props = {}) {
  return render(<EvidenceGapVisualizer onClose={() => {}} {...props} />);
}

beforeEach(() => {
  localStorage.clear();
});

describe("EvidenceGapVisualizer quick-picks from records", () => {
  it("offers a rated condition as a quick-pick suggesting the next rating tier", () => {
    saveMyRatings([
      { name: "PTSD", bodyPart: "mental", rating: 30, side: "none" },
    ]);

    renderVisualizer();

    expect(
      screen.getByRole("button", { name: /PTSD \(30% → try 50%\)/i }),
    ).toBeInTheDocument();
  });

  it("offers a saved claim (no rating yet) as a quick-pick with a default target", () => {
    saveClaim({ conditionName: "Tinnitus" });

    renderVisualizer();

    expect(
      screen.getByRole("button", { name: /Tinnitus → target/i }),
    ).toBeInTheDocument();
  });

  it("loads the selected condition and target rating on click, without wiping evidence checklist state until then", () => {
    saveMyRatings([
      { name: "Tinnitus", bodyPart: "ear", rating: 0, side: "none" },
    ]);

    renderVisualizer();

    const conditionSelect = screen.getAllByRole("combobox")[0];
    expect(conditionSelect).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: /Tinnitus/i }));

    expect(conditionSelect).toHaveValue("tinnitus");
  });

  it("matches a real, fully-worded VA letter condition name to its short evidence-schema key (regression D4)", () => {
    saveMyRatings([
      {
        name: "Post-traumatic stress disorder (formerly evaluated as panic disorder without agoraphobia and depressive disorder not otherwise specified (NOS))",
        bodyPart: "mental",
        rating: 50,
        side: "none",
      },
    ]);

    renderVisualizer();

    expect(
      screen.getByRole("button", { name: /PTSD \(50% → try 70%\)/i }),
    ).toBeInTheDocument();
  });

  it("matches a real lumbar-spine letter condition name via the back/spine alias group (regression D4)", () => {
    saveMyRatings([
      {
        name: "lumbosacral strain, degenerative disc disease (previously rated as lumbago) (claimed as low back condition)",
        bodyPart: "other",
        rating: 20,
        side: "none",
      },
    ]);

    renderVisualizer();

    expect(
      screen.getByRole("button", { name: /Lumbar Strain/i }),
    ).toBeInTheDocument();
  });

  it("shows no quick-picks when nothing on file matches the evidence schema", () => {
    saveMyRatings([
      {
        name: "Some Totally Unmapped Condition",
        bodyPart: "other",
        rating: 20,
        side: "none",
      },
    ]);

    renderVisualizer();

    expect(
      screen.queryByText(/from your records — one click to load/i),
    ).not.toBeInTheDocument();
  });

  it("shows no quick-picks when no records are on file, and respects an initialCondition prop", () => {
    renderVisualizer({ initialCondition: "sleep_apnea", initialRating: 50 });

    expect(
      screen.queryByText(/from your records — one click to load/i),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("combobox")[0]).toHaveValue("sleep_apnea");
  });
});
