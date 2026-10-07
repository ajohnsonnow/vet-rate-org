/**
 * D13-5/D13-6: The Tribunal used to leave useFocusTrap's default autoFocus
 * in charge, which lands on the header's AI status badge (the first real
 * focusable element in DOM order - see HeaderCloseSlot) once the
 * `!isInitialized` loading shell gives way to the real header. Focusing
 * that badge shows its Tooltip on a 200ms delay, and while the tooltip is
 * open its own document capture-phase Escape listener swallows Escape
 * before The Tribunal's own dialog Escape handler ever sees it. Moving
 * focus to the dialog heading instead (tabIndex={-1} + ref + focus(), same
 * pattern as FormsHelper's stepHeadingRef) avoids ever focusing the badge
 * on open at all.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("../../utils/claimsStorage.js", () => ({
  getSavedClaims: () => [],
}));
vi.mock("../../utils/unifiedAIService.js", () => ({
  generateAI: vi.fn(),
  getAIStatus: () => ({ anyAvailable: false }),
}));
vi.mock("../../utils/veteranContextProvider.js", () => ({
  getVeteranAIContext: async () => "",
}));
// Real AIModeSelector's Tooltip/status internals aren't owned by this fix -
// a plain focusable button stands in, preserving the one thing this test
// needs to prove: it's a real Tab-reachable candidate that autoFocus would
// otherwise have grabbed, and the heading effect must win over it.
vi.mock("../../components/AIModeSelector.jsx", () => ({
  AIStatusBadge: ({ onClick }) => (
    <button type="button" onClick={onClick} aria-label="No AI configured">
      No AI configured
    </button>
  ),
}));

import TheTribunal from "../../components/TheTribunal.jsx";

beforeEach(() => {
  localStorage.clear();
});

describe("TheTribunal: focus on open", () => {
  it("focuses the dialog heading, not the AI status badge, once initialized", async () => {
    render(<TheTribunal onClose={() => {}} />);

    await waitFor(() => {
      expect(
        screen.getByText("⚖️ The Tribunal", { exact: false }),
      ).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(document.activeElement).toHaveAttribute(
        "id",
        "the-tribunal-title",
      );
    });

    const badge = screen.getByRole("button", { name: /no ai configured/i });
    expect(document.activeElement).not.toBe(badge);
  });

  it("the heading is not in the natural Tab order (tabIndex=-1, focused only programmatically)", async () => {
    render(<TheTribunal onClose={() => {}} />);

    await waitFor(() => {
      expect(document.activeElement).toHaveAttribute(
        "id",
        "the-tribunal-title",
      );
    });

    expect(document.activeElement).toHaveAttribute("tabindex", "-1");
  });
});
