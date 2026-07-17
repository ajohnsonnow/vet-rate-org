/**
 * Regression: the Muster Call stress spec got stuck forever on any document
 * whose extracted data included an array field (DD214 awards/decorations).
 * ArrayValueField rendered no verification checkbox at all, so
 * allFieldsVerified — which requires every filteredData key to be verified —
 * could never become true. "Verify & Save" stayed disabled with no way to
 * unblock it, silently trapping the user (or the automated test) on this
 * screen indefinitely.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DocumentIntelligenceBriefing from "../../components/DocumentIntelligenceBriefing.jsx";

vi.mock("../../utils/conflictDetector", () => ({
  detectConflicts: vi.fn().mockResolvedValue([]),
}));

// Pulls in pdfjs-dist (needs DOMMatrix, unavailable in jsdom) transitively —
// only formatFileSize is used by the component under test.
vi.mock("../../utils/ocr", () => ({
  formatFileSize: (bytes) => `${bytes} bytes`,
}));

function renderBriefing(extractedData) {
  return render(
    <DocumentIntelligenceBriefing
      conflicts={[]}
      extractionResult={{
        filename: "dd214.pdf",
        size: 1024,
        classification: { type: "dd214", confidence: 90 },
        extractedData,
        pageCount: 1,
        method: "vision",
        visionUsed: true,
        confidence: 90,
      }}
      onVerify={vi.fn()}
      onSkip={vi.fn()}
      onClose={vi.fn()}
    />,
  );
}

describe("DocumentIntelligenceBriefing — array-field verification", () => {
  it("renders a checkbox for an array-valued extracted field", async () => {
    renderBriefing({
      firstName: "John",
      awards: ["Purple Heart", "Army Commendation Medal"],
    });

    await waitFor(() => {
      expect(screen.getAllByRole("checkbox").length).toBeGreaterThanOrEqual(2);
    });
  });

  it("enables Verify & Save once every field — including array fields — is checked", async () => {
    renderBriefing({
      firstName: "John",
      awards: ["Purple Heart", "Army Commendation Medal"],
    });

    const saveBtn = await screen.findByRole("button", {
      name: /Verify & Save/,
    });
    expect(saveBtn).toBeDisabled();

    await waitFor(() => {
      expect(screen.getAllByRole("checkbox").length).toBeGreaterThanOrEqual(2);
    });

    // Only the field-verification checkboxes matter here; saveToVKB /
    // updateProfile default to checked already and must stay untouched.
    const fieldCheckboxes = screen
      .getAllByRole("checkbox")
      .filter((cb) => !cb.checked);
    for (const cb of fieldCheckboxes) {
      fireEvent.click(cb);
    }

    await waitFor(() => expect(saveBtn).toBeEnabled());
  });
});

describe("DocumentIntelligenceBriefing — object-field verification", () => {
  it("renders a readable summary for an object-valued field instead of [object Object]", async () => {
    renderBriefing({
      firstName: "John",
      combatService: {
        hasVerifiedCombat: true,
        indicators: ["Combat Action Badge"],
        deployments: ["Afghanistan 2010-2011"],
      },
    });

    await waitFor(() => {
      expect(screen.queryByText("[object Object]")).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Combat Action Badge/)).toBeInTheDocument();
    expect(screen.getByText(/Has Verified Combat: Yes/)).toBeInTheDocument();
  });

  it("enables Verify & Save once an object-valued field is checked", async () => {
    renderBriefing({
      combatService: {
        hasVerifiedCombat: true,
        indicators: ["Combat Action Badge"],
        deployments: [],
      },
    });

    const saveBtn = await screen.findByRole("button", {
      name: /Verify & Save/,
    });
    expect(saveBtn).toBeDisabled();

    const fieldCheckboxes = await waitFor(() => {
      const boxes = screen.getAllByRole("checkbox").filter((cb) => !cb.checked);
      expect(boxes.length).toBeGreaterThan(0);
      return boxes;
    });
    for (const cb of fieldCheckboxes) {
      fireEvent.click(cb);
    }

    await waitFor(() => expect(saveBtn).toBeEnabled());
  });
});

describe("DocumentIntelligenceBriefing — falsy primitive field verification", () => {
  it("renders a checkbox for a false/0-valued field and lets it be verified", async () => {
    renderBriefing({
      firstName: "John",
      combatZoneService: false,
      dependentCount: 0,
    });

    const saveBtn = await screen.findByRole("button", {
      name: /Verify & Save/,
    });
    expect(saveBtn).toBeDisabled();

    const fieldCheckboxes = await waitFor(() => {
      const boxes = screen.getAllByRole("checkbox").filter((cb) => !cb.checked);
      // firstName + combatZoneService + dependentCount, at minimum.
      expect(boxes.length).toBeGreaterThanOrEqual(3);
      return boxes;
    });
    for (const cb of fieldCheckboxes) {
      fireEvent.click(cb);
    }

    await waitFor(() => expect(saveBtn).toBeEnabled());
  });
});

describe("DocumentIntelligenceBriefing — empty-array field verification", () => {
  it("enables Verify & Save when a field's value is an empty array", async () => {
    renderBriefing({
      firstName: "John",
      // DD214 vision extraction defaults this to [] when nothing is found —
      // it must never enter filteredData if it renders no checkbox to match.
      foreignServiceLocations: [],
    });

    const saveBtn = await screen.findByRole("button", {
      name: /Verify & Save/,
    });

    const fieldCheckboxes = await waitFor(() => {
      const boxes = screen.getAllByRole("checkbox").filter((cb) => !cb.checked);
      expect(boxes.length).toBeGreaterThan(0);
      return boxes;
    });
    for (const cb of fieldCheckboxes) {
      fireEvent.click(cb);
    }

    await waitFor(() => expect(saveBtn).toBeEnabled());
  });
});
