import { ACTIVE_SILO_KEY, VSO_REGISTRY_KEY } from "./siloScope";
import { formatSiloLabel, validateLabelFields } from "./vsoLabel";

export const REGISTRY_VERSION = 1;
export const ENC_STATES = Object.freeze(["none", "migrating", "complete"]);

const ID_PATTERN = /^[0-9a-f]{12}$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ENTRY_FIELDS = Object.freeze([
  "id",
  "initials",
  "caseRef",
  "createdAt",
  "lastOpenedAt",
  "authAckAt",
  "reviewBy",
  "legacy",
  "deleting",
  "enc",
]);
const UPDATABLE_FIELDS = Object.freeze([
  "initials",
  "caseRef",
  "reviewBy",
  "lastOpenedAt",
  "deleting",
  "enc",
]);

export class RegistryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RegistryError";
    this.code = code;
  }
}

function isTimestamp(value) {
  return (
    typeof value === "string" &&
    ISO_TIMESTAMP_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function isCalendarDate(value) {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
  );
}

function entryProblem(entry) {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    return "entry is not an object";
  }
  const keys = Object.keys(entry);
  if (
    keys.length !== ENTRY_FIELDS.length ||
    !ENTRY_FIELDS.every((field) => keys.includes(field))
  ) {
    return "entry has missing or unknown fields";
  }
  if (!ID_PATTERN.test(entry.id)) return "entry id is malformed";
  if (!validateLabelFields(entry).ok) return "entry label is invalid";
  if (!isTimestamp(entry.createdAt)) return "createdAt is not a timestamp";
  if (!isTimestamp(entry.lastOpenedAt)) {
    return "lastOpenedAt is not a timestamp";
  }
  if (!isTimestamp(entry.authAckAt)) return "authAckAt is not a timestamp";
  if (entry.reviewBy !== null && !isCalendarDate(entry.reviewBy)) {
    return "reviewBy is not a date";
  }
  if (typeof entry.legacy !== "boolean") return "legacy is not a boolean";
  if (typeof entry.deleting !== "boolean") return "deleting is not a boolean";
  if (!ENC_STATES.includes(entry.enc)) return "enc is not a known state";
  return null;
}

function registryProblem(registry) {
  if (
    registry === null ||
    typeof registry !== "object" ||
    Array.isArray(registry)
  ) {
    return "registry is not an object";
  }
  const keys = Object.keys(registry);
  if (
    keys.length !== 2 ||
    !keys.includes("version") ||
    !keys.includes("silos")
  ) {
    return "registry has missing or unknown fields";
  }
  if (registry.version !== REGISTRY_VERSION) return "unsupported version";
  if (!Array.isArray(registry.silos)) return "silos is not a list";

  const seen = new Set();
  let legacyCount = 0;
  for (const entry of registry.silos) {
    const problem = entryProblem(entry);
    if (problem) return problem;
    if (seen.has(entry.id)) return "duplicate id";
    seen.add(entry.id);
    if (entry.legacy) legacyCount += 1;
  }
  if (legacyCount > 1) return "more than one legacy veteran";
  return null;
}

/**
 * Returns `{state:"absent"}`, `{state:"ok", registry}` or
 * `{state:"corrupt", reason}`. Corrupt is its own state, never "absent":
 * treating an unreadable registry as no registry would boot the unsuffixed
 * (legacy) databases while another veteran's data sat parked.
 */
export function readRegistry() {
  const raw = localStorage.getItem(VSO_REGISTRY_KEY);
  if (raw === null) return { state: "absent" };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { state: "corrupt", reason: "registry is not valid JSON" };
  }
  const problem = registryProblem(parsed);
  if (problem) return { state: "corrupt", reason: problem };
  return { state: "ok", registry: parsed };
}

export function isVsoModeActive() {
  return localStorage.getItem(VSO_REGISTRY_KEY) !== null;
}

export function getActiveSiloId() {
  return localStorage.getItem(ACTIVE_SILO_KEY);
}

