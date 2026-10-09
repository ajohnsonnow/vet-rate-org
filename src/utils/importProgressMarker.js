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
 * was closed or killed. Whether an owner has gone is asked of the owner, not
 * read off a clock: the importing page holds a Web Lock (released the instant
 * its process dies) or, without Web Locks, answers a BroadcastChannel ping.
 * The owner id lives in memory for one page load only, so a tab opened from
 * the importing one (window.open, Duplicate Tab) never inherits it. Only
 * where neither mechanism exists does the heartbeat age decide. A tab only
 * ever clears its own markers, or ones whose owner is confirmed gone. Quick
 * Exit, Atomic Wipe and every Clear All Data remove every marker, and a tab
 * never re-creates a marker that was removed under it, so a wipe in any tab
 * holds in all of them.
 */

// The key the marker lived under when it was kept in session storage; still
// removed everywhere so an old marker cannot outlive an upgrade.
export const IMPORT_MARKER_KEY = "vetrate_import_in_progress";
export const IMPORT_MARKER_KEY_PREFIX = `${IMPORT_MARKER_KEY}:`;
// An earlier build kept the owner id here, where a duplicated tab inherited it.
const LEGACY_OWNER_KEY = "vetrate_import_owner";

const MAX_DOCUMENTS = 1000;
export const HEARTBEAT_INTERVAL_MS = 5000;
// Background tabs may be throttled to one timer tick a minute, so with no
// other way to ask, a marker is only treated as abandoned well after that.
export const STALE_AFTER_MS = 90000;
export const LIVENESS_TIMEOUT_MS = 1500;
// Taking a Web Lock is asynchronous, so a marker this young is never judged.
export const START_GRACE_MS = 3000;
const STORE_READ_TIMEOUT_MS = 3000;

const LOCK_PREFIX = "vetrate_import_owner:";
const CHANNEL_NAME = "vetrate_import_liveness";

let ownerId = null;
let currentImportId = null;
let heartbeatTimer = null;
let presence = null;

// crypto.randomUUID is missing from older browsers and plain-http origins; this
// module is in the boot path, so it must never throw at load or here.
function newId() {
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto?.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Memory only: a tab that reloads or is duplicated gets a new identity, and its
// predecessor's import is then judged by asking whether that owner still lives.
function owner() {
  ownerId ??= newId();
  return ownerId;
}

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
    const {
      total,
      saved,
      id,
      owner: markerOwner,
      heartbeat,
      started,
    } = parsed ?? {};
    const valid =
      Number.isInteger(total) &&
      Number.isInteger(saved) &&
      total > 0 &&
      total <= MAX_DOCUMENTS &&
      saved >= 0 &&
      saved <= total &&
      typeof id === "string" &&
      typeof markerOwner === "string" &&
      Number.isFinite(heartbeat) &&
      (started === undefined || Number.isFinite(started));
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

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(undefined), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Whether a page holds this owner's lock. Read-only (locks.query), never a
// request: a probe that took the lock would make a second, simultaneous probe
// see it held and wrongly call a dead owner alive. Undefined when unanswered.
async function ownerLockHeld(markerOwner) {
  const snapshot = await withTimeout(
    navigator.locks.query(),
    LIVENESS_TIMEOUT_MS,
  );
  if (!Array.isArray(snapshot?.held)) return undefined;
  const name = `${LOCK_PREFIX}${markerOwner}`;
  return snapshot.held.some((lock) => lock?.name === name);
}

function pingOwner(markerOwner) {
  return new Promise((resolve) => {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    const finish = (alive) => {
      clearTimeout(timer);
      channel.close();
      resolve(alive);
    };
    const timer = setTimeout(() => finish(false), LIVENESS_TIMEOUT_MS);
    channel.onmessage = (event) => {
      if (event.data?.type === "pong" && event.data.owner === markerOwner) {
        finish(true);
      }
    };
    channel.postMessage({ type: "ping", owner: markerOwner });
  });
}

// Whether the import a marker describes is still being run by a live page.
// Asks the owner; the heartbeat age is the answer only when it cannot be asked.
async function importIsLive(marker) {
  if (marker.owner === owner()) return marker.id === currentImportId;
  if (Date.now() - (marker.started ?? 0) < START_GRACE_MS) return true;
  if (typeof navigator !== "undefined" && navigator.locks?.query) {
    try {
      const held = await ownerLockHeld(marker.owner);
      if (typeof held === "boolean") return held;
    } catch {
      // Fall through to the next way of asking.
    }
  }
  if (typeof BroadcastChannel === "function") {
    try {
      return await pingOwner(marker.owner);
    } catch {
      // Fall through to the heartbeat.
    }
  }
  return Date.now() - marker.heartbeat <= STALE_AFTER_MS;
}

function startPresence() {
  if (presence) return;
  const held = { release: null, channel: null };
  presence = held;
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    const released = new Promise((resolve) => {
      held.release = resolve;
    });
    navigator.locks
      .request(`${LOCK_PREFIX}${owner()}`, () => released)
      .catch(() => {});
    return;
  }
  if (typeof BroadcastChannel === "function") {
    try {
      held.channel = new BroadcastChannel(CHANNEL_NAME);
      held.channel.onmessage = (event) => {
        if (event.data?.type === "ping" && event.data.owner === owner()) {
          held.channel.postMessage({ type: "pong", owner: owner() });
        }
      };
    } catch {
      held.channel = null;
    }
  }
}

