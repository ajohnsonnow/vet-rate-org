/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See COPYRIGHT.js for full license terms.
 */

/**
 * MIGRATION MANAGER - "The Data Protector"
 *
 * This system ensures users never lose data when we push updates.
 *
 * HOW IT WORKS:
 * 1. On app load, check the user's data schema version
 * 2. If their version < current version, run migration functions
 * 3. Migrations transform old data structures to new ones
 * 4. Update their schema version marker
 *
 * CRITICAL: NEVER delete old migration functions. They're permanent history.
 */

import {
  APP_VERSION,
  SCHEMA_VERSION,
  VERSION_STORAGE_KEY,
  SCHEMA_STORAGE_KEY,
} from "./version";

/**
 * Compare semantic versions
 * @param {string} v1 - Version 1 (e.g., "1.2.3")
 * @param {string} v2 - Version 2 (e.g., "1.3.0")
 * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
const compareVersions = (v1, v2) => {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    const a = parts1[i] || 0;
    const b = parts2[i] || 0;
    if (a < b) return -1;
    if (a > b) return 1;
  }
  return 0;
};

/**
 * MIGRATION REGISTRY
 *
 * Each entry is a migration function that transforms data from one schema to another.
 * Add new migrations at the bottom as you make breaking changes.
 *
 * Format:
 * {
 *   fromVersion: '1.0.0',
 *   toVersion: '1.1.0',
 *   description: 'What changed',
 *   migrate: (data) => transformedData
 * }
 */
const MIGRATIONS = [
  // Example migration (template for future use)
  // {
  //   fromVersion: '1.0.0',
  //   toVersion: '1.1.0',
  //   description: 'Renamed "pain" field to "painLevel" in saved claims',
  //   migrate: () => {
  //     const claims = JSON.parse(localStorage.getItem('vet_rate_saved_claims') || '[]');
  //     const migrated = claims.map(claim => ({
  //       ...claim,
  //       painLevel: claim.pain,
  //       pain: undefined // Remove old field
  //     }));
  //     localStorage.setItem('vet_rate_saved_claims', JSON.stringify(migrated));
  //   }
  // }
];

/**
 * Migrate user data from old schema to current schema
 * @returns {Object} Migration result with details
 */
export const migrateUserData = () => {
  const result = {
    success: true,
    migrationsRun: [],
    errors: [],
    previousVersion: null,
    currentVersion: SCHEMA_VERSION,
  };

  try {
    // Get user's current schema version
    const userSchemaVersion = localStorage.getItem(SCHEMA_STORAGE_KEY);
    const _userAppVersion = localStorage.getItem(VERSION_STORAGE_KEY);

    result.previousVersion = userSchemaVersion || "none";

    // First time user - no migration needed
    if (!userSchemaVersion) {
      // eslint-disable-next-line no-console
      console.log(
        "🆕 First-time user detected. Initializing at current schema version.",
      );
      localStorage.setItem(SCHEMA_STORAGE_KEY, SCHEMA_VERSION);
      localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);
      return result;
    }

    // Already on current version - no migration needed
    if (compareVersions(userSchemaVersion, SCHEMA_VERSION) >= 0) {
      // eslint-disable-next-line no-console
      console.log("✅ User data is current. No migration needed.");
      return result;
    }

    // User has old data - run migrations
    // eslint-disable-next-line no-console
    console.log(
      `🔄 Migrating user data from v${userSchemaVersion} to v${SCHEMA_VERSION}`,
    );

    // Find all migrations that need to run
    const migrationsToRun = MIGRATIONS.filter((migration) => {
      const fromOK =
        compareVersions(userSchemaVersion, migration.fromVersion) <= 0;
      const toOK = compareVersions(migration.toVersion, SCHEMA_VERSION) <= 0;
      return fromOK && toOK;
    });

    // Execute migrations in order
    for (const migration of migrationsToRun) {
      try {
        // eslint-disable-next-line no-console
        console.log(`  ⚙️ Running migration: ${migration.description}`);
        migration.migrate();
        result.migrationsRun.push({
          from: migration.fromVersion,
          to: migration.toVersion,
          description: migration.description,
        });
      } catch (error) {
        console.error(`  ❌ Migration failed: ${migration.description}`, error);
        result.errors.push({
          migration: migration.description,
          error: error.message,
        });
        result.success = false;
      }
    }

    // Update version markers
    if (result.success) {
      localStorage.setItem(SCHEMA_STORAGE_KEY, SCHEMA_VERSION);
      localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);
      // eslint-disable-next-line no-console
      console.log(`✅ Migration complete! Now at v${SCHEMA_VERSION}`);
    } else {
      console.error("❌ Some migrations failed. User may experience issues.");
    }
  } catch (error) {
    console.error("❌ Critical migration error:", error);
    result.success = false;
    result.errors.push({
      migration: "System",
      error: error.message,
    });
  }

  return result;
};
