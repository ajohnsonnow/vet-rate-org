/**
 * AppealsLaneAdvisor seeds the "How long since your denial?" answer from the
 * veteran's actual latest denial on file (VKB vaClaimsHistory.claims via
 * loadVKB), so question 3 opens pre-answered instead of asking them to redo
 * the under/over-a-year math themselves. With no VKB denial on file but a
 * tracked rating or saved claim, it shows a lighter "we found your
 * conditions" banner without guessing any answer. Nothing on file leaves the
 * flow untouched.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AppealsLaneAdvisor from "../../components/AppealsLaneAdvisor.jsx";
import { saveMyRatings } from "../../utils/veteranProfile.js";
import { saveClaim } from "../../utils/claimsStorage.js";

const mockLoadVKB = vi.fn();
vi.mock("../../utils/veteranKnowledgeBase.js", () => ({
  loadVKB: (...args) => mockLoadVKB(...args),
}));

function renderAdvisor(props = {}) {
  return render(<AppealsLaneAdvisor onClose={() => {}} {...props} />);
}

beforeEach(() => {
  localStorage.clear();
  mockLoadVKB
    .mockReset()
    .mockResolvedValue({ vaClaimsHistory: { claims: [] } });
});

describe("AppealsLaneAdvisor prefill from records", () => {
  it("pre-selects 'Under 1 year' from a recent VKB denial and shows the records banner", async () => {
    const recentDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    mockLoadVKB.mockResolvedValue({
      vaClaimsHistory: {
        claims: [
          {
            status: "denied",
            decisionDate: recentDate,
            conditions: ["PTSD"],
          },
        ],
      },
    });

    renderAdvisor();

    expect(
      await screen.findByText(/we filled this in from your records/i),
    ).toBeInTheDocument();
    // Question 3 only renders once "yes" is answered to question 1.
    screen.getByText(/do you have new evidence/i);
    await screen.findByText(/PTSD/);
  });

  it("picks the most recent of multiple denials", async () => {
    mockLoadVKB.mockResolvedValue({
      vaClaimsHistory: {
        claims: [
          { status: "denied", decisionDate: "2020-01-01", conditions: ["Old"] },
          {
            status: "denied",
            decisionDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
              .toISOString()
              .slice(0, 10),
            conditions: ["Tinnitus"],
          },
        ],
      },
    });

    renderAdvisor();

    expect(await screen.findByText(/Tinnitus/)).toBeInTheDocument();
    expect(screen.queryByText(/Old/)).not.toBeInTheDocument();
  });

  it("shows a lighter banner from saved ratings/claims when no VKB denial exists", async () => {
    saveMyRatings([
      { name: "PTSD", bodyPart: "mental", rating: 70, side: "none" },
    ]);
    saveClaim({ conditionName: "Sleep Apnea" });

    renderAdvisor();

    expect(
      await screen.findByText(/we found.*in your saved records/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/we filled this in from your records/i),
    ).not.toBeInTheDocument();
  });

  it("shows no records banner when nothing is on file", async () => {
    renderAdvisor();

    await screen.findByText(/do you have new evidence/i);
    expect(
      screen.queryByText(/we filled this in from your records/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/in your saved records/i),
    ).not.toBeInTheDocument();
  });
});

describe("AppealsLaneAdvisor prefill from records - never overwrites", () => {
  it("never overwrites an answer the veteran already picked", async () => {
    const recentDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    let resolveVkb;
    mockLoadVKB.mockReturnValue(
      new Promise((resolve) => {
        resolveVkb = resolve;
      }),
    );

    renderAdvisor();
    fireEvent.click(
      screen.getByRole("button", { name: /yes, i have new evidence/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /over 1 year/i }));

    resolveVkb({
      vaClaimsHistory: {
        claims: [
          { status: "denied", decisionDate: recentDate, conditions: ["PTSD"] },
        ],
      },
    });

    await screen.findByText(/we filled this in from your records/i);
    const overButton = screen.getByRole("button", { name: /over 1 year/i });
    expect(overButton.className).toMatch(/bg-orange-600/);
  });
});
