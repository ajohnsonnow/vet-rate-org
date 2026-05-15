/**
 * Local-only structured logger — zero-knowledge friendly.
 *
 * Design:
 *   - In-memory ring buffer (default 500 entries) so logs are always available
 *     for export without touching disk.
 *   - Optional IndexedDB persistence behind a user opt-in flag
 *     (`vet_rate_log_persist` in localStorage). Off by default.
 *   - No auto-egress. The only way logs leave the device is `exportLogs()`,
 *     which returns a JSON blob the user explicitly saves.
 *   - Dev-mode console passthrough is on by default so DX is preserved.
 *     Production passthrough is off by default but configurable.
 *
 * Non-goals (intentional, per the zero-knowledge stance):
 *   - No OpenTelemetry, Sentry, Datadog, or any third-party SDK.
 *   - No automatic PII scrubbing inside the logger. Callers are responsible
 *     for what they log; auto-scrub would mask real bugs at dev time.
 *   - No health endpoints, no SLO burn-rate alerting — there is no server.
 *
 * See docs/OBSERVABILITY.md for the full rationale.
 */

import { get, set, keys, del } from "idb-keyval";

const LEVELS = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40 });
const RING_SIZE = 500;
const PERSIST_FLAG = "vet_rate_log_persist";
const PERSIST_PREFIX = "log:";
const PERSIST_META_KEY = "log:_meta";

const ring = [];
let ringHead = 0;
let nextSeq = 1;

/**
 * Default minimum level. In tests / production, `info` and above.
 * Callers can override via `setLevel`.
 */
let minLevel = LEVELS.info;

/**
 * Whether to also forward to `console`. True in Vite dev mode by default.
 */
let consolePassthrough = (() => {
  try {
    return Boolean(import.meta?.env?.DEV);
  } catch {
    return false;
  }
})();

function readPersistFlag() {
  try {
    return globalThis.localStorage?.getItem(PERSIST_FLAG) === "true";
  } catch {
    return false;
  }
}

function buildEntry(level, msg, fields) {
  return {
    seq: nextSeq++,
    ts: Date.now(),
    level,
    msg: String(msg ?? ""),
    ...(fields && typeof fields === "object" ? { fields } : {}),
  };
}

function pushRing(entry) {
  if (ring.length < RING_SIZE) {
    ring.push(entry);
  } else {
    ring[ringHead] = entry;
    ringHead = (ringHead + 1) % RING_SIZE;
  }
}

async function persistEntry(entry) {
  if (!readPersistFlag()) return;
  try {
    await set(`${PERSIST_PREFIX}${entry.seq}`, entry);
    await set(PERSIST_META_KEY, { lastSeq: entry.seq });
  } catch {
    // Persistence is best-effort; ring buffer is the source of truth.
  }
}

function passthrough(level, entry) {
  if (!consolePassthrough) return;
  const fn =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : level === "debug"
          ? console.debug
          : console.info;
  if (entry.fields) fn(`[${level}] ${entry.msg}`, entry.fields);
  else fn(`[${level}] ${entry.msg}`);
}

function emit(level, msg, fields) {
  if (LEVELS[level] < minLevel) return;
  const entry = buildEntry(level, msg, fields);
  pushRing(entry);
  passthrough(level, entry);
  // Fire-and-forget persistence (no await — keep call sites synchronous).
  void persistEntry(entry);
}

export const logger = Object.freeze({
  debug: (msg, fields) => emit("debug", msg, fields),
  info: (msg, fields) => emit("info", msg, fields),
  warn: (msg, fields) => emit("warn", msg, fields),
  error: (msg, fields) => emit("error", msg, fields),
});

/**
 * Set the minimum level. Accepts a level name or numeric value.
 * @param {"debug"|"info"|"warn"|"error"|number} level
 */
export function setLevel(level) {
  if (typeof level === "number") {
    minLevel = level;
    return;
  }
  if (LEVELS[level] != null) minLevel = LEVELS[level];
}

export function getLevel() {
  return Object.entries(LEVELS).find(([, v]) => v === minLevel)?.[0] ?? "info";
}

/**
 * Toggle console passthrough. Default: on in dev, off in prod.
 * @param {boolean} on
 */
export function setConsolePassthrough(on) {
  consolePassthrough = Boolean(on);
}

/**
 * Snapshot of the ring buffer in chronological order.
 * @returns {Array<{seq:number,ts:number,level:string,msg:string,fields?:object}>}
 */
export function getLogs() {
  if (ring.length < RING_SIZE) return [...ring];
  return [...ring.slice(ringHead), ...ring.slice(0, ringHead)];
}

/**
 * Number of entries currently held in the ring buffer.
 */
export function getLogCount() {
  return ring.length;
}

/**
 * Drop everything in the ring buffer. Persistent storage is not touched
 * unless you also call `clearPersistedLogs()`.
 */
export function clearLogs() {
  ring.length = 0;
  ringHead = 0;
}

/**
 * Export logs as a JSON-serializable object. This is the ONLY way logs
 * leave the device. The caller is responsible for what happens next
 * (download, copy to clipboard, …).
 */
export function exportLogs() {
  return {
    exportedAt: new Date().toISOString(),
    count: ring.length,
    level: getLevel(),
    entries: getLogs(),
  };
}

/**
 * Read persisted entries (only meaningful when the opt-in flag is set).
 * Best-effort; returns [] if IDB is unavailable.
 */
export async function getPersistedLogs() {
  if (!readPersistFlag()) return [];
  try {
    const allKeys = await keys();
    const logKeys = allKeys
      .filter((k) => typeof k === "string" && k.startsWith(PERSIST_PREFIX))
      .filter((k) => k !== PERSIST_META_KEY);
    const entries = await Promise.all(logKeys.map((k) => get(k)));
    return entries.filter(Boolean).sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  } catch {
    return [];
  }
}

/**
 * Wipe persisted entries from IndexedDB. The opt-in flag itself is not
 * cleared — callers can flip it separately via `setPersistEnabled(false)`.
 */
export async function clearPersistedLogs() {
  try {
    const allKeys = await keys();
    const logKeys = allKeys.filter(
      (k) => typeof k === "string" && k.startsWith(PERSIST_PREFIX),
    );
    await Promise.all(logKeys.map((k) => del(k)));
  } catch {
    // IDB may be unavailable; nothing to do.
  }
}

/**
 * Flip the user opt-in flag for persistence. When false, future log calls
 * skip the IDB write.
 */
export function setPersistEnabled(enabled) {
  try {
    if (enabled) {
      globalThis.localStorage?.setItem(PERSIST_FLAG, "true");
    } else {
      globalThis.localStorage?.removeItem(PERSIST_FLAG);
    }
  } catch {
    // localStorage may be unavailable; flag stays at default (off).
  }
}

export function isPersistEnabled() {
  return readPersistFlag();
}

/**
 * Test-only reset. Restores the ring buffer, sequence counter, and level
 * to module defaults. Not exported as part of the public surface in docs.
 */
export function __resetForTests() {
  ring.length = 0;
  ringHead = 0;
  nextSeq = 1;
  minLevel = LEVELS.info;
}
