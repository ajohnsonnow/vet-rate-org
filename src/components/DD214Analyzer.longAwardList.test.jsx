/**
 * The awards row caps at 2,000 characters and ends "and N more", yet every
 * award is saved when the row is ticked. The whole list sits in a disclosure
 * under the row, where the tick is. Award names here are invented.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

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

const { default: ProfileImportConfirmModal } =
  await import("./ProfileImportConfirmModal.jsx");
const { _listImportText, _fullAwardList } = await import("./DD214Analyzer.jsx");

const manyAwards = (count) =>
  Array.from({ length: count }, (_, i) => ({
    name: `Sample Commendation Of Distinguished Invented Service ${String(i + 1).padStart(3, "0")}`,
    deviceCount: (i % 5) + 1,
    devices: i % 3 === 0 ? ["Bronze Service Star", "M Device"] : [],
  }));

function openWith(awards) {
  const result = { branch: "Army", awards };
  const extractedData = { branch: "Army", ..._listImportText(result) };
  render(
    <ProfileImportConfirmModal
      extractedData={extractedData}
      fieldSources={{}}
      fullLists={_fullAwardList(result)}
      currentProfile={{}}
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  return extractedData;
}

describe("a long awards list in the review row", () => {
  it("keeps the one-line summary capped and ending in 'and N more'", () => {
    const row = openWith(manyAwards(70)).awards;

    expect(row.length).toBeLessThanOrEqual(2100);
    expect(row).toMatch(/; and \d+ more$/);
  });

  it("lists all 70 awards in the expanded list", () => {
    const awards = manyAwards(70);
    openWith(awards);

    const summary = screen.getByText(/Show all 70 in Awards and Decorations/);
    const details = summary.closest("details");
    expect(details.open).toBe(false);
    fireEvent.click(summary);
    expect(details.open).toBe(true);

    const list = screen.getByRole("region", {
      name: "All 70 in Awards and Decorations",
    });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(70);
    for (const { name } of awards) {
      expect(list.textContent).toContain(name);
    }
  });

  it("is reachable and operable from the keyboard", () => {
    openWith(manyAwards(70));

    const summary = screen.getByText(/Show all 70 in Awards and Decorations/);
    expect(summary.tagName).toBe("SUMMARY");
    expect(summary.closest("details")).not.toBeNull();
    expect(
      screen.getByRole("region", { name: "All 70 in Awards and Decorations" })
        .tabIndex,
    ).toBe(0);
  });

  it("shows every device kind that the bounded row would cut", () => {
    const devices = Array.from({ length: 8 }, (_, i) => `Device Kind ${i + 1}`);
    const list = _fullAwardList({
      awards: [{ name: "Sample Service Medal", deviceCount: 2, devices }],
    });

    expect(list.awards).toEqual([
      `Sample Service Medal (2nd award) with ${devices.join(", ")}`,
    ]);
  });

  it("offers no list when the row already shows everything", () => {
    expect(_fullAwardList({ awards: manyAwards(3) })).toBeUndefined();
    openWith(manyAwards(3));
    expect(screen.queryByText(/Show all/)).toBeNull();
  });
});
