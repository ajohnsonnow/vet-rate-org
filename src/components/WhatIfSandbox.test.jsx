/**
 * Regression: "Load My Ratings" mapped saved ratings straight from
 * veteranProfile.js's schema ({ name, rating, side, bodyPart }) into the
 * sandbox's internal shape without carrying the `side` field, and without
 * guarding against a malformed/missing `name`. Bilateral pairs loaded
 * from real saved ratings never triggered the Bilateral Factor bonus (the
 * detector only recognizes "Left"/"Right" embedded in the name, which real
 * ratings don't do), and a saved rating with no `name` string crashed
 * the whole modal with "Cannot read properties of undefined (reading
 * 'includes')" the moment hasMatchingConditionPair ran .name.includes(...)
 * on it.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "../contexts/LanguageContext";
import WhatIfSandbox from "./WhatIfSandbox";
import { saveMyRatings } from "../utils/veteranProfile";

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
    saveMyRatings([
      { name: "Knee strain", rating: 10, side: "left" },
      { name: "Knee strain", rating: 10, side: "right" },
    ]);

    renderSandbox();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /load my ratings/i }));

    expect(
      await screen.findByText(/bilateral factor applied/i),
    ).toBeInTheDocument();
  });

  it("does not crash on a malformed saved rating with no condition name", async () => {
    localStorage.setItem(
      "vet_rate_my_ratings",
      JSON.stringify([
        { name: "Tinnitus", rating: 10, side: "none" },
        { rating: 20, side: "none" }, // malformed: no `name`
      ]),
    );

    renderSandbox();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /load my ratings/i }));

    // Modal survives, and only the valid entry was loaded.
    expect(
      await screen.findByText(/current scenario \(1 condition/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("WhatIfSandbox reads saved ratings the way the calculator does", () => {
  it("loads ratings stored as text and leaves out one it cannot read: knees '10' + '10%' give 21, then 20", async () => {
    localStorage.setItem(
      "vet_rate_my_ratings",
      JSON.stringify([
        { name: "Knee strain", rating: "10", side: "left" },
        { name: "Knee strain", rating: "10%", side: "right" },
        { name: "Unreadable", rating: "severe", side: "none" },
      ]),
    );
    renderSandbox();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /load my ratings/i }));
    expect(
      await screen.findByText(/current scenario \(2 condition/i),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("combined-rating").textContent).toBe("20%"),
    );
    expect(screen.getByText(/bilateral factor applied/i)).toBeInTheDocument();
  });
});

describe("WhatIfSandbox follows the shared 38 CFR 4.26 rules", () => {
  const load = async (ratings) => {
    saveMyRatings(ratings);
    renderSandbox();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /load my ratings/i }));
    await screen.findByText(/current scenario \(\d+ condition/i);
  };
  const combined = () => screen.getByTestId("combined-rating").textContent;
  const indicator = () => screen.queryByText(/bilateral factor applied/i);

  it("pairs any two leg conditions on opposite sides: 30 + 30 give 51, plus 5.1 is 56, then 60", async () => {
    await load([
      { name: "Ankle strain", rating: 30, side: "left" },
      { name: "Hip strain", rating: 30, side: "right" },
    ]);
    await waitFor(() => expect(combined()).toBe("60%"));
    expect(indicator()).toBeInTheDocument();
    expect(
      screen.getByText(/Ankle strain \(Left\) and Hip strain \(Right\)/),
    ).toBeInTheDocument();
  });

  it("does not pair an arm with a leg: 40, 40, 20 give 64, 71, then 70", async () => {
    await load([
      { name: "Shoulder strain", rating: 40, side: "right" },
      { name: "Knee strain", rating: 40, side: "left" },
      { name: "Back", rating: 20, side: "none" },
    ]);
    await waitFor(() => expect(combined()).toBe("70%"));
    expect(indicator()).not.toBeInTheDocument();
  });

  it("drops the factor when it lowers the result: 90, 30, knees 10 + 10 give 95, then 100", async () => {
    await load([
      { name: "PTSD", rating: 90, side: "none" },
      { name: "Back", rating: 30, side: "none" },
      { name: "Knee strain", rating: 10, side: "left" },
      { name: "Knee strain", rating: 10, side: "right" },
    ]);
    await waitFor(() => expect(combined()).toBe("100%"));
    expect(indicator()).not.toBeInTheDocument();
  });

  it("pairs the library's left and right knee: 10 + 10 give 19, plus 1.9 is 21, then 20", async () => {
    renderSandbox();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    for (const name of [/Knee \(Left\).*10/i, /Knee \(Right\).*10/i]) {
      fireEvent.click(screen.getAllByRole("button", { name })[0]);
    }
    await waitFor(() => expect(combined()).toBe("20%"));
    expect(indicator()).toBeInTheDocument();
  });
});
