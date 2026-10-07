/**
 * Pathfinder auto-seeds "Your Current Service-Connected Ratings" from
 * getMyRatings() only, once the consent screen is passed, instead of
 * requiring the "Reload My Ratings" button to be clicked. Saved (pending)
 * claims are NOT auto-seeded here - that's what the separate "Reload from
 * My Packet" button is for. A prop-supplied initialConditions list (the
 * BlueButtonXRay import) must win over the auto-seed, and an empty records
 * store must leave the form at its normal blank default.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Pathfinder from "../../components/Pathfinder.jsx";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { saveMyRatings } from "../../utils/veteranProfile.js";
import { saveClaim } from "../../utils/claimsStorage.js";

// documentAnalyzer pulls in pdfjs-dist, which references DOMMatrix - not
// implemented in jsdom. Pathfinder only uses it behind the file-drop modal,
// not on initial render, so a lightweight mock keeps this file's import
// graph out of these tests without touching Pathfinder.jsx itself.
vi.mock("../../utils/documentAnalyzer.js", () => ({
  analyzeDocument: vi.fn(),
  isFileSupported: () => true,
  getFileTypeLabel: () => "file",
  getAcceptString: () => "",
}));

function renderPathfinder(props = {}) {
  return render(
    <LanguageProvider>
      <Pathfinder {...props} />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("Pathfinder auto-seed from records", () => {
  it("auto-seeds from My Ratings only, with a 'your ratings on file' banner", async () => {
    localStorage.setItem("vetrate_ai_consent", "true");
    saveMyRatings([
      { name: "PTSD", bodyPart: "mental", rating: 70, side: "none" },
    ]);
    saveClaim({ conditionName: "Sleep Apnea", selectedRating: 50 });

    renderPathfinder();

    expect(await screen.findByDisplayValue("PTSD")).toBeInTheDocument();
    expect(
      await screen.findByText(/your ratings on file/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reload my ratings/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reload from my packet/i }),
    ).toBeInTheDocument();
  });

  it("does not put a pending saved claim under Your Current Service-Connected Ratings", async () => {
    localStorage.setItem("vetrate_ai_consent", "true");
    saveMyRatings([
      { name: "PTSD", bodyPart: "mental", rating: 70, side: "none" },
    ]);
    saveClaim({ conditionName: "Sleep Apnea", selectedRating: 50 });

    renderPathfinder();

    await screen.findByDisplayValue("PTSD");
    expect(screen.queryByDisplayValue("Sleep Apnea")).not.toBeInTheDocument();
  });

  it("leaves the form at its blank default when only saved claims (no My Ratings) are on file", async () => {
    localStorage.setItem("vetrate_ai_consent", "true");
    saveClaim({ conditionName: "Sleep Apnea", selectedRating: 50 });

    renderPathfinder();

    expect(
      await screen.findByRole("heading", { name: /current.*ratings/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")[0]).toHaveValue("");
    expect(screen.queryByDisplayValue("Sleep Apnea")).not.toBeInTheDocument();
  });
});

describe("Pathfinder auto-seed from records - edge cases", () => {
  it("leaves the form at its blank default when no records are on file", async () => {
    localStorage.setItem("vetrate_ai_consent", "true");

    renderPathfinder();

    expect(
      await screen.findByRole("heading", { name: /current.*ratings/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")[0]).toHaveValue("");
    expect(screen.queryByDisplayValue("PTSD")).not.toBeInTheDocument();
  });

  it("does not overwrite a prop-supplied initialConditions list with the auto-seed", async () => {
    localStorage.setItem("vetrate_ai_consent", "true");
    saveMyRatings([
      { name: "PTSD", bodyPart: "mental", rating: 70, side: "none" },
    ]);

    renderPathfinder({ initialConditions: [{ name: "Migraines" }] });

    expect(await screen.findByDisplayValue("Migraines")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("PTSD")).not.toBeInTheDocument();
  });

  it("does not auto-seed before the consent screen is passed", () => {
    saveMyRatings([
      { name: "PTSD", bodyPart: "mental", rating: 70, side: "none" },
    ]);

    renderPathfinder();

    expect(
      screen.getByRole("button", { name: /understand.*continue/i }),
    ).toBeInTheDocument();
    expect(screen.queryByDisplayValue("PTSD")).not.toBeInTheDocument();
  });

  it("dedupes My Ratings entries by normalizeConditionName, not raw-string equality", async () => {
    localStorage.setItem("vetrate_ai_consent", "true");
    // Neither name matches a COMMON_CONDITIONS preset or keyword, so both
    // fall through to their raw text - only normalizeConditionName's
    // parenthetical-stripping treats them as the same condition.
    saveMyRatings([
      { name: "Fibromyalgia", bodyPart: "general", rating: 30, side: "none" },
      {
        name: "Fibromyalgia (Chronic)",
        bodyPart: "general",
        rating: 40,
        side: "none",
      },
    ]);

    renderPathfinder();

    expect(await screen.findByDisplayValue("Fibromyalgia")).toBeInTheDocument();
    expect(
      screen.queryByDisplayValue("Fibromyalgia (Chronic)"),
    ).not.toBeInTheDocument();
    // Only one seeded row: "Fibromyalgia" isn't a COMMON_CONDITIONS preset,
    // so its condition field renders as free text - only the % rating
    // dropdown is a combobox.
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
  });

  it("keeps left and right radiculopathy as separate rows instead of dropping one (regression D3)", async () => {
    localStorage.setItem("vetrate_ai_consent", "true");
    // Both fall through mapSavedRatingToCondition's keyword match to the
    // same generic "Radiculopathy" label - only the side (from the saved
    // rating's own `side` field) tells them apart.
    saveMyRatings([
      {
        name: "radiculopathy, left lower extremity (femoral)",
        bodyPart: "other",
        rating: 20,
        side: "left",
      },
      {
        name: "radiculopathy, right lower extremity (femoral)",
        bodyPart: "other",
        rating: 10,
        side: "right",
      },
    ]);

    renderPathfinder();

    expect(
      await screen.findByDisplayValue("Radiculopathy (Left)"),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Radiculopathy (Right)"),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("20%")).toBeInTheDocument();
    expect(screen.getByDisplayValue("10%")).toBeInTheDocument();
  });
});

describe("Pathfinder auto-seed with real VA condition wording", () => {
  it("keeps a spine rating whose claimed-as note mentions 'post traumatic' next to PTSD", async () => {
    localStorage.setItem("vetrate_ai_consent", "true");
    saveMyRatings([
      {
        name: "Post-traumatic stress disorder (formerly evaluated as panic disorder without agoraphobia)",
        bodyPart: "other",
        rating: 30,
        side: "none",
      },
      {
        name: "lumbosacral strain, degenerative disc disease (previously rated as lumbago) (claimed as osteoarthritis, post traumatic, mid lower back thoracolumbar spine)",
        bodyPart: "other",
        rating: 20,
        side: "none",
      },
    ]);

    renderPathfinder();

    expect(await screen.findByDisplayValue("30%")).toBeInTheDocument();
    expect(screen.getByDisplayValue("20%")).toBeInTheDocument();
  });

  it("keeps a hip rating 'associated with' the spine as its own condition", async () => {
    localStorage.setItem("vetrate_ai_consent", "true");
    saveMyRatings([
      {
        name: "Left hip limited adduction associated with lumbosacral strain, degenerative disc disease other than intervertebral disc syndrome",
        bodyPart: "other",
        rating: 10,
        side: "left",
      },
    ]);

    renderPathfinder();

    expect(await screen.findByDisplayValue("10%")).toBeInTheDocument();
    expect(
      screen.queryByDisplayValue(/degenerative disc disease \(left\)/i),
    ).not.toBeInTheDocument();
  });
});

describe("Pathfinder consent screen: focus management", () => {
  it("moves focus onto the ratings heading after consent, not off the dialog (regression D10)", async () => {
    renderPathfinder();

    const consentButton = screen.getByRole("button", {
      name: /understand.*continue/i,
    });
    fireEvent.click(consentButton);

    const heading = await screen.findByRole("heading", {
      name: /current.*ratings/i,
    });
    expect(heading).toHaveFocus();
  });
});
