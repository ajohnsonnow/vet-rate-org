/**
 * Routing contract tests for unifiedAIService.getEffectiveAIMode()
 *
 * Tests the mode-selection logic using only publicly accessible state:
 *   - localStorage  (getAIMode, isCloudAIAvailable)
 *   - registerSwarmEngine() (isDiamondSwarmReady via local state)
 *
 * Wllama and Local-Server paths require async init calls and are
 * exercised separately in integration tests; they start at false here.
 *
 * Companion regression: generateAI() bug fixed in commit that ships
 * these tests — the old `useSwarm = … || isDiamondSwarmReady()` flag
 * caused swarm to hijack CLOUD-mode dispatches when a model was loaded.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mock diamondSwarm so we control isSwarmReady() without loading GGUF ──────
vi.mock("../../utils/diamondSwarm", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isSwarmReady: vi.fn().mockReturnValue(false),
    generateWithSwarm: vi.fn(),
    initializeSwarm: vi.fn(),
    switchAgent: vi.fn(),
    unloadSwarm: vi.fn(),
  };
});

// ── Mock wllamaService (no WASM in test env) ──────────────────────────────────
vi.mock("../../utils/wllamaService", () => ({
  initializeWllama: vi.fn().mockResolvedValue({ success: false }),
  isWllamaAvailable: vi.fn().mockReturnValue(false),
  generateWithModel: vi.fn(),
  getWllamaStatus: vi.fn().mockReturnValue({ ready: false }),
  unloadWllama: vi.fn(),
  WLLAMA_MODELS: {},
}));

// ── Mock localServerClient (no llama.cpp in CI) ───────────────────────────────
vi.mock("../../utils/localServerClient", () => ({
  checkServerHealth: vi.fn().mockResolvedValue({ available: false }),
  generateWithLocalServer: vi.fn(),
  getServerStatus: vi.fn().mockReturnValue({ available: false }),
}));

// ── Mock crisisInterceptor (not under test) ───────────────────────────────────
vi.mock("../../utils/crisisInterceptor", () => ({
  interceptBeforeAICall: vi.fn().mockResolvedValue({ shouldBlock: false }),
}));

// ── Mock featureFlags (all features enabled) ──────────────────────────────────
vi.mock("../../utils/featureFlags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}));

// ── Module under test ─────────────────────────────────────────────────────────
import {
  AI_MODES,
  AI_PRESETS,
  getAIMode,
  setAIMode,
  getEffectiveAIMode,
  isCloudAIAvailable,
  isDiamondSwarmReady,
  registerSwarmEngine,
  getAIPreset,
} from "../../utils/unifiedAIService";

// Keys mirror the private constants in the module
const AI_MODE_KEY = "vet_rate_ai_mode";
const GEMINI_KEY = "vetrate_gemini_key";
const VALID_GEMINI_KEY = "AIzaSyValidKey12345678901234567890123";
const PLACEHOLDER_KEY = "your_gemini_api_key_here";

function resetSwarm() {
  // Register an unloaded engine so isDiamondSwarmReady() returns false
  registerSwarmEngine(null, false, false, null);
}

function registerReadySwarm() {
  registerSwarmEngine({}, true, false, "auditor");
}

beforeEach(() => {
  localStorage.clear();
  resetSwarm();
});

// ─────────────────────────────────────────────────────────────────────────────
describe("AI_MODES enum", () => {
  it("exports all 6 mode constants", () => {
    expect(AI_MODES).toMatchObject({
      CLOUD: "cloud",
      LOCAL: "local",
      SWARM: "swarm",
      WLLAMA: "wllama",
      LOCAL_SERVER: "local_server",
      AUTO: "auto",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("AI_PRESETS structure", () => {
  const REQUIRED_PRESETS = ["LEGAL", "CREATIVE", "ADVERSARIAL", "BALANCED"];
  const REQUIRED_FIELDS = ["temperature", "topK", "topP"];

  for (const name of REQUIRED_PRESETS) {
    it(`${name} preset has all required sampling fields`, () => {
      const preset = AI_PRESETS[name];
      expect(preset, `missing preset: ${name}`).toBeDefined();
      for (const field of REQUIRED_FIELDS) {
        expect(typeof preset[field], `${name}.${field}`).toBe("number");
      }
    });
  }

  it("getAIPreset('LEGAL') returns LEGAL config", () => {
    expect(getAIPreset("LEGAL")).toBe(AI_PRESETS.LEGAL);
  });

  it("getAIPreset with unknown name falls back to BALANCED", () => {
    expect(getAIPreset("NONEXISTENT")).toBe(AI_PRESETS.BALANCED);
  });

  it("LEGAL preset has near-zero temperature for regulatory accuracy", () => {
    expect(AI_PRESETS.LEGAL.temperature).toBeLessThanOrEqual(0.2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("getAIMode / setAIMode", () => {
  it("default mode is swarm (Warrant Council)", () => {
    expect(getAIMode()).toBe(AI_MODES.SWARM);
  });

  it("setAIMode persists to localStorage", () => {
    setAIMode(AI_MODES.CLOUD);
    expect(getAIMode()).toBe(AI_MODES.CLOUD);
  });

  it("setAIMode rejects unknown modes and returns false", () => {
    const result = setAIMode("banana");
    expect(result).toBe(false);
    expect(getAIMode()).toBe(AI_MODES.SWARM); // unchanged
  });

  it("legacy 'local' preference is migrated to 'swarm'", () => {
    localStorage.setItem(AI_MODE_KEY, "local");
    expect(getAIMode()).toBe(AI_MODES.SWARM);
    // Migration should persist
    expect(localStorage.getItem(AI_MODE_KEY)).toBe(AI_MODES.SWARM);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("isCloudAIAvailable", () => {
  it("returns false when no key is set", () => {
    expect(isCloudAIAvailable()).toBe(false);
  });

  it("returns true when a valid-looking Gemini key is set", () => {
    localStorage.setItem(GEMINI_KEY, VALID_GEMINI_KEY);
    expect(isCloudAIAvailable()).toBe(true);
  });

  it("returns false for placeholder text", () => {
    localStorage.setItem(GEMINI_KEY, PLACEHOLDER_KEY);
    expect(isCloudAIAvailable()).toBe(false);
  });

  it("returns false for empty string", () => {
    localStorage.setItem(GEMINI_KEY, "");
    expect(isCloudAIAvailable()).toBe(false);
  });

  // NOTE: "null" as a 4-char string fails isValidApiKey (length < 10) in
  // localStorage, but isCloudAIAvailable() also falls back to
  // import.meta.env.VITE_GEMINI_API_KEY — so the overall return value is
  // environment-dependent when a local .env key is present. No hard assertion.
});

// ─────────────────────────────────────────────────────────────────────────────
describe("isDiamondSwarmReady", () => {
  it("returns false when no engine registered", () => {
    expect(isDiamondSwarmReady()).toBe(false);
  });

  it("returns true after registerSwarmEngine(ready=true)", () => {
    registerReadySwarm();
    expect(isDiamondSwarmReady()).toBe(true);
  });

  it("returns false when registered as initializing (not yet ready)", () => {
    registerSwarmEngine({}, false, true, "auditor");
    expect(isDiamondSwarmReady()).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("getEffectiveAIMode — routing contract", () => {
  it("returns null when nothing is available", () => {
    // mode=SWARM (default), swarm=not ready, cloud=not configured
    expect(getEffectiveAIMode()).toBeNull();
  });

  it("SWARM mode + swarm ready → SWARM", () => {
    setAIMode(AI_MODES.SWARM);
    registerReadySwarm();
    expect(getEffectiveAIMode()).toBe(AI_MODES.SWARM);
  });

  it("SWARM mode + swarm not ready + cloud available → CLOUD (fallback)", () => {
    setAIMode(AI_MODES.SWARM);
    // swarm not ready (resetSwarm already called in beforeEach)
    localStorage.setItem(GEMINI_KEY, VALID_GEMINI_KEY);
    expect(getEffectiveAIMode()).toBe(AI_MODES.CLOUD);
  });

  it("CLOUD mode + cloud available → CLOUD", () => {
    setAIMode(AI_MODES.CLOUD);
    localStorage.setItem(GEMINI_KEY, VALID_GEMINI_KEY);
    expect(getEffectiveAIMode()).toBe(AI_MODES.CLOUD);
  });

  it("CLOUD mode + cloud not available + swarm ready → SWARM (fallback)", () => {
    setAIMode(AI_MODES.CLOUD);
    // no Gemini key
    registerReadySwarm();
    expect(getEffectiveAIMode()).toBe(AI_MODES.SWARM);
  });

  // Regression: the old generateAI() dispatch used
  //   `const useSwarm = effectiveMode === SWARM || isDiamondSwarmReady()`
  // which hijacked CLOUD-mode dispatches whenever a swarm model happened
  // to be loaded. getEffectiveAIMode() itself was always correct — the bug
  // was purely in the dispatch flags. This test pins getEffectiveAIMode().
  it("CLOUD mode + cloud available + swarm also ready → still CLOUD (preference honoured)", () => {
    setAIMode(AI_MODES.CLOUD);
    localStorage.setItem(GEMINI_KEY, VALID_GEMINI_KEY);
    registerReadySwarm(); // swarm is ready, but user chose cloud
    expect(getEffectiveAIMode()).toBe(AI_MODES.CLOUD);
  });

  it("SWARM mode + swarm ready + cloud also available → SWARM (preference honoured)", () => {
    setAIMode(AI_MODES.SWARM);
    registerReadySwarm();
    localStorage.setItem(GEMINI_KEY, VALID_GEMINI_KEY);
    expect(getEffectiveAIMode()).toBe(AI_MODES.SWARM);
  });

  it("LOCAL mode + swarm ready → upgrades to SWARM (by design)", () => {
    setAIMode(AI_MODES.LOCAL);
    registerReadySwarm();
    expect(getEffectiveAIMode()).toBe(AI_MODES.SWARM);
  });

  it("AUTO mode + cloud available → CLOUD (best available)", () => {
    setAIMode(AI_MODES.AUTO);
    localStorage.setItem(GEMINI_KEY, VALID_GEMINI_KEY);
    expect(getEffectiveAIMode()).toBe(AI_MODES.CLOUD);
  });

  it("AUTO mode + swarm ready + cloud available → SWARM (swarm takes priority)", () => {
    setAIMode(AI_MODES.AUTO);
    registerReadySwarm();
    localStorage.setItem(GEMINI_KEY, VALID_GEMINI_KEY);
    expect(getEffectiveAIMode()).toBe(AI_MODES.SWARM);
  });
});
