/**
 * Vet-Rate.org - Multi-Cloud Backup Manager
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * "THE REDUNDANT BUNKER NETWORK"
 * Secure backup to multiple cloud providers with AES-256 encryption
 */

import { useState, useEffect } from "react";
import {
  getProvider,
  getProviderState,
  connectProvider,
  disconnectProvider,
  saveBackup,
  listBackups,
  restoreBackup,
  PROVIDERS,
} from "../utils/multiCloudStorage";
import {
  initializeGoogleDrive,
  signInToGoogleDrive,
  signOutOfGoogleDrive,
  isSignedInToGoogleDrive,
  saveBackupToGoogleDrive,
  listBackupsFromGoogleDrive,
  restoreBackupFromGoogleDrive,
  deleteBackupFromGoogleDrive,
} from "../utils/cloudSync";
import {
  encryptForCloud,
  decryptFromCloud,
  isEncryptedBackup,
  generateSecureBackupName,
  storeLocalKey,
  getLocalKey,
  isCryptoAvailable,
  unlockDeviceKeystore,
} from "../utils/cloudEncryption";
import { exportAllData, importAllData } from "../utils/storage";

import ResponsiveModal from "./common/ResponsiveModal";
import ToolCardButton from "./ToolCardButton";
import DeviceKeystorePanel from "./DeviceKeystorePanel";

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString();
};

