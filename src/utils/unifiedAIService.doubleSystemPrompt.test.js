/**
 * D15-2 (final15 QA review, 2026-09-28): the ADR-008 provider boundary
 * (`_buildFullPrompt` + `_redactPiecesForSend` inside `generateAIInternal`)
 * assembled the system prompt exactly once, but three backends
 * independently rebuilt or re-forwarded it afterward:
 *
 *  - generateWithCloudAI called buildCloudSystemPrompt AGAIN and
 *    re-concatenated the caller's raw, UNREDACTED options.systemPrompt onto
 *    the already-assembled prompt.
 *  - generateWithLocalAI sent the same text as both a separate "system"
 *    role message AND baked into the "user" role content it received.
 *  - generateWithWarrantCouncil forwarded options.systemPrompt to
 *    generateWithSwarm's own system-role parameter while ALSO receiving
 *    that same text pre-baked into the prompt string it passed as the
 *    user-role content.
 *
 * Every cloud/local-legacy/swarm request carried its system prompt twice,
 * and the second (re-forwarded) copy bypassed known-value redaction
 * entirely, since only the ONE combined string built by _buildFullPrompt
 * had ever been redacted.
 *
 * Fixture identifiers are synthetic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const FAKE_FIRST = "Jordan";
const FAKE_LAST = "Faketon";
const FAKE_NAME = `${FAKE_FIRST} ${FAKE_LAST}`;
// ISO format - scrubPII's pattern-based DOB check only matches MM/DD/YYYY or
// DD/MM/YYYY, never this shape, so a redaction hit here can only come from
// the known-value pass (the thing this test actually verifies).
const FAKE_DOB = "1984-03-15";
const SYSTEM_PROMPT_MARKER = "You are a helpful assistant.";

vi.mock("./localServerClient", () => ({
  checkServerHealth: vi.fn().mockResolvedValue({ available: false }),
  chatCompletion: vi.fn(),
  getServerConfig: vi.fn(() => ({ host: "localhost", port: 8080 })),
}));

vi.mock("./diamondSwarm", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateWithSwarm: vi.fn(),
  };
});

// Minimal fake IndexedDB - same pattern as
// unifiedAIService.adr008Redaction.test.js's own copy (this codebase's
// convention: duplicated per test file rather than a shared utility).
function makeRequest(run) {
  const request = {};
  queueMicrotask(() => {
    request.result = run();
    request.onsuccess?.();
  });
  return request;
}

function makeTransaction(storesByName) {
  const tx = { pending: 0, oncomplete: null };
  const track = (fn) => {
    tx.pending += 1;
    return makeRequest(() => {
      const result = fn();
      tx.pending -= 1;
      if (tx.pending === 0) queueMicrotask(() => tx.oncomplete?.());
      return result;
    });
  };
  tx.objectStore = (name) => {
    if (!storesByName.has(name)) storesByName.set(name, new Map());
    const rows = storesByName.get(name);
    return {
      get: (key) => track(() => rows.get(key)),
      put: (value) => track(() => rows.set(value.id, value)),
      delete: (key) => track(() => rows.delete(key)),
      getAll: () => track(() => Array.from(rows.values())),
      clear: () => track(() => rows.clear()),
      index: () => ({ getAll: () => track(() => Array.from(rows.values())) }),
    };
  };
  return tx;
}

const fakeDatabases = new Map();
window.indexedDB = {
  open: (dbName) => {
    if (!fakeDatabases.has(dbName)) fakeDatabases.set(dbName, new Map());
    const storesByName = fakeDatabases.get(dbName);
    return makeRequest(() => ({
      objectStoreNames: { contains: () => true },
      createObjectStore: (name) => {
        if (!storesByName.has(name)) storesByName.set(name, new Map());
        return { createIndex: () => {} };
      },
      transaction: () => makeTransaction(storesByName),
    }));
  },
};

const { initializeVKB, saveVKB } = await import("./veteranKnowledgeBase.js");
const diamondSwarm = await import("./diamondSwarm.js");
const {
  generateAI,
  setAIMode,
  AI_MODES,
  registerSwarmEngine,
  registerLocalAIEngine,
  resetAICircuitBreaker,
} = await import("./unifiedAIService.js");
const { AI_DATA_CLASS } = await import("./aiDataClassPolicy.js");

async function seedFixtureVkb() {
  const vkb = initializeVKB();
  vkb.personal.fullName = FAKE_NAME;
  vkb.personal.dateOfBirth = FAKE_DOB;
  await saveVKB(vkb);
}

/** Fake legacy WebLLM engine that records every chat-completion call. */
function makeCapturingLocalEngine() {
  const calls = [];
  return {
    calls,
    engine: {
      chat: {
        completions: {
          create: vi.fn(async (config) => {
            calls.push(config);
            return {
              choices: [
                {
                  message: { content: "OK response" },
                  finish_reason: "stop",
                },
              ],
            };
          }),
        },
      },
    },
  };
}

