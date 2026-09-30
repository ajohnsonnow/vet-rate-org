/**
 * ADR-008 / owner decision D (final14 QA review, 2026-09-28):
 * compileStatementWithAI joined the witness's raw interview answers into a
 * prompt and called generateAI directly, never going through
 * aiStatementHelper's callGeminiAPI/_finalizeAiPrompt (the only
 * statement-helper redaction pass at the time). A witness's answer that
 * names the veteran ("I've known Jordan Faketon for 10 years...") reached
 * the model unredacted, cloud or on-device.
 *
 * generateAI now redacts the fully-combined prompt centrally (see
 * unifiedAIService.adr008Redaction.test.js) before any backend dispatch,
 * so this exercises the REAL generateAI (mocking only the local-server
 * backend and IndexedDB) to prove WitnessBench's own send path is actually
 * covered - not just the generic mechanism.
 *
 * Fixture identifiers are synthetic.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const FAKE_NAME = "Jordan Q Faketon";
const FAKE_FIRST = "Jordan";
const FAKE_LAST = "Faketon";

vi.mock("../utils/localServerClient", () => ({
  checkServerHealth: vi.fn(async () => ({ available: true, model: "test" })),
  chatCompletion: vi.fn(async () => "OK response from the local model"),
  getServerConfig: vi.fn(() => ({ host: "localhost", port: 8080 })),
}));

// Minimal fake IndexedDB - same pattern as
// veteranContextProvider.piiRedaction.test.js's own copy.
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

const { initializeVKB, saveVKB } =
  await import("../utils/veteranKnowledgeBase.js");
const localServerClient = await import("../utils/localServerClient.js");
const { setAIMode, checkLocalServer, AI_MODES } =
  await import("../utils/unifiedAIService.js");
const { _compileStatementWithAI } = await import("./WitnessBench.jsx");

beforeEach(async () => {
  localStorage.clear();
  vi.clearAllMocks();
  localServerClient.checkServerHealth.mockResolvedValue({
    available: true,
    model: "test",
  });
  localServerClient.chatCompletion.mockResolvedValue(
    "I have observed [Veteran] struggling with daily tasks.",
  );
  const vkb = initializeVKB();
  vkb.personal.fullName = FAKE_NAME;
  await saveVKB(vkb);
  setAIMode(AI_MODES.LOCAL_SERVER);
  await checkLocalServer(true);
});

describe("WitnessBench._compileStatementWithAI: real generateAI pipeline redacts the witness's answers", () => {
  it("never sends the veteran's name to the backend, even though the witness typed it verbatim", async () => {
    await _compileStatementWithAI("spouse", "PTSD", {
      q1: `I've known ${FAKE_NAME} for 10 years; ${FAKE_FIRST} stopped sleeping after 2008.`,
      q2: "They avoid crowds and loud noises.",
    });

    expect(localServerClient.chatCompletion).toHaveBeenCalledTimes(1);
    const [messages] = localServerClient.chatCompletion.mock.calls[0];
    const sentContent = messages[0].content;
    expect(sentContent).not.toContain(FAKE_FIRST);
    expect(sentContent).not.toContain(FAKE_LAST);
    expect(sentContent).toContain("avoid crowds and loud noises");
  });
});
