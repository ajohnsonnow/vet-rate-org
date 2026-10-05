import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("lets a veteran add a condition and see it in the list", async () => {
    renderCalculator();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    const bodyPartSelect = screen.getByLabelText(/body part/i);
    fireEvent.change(bodyPartSelect, { target: { value: "knee" } });

    const addButton = screen.getByRole("button", {
      name: /add to calculator/i,
    });
    fireEvent.click(addButton);

    expect(screen.getAllByText(/knee/i).length).toBeGreaterThan(0);
  });

  it("tells the veteran which sided conditions got no bilateral factor and why", async () => {
    renderCalculator({
      initialConditions: [
        {
          id: "a",
          name: "Condition A",
          rating: 20,
          side: "left",
          bodyPart: "other",
        },
        {
          id: "b",
          name: "Right knee",
          rating: 20,
          side: "right",
          bodyPart: "knee",
        },
      ],
    });
    const notice = await screen.findByRole("status", {
      name: /bilateral factor not applied/i,
    });
    expect(notice).toHaveTextContent("Condition A");
    expect(notice).toHaveTextContent(/arm or a leg condition/i);
    expect(notice).not.toHaveTextContent("Right knee");
  });

  it("shows no bilateral notice when a left and right knee pair up", async () => {
    renderCalculator({
      initialConditions: [
        {
          id: "a",
          name: "Left knee",
          rating: 20,
          side: "left",
          bodyPart: "knee",
        },
        {
          id: "b",
          name: "Right knee",
          rating: 20,
          side: "right",
          bodyPart: "knee",
        },
      ],
    });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: /bilateral factor not applied/i }),
    ).not.toBeInTheDocument();
  });
});
