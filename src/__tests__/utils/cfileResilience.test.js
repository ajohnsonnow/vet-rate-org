/**
 * C-File ingestion resilience tests (WS-2 + WS-3)
 *
 * Covers:
 *  - chunk retry with backoff → failedChunks manifest (cfileAnalyzer)
 *  - circuit breaker after 3 consecutive generation failures (unifiedAIService)
 *  - one retry on the cloud timeout (unifiedAIService)
 *  - timeline dedup merges equivalent date formats (cfileAnalyzer)
 *  - hallucinated diagnostic codes stripped from the merged result
 *
 * Heavy AI backends are mocked — no WebGPU/WASM/network in tests.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

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
  chatCompletion: vi.fn(),
  generateWithModel: vi.fn(),
  getWllamaStatus: vi.fn().mockReturnValue({ ready: false }),
  unloadWllama: vi.fn(),
  WLLAMA_MODELS: {},
}));

// ── Mock localServerClient (no llama.cpp in CI) ───────────────────────────────
vi.mock("../../utils/localServerClient", () => ({
  checkServerHealth: vi.fn().mockResolvedValue({ available: false }),
  chatCompletion: vi.fn(),
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

// ── Mock aiSystemPrompts (skip DKB/IndexedDB lookups) ─────────────────────────
vi.mock("../../utils/aiSystemPrompts", () => ({
  _buildSystemPromptWithDKB: vi.fn(),
  buildSystemPrompt: vi.fn().mockReturnValue(""),
  buildDKBContext: vi.fn().mockResolvedValue(null),
  validateAIResponse: vi.fn().mockReturnValue({ isValid: true, warnings: [] }),
}));

// ── Modules under test ────────────────────────────────────────────────────────
import {
  AI_MODES,
  setAIMode,
  generateAI,
  registerLocalAIEngine,
  registerSwarmEngine,
  resetAICircuitBreaker,
} from "../../utils/unifiedAIService";
import {
  analyzeCFile,
  deduplicateTimeline,
  enforceValidDiagnosticCodes,
} from "../../utils/cfileAnalyzer";

const GEMINI_KEY = "vetrate_gemini_key";
const VALID_GEMINI_KEY = "AIzaSyValidKey12345678901234567890123";

// "6260" (Tinnitus) is a real 38 CFR Part 4 code; "99999" is not
const VALID_DC = "6260";
const FAKE_DC = "99999";

/**
 * Fake multi-page C-File text large enough to force exactly 2 chunks in
 * LOCAL mode (6,000-char budget: ~720 chars/page x 14 pages ≈ 10KB splits
 * after ~8 pages). Every page carries medical vocabulary so the
 * boilerplate screen keeps them all.
 */
function makeCFileText(pageCount = 14) {
  let text = "";
  for (let p = 1; p <= pageCount; p++) {
    text += `--- PAGE ${p} ---\n`;
    text +=
      `Clinic visit note number ${p}. Veteran reports right knee pain after airborne operations. `.repeat(
        8,
      ) + "\n";
  }
  return text;
}

/** Canned per-chunk analysis JSON (includes one valid + one fake DC) */
function chunkAnalysisJSON(chunkNum) {
  return JSON.stringify({
    summary: `Chunk ${chunkNum} found knee injury evidence.`,
    servicePeriod: { branch: "Army" },
    timeline: [
      {
        date: chunkNum === 1 ? "Jan 2005" : "January 2005",
        page_number: 3,
        category: "injury",
        body_part: "Right Knee",
        description: "Knee injury during airborne ops",
        significance: "high",
      },
    ],
    potential_claims: [
      {
        condition: "Tinnitus",
        diagnosticCode: VALID_DC,
        likelihood: "high",
      },
      {
        condition: "Imaginary Syndrome",
        diagnosticCode: FAKE_DC,
        likelihood: "low",
      },
    ],
    exposures: [],
    combatIndicators: [],
    mentalHealth: { indicators: [], diagnoses: [] },
    redFlags: [],
    actionItems: ["Request a nexus letter from a treating provider"],
  });
}

/**
 * Register a fake legacy engine. registerLocalAIEngine(ready=true) also
 * auto-registers the Warrant Council — undo that so the legacy LOCAL path
 * (not the swarm) is exercised.
 */
function registerLegacyEngine(engine) {
  registerLocalAIEngine(engine, true, false, "test-model", false);
  registerSwarmEngine(null, false, false, null);
}

