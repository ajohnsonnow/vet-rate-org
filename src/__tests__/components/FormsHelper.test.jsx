/**
 * FormsHelper pre-fills name/address/service from the veteran's profile
 * (already shipped) and, now, condition(s)-claimed fields from My Ratings
 * and saved claims - a single-condition field (21-4138's conditionName)
 * gets the first condition on file; multi-condition fields (21-0966's
 * conditions, FOIA's specificConditions) get the full comma-joined list.
 * The prefill is re-seeded fresh every time a form is selected (it used to
 * be wiped blank by that reset, making the mount-time prefill invisible in
 * the actual wizard) but never carries over an answer the veteran already
 * typed into the currently-open form.
 *
 * Field inputs have no htmlFor/id association to their <label> (an
 * existing gap, not introduced here), so these tests target fields by
 * their fixed placeholder text rather than getByLabelText.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FormsHelper from "../../components/FormsHelper.jsx";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { fillRequiredOnScreen } from "../helpers/formMarkers";
import {
  updateVeteranProfile,
  saveMyRatings,
} from "../../utils/veteranProfile.js";
import { saveClaim } from "../../utils/claimsStorage.js";

function renderFormsHelper(props = {}) {
  return render(
    <LanguageProvider>
      <FormsHelper onClose={() => {}} {...props} />
    </LanguageProvider>,
  );
}

function openPersonalStatementWizard() {
  fireEvent.click(screen.getByText("Statement in Support of Claim"));
  fireEvent.click(screen.getByText("Start Guided Builder"));
}

function openIntentToFileWizard() {
  fireEvent.click(screen.getByText("Intent to File"));
  fireEvent.click(screen.getByText("Start Guided Builder"));
}

const conditionNameField = () =>
  screen.getByPlaceholderText("PTSD, back pain, knee injury, etc.");

beforeEach(() => {
  localStorage.clear();
});

describe("FormsHelper prefill from records", () => {
  it("pre-fills a single-condition field (21-4138) from the first condition on file", () => {
    saveMyRatings([
      { name: "PTSD", bodyPart: "mental", rating: 70, side: "none" },
    ]);
    saveClaim({ conditionName: "Tinnitus" });

    renderFormsHelper();
    openPersonalStatementWizard();

    expect(conditionNameField()).toHaveValue("PTSD");
  });

  it("pre-fills a multi-condition field (21-0966) with every condition on file", () => {
    saveMyRatings([
      { name: "PTSD", bodyPart: "mental", rating: 70, side: "none" },
    ]);
    saveClaim({ conditionName: "Tinnitus" });

    renderFormsHelper();
    openIntentToFileWizard();
    for (let step = 0; step < 2; step++) {
      fillRequiredOnScreen(fireEvent.change, fireEvent.click);
      fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
    }

    expect(
      screen.getByPlaceholderText(/PTSD, back injury, hearing loss/),
    ).toHaveValue("PTSD, Tinnitus");
  });

  it("leaves condition fields blank when no ratings or claims are on file", () => {
    renderFormsHelper();
    openPersonalStatementWizard();

    expect(conditionNameField()).toHaveValue("");
  });

  it("still pre-fills name/address from the profile (existing behavior)", () => {
    updateVeteranProfile({ firstName: "Jane", lastName: "Veteran" });

    renderFormsHelper();
    openPersonalStatementWizard();

    expect(screen.getByPlaceholderText("Jane M. Veteran")).toHaveValue(
      "Jane Veteran",
    );
  });

  it("builds the full name without a double space when there is no middle name/initial on file (regression D9)", () => {
    updateVeteranProfile({ firstName: "Anthony", lastName: "Johnson" });

    renderFormsHelper();
    openPersonalStatementWizard();

    expect(screen.getByPlaceholderText("Jane M. Veteran")).toHaveValue(
      "Anthony Johnson",
    );
  });

  it("falls back to the DD214-derived middleName's first letter when the profile has no bare middleInitial (regression D9)", () => {
    updateVeteranProfile({
      firstName: "Anthony",
      middleName: "Michael",
      lastName: "Johnson",
    });

    renderFormsHelper();
    openPersonalStatementWizard();

    expect(screen.getByPlaceholderText("Jane M. Veteran")).toHaveValue(
      "Anthony M Johnson",
    );
  });

  it("moves focus onto the step heading after Start Guided Builder, not off the dialog (regression D10)", async () => {
    renderFormsHelper();
    openPersonalStatementWizard();

    const heading = await screen.findByRole("heading", { level: 3 });
    expect(heading).toHaveFocus();
  });

  it("re-seeds the prefill fresh on reselecting a form, not the previous session's typed answer", () => {
    saveMyRatings([
      { name: "PTSD", bodyPart: "mental", rating: 70, side: "none" },
    ]);

    renderFormsHelper();
    openPersonalStatementWizard();
    fireEvent.change(conditionNameField(), {
      target: { value: "Something I typed" },
    });

    // Step 1 "Back" -> form info panel; "Back to all forms" -> the grid.
    fireEvent.click(screen.getByRole("button", { name: /^←\s*back$/i }));
    fireEvent.click(screen.getByRole("button", { name: /back to all forms/i }));
    openPersonalStatementWizard();

    expect(conditionNameField()).toHaveValue("PTSD");
  });
});

describe("FormsHelper prefill country", () => {
  it("is empty unless the veteran's profile gives one", async () => {
    const { buildFormsHelperPrefillDefaults } =
      await import("../../components/FormsHelper.jsx");

    expect(buildFormsHelperPrefillDefaults().country).toBe("");
    updateVeteranProfile({ country: "Canada" });
    expect(buildFormsHelperPrefillDefaults().country).toBe("Canada");
  });
});
