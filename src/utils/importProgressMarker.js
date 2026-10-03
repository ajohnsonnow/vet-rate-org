/**
 * Vet-Rate.org - "Import in progress" marker
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * A tab the browser kills mid-import cannot say so. While an import runs, a
 * small marker (neutral document labels and counts only - never a file name)
 * is kept in this tab's session storage, cleared when the import finishes or
 * is cancelled. If it is still there on the next load, the import was cut
 * short and the veteran is told so.
 *
 * Session storage is deliberate: it belongs to this one tab (two imports in
 * two tabs never clear each other's marker) and survives the reload that
 * follows a killed tab. The tab that starts a Clear All Data empties it, Quick
 * Exit empties it, and every other tab drops it when the wipe broadcast
 * arrives (dataWipeChannel.js).
 */

export const IMPORT_MARKER_KEY = "vetrate_import_in_progress";

const MAX_DOCUMENTS = 1000;

function write(marker) {
  try {
    sessionStorage.setItem(IMPORT_MARKER_KEY, JSON.stringify(marker));
  } catch {
    console.warn("The import progress marker could not be written.");
  }
}

function readRaw() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(IMPORT_MARKER_KEY));
    const { total, saved } = parsed ?? {};
    const valid =
      Number.isInteger(total) &&
      Number.isInteger(saved) &&
      total > 0 &&
      total <= MAX_DOCUMENTS &&
      saved >= 0 &&
      saved <= total;
    return valid ? parsed : null;
  } catch {
    return null;
  }
}

export function startImportMarker(labels) {
  const kept = labels.slice(0, MAX_DOCUMENTS);
  if (kept.length === 0) return;
  write({
    total: kept.length,
    saved: 0,
    labels: kept,
    id: crypto.randomUUID(),
  });
}

export function recordDocumentSaved() {
  const marker = readRaw();
  if (!marker) return;
  write({ ...marker, saved: Math.min(marker.saved + 1, marker.total) });
}

// With an id, removes only that import's marker: an import started since is
// a different marker and must survive.
export function clearImportMarker(id) {
  try {
    if (id !== undefined && readRaw()?.id !== id) return;
    sessionStorage.removeItem(IMPORT_MARKER_KEY);
  } catch {
    console.warn("The import progress marker could not be cleared.");
  }
}

// An unreadable marker is removed rather than shown as a wrong count.
export function readInterruptedImport() {
  const marker = readRaw();
  if (!marker) {
    clearImportMarker();
    return null;
  }
  return { saved: marker.saved, total: marker.total, id: marker.id };
}

export function describeInterruptedImport({ saved, total }) {
  const noun = total === 1 ? "document was" : "documents were";
  return (
    "Your last import was interrupted before it finished. " +
    `${saved} of ${total} ${noun} saved. ` +
    "Add the same files again to finish - nothing will be duplicated."
  );
}
