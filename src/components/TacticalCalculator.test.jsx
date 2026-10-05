import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "../contexts/LanguageContext";
import TacticalCalculator from "./TacticalCalculator";
import { APP_TRANSLATIONS } from "../i18n/translations";
import { saveMyRatings } from "../utils/veteranProfile";

afterEach(() => {
  localStorage.clear();
  document.body.classList.remove("modal-open");
});

function renderCalculator(props = {}) {
  return render(
    <LanguageProvider>
      <TacticalCalculator
        onClose={() => {}}
        onReportBug={() => {}}
        capSimulatorResults={[]}
        onClearCapResults={() => {}}
        {...props}
      />
    </LanguageProvider>,
  );
}

describe("TacticalCalculator", () => {
  it("renders without crashing", async () => {
    renderCalculator();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("lets a veteran add a condition and see it in the list", async () => {
    renderCalculator();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    const bodyPartSelect = screen.getByLabelText(/body part/i);
    fireEvent.change(bodyPartSelect, { target: { value: "knee" } });

    const addButton = screen.getByRole("button", {
      name: /add to calculator/i,
    });
    fireEvent.click(addButton);

    expect(screen.getAllByText(/knee/i).length).toBeGreaterThan(0);
  });

  it("tells the veteran which sided conditions got no bilateral factor and why", async () => {
    renderCalculator({
      initialConditions: [
        {
          id: "a",
          name: "Condition A",
          rating: 20,
          side: "left",
          bodyPart: "other",
        },
        {
          id: "b",
          name: "Right knee",
          rating: 20,
          side: "right",
          bodyPart: "knee",
        },
      ],
    });
    const notice = await screen.findByRole("status", {
      name: /bilateral factor not applied/i,
    });
    expect(notice).toHaveTextContent("Condition A");
    expect(notice).toHaveTextContent(/arm or a leg condition/i);
    expect(notice).not.toHaveTextContent("Right knee");
  });

  it("shows no bilateral notice when a left and right knee pair up", async () => {
    renderCalculator({
      initialConditions: [
        {
          id: "a",
          name: "Left knee",
          rating: 20,
          side: "left",
          bodyPart: "knee",
        },
        {
          id: "b",
          name: "Right knee",
          rating: 20,
          side: "right",
          bodyPart: "knee",
        },
      ],
    });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: /bilateral factor not applied/i }),
    ).not.toBeInTheDocument();
  });
});

describe("TacticalCalculator My Ratings tab", () => {
  it("shows the bilateral notice for saved ratings, not only on the calculator tab", async () => {
    saveMyRatings([
      { name: "Left knee strain", rating: 10, side: "none", bodyPart: "other" },
      {
        name: "Right knee strain",
        rating: 10,
        side: "none",
        bodyPart: "other",
      },
    ]);
    renderCalculator();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /my ratings/i })[0]);
    const notice = await screen.findByRole("status", {
      name: /bilateral factor not applied/i,
    });
    expect(notice).toHaveTextContent("Left knee strain");
    expect(notice).toHaveTextContent("Right knee strain");
    expect(notice).toHaveTextContent(/no side is set/i);
  });
});

describe("TacticalCalculator bilateral strings", () => {
  it.each([
    "bilateralIssuesTitle",
    "bilateralIssueLimbUnknown",
    "bilateralIssueSideUnknown",
    "bilateralIssueSideNotSet",
    "bilateralIssueSideUnspecified",
    "bilateralIssueSeparateEntry",
    "bilateralIssueSingleEvaluation",
    "bilateralIssueNotChecked",
    "bilateralNotApplied",
    "bilateralHint",
    "bilateralExplanation",
    "whatIfBilateralRule",
  ])("%s has text in every locale", (key) => {
    const entry = APP_TRANSLATIONS.tacticalCalc[key];
    for (const locale of ["en", "es", "tl", "vi", "ko"]) {
      expect(entry?.[locale]?.length ?? 0).toBeGreaterThan(10);
    }
  });
});

describe("TacticalCalculator side hint", () => {
  it.each(["bilateralHint", "bilateralExplanation"])(
    "%s states the rule as 38 CFR 4.26(a) does, not as the same condition on both sides",
    (key) => {
      const entry = APP_TRANSLATIONS.tacticalCalc[key];
      expect(entry.en).toContain("each arm, or each leg");
      expect(entry.en).toContain("do not have to be the same condition");
      expect(entry.en).not.toMatch(/same condition on both/i);
      for (const locale of ["es", "tl", "vi", "ko"]) {
        expect(entry[locale]).not.toBe(entry.en);
        expect(entry[locale]).toContain("38 CFR § 4.26");
      }
      expect(entry.es).not.toContain("la misma condición en ambos lados");
    },
  );
});

describe("TacticalCalculator What-If tab", () => {
  it("What-If pairs the proposed condition by its own body part and side", async () => {
    renderCalculator({
      initialConditions: [
        {
          id: "a",
          name: "Left shoulder",
          rating: 20,
          side: "left",
          bodyPart: "shoulder",
        },
      ],
    });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /what-if/i })[0]);

    expect(
      screen.getByText(/both arms or both legs have a compensable rating/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/bilateral factor boost/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/raw score: 44%/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/body part/i), {
      target: { value: "elbow" },
    });
    fireEvent.change(screen.getByLabelText(/^side$/i), {
      target: { value: "right" },
    });
    expect(screen.getByText(/raw score: 48%/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/body part/i), {
      target: { value: "knee" },
    });
    expect(screen.getByText(/raw score: 44%/i)).toBeInTheDocument();
  });
});

describe("TacticalCalculator bilateral claims follow the calculator result", () => {
  const knee = (id, side) => ({
    id,
    name: `Knee ${id}`,
    rating: 20,
    side,
    bodyPart: "knee",
  });
  const rightShoulder = {
    id: "s",
    name: "Shoulder s",
    rating: 20,
    side: "right",
    bodyPart: "shoulder",
  };
  const BADGE = /bilateral \(/i;
  const WILL_APPLY = /bilateral factor will apply/i;
  const NOT_APPLIED = /no bilateral factor for this condition as entered/i;

  it("shows the side without a bilateral badge when the entry is not in the group", async () => {
    renderCalculator({ initialConditions: [knee("a", "left"), rightShoulder] });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText(BADGE)).not.toBeInTheDocument();
    expect(screen.getByText("Left")).toBeInTheDocument();
    expect(screen.getByText("Right")).toBeInTheDocument();
  });

  it("shows the bilateral badge on entries the calculator grouped", async () => {
    renderCalculator({
      initialConditions: [knee("a", "left"), knee("b", "right")],
    });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getAllByText(BADGE)).toHaveLength(2);
  });

  it("the edit panel claims the factor only while the edited entry is in the group", async () => {
    renderCalculator({
      initialConditions: [knee("a", "left"), knee("b", "right")],
    });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    expect(await screen.findByText(WILL_APPLY)).toBeInTheDocument();
    expect(screen.queryByText(NOT_APPLIED)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/body part \/ system/i), {
      target: { value: "shoulder" },
    });
    expect(screen.queryByText(WILL_APPLY)).not.toBeInTheDocument();
    expect(screen.getByText(NOT_APPLIED)).toBeInTheDocument();
  });
});