/** Fake WebLLM engine whose create() delegates to a handler(systemContent) */
function makeEngine(handler) {
  return {
    chat: {
      completions: {
        create: vi.fn(async (config) => {
          const sys = config.messages?.[0]?.content || "";
          const text = await handler(sys);
          return {
            choices: [{ message: { content: text }, finish_reason: "stop" }],
          };
        }),
      },
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  resetAICircuitBreaker();
  registerSwarmEngine(null, false, false, null);
  registerLocalAIEngine(null, false, false, null, false);
  // Block any accidental real network call (incl. .env Gemini key fallbacks)
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─────────────────────────────────────────────────────────────────────────────
describe("analyzeCFile — chunk retry and failedChunks manifest", () => {
  it(
    "retries a transient chunk failure and completes with no failedChunks",
    { timeout: 20000 },
    async () => {
      let chunk2Calls = 0;
      const engine = makeEngine((sys) => {
        if (sys.includes("CHUNK 2/")) {
          chunk2Calls++;
          if (chunk2Calls < 3) throw new Error("Transient GPU hiccup");
        }
        return chunkAnalysisJSON(sys.includes("CHUNK 2/") ? 2 : 1);
      });

      setAIMode(AI_MODES.LOCAL);
      registerLegacyEngine(engine);

      const result = await analyzeCFile(null, makeCFileText(), () => {});

      expect(result.success).toBe(true);
      expect(result.metadata.totalChunks).toBe(2);
      expect(result.metadata.chunksProcessed).toBe(2);
      expect(result.metadata.failedChunkCount).toBe(0);
      expect(result.analysis.failedChunks).toEqual([]);
      expect(chunk2Calls).toBe(3); // initial + 2 retries
    },
  );

  it(
    "records a persistently failing chunk in the failedChunks manifest instead of aborting",
    { timeout: 20000 },
    async () => {
      let chunk2Calls = 0;
      const engine = makeEngine((sys) => {
        if (sys.includes("CHUNK 2/")) {
          chunk2Calls++;
          throw new Error("Persistent backend failure");
        }
        return chunkAnalysisJSON(1);
      });

      setAIMode(AI_MODES.LOCAL);
      registerLegacyEngine(engine);

      const result = await analyzeCFile(null, makeCFileText(), () => {});

      expect(result.success).toBe(true);
      expect(chunk2Calls).toBe(3); // initial + 2 retries, then gave up
      expect(result.metadata.chunksProcessed).toBe(1);
      expect(result.metadata.failedChunkCount).toBe(1);
      expect(result.analysis.failedChunks).toHaveLength(1);

      const failed = result.analysis.failedChunks[0];
      expect(failed.chunkIndex).toBe(1);
      expect(failed.startPage).toBeGreaterThan(0);
      expect(failed.endPage).toBeGreaterThanOrEqual(failed.startPage);
      expect(failed.error).toBeTruthy();
    },
  );

  it(
    "strips a hallucinated diagnostic code from the merged result",
    { timeout: 20000 },
    async () => {
      const engine = makeEngine((sys) =>
        chunkAnalysisJSON(sys.includes("CHUNK 2/") ? 2 : 1),
      );

      setAIMode(AI_MODES.LOCAL);
      registerLegacyEngine(engine);

      const result = await analyzeCFile(null, makeCFileText(), () => {});

      const claims = result.analysis.potential_claims;
      const tinnitus = claims.find((c) => c.condition === "Tinnitus");
      const fake = claims.find((c) => c.condition === "Imaginary Syndrome");

      expect(tinnitus.diagnosticCode).toBe(VALID_DC);
      expect(fake.diagnosticCode).toBeNull();
      expect(result.metadata.rejectedDiagnosticCodes).toHaveLength(1);
      expect(result.metadata.rejectedDiagnosticCodes[0].diagnosticCode).toBe(
        FAKE_DC,
      );

      // Same event reported as "Jan 2005" / "January 2005" across chunks
      // must merge to a single timeline entry
      expect(result.analysis.timeline).toHaveLength(1);
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
describe("generateAI — circuit breaker", () => {
  function cloudOptions() {
    return {
      skipCrisisCheck: true,
      skipFeatureCheck: true,
      skipHallucinationCheck: true,
      useDKB: false,
      systemPrompt: "test",
    };
  }

  beforeEach(() => {
    setAIMode(AI_MODES.CLOUD);
    localStorage.setItem(GEMINI_KEY, VALID_GEMINI_KEY);
  });

  it("opens after 3 consecutive failures and stops attempting", async () => {
    for (let i = 0; i < 3; i++) {
      await expect(generateAI("hello", cloudOptions())).rejects.toThrow(
        /Network error/,
      );
    }
    expect(fetch).toHaveBeenCalledTimes(3);

    // 4th call: breaker is open — no backend attempt, clear settings error
    await expect(generateAI("hello", cloudOptions())).rejects.toThrow(
      /AI_CIRCUIT_OPEN.*check your AI settings/s,
    );
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("resetAICircuitBreaker() allows attempts again", async () => {
    for (let i = 0; i < 3; i++) {
      await expect(generateAI("hello", cloudOptions())).rejects.toThrow();
    }
    await expect(generateAI("hello", cloudOptions())).rejects.toThrow(
      /AI_CIRCUIT_OPEN/,
    );
    expect(fetch).toHaveBeenCalledTimes(3);

    resetAICircuitBreaker();
    await expect(generateAI("hello", cloudOptions())).rejects.toThrow(
      /Network error/,
    );
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("a success resets the consecutive-failure counter", async () => {
    const okResponse = {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "ok" }] } }],
      }),
    };
    fetch
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(okResponse)
      .mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(generateAI("hello", cloudOptions())).rejects.toThrow();
    await expect(generateAI("hello", cloudOptions())).rejects.toThrow();

    const result = await generateAI("hello", cloudOptions());
    expect(result.text).toBe("ok");

    // Two more failures — breaker must NOT be open yet (counter was reset)
    await expect(generateAI("hello", cloudOptions())).rejects.toThrow(
      /Network error/,
    );
    await expect(generateAI("hello", cloudOptions())).rejects.toThrow(
      /Network error/,
    );
    expect(fetch).toHaveBeenCalledTimes(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("generateAI — cloud timeout retry", () => {
  it("retries once after an AbortError timeout and succeeds", async () => {
    setAIMode(AI_MODES.CLOUD);
    localStorage.setItem(GEMINI_KEY, VALID_GEMINI_KEY);

    const abortErr = new Error("The operation was aborted");
    abortErr.name = "AbortError";
    fetch.mockRejectedValueOnce(abortErr).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "ok after retry" }] } }],
      }),
    });

    const result = await generateAI("hello", {
      skipCrisisCheck: true,
      skipFeatureCheck: true,
      skipHallucinationCheck: true,
      useDKB: false,
      systemPrompt: "test",
    });

    expect(result.text).toBe("ok after retry");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("deduplicateTimeline — date normalization", () => {
  it('merges "Jan 2005" / "January 2005" / "2005-01" into one event', () => {
    const events = [
      {
        date: "Jan 2005",
        page_number: 12,
        category: "injury",
        body_part: "Right Knee",
        quote: "short",
      },
      {
        date: "January 2005",
        page_number: 12,
        category: "injury",
        body_part: "Right Knee",
        quote: "a much longer and more specific quote",
      },
      {
        date: "2005-01",
        page_number: 12,
        category: "injury",
        body_part: "right knee",
      },
    ];

    const deduped = deduplicateTimeline(events);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].quote).toBe("a much longer and more specific quote");
  });

  it("keeps events with genuinely different dates separate", () => {
    const events = [
      {
        date: "Jan 2005",
        page_number: 12,
        category: "injury",
        body_part: "Right Knee",
      },
      {
        date: "Mar 2007",
        page_number: 12,
        category: "injury",
        body_part: "Right Knee",
      },
    ];

    expect(deduplicateTimeline(events)).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("enforceValidDiagnosticCodes", () => {
  it("nulls invalid codes, keeps valid codes and code-less claims", () => {
    const analysis = {
      potential_claims: [
        { condition: "Tinnitus", diagnosticCode: VALID_DC },
        { condition: "Imaginary Syndrome", diagnosticCode: FAKE_DC },
        { condition: "Knee strain" },
      ],
    };

    const rejected = enforceValidDiagnosticCodes(analysis);

    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      condition: "Imaginary Syndrome",
      diagnosticCode: FAKE_DC,
    });
    expect(analysis.potential_claims[0].diagnosticCode).toBe(VALID_DC);
    expect(analysis.potential_claims[1].diagnosticCode).toBeNull();
    expect(analysis.potential_claims[2].diagnosticCode).toBeUndefined();
  });

  it("handles missing/empty analysis without throwing", () => {
    expect(enforceValidDiagnosticCodes(null)).toEqual([]);
    expect(enforceValidDiagnosticCodes({})).toEqual([]);
  });
});
