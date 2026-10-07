/**
 * Forms Helper tick boxes. A global rule (`input { appearance: none }` in
 * index.css) leaves an unstyled check box with no box at all: 0px wide,
 * ticked and unticked alike, focus invisible. jsdom does no layout, so
 * this pins what makes the box show: the native appearance restored on the
 * box itself, a fixed size, a focus ring, and a 44px row to tap.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { fillRequiredOnScreen } from "../helpers/formMarkers";

vi.mock("../../utils/unifiedAIService", async (importOriginal) => ({
  ...(await importOriginal()),
  isAnyAIAvailable: () => false,
  getAIStatus: () => ({ statusText: "No AI", isPrivate: true }),
  generateAI: vi.fn(),
}));

const { default: FormsHelper } =
  await import("../../components/FormsHelper.jsx");

/** Walk the wizard, collecting every tick box it shows on the way. */
function tickBoxesOf(formName) {
  render(
    <LanguageProvider>
      <FormsHelper onClose={() => {}} />
    </LanguageProvider>,
  );
  fireEvent.click(screen.getByText(formName));
  fireEvent.click(screen.getByText("Start Guided Builder"));
  const seen = [];
  const next = () => screen.queryByRole("button", { name: /^next$/i });
  for (let guard = 0; guard < 12; guard++) {
    for (const box of screen.queryAllByRole("checkbox")) {
      seen.push({ box: box.className, row: box.closest("label").className });
    }
    fillRequiredOnScreen(fireEvent.change, fireEvent.click);
    if (!next()) break;
    fireEvent.click(next());
  }
  return seen;
}

beforeEach(() => {
  localStorage.clear();
});

describe.each([
  ["PTSD Stressor Statement", 15],
  ["Priority Processing Request", 1],
  ["Buddy / Lay Statement", 1],
])("Forms Helper tick boxes in %s", (formName, atLeast) => {
  it("each has a visible box, a ticked state, a focus ring and a 44px row", () => {
    const boxes = tickBoxesOf(formName);

    expect(boxes.length).toBeGreaterThanOrEqual(atLeast);
    for (const { box, row } of boxes) {
      expect(box).toContain("[appearance:auto]");
      expect(box).toMatch(/\bh-5\b/);
      expect(box).toMatch(/\bw-5\b/);
      expect(box).toMatch(/\bshrink-0\b/);
      expect(box).toMatch(/\baccent-blue-700\b/);
      expect(box).toMatch(/focus-visible:outline-2/);
      expect(box).toMatch(/focus-visible:outline-blue-700/);
      expect(row).toMatch(/min-h-\[44px\]/);
    }
  });
});
