/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
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
import {
  getServiceHistory,
  saveServiceHistory,
  getVeteranProfile,
} from "./veteranProfile";

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
 * Current packet backup format version.
 * Single source of truth shared by packetBackup.js and persistentStorage.js.
 */
export const CURRENT_PACKET_VERSION = "2.0.0";

/**
 * MIGRATION REGISTRY
 *
 * Each entry is a migration function that transforms data from one schema to another.
 * Add new migrations at the bottom as you make breaking changes.
 *
 * Two scopes:
 * - localStorage schema migrations (no `scope` field): run once at app boot
 *   by migrateUserData(); migrate() takes no args and writes localStorage.
 * - scope: "packet": pure, idempotent transforms applied in memory to an
 *   imported packet backup by migratePacket(); migrate(packet) => packet.
 */
// C1: dedup key for a service period — same as
// veteranProfile.js's _servicePeriodKey, duplicated here (not imported —
// that helper is unexported/private) so this migration only relies on
// veteranProfile's public read/write API.
const _periodDedupKey = (p) =>
  `${p.serviceStartDate || ""}|${p.serviceEndDate || ""}`;

/**
 * C1 migration: consolidate the two disconnected legacy service-period
 * sources — serviceHistory.dd214Data (ingest's old write target) and
 * profile.servicePeriods (the Profile tab's manual editor) — into the
 * canonical serviceHistory.servicePeriods[] array. Both legacy sources are
 * left in place, unread, per the dual-read pattern. Idempotent: re-running
 * synthesizes the same dedup key, so a second run adds nothing new.
 */
// Step 1a: the legacy-only fields carried over from dd214Data, split out
// from _migrateDD214DataIntoPeriods purely to keep that function's own
// cyclomatic complexity under the repo's limit.
function _buildDD214LegacyFields(dd) {
  return {
    rank: dd.rank || "",
    payGrade: dd.payGrade || "",
    mos: dd.mos || "",
    mosTitle: dd.mosTitle || "",
    unit: "",
    characterOfService: dd.characterOfService || "",
    separationType: dd.separationType || "",
    separationAuthority: dd.separationAuthority || "",
    separationCode: dd.separationCode || "",
    reentryCode: dd.reentryCode || "",
    narrativeReason: dd.narrativeReason || "",
    netActiveService: "",
    yearsService: dd.yearsService || null,
    monthsService: dd.monthsService || null,
    daysService: null,
    foreignService: !!dd.foreignService,
    militaryEducation: dd.militaryEducation || "",
    sourceDocument: "Migrated (legacy serviceHistory.dd214Data)",
    confidence: 0.5,
    userEdited: false,
    incomplete: !(dd.entryDate && dd.separationDate),
    notes: "",
  };
}

// Step 1: synthesize one period from the legacy dd214Data blob.
function _migrateDD214DataIntoPeriods(history, periods, existingKeys) {
  const dd = history.dd214Data;
  if (!dd || !(dd.entryDate || dd.separationDate)) return;

  const synthesized = {
    serviceStartDate: dd.entryDate || null,
    serviceEndDate: dd.separationDate || null,
    branch: dd.branch || "",
    component: dd.component || "",
  };
  const key = _periodDedupKey(synthesized);
  if (existingKeys.has(key)) return;

  periods.push({
    id: `period_migrated_dd214_${Date.now()}`,
    ...synthesized,
    formType: "DD214",
    ..._buildDD214LegacyFields(dd),
  });
  existingKeys.add(key);
}

// Step 2: fold in the Profile tab's manual servicePeriods entries, marked
// userEdited so ingest never overwrites them.
function _migrateProfilePeriodsIntoPeriods(periods, existingKeys) {
  const profile = getVeteranProfile();
  if (!Array.isArray(profile.servicePeriods)) return;

  profile.servicePeriods.forEach((p, idx) => {
    const key = _periodDedupKey(p);
    if (existingKeys.has(key)) return;
    periods.push({
      id: p.id || `period_migrated_profile_${Date.now()}_${idx}`,
      serviceStartDate: p.serviceStartDate || null,
      serviceEndDate: p.serviceEndDate || null,
      branch: p.branch || "",
      component: p.component || "",
      formType: p.formType || "",
      rank: "",
      payGrade: "",
      mos: p.mos || "",
      mosTitle: "",
      unit: "",
      characterOfService: p.characterOfService || "",
      separationType: "",
      separationAuthority: "",
      separationCode: "",
      reentryCode: "",
      narrativeReason: "",
      netActiveService: "",
      yearsService: null,
      monthsService: null,
      daysService: null,
      foreignService: false,
      militaryEducation: "",
      sourceDocument: "Migrated (manual profile entry)",
      confidence: 1,
      userEdited: true,
      incomplete: !(p.serviceStartDate && p.serviceEndDate),
      notes: p.notes || "",
    });
    existingKeys.add(key);
  });
}

function _migrateServicePeriods() {
  const history = getServiceHistory();
  const periods = Array.isArray(history.servicePeriods)
    ? [...history.servicePeriods]
    : [];
  const existingKeys = new Set(periods.map(_periodDedupKey));

  _migrateDD214DataIntoPeriods(history, periods, existingKeys);
  _migrateProfilePeriodsIntoPeriods(periods, existingKeys);

  history.servicePeriods = periods;
  saveServiceHistory(history);
}

const MIGRATIONS = [
  {
    scope: "packet",
    fromVersion: "1.0.0",
    toVersion: "2.0.0",
    description:
      "Upgrade legacy claims-only packet backups (v1.x) to the complete-packet v2.0.0 format",
    // Deliberately does NOT fabricate empty profile/serviceHistory/ratings
    // sections: downstream imports treat the *presence* of a section as
    // "overwrite current data", so fabricated empties would wipe real data.
    migrate: (packet) => ({
      ...packet,
      version: "2.0.0",
      data: {
        ...packet.data,
        claims: Array.isArray(packet.data?.claims) ? packet.data.claims : [],
        statements:
          packet.data?.statements && typeof packet.data.statements === "object"
            ? packet.data.statements
            : {},
      },
    }),
  },
  {
    fromVersion: "1.1.0",
    toVersion: "1.2.0",
    description:
      "Consolidate legacy DD214 data + manual profile service periods into serviceHistory.servicePeriods[] (C1 multi-period model)",
    migrate: _migrateServicePeriods,
  },
];

/**
 * Upgrade an imported packet backup in memory to the current format.
 * Pure — returns a new object, never mutates the input. Packets already
 * at (or above) the current version pass through unchanged.
 * @param {Object} packet - Parsed packet backup JSON
 * @returns {Object} Packet at CURRENT_PACKET_VERSION
 */
export const migratePacket = (packet) => {
  if (!packet || typeof packet !== "object" || Array.isArray(packet)) {
    return packet;
  }

  let migrated = packet;
  for (const migration of MIGRATIONS) {
    if (migration.scope !== "packet") continue;
    const version = String(migrated.version || "1.0.0");
    if (compareVersions(version, migration.toVersion) < 0) {
      migrated = migration.migrate(migrated);
    }
  }
  return migrated;
};

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

    // Find all migrations that need to run (packet-scope migrations are
    // applied per-import by migratePacket, never at boot)
    const migrationsToRun = MIGRATIONS.filter((migration) => {
      if (migration.scope === "packet") return false;
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
