/**
 * FIX-1: My Packet's combined-rating line used a flat combine over the raw
 * percentages (combineMultipleRatings/roundToNearest10), a second,
 * un-tested combined-rating implementation that ignored bilateral pairing.
 * It now reads through vaCalculator.js's calculateVARating - the same,
 * tested, side-aware implementation the Tactical Calculator uses - so a
 * left+right paired-extremity pair gets the §4.26 bilateral factor instead
 * of being combined as if unrelated.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { VaAuthProvider } from "../../contexts/VaAuthContext.jsx";
import { saveMyRatings, getMyRatings } from "../../utils/veteranProfile.js";
import { calculateVARating } from "../../utils/vaCalculator.js";

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

describe("MyPacket Ratings tab: combined rating via calculateVARating", () => {
  it("combines a left/right paired-extremity pair with the bilateral factor, not a flat combine", async () => {
    saveMyRatings([
      {
        name: "Radiculopathy, left lower extremity",
        bodyPart: "other",
        rating: 20,
        side: "left",
      },
      {
        name: "Radiculopathy, right lower extremity",
        bodyPart: "other",
        rating: 20,
        side: "right",
      },
    ]);
    const saved = getMyRatings();
    const expected = calculateVARating(saved);

    renderMyPacket();
    fireEvent.click(screen.getByText("Ratings"));

    const summary = await screen.findByText(
      `${expected.rawScore}% raw → ${expected.combinedRating}%`,
    );
    expect(summary).toBeInTheDocument();
  });
});
