/**
 * Whether this browser lets the page use site storage at all. With cookies or
 * site data blocked (and in some private windows) merely touching
 * `window.localStorage` throws a SecurityError, which used to fail the very
 * first render and leave a blank page. Read-only on purpose: probing must not
 * write anything where storage works.
 */
export function isStorageBlocked() {
  try {
    const local = window.localStorage;
    const session = window.sessionStorage;
    if (!local || !session) return true;
    local.getItem("vetrate_storage_probe");
    session.getItem("vetrate_storage_probe");
    return false;
  } catch {
    return true;
  }
}
