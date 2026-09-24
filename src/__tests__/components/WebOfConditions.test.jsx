/**
 * WebOfConditions seeds the graph open on one of the veteran's rated
 * conditions (getMyRatings) instead of the blank "how to use" screen, when
 * that condition has an entry in the static CONDITION_WEB knowledge map.
 * No matching/saved rating must leave the graph at its normal empty state.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import WebOfConditions from "../../components/WebOfConditions.jsx";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { saveMyRatings } from "../../utils/veteranProfile.js";

function renderGraph(props = {}) {
  return render(
    <LanguageProvider>
      <WebOfConditions onClose={() => {}} {...props} />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("WebOfConditions seed from My Ratings", () => {
  it("opens already selected on a rated condition that matches the knowledge map", () => {
    saveMyRatings([
      { name: "PTSD", bodyPart: "mental", rating: 70, side: "none" },
    ]);

    renderGraph();

    expect(screen.getByText(/we started you off with/i)).toBeInTheDocument();
    expect(screen.getAllByText("PTSD").length).toBeGreaterThan(0);
  });

  it("matches a condition name loosely (parentheticals/case) the way the calculator's normalizer does", () => {
    saveMyRatings([
      {
        name: "tbi (traumatic brain injury)",
        bodyPart: "head",
        rating: 50,
        side: "none",
      },
    ]);

    renderGraph();

    expect(screen.getByText(/we started you off with/i)).toBeInTheDocument();
  });

  it("matches a real, fully-worded VA letter condition name to its knowledge-map node (regression D4)", () => {
    saveMyRatings([
      {
        name: "Post-traumatic stress disorder (formerly evaluated as panic disorder without agoraphobia and depressive disorder not otherwise specified (NOS))",
        bodyPart: "mental",
        rating: 50,
        side: "none",
      },
    ]);

    renderGraph();

    expect(screen.getByText(/we started you off with/i)).toBeInTheDocument();
    expect(screen.getAllByText("PTSD").length).toBeGreaterThan(0);
  });

  it("leaves the graph at its default unselected state when no rating matches the knowledge map", () => {
    saveMyRatings([
      {
        name: "Some Unmapped Condition",
        bodyPart: "other",
        rating: 20,
        side: "none",
      },
    ]);

    renderGraph();

    expect(
      screen.queryByText(/we started you off with/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText("How to Use")).toBeInTheDocument();
  });

  it("leaves the graph at its default unselected state when no ratings are saved", () => {
    renderGraph();

    expect(
      screen.queryByText(/we started you off with/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText("How to Use")).toBeInTheDocument();
  });
});
