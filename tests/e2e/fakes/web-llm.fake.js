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
// prompt AND cfileAnalyzer.js's CFILE_SYSTEM_PROMPT(_COMPACT) - both the
// Muster Call and C-File Analyzer document paths ask the local swarm for
// this exact JSON shape. Keying off it (rather than generically walking an
// arbitrary JSON Schema no caller on either path actually sends) keeps this
// fake exactly as complex as the real callers that need structured output.
const CFILE_JSON_MARKER = "potential_claims";

// DD214Analyzer.jsx's two system prompts (LOCAL condensed / full) share this
// exact phrase; DD214_ANALYSIS_SYSTEM_PROMPT_LOCAL/DD214_ANALYSIS_SYSTEM_PROMPT.
const DD214_JSON_MARKER = "military records analyst";
const PLANT_IDENTIFIERS_MARKER = "E2E_PLANT_WRONG_IDENTIFIERS";
// Opt-in: a reply that fills nearly every non-identifier field, to prove none
// of it is pre-ticked where the local parser read only a few.
const FILL_EVERY_FIELD_MARKER = "E2E_MODEL_FILLS_EVERY_FIELD";
const EVERY_FIELD_REPLY = {
  component: "RA",
  componentFull: "Regular Army",
  branch: "Navy",
  rank: "SGT",
  payGrade: "E-9",
  dateOfRank: "2005-01-01",
  mos: "11B",
  mosTitle: "Rifleman",
  sglCoverage: "$400,000",
  entryDate: "2003-02-02",
  separationDate: "2011-07-07",
  reserveObligationDate: "2016-07-07",
  separationAuthority: "AR 635-200, Chapter 4",
  separationCode: "KND",
  reentryCode: "RE-1",
  separationType: "Honorable Discharge",
  characterOfService: "General",
  narrativeReason: "Completion of required service",
  militaryEducation: ["Basic Leader Course"],
  specialQualifications: ["Airborne"],
  securityClearance: "Secret",
};

// BlueButtonXRay.jsx's BLUE_BUTTON_AI_PROMPT_HEADER - sent as the main
// (user-role) prompt, not a systemPrompt option, so this is matched against
// user content below rather than system content.
const BLUE_BUTTON_JSON_MARKER = "VA Blue Button report";

// aiStatementHelper.js's buildDecisionDecoderPrompt - also user-role, not a
// systemPrompt option ("favorable_findings" is a field name unique to this
// tool's schema, unlike the generic "You are a VA claims expert" system
// prompt it's paired with).
const DECISION_DECODER_JSON_MARKER = "favorable_findings";

function findSystemContent(messages) {
  return messages?.find((m) => m.role === "system")?.content || "";
}

function findUserContent(messages) {
  return (
    messages
      ?.filter((m) => m.role === "user")
      .map((m) => m.content)
      .join("\n") || ""
  );
}

// Records every completion this fake engine receives, keyed to the exact
// prompt content, so an e2e spec can assert (from the browser context) that
// a specific document's text actually reached the on-device engine - the
// counterpart to a network-level page.route() assertion for a real backend,
// which this fake has no network call for.
function recordFakeEngineCall(systemContent, userContent) {
  if (typeof window === "undefined") return;
  window.__e2eFakeEngineCalls ??= [];
  window.__e2eFakeEngineCalls.push({
    system: systemContent,
    user: userContent,
  });
}

function buildFakeCompletionText(systemContent, userContent) {
  if (systemContent.includes(CFILE_JSON_MARKER)) {
    // Matches analyzeCFileWithAI's/cfileAnalyzer's documented schema
    // exactly. Empty findings are the honest answer for a synthetic fixture
    // with nothing in it to flag - both system prompts say "only report
    // findings present in the text."
    return JSON.stringify({
      potential_claims: [],
      exposures: [],
      mentalHealth: { indicators: [], diagnoses: [] },
      actionItems: [
        "[e2e fake] Deterministic test engine - no real model ran.",
      ],
    });
  }
  if (systemContent.includes(DD214_JSON_MARKER)) {
    // Opt-in (a marker in the document text): a model that invents identifiers
    // under canonical, alias and nested keys, to prove none is shown or saved.
    const planted = userContent.includes(PLANT_IDENTIFIERS_MARKER)
      ? {
          fullName: "PLANTEDNAME, WRONG",
          ssnLast4: "0000",
          SSN: "987-65-4322",
          socialSecurityNumber: "987-65-4323",
          DOB: "1971-07-08",
          veteranName: "ALIASNAME, PLANTED",
          personal: { fullName: "NESTEDNAME, PLANTED", ssn: "111-22-3333" },
        }
      : {};
    const everyField = userContent.includes(FILL_EVERY_FIELD_MARKER)
      ? EVERY_FIELD_REPLY
      : {};
    return JSON.stringify({
      ...planted,
      documentCount: 1,
      documentTypes: ["DD214"],
      masterRecordType: "DD214",
      branch: "Army",
      rank: "SGT",
      mos: "11B",
      entryDate: "2010-01-01",
      separationDate: "2014-01-01",
      characterOfService: "Honorable",
      ...everyField,
      extractionNotes: [
        "[e2e fake] Deterministic test engine - no real model ran.",
      ],
    });
  }
  if (userContent.includes(BLUE_BUTTON_JSON_MARKER)) {
    return JSON.stringify({
      conditions: [
        {
          name: "Tinnitus",
          dateFound: null,
          isClaimable: true,
          category: "ENT",
        },
      ],
      summary: "[e2e fake] Deterministic test engine - no real model ran.",
    });
  }
  if (userContent.includes(DECISION_DECODER_JSON_MARKER)) {
    return JSON.stringify({
      decision_type: "Full Denial",
      favorable_findings: [],
      plain_english:
        "[e2e fake] Deterministic test engine - no real model ran.",
      va_reasoning: "[e2e fake] no real model ran",
      missing_elements: ["Nexus letter"],
      action_plan: ["Obtain a nexus letter"],
      appeal_options: "Supplemental Claim, HLR, or BVA appeal",
      deadline_warning: "1 year from the decision date",
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
          const systemContent = findSystemContent(config?.messages);
          const userContent = findUserContent(config?.messages);
          recordFakeEngineCall(systemContent, userContent);
          const text = buildFakeCompletionText(systemContent, userContent);
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
  // window.__e2eFakeEngineStall: report some progress, then never finish, like
  // a model download that has stopped.
  if (typeof window !== "undefined" && window.__e2eFakeEngineStall) {
    options?.initProgressCallback?.({
      progress: 0.3,
      text: "[e2e fake] Fetching param cache 3/10",
    });
    await new Promise(() => {});
  }
  await reportFakeProgress(options?.initProgressCallback);
  return makeFakeEngine();
}

export async function CreateMLCEngine(_modelId, options) {
  await reportFakeProgress(options?.initProgressCallback);
  return makeFakeEngine();
}