const formatSize = (bytes) => {
  if (!bytes) return "Unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

// Split out of handleCreateBackup purely to keep its cognitive complexity
// under the lint threshold. Same validation, same messages, same order.
function isPassphraseValid(usePassphrase, passphrase, confirmPassphrase) {
  if (!usePassphrase) return { valid: true };
  if (passphrase.length < 8) {
    return { valid: false, error: "Passphrase must be at least 8 characters" };
  }
  if (passphrase !== confirmPassphrase) {
    return { valid: false, error: "Passphrases do not match" };
  }
  return { valid: true };
}

// Split out of handleCreateBackup purely to keep its cognitive complexity
// under the lint threshold. Same branches, same comments, same order.
async function uploadEncryptedBackup(
  selectedProvider,
  data,
  usePassphrase,
  passphrase,
  setStatus,
) {
  setStatus("Encrypting data with AES-256...");

  if (selectedProvider === "google_drive") {
    // Drive: saveBackupToGoogleDrive uploads the package as-is, so the UI
    // encrypts here and stores the local key (no-passphrase case).
    const { encryptedPackage, keyExport } = await encryptForCloud(
      data,
      usePassphrase ? passphrase : null,
    );
    const filename = generateSecureBackupName();
    if (keyExport) {
      await storeLocalKey(`${selectedProvider}_${filename}`, keyExport);
    }
    setStatus("Uploading encrypted backup...");
    await saveBackupToGoogleDrive(encryptedPackage, filename);
  } else {
    // D-H10: Dropbox/OneDrive encrypt once inside saveBackup → saveTo*.
    // Passing a pre-encrypted package here double-encrypts it into an
    // unrestorable backup, so hand saveBackup the RAW data + passphrase.
    setStatus("Encrypting & uploading backup...");
    await saveBackup(selectedProvider, data, usePassphrase ? passphrase : null);
  }
}

// Split out of handleCreateBackup purely to keep its cognitive complexity
// under the lint threshold. Same branches, same order.
async function uploadUnencryptedBackup(selectedProvider, data, setStatus) {
  // Unencrypted backup (not recommended)
  setStatus("Uploading backup...");

  if (selectedProvider === "google_drive") {
    await saveBackupToGoogleDrive(data);
  } else {
    await saveBackup(selectedProvider, data, null);
  }
}

// Initialize Google Drive on mount.
const useGoogleDriveInit = (setProviderStates) => {
  useEffect(() => {
    const initGDrive = async () => {
      try {
        if (typeof window.gapi !== "undefined") {
          await initializeGoogleDrive();
          const signedIn = isSignedInToGoogleDrive();
          setProviderStates((prev) => ({
            ...prev,
            google_drive: {
              ...prev.google_drive,
              initialized: true,
              connected: signedIn,
            },
          }));
        }
      } catch (err) {
        // Google's gapi script can fail to load (network hiccup, ad-block).
        // Non-fatal: the Connect button below still works as a fallback, so
        // this is logged for diagnostics rather than surfaced to the user.
        console.error(err);
      }
    };
    initGDrive();
  }, [setProviderStates]);
};

// Builds the "list backups for the selected provider" handler. Split out of
// the component purely to keep its function body under the line-count limit.
function createLoadBackups({
  selectedProvider,
  setIsLoading,
  setError,
  setBackups,
  setStatus,
}) {
  return async () => {
    setIsLoading(true);
    setError(null);

    try {
      let backupList = [];

      if (selectedProvider === "google_drive") {
        backupList = await listBackupsFromGoogleDrive();
      } else {
        backupList = await listBackups(selectedProvider);
      }

      setBackups(backupList);
      setStatus(`Found ${backupList.length} backup(s)`);
    } catch (err) {
      setError(`Failed to load backups: ${err.message}`);
      setBackups([]);
    } finally {
      setIsLoading(false);
    }
  };
}

// Builds the "connect to a provider" handler. Split out of the component
// purely to keep its function body under the line-count limit.
function createConnectHandler({
  setIsLoading,
  setError,
  setStatus,
  setProviderStates,
  loadBackups,
}) {
  return async (providerId) => {
    setIsLoading(true);
    setError(null);
    setStatus(`Connecting to ${getProvider(providerId)?.name}...`);

    try {
      if (providerId === "google_drive") {
        const user = await signInToGoogleDrive();
        setProviderStates((prev) => ({
          ...prev,
          google_drive: { ...prev.google_drive, connected: true, user },
        }));
      } else {
        const _result = await connectProvider(providerId);
        const state = getProviderState(providerId);
        setProviderStates((prev) => ({
          ...prev,
          [providerId]: { connected: true, user: state.user },
        }));
      }
      setStatus("✅ Connected!");
      loadBackups();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
}

// Builds the "disconnect from a provider" handler. Split out of the
// component purely to keep its function body under the line-count limit.
function createDisconnectHandler({
  setProviderStates,
  setBackups,
  setStatus,
  setError,
}) {
  return async (providerId) => {
    try {
      if (providerId === "google_drive") {
        await signOutOfGoogleDrive();
      } else {
        disconnectProvider(providerId);
      }
      setProviderStates((prev) => ({
        ...prev,
        [providerId]: { ...prev[providerId], connected: false, user: null },
      }));
      setBackups([]);
      setStatus("Disconnected");
    } catch (err) {
      setError(err.message);
    }
  };
}

// Builds the "create a new backup" handler. Split out of the component
// purely to keep its function body under the line-count limit; the encrypt/
// upload branches are further split into uploadEncryptedBackup /
// uploadUnencryptedBackup to keep cognitive complexity under the threshold.
function createCreateBackupHandler({
  usePassphrase,
  passphrase,
  confirmPassphrase,
  encryptionEnabled,
  selectedProvider,
  setError,
  setIsLoading,
  setStatus,
  setPassphrase,
  setConfirmPassphrase,
  loadBackups,
}) {
  return async () => {
    const validation = isPassphraseValid(
      usePassphrase,
      passphrase,
      confirmPassphrase,
    );
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setIsLoading(true);
    setError(null);
    setStatus("Gathering claim data...");

    try {
      // Get all data
      const data = await exportAllData();

      if (encryptionEnabled) {
        await uploadEncryptedBackup(
          selectedProvider,
          data,
          usePassphrase,
          passphrase,
          setStatus,
        );
      } else {
        await uploadUnencryptedBackup(selectedProvider, data, setStatus);
      }

      setStatus("✅ Backup created successfully!");
      setPassphrase("");
      setConfirmPassphrase("");
      loadBackups();
    } catch (err) {
      setError(`Backup failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };
}

// Builds the "restore a backup" handler. Split out of the component purely
// to keep its function body under the line-count limit.
function createRestoreHandler({
  selectedProvider,
  setIsLoading,
  setError,
  setStatus,
  setPendingRestore,
  setShowPassphraseModal,
  setPendingUnlock,
  setShowUnlockModal,
}) {
  return async (backup) => {
    setIsLoading(true);
    setError(null);
    setStatus("Downloading backup...");

    try {
      let data;

      if (selectedProvider === "google_drive") {
        data = await restoreBackupFromGoogleDrive(backup.id);
      } else {
        try {
          data = await restoreBackup(
            selectedProvider,
            backup.path || backup.id,
          );
        } catch (err) {
          if (err.message === "PASSPHRASE_REQUIRED") {
            setPendingRestore(backup);
            setShowPassphraseModal(true);
            setIsLoading(false);
            return;
          }
          throw err;
        }
      }

      // Check if it's encrypted
      if (isEncryptedBackup(data)) {
        // Try local key first
        const localKey = await getLocalKey(
          `${selectedProvider}_${backup.name}`,
        );

        if (localKey) {
          setStatus("Decrypting backup...");
          data = await decryptFromCloud(data, localKey, false);
        } else if (data.hasPassphrase) {
          // Need passphrase from user
          setPendingRestore({ ...backup, encryptedData: data });
          setShowPassphraseModal(true);
          setIsLoading(false);
          return;
        } else {
          throw new Error(
            "Encryption key not found. This backup cannot be restored on this device.",
          );
        }
      }

      setStatus("Restoring data...");
      await importAllData(data);
      setStatus("✅ Backup restored successfully! Refresh to see changes.");
    } catch (err) {
      // A wrapped backup key whose device keystore is locked: prompt for the
      // device passphrase, then retry this same restore. Mirrors the
      // PASSPHRASE_REQUIRED branch above. getLocalKey throws this bare sentinel.
      if (err.message === "KEYSTORE_LOCKED") {
        setPendingUnlock(backup);
        setShowUnlockModal(true);
        return; // finally still clears the loading flag
      }
      setError(`Restore failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };
}

// Builds the "unlock the device keystore, then retry the restore" handler.
// Split out of the component purely to keep its function body under the
// line-count limit.
function createUnlockAndRestoreHandler({
  unlockPassphrase,
  setError,
  setIsLoading,
  pendingUnlock,
  setShowUnlockModal,
  setUnlockPassphrase,
  setPendingUnlock,
  handleRestore,
}) {
  return async () => {
    if (!unlockPassphrase) {
      setError("Please enter your device passphrase");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await unlockDeviceKeystore(unlockPassphrase);
      const backup = pendingUnlock;
      setShowUnlockModal(false);
      setUnlockPassphrase("");
      setPendingUnlock(null);
      if (backup) await handleRestore(backup);
    } catch (err) {
      setError(`Unlock failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };
}

// Builds the "passphrase-protected restore" handler. Split out of the
// component purely to keep its function body under the line-count limit.
function createPassphraseRestoreHandler({
  restorePassphrase,
  setError,
  setIsLoading,
  setShowPassphraseModal,
  pendingRestore,
  selectedProvider,
  setStatus,
  setRestorePassphrase,
  setPendingRestore,
}) {
  return async () => {
    if (!restorePassphrase) {
      setError("Please enter the passphrase");
      return;
    }

    setIsLoading(true);
    setError(null);
    setShowPassphraseModal(false);

    try {
      let data = pendingRestore.encryptedData;

      // If we don't have the encrypted data yet, download it
      if (!data) {
        if (selectedProvider === "google_drive") {
          data = await restoreBackupFromGoogleDrive(pendingRestore.id);
        } else {
          data = await restoreBackup(
            selectedProvider,
            pendingRestore.path || pendingRestore.id,
            restorePassphrase,
          );
          // If multiCloudStorage handled decryption
          if (!isEncryptedBackup(data)) {
            await importAllData(data);
            setStatus("✅ Backup restored successfully!");
            setRestorePassphrase("");
            setPendingRestore(null);
            setIsLoading(false);
            return;
          }
        }
      }

      // Decrypt with passphrase
      setStatus("Decrypting with passphrase...");
      const decryptedData = await decryptFromCloud(
        data,
        restorePassphrase,
        true,
      );

      setStatus("Restoring data...");
      await importAllData(decryptedData);
      setStatus("✅ Backup restored successfully! Refresh to see changes.");
    } catch (err) {
      setError(`Restore failed: ${err.message}`);
    } finally {
      setRestorePassphrase("");
      setPendingRestore(null);
      setIsLoading(false);
    }
  };
}

// Builds the "delete a backup" handler. Split out of the component purely
// to keep its function body under the line-count limit.
function createDeleteHandler({
  selectedProvider,
  setIsLoading,
  setError,
  setStatus,
  loadBackups,
}) {
  return async (backup) => {
    if (!confirm(`Delete backup "${backup.name}"? This cannot be undone.`)) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (selectedProvider === "google_drive") {
        await deleteBackupFromGoogleDrive(backup.id);
      }
      // eslint-disable-next-line sonarjs/todo-tag -- tracked follow-up, not a lint-pass-sized change; only google_drive delete is implemented today
      // TODO: Add delete for other providers

      setStatus("Backup deleted");
      loadBackups();
    } catch (err) {
      setError(`Delete failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };
}

// Groups the state that's shared across nearly every operation (connect,
// disconnect, create, restore, delete). Split out of the component purely
// to keep its function body under the line-count limit.
function useMultiCloudSharedState() {
  const [backups, setBackups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(null);

  return {
    backups,
    setBackups,
    isLoading,
    setIsLoading,
    status,
    setStatus,
    error,
    setError,
  };
}

// Owns provider selection/connection state and the handlers that touch it.
// Split out of the component purely to keep its function body under the
// line-count limit.
function useProviderConnection({
  setIsLoading,
  setError,
  setStatus,
  setBackups,
}) {
  const [selectedProvider, setSelectedProvider] = useState("google_drive");
  const [activeTab, setActiveTab] = useState("providers"); // 'providers', 'backups', 'settings'
  const [providerStates, setProviderStates] = useState({
    google_drive: { connected: false, user: null, initialized: false },
    dropbox: { connected: false, user: null },
    onedrive: { connected: false, user: null },
  });

  useGoogleDriveInit(setProviderStates);

  const loadBackups = createLoadBackups({
    selectedProvider,
    setIsLoading,
    setError,
    setBackups,
    setStatus,
  });

  // Load backups when provider changes
  useEffect(() => {
    if (providerStates[selectedProvider]?.connected) {
      loadBackups();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProvider, providerStates]);

  const handleConnect = createConnectHandler({
    setIsLoading,
    setError,
    setStatus,
    setProviderStates,
    loadBackups,
  });

  const handleDisconnect = createDisconnectHandler({
    setProviderStates,
    setBackups,
    setStatus,
    setError,
  });

  return {
    selectedProvider,
    setSelectedProvider,
    activeTab,
    setActiveTab,
    providerStates,
    setProviderStates,
    handleConnect,
    handleDisconnect,
    loadBackups,
  };
}

// Owns the plain state (no handlers) for backup-creation/restore/delete.
// Split out of useBackupOperations purely to keep its function body under
// the line-count limit.
function useBackupOperationsState() {
  const [encryptionEnabled, setEncryptionEnabled] = useState(true);
  const [usePassphrase, setUsePassphrase] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");

  const [showPassphraseModal, setShowPassphraseModal] = useState(false);
  const [pendingRestore, setPendingRestore] = useState(null);
  const [restorePassphrase, setRestorePassphrase] = useState("");

  // Device-keystore unlock modal (a wrapped backup key needs the device
  // passphrase before a locked restore can proceed).
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [pendingUnlock, setPendingUnlock] = useState(null);
  const [unlockPassphrase, setUnlockPassphrase] = useState("");

  return {
    encryptionEnabled,
    setEncryptionEnabled,
    usePassphrase,
    setUsePassphrase,
    passphrase,
    setPassphrase,
    confirmPassphrase,
    setConfirmPassphrase,
    showPassphraseModal,
    setShowPassphraseModal,
    pendingRestore,
    setPendingRestore,
    restorePassphrase,
    setRestorePassphrase,
    showUnlockModal,
    setShowUnlockModal,
    pendingUnlock,
    setPendingUnlock,
    unlockPassphrase,
    setUnlockPassphrase,
  };
}

// Builds the backup-creation/restore/delete handlers from the state owned by
// useBackupOperationsState. Split out of useBackupOperations purely to keep
// its function body under the line-count limit.
function useBackupOperationsHandlers(
  state,
  { selectedProvider, setIsLoading, setError, setStatus, loadBackups },
) {
  const handleCreateBackup = createCreateBackupHandler({
    usePassphrase: state.usePassphrase,
    passphrase: state.passphrase,
    confirmPassphrase: state.confirmPassphrase,
    encryptionEnabled: state.encryptionEnabled,
    selectedProvider,
    setError,
    setIsLoading,
    setStatus,
    setPassphrase: state.setPassphrase,
    setConfirmPassphrase: state.setConfirmPassphrase,
    loadBackups,
  });

  const handleRestore = createRestoreHandler({
    selectedProvider,
    setIsLoading,
    setError,
    setStatus,
    setPendingRestore: state.setPendingRestore,
    setShowPassphraseModal: state.setShowPassphraseModal,
    setPendingUnlock: state.setPendingUnlock,
    setShowUnlockModal: state.setShowUnlockModal,
  });

  const handleUnlockAndRestore = createUnlockAndRestoreHandler({
    unlockPassphrase: state.unlockPassphrase,
    setError,
    setIsLoading,
    pendingUnlock: state.pendingUnlock,
    setShowUnlockModal: state.setShowUnlockModal,
    setUnlockPassphrase: state.setUnlockPassphrase,
    setPendingUnlock: state.setPendingUnlock,
    handleRestore,
  });

  const handlePassphraseRestore = createPassphraseRestoreHandler({
    restorePassphrase: state.restorePassphrase,
    setError,
    setIsLoading,
    setShowPassphraseModal: state.setShowPassphraseModal,
    pendingRestore: state.pendingRestore,
    selectedProvider,
    setStatus,
    setRestorePassphrase: state.setRestorePassphrase,
    setPendingRestore: state.setPendingRestore,
  });

  const handleDelete = createDeleteHandler({
    selectedProvider,
    setIsLoading,
    setError,
    setStatus,
    loadBackups,
  });

  return {
    handleCreateBackup,
    handleRestore,
    handleUnlockAndRestore,
    handlePassphraseRestore,
    handleDelete,
  };
}

// Owns backup-creation/restore/delete state and the handlers that touch it.
// Split out of the component purely to keep its function body under the
// line-count limit.
function useBackupOperations({
  selectedProvider,
  setIsLoading,
  setError,
  setStatus,
  loadBackups,
}) {
  const state = useBackupOperationsState();
  const handlers = useBackupOperationsHandlers(state, {
    selectedProvider,
    setIsLoading,
    setError,
    setStatus,
    loadBackups,
  });

  return { ...state, ...handlers };
}

const MultiCloudHeader = ({ onClose, activeTab, setActiveTab }) => (
  <div>
    <div className="flex items-center justify-between bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="text-3xl">🏰</div>
        <div>
          <h1 id="multicloud-title" className="text-xl font-bold text-white">
            The Redundant Bunker Network
          </h1>
          <p className="text-sm text-cyan-100">
            Multi-cloud backup with military-grade encryption
          </p>
        </div>
      </div>
      <button
        onClick={onClose}
        aria-label="Close dialog"
        className="text-2xl font-bold text-white transition-colors hover:text-cyan-200"
      >
        ×
      </button>
    </div>

    <div className="flex border-b border-gray-200 dark:border-gray-700">
      {[
        {
          id: "providers",
          label: "☁️ Cloud Providers",
          desc: "Connect accounts",
        },
        { id: "backups", label: "💾 Backups", desc: "Manage backups" },
        {
          id: "settings",
          label: "🔒 Security",
          desc: "Encryption settings",
        },
      ].map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === tab.id
              ? "border-b-2 border-cyan-500 bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-white"
          }`}
        >
          <div>{tab.label}</div>
          <div className="text-xs opacity-60">{tab.desc}</div>
        </button>
      ))}
    </div>
  </div>
);

const StatusBanner = ({ status, error }) => {
  if (!status && !error) return null;
  return (
    <div
      className={`mb-4 p-3 rounded-lg ${error ? "border border-red-300 bg-red-50 dark:border-red-400/30 dark:bg-red-500/10" : "border border-blue-300 bg-blue-50 dark:border-blue-400/30 dark:bg-blue-500/10"}`}
    >
      <p
        className={
          error
            ? "text-sm text-red-700 dark:text-red-300"
            : "text-sm text-blue-700 dark:text-blue-300"
        }
      >
        {error ? `⚠️ ${error}` : status}
      </p>
    </div>
  );
};

const PrivacyNoticeCard = () => (
  <div className="mb-4 rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-400/30 dark:bg-gradient-to-r dark:from-green-500/10 dark:to-cyan-500/10">
    <h3 className="mb-2 font-bold text-green-700 dark:text-green-300">
      🛡️ Your Data, Your Cloud
    </h3>
    <p className="text-sm text-gray-700 dark:text-gray-300">
      Connect your personal cloud storage. Your data is encrypted{" "}
      <strong>before</strong> it leaves your browser and stored in{" "}
      <strong>your own</strong> cloud account. We never have access to your
      data.
    </p>
  </div>
);

const HipaaPrivacyWarningCard = () => (
  <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-400/30 dark:bg-gradient-to-r dark:from-amber-500/10 dark:to-orange-500/10">
    <h3 className="mb-2 flex items-center gap-2 font-bold text-amber-700 dark:text-amber-300">
      ⚠️ Important Privacy & HIPAA Notice
    </h3>
    <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
      <p>
        <strong>This is NOT a HIPAA-covered service.</strong> Vet-Rate.org is a
        free educational tool that runs entirely in your browser. We do not
        store, process, or have access to your health information.
      </p>
      <p>
        <strong>Cloud storage disclaimer:</strong> When you backup to cloud
        providers, YOUR data goes to YOUR personal account. The security of that
        data depends on:
      </p>
      <ul className="ml-2 list-inside list-disc space-y-1 text-xs text-gray-600 dark:text-gray-400">
        <li>Your cloud account&apos;s security settings (enable 2FA!)</li>
        <li>Whether you enable encryption (strongly recommended)</li>
        <li>Whether you use a passphrase (for cross-device access)</li>
        <li>Your cloud provider&apos;s own security practices</li>
      </ul>
      <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
        💡 <strong>Recommendation:</strong> Always enable encryption with a
        passphrase for sensitive medical data. Consider using Dropbox Business
        or OneDrive for Business if you need HIPAA-compliant storage.
      </p>
    </div>
  </div>
);

const GoogleLogoIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

const GoogleDriveProviderCard = ({
  selectedProvider,
  setSelectedProvider,
  providerStates,
  isLoading,
  handleConnect,
  handleDisconnect,
}) => (
  <div
    className={`rounded-lg border p-4 transition-all ${
      selectedProvider === "google_drive"
        ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
        : "border-gray-200 bg-gray-50 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-gray-600"
    }`}
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <input
          type="radio"
          name="provider"
          checked={selectedProvider === "google_drive"}
          onChange={() => setSelectedProvider("google_drive")}
          className="text-cyan-500"
        />
        <div className="text-2xl">📁</div>
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white">
            Google Drive
          </h4>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Most veterans have Gmail - easiest option
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {providerStates.google_drive.connected ? (
          <>
            <span className="text-sm text-green-600 dark:text-green-400">
              ✓ Connected
            </span>
            <button
              onClick={() => handleDisconnect("google_drive")}
              className="rounded bg-gray-200 px-3 py-1 text-xs text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={() => handleConnect("google_drive")}
            disabled={isLoading}
            className="flex items-center gap-2 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
          >
            <GoogleLogoIcon />
            Connect
          </button>
        )}
      </div>
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700 dark:bg-green-500/20 dark:text-green-300">
        🔐 TLS Encryption
      </span>
      <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700 dark:bg-green-500/20 dark:text-green-300">
        🗄️ At-Rest Encryption
      </span>
      <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
        SOC 2
      </span>
      <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
        ISO 27001
      </span>
    </div>
  </div>
);

const DropboxProviderCard = ({
  selectedProvider,
  setSelectedProvider,
  providerStates,
  isLoading,
  handleConnect,
  handleDisconnect,
}) => (
  <div
    className={`rounded-lg border p-4 transition-all ${
      selectedProvider === "dropbox"
        ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
        : "border-gray-200 bg-gray-50 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-gray-600"
    }`}
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <input
          type="radio"
          name="provider"
          checked={selectedProvider === "dropbox"}
          onChange={() => setSelectedProvider("dropbox")}
          className="text-cyan-500"
        />
        <div className="text-2xl">📦</div>
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white">
            Dropbox
          </h4>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Strong security, great mobile apps
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {providerStates.dropbox.connected ? (
          <>
            <span className="text-sm text-green-600 dark:text-green-400">
              ✓ Connected
            </span>
            <button
              onClick={() => handleDisconnect("dropbox")}
              className="rounded bg-gray-200 px-3 py-1 text-xs text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={() => handleConnect("dropbox")}
            disabled={isLoading || !import.meta.env.VITE_DROPBOX_APP_KEY}
            className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-600"
          >
            {!import.meta.env.VITE_DROPBOX_APP_KEY
              ? "🔧 Not Configured"
              : "Connect"}
          </button>
        )}
      </div>
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700 dark:bg-green-500/20 dark:text-green-300">
        🔐 TLS Encryption
      </span>
      <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700 dark:bg-green-500/20 dark:text-green-300">
        🗄️ AES-256 At-Rest
      </span>
      <span className="rounded bg-purple-100 px-2 py-1 text-xs text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">
        HIPAA Eligible
      </span>
      <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
        SOC 2/3
      </span>
    </div>
  </div>
);

const OneDriveProviderCard = ({
  selectedProvider,
  setSelectedProvider,
  providerStates,
  isLoading,
  handleConnect,
  handleDisconnect,
}) => (
  <div
    className={`rounded-lg border p-4 transition-all ${
      selectedProvider === "onedrive"
        ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
        : "border-gray-200 bg-gray-50 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-gray-600"
    }`}
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <input
          type="radio"
          name="provider"
          checked={selectedProvider === "onedrive"}
          onChange={() => setSelectedProvider("onedrive")}
          className="text-cyan-500"
        />
        <div className="text-2xl">☁️</div>
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white">
            Microsoft OneDrive
          </h4>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Great for Microsoft/VA computer users
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {providerStates.onedrive.connected ? (
          <>
            <span className="text-sm text-green-600 dark:text-green-400">
              ✓ Connected
            </span>
            <button
              onClick={() => handleDisconnect("onedrive")}
              className="rounded bg-gray-200 px-3 py-1 text-xs text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={() => handleConnect("onedrive")}
            disabled={isLoading || !import.meta.env.VITE_ONEDRIVE_CLIENT_ID}
            className="flex items-center gap-2 rounded bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-600"
          >
            {!import.meta.env.VITE_ONEDRIVE_CLIENT_ID
              ? "🔧 Not Configured"
              : "Connect"}
          </button>
        )}
      </div>
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700 dark:bg-green-500/20 dark:text-green-300">
        🔐 TLS Encryption
      </span>
      <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700 dark:bg-green-500/20 dark:text-green-300">
        🗄️ BitLocker At-Rest
      </span>
      <span className="rounded bg-purple-100 px-2 py-1 text-xs text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">
        HIPAA Eligible
      </span>
      <span className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300">
        FedRAMP
      </span>
    </div>
  </div>
);

const ProvidersTabPanel = ({
  selectedProvider,
  setSelectedProvider,
  providerStates,
  isLoading,
  handleConnect,
  handleDisconnect,
}) => (
  <div className="space-y-4">
    <PrivacyNoticeCard />

    {/* HIPAA & Privacy Warning */}
    <HipaaPrivacyWarningCard />

    {/* Provider Cards */}
    <div className="grid gap-4">
      <GoogleDriveProviderCard
        selectedProvider={selectedProvider}
        setSelectedProvider={setSelectedProvider}
        providerStates={providerStates}
        isLoading={isLoading}
        handleConnect={handleConnect}
        handleDisconnect={handleDisconnect}
      />
      <DropboxProviderCard
        selectedProvider={selectedProvider}
        setSelectedProvider={setSelectedProvider}
        providerStates={providerStates}
        isLoading={isLoading}
        handleConnect={handleConnect}
        handleDisconnect={handleDisconnect}
      />
      <OneDriveProviderCard
        selectedProvider={selectedProvider}
        setSelectedProvider={setSelectedProvider}
        providerStates={providerStates}
        isLoading={isLoading}
        handleConnect={handleConnect}
        handleDisconnect={handleDisconnect}
      />
    </div>
  </div>
);

const SelectedProviderStatusBar = ({
  provider,
  providerStates,
  selectedProvider,
  handleConnect,
}) => (
  <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
    <div className="flex items-center gap-3">
      <span className="text-2xl">{provider.icon}</span>
      <div>
        <span className="font-medium text-gray-900 dark:text-white">
          {provider.name}
        </span>
        {providerStates[selectedProvider]?.user && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {providerStates[selectedProvider].user.email}
          </p>
        )}
      </div>
    </div>
    {providerStates[selectedProvider]?.connected ? (
      <span className="text-green-600 dark:text-green-400">✓ Connected</span>
    ) : (
      <button
        onClick={() => handleConnect(selectedProvider)}
        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded"
      >
        Connect First
      </button>
    )}
  </div>
);

const EncryptionOptions = ({
  encryptionEnabled,
  setEncryptionEnabled,
  usePassphrase,
  setUsePassphrase,
  passphrase,
  setPassphrase,
  confirmPassphrase,
  setConfirmPassphrase,
}) => (
  <div className="mb-4 space-y-3">
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={encryptionEnabled}
        onChange={(e) => setEncryptionEnabled(e.target.checked)}
        className="rounded text-cyan-500"
      />
      <span className="text-gray-700 dark:text-gray-300">
        🔐 Encrypt backup (AES-256-GCM)
      </span>
      <span className="text-xs text-green-600 dark:text-green-400">
        Recommended
      </span>
    </label>

    {encryptionEnabled && (
      <label className="flex items-center gap-2 cursor-pointer ml-6">
        <input
          type="checkbox"
          checked={usePassphrase}
          onChange={(e) => setUsePassphrase(e.target.checked)}
          className="rounded text-cyan-500"
        />
        <span className="text-gray-700 dark:text-gray-300">
          🔑 Use passphrase protection
        </span>
        <span className="text-xs text-yellow-700 dark:text-yellow-400">
          Extra security
        </span>
      </label>
    )}

    {encryptionEnabled && usePassphrase && (
      <div className="ml-6 space-y-2">
        <input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Enter passphrase (min 8 characters)"
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        />
        <input
          type="password"
          value={confirmPassphrase}
          onChange={(e) => setConfirmPassphrase(e.target.value)}
          placeholder="Confirm passphrase"
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        />
        <p className="text-xs text-yellow-700 dark:text-yellow-300">
          ⚠️ If you forget this passphrase, your backup CANNOT be recovered!
        </p>
      </div>
    )}

    {encryptionEnabled && !usePassphrase && (
      <p className="ml-6 text-xs text-gray-600 dark:text-gray-400">
        ℹ️ Encryption key stored locally. Backup can only be restored on this
        device.
      </p>
    )}
  </div>
);

const CreateBackupCard = ({
  encryptionEnabled,
  setEncryptionEnabled,
  usePassphrase,
  setUsePassphrase,
  passphrase,
  setPassphrase,
  confirmPassphrase,
  setConfirmPassphrase,
  isLoading,
  handleCreateBackup,
}) => (
  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
    <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">
      Create New Backup
    </h3>

    <EncryptionOptions
      encryptionEnabled={encryptionEnabled}
      setEncryptionEnabled={setEncryptionEnabled}
      usePassphrase={usePassphrase}
      setUsePassphrase={setUsePassphrase}
      passphrase={passphrase}
      setPassphrase={setPassphrase}
      confirmPassphrase={confirmPassphrase}
      setConfirmPassphrase={setConfirmPassphrase}
    />

    <ToolCardButton
      className="w-full"
      type="button"
      onClick={handleCreateBackup}
      disabled={isLoading}
    >
      <span>💾</span>
      {isLoading ? "Creating Backup..." : "Create Encrypted Backup"}
    </ToolCardButton>
  </div>
);

const BackupListCard = ({
  backups,
  isLoading,
  loadBackups,
  handleRestore,
  handleDelete,
}) => (
  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
    <div className="flex items-center justify-between mb-4">
      <h3 className="font-semibold text-gray-900 dark:text-white">
        Your Backups ({backups.length})
      </h3>
      <button
        onClick={loadBackups}
        disabled={isLoading}
        className="rounded bg-gray-200 px-3 py-1 text-sm text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
      >
        🔄 Refresh
      </button>
    </div>

    {backups.length === 0 ? (
      <p className="py-6 text-center text-gray-600 dark:text-gray-400">
        No backups found. Create your first backup above.
      </p>
    ) : (
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {backups.map((backup) => (
          <div
            key={backup.id}
            className="flex items-center justify-between rounded border border-gray-200 bg-gray-100 p-3 dark:border-gray-700 dark:bg-gray-900"
          >
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {backup.name}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {formatDate(backup.createdTime || backup.modified)} •{" "}
                {formatSize(backup.size)}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleRestore(backup)}
                disabled={isLoading}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded"
              >
                Restore
              </button>
              <button
                onClick={() => handleDelete(backup)}
                disabled={isLoading}
                className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const BackupsTabPanel = ({
  selectedProvider,
  provider,
  providerStates,
  isLoading,
  handleConnect,
  backups,
  encryptionEnabled,
  setEncryptionEnabled,
  usePassphrase,
  setUsePassphrase,
  passphrase,
  setPassphrase,
  confirmPassphrase,
  setConfirmPassphrase,
  handleCreateBackup,
  loadBackups,
  handleRestore,
  handleDelete,
}) => (
  <div className="space-y-4">
    <SelectedProviderStatusBar
      provider={provider}
      providerStates={providerStates}
      selectedProvider={selectedProvider}
      handleConnect={handleConnect}
    />

    {providerStates[selectedProvider]?.connected && (
      <>
        <CreateBackupCard
          encryptionEnabled={encryptionEnabled}
          setEncryptionEnabled={setEncryptionEnabled}
          usePassphrase={usePassphrase}
          setUsePassphrase={setUsePassphrase}
          passphrase={passphrase}
          setPassphrase={setPassphrase}
          confirmPassphrase={confirmPassphrase}
          setConfirmPassphrase={setConfirmPassphrase}
          isLoading={isLoading}
          handleCreateBackup={handleCreateBackup}
        />
        <BackupListCard
          backups={backups}
          isLoading={isLoading}
          loadBackups={loadBackups}
          handleRestore={handleRestore}
          handleDelete={handleDelete}
        />
      </>
    )}
  </div>
);

const EncryptionInfoCard = () => (
  <div className="rounded-lg border border-green-300 bg-green-50 p-6 dark:border-green-400/30 dark:bg-gradient-to-r dark:from-green-500/10 dark:to-cyan-500/10">
    <h3 className="mb-3 text-lg font-bold text-green-700 dark:text-green-300">
      🔐 Military-Grade Encryption
    </h3>
    <div className="space-y-3 text-gray-700 dark:text-gray-300">
      <p>Your backups are protected with:</p>
      <ul className="space-y-2 ml-4">
        <li className="flex items-start gap-2">
          <span className="text-green-600 dark:text-green-400">✓</span>
          <span>
            <strong>AES-256-GCM</strong> - Same encryption used by the US
            military for classified data
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-green-600 dark:text-green-400">✓</span>
          <span>
            <strong>PBKDF2</strong> - 600,000 iterations for passphrase-based
            keys (OWASP recommended)
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-green-600 dark:text-green-400">✓</span>
          <span>
            <strong>Client-Side Only</strong> - Encryption happens in YOUR
            browser, never on a server
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-green-600 dark:text-green-400">✓</span>
          <span>
            <strong>Zero Knowledge</strong> - We can&apos;t read your data even
            if we wanted to
          </span>
        </li>
      </ul>
    </div>
  </div>
);

const SecurityStatusCard = () => (
  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
    <h4 className="mb-3 font-semibold text-gray-900 dark:text-white">
      Security Status
    </h4>
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-gray-700 dark:text-gray-300">Web Crypto API</span>
        <span
          className={
            isCryptoAvailable()
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }
        >
          {isCryptoAvailable() ? "✓ Available" : "✗ Not Available"}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-gray-700 dark:text-gray-300">
          HTTPS Connection
        </span>
        <span
          className={
            location.protocol === "https:"
              ? "text-green-600 dark:text-green-400"
              : "text-yellow-700 dark:text-yellow-400"
          }
        >
          {location.protocol === "https:" ? "✓ Secure" : "⚠️ Development Mode"}
        </span>
      </div>
    </div>
  </div>
);

const ProviderComparisonTableHead = () => (
  <thead>
    <tr className="border-b border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400">
      <th className="text-left py-2">Provider</th>
      <th className="text-center py-2">In Transit</th>
      <th className="text-center py-2">At Rest</th>
      <th className="text-center py-2">2FA</th>
      <th className="text-center py-2">HIPAA</th>
      <th className="text-center py-2">FedRAMP</th>
    </tr>
  </thead>
);

const ProviderComparisonTable = () => (
  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
    <h4 className="mb-3 font-semibold text-gray-900 dark:text-white">
      Cloud Provider Security
    </h4>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <ProviderComparisonTableHead />
        <tbody>
          <tr className="border-b border-gray-200 dark:border-gray-700/50">
            <td className="py-2 text-gray-900 dark:text-white">Google Drive</td>
            <td className="text-center text-green-600 dark:text-green-400">
              ✓
            </td>
            <td className="text-center text-green-600 dark:text-green-400">
              ✓
            </td>
            <td className="text-center text-green-600 dark:text-green-400">
              ✓
            </td>
            <td className="text-center text-yellow-700 dark:text-yellow-400">
              ~
            </td>
            <td className="text-center text-green-600 dark:text-green-400">
              ✓
            </td>
          </tr>
          <tr className="border-b border-gray-200 dark:border-gray-700/50">
            <td className="py-2 text-gray-900 dark:text-white">Dropbox</td>
            <td className="text-center text-green-600 dark:text-green-400">
              ✓
            </td>
            <td className="text-center text-green-600 dark:text-green-400">
              ✓
            </td>
            <td className="text-center text-green-600 dark:text-green-400">
              ✓
            </td>
            <td className="text-center text-green-600 dark:text-green-400">
              ✓
            </td>
            <td className="text-center text-gray-500">-</td>
          </tr>
          <tr>
            <td className="py-2 text-gray-900 dark:text-white">OneDrive</td>
            <td className="text-center text-green-600 dark:text-green-400">
              ✓
            </td>
            <td className="text-center text-green-600 dark:text-green-400">
              ✓
            </td>
            <td className="text-center text-green-600 dark:text-green-400">
              ✓
            </td>
            <td className="text-center text-green-600 dark:text-green-400">
              ✓
            </td>
            <td className="text-center text-green-600 dark:text-green-400">
              ✓
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
      ~ Google Drive can be HIPAA compliant with Workspace + BAA. Personal
      accounts are not.
    </p>
  </div>
);

const HipaaComplianceNotice = () => (
  <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-400/30 dark:bg-gradient-to-r dark:from-red-500/10 dark:to-orange-500/10">
    <h4 className="mb-3 flex items-center gap-2 font-semibold text-red-700 dark:text-red-300">
      ⚕️ HIPAA Compliance Information
    </h4>
    <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
      <p>
        <strong>
          Vet-Rate.org does NOT store Protected Health Information (PHI).
        </strong>{" "}
        All data remains in your browser&apos;s local storage and/or your
        personal cloud accounts.
      </p>
      <div className="rounded-lg bg-gray-100 p-3 dark:bg-gray-900/50">
        <p className="mb-2 font-medium text-amber-700 dark:text-amber-300">
          For HIPAA-eligible cloud storage:
        </p>
        <ul className="list-inside list-disc space-y-1 text-xs text-gray-600 dark:text-gray-400">
          <li>
            <strong>Google:</strong> Requires Google Workspace + Business
            Associate Agreement (BAA)
          </li>
          <li>
            <strong>Dropbox:</strong> Dropbox Business with signed BAA
          </li>
          <li>
            <strong>OneDrive:</strong> Microsoft 365 Business/Enterprise with
            BAA
          </li>
        </ul>
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-500">
          Personal/free accounts are NOT HIPAA compliant regardless of provider.
        </p>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        <strong>Your responsibility:</strong> If you are a healthcare provider
        or VSO handling veteran PHI, ensure you use appropriate enterprise
        accounts with signed BAAs.
      </p>
    </div>
  </div>
);

const SettingsTabPanel = ({ setProviderStates, setBackups }) => (
  <div className="space-y-6">
    <EncryptionInfoCard />

    {/* Device Keystore Management */}
    <DeviceKeystorePanel
      onDeauthorize={async () => {
        await signOutOfGoogleDrive();
        disconnectProvider("dropbox");
        disconnectProvider("onedrive");
        setProviderStates({
          google_drive: {
            connected: false,
            user: null,
            initialized: false,
          },
          dropbox: { connected: false, user: null },
          onedrive: { connected: false, user: null },
        });
        setBackups([]);
      }}
    />

    <SecurityStatusCard />
    <ProviderComparisonTable />
    <HipaaComplianceNotice />
  </div>
);

const PassphraseRestoreModal = ({
  isOpen,
  restorePassphrase,
  setRestorePassphrase,
  setShowPassphraseModal,
  setPendingRestore,
  handlePassphraseRestore,
}) => (
  <ResponsiveModal
    isOpen={isOpen}
    onClose={() => {
      setShowPassphraseModal(false);
      setPendingRestore(null);
      setRestorePassphrase("");
    }}
    title="🔑 Enter Passphrase"
    size="sm"
    zIndex={70}
    footer={
      <div className="flex gap-3">
        <button
          onClick={() => {
            setShowPassphraseModal(false);
            setPendingRestore(null);
            setRestorePassphrase("");
          }}
          className="flex-1 rounded-lg bg-gray-200 py-2 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          onClick={handlePassphraseRestore}
          disabled={!restorePassphrase}
          className="flex-1 rounded-lg bg-cyan-600 py-2 font-medium text-white hover:bg-cyan-500 disabled:bg-gray-300 dark:disabled:bg-gray-600"
        >
          Decrypt & Restore
        </button>
      </div>
    }
  >
    <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
      This backup is protected with a passphrase. Enter it to restore.
    </p>
    <input
      type="password"
      value={restorePassphrase}
      onChange={(e) => setRestorePassphrase(e.target.value)}
      placeholder="Enter backup passphrase"
      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
      /* eslint-disable-next-line jsx-a11y/no-autofocus */
      autoFocus
    />
  </ResponsiveModal>
);

const KeystoreUnlockModal = ({
  isOpen,
  unlockPassphrase,
  setUnlockPassphrase,
  setShowUnlockModal,
  setPendingUnlock,
  handleUnlockAndRestore,
  isLoading,
}) => (
  <ResponsiveModal
    isOpen={isOpen}
    onClose={() => {
      setShowUnlockModal(false);
      setPendingUnlock(null);
      setUnlockPassphrase("");
    }}
    title="🔒 Unlock Device Keystore"
    size="sm"
    zIndex={70}
    footer={
      <div className="flex gap-3">
        <button
          onClick={() => {
            setShowUnlockModal(false);
            setPendingUnlock(null);
            setUnlockPassphrase("");
          }}
          className="flex-1 rounded-lg bg-gray-200 py-2 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          onClick={handleUnlockAndRestore}
          disabled={!unlockPassphrase || isLoading}
          className="flex-1 rounded-lg bg-cyan-600 py-2 font-medium text-white hover:bg-cyan-500 disabled:bg-gray-300 dark:disabled:bg-gray-600"
        >
          Unlock & Restore
        </button>
      </div>
    }
  >
    <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">
      This backup was encrypted with a device-bound key. Enter your device
      passphrase to unlock the keystore and continue restoring.
    </p>
    <input
      type="password"
      value={unlockPassphrase}
      onChange={(e) => setUnlockPassphrase(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && handleUnlockAndRestore()}
      placeholder="Enter device passphrase"
      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
      /* eslint-disable-next-line jsx-a11y/no-autofocus */
      autoFocus
    />
  </ResponsiveModal>
);

// Renders the two restore-flow modals (passphrase entry, keystore unlock).
// Split out of MultiCloudManager purely to keep its function body under the
// line-count limit.
const MultiCloudRestoreModals = ({ backupOps, isLoading }) => (
  <>
    <PassphraseRestoreModal
      isOpen={backupOps.showPassphraseModal}
      restorePassphrase={backupOps.restorePassphrase}
      setRestorePassphrase={backupOps.setRestorePassphrase}
      setShowPassphraseModal={backupOps.setShowPassphraseModal}
      setPendingRestore={backupOps.setPendingRestore}
      handlePassphraseRestore={backupOps.handlePassphraseRestore}
    />

    <KeystoreUnlockModal
      isOpen={backupOps.showUnlockModal}
      unlockPassphrase={backupOps.unlockPassphrase}
      setUnlockPassphrase={backupOps.setUnlockPassphrase}
      setShowUnlockModal={backupOps.setShowUnlockModal}
      setPendingUnlock={backupOps.setPendingUnlock}
      handleUnlockAndRestore={backupOps.handleUnlockAndRestore}
      isLoading={isLoading}
    />
  </>
);

// Renders the active tab's panel. Split out of MultiCloudManager purely to
// keep its function body under the line-count limit.
const MultiCloudTabContent = ({
  activeTab,
  selectedProvider,
  connection,
  providerStates,
  isLoading,
  backups,
  provider,
  backupOps,
  setBackups,
}) => (
  <>
    {activeTab === "providers" && (
      <ProvidersTabPanel
        selectedProvider={selectedProvider}
        setSelectedProvider={connection.setSelectedProvider}
        providerStates={providerStates}
        isLoading={isLoading}
        handleConnect={connection.handleConnect}
        handleDisconnect={connection.handleDisconnect}
      />
    )}

    {activeTab === "backups" && (
      <BackupsTabPanel
        selectedProvider={selectedProvider}
        provider={provider}
        providerStates={providerStates}
        isLoading={isLoading}
        handleConnect={connection.handleConnect}
        backups={backups}
        encryptionEnabled={backupOps.encryptionEnabled}
        setEncryptionEnabled={backupOps.setEncryptionEnabled}
        usePassphrase={backupOps.usePassphrase}
        setUsePassphrase={backupOps.setUsePassphrase}
        passphrase={backupOps.passphrase}
        setPassphrase={backupOps.setPassphrase}
        confirmPassphrase={backupOps.confirmPassphrase}
        setConfirmPassphrase={backupOps.setConfirmPassphrase}
        handleCreateBackup={backupOps.handleCreateBackup}
        loadBackups={connection.loadBackups}
        handleRestore={backupOps.handleRestore}
        handleDelete={backupOps.handleDelete}
      />
    )}

    {activeTab === "settings" && (
      <SettingsTabPanel
        setProviderStates={connection.setProviderStates}
        setBackups={setBackups}
      />
    )}
  </>
);

const MultiCloudManager = ({ onClose }) => {
  const shared = useMultiCloudSharedState();
  const {
    backups,
    isLoading,
    status,
    error,
    setBackups,
    setIsLoading,
    setError,
    setStatus,
  } = shared;

  const connection = useProviderConnection({
    setIsLoading,
    setError,
    setStatus,
    setBackups,
  });
  const { selectedProvider, activeTab, setActiveTab, providerStates } =
    connection;

  const backupOps = useBackupOperations({
    selectedProvider,
    setIsLoading,
    setError,
    setStatus,
    loadBackups: connection.loadBackups,
  });

  const provider = getProvider(selectedProvider) || PROVIDERS.GOOGLE_DRIVE;

  const header = (
    <MultiCloudHeader
      onClose={onClose}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
    />
  );

  return (
    <>
      <ResponsiveModal
        isOpen
        onClose={onClose}
        header={header}
        labelledBy="multicloud-title"
        size="2xl"
        className="border border-cyan-200 dark:border-cyan-500/30"
      >
        <div>
          <StatusBanner status={status} error={error} />

          <MultiCloudTabContent
            activeTab={activeTab}
            selectedProvider={selectedProvider}
            connection={connection}
            providerStates={providerStates}
            isLoading={isLoading}
            backups={backups}
            provider={provider}
            backupOps={backupOps}
            setBackups={setBackups}
          />
        </div>
      </ResponsiveModal>

      <MultiCloudRestoreModals backupOps={backupOps} isLoading={isLoading} />
    </>
  );
};

export default MultiCloudManager;
