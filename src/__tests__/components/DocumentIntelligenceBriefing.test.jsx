/**
 * Regression: the Muster Call stress spec got stuck forever on any document
 * whose extracted data included an array field (DD214 awards/decorations).
 * ArrayValueField rendered no verification checkbox at all, so
 * allFieldsVerified — which requires every filteredData key to be verified —
 * could never become true. "Verify & Save" stayed disabled with no way to
 * unblock it, silently trapping the user (or the automated test) on this
 * screen indefinitely.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import DocumentIntelligenceBriefing, {
  getAwardsDisplayData,
} from "../../components/DocumentIntelligenceBriefing.jsx";
import { detectConflicts } from "../../utils/conflictDetector";
import { parseDD214Text } from "../../utils/ribbonRackData";
import {
  getShowStateAwards,
  clearVeteranProfile,
} from "../../utils/veteranProfile";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";

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

// Only needed when extractedData.awards carries real .award objects (as
// opposed to the plain strings the other describe blocks in this file use):
// VisualRibbon (rendered by the ribbon rack) reads useLanguage(), which
// throws outside a LanguageProvider.
function renderBriefingWithLanguage(extractedData) {
  return render(
    <LanguageProvider>
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
      />
    </LanguageProvider>,
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

describe("DocumentIntelligenceBriefing — stale async detectConflicts race", () => {
  it("does not let a slow-resolving detectConflicts from document N clobber document N+1's state", async () => {
    let resolveDoc1 = null;
    detectConflicts.mockImplementation((data, type, filename) => {
      if (filename === "doc1.pdf") {
        return new Promise((resolve) => {
          resolveDoc1 = () => resolve([]);
        });
      }
      return Promise.resolve([]);
    });

    const { rerender } = render(
      <DocumentIntelligenceBriefing
        conflicts={[]}
        extractionResult={{
          filename: "doc1.pdf",
          size: 1024,
          classification: { type: "dd214", confidence: 90 },
          extractedData: { firstName: "John" },
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

    // doc1's detectConflicts is now in-flight and NOT yet resolved.
    rerender(
      <DocumentIntelligenceBriefing
        conflicts={[]}
        extractionResult={{
          filename: "doc2.pdf",
          size: 1024,
          classification: { type: "dd214", confidence: 90 },
          extractedData: { status: "approved" },
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

    const saveBtn = await screen.findByRole("button", {
      name: /Verify & Save/,
    });

    const fieldCheckboxes = await waitFor(() => {
      const boxes = screen.getAllByRole("checkbox").filter((cb) => !cb.checked);
      expect(boxes.length).toBeGreaterThanOrEqual(1);
      return boxes;
    });
    for (const cb of fieldCheckboxes) {
      fireEvent.click(cb);
    }

    await waitFor(() => expect(saveBtn).toBeEnabled());

    // NOW doc1's stale detectConflicts resolves, AFTER doc2 was already
    // fully checked off and Verify & Save was enabled — this is the race:
    // does it clobber doc2's state with doc1's stale field set?
    await act(async () => {
      resolveDoc1();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Exact match — a static OCR-hint panel elsewhere always renders
    // "Box 1: First Name Only", which is unrelated to whether doc1's
    // firstName field itself got reintroduced into doc2's field list.
    expect(screen.queryByText("First Name")).not.toBeInTheDocument();
    expect(saveBtn).toBeEnabled();
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

describe("DocumentIntelligenceBriefing — state awards toggle", () => {
  afterEach(() => {
    clearVeteranProfile();
  });

  // Real production-shaped award objects, produced the same way
  // musterCallProcessor.js's parseServiceRecord builds `data.awards`.
  const federalOnly = parseDD214Text(
    "13. DECORATIONS: NATIONAL DEFENSE SERVICE MEDAL",
    "Army",
  );
  const mixed = parseDD214Text(
    "13. DECORATIONS: NATIONAL DEFENSE SERVICE MEDAL STATE OF HAWAII MEDAL OF VALOR",
    "Army",
    "HI",
  );

  it("getAwardsDisplayData includes state awards when showStateAwards is true", () => {
    const { sortedVisualAwards } = getAwardsDisplayData(
      "awards",
      mixed,
      { branch: "Army" },
      true,
    );
    expect(sortedVisualAwards.some((a) => a.award?.scope === "state")).toBe(
      true,
    );
    expect(sortedVisualAwards).toHaveLength(mixed.length);
  });

  it("getAwardsDisplayData hides state awards when showStateAwards is false", () => {
    const { sortedVisualAwards } = getAwardsDisplayData(
      "awards",
      mixed,
      { branch: "Army" },
      false,
    );
    expect(sortedVisualAwards.some((a) => a.award?.scope === "state")).toBe(
      false,
    );
    expect(sortedVisualAwards).toHaveLength(
      mixed.filter((a) => a.award?.scope !== "state").length,
    );
  });

  it("renders a 'Show state awards' toggle only when a state award is present", async () => {
    const withState = renderBriefingWithLanguage({
      firstName: "John",
      awards: mixed,
    });
    await waitFor(() => {
      expect(screen.getByText(/Show state awards/i)).toBeInTheDocument();
    });
    withState.unmount();

    renderBriefingWithLanguage({
      firstName: "John",
      awards: federalOnly,
    });
    await waitFor(() => {
      expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/Show state awards/i)).not.toBeInTheDocument();
  });

  it("defaults to checked (showStateAwards true) and persists false when toggled off", async () => {
    renderBriefingWithLanguage({ firstName: "John", awards: mixed });

    const toggle = await screen.findByLabelText(/Show state awards/i);
    expect(toggle.checked).toBe(true);
    expect(getShowStateAwards()).toBe(true);

    fireEvent.click(toggle);

    await waitFor(() => expect(toggle.checked).toBe(false));
    expect(getShowStateAwards()).toBe(false);
  });
});
