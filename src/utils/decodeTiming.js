// The Decision Decoder's on-device generation has no token stream to watch
// (the Warrant Council path returns one whole result), so its pace is learned
// from how long the last decode on this page took. A fixed 90 s cut-off failed
// a PDF on an engine that needs longer than that, while the same decode ends in
// seconds on a faster one.
export const BASE_DECODE_TIMEOUT_MS = 90_000;
export const FIRST_DECODE_TIMEOUT_MS = 180_000;
export const MAX_DECODE_TIMEOUT_MS = 300_000;
export const SLOW_NOTICE_AFTER_MS = 30_000;
const SLOWNESS_FACTOR = 3;

let lastDecodeMs = null;

export function getDecodeTimeoutMs() {
  if (lastDecodeMs === null) return FIRST_DECODE_TIMEOUT_MS;
  return Math.min(
    MAX_DECODE_TIMEOUT_MS,
    Math.max(BASE_DECODE_TIMEOUT_MS, lastDecodeMs * SLOWNESS_FACTOR),
  );
}

export function recordDecodeDuration(ms) {
  if (Number.isFinite(ms) && ms > 0) lastDecodeMs = ms;
}

export function resetDecodeSpeed() {
  lastDecodeMs = null;
}
