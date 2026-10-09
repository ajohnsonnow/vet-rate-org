import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getBigThreeStatus,
  getOverallMilestoneProgress,
  recordPhaseAdvanced,
} from "./claimIntegration";

const PROFILE_KEY = "vet_rate_veteran_profile";

function makeEveryReadThrow() {
  vi.spyOn(localStorage, "getItem").mockImplementation(() => {
    throw new Error("storage blocked");
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("claimIntegration with storage that throws on read", () => {
  it("reports no progress instead of throwing when the profile read throws", () => {
    const real = localStorage.getItem.bind(localStorage);
    vi.spyOn(localStorage, "getItem").mockImplementation((key) => {
      if (key === PROFILE_KEY) throw new Error("storage blocked");
      return real(key);
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem("vet_rate_saved_claims", JSON.stringify([{ a: 1 }]));

    const progress = getOverallMilestoneProgress();

    expect(progress.milestones).toEqual(["diagnosis"]);
    expect(progress.milestones).not.toContain("profile");
  });

  it("counts a readable profile as a completed milestone", () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ firstName: "Pat" }));
    expect(getOverallMilestoneProgress().milestones).toContain("profile");
  });

  it("does not count an unreadable profile as a completed milestone", () => {
    localStorage.setItem(PROFILE_KEY, "{not json");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(getOverallMilestoneProgress().milestones).not.toContain("profile");
  });

  it("reads every milestone as empty when all storage reads throw", () => {
    makeEveryReadThrow();
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(getOverallMilestoneProgress().completedCount).toBe(0);
  });

  it("reads the Big 3 status as not met when storage throws", () => {
    makeEveryReadThrow();
    expect(getBigThreeStatus("Tinnitus")).toEqual({
      diagnosis: false,
      event: false,
      nexus: false,
      complete: false,
    });
  });

  it("keeps a copy of a phase history that cannot be parsed, then starts fresh", () => {
    const key = "vet_rate_claim_navigator_phase_advanced";
    localStorage.setItem(key, "{oops");
    recordPhaseAdvanced("c1", "A", "B");
    const history = JSON.parse(localStorage.getItem(key));
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ claimId: "c1", toPhase: "B" });
    expect(localStorage.getItem(`${key}_unreadable_copy`)).toBe("{oops");
  });

  it("leaves the stored phase history untouched when the read throws", () => {
    const key = "vet_rate_claim_navigator_phase_advanced";
    const stored = JSON.stringify([{ claimId: "old", toPhase: "X" }]);
    localStorage.setItem(key, stored);
    const real = localStorage.getItem.bind(localStorage);
    vi.spyOn(localStorage, "getItem").mockImplementation((k) => {
      if (k === key) throw new Error("storage blocked");
      return real(k);
    });
    recordPhaseAdvanced("c1", "A", "B");
    vi.restoreAllMocks();
    expect(localStorage.getItem(key)).toBe(stored);
  });
});
