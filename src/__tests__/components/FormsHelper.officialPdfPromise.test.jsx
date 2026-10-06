/**
 * The Forms Helper does not say the official PDF is filled out. It says
 * what was filled from the veteran's answers and what is left to do by
 * hand, in every language the app ships.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { fillRequiredOnScreen } from "../helpers/formMarkers";
import { APP_TRANSLATIONS } from "../../i18n/translations";

vi.mock("../../utils/unifiedAIService", async (importOriginal) => ({
  ...(await importOriginal()),
  isAnyAIAvailable: () => false,
  getAIStatus: () => ({ statusText: "No AI", isPrivate: true }),
  generateAI: vi.fn(),
}));

const { default: FormsHelper } =
  await import("../../components/FormsHelper.jsx");

function openResult(formName) {
  render(
    <LanguageProvider>
      <FormsHelper onClose={() => {}} />
    </LanguageProvider>,
  );
  fireEvent.click(screen.getByText(formName));
  fireEvent.click(screen.getByText("Start Guided Builder"));
  const next = () => screen.queryByRole("button", { name: /^next$/i });
  for (let guard = 0; next() && guard < 12; guard++) {
    fillRequiredOnScreen(fireEvent.change, fireEvent.click);
    fireEvent.click(next());
  }
  fillRequiredOnScreen(fireEvent.change, fireEvent.click);
  fireEvent.click(screen.getByRole("button", { name: /generate statement/i }));
}

beforeEach(() => {
  localStorage.clear();
});

describe("Forms Helper official PDF promise", () => {
  it.each([
    [
      "Statement in Support of Claim",
      /your statement goes in Remarks/i,
      /signature and the date/i,
    ],
    [
      "PTSD Stressor Statement",
      /event, its date and its place/i,
      /consent boxes/i,
    ],
    [
      "Buddy / Lay Statement",
      /statement goes in the statement box/i,
      /signature and the date/i,
    ],
  ])("%s says what is filled and what is left", (formName, filled, left) => {
    openResult(formName);
    const note = screen.getByRole("note", { name: "About the official PDF" });

    expect(note.textContent).toMatch(filled);
    expect(note.textContent).toMatch(left);
    expect(document.body.textContent).not.toMatch(
      /already filled out|ready to sign/i,
    );
  });

  it("makes no such promise in any language", () => {
    const { nextStepDownload, readyToSign } = APP_TRANSLATIONS.formsHelper;

    expect(nextStepDownload.en).not.toMatch(/already filled/i);
    expect(readyToSign.en).toBe("Partly filled in from your answers");
    for (const lang of ["es", "tl", "vi", "ko"]) {
      expect(nextStepDownload[lang]).not.toMatch(
        /ya está llenado|naka-fill na!|đã được điền sẵn!|이미 작성되어 있습니다/,
      );
      expect(readyToSign[lang]).not.toMatch(
        /Listo para firmar|Handa nang pirmahan|Sẵn sàng ký|서명 및 제출 준비 완료/,
      );
    }
  });
});
