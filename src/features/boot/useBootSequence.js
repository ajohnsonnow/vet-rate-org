import { useState, useEffect } from "react";
import { migrateUserData } from "../../utils/migrationManager";
import { needsMigration, migrateFromLocalStorage } from "../../utils/storage";
import {
  checkMaintenanceMode,
  readCachedMaintenanceMode,
} from "../../utils/maintenanceMode";
import {
  initPersistentStorage,
  initUnsavedChangesWarning,
} from "../../utils/persistentStorage";
import { initAutoBackup } from "../../utils/autoBackup";
import { initializeCompassionateVoice } from "../../utils/voiceIndex";
import { initializeErrorCapture } from "../../utils/bugReportUtils";
import { setupBeforeUnloadWarning } from "../../utils/dataPersistence";

// Tripped the instant a live maintenance-mode check (see maintenanceMode.js)
// resolves "on", so a migration copy already running (runMigrationCopy,
// possibly still going in the background after a fail-open timeout) can
// stop before its next write - see storage.js's migrateFromLocalStorage
// `shouldAbort` contract. A fresh one is created per boot; it is never read
// before it exists, so it only ever needs to go false -> true once.
function createMaintenanceKillSwitch() {
  let tripped = false;
  return {
    shouldAbort: () => tripped,
    trip: () => {
      tripped = true;
    },
  };
}

// How long the boot gate waits for needsMigration()'s IndexedDB round-trip
// before failing open. A stalled/blocked IndexedDB open (e.g. another tab
// mid-delete during Atomic Wipe, see AtomicWipe.jsx's clearIndexedDb) must
// never leave a veteran stuck on the boot screen with no way out.
export const MIGRATION_DECISION_TIMEOUT_MS = 3000;

async function runMigrationCopy(setIsMigrating, shouldAbort) {
  // eslint-disable-next-line no-console
  console.log("🔄 IndexedDB Migration: Migrating data from localStorage...");
  setIsMigrating(true);

  const migrationResult = await migrateFromLocalStorage({ shouldAbort });

  // An aborted run is already logged by storage.js at the point of the
  // abort itself (maintenance mode turned on mid-copy).
  if (migrationResult.success) {
    // eslint-disable-next-line no-console
    console.log(
      "✅ IndexedDB Migration: Successfully migrated",
      migrationResult.migratedKeys.length,
      "items",
    );
    // eslint-disable-next-line no-console
    console.log("   Migrated keys:", migrationResult.migratedKeys);
  } else if (!migrationResult.aborted) {
    console.error("⚠️ IndexedDB Migration: Failed", migrationResult.failedKeys);
  }

  setIsMigrating(false);
}

// Once the boot gate has already failed open, the migration decision (and
// the copy itself, if one turns out to be needed) keeps running - it must
// still finish and update isMigrating, just without anything left waiting
// on it.
function finishMigrationInBackground(
  pendingDecision,
  setIsMigrating,
  shouldAbort,
) {
  pendingDecision
    .then((shouldMigrate) =>
      shouldMigrate
        ? runMigrationCopy(setIsMigrating, shouldAbort)
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

async function runStorageMigration(setIsMigrating, shouldAbort) {
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
    finishMigrationInBackground(pendingDecision, setIsMigrating, shouldAbort);
    return;
  }

  if (decision.shouldMigrate) {
    await runMigrationCopy(setIsMigrating, shouldAbort);
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
  const killSwitch = createMaintenanceKillSwitch();

  // The maintenance check is a network fetch with no timeout (version.js);
  // the migration check/copy is local (IndexedDB + localStorage) and must
  // never be held hostage by a slow or stalled request. Start both without
  // sequencing one behind the other, and drop the boot gate the instant the
  // (fast) migration side settles. If this resolves "on" while a copy is
  // still running below, killSwitch.trip stops it before its next write.
  const maintenanceCheck = checkMaintenanceMode(
    setMaintenanceMode,
    setMaintenanceMessage,
    killSwitch.trip,
  );

  if (readCachedMaintenanceMode()) {
    // Last known state (cached from a previous successful fetch) is "on" -
    // the kill switch must be able to stop a migration from ever starting
    // without waiting on this boot's own live fetch above to confirm it.
    console.warn(
      "🚨 IndexedDB Migration: cached maintenance flag is ON - not starting a migration this boot",
    );
  } else {
    await runStorageMigration(setIsMigrating, killSwitch.shouldAbort);
  }

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
 * Maintenance-mode kill switch (see docs/adr): the migration must never
 * start (or keep running) while the app is in maintenance, but the boot
 * gate must never wait on the network to find that out. So this reads
 * maintenanceMode.js's cached last-known flag *synchronously* before ever
 * starting a migration - if it's on, the migration is skipped entirely for
 * this boot. In parallel, the live /version.json check (decoupled from the
 * migration, per above) can still turn maintenance on mid-copy; that trips
 * createMaintenanceKillSwitch()'s flag, which storage.js's
 * migrateFromLocalStorage checks before every key - it stops there rather
 * than finishing, since the copy is a bare IndexedDB write with no
 * destructive step of its own, but any future one would need the same
 * guard. An aborted copy never marks itself complete, so a later boot's
 * needsMigration() still sees it as pending and finishes it once
 * maintenance is off again.
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
