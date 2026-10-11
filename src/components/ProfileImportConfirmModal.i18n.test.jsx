/**
 * The review dialog's footer and long-list disclosure read from
 * translations.js (dd214Analyzer section). The entries are English only, so
 * every other language shows the English text.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ProfileImportConfirmModal from "./ProfileImportConfirmModal.jsx";
import { LanguageProvider } from "../contexts/LanguageContext";
import { APP_TRANSLATIONS } from "../i18n/translations";

const props = (extra = {}) => ({
  extractedData: { rank: "SGT", awards: "Sample Medal; Other Medal" },
  fieldSources: { rank: "parser" },
  fullLists: { awards: ["Sample Medal", "Other Medal"] },
  currentProfile: {},
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
  ...extra,
});

describe("ProfileImportConfirmModal translated text", () => {
  beforeEach(() => localStorage.clear());

  it("shows the English text with no provider", () => {
    render(<ProfileImportConfirmModal {...props()} />);
    expect(
      screen.getByRole("button", { name: /Cancel Import/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Import Selected Fields/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ready to import 1 field")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Show all 2 in Awards and Decorations that will be saved",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "All 2 in Awards and Decorations" }),
    ).toBeInTheDocument();
  });

  it("falls back to English under a non-English provider", () => {
    localStorage.setItem("vetrate_language", "es");
    render(
      <LanguageProvider>
        <ProfileImportConfirmModal {...props()} />
      </LanguageProvider>,
    );
    expect(
      screen.getByRole("button", { name: /Cancel Import/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ready to import 1 field")).toBeInTheDocument();
  });

  it("shows the nothing-selected message", () => {
    render(<ProfileImportConfirmModal {...props({ extractedData: {} })} />);
    expect(screen.getByText(/No fields selected/)).toBeInTheDocument();
  });

  it("keeps every new key English-only", () => {
    for (const key of [
      "importCancel",
      "importNoFieldsSelected",
      "importReadyOne",
      "importReadyMany",
      "importSelectedFields",
      "listShowAll",
      "listRegionLabel",
    ]) {
      expect(Object.keys(APP_TRANSLATIONS.dd214Analyzer[key])).toEqual(["en"]);
    }
  });
});
