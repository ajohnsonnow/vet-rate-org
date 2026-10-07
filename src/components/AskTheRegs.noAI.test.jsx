import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const ai = vi.hoisted(() => ({ generateAI: vi.fn() }));
vi.mock("../utils/unifiedAIService", () => ({
  generateAI: ai.generateAI,
  getAIStatus: () => ({ effectiveMode: null, swarmStatus: { model: null } }),
  isAnyAIAvailable: () => false,
}));
vi.mock("./AIModeSelector", () => ({ AIStatusBadge: () => null }));
const passages = [
  {
    citation: "38 CFR § 4.26",
    title: "§ 4.26 Bilateral factor.",
    text: "When a partial disability results from disease or injury of both arms.",
    source_url: "https://www.ecfr.gov/x",
    fetched_at: "2026-07-09",
    score: 0.74,
  },
  {
    citation: "38 CFR § 4.47-4.54",
    title: "§§ 4.47-4.54 [Reserved]",
    text: "[Reserved]",
    source_url: "https://www.ecfr.gov/y",
    fetched_at: "2026-07-09",
    score: 0.9,
  },
];
const legal = vi.hoisted(() => ({ retrieve: vi.fn(), answer: vi.fn() }));
vi.mock("../services/legalAnswerer", () => ({
  retrieveRegulationText: legal.retrieve,
  answer: legal.answer,
}));

import AskTheRegs from "./AskTheRegs";
import {
  SEARCH_RESULTS_LABEL,
  REGULATION_SEARCH_DISCLOSURE,
  NEEDS_AI_FOR_ANSWER,
} from "../utils/regulationSearchNotes";

const ask = () => {
  render(<AskTheRegs onClose={() => {}} />);
  fireEvent.change(screen.getByLabelText("Your question"), {
    target: { value: "bilateral factor for both knees" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  legal.retrieve.mockResolvedValue(passages);
});

describe("Ask the Regs with no AI configured", () => {
  it("leaves Ask enabled once there is a question, and says what asking does", () => {
    render(<AskTheRegs onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "Ask" }).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Your question"), {
      target: { value: "x" },
    });
    expect(screen.getByRole("button", { name: "Ask" }).disabled).toBe(false);
    expect(document.body.textContent).toMatch(/still searches the regulations/);
  });

  it("runs the search and shows the search-only view, calling no model", async () => {
    ask();
    await screen.findByText(/When a partial disability/);
    expect(document.body.textContent).toContain(SEARCH_RESULTS_LABEL);
    expect(document.body.textContent).toContain(REGULATION_SEARCH_DISCLOSURE);
    expect(
      screen.getByRole("heading", { name: /38 CFR § 4\.26/ }),
    ).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Reserved/);
    expect(legal.answer).not.toHaveBeenCalled();
    expect(ai.generateAI).not.toHaveBeenCalled();
  });

  it("says in one line that an AI answer needs an AI mode, and where to set it", async () => {
    ask();
    await screen.findByText(/When a partial disability/);
    expect(NEEDS_AI_FOR_ANSWER).toMatch(/AI answer needs an AI mode/);
    expect(NEEDS_AI_FOR_ANSWER).toMatch(/status/);
    expect(document.body.textContent).toContain(NEEDS_AI_FOR_ANSWER);
  });

  it("a failed search shows a plain error with a retry, never a silent no-op", async () => {
    legal.retrieve.mockRejectedValueOnce(new Error("index not loaded"));
    ask();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/search could not run/i);
    legal.retrieve.mockResolvedValueOnce(passages);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText(/When a partial disability/);
    expect(legal.retrieve).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the empty state when the search finds only reserved sections", async () => {
    legal.retrieve.mockResolvedValueOnce([passages[1]]);
    ask();
    await waitFor(() =>
      expect(document.body.textContent).toMatch(/found no regulation text/),
    );
  });
});
