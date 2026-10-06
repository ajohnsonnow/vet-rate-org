/**
 * Forms Helper: a required answer is required. Next and Generate do not
 * move on while one is missing; each missing field says so in words tied
 * to the field, and focus goes to the first of them.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { fillRequiredOnScreen } from "../helpers/formMarkers";

vi.mock("../../utils/unifiedAIService", async (importOriginal) => ({
  ...(await importOriginal()),
  isAnyAIAvailable: () => false,
  getAIStatus: () => ({ statusText: "No AI", isPrivate: true }),
  generateAI: vi.fn(),
}));

const { default: FormsHelper } =
  await import("../../components/FormsHelper.jsx");

const field = (name) => document.getElementById(`forms-helper-field-${name}`);
const next = () => screen.getByRole("button", { name: /^next$/i });

function openBuilder(formName) {
  render(
    <LanguageProvider>
      <FormsHelper onClose={() => {}} />
    </LanguageProvider>,
  );
  fireEvent.click(screen.getByText(formName));
  fireEvent.click(screen.getByText("Start Guided Builder"));
}

beforeEach(() => {
  localStorage.clear();
});

describe("Forms Helper required answers", () => {
  it("stops Next, names each missing field and moves focus to the first", () => {
    openBuilder("Statement in Support of Claim");
    fireEvent.click(next());

    expect(screen.getByText("Basic Information")).toBeInTheDocument();
    expect(field("veteranName")).toHaveFocus();
    for (const name of ["veteranName", "conditionName", "claimType"]) {
      expect(field(name)).toHaveAttribute("aria-invalid", "true");
      expect(field(name)).toHaveAccessibleDescription(
        /This answer is required\. Fill it in to continue\./,
      );
    }
    expect(field("primaryCondition")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("alert").textContent).toBe(
      "3 required answers are missing on this step.",
    );
  });

  it("clears a field's message once it is answered, and moves on when all are", () => {
    openBuilder("Statement in Support of Claim");
    fireEvent.click(next());
    fireEvent.change(field("veteranName"), {
      target: { value: "Marlow Testwright" },
    });

    expect(field("veteranName")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("alert").textContent).toBe(
      "2 required answers are missing on this step.",
    );

    fireEvent.change(field("conditionName"), { target: { value: "Tinnitus" } });
    fireEvent.change(field("claimType"), { target: { value: "initial" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(next());
    expect(screen.getByText("When Did It Start?")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("treats spaces as no answer", () => {
    openBuilder("Statement in Support of Claim");
    fireEvent.change(field("veteranName"), { target: { value: "   " } });
    fireEvent.click(next());

    expect(field("veteranName")).toHaveAttribute("aria-invalid", "true");
  });

  it("stops Generate on the last step, and a required checklist says so too", () => {
    openBuilder("PTSD Stressor Statement");
    for (let guard = 0; guard < 12; guard++) {
      if (!screen.queryByRole("button", { name: /^next$/i })) break;
      fillRequiredOnScreen(fireEvent.change, fireEvent.click);
      fireEvent.click(next());
    }
    fireEvent.click(
      screen.getByRole("button", { name: /generate statement/i }),
    );

    expect(
      screen.queryByRole("textbox", { name: /^Your statement/ }),
    ).not.toBeInTheDocument();
    const symptoms = screen.getByRole("group", {
      name: /What PTSD symptoms do you experience/,
    });
    expect(symptoms).toHaveAttribute("aria-invalid", "true");
    expect(symptoms).toHaveAccessibleDescription(/This answer is required/);
    expect(field("symptoms")).toHaveFocus();

    fillRequiredOnScreen(fireEvent.change, fireEvent.click);
    fireEvent.click(
      screen.getByRole("button", { name: /generate statement/i }),
    );
    expect(
      screen.getByRole("textbox", { name: /^Your statement/ }),
    ).toBeInTheDocument();
  });

  it("lets Back through with answers missing", () => {
    openBuilder("Statement in Support of Claim");
    fillRequiredOnScreen(fireEvent.change, fireEvent.click);
    fireEvent.click(next());
    fireEvent.click(screen.getByRole("button", { name: /back/i }));

    expect(screen.getByText("Basic Information")).toBeInTheDocument();
  });
});

describe("Forms Helper select with no blank entry of its own", () => {
  it("shows nothing as chosen until the veteran chooses", () => {
    openBuilder("VSO Appointment");
    for (let guard = 0; guard < 8; guard++) {
      const select = field("limitAccess");
      if (select) {
        expect(select.value).toBe("");
        expect(select.options[0].textContent).toBe("Select...");
        return;
      }
      fillRequiredOnScreen(fireEvent.change, fireEvent.click);
      fireEvent.click(next());
    }
    throw new Error("the limit-access question was never shown");
  });
});
