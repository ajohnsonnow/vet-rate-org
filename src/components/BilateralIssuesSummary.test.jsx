import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BilateralIssuesSummary from "./BilateralIssuesSummary";
import { saveMyRatings } from "../utils/veteranProfile";

const pasted = (name, rating) => ({
  name,
  rating,
  side: "none",
  bodyPart: "other",
});
const TITLE = /bilateral factor not applied/i;

beforeEach(() => {
  localStorage.clear();
});

describe("BilateralIssuesSummary", () => {
  it("names the saved ratings that got no bilateral factor and links to the calculator", () => {
    saveMyRatings([
      pasted("Left knee pain", 10),
      pasted("Right knee pain", 10),
      pasted("PTSD", 30),
    ]);
    const opened = vi.fn();
    window.addEventListener("openTacticalCalculator", opened);

    render(<BilateralIssuesSummary />);
    const notice = screen.getByRole("status", { name: TITLE });
    expect(notice).toHaveTextContent("Left knee pain");
    expect(notice).toHaveTextContent("Right knee pain");
    expect(notice).not.toHaveTextContent("PTSD");

    fireEvent.click(
      screen.getByRole("button", { name: /tactical calculator/i }),
    );
    expect(opened).toHaveBeenCalledTimes(1);
    window.removeEventListener("openTacticalCalculator", opened);
  });

  it("uses the conditions it is given instead of the saved ratings", () => {
    saveMyRatings([pasted("PTSD", 30)]);
    render(
      <BilateralIssuesSummary
        conditions={[
          pasted("Left ankle pain", 10),
          pasted("Right ankle pain", 10),
        ]}
      />,
    );
    expect(screen.getByRole("status", { name: TITLE })).toHaveTextContent(
      "Left ankle pain",
    );
  });

  it("renders nothing when every entry is accounted for", () => {
    saveMyRatings([
      { name: "Left knee", rating: 10, side: "left", bodyPart: "knee" },
      { name: "Right knee", rating: 10, side: "right", bodyPart: "knee" },
    ]);
    const { container } = render(<BilateralIssuesSummary />);
    expect(container).toBeEmptyDOMElement();
  });

  it("takes its text from the translate function it is given", () => {
    const t = (section, key) => `${section}.${key}`;
    render(
      <BilateralIssuesSummary
        t={t}
        conditions={[
          pasted("Left knee pain", 10),
          pasted("Right knee pain", 10),
        ]}
      />,
    );
    expect(
      screen.getByRole("status", { name: "tacticalCalc.bilateralIssuesTitle" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "tacticalCalc.title" }),
    ).toBeInTheDocument();
  });
});
