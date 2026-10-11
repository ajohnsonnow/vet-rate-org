/**
 * axe rule `label`: every imported-value input in the review dialog needs a
 * programmatic name tied to its row's field label. Fixture values are
 * synthetic.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import ProfileImportConfirmModal from "./ProfileImportConfirmModal.jsx";

describe("ProfileImportConfirmModal accessible names", () => {
  it("names each imported value control after its field label", () => {
    render(
      <ProfileImportConfirmModal
        extractedData={{
          firstName: "Jordan",
          rank: "SGT",
          reenlisted: true,
          serviceEndDate: "2005-03-20",
        }}
        fieldSources={{}}
        currentProfile={{}}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("textbox", { name: "First Name Imported Value:" }),
    ).toHaveValue("Jordan");
    expect(
      screen.getByRole("textbox", { name: "Rank Imported Value:" }),
    ).toHaveValue("SGT");
    expect(
      screen.getByRole("combobox", { name: "Re-enlisted Imported Value:" }),
    ).toHaveValue("true");

    const dialog = screen.getByRole("dialog");
    const unnamed = within(dialog)
      .getAllByRole("textbox")
      .filter((el) => !el.getAttribute("aria-labelledby"));
    expect(unnamed).toEqual([]);
  });

  it("renders no contentinfo landmark inside the dialog", () => {
    render(
      <ProfileImportConfirmModal
        extractedData={{ rank: "SGT" }}
        fieldSources={{}}
        currentProfile={{}}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });
});
