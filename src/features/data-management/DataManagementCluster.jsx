import { lazy, Suspense, useState, useEffect } from "react";

const BackupManager = lazy(() => import("../../components/BackupManager"));
const MultiCloudManager = lazy(
  () => import("../../components/MultiCloudManager"),
);

/**
 * Data-management surfaces — local backup (BackupManager) + multi-cloud
 * sync (MultiCloudManager). Both opened by window events:
 *   - openBackupManager (toolbar, command-search router, tool router)
 *   - openCloudSyncManager (toolbar, MyPacket -> "Connect Google Drive")
 *
 * Extracted from App.jsx (audit #35, B39). The currentModule label in
 * App.jsx's diagnostic snapshot no longer detects these surfaces — the
 * snapshot intentionally narrows as features migrate out.
 */
export default function DataManagementCluster() {
  const [showBackup, setShowBackup] = useState(false);
  const [showCloudSync, setShowCloudSync] = useState(false);

  useEffect(() => {
    const openBackup = () => setShowBackup(true);
    const openCloudSync = () => setShowCloudSync(true);
    window.addEventListener("openBackupManager", openBackup);
    window.addEventListener("openCloudSyncManager", openCloudSync);
    return () => {
      window.removeEventListener("openBackupManager", openBackup);
      window.removeEventListener("openCloudSyncManager", openCloudSync);
    };
  }, []);

  return (
    <Suspense fallback={null}>
      {showBackup && <BackupManager onClose={() => setShowBackup(false)} />}
      {showCloudSync && (
        <MultiCloudManager onClose={() => setShowCloudSync(false)} />
      )}
    </Suspense>
  );
}
