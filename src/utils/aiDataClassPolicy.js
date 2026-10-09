/**
 * ADR-009 fail-closed provider-routing policy.
 *
 * Every `generateAI` call declares a data class:
 *   - "document": text derived from an uploaded/dropped/pasted document (OCR
 *     output, C-File pages/segments, DD-214/NGB-22, VA letters, Blue Button
 *     reports, or letter/decision text the veteran pastes in). May ONLY be
 *     sent to an on-device engine.
 *   - "context": the allow-listed structured veteran context (already
 *     identifier-free per ADR-008) plus the veteran's own question. May be
 *     sent to any configured backend, on-device or off-device.
 *
 * A call that omits `dataClass` (or supplies anything other than the exact
 * literal "context") is treated as "document" - fail closed, not fail open.
 *
 * On-device = the in-browser engines (Warrant Council/WebLLM, Wllama/WASM)
 * and a local llama.cpp server reachable on a loopback host (localhost,
 * 127.0.0.0/8, ::1). Any other host - including a lookalike like
 * "localhost.evil.com" or "127.0.0.1.nip.io" - is off-device.
 */

export const AI_DATA_CLASS = Object.freeze({
  DOCUMENT: "document",
  CONTEXT: "context",
});

/**
 * Resolve the effective data class for a call. Fail closed: anything other
 * than the exact "context" literal is DOCUMENT.
 */
export const resolveDataClass = (options = {}) =>
  options?.dataClass === AI_DATA_CLASS.CONTEXT
    ? AI_DATA_CLASS.CONTEXT
    : AI_DATA_CLASS.DOCUMENT;

// Matches a plain dotted-decimal IPv4 address only (four 0-255 groups) - no
// partial/short forms, no leading zeros tolerated as octal, no trailing
// labels. "127.0.0.1.nip.io" has five labels and fails this shape entirely,
// so it is correctly rejected below rather than matched as a 127.x prefix.
const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isLoopbackIPv4(hostname) {
  const match = IPV4_PATTERN.exec(hostname);
  if (!match) return false;
  const octets = match.slice(1, 5).map(Number);
  if (octets.some((n) => n > 255)) return false;
  return octets[0] === 127;
}

/**
 * True only for an exact loopback hostname/address - "localhost", the
 * 127.0.0.0/8 IPv4 range, or the IPv6 loopback "::1" (bracketed or not).
 * Parses the value as a real URL/hostname rather than substring-matching,
 * so "localhost.evil.com" and "127.0.0.1.nip.io" are both rejected.
 */
export const isLoopbackHost = (hostOrUrl) => {
  if (!hostOrUrl || typeof hostOrUrl !== "string") return false;

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(hostOrUrl);
  let candidate = hostOrUrl;
  if (!hasScheme) {
    // A bare IPv6 literal ("::1", "fe80::1") has 2+ colons and must be
    // bracketed before it can be parsed as a URL authority at all - a bare
    // "host:port" pair (exactly one colon) must NOT be bracketed, or the
    // port would be swallowed into the (wrong) hostname.
    const colonCount = (candidate.match(/:/g) || []).length;
    const isBareIPv6 = colonCount >= 2 && !candidate.startsWith("[");
    const authority = isBareIPv6 ? `[${candidate}]` : candidate;
    candidate = `http://${authority}`;
  }

  let hostname;
  try {
    hostname = new URL(candidate).hostname.toLowerCase();
  } catch {
    return false;
  }

  // This URL implementation keeps brackets in .hostname for an IPv6
  // literal ("[::1]") rather than stripping them - verified directly rather
  // than assumed, since it varies across WHATWG URL implementations.
  const unbracketed = hostname.replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || unbracketed === "::1") return true;
  return isLoopbackIPv4(hostname);
};

/**
 * Typed, catchable error thrown at the provider boundary when a "document"
 * call has no on-device engine to reach. Callers use this (never a generic
 * Error) to trigger the local-parser fallback + plain-language notice
 * instead of a dead end.
 */
export class DocumentOffDeviceBlockedError extends Error {
  constructor(providerLabel) {
    const detail = providerLabel
      ? `The configured AI (${providerLabel}) is off-device, so it was not sent.`
      : "No on-device AI is configured.";
    super(`This document can only be analyzed by an on-device AI. ${detail}`);
    this.name = "DocumentOffDeviceBlockedError";
    this.code = "DOCUMENT_OFF_DEVICE_BLOCKED";
    this.providerLabel = providerLabel || null;
  }
}

/**
 * Throw DocumentOffDeviceBlockedError when a DOCUMENT-classed call would
 * reach a transport that isn't on-device. A CONTEXT-classed call is never
 * blocked here - it is allowed on any backend (see module doc).
 */
export const assertDocumentCallAllowed = (
  dataClass,
  { isOnDevice, providerLabel },
) => {
  if (dataClass === AI_DATA_CLASS.DOCUMENT && !isOnDevice) {
    throw new DocumentOffDeviceBlockedError(providerLabel);
  }
};

/**
 * The plain-language, veteran-facing notice a document feature shows when it
 * fell back to the local parser because only an off-device AI was
 * configured. Centralized so every feature uses identical wording.
 */
export const buildDocumentOffDeviceNotice = (providerLabel) =>
  `Your documents are only read by the on-device AI, so this file was not sent to ${
    providerLabel || "the configured AI"
  }. Showing what the app's built-in reader found.`;
