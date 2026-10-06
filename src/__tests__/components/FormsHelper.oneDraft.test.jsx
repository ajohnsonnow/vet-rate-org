/**
 * One draft per Forms Helper statement form. Every field is filled through
 * the real wizard with its own marker; each marker must then appear exactly
 * once in the draft on screen, in every download format and in the item
 * saved to My Packet, along with an edit made on screen. The Forms Helper
 * has no copy button: the editable draft is the text to copy. All values
 * are invented.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { draftFileText, flat, occurrences } from "../helpers/draftFileText";
import { fillEveryField } from "../helpers/formMarkers";
import { DRAFT_FORMATS } from "../../utils/draftExport";
import { getSavedForms } from "../../utils/veteranProfile";

vi.mock("../../utils/sanitize", async (importOriginal) => ({
  ...(await importOriginal()),
  triggerBlobDownload: vi.fn(() => true),
}));
vi.mock("../../utils/draftExport", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    downloadDraft: vi.fn((...args) => actual.downloadDraft(...args)),
  };
});
vi.mock("../../utils/unifiedAIService", async (importOriginal) => ({
  ...(await importOriginal()),
  isAnyAIAvailable: () => false,
  getAIStatus: () => ({ statusText: "No AI", isPrivate: true }),
  generateAI: vi.fn(),
}));

const { triggerBlobDownload } = await import("../../utils/sanitize");
const { downloadDraft } = await import("../../utils/draftExport");
const { generateAI } = await import("../../utils/unifiedAIService");
const { default: FormsHelper, _getFormStepsForForm } =
  await import("../../components/FormsHelper.jsx");

const FORMS = [
  ["personal-statement", "Statement in Support of Claim"],
  ["ptsd-stressor", "PTSD Stressor Statement"],
  ["buddy-statement", "Buddy / Lay Statement"],
];
const EDIT = "A line the veteran typed into the draft on screen.";
const draft = () => screen.getByRole("textbox", { name: /^Your statement/ });
const control = (name) => document.getElementById(`forms-helper-field-${name}`);

function answer(field, value) {
  if (field.type === "checklist") {
    for (const option of value) fireEvent.click(screen.getByLabelText(option));
  } else if (field.type === "checkbox") {
    fireEvent.click(screen.getByLabelText(field.label));
  } else {
    fireEvent.change(control(field.name), { target: { value } });
  }
}

/** Fill the whole wizard, generate, and type one more line into the draft. */
function fillAndGenerate(formType, formName) {
  const steps = _getFormStepsForForm({ id: formType });
  const { formData, markers } = fillEveryField(steps);
  render(
    <LanguageProvider>
      <FormsHelper onClose={() => {}} />
    </LanguageProvider>,
  );
  fireEvent.click(screen.getByText(formName));
  fireEvent.click(screen.getByText("Start Guided Builder"));
  steps.forEach((step, i) => {
    for (const field of step.fields) answer(field, formData[field.name]);
    fireEvent.click(
      screen.getByRole("button", {
        name: i === steps.length - 1 ? /generate statement/i : /^next$/i,
      }),
    );
  });
  fireEvent.change(draft(), {
    target: { value: `${draft().value}\n\n${EDIT}` },
  });
  return [...markers.map((marker) => marker.printed), EDIT];
}

beforeEach(() => {
  localStorage.clear();
  downloadDraft.mockClear();
  triggerBlobDownload.mockClear();
  triggerBlobDownload.mockReturnValue(true);
});

describe.each(FORMS)("Forms Helper %s", (formType, formName) => {
  it("shows every answer exactly once in the draft on screen", () => {
    const printed = fillAndGenerate(formType, formName);

    for (const text of printed) {
      expect([text, occurrences(draft().value, text)]).toEqual([text, 1]);
    }
    expect(draft().value).not.toMatch(/FOR VA USE ONLY|\[Veteran/);
    expect(generateAI).not.toHaveBeenCalled();
  });

  it.each(DRAFT_FORMATS)(
    "puts that same text, every answer once, in the .%s download",
    async (format) => {
      const printed = fillAndGenerate(formType, formName);
      const onScreen = draft().value;
      fireEvent.click(
        screen.getByRole("button", {
          name: new RegExp(`\\.${format}$`, "i"),
        }),
      );

      await waitFor(() => expect(downloadDraft).toHaveBeenCalledTimes(1));
      const { bytes } = await downloadDraft.mock.results[0].value;
      const text = await draftFileText(bytes, format);
      expect(bytes.length).toBeGreaterThan(100);
      expect(flat(text)).toBe(flat(onScreen));
      for (const answerText of printed) {
        expect([answerText, occurrences(text, answerText)]).toEqual([
          answerText,
          1,
        ]);
      }
    },
  );

  it("saves that same text, every answer once, to My Packet", () => {
    const printed = fillAndGenerate(formType, formName);
    const onScreen = draft().value;
    fireEvent.click(screen.getByRole("button", { name: /save to packet/i }));

    const [saved] = getSavedForms();
    expect(saved.formType).toBe(formType);
    expect(saved.generatedContent).toBe(onScreen);
    for (const text of printed) {
      expect([text, occurrences(saved.generatedContent, text)]).toEqual([
        text,
        1,
      ]);
    }
    expect(screen.getByText(/saved to my packet/i)).toBeInTheDocument();
  });
});

describe("Forms Helper when a download or a save does not work", () => {
  it("says so in plain words and keeps the draft", async () => {
    triggerBlobDownload.mockReturnValue(false);
    fillAndGenerate(...FORMS[0]);
    const onScreen = draft().value;
    fireEvent.click(screen.getByRole("button", { name: /\.PDF$/ }));

    await screen.findByText(/download did not work/i);
    expect(draft().value).toBe(onScreen);

    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    fireEvent.click(screen.getByRole("button", { name: /save to packet/i }));
    await screen.findByText(/could not be saved/i);
    expect(draft().value).toBe(onScreen);
    vi.restoreAllMocks();
  });
});
