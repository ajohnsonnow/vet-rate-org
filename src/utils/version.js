/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See COPYRIGHT.js for full license terms.
 */

/**
 * VERSION CONTROL CONSTANTS
 *
 * CRITICAL: This is the single source of truth for app versioning
 * Update package.json version, then this file will automatically sync
 *
 * Version Format: MAJOR.MINOR.PATCH
 * - MAJOR: Breaking changes, data structure overhauls
 * - MINOR: New features, non-breaking additions
 * - PATCH: Bug fixes, small tweaks
 *
 * DEPLOYMENT UPDATE PROCESS:
 * 1. Update version in package.json (npm version patch|minor|major)
 * 2. Update public/version.json to match
 * 3. Update src/utils/changelogGenerator.js for curated highlights
 * 4. Run build process (npm run build)
 * 5. Deploy - What's New modal will automatically show to users
 *
 * The version is sourced from package.json to ensure consistency
 */

// Import version from package.json for consistency
// Note: In build, this gets bundled as a constant
import packageJson from "../../package.json";

// Current application version (synced with package.json)
export const APP_VERSION = packageJson.version;

// Data schema version for localStorage migration
// Increment when making changes to how data is stored
export const SCHEMA_VERSION = "1.2.0";

// Last update date (for changelog display)
const _LAST_UPDATE_DATE = "2026-02-13";

// Update check interval (milliseconds) - 15 minutes
export const UPDATE_CHECK_INTERVAL = 15 * 60 * 1000;

// Storage keys for version tracking
export const VERSION_STORAGE_KEY = "vet_rate_app_version";
export const SCHEMA_STORAGE_KEY = "vet_rate_data_schema_version";
export const LAST_SEEN_VERSION_KEY = "vet_rate_last_seen_version";

// The boot sequence's maintenance-mode check and the update orchestrator's
// version check both fetch /version.json within the same page load. Share
// one in-flight/short-lived request instead of firing it twice. Callers get
// back a plain object with the parsed body (or a synthetic 404/error shape)
// rather than a raw Response, since a Response body can only be read once
// and this promise may be awaited by more than one caller.
const VERSION_JSON_CACHE_MS = 5000;
let versionJsonPromise = null;
let versionJsonFetchedAt = 0;

export const fetchVersionJson = () => {
  const now = Date.now();
  if (
    versionJsonPromise &&
    now - versionJsonFetchedAt < VERSION_JSON_CACHE_MS
  ) {
    return versionJsonPromise;
  }

  versionJsonFetchedAt = now;
  versionJsonPromise = fetch(`/version.json?t=${now}`, {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  })
    .then(async (response) => ({
      ok: response.ok,
      status: response.status,
      data: response.ok ? await response.json() : null,
    }))
    .catch((err) => {
      // Don't cache a rejected promise - let the next caller retry.
      versionJsonPromise = null;
      throw err;
    });

  return versionJsonPromise;
};
