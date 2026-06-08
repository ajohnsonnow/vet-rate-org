/**
 * AI audit log — append-only, hash-chained, tamper-evident
 *
 * Records every LLM call so the veteran can replay the conversation, audit
 * what the model saw, and prove (or detect) tampering with their own data.
 *
 * Design:
 *   - Append-only: entries are written under a monotonically increasing seq
 *     key. The API never exposes update/delete on a single entry. The whole
 *     log can be cleared explicitly (an audit-event in its own right).
 *   - Hash-chained: each entry stores `prevHash` (the hash of the previous
 *     entry) and `hash` (sha256(prevHash || JSON.stringify(entry without hash))).
 *     A single byte changed in any entry breaks the chain at that point.
 *   - PII-aware: callers should pass digests (sha256 of input/output) rather
 *     than raw text. A short `meta` field carries non-sensitive context.
 *   - Self-contained: zero new dependencies — uses idb-keyval (already
 *     installed) and the platform Web Crypto API.
 *
 * Threat model:
 *   - Detects: silent tampering with prior entries, replay of stale entries.
 *   - Does NOT detect: deletion of the entire log (use `lastSeq` snapshots).
 *   - Does NOT prevent: a malicious browser extension with full IDB access
 *     can rewrite the chain end-to-end — there is no signing key.
 */

import { get, set, keys, del } from "idb-keyval";

const SEQ_PREFIX = "ailog:";
const META_KEY = "ailog:_meta";
const GENESIS_HASH = "0".repeat(64);

/**
 * SHA-256 → lowercase hex. Uses Web Crypto, falls back to node:crypto under
 * vitest jsdom where subtle.digest may be absent.
 * @param {string} text
 * @returns {Promise<string>}
 */
