/**
 * TDIU Builder, end to end on the screen: the veteran gets the app-built
 * analysis with the standard-draft notice, whether or not AI is loaded (the
 * form has nothing typed to reword, so no model call is made), edits it in
 * place, and saves what they see. Fixture values are invented.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { STANDARD_DRAFT_NOTE } from "../utils/writerTemplates";

const ai = vi.hoisted(() => ({ available: true }));

vi.mock("../utils/unifiedAIService", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isAnyAIAvailable: () => ai.available,
    getAIStatus: () => ({ statusText: "Local AI" }),
    generateAI: vi.fn(),
  };
});
vi.mock("../utils/veteranContextProvider", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getVeteranAIContext: vi.fn(async () => ""),
    saveAnalysisResults: vi.fn(async () => ({})),
  };
});

const { generateAI } = await import("../utils/unifiedAIService");
const { saveAnalysisResults } = await import("../utils/veteranContextProvider");
const { default: TDIUBuilder } = await import("./TDIUBuilder.jsx");

const BOX_18 = "Statement for Box 18 (VA Form 21-8940)";
const IMPACT = "How this limits your work: Diabetes, Fatigue";
const BLANK_IMPACT =
  "Because of this symptom, [the work tasks this stops you from doing, and how often].";

async function generate() {
  render(<TDIUBuilder onClose={() => {}} />);
  fireEvent.change(screen.getAllByRole("combobox")[0], {
    target: { value: "Diabetes" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Fatigue" }));
  fireEvent.click(screen.getByRole("button", { name: /add this disability/i }));
  fireEvent.click(
    screen.getByRole("button", { name: /continue to work history/i }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: /generate vocational statement/i }),
  );
  await screen.findByLabelText(BOX_18);
}

const expectStandardDraft = () => {
  const notice = screen.getByRole("status", { name: "Draft notice" });
  expect(notice.textContent).toBe(STANDARD_DRAFT_NOTE);
  expect(screen.getByLabelText(IMPACT).value).toBe(BLANK_IMPACT);
  expect(screen.getByLabelText(BOX_18).value).toContain(
    "[the main reasons you cannot keep a job, in your own words]",
  );
  expect(screen.getByRole("checkbox", { name: "Sedentary work" }).checked).toBe(
    false,
  );
  expect(document.body.textContent).not.toMatch(
    /exceed employer tolerance|No reasonable accommodations|8-hour workday/,
  );
};

beforeEach(() => {
  localStorage.clear();
  ai.available = true;
  generateAI.mockReset();
  saveAnalysisResults.mockClear();
});

describe("TDIU Builder gives one draft, AI or no AI", () => {
  it("with no AI loaded", async () => {
    ai.available = false;
    await generate();

    expectStandardDraft();
    expect(generateAI).not.toHaveBeenCalled();
  });

  it("with AI loaded: nothing here is typed, so no model call is made", async () => {
    await generate();

    expectStandardDraft();
    expect(generateAI).not.toHaveBeenCalled();
  });
});

describe("TDIU Builder saves what the veteran sees", () => {
  it("does not save anything until the veteran asks", async () => {
    ai.available = false;
    await generate();
    expect(saveAnalysisResults).not.toHaveBeenCalled();
  });

  it("saves blanks to My Packet as shown and keeps them out of the insights", async () => {
    ai.available = false;
    await generate();
    expect(
      screen.getByRole("status", { name: "Blanks to fill in" }).textContent,
    ).toMatch(/4 blanks are still to be filled in/);

    fireEvent.click(screen.getByRole("button", { name: "Save to My Packet" }));
    await screen.findByText("Saved to My Packet.");

    const saved = saveAnalysisResults.mock.calls[0][0];
    expect(saved.toolName).toBe("TDIU Builder");
    expect(saved.rawText).toContain("[the main reasons you cannot keep a job");
    expect(saved.extractedData.limitations[0].vocational_impact).toBe(
      BLANK_IMPACT,
    );
    expect(saved).not.toHaveProperty("vkbMergeData");
  });

  it("saves the edited text, and the insights once their blanks are gone", async () => {
    ai.available = false;
    await generate();

    fireEvent.change(screen.getByLabelText(BOX_18), {
      target: { value: "I cannot keep a job because I tire within an hour." },
    });
    fireEvent.change(screen.getByLabelText(IMPACT), {
      target: { value: "I have to rest after an hour of any task." },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Heavy work" }));
    expect(
      screen.getByRole("status", { name: "Blanks to fill in" }).textContent,
    ).toMatch(/1 blank is still to be filled in/);

    fireEvent.click(screen.getByRole("button", { name: "Save to My Packet" }));
    await waitFor(() => expect(saveAnalysisResults).toHaveBeenCalledTimes(1));

    const saved = saveAnalysisResults.mock.calls[0][0];
    expect(saved.rawText).toBe(
      "I cannot keep a job because I tire within an hour.",
    );
    expect(saved.extractedData.limitations[0].vocational_impact).toBe(
      "I have to rest after an hour of any task.",
    );
    expect(saved.vkbMergeData).toEqual({
      aiInsights: {
        tdiuSummary: "I cannot keep a job because I tire within an hour.",
        tdiuJobsPrecluded: ["Heavy"],
      },
    });
  });

  it("says so in words when the save fails", async () => {
    ai.available = false;
    saveAnalysisResults.mockRejectedValueOnce(new Error("quota"));
    await generate();

    fireEvent.click(screen.getByRole("button", { name: "Save to My Packet" }));
    expect(
      (await screen.findByRole("status", { name: "Save result" })).textContent,
    ).toBe("Could not save to My Packet. Please try again.");
  });
});
