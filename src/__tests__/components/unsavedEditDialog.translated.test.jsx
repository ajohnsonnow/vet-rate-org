/**
 * The question asked before closing with an unsaved edit is shown in the
 * veteran's language.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { UnsavedEditDialog } from "../../components/common/ChoiceDialog.jsx";

beforeEach(() => {
  localStorage.clear();
});

describe("UnsavedEditDialog", () => {
  it.each([
    ["en", "Close without saving?", "Stay and keep my edits"],
    ["es", "¿Cerrar sin guardar?", "Quedarme y conservar mis cambios"],
    ["ko", "저장하지 않고 닫으시겠습니까?", "머물러서 수정 내용 유지"],
  ])("is in %s", (language, title, stay) => {
    localStorage.setItem("vetrate_language", language);
    render(
      <LanguageProvider>
        <UnsavedEditDialog onStay={() => {}} onClose={() => {}} />
      </LanguageProvider>,
    );

    expect(screen.getByRole("alertdialog")).toHaveAccessibleName(title);
    expect(screen.getByRole("button", { name: stay })).toHaveFocus();
  });
});
