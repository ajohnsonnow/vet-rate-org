import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import IgnoredRatingsNotice from "./IgnoredRatingsNotice";
import BilateralIssuesSummary from "./BilateralIssuesSummary";
import TacticalCalculator from "./TacticalCalculator";
import { LanguageProvider } from "../contexts/LanguageContext";
import { calculateVARating } from "../utils/vaCalculator";
import { APP_TRANSLATIONS } from "../i18n/translations";

const UNREADABLE = /could not be read/i;
const list = [
  { id: "a", name: "PTSD", rating: 50, side: "none", bodyPart: "mental" },
  { id: "b", name: "Knee", rating: "severe", side: "none", bodyPart: "knee" },
];

beforeEach(() => {
  localStorage.clear();
});

describe("entries whose rating could not be read are shown, not dropped silently", () => {
  it("names each one in a plain line", () => {
    render(
      <IgnoredRatingsNotice ignored={calculateVARating(list).ignoredEntries} />,
    );
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("Knee");
    expect(notice).toHaveTextContent(UNREADABLE);
    expect(notice).not.toHaveTextContent("PTSD");
  });

  it("renders nothing when every rating was read", () => {
    const { container } = render(
      <IgnoredRatingsNotice
        ignored={calculateVARating([list[0]]).ignoredEntries}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("appears in the short notice other screens use", () => {
    render(<BilateralIssuesSummary conditions={list} />);
    expect(screen.getByText(UNREADABLE)).toBeInTheDocument();
    expect(screen.getByText(/Knee/)).toBeInTheDocument();
  });

  it("appears on the calculator tab", async () => {
    render(
      <LanguageProvider>
        <TacticalCalculator
          onClose={() => {}}
          onReportBug={() => {}}
          capSimulatorResults={[]}
          onClearCapResults={() => {}}
          initialConditions={list}
        />
      </LanguageProvider>,
    );
    expect(await screen.findByText(UNREADABLE)).toBeInTheDocument();
  });

  it("has its text in every locale", () => {
    const entry = APP_TRANSLATIONS.tacticalCalc.ratingUnreadable;
    for (const locale of ["en", "es", "tl", "vi", "ko"]) {
      expect(entry?.[locale]?.length ?? 0).toBeGreaterThan(10);
    }
  });
});
