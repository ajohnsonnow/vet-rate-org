/**
 * D11-1: the Muster Call review modal ignored the veteran's edit of a
 * calculated start date. Two independent bugs, both fixed here:
 *  1. handleFieldEdit only updated editedData - the value FieldGroup
 *     actually renders (groupedFields, via filteredData) never changed, so
 *     the display kept showing the ORIGINAL OCR value after Save.
 *  2. Verify & Save built verifiedData from editedData with no check of
 *     whether serviceStartDate itself had actually been edited, so the
 *     veteran's corrected date was stored with serviceStartDateDerived
 *     still true - every downstream reader kept calling it "calculated".
 * Fixture values are synthetic, not any real veteran's data.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DocumentIntelligenceBriefing from "../../components/DocumentIntelligenceBriefing.jsx";

vi.mock("../../utils/conflictDetector", () => ({
  detectConflicts: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../utils/ocr", () => ({
  formatFileSize: (bytes) => `${bytes} bytes`,
}));

function renderBriefing(extractedData, onVerify = vi.fn()) {
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

describe("DocumentIntelligenceBriefing - editing a calculated serviceStartDate", () => {
  it("updates the displayed value after Save, instead of reverting to the original OCR value", async () => {
    renderBriefing({
      serviceStartDate: "2002-03-05",
      serviceStartDateDerived: true,
    });

    expect(await screen.findByText(/2002-03-05/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("[Edit]"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "2001-11-01" } });
    fireEvent.click(screen.getByText("Save"));

    expect(await screen.findByText(/2001-11-01/)).toBeInTheDocument();
    expect(screen.queryByText(/2002-03-05/)).not.toBeInTheDocument();
  });

  it("clears serviceStartDateDerived on Verify & Save once the date was actually edited", async () => {
    const onVerify = renderBriefing({
      serviceStartDate: "2002-03-05",
      serviceStartDateDerived: true,
    });

    fireEvent.click(screen.getByText("[Edit]"));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "2001-11-01" },
    });
    fireEvent.click(screen.getByText("Save"));

    await checkAllFields();
    const saveBtn = await screen.findByRole("button", {
      name: /Verify & Save/,
    });
    await waitFor(() => expect(saveBtn).toBeEnabled());
    fireEvent.click(saveBtn);

    await waitFor(() => expect(onVerify).toHaveBeenCalled());
    const payload = onVerify.mock.calls[0][0];
    expect(payload.verifiedData.serviceStartDate).toBe("2001-11-01");
    expect(payload.verifiedData.serviceStartDateDerived).toBe(false);
  });

  it("leaves serviceStartDateDerived untouched when the field is verified without being edited", async () => {
    const onVerify = renderBriefing({
      serviceStartDate: "2002-03-05",
      serviceStartDateDerived: true,
    });

    await checkAllFields();
    const saveBtn = await screen.findByRole("button", {
      name: /Verify & Save/,
    });
    await waitFor(() => expect(saveBtn).toBeEnabled());
    fireEvent.click(saveBtn);

    await waitFor(() => expect(onVerify).toHaveBeenCalled());
    const payload = onVerify.mock.calls[0][0];
    expect(payload.verifiedData.serviceStartDate).toBe("2002-03-05");
    expect(payload.verifiedData.serviceStartDateDerived).toBeUndefined();
  });
});
