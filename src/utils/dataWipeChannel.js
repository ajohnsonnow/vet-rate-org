/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Cross-tab propagation for a full local-data wipe (Atomic Wipe, VKBViewer's
 * "Clear All Data" - decision B). A tab that isn't the one a veteran clicked
 * "Clear All Data" in still holds every in-memory cache fed from the data
 * that just got deleted (vkbCache and its siblings across the codebase) -
 * without this, switching to that tab and doing anything that re-saves from
 * one of those caches (even an unrelated autosave) would write the
 * "deleted" veteran's data straight back into storage. A full reload is the
 * simplest, most robust way to guarantee every such cache drops - auditing
 * every module-level cache variable in the app for a manual reset would be
 * fragile and go stale the moment a new one is added.
 *
 * Self-initializing on import (see the bottom of this file), the same
 * pattern safetyRedirect.js uses for the panic key - importing this module
 * anywhere is what installs the listener; safetyRedirect.js does exactly
 * that (a side-effect-only import) so every tab listens regardless of which
 * tool, if any, is open in it.
 */

import { clearBeforeUnloadWarning } from "./beforeUnloadGuard";
import { stopAutoBackup } from "./autoBackup";

const CHANNEL_NAME = "vetrate-data-wipe";
const STORAGE_FALLBACK_KEY = "vetrate_data_wipe_broadcast";

let channel = null;

function getChannel() {
  if (
    typeof window === "undefined" ||
    typeof BroadcastChannel === "undefined"
  ) {
    return null;
  }
  if (channel) return channel;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch {
    // e.g. Firefox with cookies/site storage blocked throws SecurityError
    // constructing a BroadcastChannel. This module self-initializes on
    // import (see the bottom of this file) from safetyRedirect.js - the
    // panic key - so an uncaught throw here would fail that whole module's
    // evaluation and take the panic key down with it. The storage-event
    // fallback in broadcastDataWipe() below still works without a channel.
    return null;
  }
  return channel;
}

/**
 * Announce a full data wipe to every other open tab on this origin.
 */
export function broadcastDataWipe() {
  const bc = getChannel();
  if (bc) {
    bc.postMessage({ type: "wipe" });
    return;
  }
  // Fallback for browsers without BroadcastChannel: a `storage` event fires
  // in every OTHER tab (never the writing tab itself) when a localStorage
  // key changes, so a lone write-then-remove is enough to notify them.
  try {
    localStorage.setItem(STORAGE_FALLBACK_KEY, String(Date.now()));
    localStorage.removeItem(STORAGE_FALLBACK_KEY);
  } catch {
    // Best-effort only - this tab's own wipe already succeeded regardless.
  }
}

// A tab receiving this broadcast still has its OWN beforeunload guard armed
// (dataPersistence.js) - the wipe that just happened in another tab deleted
// vetrate_data_hash from shared localStorage, which makes THIS tab's own
// hasUnsavedChanges() read true from that point on, tripping the browser's
// native "Leave site?" prompt on the reload() below. Choosing Stay there
// leaves this tab alive with every in-memory cache (vkbCache and siblings)
// the wipe was supposed to invalidate, able to re-save the "deleted"
// veteran's data right back into storage - decision B requires the wipe to
// take effect in every open tab, not just the one it started in, so this
// mirrors wipeAllLocalData's own disableBeforeUnloadPrompt/stopAutoBackup
// for the RECEIVING side of the broadcast.
function reloadAfterWipe() {
  clearBeforeUnloadWarning();
  window.onbeforeunload = null;
  stopAutoBackup();
  window.location.reload();
}

function installListener() {
  const bc = getChannel();
  bc?.addEventListener("message", (event) => {
    if (event.data?.type === "wipe") reloadAfterWipe();
  });
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_FALLBACK_KEY && event.newValue) {
      reloadAfterWipe();
    }
  });
}

if (typeof window !== "undefined") {
  installListener();
}
