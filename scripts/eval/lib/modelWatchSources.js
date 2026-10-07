/**
 * Source readers for the model watch. Network responses are untrusted: each
 * parser keeps only validated ids and numbers and throws a SourceError, naming
 * the source, when the response is not the shape it expects.
 */
import {
  canonicalId,
  isSafeModelId,
  licenceFromTags,
  safeIsoDate,
  safeNumber,
  safeToken,
} from "./modelWatchClassify.js";

export const WEBLLM_CONFIG_URL =
  "https://raw.githubusercontent.com/mlc-ai/web-llm/main/src/config.ts";
export const HF_ORGS = ["mlc-ai", "onnx-community"];
export const RUNTIME_PACKAGES = [
  "@mlc-ai/web-llm",
  "@huggingface/transformers",
  "@wllama/wllama",
  "tesseract.js",
];
export const HF_PAGE_SIZE = 100;
export const HF_MAX_PAGES = 5;
export const HF_WINDOW_DAYS = 30;
const MIN_WEBLLM_MODELS = 20;
const MAX_BODY_CHARS = 5_000_000;
const FETCH_TIMEOUT_MS = 30_000;

export class SourceError extends Error {
  constructor(source, message) {
    super(message);
    this.name = "SourceError";
    this.source = source;
  }
}

export function cleanMessage(message) {
  return String(message)
    .replace(/[^A-Za-z0-9 .:/_()@,-]/g, "?")
    .slice(0, 200);
}

async function getResponse(source, url, fetchImpl) {
  let res;
  try {
    res = await fetchImpl(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    throw new SourceError(
      source,
      `request failed: ${cleanMessage(err?.message)}`,
    );
  }
  if (!res.ok) throw new SourceError(source, `HTTP ${Number(res.status)}`);
  return res;
}

async function getText(source, url, fetchImpl) {
  const res = await getResponse(source, url, fetchImpl);
  const text = await res.text();
  if (text.length > MAX_BODY_CHARS) {
    throw new SourceError(source, "response larger than the size cap");
  }
  return { text, res };
}

function parseJson(source, text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new SourceError(source, "response is not valid JSON");
  }
}

function splitEntryBlocks(region) {
  const blocks = [];
  let current = null;
  for (const line of region.split("\n")) {
    if (line === "    {") current = [];
    else if (current && (line === "    }," || line === "    }")) {
      blocks.push(current.join("\n"));
      current = null;
    } else if (current) current.push(line);
  }
  return blocks;
}

export function parseWebLlmConfig(text, source = "webllm-config") {
  const start = text.indexOf("export const prebuiltAppConfig");
  if (start < 0) throw new SourceError(source, "prebuiltAppConfig not found");
  const region = text.slice(start);
  const blocks = splitEntryBlocks(region);
  const declared = region
    .split("\n")
    .filter((line) => line.trim().startsWith("model_id:")).length;
  if (blocks.length < MIN_WEBLLM_MODELS || blocks.length !== declared) {
    throw new SourceError(
      source,
      `parsed ${blocks.length} model entries but found ${declared} model_id fields`,
    );
  }
  const models = [];
  for (const body of blocks) {
    const id = /model_id:\s*"([^"]*)"/.exec(body)?.[1];
    if (!isSafeModelId(id)) continue;
    const vram = /vram_required_MB:\s*(\d+(?:\.\d+)?)\s*,/.exec(body)?.[1];
    models.push({
      id,
      vramMb:
        vram === undefined ? null : safeNumber(Number(vram), { max: 1e6 }),
      type: /model_type:\s*ModelType\.(\w+)/.exec(body)?.[1] ?? "LLM",
    });
  }
  return { models, rejected: blocks.length - models.length };
}

