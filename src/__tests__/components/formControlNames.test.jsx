/**
 * Every form control on these screens has an accessible name (axe: "form
 * elements must have labels", "buttons must have discernible text").
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import MillionDollarDashboard from "../../components/MillionDollarDashboard.jsx";
import TimeMachine from "../../components/TimeMachine.jsx";
import RetroPayHunter from "../../components/RetroPayHunter.jsx";

const show = (Screen) =>
  render(
    <LanguageProvider>
      <Screen onClose={() => {}} />
    </LanguageProvider>,
  );

const unnamedControls = () =>
  [...document.querySelectorAll("input, select, textarea, button")].filter(
    (el) =>
      el.type !== "hidden" &&
      !el.getAttribute("aria-label") &&
      !el.getAttribute("aria-labelledby") &&
      !(el.labels && el.labels.length > 0) &&
      !(el.tagName === "BUTTON" && el.textContent.trim()),
  );

beforeEach(() => {
  localStorage.clear();
});

describe("Million Dollar Dashboard", () => {
  it("names its inputs and its state select", () => {
    show(MillionDollarDashboard);
    expect(
      screen.getByRole("spinbutton", { name: /current age/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("slider", { name: /va rating %/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /state \(for property tax\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("spinbutton", { name: /# children/i }),
    ).toBeInTheDocument();
    expect(unnamedControls()).toEqual([]);
  });

  it("gives the rating slider a 44px touch target", () => {
    show(MillionDollarDashboard);
    expect(screen.getByRole("slider", { name: /va rating %/i })).toHaveClass(
      "min-h-[44px]",
    );
  });
});

describe("Time Machine", () => {
  it("names the date input and the rating select, and the date input shows focus", () => {
    show(TimeMachine);
    const date = screen.getByLabelText(
      /when did you file your intent to file/i,
    );
    expect(date).toHaveAttribute("type", "date");
    expect(date).toHaveClass("focus-visible:ring-2");
    expect(
      screen.getByRole("combobox", { name: /estimated combined rating/i }),
    ).toBeInTheDocument();
    expect(unnamedControls()).toEqual([]);
  });
});

describe("Retro Pay Hunter", () => {
  it("names its inputs, its rating select and the remove button", () => {
    show(RetroPayHunter);
    const date = screen.getByLabelText(/^effective date/i);
    expect(date).toHaveAttribute("type", "date");
    expect(
      screen.getByRole("combobox", { name: /combined rating/i }),
    ).toBeInTheDocument();
    for (const name of [
      /children under 18/i,
      /children in school, 18 or older/i,
      /dependent parents/i,
      /what you actually received per month/i,
    ]) {
      expect(screen.getByRole("spinbutton", { name })).toBeInTheDocument();
    }
    expect(unnamedControls()).toEqual([]);

    fireEvent.change(date, { target: { value: "2024-02-15" } });
    fireEvent.click(screen.getByRole("button", { name: /add rating period/i }));
    expect(
      screen.getByRole("button", { name: /remove rating period/i }),
    ).toBeInTheDocument();
    expect(unnamedControls()).toEqual([]);
  });
});
