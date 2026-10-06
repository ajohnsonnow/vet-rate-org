/**
 * Forms Helper offers the "Official VA Form PDF" button only for a form
 * the app can fill. Elsewhere it offers the text downloads and says they
 * are not the official form. When a statement is too long for the form, or
 * an answer too long for its box, the screen says so. Nothing is called
 * ready to sign.
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
vi.mock("../../utils/pdfFormFiller", async (importOriginal) => ({
  ...(await importOriginal()),
  fillAndDownloadForm: vi.fn(),
}));

const { fillAndDownloadForm, hasOfficialPdf } =
  await import("../../utils/pdfFormFiller");
const { default: FormsHelper } =
  await import("../../components/FormsHelper.jsx");

const WITH_FILLER = [
  "Buddy / Lay Statement",
  "Intent to File",
  "Medical Records Release",
  "Statement in Support of Claim",
  "PTSD Stressor Statement",
  "VSO Appointment",
  "Individual Representative",
];
const WITHOUT_FILLER = [
  "Priority Processing Request",
  "Third Party Authorization",
  "Freedom of Information Act (FOIA) Request",
  "Alternate Signer Certification",
  "Nursing Home Information",
  "Request for Substitution",
  "Income & Asset Statement",
  "Medical Expense Report",
  "Request for Employment Information",
];
const officialButton = () =>
  screen.queryByRole("button", { name: /Official VA Form PDF/ });

function openResult(formName) {
  render(
    <LanguageProvider>
      <FormsHelper onClose={() => {}} />
    </LanguageProvider>,
  );
  fireEvent.click(screen.getByText(formName));
  fireEvent.click(screen.getByText("Start Guided Builder"));
  const next = () => screen.queryByRole("button", { name: /^next$/i });
  for (let guard = 0; guard < 14; guard++) {
    fillRequiredOnScreen(fireEvent.change, fireEvent.click);
    if (!next()) break;
    fireEvent.click(next());
  }
  fireEvent.click(screen.getByRole("button", { name: /generate/i }));
}

beforeEach(() => {
  localStorage.clear();
  fillAndDownloadForm.mockReset();
});

describe("which forms have an official PDF", () => {
  it("is the seven the app can fill, and not the Priority Processing Request", () => {
    expect(
      [
        "buddy-statement",
        "intent-to-file",
        "medical-release",
        "personal-statement",
        "ptsd-stressor",
        "vso-appointment",
        "vso-appointment-individual",
      ].every(hasOfficialPdf),
    ).toBe(true);
    expect(
      [
        "priority-processing",
        "third-party-authorization",
        "personal-records-request",
        "alternate-signer",
        "nursing-home-info",
        "substitution-request",
        "income-asset-statement",
        "medical-expense-report",
        "employment-info",
        undefined,
      ].some(hasOfficialPdf),
    ).toBe(false);
  });
});

describe.each(WITHOUT_FILLER)("%s", (formName) => {
  it("offers the text downloads only, and says they are not the official form", () => {
    openResult(formName);

    expect(officialButton()).not.toBeInTheDocument();
    for (const format of [/\.TXT$/, /\.DOCX$/, /\.PDF$/]) {
      expect(screen.getByRole("button", { name: format })).toBeInTheDocument();
    }
    expect(
      screen.getByRole("note", { name: "About these downloads" }).textContent,
    ).toMatch(/not the official VA form/);
    expect(document.body.textContent).not.toMatch(
      /Official VA Form PDF|ready.to.sign|already filled/i,
    );
  });
});

describe.each(WITH_FILLER)("%s", (formName) => {
  it("offers the official PDF, described as partly filled in", () => {
    openResult(formName);

    expect(officialButton().textContent).toMatch(/Partly filled in/);
    expect(document.body.textContent).not.toMatch(/ready.to.sign/i);
  });
});

describe("after the official PDF is made", () => {
  const press = async () => {
    openResult("Statement in Support of Claim");
    fireEvent.click(officialButton());
    return screen.findByRole("alert");
  };

  it("says when the statement was too long for the form and where the rest is", async () => {
    fillAndDownloadForm.mockResolvedValue({
      success: true,
      fileName: "x.pdf",
      leftBlank: [],
      overflow: "the part that did not fit",
    });

    expect((await press()).textContent).toMatch(
      /too long for the Remarks boxes.*The rest is not on the form.*\.TXT, \.DOCX or \.PDF/,
    );
  });

  it("names an answer that was too long for its box", async () => {
    fillAndDownloadForm.mockResolvedValue({
      success: true,
      fileName: "x.pdf",
      leftBlank: ["Bartholomew-James"],
      overflow: "",
    });

    expect((await press()).textContent).toMatch(
      /left blank for you to write in: Bartholomew-James/,
    );
  });

  it("says nothing when everything fitted", async () => {
    fillAndDownloadForm.mockResolvedValue({
      success: true,
      fileName: "x.pdf",
      leftBlank: [],
      overflow: "",
    });
    openResult("Statement in Support of Claim");
    fireEvent.click(officialButton());
    await vi.waitFor(() => expect(fillAndDownloadForm).toHaveBeenCalled());

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says so in words, with no alert box, when the PDF cannot be made", async () => {
    vi.spyOn(window, "alert").mockImplementation(() => {});
    fillAndDownloadForm.mockRejectedValue(new Error("boom"));

    expect((await press()).textContent).toMatch(
      /official PDF could not be made/i,
    );
    expect(window.alert).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe("the result heading", () => {
  it("promises no ready-to-sign PDF in any language", () => {
    for (const key of ["statementGeneratedDesc", "reviewStatementDesc"]) {
      for (const text of Object.values(APP_TRANSLATIONS.formsHelper[key])) {
        expect(text).not.toMatch(
          /ready-to-sign|listo para firmar|sẵn sàng ký|서명 준비/i,
        );
      }
    }
  });
});