export function writeRegistry(registry) {
  const problem = registryProblem(registry);
  if (problem) {
    throw new RegistryError(
      "INVALID",
      `Refusing to write registry: ${problem}.`,
    );
  }
  localStorage.setItem(VSO_REGISTRY_KEY, JSON.stringify(registry));
}

function loadForUpdate() {
  const current = readRegistry();
  if (current.state === "corrupt") {
    throw new RegistryError(
      "CORRUPT",
      `The veteran registry is unreadable (${current.reason}); it was left untouched.`,
    );
  }
  if (current.state === "absent") {
    return { version: REGISTRY_VERSION, silos: [] };
  }
  return current.registry;
}

export function generateSiloId(taken = []) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const id = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    if (!taken.includes(id)) return id;
  }
  throw new RegistryError("INVALID", "Could not generate an unused id.");
}

export function siloLabel(entry) {
  return formatSiloLabel(entry);
}

function assertValidLabel(fields) {
  const result = validateLabelFields(fields);
  if (!result.ok) {
    const reasons = result.errors.map((e) => `${e.field}:${e.code}`);
    throw new RegistryError(
      "INVALID",
      `Label rejected (${reasons.join(", ")}).`,
    );
  }
  return result.value;
}

function assertReviewBy(reviewBy) {
  if (reviewBy !== null && !isCalendarDate(reviewBy)) {
    throw new RegistryError("INVALID", "reviewBy must be YYYY-MM-DD or null.");
  }
}

export function addSilo(
  {
    initials,
    caseRef,
    reviewBy = null,
    authorizationAcknowledged,
    legacy = false,
  },
  now = new Date(),
) {
  if (authorizationAcknowledged !== true) {
    throw new RegistryError(
      "AUTH_REQUIRED",
      "The authorization acknowledgement is required to add a veteran.",
    );
  }
  const label = assertValidLabel({ initials, caseRef });
  assertReviewBy(reviewBy);

  const registry = loadForUpdate();
  if (legacy && registry.silos.some((entry) => entry.legacy)) {
    throw new RegistryError(
      "DUPLICATE_LEGACY",
      "A legacy veteran already exists.",
    );
  }

  const timestamp = now.toISOString();
  const entry = {
    id: generateSiloId(registry.silos.map((existing) => existing.id)),
    initials: label.initials,
    caseRef: label.caseRef,
    createdAt: timestamp,
    lastOpenedAt: timestamp,
    authAckAt: timestamp,
    reviewBy,
    legacy,
    deleting: false,
    enc: "none",
  };
  writeRegistry({ ...registry, silos: [...registry.silos, entry] });
  return entry;
}

export function updateSilo(id, patch) {
  const disallowed = Object.keys(patch).filter(
    (field) => !UPDATABLE_FIELDS.includes(field),
  );
  if (disallowed.length > 0) {
    throw new RegistryError(
      "INVALID",
      `Fields cannot be updated: ${disallowed.join(", ")}.`,
    );
  }

  const registry = loadForUpdate();
  const index = registry.silos.findIndex((entry) => entry.id === id);
  if (index === -1) throw new RegistryError("NOT_FOUND", "No such veteran.");

  const updated = { ...registry.silos[index], ...patch };
  if ("initials" in patch || "caseRef" in patch) {
    const label = assertValidLabel(updated);
    updated.initials = label.initials;
    updated.caseRef = label.caseRef;
  }
  if ("reviewBy" in patch) assertReviewBy(updated.reviewBy);

  const silos = registry.silos.map((entry, i) =>
    i === index ? updated : entry,
  );
  writeRegistry({ ...registry, silos });
  return updated;
}

export function removeSilo(id) {
  const registry = loadForUpdate();
  if (!registry.silos.some((entry) => entry.id === id)) {
    throw new RegistryError("NOT_FOUND", "No such veteran.");
  }
  if (getActiveSiloId() === id) {
    throw new RegistryError(
      "ACTIVE_SILO",
      "The active veteran cannot be removed. Switch to another veteran first.",
    );
  }
  writeRegistry({
    ...registry,
    silos: registry.silos.filter((entry) => entry.id !== id),
  });
}
