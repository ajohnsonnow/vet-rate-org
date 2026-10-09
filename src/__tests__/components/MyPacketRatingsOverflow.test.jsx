/**
 * My Packet's Ratings tab renders each saved rating in a row with the
 * condition name and action buttons (Edit/Remove) side by side. A real VA
 * condition name is long enough that, without min-w-0/break-words on the
 * name column, the flex row refuses to let the name shrink and pushes the
 * action buttons off-screen at narrow widths (390px) instead of wrapping
 * the name (regression D6).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { VaAuthProvider } from "../../contexts/VaAuthContext.jsx";
import { saveMyRatings } from "../../utils/veteranProfile.js";

// MyPacket transitively imports pdfjs, which references canvas globals
// jsdom doesn't provide (same pattern as musterCallProcessor.*.test.js).
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};
const { default: MyPacket } = await import("../../components/MyPacket.jsx");

function renderMyPacket() {
  return render(
    <LanguageProvider>
      <VaAuthProvider>
        <MyPacket onClose={() => {}} />
      </VaAuthProvider>
    </LanguageProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("MyPacket Ratings tab: long condition names don't push action buttons off-screen", () => {
  it("lets a long VA condition name wrap instead of forcing the row wider than its dialog", async () => {
    saveMyRatings([
      {
        name: "thoracolumbar strain with degenerative arthritis (previously rated as muscle spasm) (claimed as mid back condition)",
        bodyPart: "other",
        rating: 10,
        side: "none",
      },
    ]);

    renderMyPacket();
    fireEvent.click(screen.getByText("Ratings"));

    const heading = await screen.findByText(/thoracolumbar strain/i);
    expect(heading.className).toContain("min-w-0");
    expect(heading.className).toContain("break-words");
    expect(heading.parentElement.className).toContain("min-w-0");

    // Edit/Remove stay reachable - global CSS already guarantees >=44px
    // buttons; flex-shrink-0 keeps them from being squeezed by the name.
    const editButton = screen.getByRole("button", { name: /edit/i });
    expect(editButton.closest("div").className).toContain("flex-shrink-0");
  });
});
