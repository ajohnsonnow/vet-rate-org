/**
 * NexusBuilder cold-open condition picker: when opened without a `condition`
 * prop, it should offer the veteran's rated conditions (getMyRatings) and
 * saved claims (getSavedClaims) as one-click choices instead of rendering
 * the wizard against a blank condition. A prop-supplied condition must
 * never be overwritten by records-derived choices.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NexusBuilder from "../../components/NexusBuilder.jsx";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { saveMyRatings } from "../../utils/veteranProfile.js";
import { saveClaim } from "../../utils/claimsStorage.js";

function renderNexusBuilder(props = {}) {
  return render(
    <LanguageProvider>
      <NexusBuilder onClose={() => {}} onSave={() => {}} {...props} />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("NexusBuilder cold-open condition picker", () => {
  it("renders the wizard directly for a prop-supplied condition, ignoring any saved records", () => {
    saveMyRatings([
      { name: "PTSD", bodyPart: "mental", rating: 70, side: "none" },
    ]);

    renderNexusBuilder({ condition: "Tinnitus" });

    expect(
      screen.queryByText(/which condition is this statement for/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Tinnitus")).toBeInTheDocument();
  });

  it("offers My Ratings and saved claims as one-click choices when opened cold", () => {
    saveMyRatings([
      { name: "PTSD", bodyPart: "mental", rating: 70, side: "none" },
    ]);
    saveClaim({ conditionName: "Tinnitus", selectedRating: 10 });

    renderNexusBuilder();

    expect(
      screen.getByText(/which condition is this statement for/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /PTSD/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Tinnitus/ }),
    ).toBeInTheDocument();
  });

  it("proceeds to the wizard for the picked condition on click", () => {
    saveMyRatings([
      { name: "PTSD", bodyPart: "mental", rating: 70, side: "none" },
    ]);

    renderNexusBuilder();

    fireEvent.click(screen.getByRole("button", { name: /PTSD/ }));

    expect(
      screen.queryByText(/which condition is this statement for/i),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("PTSD").length).toBeGreaterThan(0);
  });

  it("does not duplicate a condition tracked in both My Ratings and saved claims", () => {
    saveMyRatings([
      { name: "PTSD", bodyPart: "mental", rating: 70, side: "none" },
    ]);
    saveClaim({ conditionName: "PTSD", selectedRating: 70 });

    renderNexusBuilder();

    expect(screen.getAllByRole("button", { name: /^PTSD/ })).toHaveLength(1);
  });

  it("picking a saved claim with a parentCondition opens the 4-step secondary wizard, not the 3-step direct one", () => {
    saveClaim({ conditionName: "Sleep Apnea", parentCondition: "PTSD" });

    renderNexusBuilder();

    fireEvent.click(screen.getByRole("button", { name: /sleep apnea/i }));

    expect(screen.getByText(/step 1 of 4/i)).toBeInTheDocument();
    expect(screen.getByText(/secondary to/i)).toBeInTheDocument();
  });

  it("picking a My Ratings choice (no parentCondition) opens the 3-step direct wizard", () => {
    saveMyRatings([
      { name: "PTSD", bodyPart: "mental", rating: 70, side: "none" },
    ]);

    renderNexusBuilder();

    fireEvent.click(screen.getByRole("button", { name: /^PTSD/ }));

    expect(screen.getByText(/step 1 of 3/i)).toBeInTheDocument();
    expect(screen.queryByText(/secondary to/i)).not.toBeInTheDocument();
  });

  it("falls back to manual entry with no records and no prop condition", () => {
    renderNexusBuilder();

    expect(
      screen.getByText(/didn.t find any saved ratings or claims yet/i),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/type a condition name/i), {
      target: { value: "Sleep Apnea" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(screen.getAllByText("Sleep Apnea").length).toBeGreaterThan(0);
  });
});
