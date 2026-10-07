import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MobileBottomNavWrapper from "../../features/mobile-nav/MobileBottomNavWrapper";

vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({
    isDark: false,
    isTbiComfort: false,
    isAaaContrast: false,
  }),
}));

const saveRatings = (ratings) =>
  localStorage.setItem("vet_rate_my_ratings", JSON.stringify(ratings));

describe("MobileBottomNavWrapper badges", () => {
  afterEach(() => localStorage.clear());

  it("shows the combined VA rating and the saved-rating count, not the highest single rating", () => {
    saveRatings([
      { name: "PTSD", rating: 50, side: "none" },
      { name: "Radiculopathy, left lower extremity", rating: 20, side: "left" },
      {
        name: "Radiculopathy, right lower extremity",
        rating: 10,
        side: "right",
      },
    ]);
    render(<MobileBottomNavWrapper userConditions={[]} />);

    const calculator = screen.getByRole("button", { name: "Calculator" });
    const packet = screen.getByRole("button", { name: "My Packet" });
    expect(calculator).toHaveTextContent("70%");
    expect(packet).toHaveTextContent("3");
  });

  it("falls back to the session's conditions when nothing is saved", () => {
    render(
      <MobileBottomNavWrapper
        userConditions={[{ name: "Tinnitus", rating: 10, side: "none" }]}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Calculator" }),
    ).toHaveTextContent("10%");
  });

  it("shows no badges for a veteran with no ratings yet", () => {
    render(<MobileBottomNavWrapper userConditions={[]} />);
    expect(
      screen.getByRole("button", { name: "Calculator" }),
    ).not.toHaveTextContent("%");
  });
});
