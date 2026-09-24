/**
 * StateBenefitHunter defaults the state + combined VA rating from the
 * veteran's saved profile / My Ratings (using the same calculateVARating
 * util the Tactical Calculator uses), while leaving both fields editable
 * and leaving them blank when nothing is on file.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import StateBenefitHunter from "../../components/StateBenefitHunter.jsx";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import {
  updateVeteranProfile,
  saveMyRatings,
} from "../../utils/veteranProfile.js";

function renderHunter(props = {}) {
  return render(
    <LanguageProvider>
      <StateBenefitHunter onClose={() => {}} {...props} />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("StateBenefitHunter prefill from records", () => {
  it("defaults state and combined rating from the saved profile + My Ratings", () => {
    updateVeteranProfile({ state: "TX" });
    saveMyRatings([
      { name: "PTSD", bodyPart: "mental", rating: 70, side: "none" },
    ]);

    renderHunter();

    expect(screen.getByLabelText("Your State")).toHaveValue("TX");
    expect(screen.getByLabelText("Combined VA Rating")).toHaveValue("70");
    expect(
      screen.getByText(/we filled in your state and rating/i),
    ).toBeInTheDocument();
  });

  it("combines multiple ratings with VA math, not a raw sum", () => {
    saveMyRatings([
      { name: "PTSD", bodyPart: "mental", rating: 50, side: "none" },
      { name: "Tinnitus", bodyPart: "ear", rating: 30, side: "none" },
    ]);

    renderHunter();

    // combineTwoRatings(50, 30) = 65, rounded up to 70 per 38 CFR 4.25.
    expect(screen.getByLabelText("Combined VA Rating")).toHaveValue("70");
  });

  it("leaves both fields blank when no profile or ratings are on file", () => {
    renderHunter();

    expect(screen.getByLabelText("Your State")).toHaveValue("");
    expect(screen.getByLabelText("Combined VA Rating")).toHaveValue("");
    expect(
      screen.queryByText(/we filled in your state and rating/i),
    ).not.toBeInTheDocument();
  });

  it("keeps the prefilled fields editable", () => {
    updateVeteranProfile({ state: "TX" });
    saveMyRatings([
      { name: "PTSD", bodyPart: "mental", rating: 70, side: "none" },
    ]);

    renderHunter();

    fireEvent.change(screen.getByLabelText("Your State"), {
      target: { value: "CA" },
    });
    fireEvent.change(screen.getByLabelText("Combined VA Rating"), {
      target: { value: "90" },
    });

    expect(screen.getByLabelText("Your State")).toHaveValue("CA");
    expect(screen.getByLabelText("Combined VA Rating")).toHaveValue("90");
  });

  it("ignores an unrecognized saved state code", () => {
    updateVeteranProfile({ state: "ZZ" });

    renderHunter();

    expect(screen.getByLabelText("Your State")).toHaveValue("");
  });
});
