/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See COPYRIGHT.js for full license terms.
 */

import { fetchVersionJson } from "./version";

// Cached from the previous successful maintenance-mode fetch. Reading this
// is synchronous, so the boot gate (useBootSequence.js) can decide whether
// to even start the IndexedDB migration without waiting on - or requiring -
// this boot's own live network round trip. See docs/adr for the full
// kill-switch design.
export const MAINTENANCE_MODE_CACHE_KEY = "vet_rate_maintenance_mode_cached";
export const MAINTENANCE_MODE_CACHE_TIMESTAMP_KEY =
  "vet_rate_maintenance_mode_cached_at";

// A device whose network never recovers (offline PWA use, a blocking
// extension/proxy, a persistently failing /version.json) would otherwise
// trust a stale cached "on" forever: checkMaintenanceMode() only overwrites
// the cache on a *successful* fetch, and readCachedMaintenanceMode() alone
// gates whether a migration ever starts. Bounding how long "on" is trusted
// means that device eventually resumes attempting the migration even if the
// live check keeps failing - safe either way, since a live fetch that
// actually confirms maintenance still trips the mid-copy kill switch.
export const MAINTENANCE_MODE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Synchronous read of the last-known maintenance flag.
 * Never throws: a private-browsing/quota localStorage failure fails open
 * (false, "not in maintenance") - the live fetch is still the source of
 * truth for the UI and runs regardless of this cache. A cached "on" older
 * than MAINTENANCE_MODE_CACHE_TTL_MS is also treated as false (stale).
 * @returns {boolean}
 */
export function readCachedMaintenanceMode() {
  try {
    if (localStorage.getItem(MAINTENANCE_MODE_CACHE_KEY) !== "true") {
      return false;
    }
    const cachedAt = Number(
      localStorage.getItem(MAINTENANCE_MODE_CACHE_TIMESTAMP_KEY),
    );
    return (
      Boolean(cachedAt) && Date.now() - cachedAt < MAINTENANCE_MODE_CACHE_TTL_MS
    );
  } catch (error) {
    console.warn("⚠️ Could not read cached maintenance flag:", error);
    return false;
  }
}

function cacheMaintenanceMode(isOn) {
  try {
    localStorage.setItem(MAINTENANCE_MODE_CACHE_KEY, isOn ? "true" : "false");
    localStorage.setItem(
      MAINTENANCE_MODE_CACHE_TIMESTAMP_KEY,
      String(Date.now()),
    );
  } catch (error) {
    // Best-effort only - a failed cache write must never block boot or
    // lose data; the next successful fetch will simply overwrite it again.
    console.warn("⚠️ Could not cache maintenance flag:", error);
  }
}

/**
 * Live maintenance-mode check against /version.json. Updates the cached
 * flag on every successful fetch (whether on or off) so the next boot's
 * synchronous read reflects this one.
 *
 * When the app is now in maintenance, `onMaintenanceOn` is called
 * synchronously before this resolves - useBootSequence.js uses this to trip
 * its migration kill switch, so a copy already running stops before its
 * next write instead of racing this result.
 *
 * @returns {Promise<boolean>} true if maintenance mode is active
 */
export async function checkMaintenanceMode(
  setMaintenanceMode,
  setMaintenanceMessage,
  onMaintenanceOn = () => {},
) {
  try {
    // Shared with the update orchestrator's version check so both don't
    // fetch /version.json separately within the same page load.
    const { ok, data } = await fetchVersionJson();
    if (!ok) return false;

    const isOn = data.maintenance_mode === true;
    cacheMaintenanceMode(isOn);

    if (isOn) {
      console.warn("🚨 MAINTENANCE MODE ACTIVE - App disabled");
      onMaintenanceOn();
      setMaintenanceMode(true);
      setMaintenanceMessage(
        data.maintenance_message ||
          "System maintenance in progress. Please check back later.",
      );
      return true;
    }
    return false;
  } catch (error) {
    console.error("⚠️ Could not check maintenance mode:", error);
    return false;
  }
}
