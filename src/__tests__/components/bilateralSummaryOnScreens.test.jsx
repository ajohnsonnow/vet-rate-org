/**
 * Every screen that shows a combined rating worked out from saved ratings
 * also shows the short bilateral notice when an entry took no factor.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import { saveMyRatings } from "../../utils/veteranProfile.js";
import MillionDollarDashboard from "../../components/MillionDollarDashboard.jsx";
import TimeMachine from "../../components/TimeMachine.jsx";
import StateBenefitHunter from "../../components/StateBenefitHunter.jsx";
import WhatIfSandbox from "../../components/WhatIfSandbox.jsx";

const TITLE = /bilateral factor not applied/i;
const pasted = (name, rating) => ({
  name,
  rating,
  side: "none",
  bodyPart: "other",
});
const UNPAIRED = [
  pasted("Left knee pain", 10),
  pasted("Right knee pain", 10),
  pasted("PTSD", 30),
];
const PAIRED = [
  { name: "Left knee", rating: 10, side: "left", bodyPart: "knee" },
  { name: "Right knee", rating: 10, side: "right", bodyPart: "knee" },
];

const show = (Screen) =>
  render(
    <LanguageProvider>
      <Screen onClose={() => {}} />
    </LanguageProvider>,
  );

beforeEach(() => {
  localStorage.clear();
});

describe.each([
  ["MillionDollarDashboard", MillionDollarDashboard],
  ["TimeMachine", TimeMachine],
  ["StateBenefitHunter", StateBenefitHunter],
])("%s", (_name, Screen) => {
  it("names saved ratings that took no bilateral factor", async () => {
    saveMyRatings(UNPAIRED);
    show(Screen);
    const notice = await screen.findByRole("status", { name: TITLE });
    expect(notice).toHaveTextContent("Left knee pain");
    expect(notice).toHaveTextContent("Right knee pain");
  });

  it("shows no notice when the saved ratings pair up", () => {
    saveMyRatings(PAIRED);
    show(Screen);
    expect(screen.queryByRole("status", { name: TITLE })).toBeNull();
  });
});

describe("WhatIfSandbox", () => {
  it("names scenario entries that took no bilateral factor", async () => {
    saveMyRatings(UNPAIRED);
    show(WhatIfSandbox);
    fireEvent.click(
      await screen.findByRole("button", { name: /load my ratings/i }),
    );
    const notice = await screen.findByRole("status", { name: TITLE });
    expect(notice).toHaveTextContent("Left knee pain");
  });
});
