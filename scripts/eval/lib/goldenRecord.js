import { createHash } from "node:crypto";

export const sha256Hex = (text) =>
  createHash("sha256").update(text, "utf8").digest("hex");

const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function validateModelId(modelId) {
  if (typeof modelId !== "string" || !MODEL_ID_PATTERN.test(modelId)) {
    throw new Error(
      `invalid model id ${JSON.stringify(modelId)}: use letters, digits, '.', '_' and '-' only (max 128), e.g. Qwen2.5-3B-Instruct-q4f16_1-MLC`,
    );
  }
  return modelId;
}

export function runStamp(date = new Date()) {
  const iso = date.toISOString();
  return `${iso.slice(0, 10)}_${iso.slice(11, 19).replaceAll(":", "")}`;
}

export function runBaseName(modelId, date = new Date()) {
  return `run_${runStamp(date)}_${validateModelId(modelId)}`;
}

const textOf = (content) => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : (part?.text ?? "")))
      .join("");
  }
  return "";
};

const KB_HEADER = String.raw`=== (?:REFERENCE MATERIAL|[^\n]*DIAMOND KNOWLEDGE BASE \(DKB\) CONTEXT) ===`;
const KB_FOOTER = String.raw`=== END (?:REFERENCE MATERIAL|DKB CONTEXT) ===`;
const KB_MARKER = new RegExp(KB_HEADER);
const KB_COUNT =
  /\[(\d+) (?:reference|relevant (?:DKB|knowledge base)) entries provided(?:: (\d+) retrieved from the full corpus)?/;
const KB_BLOCK = new RegExp(String.raw`${KB_HEADER}[\s\S]*?${KB_FOOTER}`);
const COMPUTED_BLOCK =
  /=== COMPUTED RESULT \([\s\S]*?=== END COMPUTED RESULT ===/;
const COMPUTED_MARKER = "=== COMPUTED RESULT (";
const VERIFIED_BLOCK =
  /=== VERIFIED REFERENCE ===[\s\S]*?=== END VERIFIED REFERENCE ===/;
const VERIFIED_MARKER = "=== VERIFIED REFERENCE ===";

/**
 * Derive what the engine actually received from the chat request captured at
 * the engine boundary. `personaPrompts` maps agent id to that persona's
 * systemPrompt text; the actual agent is whichever persona's prompt the
 * engine got as its system message.
 */
export function analyzeEngineRequest(captured, personaPrompts) {
  if (!captured || !Array.isArray(captured.messages)) {
    return {
      actualAgent: null,
      systemPromptFingerprint: null,
      kbContextInjected: null,
      kbEntryCount: null,
      kbShardCount: null,
      kbContext: null,
      computedResultInjected: null,
      computedResult: null,
      verifiedReferenceInjected: null,
      verifiedReference: null,
      temperature: null,
      maxTokens: null,
    };
  }
  const system = captured.messages.find((m) => m?.role === "system");
  const systemText = textOf(system?.content);
  const allText = captured.messages.map((m) => textOf(m?.content)).join("\n");

  const matched = Object.entries(personaPrompts ?? {}).find(
    ([, prompt]) => prompt === systemText,
  );
  const kbInjected = KB_MARKER.test(allText);
  const kbCount = KB_COUNT.exec(allText);
  let kbEntryCount = 0;
  if (kbInjected) kbEntryCount = kbCount ? Number(kbCount[1]) : null;
  let actualAgent = null;
  if (system) actualAgent = matched ? matched[0] : "unknown";

  return {
    actualAgent,
    systemPromptFingerprint: system ? sha256Hex(systemText) : null,
    kbContextInjected: kbInjected,
    kbEntryCount,
    kbShardCount: kbInjected && kbCount ? Number(kbCount[2] ?? 0) : null,
    kbContext: KB_BLOCK.exec(allText)?.[0] ?? null,
    computedResultInjected: allText.includes(COMPUTED_MARKER),
    computedResult: COMPUTED_BLOCK.exec(allText)?.[0] ?? null,
    verifiedReferenceInjected: allText.includes(VERIFIED_MARKER),
    verifiedReference: VERIFIED_BLOCK.exec(allText)?.[0] ?? null,
    temperature: captured.temperature ?? null,
    maxTokens: captured.max_tokens ?? null,
  };
}

export function buildCaseRecord({
  caseDef,
  run,
  captured,
  personaPrompts,
  response,
  latencyMs,
  error,
  extra = {},
}) {
  const observed = analyzeEngineRequest(captured, personaPrompts);
  return {
    type: "case",
    id: caseDef.id,
    toolId: caseDef.toolId,
    scenario: caseDef.scenario,
    input: caseDef.input,
    expectedAgent: caseDef.expectedAgent,
    actualAgent: observed.actualAgent,
    modelIdRequested: run.modelIdRequested,
    modelIdLoaded: run.modelIdLoaded,
    systemPromptFingerprint: observed.systemPromptFingerprint,
    kbContextInjected: observed.kbContextInjected,
    kbEntryCount: observed.kbEntryCount,
    kbShardCount: observed.kbShardCount,
    kbContext: observed.kbContext,
    computedResultInjected: observed.computedResultInjected,
    computedResult: observed.computedResult,
    verifiedReferenceInjected: observed.verifiedReferenceInjected,
    verifiedReference: observed.verifiedReference,
    temperature: observed.temperature ?? run.temperature ?? null,
    maxTokens: observed.maxTokens ?? run.maxTokens ?? null,
    engineRequests: extra.engineRequests ?? (captured ? 1 : 0),
    response: response ?? "",
    latencyMs: latencyMs ?? null,
    error: error ?? null,
    ...(extra.validationErrors
      ? { validationErrors: extra.validationErrors }
      : {}),
    ...(extra.validationWarnings
      ? { validationWarnings: extra.validationWarnings }
      : {}),
    ts: extra.ts ?? new Date().toISOString(),
  };
}

export function buildMetaRecord({
  engine,
  modelIdRequested,
  modelIdLoaded,
  device,
  settings,
  personaFingerprints,
}) {
  return {
    type: "meta",
    engine,
    modelIdRequested,
    modelIdLoaded,
    device,
    settings,
    personaFingerprints,
    ts: new Date().toISOString(),
  };
}

export function fingerprintPersonas(personaPrompts) {
  return Object.fromEntries(
    Object.entries(personaPrompts ?? {}).map(([id, prompt]) => [
      id,
      sha256Hex(prompt),
    ]),
  );
}

export function parseTranscript(text) {
  const lines = text
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l, i) => {
      try {
        return JSON.parse(l);
      } catch (err) {
        throw new Error(
          `transcript line ${i + 1} is not valid JSON: ${err.message}`,
        );
      }
    });
  return {
    meta: lines.find((l) => l.type === "meta") ?? null,
    cases: lines.filter((l) => l.type === "case"),
  };
}
