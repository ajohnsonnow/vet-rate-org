/**
 * Deterministic fake for @mlc-ai/web-llm — aliased in ONLY under `vite --mode
 * e2e` (see vite.config.js's resolve.alias). Headless Chromium reports
 * navigator.gpu but requestAdapter() resolves null, so the real engine can
 * never load there regardless of how long a test waits - this is what lets
 * an e2e spec drive an ai.aiReady-gated flow (Muster Call's Start Formation)
 * without a GPU, without downloading a multi-GB model, and without ever
 * shipping in a real build (see vite.config.js's mode guard).
 *
 * Covers every named export any real call site in src/ actually imports:
 * CreateWebWorkerMLCEngine + WebWorkerMLCEngineHandler (diamondSwarm.js /
 * webllm-swarm-worker.js - Muster Call's path), CreateMLCEngine,
 * hasModelInCache, and ModelType (useLocalAIProviderState.js - the separate
 * chat-panel model catalog, not exercised by Muster Call but kept import-safe
 * regardless).
 */

// diamondSwarm.js's _loadModelFromList spawns a real Worker running
// webllm-swarm-worker.js, which resolves this same alias and constructs one
// of these - but CreateWebWorkerMLCEngine below never actually posts a
// message to that worker (the fake engine it returns is fully self-
// contained), so this handler's onmessage is simply never called. A no-op
// class is enough to keep `new WebWorkerMLCEngineHandler()` and
// `self.onmessage = handler.onmessage` from throwing in the worker.
export class WebWorkerMLCEngineHandler {
  onmessage() {}
}

export const ModelType = { LLM: "LLM", VLM: "VLM", embedding: "embedding" };

export async function hasModelInCache() {
  return true;
}

// Marker embedded in musterCallProcessor.js's analyzeCFileWithAI system
// prompt - the one real call site in the app that asks the local swarm for
// a specific JSON shape. Keying off it (rather than generically walking an
// arbitrary JSON Schema neither this call nor any other on Muster Call's
// path actually sends) keeps this fake exactly as complex as the one real
// caller that needs structured output.
const MUSTER_CALL_CFILE_JSON_MARKER = "potential_claims";

function findSystemContent(messages) {
  return messages?.find((m) => m.role === "system")?.content || "";
}

function buildFakeCompletionText(config) {
  const systemContent = findSystemContent(config?.messages);
  if (systemContent.includes(MUSTER_CALL_CFILE_JSON_MARKER)) {
    // Matches analyzeCFileWithAI's documented schema exactly. Empty
    // findings are the honest answer for a synthetic fixture with nothing
    // in it to flag - its own system prompt says "Only include findings
    // present in text."
    return JSON.stringify({
      potential_claims: [],
      exposures: [],
      mentalHealth: { indicators: [], diagnoses: [] },
      actionItems: [
        "[e2e fake] Deterministic test engine - no real model ran.",
      ],
    });
  }
  return (
    "[e2e fake @mlc-ai/web-llm response] This is the deterministic test " +
    "engine (vite --mode e2e) - no real model ran, no data left this device."
  );
}

// Single-chunk stream: the app's own JSON-close scanner
// (diamondSwarm.js's _scanDeltaForJSONClose) and its plain-stream reader
// both fully consume one delta before checking for more, so a whole
// response in the first chunk plus an empty finish_reason chunk exercises
// both call sites identically to a real multi-chunk stream, without this
// fake needing to fabricate token-by-token timing.
function makeFakeStream(text) {
  const chunks = [
    { choices: [{ delta: { content: text } }] },
    { choices: [{ delta: {}, finish_reason: "stop" }] },
  ];
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
  };
}

function makeFakeEngine() {
  return {
    chat: {
      completions: {
        create: async (config) => {
          const text = buildFakeCompletionText(config);
          if (config?.stream) return makeFakeStream(text);
          return { choices: [{ message: { content: text } }] };
        },
      },
    },
    interruptGenerate: () => Promise.resolve(),
    unload: () => Promise.resolve(),
  };
}

async function reportFakeProgress(initProgressCallback) {
  initProgressCallback?.({ progress: 0.5, text: "[e2e fake] Loading..." });
  initProgressCallback?.({ progress: 1, text: "[e2e fake] Ready" });
}

export async function CreateWebWorkerMLCEngine(_worker, _modelId, options) {
  await reportFakeProgress(options?.initProgressCallback);
  return makeFakeEngine();
}

export async function CreateMLCEngine(_modelId, options) {
  await reportFakeProgress(options?.initProgressCallback);
  return makeFakeEngine();
}
