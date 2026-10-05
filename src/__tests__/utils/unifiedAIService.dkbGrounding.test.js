/**
 * Full-corpus DKB grounding flag: wiring at the single injection point
 * (_injectDKBContext) and the fullDKBAvailable status event.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { buildDKBContextSpy } = vi.hoisted(() => ({
  buildDKBContextSpy: vi.fn(),
}));

vi.mock("../../utils/aiSystemPrompts", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, buildDKBContext: buildDKBContextSpy };
});
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
vi.mock("../../utils/wllamaService", () => ({
  initializeWllama: vi.fn().mockResolvedValue(true),
  isWllamaAvailable: vi.fn().mockReturnValue(false),
  chatCompletion: vi.fn(),
  generateWithModel: vi.fn(),
  getWllamaStatus: vi.fn().mockReturnValue({ ready: false }),
  unloadWllama: vi.fn(),
  WLLAMA_MODELS: {},
}));
vi.mock("../../utils/deviceCapabilityDetector", () => ({
  detectDeviceCapabilities: vi.fn().mockResolvedValue({
    tier: "desktop",
    hasWebGPU: true,
    canUseWebLLM: true,
  }),
}));
vi.mock("../../utils/localServerClient", () => ({
  checkServerHealth: vi.fn().mockResolvedValue({ available: false }),
  chatCompletion: vi.fn(),
  getServerConfig: vi.fn(() => ({ host: "localhost", port: 8080 })),
}));
vi.mock("../../utils/crisisInterceptor", () => ({
  interceptBeforeAICall: vi.fn().mockResolvedValue({ shouldBlock: false }),
}));
vi.mock("../../utils/featureFlags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}));

import {
  generateAI,
  setAIMode,
  AI_MODES,
  registerSwarmEngine,
  registerLocalAIEngine,
  resetAICircuitBreaker,
  checkLocalServer,
  initializeWllama,
} from "../../utils/unifiedAIService";
import * as diamondSwarm from "../../utils/diamondSwarm";
import * as wllamaService from "../../utils/wllamaService";
import * as localServerClient from "../../utils/localServerClient";
import { AI_DATA_CLASS } from "../../utils/aiDataClassPolicy";
import { FULL_DKB_GROUNDING_KEY } from "../../utils/dkbGroundingFlag";

const callOptions = (overrides = {}) => ({
  dataClass: AI_DATA_CLASS.CONTEXT,
  skipCrisisCheck: true,
  skipFeatureCheck: true,
  skipHallucinationCheck: true,
  skipValidation: true,
  ...overrides,
});

const sentToSwarm = () => {
  const [prompt, opts] = diamondSwarm.generateWithSwarm.mock.calls[0];
  return `${opts.systemPrompt || ""}\n${prompt}`;
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  resetAICircuitBreaker();
  buildDKBContextSpy.mockResolvedValue("\n\n=== DKB CONTEXT STUB ===\n");
  registerSwarmEngine({}, true, false, "auditor");
  setAIMode(AI_MODES.SWARM);
  diamondSwarm.generateWithSwarm.mockResolvedValue({ text: "ok" });
});

afterEach(() => {
  localStorage.clear();
});

describe("_injectDKBContext and the full-corpus grounding flag", () => {
  it("flag off: buildDKBContext gets exactly today's arguments and the prompt carries the stub", async () => {
    await generateAI("How do I claim sleep apnea?", callOptions());

    expect(buildDKBContextSpy).toHaveBeenCalledTimes(1);
    const [query, opts] = buildDKBContextSpy.mock.calls[0];
    expect(query).toBe("How do I claim sleep apnea?");
    expect(opts).toStrictEqual({
      maxEntries: 6,
      maxChars: 4000,
      excludeBoardDecisions: true,
      excludeCourtDecisions: true,
    });
    expect(Object.keys(opts)).not.toContain("includeShards");
    expect(sentToSwarm()).toContain("=== DKB CONTEXT STUB ===");
  });

  it("flag set to anything but the string true: still off", async () => {
    localStorage.setItem(FULL_DKB_GROUNDING_KEY, "1");
    await generateAI("How do I claim sleep apnea?", callOptions());

    const [, opts] = buildDKBContextSpy.mock.calls[0];
    expect(Object.keys(opts)).not.toContain("includeShards");
  });

  it("flag on: asks for shard passages without changing the per-backend budget", async () => {
    localStorage.setItem(FULL_DKB_GROUNDING_KEY, "true");
    await generateAI("How do I claim sleep apnea?", callOptions());

    const [, opts] = buildDKBContextSpy.mock.calls[0];
    expect(opts).toStrictEqual({
      maxEntries: 6,
      maxChars: 4000,
      excludeBoardDecisions: true,
      excludeCourtDecisions: true,
      includeShards: true,
    });
  });

  it("useDKB false does no DKB work at all, flag on or off", async () => {
    localStorage.setItem(FULL_DKB_GROUNDING_KEY, "true");
    await generateAI("Extract the dates", callOptions({ useDKB: false }));

    expect(buildDKBContextSpy).not.toHaveBeenCalled();
  });
});

const MODES = {
  swarm: {
    setup: () => {},
    budget: { maxEntries: 6, maxChars: 4000 },
    excluded: true,
  },
  local: {
    setup: () => {
      registerLocalAIEngine(
        {
          chat: {
            completions: {
              create: vi.fn(async () => ({
                choices: [
                  { message: { content: "ok" }, finish_reason: "stop" },
                ],
              })),
            },
          },
        },
        true,
        false,
        "test-model",
        false,
      );
      registerSwarmEngine(null, false, false, null);
      setAIMode(AI_MODES.LOCAL);
    },
    budget: { maxEntries: 6, maxChars: 4000 },
    excluded: true,
  },
  wllama: {
    setup: async () => {
      await initializeWllama("auditor");
      setAIMode(AI_MODES.WLLAMA);
      wllamaService.chatCompletion.mockResolvedValue({
        success: true,
        text: "ok",
      });
    },
    budget: { maxEntries: 6, maxChars: 4000 },
    excluded: true,
  },
  "local server": {
    setup: async () => {
      localServerClient.checkServerHealth.mockResolvedValue({
        available: true,
      });
      localServerClient.chatCompletion.mockResolvedValue("ok");
      await checkLocalServer(true);
      setAIMode(AI_MODES.LOCAL_SERVER);
    },
    budget: { maxEntries: 8, maxChars: 6000 },
    excluded: false,
  },
  cloud: {
    setup: () => {
      localStorage.setItem(
        "vetrate_gemini_key",
        "AIzaSyValidKey12345678901234567890123",
      );
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: "ok" }] } }],
          }),
        }),
      );
      setAIMode(AI_MODES.CLOUD);
    },
    budget: { maxEntries: 10, maxChars: 8000 },
    excluded: false,
  },
};

describe("individual Board decisions are kept out of the block on the small-budget backends", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(Object.entries(MODES))(
    "%s backend asks for the expected curated-entry rules",
    async (_name, mode) => {
      await mode.setup();
      await generateAI("Decode my denial", callOptions());

      const [, opts] = buildDKBContextSpy.mock.calls[0];
      expect(opts).toStrictEqual(
        mode.excluded
          ? {
              ...mode.budget,
              excludeBoardDecisions: true,
              excludeCourtDecisions: true,
            }
          : mode.budget,
      );
    },
  );
});

describe("fullDKBAvailable status event", () => {
  const captureStatusDetail = () => {
    let detail = null;
    const listener = (event) => {
      detail = event.detail;
    };
    window.addEventListener("local-ai-status-change", listener);
    registerLocalAIEngine({}, true, false, "test-model", false);
    window.removeEventListener("local-ai-status-change", listener);
    return detail;
  };

  it("reports false while the flag is off", () => {
    expect(captureStatusDetail().fullDKBAvailable).toBe(false);
  });

  it("reports true only when the flag is on", () => {
    localStorage.setItem(FULL_DKB_GROUNDING_KEY, "true");
    expect(captureStatusDetail().fullDKBAvailable).toBe(true);
  });
});
