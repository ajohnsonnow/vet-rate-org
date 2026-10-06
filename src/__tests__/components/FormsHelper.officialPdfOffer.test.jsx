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

describe("answers the form has no place for", () => {
  it.each([
    ["Intent to File", /list of conditions has no place on this form/],
    [
      "Medical Records Release",
      /For you to complete on the form: each provider you listed.*kinds of records.*instructions/,
    ],
    ["VSO Appointment", /organization's address has no place on this form/],
  ])("%s: the note about the official PDF names them", (formName, named) => {
    openResult(formName);

    expect(
      screen.getByRole("note", { name: "About the official PDF" }).textContent,
    ).toMatch(named);
  });
});

const press = async () => {
  openResult("Statement in Support of Claim");
  fireEvent.click(officialButton());
  return screen.findByRole("alert");
};

describe("after the official PDF is made", () => {
  it("says when the statement was too long for the form and where the rest is", async () => {
    fillAndDownloadForm.mockResolvedValue({
      success: true,
      fileName: "x.pdf",
      leftBlank: [],
      overflow: "the part that did not fit",
    });

    expect((await press()).textContent).toMatch(
      /too long for the boxes the form has for it.*The rest is not on the form.*\.TXT, \.DOCX or \.PDF/,
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

  it("says which answers went to Remarks instead of their boxes", async () => {
    fillAndDownloadForm.mockResolvedValue({
      success: true,
      fileName: "x.pdf",
      leftBlank: [],
      moved: ["Description of the traumatic event (item 9A)"],
      overflow: "",
    });

    expect((await press()).textContent).toMatch(
      /written in full in the Remarks section.*Description of the traumatic event \(item 9A\)/,
    );
  });
});

describe("after the official PDF is made, answers that are not on it", () => {
  it("says which answers are only in the text downloads", async () => {
    fillAndDownloadForm.mockResolvedValue({
      success: true,
      fileName: "x.pdf",
      leftBlank: [],
      moved: ["Location of the traumatic event (item 9B)"],
      textOnly: ["Description of the traumatic event (item 9A)"],
      notPlaced: [],
      overflow: "",
    });
    const text = (await press()).textContent;

    expect(text).toMatch(
      /written in full in the Remarks section and their boxes point there: Location of the traumatic event \(item 9B\)\./,
    );
    expect(text).toMatch(
      /not on the official PDF\. They are in the text downloads.*Not on the form: Description of the traumatic event \(item 9A\)\./,
    );
  });

  it("names the answers it could not put into the form's boxes", async () => {
    fillAndDownloadForm.mockResolvedValue({
      success: true,
      fileName: "x.pdf",
      leftBlank: [],
      moved: [],
      textOnly: [],
      notPlaced: ["Mailing address", "ZIP code"],
      overflow: "",
    });

    expect((await press()).textContent).toMatch(
      /could not put these answers into the form's boxes as you typed them.*blank for you to write in: Mailing address; ZIP code\./,
    );
  });

  it("quotes only the start of a long answer it left blank", async () => {
    fillAndDownloadForm.mockResolvedValue({
      success: true,
      fileName: "x.pdf",
      leftBlank: [`${"word ".repeat(40)}end`],
      moved: [],
      overflow: "",
    });
    const text = (await press()).textContent;

    expect(text).toMatch(/left blank for you to write in: word word/);
    expect(text).toContain("...");
    expect(text.length).toBeLessThan(260);
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
