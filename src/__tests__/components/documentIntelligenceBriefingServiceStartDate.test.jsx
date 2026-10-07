/**
 * ADR-007 W1/F8: the Muster Call review modal's serviceStartDate handling.
 * Identity (serviceStartDate/serviceStartDateDerived) now stays on the
 * original extraction in the Verify & Save payload - a correction is sent
 * separately as serviceEntryCorrection, only for a genuine typed edit
 * (never a conflict pick), and the live "(calculated from net service)"/
 * "(your saved correction)" marker distinguishes a real edit from a
 * previously-saved correction this exact document was re-imported with.
 * Fixture values are synthetic, not any real veteran's data.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DocumentIntelligenceBriefing from "../../components/DocumentIntelligenceBriefing.jsx";
import { detectConflicts } from "../../utils/conflictDetector";

vi.mock("../../utils/conflictDetector", () => ({
  detectConflicts: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../utils/ocr", () => ({
  formatFileSize: (bytes) => `${bytes} bytes`,
}));

function renderBriefing(extractedData, overrides = {}) {
  const onVerify = vi.fn();
  render(
    <DocumentIntelligenceBriefing
      conflicts={[]}
      extractionResult={{
        filename: "ngb22.pdf",
        size: 1024,
        classification: { type: "service_record", confidence: 90 },
        extractedData,
        pageCount: 1,
        method: "ocr",
        visionUsed: false,
        confidence: 90,
        ...overrides,
      }}
      onVerify={onVerify}
      onSkip={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  return onVerify;
}

async function checkAllFields() {
  await waitFor(() => {
    expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0);
  });
  const fieldCheckboxes = screen
    .getAllByRole("checkbox")
    .filter((cb) => !cb.checked);
  for (const cb of fieldCheckboxes) {
    fireEvent.click(cb);
  }
}

// The conflict banner also echoes both candidate values verbatim, so a
// broad findByText for a date can match more than the field's own
// displayed value - this reads only the field's own <span>.
function fieldDisplayValue() {
  return document.querySelector(".font-mono")?.textContent;
}

async function clickVerifyAndSave(onVerify) {
  await checkAllFields();
  const saveBtn = await screen.findByRole("button", { name: /Verify & Save/ });
  await waitFor(() => expect(saveBtn).toBeEnabled());
  fireEvent.click(saveBtn);
  await waitFor(() => expect(onVerify).toHaveBeenCalled());
  return onVerify.mock.calls[0][0];
}

describe("[F8a] a typed edit clears the marker and emits serviceEntryCorrection", () => {
  it("updates the displayed value, clears the marker, and sends a correction", async () => {
    const onVerify = renderBriefing({
      serviceStartDate: "2002-03-05",
      serviceStartDateDerived: true,
    });

    expect(
      await screen.findByText(/calculated from net service/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("[Edit]"));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "2001-11-01" },
    });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => expect(fieldDisplayValue()).toBe("2001-11-01"));
    expect(
      screen.queryByText(/calculated from net service/),
    ).not.toBeInTheDocument();

    const payload = await clickVerifyAndSave(onVerify);
    expect(payload.verifiedData.serviceStartDate).toBe("2001-11-01");
    expect(payload.verifiedData.serviceStartDateDerived).toBeUndefined();
    expect(payload.serviceEntryCorrection).toMatchObject({
      date: "2001-11-01",
      documentStartDate: "2002-03-05",
    });
  });

  it("[F8c] editing back to the original restores the marker and sends no correction", async () => {
    const onVerify = renderBriefing({
      serviceStartDate: "2002-03-05",
      serviceStartDateDerived: true,
    });

    fireEvent.click(screen.getByText("[Edit]"));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "2001-11-01" },
    });
    fireEvent.click(screen.getByText("Save"));
    await screen.findByText(/2001-11-01/);

    fireEvent.click(screen.getByText("[Edit]"));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "2002-03-05" },
    });
    fireEvent.click(screen.getByText("Save"));

    expect(
      await screen.findByText(/calculated from net service/),
    ).toBeInTheDocument();

    const payload = await clickVerifyAndSave(onVerify);
    expect(payload.serviceEntryCorrection).toBeUndefined();
  });

  it("leaves serviceStartDateDerived untouched when the field is verified without being edited", async () => {
    const onVerify = renderBriefing({
      serviceStartDate: "2002-03-05",
      serviceStartDateDerived: true,
    });

    const payload = await clickVerifyAndSave(onVerify);
    expect(payload.verifiedData.serviceStartDate).toBe("2002-03-05");
    expect(payload.verifiedData.serviceStartDateDerived).toBeUndefined();
    expect(payload.serviceEntryCorrection).toBeUndefined();
  });
});

describe("[F8b] a conflict pick updates the displayed value and emits no correction", () => {
  it("keeps the existing value with no serviceEntryCorrection", async () => {
    detectConflicts.mockResolvedValueOnce([
      {
        field: "serviceStartDate",
        fieldLabel: "Service Start Date",
        existing: "1999-01-01",
        newValue: "2002-03-05",
        message: "This document disagrees with your saved record.",
      },
    ]);
    const onVerify = renderBriefing({
      serviceStartDate: "2002-03-05",
      serviceStartDateDerived: false,
    });

    fireEvent.click(await screen.findByText("Keep Existing"));
    await waitFor(() => expect(fieldDisplayValue()).toBe("1999-01-01"));

    const payload = await clickVerifyAndSave(onVerify);
    expect(payload.verifiedData.serviceStartDate).toBe("1999-01-01");
    expect(payload.serviceEntryCorrection).toBeUndefined();
  });

  it("uses the new value with no serviceEntryCorrection", async () => {
    detectConflicts.mockResolvedValueOnce([
      {
        field: "serviceStartDate",
        fieldLabel: "Service Start Date",
        existing: "1999-01-01",
        newValue: "2002-03-05",
        message: "This document disagrees with your saved record.",
      },
    ]);
    const onVerify = renderBriefing({
      serviceStartDate: "2002-03-05",
      serviceStartDateDerived: false,
    });

    fireEvent.click(await screen.findByText("Use New Value"));
    await waitFor(() => expect(fieldDisplayValue()).toBe("2002-03-05"));

    const payload = await clickVerifyAndSave(onVerify);
    expect(payload.verifiedData.serviceStartDate).toBe("2002-03-05");
    expect(payload.serviceEntryCorrection).toBeUndefined();
  });
});

describe("[F8f] retyping the document's own value undoes a saved correction", () => {
  it("emits a serviceEntryCorrection and shows the calculated marker instead of silently keeping the saved correction", async () => {
    const onVerify = renderBriefing(
      { serviceStartDate: "2002-03-05", serviceStartDateDerived: true },
      {
        priorServiceStartCorrection: {
          date: "2001-11-01",
          documentDate: "2002-03-05",
        },
      },
    );

    expect(await screen.findByText(/2001-11-01/)).toBeInTheDocument();
    expect(screen.getByText(/your saved correction/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("[Edit]"));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "2002-03-05" },
    });
    fireEvent.click(screen.getByText("Save"));

    expect(
      await screen.findByText(/calculated from net service/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/your saved correction/)).not.toBeInTheDocument();

    const payload = await clickVerifyAndSave(onVerify);
    expect(payload.serviceEntryCorrection).toMatchObject({
      date: "2002-03-05",
      documentStartDate: "2002-03-05",
    });
  });
});

describe("[G11] deleting an array item regroups from the current filteredData", () => {
  it("keeps the remaining item visible after deleting one from a two-item array field", async () => {
    renderBriefing({
      serviceStartDate: "2002-03-05",
      awards: ["Purple Heart", "Army Commendation Medal"],
    });

    await screen.findByText("• Purple Heart");
    const [firstDelete] = await screen.findAllByLabelText(
      "Remove this item (OCR error?)",
    );
    fireEvent.click(firstDelete);

    await waitFor(() =>
      expect(screen.queryByText("• Purple Heart")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("• Army Commendation Medal")).toBeInTheDocument();
  });
});

describe("[F8d] a seeded prior correction shows its own marker, not the calculated one", () => {
  it("pre-fills the field with the prior correction and labels it accordingly", async () => {
    renderBriefing(
      { serviceStartDate: "2002-03-05", serviceStartDateDerived: true },
      {
        priorServiceStartCorrection: {
          date: "2001-11-01",
          documentDate: "2002-03-05",
        },
      },
    );

    expect(await screen.findByText(/2001-11-01/)).toBeInTheDocument();
    expect(screen.getByText(/your saved correction/)).toBeInTheDocument();
    expect(
      screen.queryByText(/calculated from net service/),
    ).not.toBeInTheDocument();
  });
});
