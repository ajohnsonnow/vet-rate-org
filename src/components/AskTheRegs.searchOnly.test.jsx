import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const ai = vi.hoisted(() => ({ small: true }));
vi.mock("../utils/unifiedAIService", () => ({
  generateAI: vi.fn(),
  getAIStatus: () => ({
    effectiveMode: "swarm",
    swarmAvailable: true,
    swarmStatus: {
      model: ai.small ? "Qwen3.5-2B-q4f16_1-MLC" : "Qwen3.5-4B-q4f16_1-MLC",
    },
  }),
  isAnyAIAvailable: () => true,
}));
vi.mock("./AIModeSelector", () => ({ AIStatusBadge: () => null }));
const passages = [
  {
    citation: "38 CFR § 3.309",
    title: "§ 3.309 Disease subject to presumptive service connection.",
    text: "Chronic diseases shall be granted service connection.",
    source_url: "https://www.ecfr.gov/x",
    fetched_at: "2026-01-01",
    score: 0.7,
  },
  {
    citation: "38 CFR § 4.47-4.54",
    title: "§§ 4.47-4.54 [Reserved]",
    text: "[Reserved]",
    source_url: "https://www.ecfr.gov/y",
    fetched_at: "2026-01-01",
    score: 0.9,
  },
];
vi.mock("../services/legalAnswerer", () => ({
  retrieveRegulationText: vi.fn(async () => passages),
  answer: vi.fn(async () => ({
    answer: "A model answer.",
    citations: [
      {
        citation: "38 CFR § 4.25",
        title: "§ 4.25 Combined ratings table.",
        text: "x",
        source_url: "https://www.ecfr.gov/z",
        fetched_at: "2026-01-01",
      },
    ],
  })),
}));

import AskTheRegs from "./AskTheRegs";
import { MODEL_ANSWER_CAVEAT } from "../utils/modelAnswerCaveat";
import {
  SEARCH_RESULTS_LABEL,
  REGULATION_SEARCH_DISCLOSURE,
} from "../utils/regulationSearchNotes";

async function ask() {
  render(<AskTheRegs onClose={() => {}} />);
  fireEvent.change(screen.getByLabelText("Your question"), {
    target: { value: "sleep apnea service connection" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
}

beforeEach(() => {
  ai.small = true;
});

describe("Ask the Regs on a small-class model: a search the veteran asked for", () => {
  it("labels the results honestly", async () => {
    await ask();
    await screen.findByText(/Search results from the regulations/);
    expect(SEARCH_RESULTS_LABEL).toBe(
      "Search results from the regulations. These are the closest text matches and may not be about your question. Read the section heading before relying on one.",
    );
    expect(screen.getByRole("note").textContent).toContain(
      SEARCH_RESULTS_LABEL,
    );
  });

  it("shows each passage's section number and heading above its text", async () => {
    await ask();
    const heading = await screen.findByRole("heading", {
      name: /38 CFR § 3\.309/,
    });
    expect(heading.textContent).toMatch(/Disease subject to presumptive/);
    const text = screen.getByText(/Chronic diseases shall be granted/);
    expect(
      heading.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows no model-written line on search results: no model wrote them", async () => {
    await ask();
    await screen.findByText(/Chronic diseases/);
    expect(document.body.textContent).not.toContain(MODEL_ANSWER_CAVEAT);
  });

  it("never shows a [Reserved] section", async () => {
    await ask();
    await screen.findByText(/Chronic diseases/);
    expect(document.body.textContent).not.toMatch(/Reserved/);
    expect(document.body.textContent).not.toContain("4.47-4.54");
  });

  it("discloses the first-use download of the search model", async () => {
    await ask();
    await screen.findByText(/Chronic diseases/);
    expect(document.body.textContent).toContain(REGULATION_SEARCH_DISCLOSURE);
    expect(REGULATION_SEARCH_DISCLOSURE).toMatch(/Hugging Face/);
    expect(REGULATION_SEARCH_DISCLOSURE).toMatch(/about 34 MB/);
    expect(REGULATION_SEARCH_DISCLOSURE).toMatch(
      /your question is not sent there/i,
    );
  });

  it("says nothing was found when every hit is a reserved section", async () => {
    const { retrieveRegulationText } =
      await import("../services/legalAnswerer");
    retrieveRegulationText.mockResolvedValueOnce([passages[1]]);
    await ask();
    await waitFor(() =>
      expect(document.body.textContent).toMatch(/found no regulation text/),
    );
  });
});

describe("Ask the Regs when a larger model answers", () => {
  it("keeps its answer with the sources listed, and shows no search-results label", async () => {
    ai.small = false;
    await ask();
    await screen.findByText("A model answer.");
    expect(document.body.textContent).toContain("38 CFR § 4.25");
    expect(document.body.textContent).not.toContain(SEARCH_RESULTS_LABEL);
  });

  it("adds the fixed line that an on-device model wrote the answer", async () => {
    ai.small = false;
    await ask();
    await screen.findByText("A model answer.");
    expect(screen.getByText(MODEL_ANSWER_CAVEAT)).toBeTruthy();
  });
});
