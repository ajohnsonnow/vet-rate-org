import { useState, useEffect } from "react";
import { migrateUserData } from "../../utils/migrationManager";
import { needsMigration, migrateFromLocalStorage } from "../../utils/storage";
import {
  initPersistentStorage,
  initUnsavedChangesWarning,
} from "../../utils/persistentStorage";
import { initAutoBackup } from "../../utils/autoBackup";
import { initializeCompassionateVoice } from "../../utils/voiceIndex";
import { initializeErrorCapture } from "../../utils/bugReportUtils";
import { setupBeforeUnloadWarning } from "../../utils/dataPersistence";
import { fetchVersionJson } from "../../utils/version";

async function checkMaintenanceMode(setMaintenanceMode, setMaintenanceMessage) {
  try {
    // Shared with the update orchestrator's version check so both don't
    // fetch /version.json separately within the same page load.
    const { ok, data } = await fetchVersionJson();
    if (!ok) return false;

    if (data.maintenance_mode === true) {
      console.warn("🚨 MAINTENANCE MODE ACTIVE - App disabled");
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

// How long the boot gate waits for needsMigration()'s IndexedDB round-trip
// before failing open. A stalled/blocked IndexedDB open (e.g. another tab
// mid-delete during Atomic Wipe, see AtomicWipe.jsx's clearIndexedDb) must
// never leave a veteran stuck on the boot screen with no way out.
export const MIGRATION_DECISION_TIMEOUT_MS = 3000;

async function runMigrationCopy(setIsMigrating) {
  // eslint-disable-next-line no-console
  console.log("🔄 IndexedDB Migration: Migrating data from localStorage...");
  setIsMigrating(true);

  const migrationResult = await migrateFromLocalStorage();

  if (migrationResult.success) {
    // eslint-disable-next-line no-console
    console.log(
      "✅ IndexedDB Migration: Successfully migrated",
      migrationResult.migratedKeys.length,
      "items",
    );
    // eslint-disable-next-line no-console
    console.log("   Migrated keys:", migrationResult.migratedKeys);
  } else {
    console.error("⚠️ IndexedDB Migration: Failed", migrationResult.failedKeys);
  }

  setIsMigrating(false);
}

// Once the boot gate has already failed open, the migration decision (and
// the copy itself, if one turns out to be needed) keeps running - it must
// still finish and update isMigrating, just without anything left waiting
// on it.
function finishMigrationInBackground(pendingDecision, setIsMigrating) {
  pendingDecision
    .then((shouldMigrate) =>
      shouldMigrate
        ? runMigrationCopy(setIsMigrating)
        : // eslint-disable-next-line no-console
          console.log(
            "✅ IndexedDB Migration: Already complete, using IndexedDB",
          ),
    )
    .catch((error) => {
      console.error(
        "❌ IndexedDB Migration: Critical error (background)",
        error,
      );
      setIsMigrating(false);
    });
}

async function runStorageMigration(setIsMigrating) {
  const pendingDecision = needsMigration().catch((error) => {
    console.error("❌ IndexedDB Migration: Critical error", error);
    return false;
  });

  const decision = await Promise.race([
    pendingDecision.then((shouldMigrate) => ({ shouldMigrate })),
    new Promise((resolve) =>
      setTimeout(() => resolve(null), MIGRATION_DECISION_TIMEOUT_MS),
    ),
  ]);

  if (decision === null) {
    console.warn(
      `⚠️ IndexedDB Migration: decision did not settle within ${MIGRATION_DECISION_TIMEOUT_MS}ms - mounting the app and finishing the check in the background`,
    );
    finishMigrationInBackground(pendingDecision, setIsMigrating);
    return;
  }

  if (decision.shouldMigrate) {
    await runMigrationCopy(setIsMigrating);
  } else {
    // eslint-disable-next-line no-console
    console.log("✅ IndexedDB Migration: Already complete, using IndexedDB");
  }
}

async function runPersistentStorageInit() {
  try {
    const persistentResult = await initPersistentStorage();
    // eslint-disable-next-line no-console
    console.log("🛡️ Persistent Storage: Initialized", persistentResult);
    if (persistentResult.hasUnsavedChanges) {
      // eslint-disable-next-line no-console
      console.log(
        "⚠️ Found unsaved changes from previous session - will auto-save",
      );
    }
  } catch (error) {
    console.error(
      "⚠️ Persistent Storage: Initialization failed, continuing anyway",
      error,
    );
  }
}

async function runAutoBackupInit() {
  try {
    await initAutoBackup();
    // eslint-disable-next-line no-console
    console.log(
      "💾 Auto-Backup: System initialized - all data will be backed up after every action",
    );
  } catch (error) {
    console.error(
      "⚠️ Auto-Backup: Initialization failed, continuing anyway",
      error,
    );
  }
}

function runUserDataMigrations() {
  // eslint-disable-next-line no-console
  console.log("🛡️ LIVE OPS: Initializing protection systems...");
  const migrationResult = migrateUserData();

  if (migrationResult.migrationsRun.length > 0) {
    // eslint-disable-next-line no-console
    console.log(
      `✅ Ran ${migrationResult.migrationsRun.length} migration(s):`,
      migrationResult.migrationsRun,
    );
  }

  if (!migrationResult.success) {
    console.error("⚠️ Some migrations failed:", migrationResult.errors);
  }
}

async function initializeApp({
  setMaintenanceMode,
  setMaintenanceMessage,
  setIsMigrating,
  setIsBooting,
}) {
  // The maintenance check is a network fetch with no timeout (version.js);
  // the migration check/copy is local (IndexedDB + localStorage) and must
  // never be held hostage by a slow or stalled request. Start both without
  // sequencing one behind the other, and drop the boot gate the instant the
  // (fast) migration side settles.
  const maintenanceCheck = checkMaintenanceMode(
    setMaintenanceMode,
    setMaintenanceMessage,
  );

  await runStorageMigration(setIsMigrating);
  setIsBooting(false);

  if (await maintenanceCheck) {
    return;
  }

  await runPersistentStorageInit();
  await runAutoBackupInit();
  runUserDataMigrations();
}

/**
 * App boot sequence — runs once on mount, in fixed order:
 *
 *   1. Maintenance-mode check (fail-open if /version.json unreachable)
 *   2. IndexedDB migration from localStorage (sets isMigrating)
 *   3. Persistent storage ("The Bunker") init
 *   4. Auto-backup ("Zero Data Loss Protocol") init
 *   5. User-data schema migrations
 *
 * Plus three unconditional, synchronous inits that fire in parallel
 * with the async sequence above (B69 moved them out of App.jsx):
 *   - Error capture for bug reports
 *   - Compassionate Voice / panic-key wiring
 *   - beforeunload unsaved-changes warning
 *
 * The What's-New modal and SW update checker (formerly Step 2 / Step 3)
 * are owned by useUpdateOrchestrator now.
 *
 * isBooting gates App.jsx's *first* mount of the interactive tree: it
 * starts true and only flips false once the migration decision (and the
 * copy itself, if one was needed) has fully resolved. Before this existed,
 * App.jsx mounted the interactive tree immediately (isMigrating started
 * false), then swapped the whole tree out for <MigrationScreen/> the
 * moment a returning user's migration kicked in, then swapped back when it
 * finished - unmounting (and losing the state of) anything already open,
 * and dropping any window CustomEvent dispatched while nothing was
 * mounted to hear it. Gating the first mount on isBooting instead means
 * the interactive tree - and everything a veteran can open inside it -
 * only ever mounts once, after migration is already done, so there is no
 * window left in which it can be swapped out from under them. isMigrating
 * is kept (now purely informational: true only while the copy itself is
 * running) since isBooting alone doesn't distinguish "still deciding" from
 * "actively copying" for any future consumer that cares.
 *
 * The migration decision itself (needsMigration()'s IndexedDB open) is
 * raced against MIGRATION_DECISION_TIMEOUT_MS: a blocked/stalled IndexedDB
 * open (e.g. another tab mid-delete during Atomic Wipe) must never hold the
 * boot gate open indefinitely with no way out. On timeout, isBooting still
 * flips false and the decision/copy keeps resolving in the background.
 *
 * Returns: { isBooting, isMigrating, maintenanceMode, maintenanceMessage }
 *   - App.jsx renders a migration/boot screen while isBooting is true.
 *   - App.jsx renders <MaintenancePage> when maintenanceMode is true.
 *
 * Extracted from App.jsx (audit #35, B59; B70 absorbed the sync inits).
 */
export function useBootSequence() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [isMigrating, setIsMigrating] = useState(false);
  const [isBooting, setIsBooting] = useState(true);

  useEffect(() => {
    initializeErrorCapture();
    initializeCompassionateVoice();
    setupBeforeUnloadWarning(); // Bunker Backup unsaved-changes guard (hash compare)
    initUnsavedChangesWarning(); // OPFS/IDB file-handle unsaved-changes guard
    // eslint-disable-next-line no-console
    console.log("🎙️ Compassionate Voice System initialized");
  }, []);

  useEffect(() => {
    initializeApp({
      setMaintenanceMode,
      setMaintenanceMessage,
      setIsMigrating,
      setIsBooting,
    });
  }, []);

  return { isBooting, isMigrating, maintenanceMode, maintenanceMessage };
}
