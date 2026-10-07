/**
 * Save to Packet works for a condition the veteran typed with nothing saved
 * beforehand, and a save that fails never costs the veteran the draft: the
 * builder stays open with the text intact and a plain message. Fixture
 * values are invented.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import DiscoverCluster from "../../features/discover/DiscoverCluster.jsx";
import {
  getSavedClaims,
  getStatement,
  saveClaim,
  saveStatementForCondition,
} from "../../utils/claimsStorage";

vi.mock("../../utils/aiStatementHelper", async (importOriginal) => ({
  ...(await importOriginal()),
  isAIAvailable: () => false,
}));

const LABEL = "Statement in Support of Claim (VA Form 21-4138)";
const statementField = () => screen.getByRole("textbox", { name: LABEL });
const packetOpened = vi.fn();

async function typeConditionAndReachReview() {
  render(
    <LanguageProvider>
      <DiscoverCluster userConditions={[]} setUserConditions={() => {}} />
    </LanguageProvider>,
  );
  fireEvent(window, new CustomEvent("openNexusBuilder"));
  fireEvent.change(await screen.findByRole("textbox", {}, { timeout: 8000 }), {
    target: { value: "Plantar fasciitis" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  for (let step = 0; step < 5; step++) {
    const next = screen.queryByRole("button", { name: /next step/i });
    if (!next) break;
    fireEvent.click(next);
  }
  const edited = statementField().value.replace(
    "[date the symptoms began]",
    "the spring of 2011",
  );
  fireEvent.change(statementField(), { target: { value: edited } });
  return edited;
}

function certifyAndSave() {
  fireEvent.click(screen.getAllByRole("checkbox").at(-1));
  fireEvent.click(screen.getByRole("button", { name: /save to packet/i }));
}

beforeEach(() => {
  localStorage.clear();
  packetOpened.mockClear();
  window.addEventListener("openMyPacket", packetOpened);
  vi.spyOn(window, "alert").mockImplementation(() => {});
});

afterEach(() => {
  window.removeEventListener("openMyPacket", packetOpened);
  vi.restoreAllMocks();
});

describe("saveStatementForCondition", () => {
  it("creates the claim a typed condition needs, then saves the statement", () => {
    expect(
      saveStatementForCondition({
        condition: "Plantar fasciitis",
        primaryCondition: null,
        statement: "My statement.",
      }),
    ).toBe(true);

    const [claim] = getSavedClaims();
    expect(claim.conditionName).toBe("Plantar fasciitis");
    expect(claim.parentCondition).toBeNull();
    expect(getStatement(claim.id).statement).toBe("My statement.");
  });

  it("saves onto the claim already there, without a second one", () => {
    saveClaim({ conditionName: "Sleep apnea", parentCondition: "PTSD" });
    const [before] = getSavedClaims();

    expect(
      saveStatementForCondition({
        condition: "Sleep apnea",
        primaryCondition: "PTSD",
        statement: "Secondary statement.",
      }),
    ).toBe(true);
    expect(getSavedClaims()).toHaveLength(1);
    expect(getStatement(before.id).statement).toBe("Secondary statement.");
  });

  it("reports failure when storage refuses the write", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(
      saveStatementForCondition({ condition: "Tinnitus", statement: "x" }),
    ).toBe(false);
  });
});

describe("Nexus Builder Save to Packet, typed condition, nothing saved", () => {
  it("saves the statement on screen and opens My Packet", async () => {
    const onScreen = await typeConditionAndReachReview();
    certifyAndSave();

    const [claim] = getSavedClaims();
    expect(claim.conditionName).toBe("Plantar fasciitis");
    expect(getStatement(claim.id).statement).toBe(onScreen);
    expect(packetOpened).toHaveBeenCalledTimes(1);
    expect(window.alert).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("textbox", { name: LABEL }),
    ).not.toBeInTheDocument();
  });

  it("keeps the builder open with the draft and says why when the save fails", async () => {
    const onScreen = await typeConditionAndReachReview();
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    certifyAndSave();

    expect(screen.getByRole("alert").textContent).toMatch(
      /could not be saved/i,
    );
    expect(statementField().value).toBe(onScreen);
    expect(packetOpened).not.toHaveBeenCalled();
    expect(window.alert).not.toHaveBeenCalled();
  });
});
