/**
 * Verified-reference grounding at the single assembly point
 * (_buildFullPrompt): the block reaches every backend once, ahead of the
 * keyword-search reference block, and the two share one character budget
 * with the verified text taking its part first.
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
import { buildVerifiedReferenceBlock } from "../../utils/verifiedReference";
import reference from "../../data/verifiedReference.json";

const VERIFIED_MARKER = "=== VERIFIED REFERENCE ===";
const DKB_STUB = "=== DKB CONTEXT STUB ===";
const countOf = (text, marker) => text.split(marker).length - 1;
const entryText = (id) => reference.entries.find((e) => e.id === id).text;

const SECONDARY_QUESTION =
  "Can sleep apnea be service connected as secondary to my PTSD?";
const TDIU_QUESTION = "Can I qualify for TDIU with only one 60% rating?";
const PACT_QUESTION =
  "Am I eligible for any PACT Act presumptive conditions based on my Iraq deployment?";
const PLAIN_QUESTION = "How do I claim sleep apnea?";

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

let localCreate;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  resetAICircuitBreaker();
  buildDKBContextSpy.mockResolvedValue(`\n\n${DKB_STUB}\n`);
  registerSwarmEngine({}, true, false, "auditor");
  setAIMode(AI_MODES.SWARM);
  diamondSwarm.generateWithSwarm.mockResolvedValue({ text: "ok" });
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("verified reference on the on-device swarm", () => {
  it("puts the quoted regulation ahead of the keyword-search block", async () => {
    await generateAI(SECONDARY_QUESTION, callOptions());

    const sent = sentToSwarm();
    expect(countOf(sent, VERIFIED_MARKER)).toBe(1);
    expect(sent).toContain(entryText("cfr-3.310-a"));
    expect(sent.indexOf(VERIFIED_MARKER)).toBeLessThan(sent.indexOf(DKB_STUB));
    expect(sent.indexOf(DKB_STUB)).toBeLessThan(
      sent.lastIndexOf(SECONDARY_QUESTION),
    );
  });

  it("leaves the persona as the system message", async () => {
    await generateAI(SECONDARY_QUESTION, callOptions());

    const [, opts] = diamondSwarm.generateWithSwarm.mock.calls[0];
    expect(opts.systemPrompt).toBeUndefined();
  });

  it("gives the keyword search only what the verified text left of the budget", async () => {
    await generateAI(SECONDARY_QUESTION, callOptions());

    const block = buildVerifiedReferenceBlock(SECONDARY_QUESTION, {
      maxChars: 3400,
    });
    const [, opts] = buildDKBContextSpy.mock.calls[0];
    expect(opts).toStrictEqual({
      maxEntries: 6,
      maxChars: 4000 - block.length,
      excludeBoardDecisions: true,
    });
  });

  it("skips the keyword search when the verified text leaves it no room", async () => {
    await generateAI(TDIU_QUESTION, callOptions({ toolId: "tdiu-builder" }));

    expect(buildDKBContextSpy).not.toHaveBeenCalled();
    const sent = sentToSwarm();
    expect(sent).toContain(entryText("cfr-4.16-a"));
    expect(sent).toContain(entryText("cfr-4.16-b"));
    expect(sent).not.toContain(DKB_STUB);
  });

  it("delivers the PACT lists unaltered by redaction and scrubbing", async () => {
    await generateAI(PACT_QUESTION, callOptions({ toolId: "pact-navigator" }));

    const sent = sentToSwarm();
    expect(sent).toContain(entryText("pact-toxic-conditions"));
    expect(sent).toContain(entryText("pact-toxic-service"));
  });

  it("adds nothing, and changes nothing for the keyword search, when no topic applies", async () => {
    await generateAI(PLAIN_QUESTION, callOptions());

    expect(sentToSwarm()).not.toContain(VERIFIED_MARKER);
    const [, opts] = buildDKBContextSpy.mock.calls[0];
    expect(opts).toStrictEqual({
      maxEntries: 6,
      maxChars: 4000,
      excludeBoardDecisions: true,
    });
  });

  it("adds nothing when the caller turned reference material off", async () => {
    await generateAI(TDIU_QUESTION, callOptions({ useDKB: false }));

    expect(sentToSwarm()).not.toContain(VERIFIED_MARKER);
  });

  it("stays inside a caller's smaller reference budget", async () => {
    await generateAI(TDIU_QUESTION, callOptions({ maxDKBChars: 2000 }));

    const sent = sentToSwarm();
    const start = sent.indexOf("\n\n=== VERIFIED REFERENCE");
    const end =
      sent.indexOf("=== END VERIFIED REFERENCE ===\n") +
      "=== END VERIFIED REFERENCE ===\n".length;
    expect(start).toBeGreaterThan(-1);
    expect(end - start).toBeLessThanOrEqual(2000);
    expect(sent).toContain(entryText("cfr-4.16-a"));
    expect(sent).not.toContain(entryText("cfr-4.16-a-employment"));
  });

  it("rides in the caller's own system prompt when one is supplied", async () => {
    await generateAI(
      SECONDARY_QUESTION,
      callOptions({ systemPrompt: "CALLER SYSTEM PROMPT" }),
    );

    const [prompt, opts] = diamondSwarm.generateWithSwarm.mock.calls[0];
    expect(opts.systemPrompt).toContain("CALLER SYSTEM PROMPT");
    expect(countOf(opts.systemPrompt, VERIFIED_MARKER)).toBe(1);
    expect(prompt).not.toContain(VERIFIED_MARKER);
  });
});

const BACKENDS = {
  local: {
    budget: 3400,
    setup: () => {
      localCreate = vi.fn(async () => ({
        choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
      }));
      registerLocalAIEngine(
        { chat: { completions: { create: localCreate } } },
        true,
        false,
        "test-model",
        false,
      );
      registerSwarmEngine(null, false, false, null);
      setAIMode(AI_MODES.LOCAL);
    },
    sent: () =>
      localCreate.mock.calls[0][0].messages.map((m) => m.content).join("\n"),
  },
  wllama: {
    budget: 3400,
    setup: async () => {
      await initializeWllama("auditor");
      setAIMode(AI_MODES.WLLAMA);
      wllamaService.chatCompletion.mockResolvedValue({
        success: true,
        text: "ok",
      });
    },
    sent: () => JSON.stringify(wllamaService.chatCompletion.mock.calls[0]),
  },
  "local server": {
    budget: 5000,
    setup: async () => {
      localServerClient.checkServerHealth.mockResolvedValue({
        available: true,
      });
      localServerClient.chatCompletion.mockResolvedValue("ok");
      await checkLocalServer(true);
      setAIMode(AI_MODES.LOCAL_SERVER);
    },
    sent: () => JSON.stringify(localServerClient.chatCompletion.mock.calls[0]),
  },
  cloud: {
    budget: 6500,
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
    sent: () => String(globalThis.fetch.mock.calls[0][1].body),
  },
};

const RATING_QUESTION =
  "Explain the bilateral factor and how my combined rating is worked out.";

describe("verified reference on every other backend", () => {
  it.each(Object.entries(BACKENDS))(
    "%s receives the block once, sized to its budget",
    async (_name, backend) => {
      await backend.setup();
      await generateAI(RATING_QUESTION, callOptions());

      const expected = buildVerifiedReferenceBlock(RATING_QUESTION, {
        maxChars: backend.budget,
      });
      const sent = backend.sent();
      expect(countOf(sent, "=== VERIFIED REFERENCE ===")).toBe(1);
      expect(countOf(sent, "=== END VERIFIED REFERENCE ===")).toBe(1);
      const total = { 3400: 4000, 5000: 6000, 6500: 8000 }[backend.budget];
      const remaining = total - expected.length;
      if (remaining >= 800) {
        expect(buildDKBContextSpy.mock.calls[0][1].maxChars).toBe(remaining);
      } else {
        expect(buildDKBContextSpy).not.toHaveBeenCalled();
      }
    },
  );
});
