/**
 * Regression: five separate "privacy disclosure" functions (Pathfinder,
 * Forms Helper's AI-statement consent, Shark Radar, Nexus Logic Generator,
 * C-File Analyzer) plus unifiedAIService's own getAIDataDisclosure all
 * decided "is this actually private" by checking
 * `effectiveMode === AI_MODES.LOCAL` — a legacy value getAIMode() actively
 * migrates users away from to AI_MODES.SWARM ("Warrant Council", the
 * default local-AI experience via AI Command Center). Every one of them
 * showed the Cloud (Google Gemini) data-sharing disclosure to a veteran who
 * was actually running 100%-local Swarm/Wllama/local-server inference —
 * confirmed live: Pathfinder showed "⚠️ CLOUD AI MODE (Google Gemini)" next
 * to a "Warrant Council" badge with Local AI already active.
 *
 * Fix: all six now key off `status.isPrivate`
 * (unifiedAIService.getAIStatus's own `effectiveMode !== AI_MODES.CLOUD`),
 * which is the canonical definition already used elsewhere in the app.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./unifiedAIService", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getAIStatus: vi.fn() };
});

import { getAIStatus, AI_MODES } from "./unifiedAIService";
import { getPathfinderPrivacyDisclosure } from "./pathfinderEngine";
import { getAIDataDisclosure } from "./aiStatementHelper";
import { getSharkRadarPrivacyDisclosure } from "./sharkRadar";
import { getNexusLogicPrivacyDisclosure } from "./nexusLogicGenerator";
import { getCFilePrivacyDisclosure } from "./cfileAnalyzer";

// Mirrors what getAIStatus() actually computes for each mode: isPrivate is
// effectiveMode !== AI_MODES.CLOUD, regardless of which specific on-device
// backend is active.
function statusFor(effectiveMode) {
  return {
    effectiveMode,
    isPrivate: effectiveMode !== AI_MODES.CLOUD,
    mode: effectiveMode,
  };
}

const PRIVATE_MODES = [
  ["legacy Local", AI_MODES.LOCAL],
  ["Warrant Council / Swarm", AI_MODES.SWARM],
  ["Wllama", AI_MODES.WLLAMA],
  ["local llama.cpp server", AI_MODES.LOCAL_SERVER],
];

describe.each([
  [
    "Pathfinder",
    getPathfinderPrivacyDisclosure,
    /CLOUD AI MODE/,
    /LOCAL AI MODE/,
  ],
  [
    "Shark Radar",
    getSharkRadarPrivacyDisclosure,
    /CLOUD AI MODE/,
    /LOCAL AI MODE/,
  ],
  [
    "Nexus Logic Generator",
    getNexusLogicPrivacyDisclosure,
    /CLOUD AI MODE/,
    /LOCAL AI MODE/,
  ],
  [
    "C-File Analyzer",
    getCFilePrivacyDisclosure,
    /CLOUD AI MODE/,
    /LOCAL AI MODE/,
  ],
])(
  "%s privacy disclosure",
  (_name, getDisclosure, cloudPattern, localPattern) => {
    it.each(PRIVATE_MODES)(
      "shows the private/local disclosure for %s mode, not the Cloud one",
      (_label, mode) => {
        getAIStatus.mockReturnValue(statusFor(mode));
        const text = getDisclosure();
        expect(text).toMatch(localPattern);
        expect(text).not.toMatch(cloudPattern);
      },
    );

    it("still shows the Cloud disclosure for actual Cloud mode", () => {
      getAIStatus.mockReturnValue(statusFor(AI_MODES.CLOUD));
      const text = getDisclosure();
      expect(text).toMatch(cloudPattern);
      expect(text).not.toMatch(localPattern);
    });
  },
);

describe("Forms Helper AI-statement data disclosure", () => {
  it.each(PRIVATE_MODES)(
    "returns the local disclosure object for %s mode",
    (_label, mode) => {
      getAIStatus.mockReturnValue(statusFor(mode));
      const disclosure = getAIDataDisclosure("personal");
      expect(disclosure.isPrivate ?? disclosure.notShared).toBeTruthy();
      expect(JSON.stringify(disclosure)).not.toMatch(/sent to Google/i);
    },
  );
});

// getAIDataDisclosure calls getAIStatus() via a same-module self-reference,
// which vi.mock("./unifiedAIService", ...) above does not intercept (that
// mock only affects *external* imports of the module, e.g. from
// pathfinderEngine.js). Drive the real resolution chain instead by
// controlling its actual inputs: the stored mode preference (localStorage)
// and each backend's real readiness check (mocked at its source module).
vi.mock("./diamondSwarm", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isDiamondSwarmReady: vi.fn(() => false) };
});

describe("unifiedAIService.getAIDataDisclosure (real resolution chain)", () => {
  const AI_MODE_KEY = "vet_rate_ai_mode";

  beforeEach(() => {
    localStorage.clear();
  });

  it("still shows the Cloud disclosure for actual Cloud mode", async () => {
    const { isDiamondSwarmReady } = await import("./diamondSwarm");
    vi.mocked(isDiamondSwarmReady).mockReturnValue(false);
    localStorage.setItem(AI_MODE_KEY, AI_MODES.CLOUD);
    localStorage.setItem(
      "vetrate_gemini_key",
      "AIzaSyFakeKeyForTestingOnly1234567890",
    );

    const { getAIDataDisclosure: realGetAIDataDisclosure } =
      await vi.importActual("./unifiedAIService");
    const disclosure = realGetAIDataDisclosure();
    expect(disclosure.title).toMatch(/Cloud/i);
    expect(disclosure.isPrivate).toBe(false);
  });

  it("does not fall through to 'No AI Available' when Swarm is the only ready backend", async () => {
    const { isDiamondSwarmReady } = await import("./diamondSwarm");
    vi.mocked(isDiamondSwarmReady).mockReturnValue(true);
    localStorage.setItem(AI_MODE_KEY, AI_MODES.SWARM);

    const { getAIDataDisclosure: realGetAIDataDisclosure } =
      await vi.importActual("./unifiedAIService");
    const disclosure = realGetAIDataDisclosure();
    expect(disclosure.title).not.toMatch(/No AI Available/i);
  });
});
