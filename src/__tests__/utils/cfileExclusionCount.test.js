/**
 * S24 — AI-analysis exclusion accounting.
 *
 * Two layers:
 *  1. `computeAiExclusion` (pure) — the single source of truth for which chunks
 *     the local-AI pass skips (score floor + top-N cap). The analysis loop
 *     consults exactly this, so testing it here tests the real skip behaviour.
 *  2. `analyzeCFile` metadata wiring — the excluded PAGE count is surfaced in
 *     the returned metadata (previously it was a console.log only). Heavy AI
 *     backends are mocked; the semantic index is disabled to avoid the real
 *     embedder / IndexedDB (covered by userDocSemanticIndex.test.js).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

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
  initializeWllama: vi.fn().mockResolvedValue({ success: false }),
  isWllamaAvailable: vi.fn().mockReturnValue(false),
  chatCompletion: vi.fn(),
  generateWithModel: vi.fn(),
  getWllamaStatus: vi.fn().mockReturnValue({ ready: false }),
  unloadWllama: vi.fn(),
  WLLAMA_MODELS: {},
}));
vi.mock("../../utils/localServerClient", () => ({
  checkServerHealth: vi.fn().mockResolvedValue({ available: false }),
  chatCompletion: vi.fn(),
  generateWithLocalServer: vi.fn(),
  getServerStatus: vi.fn().mockReturnValue({ available: false }),
}));
vi.mock("../../utils/crisisInterceptor", () => ({
  interceptBeforeAICall: vi.fn().mockResolvedValue({ shouldBlock: false }),
  scanDocumentForCrisis: vi.fn().mockReturnValue(false),
}));
vi.mock("../../utils/featureFlags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}));
vi.mock("../../utils/aiSystemPrompts", () => ({
  _buildSystemPromptWithDKB: vi.fn(),
  buildSystemPrompt: vi.fn().mockReturnValue(""),
  buildDKBContext: vi.fn().mockResolvedValue(null),
  validateAIResponse: vi.fn().mockReturnValue({ isValid: true, warnings: [] }),
  untrustedSection: (label, text) =>
    `=== BEGIN ${String(label || "UNTRUSTED").toUpperCase()} ===\n${text}\n=== END ===`,
}));

import {
  AI_MODES,
  setAIMode,
  registerLocalAIEngine,
  registerSwarmEngine,
  resetAICircuitBreaker,
} from "../../utils/unifiedAIService";
import { analyzeCFile, computeAiExclusion } from "../../utils/cfileAnalyzer";

function registerLegacyEngine(engine) {
  registerLocalAIEngine(engine, true, false, "test-model", false);
  registerSwarmEngine(null, false, false, null);
}
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
const OK_JSON = JSON.stringify({
  summary: "found knee evidence",
  servicePeriod: { branch: "Army" },
  timeline: [],
  potential_claims: [
    { condition: "Tinnitus", diagnosticCode: "6260", likelihood: "high" },
  ],
});

/** Pad a body to ~`target` chars so chunk-split math is predictable. */
function page(n, body, target = 800) {
  let b = body;
  while (b.length < target) b += ` ${body}`;
  return `--- PAGE ${n} ---\n${b.slice(0, target)}\n\n`;
}

