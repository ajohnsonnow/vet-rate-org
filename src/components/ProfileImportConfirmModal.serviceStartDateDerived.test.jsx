/**
 * DD214Analyzer's profile-import prep (_prepareAndShowProfileImport /
 * _prepareManualProfileImport) sends serviceStartDateDerived: false to
 * explicitly clear a stale calculated flag on import - but
 * ProfileImportConfirmModal's handleConfirm only forwarded a field when
 * `selectedFields[key] && editableData[key]` was truthy, silently dropping
 * the explicit `false`. A veteran importing a real DD214 over a profile
 * that held a calculated NGB-22 date got the DD214's printed date with
 * serviceStartDateDerived still stuck at true. Fixture values are
 * synthetic, not any real veteran's data.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState, useMemo } from "react";
import ProfileImportConfirmModal from "./ProfileImportConfirmModal.jsx";

describe("ProfileImportConfirmModal: an explicit false field value is not dropped on import", () => {
  it("includes serviceStartDateDerived: false in the confirmed payload", async () => {
    const onConfirm = vi.fn();
    render(
      <ProfileImportConfirmModal
        extractedData={{
          serviceStartDate: "2004-01-10",
          serviceStartDateDerived: false,
          serviceEndDate: "2005-03-20",
        }}
        currentProfile={{
          serviceStartDate: "2002-03-05",
          serviceStartDateDerived: true,
        }}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: /Import Selected Fields/ }),
    );

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceStartDate: "2004-01-10",
        serviceStartDateDerived: false,
        serviceEndDate: "2005-03-20",
      }),
      expect.objectContaining({ serviceStartDateEdited: false }),
    );
  });
});

// [G10] ADR-007 W9: a fresh getVeteranProfile() object on every parent
// render used to give this component's useEditableProfileData reset
// effect (keyed on the currentProfile prop's own identity) a brand-new
// reference every time - wiping the veteran's in-progress checkbox
// selections and typed edits mid-review. DD214Analyzer.jsx now memoizes
// currentProfile (useMemo keyed on showProfileImportModal, not on every
// render) - this proves that with a STABLE reference across an unrelated
// parent re-render, the modal correctly preserves in-progress edits.
describe("[G10] a parent re-render with a stable (memoized) currentProfile does not reset the selection or edits", () => {
  it("keeps a typed edit and an unchecked field across an unrelated parent re-render", async () => {
    function Harness() {
      const [tick, setTick] = useState(0);
      // Both stay referentially stable across the unrelated `tick`
      // re-render below, matching how DD214Analyzer.jsx holds
      // extractedProfileData in state (only replaced by a new analysis)
      // and now memoizes currentProfile the same way.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const currentProfile = useMemo(() => ({ fixed: true }), []);
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const extractedData = useMemo(
        () => ({
          serviceStartDate: "2004-01-10",
          serviceEndDate: "2005-03-20",
        }),
        [],
      );
      return (
        <>
          <button onClick={() => setTick((t) => t + 1)}>rerender {tick}</button>
          <ProfileImportConfirmModal
            extractedData={extractedData}
            currentProfile={currentProfile}
            onConfirm={vi.fn()}
            onCancel={vi.fn()}
          />
        </>
      );
    }
    render(<Harness />);

    const startDateInput = await screen.findByDisplayValue("2004-01-10");
    fireEvent.change(startDateInput, { target: { value: "2001-11-01" } });
    const endDateCheckbox = screen
      .getByDisplayValue("2005-03-20")
      .closest(".rounded-lg.border")
      .querySelector('input[type="checkbox"]');
    fireEvent.click(endDateCheckbox);

    fireEvent.click(screen.getByRole("button", { name: /rerender/ }));

    expect(screen.getByDisplayValue("2001-11-01")).toBeInTheDocument();
    expect(endDateCheckbox.checked).toBe(false);
  });
});
