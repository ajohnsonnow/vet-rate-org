/**
 * D14-1 follow-up (final14 QA review, 2026-09-28): DD214PeriodDetailCard's
 * "Source: <filename> (<type>)" line paired the raw, import-order-following
 * sourceDocument with periodDisplayFormType - a STICKY label that reads
 * "NGB22" for as long as any NGB-22 ever contributed to a period,
 * regardless of which document is the current sourceDocument. A code sheet
 * re-imported after an NGB-22 therefore rendered "Source:
 * cfile_codesheet.pdf (NGB22)" - VA's own authoritative code sheet
 * mislabeled with a document type it isn't, the exact S46 bug the raw
 * formType field was fixed to avoid (musterCallProcessor.js's explicit
 * `formType: "Code Sheet"` upsert).
 *
 * Separately, the Service tab's form-type <select> had no "Code Sheet"
 * option, so a controlled value of "Code Sheet" (matching none of its
 * <option>s) fell back to selecting the first option, presenting "DD214
 * (Active Duty)" as fact for a period a code sheet supplied.
 *
 * Fixture values are synthetic.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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

import { DD214PeriodDetailCard, ServicePeriodFieldsB } from "./MyPacket.jsx";

const t = (...keys) => keys.join(".");

// A period whose raw fields were last written by the code sheet re-import,
// but whose sources[] still records the earlier NGB-22 contribution -
// exactly musterCallProcessor.servicePeriodMerge.test.js's item-4 fixture
// shape after a code-sheet re-import.
const CODE_SHEET_AFTER_NGB22_PERIOD = {
  id: "period_1",
  serviceStartDate: "2004-06-25",
  serviceEndDate: "2005-07-18",
  formType: "Code Sheet",
  sourceDocument: "cfile_codesheet.pdf",
  sources: [
    { sourceDocument: "ngb22.pdf", formType: "NGB22" },
    { sourceDocument: "cfile_codesheet.pdf", formType: "Code Sheet" },
  ],
};

describe("DD214PeriodDetailCard: Source line matches the document it names", () => {
  it("labels the code sheet's own filename with its own form type, not the sticky NGB22 classification", () => {
    render(
      <DD214PeriodDetailCard period={CODE_SHEET_AFTER_NGB22_PERIOD} t={t} />,
    );

    expect(
      screen.getByText(/cfile_codesheet\.pdf \(Code Sheet\)/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/cfile_codesheet\.pdf \(NGB22\)/)).toBeNull();
  });

  it("still discloses the NGB-22-backed enlistment as a separate, honestly-worded fact", () => {
    render(
      <DD214PeriodDetailCard period={CODE_SHEET_AFTER_NGB22_PERIOD} t={t} />,
    );

    expect(screen.getByText(/Guard\/Reserve enlistment/)).toBeInTheDocument();
  });

  it("shows no extra note when the raw formType already matches the sticky classification", () => {
    render(
      <DD214PeriodDetailCard
        period={{
          ...CODE_SHEET_AFTER_NGB22_PERIOD,
          formType: "NGB22",
          sourceDocument: "ngb22.pdf",
          sources: [{ sourceDocument: "ngb22.pdf", formType: "NGB22" }],
        }}
        t={t}
      />,
    );

    expect(screen.getByText(/ngb22\.pdf \(NGB22\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Guard\/Reserve enlistment/)).toBeNull();
  });
});

describe("ServicePeriodFieldsB: form-type editor never guesses a value it wasn't given", () => {
  it("selects 'Code Sheet' rather than falling back to the first option (DD214) for a code-sheet-sourced period", () => {
    const { container } = render(
      <ServicePeriodFieldsB
        period={CODE_SHEET_AFTER_NGB22_PERIOD}
        update={() => {}}
        t={t}
      />,
    );

    const formTypeSelect = Array.from(
      container.querySelectorAll("select"),
    ).find((el) => el.querySelector('option[value="Code Sheet"]'));
    expect(formTypeSelect).toHaveValue("Code Sheet");
  });
});