async function sha256Hex(text) {
  const data = new TextEncoder().encode(String(text ?? ""));
  if (
    typeof globalThis.crypto !== "undefined" &&
    globalThis.crypto.subtle &&
    typeof globalThis.crypto.subtle.digest === "function"
  ) {
    const hashBuf = await globalThis.crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(hashBuf)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Last-resort fallback for older test environments.
  const { createHash } = await import("node:crypto");
  return createHash("sha256")
    .update(text ?? "")
    .digest("hex");
}

async function loadMeta() {
  const meta = await get(META_KEY);
  return meta || { lastSeq: 0, lastHash: GENESIS_HASH, totalEntries: 0 };
}

async function saveMeta(meta) {
  await set(META_KEY, meta);
}

/**
 * Append an entry to the audit log. The entry is hash-chained to the most
 * recent prior entry.
 *
 * @param {Object} entry
 * @param {string} entry.tag - short caller identifier (e.g. 'dual-llm/extract')
 * @param {string} entry.model - model identifier (e.g. 'gemini-2.5-flash')
 * @param {string} [entry.promptDigest] - sha256 of the prompt
 * @param {string} [entry.outputDigest] - sha256 of the response
 * @param {number} [entry.promptLength]
 * @param {number} [entry.outputLength]
 * @param {number} [entry.durationMs]
 * @param {Object} [entry.meta] - non-sensitive context (NEVER raw PII)
 * @returns {Promise<{seq: number, hash: string}>}
 */
export async function logModelCall(entry = {}) {
  const meta = await loadMeta();
  const seq = meta.lastSeq + 1;
  const timestamp = new Date().toISOString();

  const body = {
    seq,
    timestamp,
    tag: String(entry.tag || "unknown"),
    model: String(entry.model || "unknown"),
    promptDigest: entry.promptDigest ?? null,
    outputDigest: entry.outputDigest ?? null,
    promptLength: entry.promptLength ?? null,
    outputLength: entry.outputLength ?? null,
    durationMs: entry.durationMs ?? null,
    meta: entry.meta ?? null,
    prevHash: meta.lastHash,
  };

  const hash = await sha256Hex(body.prevHash + JSON.stringify(body));
  const stored = { ...body, hash };

  await set(SEQ_PREFIX + seq, stored);
  await saveMeta({
    lastSeq: seq,
    lastHash: hash,
    totalEntries: meta.totalEntries + 1,
  });

  return { seq, hash };
}

/**
 * Convenience: compute digests for raw prompt/response and call logModelCall.
 * Use this from the LLM call site when you have the raw strings.
 *
 * @param {Object} args
 * @param {string} args.tag
 * @param {string} args.model
 * @param {string} args.prompt
 * @param {string} args.output
 * @param {number} [args.durationMs]
 * @param {Object} [args.meta]
 * @returns {Promise<{seq: number, hash: string}>}
 */
export async function logModelCallWithDigests({
  tag,
  model,
  prompt,
  output,
  durationMs,
  meta,
}) {
  const [promptDigest, outputDigest] = await Promise.all([
    sha256Hex(prompt ?? ""),
    sha256Hex(output ?? ""),
  ]);
  return logModelCall({
    tag,
    model,
    promptDigest,
    outputDigest,
    promptLength: (prompt ?? "").length,
    outputLength: (output ?? "").length,
    durationMs,
    meta,
  });
}

/**
 * Read the N most recent entries (most-recent first).
 * @param {number} [n=50]
 * @returns {Promise<Array>}
 */
export async function getRecentLogs(n = 50) {
  const meta = await loadMeta();
  if (meta.totalEntries === 0) return [];
  const out = [];
  for (let seq = meta.lastSeq; seq > 0 && out.length < n; seq--) {
    const entry = await get(SEQ_PREFIX + seq);
    if (entry) out.push(entry);
  }
  return out;
}

/**
 * Walk the full chain forward and verify every entry's hash. Returns
 * { ok: true } if the chain is intact, otherwise the first bad seq.
 * @returns {Promise<{ok: boolean, badSeq?: number, totalChecked: number}>}
 */
export async function verifyLogChain() {
  const meta = await loadMeta();
  let prevHash = GENESIS_HASH;
  let totalChecked = 0;
  for (let seq = 1; seq <= meta.lastSeq; seq++) {
    const entry = await get(SEQ_PREFIX + seq);
    if (!entry) {
      return { ok: false, badSeq: seq, totalChecked, reason: "missing" };
    }
    if (entry.prevHash !== prevHash) {
      return { ok: false, badSeq: seq, totalChecked, reason: "prevHash" };
    }
    const { hash, ...body } = entry;
    const recomputed = await sha256Hex(prevHash + JSON.stringify(body));
    if (recomputed !== hash) {
      return { ok: false, badSeq: seq, totalChecked, reason: "hash" };
    }
    prevHash = hash;
    totalChecked++;
  }
  return { ok: true, totalChecked };
}

/**
 * Export the full log as a JSON-serializable object — for veteran-facing
 * "download my audit log" surface.
 * @returns {Promise<{meta: Object, entries: Array}>}
 */
export async function exportLogs() {
  const meta = await loadMeta();
  const entries = [];
  for (let seq = 1; seq <= meta.lastSeq; seq++) {
    const entry = await get(SEQ_PREFIX + seq);
    if (entry) entries.push(entry);
  }
  return { meta, entries };
}

/**
 * Clear the entire log. This is itself a logged audit event — the first
 * entry after `clearLogs` is a fresh genesis seq=1 with tag='audit:cleared'.
 * @returns {Promise<{cleared: number}>}
 */
export async function clearLogs() {
  const allKeys = await keys();
  let cleared = 0;
  for (const k of allKeys) {
    if (typeof k === "string" && k.startsWith(SEQ_PREFIX)) {
      await del(k);
      cleared++;
    }
  }
  await saveMeta({ lastSeq: 0, lastHash: GENESIS_HASH, totalEntries: 0 });
  await logModelCall({
    tag: "audit:cleared",
    model: "n/a",
    meta: { clearedCount: cleared - 1 }, // -1 because META was counted too
  });
  return { cleared };
}

/**
 * Total count of audit entries (without loading them all).
 * @returns {Promise<number>}
 */
export async function getLogCount() {
  const meta = await loadMeta();
  return meta.totalEntries;
}

export default {
  logModelCall,
  logModelCallWithDigests,
  getRecentLogs,
  verifyLogChain,
  exportLogs,
  clearLogs,
  getLogCount,
};
