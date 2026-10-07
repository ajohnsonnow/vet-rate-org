/**
 * My Packet's Ratings tab: the two inputs shown when a rating is edited
 * have accessible names, so a screen reader says what each one is for.
 * All values are invented.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { VaAuthProvider } from "../../contexts/VaAuthContext.jsx";
import { saveMyRatings } from "../../utils/veteranProfile.js";

// My Packet imports the PDF reader, whose worker file this test never runs.
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "" }));
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};
const { default: MyPacket } = await import("../../components/MyPacket.jsx");

beforeEach(() => {
  localStorage.clear();
});

describe("My Packet Ratings tab: editing a rating", () => {
  it("names the condition and the percent inputs", () => {
    saveMyRatings([{ id: "r1", name: "Tinnitus", rating: 10 }]);
    render(
      <LanguageProvider>
        <VaAuthProvider>
          <MyPacket onClose={() => {}} />
        </VaAuthProvider>
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Ratings" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const name = screen.getByLabelText("Condition name");
    const percent = screen.getByLabelText("Rating percent");
    expect(name).toHaveValue("Tinnitus");
    expect(percent).toHaveValue(10);
    expect(screen.getByRole("textbox", { name: "Condition name" })).toBe(name);
    expect(screen.getByRole("spinbutton", { name: "Rating percent" })).toBe(
      percent,
    );
  });
});