function baseOptions() {
  return {
    // ADR-009: this fixture's prompt ("Please analyze this claim.") is a
    // generic context-style call, not a document upload - declared
    // explicitly so it isn't blocked by the fail-closed default this suite
    // predates.
    dataClass: AI_DATA_CLASS.CONTEXT,
    systemPrompt: `${SYSTEM_PROMPT_MARKER} The veteran is ${FAKE_NAME}, born ${FAKE_DOB}.`,
    skipCrisisCheck: true,
    skipFeatureCheck: true,
    skipHallucinationCheck: true,
    skipValidation: true,
    useDKB: false,
  };
}

beforeEach(async () => {
  localStorage.clear();
  vi.clearAllMocks();
  resetAICircuitBreaker();
  registerSwarmEngine(null, false, false, null);
  registerLocalAIEngine(null, false, false, null, false);
  vi.stubGlobal("fetch", vi.fn());
  await seedFixtureVkb();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("D15-2: the system prompt is sent exactly once per backend, and redacted", () => {
  it("CLOUD: the marker text appears exactly once in the request body, with the known name/DOB inside it redacted", async () => {
    setAIMode(AI_MODES.CLOUD);
    localStorage.setItem(
      "vetrate_gemini_key",
      "AIzaSyValidKey12345678901234567890123",
    );
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "ok" }] } }],
      }),
    });

    await generateAI("Please analyze this claim.", baseOptions());

    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    const sentText = body.contents[0].parts[0].text;

    const occurrences = sentText.split(SYSTEM_PROMPT_MARKER).length - 1;
    expect(occurrences).toBe(1);
    expect(sentText).not.toContain(FAKE_FIRST);
    expect(sentText).not.toContain(FAKE_LAST);
    expect(sentText).not.toContain(FAKE_DOB);
    expect(sentText).toContain("Please analyze this claim.");
  });

  it("LEGACY LOCAL: the marker text reaches only one message role once in total, with the known name/DOB inside it redacted", async () => {
    const { engine, calls } = makeCapturingLocalEngine();
    registerLocalAIEngine(engine, true, false, "test-model", false);
    registerSwarmEngine(null, false, false, null);
    setAIMode(AI_MODES.LOCAL);

    await generateAI("Please analyze this claim.", baseOptions());

    expect(calls).toHaveLength(1);
    const { messages } = calls[0];
    const totalOccurrences = messages.reduce(
      (sum, m) => sum + (m.content.split(SYSTEM_PROMPT_MARKER).length - 1),
      0,
    );
    expect(totalOccurrences).toBe(1);

    const allContent = messages.map((m) => m.content).join("\n");
    expect(allContent).not.toContain(FAKE_FIRST);
    expect(allContent).not.toContain(FAKE_LAST);
    expect(allContent).not.toContain(FAKE_DOB);
    expect(allContent).toContain("Please analyze this claim.");
  });

  it("WARRANT COUNCIL: the marker text is forwarded once as the agent's system role and never also baked into the user prompt, with the known name/DOB inside it redacted", async () => {
    registerSwarmEngine({}, true, false, "auditor");
    setAIMode(AI_MODES.SWARM);
    diamondSwarm.generateWithSwarm.mockResolvedValue({ text: "OK response" });

    await generateAI("Please analyze this claim.", baseOptions());

    expect(diamondSwarm.generateWithSwarm).toHaveBeenCalledTimes(1);
    const [userPrompt, swarmOptions] =
      diamondSwarm.generateWithSwarm.mock.calls[0];

    expect(swarmOptions.systemPrompt).toContain(SYSTEM_PROMPT_MARKER);
    expect(userPrompt).not.toContain(SYSTEM_PROMPT_MARKER);

    const combined = `${swarmOptions.systemPrompt}\n${userPrompt}`;
    expect(combined).not.toContain(FAKE_FIRST);
    expect(combined).not.toContain(FAKE_LAST);
    expect(combined).not.toContain(FAKE_DOB);
    expect(userPrompt).toContain("Please analyze this claim.");
  });

  it("WARRANT COUNCIL (no caller systemPrompt): the generic app-context default is folded into the user turn instead of overriding the agent's own persona system prompt", async () => {
    registerSwarmEngine({}, true, false, "auditor");
    setAIMode(AI_MODES.SWARM);
    diamondSwarm.generateWithSwarm.mockResolvedValue({ text: "OK response" });

    await generateAI("Please analyze this claim.", {
      skipCrisisCheck: true,
      skipFeatureCheck: true,
      skipHallucinationCheck: true,
      skipValidation: true,
      useDKB: false,
    });

    expect(diamondSwarm.generateWithSwarm).toHaveBeenCalledTimes(1);
    const [userPrompt, swarmOptions] =
      diamondSwarm.generateWithSwarm.mock.calls[0];

    // No systemPrompt forwarded at all -> generateWithSwarm's own
    // `systemPrompt || agent.systemPrompt` fallback uses the agent's own
    // persona (CW3 Rater / CW4 Writer / CW5 Auditor), not a generic default.
    expect(swarmOptions.systemPrompt).toBeUndefined();
    expect(userPrompt).toContain("Please analyze this claim.");
  });
});