export function parseHfPage(json, source) {
  if (!Array.isArray(json)) {
    throw new SourceError(source, "expected a JSON array of models");
  }
  const models = [];
  let rejected = 0;
  for (const item of json) {
    if (!item || typeof item !== "object" || !isSafeModelId(item.id)) {
      rejected++;
      continue;
    }
    models.push({
      id: item.id,
      pipelineTag: safeToken(item.pipeline_tag),
      licence: licenceFromTags(item.tags),
      createdAt: safeIsoDate(item.createdAt),
      downloads: safeNumber(item.downloads),
    });
  }
  return { models, rejected };
}

function hfUrl(org) {
  const params = new URLSearchParams({
    author: org,
    sort: "createdAt",
    direction: "-1",
    limit: String(HF_PAGE_SIZE),
  });
  for (const field of ["pipeline_tag", "createdAt", "downloads", "tags"]) {
    params.append("expand[]", field);
  }
  return `https://huggingface.co/api/models?${params}`;
}

function nextLink(res) {
  const part = (res.headers.get("link") ?? "")
    .split(",")
    .find((p) => p.includes('rel="next"'));
  const url = part?.slice(part.indexOf("<") + 1, part.indexOf(">"));
  return url?.startsWith("https://huggingface.co/api/models?") ? url : null;
}

/** Pages newest-first until a page reaches back past the window. */
export async function fetchHfOrg(org, { fetchImpl, now }) {
  const source = `huggingface:${org}`;
  const cutoff = now - HF_WINDOW_DAYS * 86_400_000;
  const models = [];
  let rejected = 0;
  let url = hfUrl(org);
  for (let page = 0; page < HF_MAX_PAGES; page++) {
    const { text, res } = await getText(source, url, fetchImpl);
    const parsed = parseHfPage(parseJson(source, text), source);
    models.push(...parsed.models);
    rejected += parsed.rejected;
    const oldest = parsed.models.at(-1)?.createdAt;
    if (!oldest || Date.parse(oldest) < cutoff) return { models, rejected };
    url = nextLink(res);
    if (!url) return { models, rejected };
  }
  throw new SourceError(
    source,
    `still inside the ${HF_WINDOW_DAYS}-day window after ${HF_MAX_PAGES} pages`,
  );
}

export function parseNpmLatest(json, source) {
  const version = json?.version;
  if (
    typeof version !== "string" ||
    !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)
  ) {
    throw new SourceError(source, "no usable version field");
  }
  return version;
}

export async function fetchNpmLatest(name, { fetchImpl }) {
  const source = `npm:${name}`;
  const { text } = await getText(
    source,
    `https://registry.npmjs.org/${name.replaceAll("/", "%2F")}/latest`,
    fetchImpl,
  );
  return parseNpmLatest(parseJson(source, text), source);
}

export async function fetchWebLlmConfig({ fetchImpl }) {
  const { text } = await getText("webllm-config", WEBLLM_CONFIG_URL, fetchImpl);
  return parseWebLlmConfig(text);
}

const TIER_LISTS = [
  "desktop-high",
  "desktop-mid",
  "laptop",
  "tablet",
  "mobile",
];

function resolveTierList(listBody, detector) {
  const ids = [];
  for (const [, spread, id] of listBody.matchAll(
    /\.\.\.([A-Z_][A-Z0-9_]*)|"([A-Za-z0-9._-]+)"/g,
  )) {
    if (id) {
      ids.push(id);
      continue;
    }
    const constant = new RegExp(`const ${spread} = \\[([^\\]]*)\\]`).exec(
      detector,
    );
    if (!constant) {
      throw new SourceError(
        "app-models:deviceCapabilityDetector.js",
        `no list named ${spread}`,
      );
    }
    for (const [, listed] of constant[1].matchAll(/"([A-Za-z0-9._-]+)"/g)) {
      ids.push(listed);
    }
  }
  return ids;
}

