/**
 * Pure classification for the model watch. Nothing here touches the network
 * or the filesystem, and nothing fetched is trusted: ids, licences and
 * numbers are validated here before any of them can reach a report.
 */

/*
 * VRAM tier ceilings, in MB. Anchored on the models the app loads today
 * (src/utils/deviceCapabilityDetector.js, VRAM from the WebLLM prebuilt list):
 *   laptop / tablet  Qwen2.5-1.5B q4f16 1629.75, q4f32 1888.97  -> 2 GiB ceiling
 *   desktop-mid/high Qwen2.5-3B q4f16 2504.76, q4f32 2893.64,
 *                    Llama-3.2-3B q4f32 2951.51                 -> 4 GiB ceiling
 *                    (largest current model rounded up to 3 GiB, plus 1 GiB
 *                    of headroom so a 4B-class q4f16 build is visible)
 *   phone            the app runs no text model on phones today; 1 GiB is a
 *                    judgment ceiling below the smallest current model, not a
 *                    derived figure.
 * A model above the desktop ceiling is reported as "too-large", not a tier.
 */
export const PHONE_MAX_VRAM_MB = 1024;
export const LAPTOP_MAX_VRAM_MB = 2048;
export const DESKTOP_MAX_VRAM_MB = 4096;

export const TIER_THRESHOLDS = [
  { tier: "phone", maxVramMb: PHONE_MAX_VRAM_MB },
  { tier: "laptop", maxVramMb: LAPTOP_MAX_VRAM_MB },
  { tier: "desktop", maxVramMb: DESKTOP_MAX_VRAM_MB },
];

/*
 * Models with no VRAM figure get an estimate from the parameter count in
 * their id: a line through the two q4f16 reference models the app runs.
 */
export const VRAM_REFERENCE_POINTS = [
  { paramsB: 1.5, vramMb: 1629.75 },
  { paramsB: 3, vramMb: 2504.76 },
];
const VRAM_SLOPE_MB_PER_B =
  (VRAM_REFERENCE_POINTS[1].vramMb - VRAM_REFERENCE_POINTS[0].vramMb) /
  (VRAM_REFERENCE_POINTS[1].paramsB - VRAM_REFERENCE_POINTS[0].paramsB);
const VRAM_BASE_MB =
  VRAM_REFERENCE_POINTS[0].vramMb -
  VRAM_SLOPE_MB_PER_B * VRAM_REFERENCE_POINTS[0].paramsB;

export const KINDS = ["text", "vision", "embedding"];
export const KIND_LABELS = {
  text: "text",
  vision: "vision / document OCR",
  embedding: "embedding",
};

const CLEAR_LICENCES = new Set(["apache-2.0", "mit"]);
const SAFE_ID = /^[A-Za-z0-9._-]{1,100}(\/[A-Za-z0-9._-]{1,100})?$/;
const SAFE_TOKEN = /^[A-Za-z0-9._-]{1,40}$/;

const PIPELINE_KINDS = {
  "text-generation": "text",
  "image-text-to-text": "vision",
  "image-to-text": "vision",
  "visual-question-answering": "vision",
  "document-question-answering": "vision",
  "feature-extraction": "embedding",
  "sentence-similarity": "embedding",
};

export function isSafeModelId(value) {
  return (
    typeof value === "string" &&
    SAFE_ID.test(value) &&
    value.split("/").every((part) => !/^\.+$/.test(part))
  );
}

export function safeNumber(value, { min = 0, max = 1e12 } = {}) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
    ? value
    : null;
}

export function safeToken(value) {
  return typeof value === "string" && SAFE_TOKEN.test(value) ? value : null;
}

