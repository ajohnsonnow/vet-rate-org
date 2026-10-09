/**
 * D14-1 / ADR-008 (final14 QA review, 2026-09-28): the 5 builder-level
 * redaction passes (generateLLMContext, generatePacketContext,
 * getVeteranAIContext, buildSystemPrompt, callGeminiAPI) are NOT the
 * provider boundary - generateAI (and every backend it dispatches to)
 * applied only pattern-based scrubPII, which has no way to detect a bare
 * name. A caller that builds its own prompt (Muster Call's batch report,
 * WitnessBench's compileStatementWithAI, decodeDecision, ...) bypassed
 * every one of them. generateAIInternal now redacts the fully-combined
 * prompt right before ANY backend is dispatched.
 *
 * Also covers the local llama.cpp server path's argument-order/return-shape
 * bug found while tracing this: chatCompletion's real signature is
 * (messages, systemPrompt, options) resolving to the completion text
 * directly, not a {success, text, error} object - the pre-fix call always
 * threw "Local server generation failed" regardless of the real outcome.
 *
 * ADR-009 decision E (2026-09-29) amendment: a call with no declared
 * `dataClass` fails closed to "document" (aiDataClassPolicy.resolveDataClass),
 * and a document-classed call to a genuinely on-device backend (this file's
 * "localhost" local-server fixture) is now EXEMPT from this redaction -
 * nothing leaves the machine, so the on-device model may see the real
 * identifier. The first test below used to assert the opposite; it now
 * proves the exemption, and a second test proves a CONTEXT-classed call on
 * the SAME on-device backend is still redacted (the exemption is scoped to
 * "document", not "on-device" alone).
 *
 * Fixture identifiers are synthetic.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const FAKE_NAME = "Jordan Q Faketon";
const FAKE_FIRST = "Jordan";
const FAKE_LAST = "Faketon";

vi.mock("./localServerClient", () => ({
  checkServerHealth: vi.fn(async () => ({ available: true, model: "test" })),
  chatCompletion: vi.fn(async () => "OK response from the local model"),
  // ADR-009: the provider boundary re-checks the local server's CURRENT
  // configured host on every call (isLoopbackHost) - "localhost" here keeps
  // this file's existing on-device local-server scenario on-device.
  getServerConfig: vi.fn(() => ({ host: "localhost", port: 8080 })),
}));

// Minimal fake IndexedDB - same pattern as
// veteranContextProvider.piiRedaction.test.js's own copy (this codebase's
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
const localServerClient = await import("./localServerClient.js");
const { generateAI, setAIMode, checkLocalServer, AI_MODES } =
  await import("./unifiedAIService.js");

async function seedFixtureVkb() {
  const vkb = initializeVKB();
  vkb.personal.fullName = FAKE_NAME;
  await saveVKB(vkb);
}

beforeEach(async () => {
  localStorage.clear();
  vi.clearAllMocks();
  localServerClient.checkServerHealth.mockResolvedValue({
    available: true,
    model: "test",
  });
  localServerClient.chatCompletion.mockResolvedValue(
    "OK response from the local model",
  );
  await seedFixtureVkb();
  setAIMode(AI_MODES.LOCAL_SERVER);
  await checkLocalServer(true);
});

describe("generateAI: single enforcement point redacts the raw caller prompt", () => {
  it("ADR-009 decision E: a call with no declared dataClass fails closed to 'document', and reaching a genuinely on-device (loopback) backend is EXEMPT from redaction - the veteran's name IS sent", async () => {
    const rawPrompt = `Witness statement: I have known ${FAKE_NAME} for 10 years.`;

    await generateAI(rawPrompt, {
      systemPrompt: "You are a helpful assistant.",
      skipCrisisCheck: true,
      skipValidation: true,
      skipHallucinationCheck: true,
      useDKB: false,
    });

    expect(localServerClient.chatCompletion).toHaveBeenCalledTimes(1);
    const [messages] = localServerClient.chatCompletion.mock.calls[0];
    const sentContent = messages[0].content;
    expect(sentContent).toContain(FAKE_FIRST);
    expect(sentContent).toContain(FAKE_LAST);
    expect(sentContent).toContain("Witness statement");
  });

  it("a CONTEXT-classed call on the SAME on-device backend is still redacted - the decision E exemption is scoped to 'document', not to on-device alone", async () => {
    const rawPrompt = `Witness statement: I have known ${FAKE_NAME} for 10 years.`;

    await generateAI(rawPrompt, {
      dataClass: "context",
      systemPrompt: "You are a helpful assistant.",
      skipCrisisCheck: true,
      skipValidation: true,
      skipHallucinationCheck: true,
      useDKB: false,
    });

    expect(localServerClient.chatCompletion).toHaveBeenCalledTimes(1);
    const [messages] = localServerClient.chatCompletion.mock.calls[0];
    const sentContent = messages[0].content;
    expect(sentContent).not.toContain(FAKE_FIRST);
    expect(sentContent).not.toContain(FAKE_LAST);
    expect(sentContent).toContain("Witness statement");
  });
});

describe("generateWithLocalServer: correct chatCompletion call shape", () => {
  it("passes the prompt as a messages array and returns the real completion text", async () => {
    const result = await generateAI("Describe the veteran's claim.", {
      systemPrompt: "You are a helpful assistant.",
      skipCrisisCheck: true,
      skipValidation: true,
      skipHallucinationCheck: true,
      useDKB: false,
    });

    expect(result.text).toBe("OK response from the local model");
    const [messages, systemPromptArg] =
      localServerClient.chatCompletion.mock.calls[0];
    expect(Array.isArray(messages)).toBe(true);
    expect(messages[0]).toMatchObject({ role: "user" });
    expect(typeof systemPromptArg).toBe("string");
  });
});