beforeEach(() => {
  localStorage.clear();
  resetAICircuitBreaker();
  registerSwarmEngine(null, false, false, null);
  registerLocalAIEngine(null, false, false, null, false);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

// ─────────────────────────────────────────────────────────────────────────────
describe("computeAiExclusion", () => {
  it("excludes chunks below the score floor (Gate 3)", () => {
    const { floorIndices, capIndices } = computeAiExclusion([5, 1, 0, 3], {
      maxAiChunks: 150,
      minClaimsScore: 2,
    });
    expect([...floorIndices].sort()).toEqual([1, 2]); // scores 1 and 0
    expect(capIndices.size).toBe(0); // 4 chunks < cap
  });

  it("excludes the lowest-scoring chunks past the top-N cap (Gate 4)", () => {
    const scores = [9, 8, 7, 6, 5]; // 5 chunks
    const { floorIndices, capIndices } = computeAiExclusion(scores, {
      maxAiChunks: 3,
      minClaimsScore: 2,
    });
    expect(floorIndices.size).toBe(0);
    // top-3 threshold = 7; chunks with score < 7 (indices 3,4) excluded.
    expect([...capIndices].sort()).toEqual([3, 4]);
  });

  it("does not double-count a floor-excluded chunk under the cap", () => {
    const scores = [9, 8, 1, 1, 1]; // three below floor(2)
    const { floorIndices, capIndices } = computeAiExclusion(scores, {
      maxAiChunks: 3,
      minClaimsScore: 2,
    });
    expect([...floorIndices].sort()).toEqual([2, 3, 4]);
    // Cap indices must not overlap the floor set.
    for (const i of capIndices) expect(floorIndices.has(i)).toBe(false);
  });

  it("is soft on ties (equal scores at the cap boundary are all kept)", () => {
    // top-2 of [5,5,5]: threshold = 5; nothing scores < 5, so nothing excluded.
    const { capIndices } = computeAiExclusion([5, 5, 5], {
      maxAiChunks: 2,
      minClaimsScore: 2,
    });
    expect(capIndices.size).toBe(0);
  });

  it("excludes nothing for an empty or missing score list", () => {
    expect(computeAiExclusion([], {}).floorIndices.size).toBe(0);
    expect(computeAiExclusion(undefined, {}).capIndices.size).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("analyzeCFile — excluded-page metadata", () => {
  it(
    "reports zero exclusions when every chunk clears the gates",
    { timeout: 20000 },
    async () => {
      const engine = makeEngine(() => OK_JSON);
      setAIMode(AI_MODES.LOCAL);
      registerLegacyEngine(engine);

      // 12 relevant pages → 2 chunks, both high-relevance → nothing excluded.
      let text = "";
      for (let p = 1; p <= 12; p++) {
        text += page(
          p,
          "Assessment: chronic right knee pain, service-connected radiculopathy and ptsd noted.",
        );
      }
      const result = await analyzeCFile(null, text, () => {}, null, {
        buildSemanticIndex: false,
      });

      expect(result.success).toBe(true);
      expect(result.metadata.pagesExcludedFromAI).toBe(0);
      expect(result.metadata.chunksExcludedFromAI).toBe(0);
      // Semantic index disabled for this test — surfaced honestly, not omitted.
      expect(result.metadata.semanticIndex.indexed).toBe(false);
    },
  );

  it(
    "analyzes low-score medically-flagged pages instead of skipping them (full-coverage policy)",
    { timeout: 20000 },
    async () => {
      const engine = makeEngine(() => OK_JSON);
      setAIMode(AI_MODES.LOCAL);
      registerLegacyEngine(engine);

      // Pages 1-4 highly relevant; pages 5-8 medically-flagged (Gate 2 passes on
      // "pain") but score 0 (no scored terms). With the relevance floor (Gate 3,
      // MIN_CLAIMS_SCORE=0) disabled for full coverage, their chunk is now
      // ANALYZED rather than floor-excluded — no page carrying a medical signal
      // is dropped for a low keyword score.
      let text = "";
      for (let p = 1; p <= 4; p++) {
        text += page(
          p,
          "Assessment: chronic knee pain, service-connected radiculopathy, ptsd diagnosis, tinnitus.",
        );
      }
      for (let p = 5; p <= 8; p++) {
        text += page(
          p,
          "The provider observed mild pain and general discomfort during the routine visit today.",
        );
      }
      const result = await analyzeCFile(null, text, () => {}, null, {
        buildSemanticIndex: false,
      });

      expect(result.success).toBe(true);
      // Full-coverage: the low-score chunk is no longer floor-excluded.
      expect(result.metadata.chunksExcludedFromAI).toBe(0);
      expect(result.metadata.pagesExcludedFromAI).toBe(0);
    },
  );

  it(
    "single-chunk documents report zero exclusions and carry the metadata shape",
    { timeout: 20000 },
    async () => {
      const engine = makeEngine(() => OK_JSON);
      setAIMode(AI_MODES.LOCAL);
      registerLegacyEngine(engine);

      const text =
        page(1, "Assessment: chronic knee pain, service-connected.") +
        page(2, "Tinnitus and hearing loss after acoustic trauma.");
      const result = await analyzeCFile(null, text, () => {}, null, {
        buildSemanticIndex: false,
      });

      expect(result.success).toBe(true);
      expect(result.metadata.pagesExcludedFromAI).toBe(0);
      expect(result.metadata.chunksExcludedFromAI).toBe(0);
      expect(result.metadata.semanticIndex.indexed).toBe(false);
    },
  );
});
