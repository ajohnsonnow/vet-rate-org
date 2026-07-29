import { describe, it, expect, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ClaimNavigator from "./ClaimNavigator";

afterEach(() => {
  localStorage.clear();
  document.body.classList.remove("modal-open");
});

describe("ClaimNavigator", () => {
  it("renders past the loading screen without crashing", async () => {
    render(<ClaimNavigator onClose={() => {}} />);
    await waitFor(() =>
      expect(screen.getByText("Claim Navigator")).toBeInTheDocument(),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows the empty-state dashboard when there are no stored claims", async () => {
    render(<ClaimNavigator onClose={() => {}} />);
    await waitFor(() =>
      expect(screen.getByText("Claim Navigator")).toBeInTheDocument(),
    );
    expect(screen.getAllByText(/New Claim/i).length).toBeGreaterThan(0);
  });
});
