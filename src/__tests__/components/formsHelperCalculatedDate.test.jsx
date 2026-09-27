/**
 * An NGB-22 that prints no entry date gets one calculated (separation date
 * minus net service - musterCallProcessor.js's serviceStartDateDerived
 * flag, carried onto the profile by veteranProfile.js). FormsHelper reads
 * that flag in two places:
 *  - the Profile Setup tab's own "Service Start Date" field must say so
 *    instead of showing the calculated value as if it were printed.
 *  - the prefill this same tab hands new VA-form wizards must never carry
 *    that calculated value into a form field silently; it's left blank for
 *    the veteran to fill in themselves (see buildFormsHelperPrefillDefaults
 *    in FormsHelper.jsx for why blank, not a note, was chosen here).
 *
 * Field inputs in the Profile Setup tab have no htmlFor/id association to
 * their <label> (an existing gap, not introduced here - see
 * FormsHelper.test.jsx), so the marker test below locates the input via the
 * label's sibling rather than getByLabelText.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FormsHelper, {
  buildFormsHelperPrefillDefaults,
} from "../../components/FormsHelper.jsx";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { updateVeteranProfile } from "../../utils/veteranProfile.js";

function renderFormsHelper() {
  return render(
    <LanguageProvider>
      <FormsHelper onClose={() => {}} />
    </LanguageProvider>,
  );
}

function openProfileSetup() {
  fireEvent.click(screen.getByText("Edit Your Profile"));
}

function serviceStartDateInput() {
  return screen
    .getByText("Service Start Date")
    .closest("div")
    .querySelector('input[type="date"]');
}

beforeEach(() => {
  localStorage.clear();
});

describe("FormsHelper - Profile Setup tab calculated-date marker", () => {
  it("marks a calculated service start date instead of showing it as printed", () => {
    updateVeteranProfile({
      firstName: "Jane",
      lastName: "Veteran",
      serviceStartDate: "2012-03-14",
      serviceStartDateDerived: true,
    });

    renderFormsHelper();
    openProfileSetup();

    expect(screen.getByText(/calculated from net service/)).toBeInTheDocument();
    // The profile's own value is still shown (just marked) - the veteran's
    // saved profile isn't blanked, only the separate VA-form wizard prefill
    // below is.
    expect(serviceStartDateInput()).toHaveValue("2012-03-14");
  });

  it("shows no marker for a printed service start date", () => {
    updateVeteranProfile({
      firstName: "Jane",
      lastName: "Veteran",
      serviceStartDate: "2012-03-14",
    });

    renderFormsHelper();
    openProfileSetup();

    expect(
      screen.queryByText(/calculated from net service/),
    ).not.toBeInTheDocument();
  });
});

describe("FormsHelper - VA-form prefill never carries a calculated date", () => {
  it("leaves serviceStartDate out of the prefill when it was calculated", () => {
    updateVeteranProfile({
      firstName: "Jane",
      lastName: "Veteran",
      serviceStartDate: "2012-03-14",
      serviceStartDateDerived: true,
    });

    expect(buildFormsHelperPrefillDefaults().serviceStartDate).toBe("");
  });

  it("still prefills a printed service start date (existing behavior)", () => {
    updateVeteranProfile({
      firstName: "Jane",
      lastName: "Veteran",
      serviceStartDate: "2012-03-14",
    });

    expect(buildFormsHelperPrefillDefaults().serviceStartDate).toBe(
      "2012-03-14",
    );
  });
});