export function safeIsoDate(value) {
  if (typeof value !== "string" || value.length > 40) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** mlc-ai repos are the same models the WebLLM list names without the org. */
export function canonicalId(id) {
  return id.startsWith("mlc-ai/") ? id.slice("mlc-ai/".length) : id;
}

export function licenceFromTags(tags) {
  if (!Array.isArray(tags)) return null;
  for (const tag of tags) {
    if (typeof tag !== "string" || !tag.startsWith("license:")) continue;
    const value = safeToken(tag.slice("license:".length));
    if (value) return value.toLowerCase();
  }
  return null;
}

export function licenceStatus(licence) {
  return licence && CLEAR_LICENCES.has(licence) ? "ok" : "review";
}

export function kindFromPipelineTag(tag) {
  return PIPELINE_KINDS[tag] ?? null;
}

export function tierForVram(vramMb) {
  if (vramMb === null || vramMb === undefined) return null;
  for (const { tier, maxVramMb } of TIER_THRESHOLDS) {
    if (vramMb <= maxVramMb) return tier;
  }
  return "too-large";
}

export function paramsBillionFromId(id) {
  const match = /[-_](\d+(?:[._]\d+)?)([BbMm])(?=[-_.]|$)/.exec(
    id.split("/").pop(),
  );
  if (!match) return null;
  const n = Number(match[1].replace("_", "."));
  return match[2].toLowerCase() === "m" ? n / 1000 : n;
}

export function estimateVramMb(paramsB) {
  return Math.round((VRAM_BASE_MB + VRAM_SLOPE_MB_PER_B * paramsB) * 100) / 100;
}

/**
 * Same family and size at a different quantization or packaging maps to one
 * key: org, -MLC/-ONNX, q4f16_1-style tags, bf16/fp16/int8 and batch suffixes
 * are dropped.
 */
const FAMILY_STRIP_PATTERNS = [
  /[-_.](mlc|onnx|gguf|awq|gptq|quantized)(?=[-_.]|$)/g,
  /[-_.]q\d+b?f\d+(_\d+)?(?=[-_.]|$)/g,
  /[-_.]q\d+(_[a-z0-9]+)*(?=[-_.]|$)/g,
  /[-_.](u?int\d+|fp\d+|bf16)(?=[-_.]|$)/g,
  /[-_.](b\d+|\d+k)$/,
];

export function familyKey(id) {
  let key = id.split("/").pop().toLowerCase();
  for (const pattern of FAMILY_STRIP_PATTERNS) key = key.replace(pattern, "");
  return key;
}

function webllmKind(type) {
  if (type === "VLM") return "vision";
  if (type === "embedding") return "embedding";
  return "text";
}

/**
 * Merges the WebLLM prebuilt list and the Hugging Face listings into one
 * entry per model. WebLLM ids and mlc-ai repo names are the same model.
 */
export function buildEntries(webllmModels, hfModels) {
  const entries = new Map();
  for (const m of webllmModels) {
    entries.set(m.id, {
      id: m.id,
      source: "webllm-config",
      runtime: "webllm",
      kind: webllmKind(m.type),
      kindBasis: "webllm model_type",
      vramMb: m.vramMb,
      vramEstimated: false,
      licence: null,
      pipelineTag: null,
      createdAt: null,
      downloads: null,
    });
  }
  for (const m of hfModels) {
    const id = canonicalId(m.id);
    const isMlc = id !== m.id;
    const existing = entries.get(id);
    if (existing) {
      existing.licence = m.licence;
      existing.pipelineTag = m.pipelineTag;
      existing.createdAt = m.createdAt;
      existing.downloads = m.downloads;
      continue;
    }
    let kind = kindFromPipelineTag(m.pipelineTag);
    let kindBasis = "pipeline_tag";
    if (!kind && isMlc && /-MLC$/.test(id)) {
      kind = /vision|[-_]vl[-_]|embed/i.test(id) ? "vision" : "text";
      kindBasis = "id";
    }
    entries.set(id, {
      id,
      source: `huggingface:${m.id.split("/")[0]}`,
      runtime: isMlc ? "webllm" : "transformers.js",
      kind,
      kindBasis,
      vramMb: null,
      vramEstimated: false,
      licence: m.licence,
      pipelineTag: m.pipelineTag,
      createdAt: m.createdAt,
      downloads: m.downloads,
    });
  }
  return [...entries.values()];
}

function fitFor(entry) {
  if (entry.kind === "text") {
    if (entry.runtime !== "webllm") return { ignore: "runtime-not-used" };
    let { vramMb, vramEstimated } = entry;
    if (vramMb === null) {
      const paramsB = paramsBillionFromId(entry.id);
      if (paramsB === null) return { unplaced: true };
      vramMb = estimateVramMb(paramsB);
      vramEstimated = true;
    }
    const tier = tierForVram(vramMb);
    if (tier === "too-large") return { ignore: "too-large" };
    return { tier, vramMb, vramEstimated };
  }
  if (entry.kind === "vision" || entry.kind === "embedding") {
    if (entry.runtime !== "transformers.js") {
      return { ignore: "runtime-not-used" };
    }
    return { tier: null, vramMb: null, vramEstimated: false };
  }
  return { ignore: "kind-not-used" };
}

export function goldenSetCommand(entry) {
  return entry.kind === "text" && entry.runtime === "webllm"
    ? `npm run eval:golden -- --model ${entry.id}`
    : null;
}

/**
 * Candidate = unseen since the snapshot, a kind and runtime the app uses,
 * within the desktop VRAM ceiling for text, and not a variant of a family the
 * app or the snapshot already lists. Variants of one unseen family collapse
 * into one row.
 */
export function findCandidates({ entries, snapshotIds, appModels }) {
  const seen = new Set([...snapshotIds].map(canonicalId));
  const seenFamilies = new Set([...seen].map(familyKey));
  for (const m of appModels) seenFamilies.add(familyKey(m.id));
  const appIds = new Set(appModels.map((m) => canonicalId(m.id)));

  const ignored = [];
  const unplaced = [];
  const groups = new Map();
  for (const entry of entries) {
    if (seen.has(entry.id) || appIds.has(entry.id)) continue;
    const fit = fitFor(entry);
    if (fit.ignore) {
      ignored.push({ id: entry.id, reason: fit.ignore });
      continue;
    }
    if (fit.unplaced) {
      unplaced.push(entry.id);
      continue;
    }
    if (seenFamilies.has(familyKey(entry.id))) {
      ignored.push({ id: entry.id, reason: "variant-of-listed" });
      continue;
    }
    const key = `${entry.kind}:${familyKey(entry.id)}`;
    const list = groups.get(key) ?? [];
    list.push({ entry, fit });
    groups.set(key, list);
  }

  const candidates = [...groups.values()].map((group) => {
    group.sort(
      (a, b) =>
        (a.fit.vramMb ?? Infinity) - (b.fit.vramMb ?? Infinity) ||
        a.entry.id.localeCompare(b.entry.id),
    );
    const { entry, fit } = group[0];
    return {
      id: entry.id,
      kind: entry.kind,
      kindBasis: entry.kindBasis,
      runtime: entry.runtime,
      tier: fit.tier,
      vramMb: fit.vramMb,
      vramEstimated: fit.vramEstimated,
      licence: entry.licence ?? "unknown",
      licenceStatus: licenceStatus(entry.licence),
      pipelineTag: entry.pipelineTag,
      source: entry.source,
      createdAt: entry.createdAt,
      downloads: entry.downloads,
      inWebllmPrebuiltList: entry.source === "webllm-config",
      variants: group.slice(1).map((g) => g.entry.id),
      goldenSetCommand: goldenSetCommand(entry),
    };
  });
  candidates.sort(
    (a, b) =>
      KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) ||
      (a.vramMb ?? 0) - (b.vramMb ?? 0) ||
      a.id.localeCompare(b.id),
  );
  ignored.sort((a, b) => a.id.localeCompare(b.id));
  unplaced.sort();
  return { candidates, ignored, unplaced };
}

function parseVersion(text) {
  const parts = text.match(/\d+/g);
  return parts && parts.length >= 3 ? parts.slice(0, 3).map(Number) : null;
}

export function compareVersions(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

/** declared is the package.json range, latest the registry's latest version. */
export function compareRuntime(name, declared, latest) {
  const base = parseVersion(declared);
  const next = /^\d+\.\d+\.\d+$/.test(latest) ? parseVersion(latest) : null;
  const newer = Boolean(base && next && compareVersions(base, next) < 0);
  const sameLine = (i) => Boolean(base && next && base[i] === next[i]);
  const inRange =
    newer && declared.startsWith("^")
      ? sameLine(0) && (base[0] > 0 || sameLine(1))
      : false;
  return { name, declared, latest, newer, inRange };
}
