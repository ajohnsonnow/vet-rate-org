/**
 * Regression: "Load My Ratings" mapped saved ratings straight from
 * veteranProfile.js's schema ({ condition, rating, side }) into the
 * sandbox's internal shape without carrying the `side` field, and without
 * guarding against a malformed/missing `condition`. Bilateral pairs loaded
 * from real saved ratings never triggered the Bilateral Factor bonus (the
 * detector only recognizes "Left"/"Right" embedded in the name, which real
 * ratings don't do), and a saved rating with no `condition` string crashed
 * the whole modal with "Cannot read properties of undefined (reading
 * 'includes')" the moment hasMatchingConditionPair ran .name.includes(...)
 * on it.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "../contexts/LanguageContext";
import WhatIfSandbox from "./WhatIfSandbox";

afterEach(() => {
  localStorage.clear();
});

function renderSandbox() {
  return render(
    <LanguageProvider>
      <WhatIfSandbox onClose={() => {}} />
    </LanguageProvider>,
  );
}

describe("WhatIfSandbox - Load My Ratings", () => {
  it("detects a bilateral pair loaded from real saved ratings (side field, not name text)", async () => {
    localStorage.setItem(
      "vet_rate_my_ratings",
      JSON.stringify([
        { condition: "Knee Pain", rating: 10, side: "left" },
        { condition: "Knee Pain", rating: 10, side: "right" },
      ]),
    );

    renderSandbox();
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /load my ratings/i }));

    await waitFor(() =>
      expect(screen.getByText(/bilateral factor applied/i)).toBeInTheDocument(),
    );
  });

  it("does not crash on a malformed saved rating with no condition name", async () => {
    localStorage.setItem(
      "vet_rate_my_ratings",
      JSON.stringify([
        { condition: "Tinnitus", rating: 10, side: "none" },
        { rating: 20, side: "none" }, // malformed: no `condition`
      ]),
    );

    renderSandbox();
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /load my ratings/i }));

    // Modal survives, and only the valid entry was loaded.
    await waitFor(() =>
      expect(
        screen.getByText(/current scenario \(1 condition/i),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
