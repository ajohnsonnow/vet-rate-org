/**
 * Owner decision (F): nothing identifier-related is pre-selected for profile
 * import, a veteran-typed value is offered for import and wins, and no model
 * response, OCR text or extracted identifier is ever written to the console.
 * Fixture values are synthetic.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../utils/documentAnalyzer", () => ({
  OCR_STATES: {},
  getProgressStyling: () => ({}),
  formatFileSize: (bytes) => `${bytes} bytes`,
  isFileSupported: () => true,
  getAcceptString: () => "",
}));
vi.mock("../utils/musterCallProcessor", () => ({
  processFormationDocument: vi.fn(),
  PROCESSING_STATES: { EXTRACTING: "EXTRACTING", COMPLETE: "COMPLETE" },
}));
vi.mock("../utils/smolVLMService", () => ({
  smolVLMService: {},
  isSmolVLMSupported: () => false,
}));

import ProfileImportConfirmModal from "./ProfileImportConfirmModal.jsx";
import {
  _applyRegexSafetyNet,
  _extractResponseContent,
  _parseDd214Json,
  _prepareManualProfileImport,
} from "./DD214Analyzer.jsx";

const IDENTIFIERS = {
  fullName: "FAKETON, JORDAN",
  lastName: "FAKETON",
  firstName: "JORDAN",
  ssnLast4: "6789",
  dateOfBirth: "1984-03-15",
  homeOfRecord: "ANYTOWN, ST",
  homeAddress: "123 MAIN ST, ANYTOWN ST 12345",
};

function renderModal(extractedData, onConfirm = vi.fn()) {
  render(
    <ProfileImportConfirmModal
      extractedData={extractedData}
      currentProfile={{}}
      onConfirm={onConfirm}
      onCancel={vi.fn()}
    />,
  );
  return onConfirm;
}

describe("(F): the import modal never pre-selects an identifier field", () => {
  it("imports the service field but none of the identifiers by default", async () => {
    const onConfirm = renderModal({
      ...IDENTIFIERS,
      serviceStartDate: "2004-01-10",
    });
    fireEvent.click(
      await screen.findByRole("button", { name: /Import Selected Fields/ }),
    );
    const [payload] = onConfirm.mock.calls[0];
    expect(payload.serviceStartDate).toBe("2004-01-10");
    Object.keys(IDENTIFIERS).forEach((key) => {
      expect(payload).not.toHaveProperty(key);
    });
  });

  it("with only identifiers present, nothing is selected and import is blocked", async () => {
    renderModal({ ...IDENTIFIERS });
    expect(await screen.findByText(/No fields selected/)).toBeTruthy();
    screen
      .getAllByRole("checkbox")
      .forEach((box) => expect(box.checked).toBe(false));
  });

  it("a veteran who ticks an identifier and edits it imports the typed value", async () => {
    const onConfirm = renderModal({ fullName: "FAKETON, JORDAN" });
    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.change(screen.getByDisplayValue("FAKETON, JORDAN"), {
      target: { value: "TYPED, VETERAN" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Import Selected Fields/ }),
    );
    expect(onConfirm.mock.calls[0][0]).toEqual({ fullName: "TYPED, VETERAN" });
  });
});

describe("(F): a veteran-typed identifier is offered by the manual import prep", () => {
  it("includes typed identifiers and drops empty ones", () => {
    const setData = vi.fn();
    _prepareManualProfileImport(
      {
        branch: "Army",
        fullName: "TYPED, VETERAN",
        dateOfBirth: "1984-03-15",
        homeOfRecord: "",
        homeAddress: "",
      },
      setData,
      vi.fn(),
      vi.fn(),
      (_a, key) => key,
    );
    const data = setData.mock.calls[0][0];
    expect(data.fullName).toBe("TYPED, VETERAN");
    expect(data.dateOfBirth).toBe("1984-03-15");
    expect(data).not.toHaveProperty("homeOfRecord");
    expect(data).not.toHaveProperty("homeAddress");
  });
});

describe("D20-4: model responses, OCR text and identifiers never reach the console", () => {
  afterEach(() => vi.restoreAllMocks());

  const SENTINEL = "SENTINEL-IDENT-4F2A";

  function spyConsole() {
    return ["log", "info", "debug", "warn", "error"].map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
  }

  function loggedText(spies) {
    return spies
      .flatMap((spy) => spy.mock.calls)
      .map((args) => args.map((a) => String(a?.message ?? a)).join(" "))
      .join("\n");
  }

  it("_extractResponseContent does not log the raw model response", () => {
    const spies = spyConsole();
    _extractResponseContent({ text: `{"fullName":"${SENTINEL}"}` });
    expect(loggedText(spies)).not.toContain(SENTINEL);
  });

  it("_parseDd214Json does not log content, even when parsing fails", () => {
    const spies = spyConsole();
    expect(() =>
      _parseDd214Json(`{"fullName": "${SENTINEL}" oops`, () => "parse error"),
    ).toThrow("parse error");
    expect(spies[4]).toHaveBeenCalled();
    expect(loggedText(spies)).not.toContain(SENTINEL);
  });

  it("_applyRegexSafetyNet does not log OCR text or extracted identifiers", () => {
    const spies = spyConsole();
    _applyRegexSafetyNet(
      { branch: "Army" },
      `1. NAME: ${SENTINEL}, JORDAN\n3. SOCIAL SECURITY: 123-45-6789\n`,
      () => {},
    );
    const logged = loggedText(spies);
    expect(logged).not.toContain(SENTINEL);
    expect(logged).not.toContain("6789");
  });
});
