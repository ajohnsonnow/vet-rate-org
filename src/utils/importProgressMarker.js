/**
 * Vet-Rate.org - "Import in progress" marker
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * A tab the browser kills mid-import cannot say so. While an import runs, a
 * small marker (neutral document labels and counts only - never a file name)
 * is kept in local storage, one key per import id, cleared when the import
 * finishes or is cancelled. If one is still there and its owner has gone, the
 * import was cut short and the veteran is told so.
 *
 * Local storage (not session storage) so the marker survives a browser that
 * was closed or killed. The owning tab refreshes a heartbeat while its import
 * runs: a marker with a recent heartbeat belongs to a live import in some tab
 * and is never shown as interrupted, and a tab only ever clears its own
 * markers (or ones whose owner has gone). Quick Exit, Atomic Wipe and every
 * Clear All Data remove every marker, and a tab never re-creates a marker
 * that was removed under it, so a wipe in any tab holds in all of them.
 */

// The key the marker lived under when it was kept in session storage; still
// removed everywhere so an old marker cannot outlive an upgrade.
export const IMPORT_MARKER_KEY = "vetrate_import_in_progress";
export const IMPORT_MARKER_KEY_PREFIX = `${IMPORT_MARKER_KEY}:`;

const MAX_DOCUMENTS = 1000;
export const HEARTBEAT_INTERVAL_MS = 5000;
// Background tabs may be throttled to one timer tick a minute, so a marker is
// only treated as abandoned well after that.
export const STALE_AFTER_MS = 90000;

const OWNER_ID = crypto.randomUUID();
let currentImportId = null;
let heartbeatTimer = null;

const markerKey = (id) => `${IMPORT_MARKER_KEY_PREFIX}${id}`;

function markerKeys() {
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(IMPORT_MARKER_KEY_PREFIX)) keys.push(key);
    }
  } catch {
    return [];
  }
  return keys;
}

function write(marker) {
  try {
    localStorage.setItem(markerKey(marker.id), JSON.stringify(marker));
  } catch {
    console.warn("The import progress marker could not be written.");
  }
}

function parseMarker(raw) {
  try {
    const parsed = JSON.parse(raw);
    const { total, saved, id, owner, heartbeat } = parsed ?? {};
    const valid =
      Number.isInteger(total) &&
      Number.isInteger(saved) &&
      total > 0 &&
      total <= MAX_DOCUMENTS &&
      saved >= 0 &&
      saved <= total &&
      typeof id === "string" &&
      typeof owner === "string" &&
      Number.isFinite(heartbeat);
    return valid ? parsed : null;
  } catch {
    return null;
  }
}

function readMarker(id) {
  try {
    return parseMarker(localStorage.getItem(markerKey(id)));
  } catch {
    return null;
  }
}

function removeKey(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    console.warn("The import progress marker could not be cleared.");
  }
}

const isStale = (marker) =>
  marker.owner !== OWNER_ID && Date.now() - marker.heartbeat > STALE_AFTER_MS;

function stopHeartbeat() {
  if (heartbeatTimer === null) return;
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

function beat() {
  let ownMarkers = 0;
  for (const key of markerKeys()) {
    const marker = parseMarker(localStorage.getItem(key));
    if (marker?.owner !== OWNER_ID) continue;
    ownMarkers += 1;
    write({ ...marker, heartbeat: Date.now() });
  }
  if (ownMarkers === 0) stopHeartbeat();
}

function startHeartbeat() {
  if (heartbeatTimer !== null) return;
  heartbeatTimer = setInterval(beat, HEARTBEAT_INTERVAL_MS);
}

export function startImportMarker(labels) {
  const kept = labels.slice(0, MAX_DOCUMENTS);
  if (kept.length === 0) return;
  currentImportId = crypto.randomUUID();
  write({
    total: kept.length,
    saved: 0,
    labels: kept,
    id: currentImportId,
    owner: OWNER_ID,
    heartbeat: Date.now(),
  });
  startHeartbeat();
}

// Never re-creates a marker that was removed (a wipe in any tab, Quick Exit).
export function recordDocumentSaved() {
  const marker = currentImportId && readMarker(currentImportId);
  if (!marker || marker.owner !== OWNER_ID) return;
  write({
    ...marker,
    saved: Math.min(marker.saved + 1, marker.total),
    heartbeat: Date.now(),
  });
}

// The marker of the import this tab is running, or null.
export function readActiveImportMarker() {
  const marker = currentImportId && readMarker(currentImportId);
  return marker?.owner === OWNER_ID ? marker : null;
}

// With an id, removes only that import's marker, and only if this tab owns it
// or its owner has gone: another tab's live import is never touched. Without
// one, removes every marker this tab owns.
export function clearImportMarker(id) {
  if (id !== undefined) {
    const marker = readMarker(id);
    if (marker && (marker.owner === OWNER_ID || isStale(marker))) {
      removeKey(markerKey(id));
    }
    return;
  }
  for (const key of markerKeys()) {
    if (parseMarker(localStorage.getItem(key))?.owner === OWNER_ID) {
      removeKey(key);
    }
  }
  stopHeartbeat();
}

// Quick Exit, Atomic Wipe and every Clear All Data: every marker, whoever
// owns it.
export function clearAllImportMarkers() {
  for (const key of markerKeys()) removeKey(key);
  try {
    sessionStorage.removeItem(IMPORT_MARKER_KEY);
  } catch {
    console.warn("The import progress marker could not be cleared.");
  }
  stopHeartbeat();
}

// The most recently active abandoned import, or null. An unreadable marker is
// removed rather than shown as a wrong count.
export function readInterruptedImport() {
  let found = null;
  for (const key of markerKeys()) {
    const marker = parseMarker(localStorage.getItem(key));
    if (!marker) {
      removeKey(key);
    } else if (
      isStale(marker) &&
      (!found || marker.heartbeat > found.heartbeat)
    ) {
      found = marker;
    }
  }
  return found && { saved: found.saved, total: found.total, id: found.id };
}

export function describeInterruptedImport({ saved, total }) {
  const noun = total === 1 ? "document was" : "documents were";
  return (
    "Your last import was interrupted before it finished. " +
    `${saved} of ${total} ${noun} saved. ` +
    "Add the same files again to finish - nothing will be duplicated."
  );
}
