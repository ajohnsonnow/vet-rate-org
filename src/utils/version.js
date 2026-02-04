/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
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
import packageJson from '../../package.json';

// Current application version (synced with package.json)
export const APP_VERSION = packageJson.version;

// Data schema version for localStorage migration
// Increment when making changes to how data is stored
export const SCHEMA_VERSION = '1.1.0';

// Last update date (for changelog display)
export const LAST_UPDATE_DATE = '2026-02-03';

// Update check interval (milliseconds) - 15 minutes
export const UPDATE_CHECK_INTERVAL = 15 * 60 * 1000;

// Storage keys for version tracking
export const VERSION_STORAGE_KEY = 'vet_rate_app_version';
export const SCHEMA_STORAGE_KEY = 'vet_rate_data_schema_version';
export const LAST_SEEN_VERSION_KEY = 'vet_rate_last_seen_version';
