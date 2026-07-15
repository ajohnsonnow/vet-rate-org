import { describe, it, expect, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "../contexts/LanguageContext";
import TacticalCalculator from "./TacticalCalculator";

afterEach(() => {
  localStorage.clear();
  document.body.classList.remove("modal-open");
});

function renderCalculator(props = {}) {
  return render(
    <LanguageProvider>
      <TacticalCalculator
        onClose={() => {}}
        onReportBug={() => {}}
        capSimulatorResults={[]}
        onClearCapResults={() => {}}
        {...props}
      />
    </LanguageProvider>,
  );
}

describe("TacticalCalculator", () => {
  it("renders without crashing", async () => {
    renderCalculator();
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
  });

  it("lets a veteran add a condition and see it in the list", async () => {
    renderCalculator();
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    const bodyPartSelect = screen.getByLabelText(/body part/i);
    fireEvent.change(bodyPartSelect, { target: { value: "knee" } });

    const addButton = screen.getByRole("button", {
      name: /add to calculator/i,
    });
    fireEvent.click(addButton);

    expect(screen.getAllByText(/knee/i).length).toBeGreaterThan(0);
  });
});