/** The models the app loads today, read from the source files. */
export function parseAppModels({ detector, florence, smolvlm, legalRag }) {
  const models = [];
  for (const tier of TIER_LISTS) {
    const match = new RegExp(
      `case "${tier}":\\s*(?:default:\\s*)?return \\{\\s*recommendedModels: \\[([^\\]]*)\\]`,
    ).exec(detector);
    if (!match) {
      throw new SourceError(
        "app-models:deviceCapabilityDetector.js",
        `no recommendedModels list for tier ${tier}`,
      );
    }
    for (const id of resolveTierList(match[1], detector)) {
      models.push({ id, kind: "text", role: `text, ${tier} tier`, tier });
    }
  }
  const single = (text, pattern, file, kind, role) => {
    const id = pattern.exec(text)?.[1];
    if (!isSafeModelId(id)) {
      throw new SourceError(
        `app-models:${file}`,
        "model id constant not found",
      );
    }
    models.push({ id, kind, role, tier: null });
  };
  single(
    florence,
    /const MODEL_ID = "([^"]+)"/,
    "florence-ocr-worker.js",
    "vision",
    "document OCR",
  );
  single(
    smolvlm,
    /const MODEL_ID = "([^"]+)"/,
    "smolvlm-worker.js",
    "vision",
    "vision",
  );
  single(
    legalRag,
    /export const EMBED_MODEL = "([^"]+)"/,
    "legalRag.js",
    "embedding",
    "embedding",
  );
  return models;
}

export function parseDeclaredVersions(packageJsonText) {
  const source = "app-models:package.json";
  const pkg = parseJson(source, packageJsonText);
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  return Object.fromEntries(
    RUNTIME_PACKAGES.map((name) => {
      const range = all[name];
      if (typeof range !== "string") {
        throw new SourceError(source, `${name} is not declared`);
      }
      return [name, range];
    }),
  );
}

export function parseSnapshot(text) {
  const source = "snapshot";
  const json = parseJson(source, text);
  if (!Array.isArray(json?.models) || !json.models.every(isSafeModelId)) {
    throw new SourceError(source, "models must be an array of valid model ids");
  }
  return new Set(json.models.map(canonicalId));
}

/**
 * Runs every source independently; a failure is recorded against its source
 * and the others still run.
 */
export async function gatherAll({ fetchImpl, readText, now }) {
  const errors = [];
  const out = {
    webllm: [],
    hf: [],
    latest: {},
    appModels: [],
    declared: {},
    snapshotIds: new Set(),
    rejected: 0,
    sourcesOk: [],
  };
  const attempt = async (source, fn) => {
    try {
      await fn();
      out.sourcesOk.push(source);
    } catch (err) {
      errors.push({
        source: err instanceof SourceError ? err.source : source,
        message: cleanMessage(err?.message),
      });
    }
  };

  await attempt("webllm-config", async () => {
    const { models, rejected } = await fetchWebLlmConfig({ fetchImpl });
    out.webllm = models;
    out.rejected += rejected;
  });
  for (const org of HF_ORGS) {
    await attempt(`huggingface:${org}`, async () => {
      const { models, rejected } = await fetchHfOrg(org, { fetchImpl, now });
      out.hf.push(...models);
      out.rejected += rejected;
    });
  }
  for (const name of RUNTIME_PACKAGES) {
    await attempt(`npm:${name}`, async () => {
      out.latest[name] = await fetchNpmLatest(name, { fetchImpl });
    });
  }
  await attempt("app-models", async () => {
    out.appModels = parseAppModels({
      detector: readText("src/utils/deviceCapabilityDetector.js"),
      florence: readText("src/workers/florence-ocr-worker.js"),
      smolvlm: readText("src/workers/smolvlm-worker.js"),
      legalRag: readText("src/services/legalRag.js"),
    });
  });
  await attempt("app-models:package.json", async () => {
    out.declared = parseDeclaredVersions(readText("package.json"));
  });
  await attempt("snapshot", async () => {
    out.snapshotIds = parseSnapshot(
      readText("scripts/eval/model-watch-snapshot.json"),
    );
  });
  return { ...out, errors };
}
