/**
 * Regression: CombatIndicatorSummary received awards in
 * ribbonRackData.parseDD214Text's shape ({award: {name}, matchedText,
 * devices}) once real DD214s started flowing through the regex extraction
 * path, and crashed the whole intelligence briefing with
 * "(award.name || award).toUpperCase is not a function" (live audit,
 * 2026-08-21). All three award shapes must render.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CombatIndicatorSummary } from "../../components/BadgeDisplay";

describe("CombatIndicatorSummary: award shape tolerance", () => {
  it("renders ribbonRackData-shaped awards without crashing", () => {
    render(
      <CombatIndicatorSummary
        ribbonAwards={[
          {
            award: { id: "combat_action_badge", name: "Combat Action Badge" },
            matchedText: "COMBAT ACTION BADGE",
            devices: [],
            quantity: 1,
          },
        ]}
      />,
    );
    expect(screen.getByText("Combat Action Badge")).toBeInTheDocument();
    expect(screen.getByText(/Combat Service Indicators/)).toBeInTheDocument();
  });

  it("renders stored-profile-shaped and plain-string awards", () => {
    render(
      <CombatIndicatorSummary
        ribbonAwards={[
          { name: "Afghanistan Campaign Medal", isCombat: true },
          "GLOBAL WAR ON TERRORISM EXPEDITIONARY MEDAL",
        ]}
      />,
    );
    expect(screen.getByText("Afghanistan Campaign Medal")).toBeInTheDocument();
    expect(
      screen.getByText("GLOBAL WAR ON TERRORISM EXPEDITIONARY MEDAL"),
    ).toBeInTheDocument();
  });

  it("renders nothing when no award matches a combat keyword", () => {
    const { container } = render(
      <CombatIndicatorSummary
        ribbonAwards={[
          { award: { name: "Good Conduct Medal" }, matchedText: "GCM" },
          { name: "Army Achievement Medal" },
          {},
        ]}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("CombatIndicatorSummary: what actually establishes combat", () => {
  const cabBadge = {
    id: "combat-action-badge",
    name: "Combat Action Badge",
    combatIndicator: true,
  };
  const cabRibbon = {
    award: { id: "combat_action_badge", name: "Combat Action Badge" },
    matchedText: "CAB",
    devices: [],
  };

  it("states the combat presumption and its citation for a Combat Action Badge", () => {
    render(<CombatIndicatorSummary badges={[cabBadge]} />);
    expect(
      screen.getByText(/VA presumes engagement in combat with the enemy/),
    ).toBeInTheDocument();
    expect(screen.getByText(/1\.A\.3\.h/)).toBeInTheDocument();
  });

  it("lists the same decoration once when it arrives as both a badge and a ribbon", () => {
    render(
      <CombatIndicatorSummary badges={[cabBadge]} ribbonAwards={[cabRibbon]} />,
    );
    expect(screen.getAllByText("Combat Action Badge")).toHaveLength(1);
  });

  it("does not claim combat participation from campaign or service medals alone", () => {
    render(
      <CombatIndicatorSummary
        ribbonAwards={[
          { name: "Afghanistan Campaign Medal" },
          { name: "Global War on Terrorism Service Medal" },
          { name: "Overseas Service Ribbon (Army)" },
        ]}
      />,
    );
    expect(
      screen.queryByText(/VA presumes engagement in combat with the enemy/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/corroborates presence, not participation/),
    ).toBeInTheDocument();
  });

  it("establishes combat from a medal that produces no badge match", () => {
    render(
      <CombatIndicatorSummary ribbonAwards={[{ name: "Purple Heart" }]} />,
    );
    expect(
      screen.getByText(/VA presumes engagement in combat with the enemy/),
    ).toBeInTheDocument();
    expect(screen.getByText("Purple Heart")).toBeInTheDocument();
  });

  it("does not treat a Bronze Star without the valor device as combat", () => {
    render(
      <CombatIndicatorSummary
        ribbonAwards={[{ award: { name: "Bronze Star Medal" }, devices: [] }]}
      />,
    );
    expect(
      screen.queryByText(/VA presumes engagement in combat with the enemy/),
    ).not.toBeInTheDocument();
  });
});