function stopPresence() {
  if (!presence) return;
  const held = presence;
  presence = null;
  // Runs on the Quick Exit path, which must never be blocked by this.
  try {
    held.release?.();
    held.channel?.close();
  } catch {
    console.warn("The import liveness signal could not be released.");
  }
}

function stopHeartbeat() {
  stopPresence();
  if (heartbeatTimer === null) return;
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

function beat() {
  let ownMarkers = 0;
  for (const key of markerKeys()) {
    const marker = parseMarker(localStorage.getItem(key));
    if (marker?.owner !== owner() || marker.id !== currentImportId) continue;
    ownMarkers += 1;
    write({ ...marker, heartbeat: Date.now() });
  }
  if (ownMarkers === 0) stopHeartbeat();
}

function startHeartbeat() {
  startPresence();
  if (heartbeatTimer !== null) return;
  heartbeatTimer = setInterval(beat, HEARTBEAT_INTERVAL_MS);
}

const sameDocumentSet = (a, b) =>
  a.total === b.total &&
  JSON.stringify([...(a.labels ?? [])].sort()) ===
    JSON.stringify([...(b.labels ?? [])].sort());

// Removes the markers of imports whose owner is confirmed gone, optionally only
// those for the same documents as `like`. Never touches this page's own import.
async function removeDeadMarkers(like) {
  for (const key of markerKeys()) {
    const marker = parseMarker(localStorage.getItem(key));
    const removable =
      !marker ||
      (marker.id !== currentImportId &&
        (!like || sameDocumentSet(marker, like)) &&
        !(await importIsLive(marker)));
    if (removable) removeKey(key);
  }
}

export function startImportMarker(labels) {
  const kept = labels.slice(0, MAX_DOCUMENTS);
  if (kept.length === 0) return;
  currentImportId = newId();
  const now = Date.now();
  write({
    total: kept.length,
    saved: 0,
    labels: kept,
    id: currentImportId,
    owner: owner(),
    heartbeat: now,
    started: now,
  });
  startHeartbeat();
  // Starting again means the veteran is finishing what an earlier import left
  // undone; its dead marker must not come back as a notice after this one
  // completes.
  removeDeadMarkers().catch(() => {});
}

// Never re-creates a marker that was removed (a wipe in any tab, Quick Exit).
export function recordDocumentSaved() {
  const marker = currentImportId && readMarker(currentImportId);
  if (!marker || marker.owner !== owner()) return;
  write({
    ...marker,
    saved: Math.min(marker.saved + 1, marker.total),
    heartbeat: Date.now(),
  });
}

// The id of the import this tab is running, or null. Documents it files carry
// it, so a later notice can count what this import stored.
export function activeImportId() {
  return currentImportId;
}

// The marker of the import this tab is running, or null.
export function readActiveImportMarker() {
  const marker = currentImportId && readMarker(currentImportId);
  return marker?.owner === owner() ? marker : null;
}

// With an id, removes only that import's marker, and only if this page owns
// it: another page's marker is never touched here (see
// dismissInterruptedImport). Without one, removes every marker this page owns.
export function clearImportMarker(id) {
  if (id !== undefined) {
    const marker = readMarker(id);
    if (marker?.owner === owner()) removeKey(markerKey(id));
    return;
  }
  for (const key of markerKeys()) {
    if (parseMarker(localStorage.getItem(key))?.owner === owner()) {
      removeKey(key);
    }
  }
  stopHeartbeat();
}

// The import finished. Clears this page's marker and every dead marker left by
// an earlier run over the same documents (a re-import that finishes them), so
// the old notice cannot come back.
export async function completeImportMarker() {
  const finished = readActiveImportMarker();
  clearImportMarker();
  if (!finished) return;
  try {
    await removeDeadMarkers(finished);
  } catch {
    console.warn("An earlier import marker could not be cleared.");
  }
}

// Quick Exit, Atomic Wipe and every Clear All Data: every marker, whoever
// owns it.
export function clearAllImportMarkers() {
  for (const key of markerKeys()) removeKey(key);
  try {
    sessionStorage.removeItem(IMPORT_MARKER_KEY);
    sessionStorage.removeItem(LEGACY_OWNER_KEY);
  } catch {
    console.warn("The import progress marker could not be cleared.");
  }
  stopHeartbeat();
}

// Dismiss on the notice: removes the marker only once its owner is confirmed
// gone, so a live import (including one in the tab this one was opened from)
// is never lost. Resolves true when the marker is gone.
export async function dismissInterruptedImport(id) {
  const marker = readMarker(id);
  if (!marker) return true;
  if (await importIsLive(marker)) return false;
  removeKey(markerKey(id));
  return true;
}

// Documents this import filed, read from the knowledge base itself: each one
// carries the import's id (addDocumentToVKB). Null when the store cannot be
// read in time. A document filed before the id existed, or by anything outside
// the import, is not counted; a file imported again updates its one entry in
// place, so it counts once.
async function storedByImport(importId) {
  try {
    const { loadVKB, raceVkb } = await import("./veteranKnowledgeBase");
    const vkb = await raceVkb(
      loadVKB({ strict: true, fresh: true }),
      STORE_READ_TIMEOUT_MS,
    );
    if (!vkb?.documentation) return null;
    const ids = new Set();
    for (const doc of Object.values(vkb.documentation)
      .filter(Array.isArray)
      .flat()) {
      if (doc?.importId === importId) ids.add(doc.id);
    }
    return ids.size;
  } catch {
    return null;
  }
}

// What is stored is the truth: the marker lives in local storage and, after a
// kill, the copy on disk can be many writes behind. Only when the store cannot
// be read is the marker's own figure used.
async function interruptedFrom(marker) {
  const stored = await storedByImport(marker.id);
  return {
    saved: stored ?? marker.saved,
    total: marker.total,
    id: marker.id,
  };
}

// The most recently active abandoned import, or null. Asks each owner whether
// it is still alive, re-reads storage before answering (a tab may have finished
// or wiped meanwhile) and takes the saved count from what is stored. An
// unreadable marker is removed rather than shown as a wrong count; a marker
// that counts every document (its removal was cut short) is dropped, but only
// that import's own count may say so, never other saves in the store.
export async function findInterruptedImport() {
  const candidates = [];
  for (const key of markerKeys()) {
    const marker = parseMarker(localStorage.getItem(key));
    if (!marker) removeKey(key);
    else if (marker.id !== currentImportId) candidates.push(marker);
  }
  candidates.sort((a, b) => b.heartbeat - a.heartbeat);
  for (const candidate of candidates) {
    if (await importIsLive(candidate)) continue;
    const marker = readMarker(candidate.id);
    if (!marker) continue;
    const found = await interruptedFrom(marker);
    if (!readMarker(marker.id)) continue;
    if (found.saved >= found.total) {
      removeKey(markerKey(marker.id));
      continue;
    }
    return found;
  }
  return null;
}

export function describeInterruptedImport({ saved, total }) {
  const noun = total === 1 ? "document was" : "documents were";
  return (
    "Your last import was interrupted before it finished. " +
    `${saved} of ${total} ${noun} saved. ` +
    "Add the same files again to finish - nothing will be duplicated."
  );
}
