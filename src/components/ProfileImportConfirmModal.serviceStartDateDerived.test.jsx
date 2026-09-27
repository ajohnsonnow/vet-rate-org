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
    );
  });
});
