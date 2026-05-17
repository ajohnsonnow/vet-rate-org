import { useState, useEffect } from "react";
import { migrateUserData } from "../../utils/migrationManager";
import { needsMigration, migrateFromLocalStorage } from "../../utils/storage";
import { initPersistentStorage } from "../../utils/persistentStorage";
import { initAutoBackup } from "../../utils/autoBackup";
import { initializeCompassionateVoice } from "../../utils/voiceIndex";
import { initializeErrorCapture } from "../../utils/bugReportUtils";
import { setupBeforeUnloadWarning } from "../../utils/dataPersistence";

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
 * Returns: { isMigrating, maintenanceMode, maintenanceMessage }
 *   - App.jsx renders <MaintenancePage> when maintenanceMode is true.
 *   - App.jsx renders a migration loading screen when isMigrating is true.
 *
 * Extracted from App.jsx (audit #35, B59; B70 absorbed the sync inits).
 */
export function useBootSequence() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [isMigrating, setIsMigrating] = useState(false);

  useEffect(() => {
    initializeErrorCapture();
    initializeCompassionateVoice();
    setupBeforeUnloadWarning();
    console.log("🎙️ Compassionate Voice System initialized");
  }, []);

  useEffect(() => {
    const checkMaintenanceMode = async () => {
      try {
        const response = await fetch("/version.json?t=" + Date.now());
        const data = await response.json();

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
    };

    const runStorageMigration = async () => {
      try {
        const shouldMigrate = await needsMigration();

        if (shouldMigrate) {
          console.log(
            "🔄 IndexedDB Migration: Migrating data from localStorage...",
          );
          setIsMigrating(true);

          const migrationResult = await migrateFromLocalStorage();

          if (migrationResult.success) {
            console.log(
              "✅ IndexedDB Migration: Successfully migrated",
              migrationResult.itemsMigrated,
              "items",
            );
            console.log("   Migrated keys:", migrationResult.keysProcessed);
          } else {
            console.error(
              "⚠️ IndexedDB Migration: Failed",
              migrationResult.errors,
            );
          }

          setIsMigrating(false);
        } else {
          console.log(
            "✅ IndexedDB Migration: Already complete, using IndexedDB",
          );
        }
      } catch (error) {
        console.error("❌ IndexedDB Migration: Critical error", error);
        setIsMigrating(false);
      }
    };

    const initializeApp = async () => {
      const inMaintenanceMode = await checkMaintenanceMode();
      if (inMaintenanceMode) {
        return;
      }

      await runStorageMigration();

      try {
        const persistentResult = await initPersistentStorage();
        console.log("🛡️ Persistent Storage: Initialized", persistentResult);
        if (persistentResult.hasUnsavedChanges) {
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

      try {
        await initAutoBackup();
        console.log(
          "💾 Auto-Backup: System initialized - all data will be backed up after every action",
        );
      } catch (error) {
        console.error(
          "⚠️ Auto-Backup: Initialization failed, continuing anyway",
          error,
        );
      }

      console.log("🛡️ LIVE OPS: Initializing protection systems...");
      const migrationResult = migrateUserData();

      if (migrationResult.migrationsRun.length > 0) {
        console.log(
          `✅ Ran ${migrationResult.migrationsRun.length} migration(s):`,
          migrationResult.migrationsRun,
        );
      }

      if (!migrationResult.success) {
        console.error("⚠️ Some migrations failed:", migrationResult.errors);
      }
    };

    initializeApp();
  }, []);

  return { isMigrating, maintenanceMode, maintenanceMessage };
}
