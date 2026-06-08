/**
 * Vet-Rate.org - Multi-Cloud Backup Manager
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
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
} from "../utils/cloudEncryption";
import { exportAllData, importAllData } from "../utils/storage";

import ResponsiveModal from "./common/ResponsiveModal";
import ToolCardButton from "./ToolCardButton";

const MultiCloudManager = ({ onClose }) => {
  // UI State
  const [selectedProvider, setSelectedProvider] = useState("google_drive");
  const [activeTab, setActiveTab] = useState("providers"); // 'providers', 'backups', 'settings'

  // Connection states
  const [providerStates, setProviderStates] = useState({
    google_drive: { connected: false, user: null, initialized: false },
    dropbox: { connected: false, user: null },
    onedrive: { connected: false, user: null },
  });

  // Backup states
  const [backups, setBackups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(null);

  // Encryption settings
  const [encryptionEnabled, setEncryptionEnabled] = useState(true);
  const [usePassphrase, setUsePassphrase] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");

  // Restore modal
  const [showPassphraseModal, setShowPassphraseModal] = useState(false);
  const [pendingRestore, setPendingRestore] = useState(null);
  const [restorePassphrase, setRestorePassphrase] = useState("");

  // Initialize Google Drive on mount
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
        // Optionally handle error
      }
    };
    initGDrive();
  }, []);
  // Load backups when provider changes
  useEffect(() => {
    if (providerStates[selectedProvider]?.connected) {
      loadBackups();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProvider, providerStates]);

  // Connect to a provider
  const handleConnect = async (providerId) => {
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

  // Disconnect from a provider
  const handleDisconnect = async (providerId) => {
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

  // Load backups from selected provider
  const loadBackups = async () => {
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

  // Create a new backup
  const handleCreateBackup = async () => {
    // Validate passphrase if using one
    if (usePassphrase) {
      if (passphrase.length < 8) {
        setError("Passphrase must be at least 8 characters");
        return;
      }
      if (passphrase !== confirmPassphrase) {
        setError("Passphrases do not match");
        return;
      }
    }

    setIsLoading(true);
    setError(null);
    setStatus("Gathering claim data...");

    try {
      // Get all data
      const data = await exportAllData();

      if (encryptionEnabled) {
        setStatus("Encrypting data with AES-256...");

        const { encryptedPackage, keyExport } = await encryptForCloud(
          data,
          usePassphrase ? passphrase : null,
        );

        const filename = generateSecureBackupName();

        // Store key locally if no passphrase
        if (keyExport) {
          await storeLocalKey(`${selectedProvider}_${filename}`, keyExport);
        }

        setStatus("Uploading encrypted backup...");

        if (selectedProvider === "google_drive") {
          await saveBackupToGoogleDrive(encryptedPackage, filename);
        } else {
          await saveBackup(selectedProvider, encryptedPackage, null);
        }
      } else {
        // Unencrypted backup (not recommended)
        setStatus("Uploading backup...");

        if (selectedProvider === "google_drive") {
          await saveBackupToGoogleDrive(data);
        } else {
          await saveBackup(selectedProvider, data, null);
        }
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

  // Restore a backup
  const handleRestore = async (backup) => {
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
      setError(`Restore failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle passphrase-protected restore
  const handlePassphraseRestore = async () => {
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

  // Delete a backup
  const handleDelete = async (backup) => {
    if (!confirm(`Delete backup "${backup.name}"? This cannot be undone.`)) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (selectedProvider === "google_drive") {
        await deleteBackupFromGoogleDrive(backup.id);
      }
      // TODO: Add delete for other providers

      setStatus("Backup deleted");
      loadBackups();
    } catch (err) {
      setError(`Delete failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatSize = (bytes) => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const provider = getProvider(selectedProvider) || PROVIDERS.GOOGLE_DRIVE;

  const header = (
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
          {/* Status Messages */}
          {(status || error) && (
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
          )}

          {/* Providers Tab */}
          {activeTab === "providers" && (
            <div className="space-y-4">
              <div className="mb-4 rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-400/30 dark:bg-gradient-to-r dark:from-green-500/10 dark:to-cyan-500/10">
                <h3 className="mb-2 font-bold text-green-700 dark:text-green-300">
                  🛡️ Your Data, Your Cloud
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Connect your personal cloud storage. Your data is encrypted{" "}
                  <strong>before</strong> it leaves your browser and stored in{" "}
                  <strong>your own</strong> cloud account. We never have access
                  to your data.
                </p>
              </div>

              {/* HIPAA & Privacy Warning */}
              <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-400/30 dark:bg-gradient-to-r dark:from-amber-500/10 dark:to-orange-500/10">
                <h3 className="mb-2 flex items-center gap-2 font-bold text-amber-700 dark:text-amber-300">
                  ⚠️ Important Privacy & HIPAA Notice
                </h3>
                <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <p>
                    <strong>This is NOT a HIPAA-covered service.</strong>{" "}
                    Vet-Rate.org is a free educational tool that runs entirely
                    in your browser. We do not store, process, or have access to
                    your health information.
                  </p>
                  <p>
                    <strong>Cloud storage disclaimer:</strong> When you backup
                    to cloud providers, YOUR data goes to YOUR personal account.
                    The security of that data depends on:
                  </p>
                  <ul className="ml-2 list-inside list-disc space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    <li>
                      Your cloud account&apos;s security settings (enable 2FA!)
                    </li>
                    <li>
                      Whether you enable encryption (strongly recommended)
                    </li>
                    <li>
                      Whether you use a passphrase (for cross-device access)
                    </li>
                    <li>Your cloud provider&apos;s own security practices</li>
                  </ul>
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                    💡 <strong>Recommendation:</strong> Always enable encryption
                    with a passphrase for sensitive medical data. Consider using
                    Dropbox Business or OneDrive for Business if you need
                    HIPAA-compliant storage.
                  </p>
                </div>
              </div>

              {/* Provider Cards */}
              <div className="grid gap-4">
                {/* Google Drive */}
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

                {/* Dropbox */}
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
                          disabled={
                            isLoading || !import.meta.env.VITE_DROPBOX_APP_KEY
                          }
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

                {/* OneDrive */}
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
                          disabled={
                            isLoading ||
                            !import.meta.env.VITE_ONEDRIVE_CLIENT_ID
                          }
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
              </div>
            </div>
          )}

          {/* Backups Tab */}
          {activeTab === "backups" && (
            <div className="space-y-4">
              {/* Selected Provider */}
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
                  <span className="text-green-600 dark:text-green-400">
                    ✓ Connected
                  </span>
                ) : (
                  <button
                    onClick={() => handleConnect(selectedProvider)}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded"
                  >
                    Connect First
                  </button>
                )}
              </div>

              {providerStates[selectedProvider]?.connected && (
                <>
                  {/* Create Backup */}
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                    <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">
                      Create New Backup
                    </h3>

                    {/* Encryption Options */}
                    <div className="mb-4 space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={encryptionEnabled}
                          onChange={(e) =>
                            setEncryptionEnabled(e.target.checked)
                          }
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
                            onChange={(e) =>
                              setConfirmPassphrase(e.target.value)
                            }
                            placeholder="Confirm passphrase"
                            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                          />
                          <p className="text-xs text-yellow-700 dark:text-yellow-300">
                            ⚠️ If you forget this passphrase, your backup CANNOT
                            be recovered!
                          </p>
                        </div>
                      )}

                      {encryptionEnabled && !usePassphrase && (
                        <p className="ml-6 text-xs text-gray-600 dark:text-gray-400">
                          ℹ️ Encryption key stored locally. Backup can only be
                          restored on this device.
                        </p>
                      )}
                    </div>

                    <ToolCardButton
                      className="w-full"
                      type="button"
                      onClick={handleCreateBackup}
                      disabled={isLoading}
                    >
                      <span>💾</span>
                      {isLoading
                        ? "Creating Backup..."
                        : "Create Encrypted Backup"}
                    </ToolCardButton>
                  </div>

                  {/* Backup List */}
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
                                {formatDate(
                                  backup.createdTime || backup.modified,
                                )}{" "}
                                • {formatSize(backup.size)}
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
                </>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              {/* Encryption Info */}
              <div className="rounded-lg border border-green-300 bg-green-50 p-6 dark:border-green-400/30 dark:bg-gradient-to-r dark:from-green-500/10 dark:to-cyan-500/10">
                <h3 className="mb-3 text-lg font-bold text-green-700 dark:text-green-300">
                  🔐 Military-Grade Encryption
                </h3>
                <div className="space-y-3 text-gray-700 dark:text-gray-300">
                  <p>Your backups are protected with:</p>
                  <ul className="space-y-2 ml-4">
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400">
                        ✓
                      </span>
                      <span>
                        <strong>AES-256-GCM</strong> - Same encryption used by
                        the US military for classified data
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400">
                        ✓
                      </span>
                      <span>
                        <strong>PBKDF2</strong> - 100,000 iterations for
                        passphrase-based keys (OWASP recommended)
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400">
                        ✓
                      </span>
                      <span>
                        <strong>Client-Side Only</strong> - Encryption happens
                        in YOUR browser, never on a server
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400">
                        ✓
                      </span>
                      <span>
                        <strong>Zero Knowledge</strong> - We can&apos;t read
                        your data even if we wanted to
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Crypto API Status */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                <h4 className="mb-3 font-semibold text-gray-900 dark:text-white">
                  Security Status
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 dark:text-gray-300">
                      Web Crypto API
                    </span>
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
                      {location.protocol === "https:"
                        ? "✓ Secure"
                        : "⚠️ Development Mode"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Provider Security Comparison */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                <h4 className="mb-3 font-semibold text-gray-900 dark:text-white">
                  Cloud Provider Security
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
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
                    <tbody>
                      <tr className="border-b border-gray-200 dark:border-gray-700/50">
                        <td className="py-2 text-gray-900 dark:text-white">
                          Google Drive
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
                        <td className="text-center text-yellow-700 dark:text-yellow-400">
                          ~
                        </td>
                        <td className="text-center text-green-600 dark:text-green-400">
                          ✓
                        </td>
                      </tr>
                      <tr className="border-b border-gray-200 dark:border-gray-700/50">
                        <td className="py-2 text-gray-900 dark:text-white">
                          Dropbox
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
                        <td className="text-center text-gray-500">-</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-gray-900 dark:text-white">
                          OneDrive
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
                        <td className="text-center text-green-600 dark:text-green-400">
                          ✓
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                  ~ Google Drive can be HIPAA compliant with Workspace + BAA.
                  Personal accounts are not.
                </p>
              </div>

              {/* HIPAA Compliance Notice */}
              <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-400/30 dark:bg-gradient-to-r dark:from-red-500/10 dark:to-orange-500/10">
                <h4 className="mb-3 flex items-center gap-2 font-semibold text-red-700 dark:text-red-300">
                  ⚕️ HIPAA Compliance Information
                </h4>
                <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                  <p>
                    <strong>
                      Vet-Rate.org does NOT store Protected Health Information
                      (PHI).
                    </strong>{" "}
                    All data remains in your browser&apos;s local storage and/or
                    your personal cloud accounts.
                  </p>
                  <div className="rounded-lg bg-gray-100 p-3 dark:bg-gray-900/50">
                    <p className="mb-2 font-medium text-amber-700 dark:text-amber-300">
                      For HIPAA-eligible cloud storage:
                    </p>
                    <ul className="list-inside list-disc space-y-1 text-xs text-gray-600 dark:text-gray-400">
                      <li>
                        <strong>Google:</strong> Requires Google Workspace +
                        Business Associate Agreement (BAA)
                      </li>
                      <li>
                        <strong>Dropbox:</strong> Dropbox Business with signed
                        BAA
                      </li>
                      <li>
                        <strong>OneDrive:</strong> Microsoft 365
                        Business/Enterprise with BAA
                      </li>
                    </ul>
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-500">
                      Personal/free accounts are NOT HIPAA compliant regardless
                      of provider.
                    </p>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    <strong>Your responsibility:</strong> If you are a
                    healthcare provider or VSO handling veteran PHI, ensure you
                    use appropriate enterprise accounts with signed BAAs.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </ResponsiveModal>

      {/* Passphrase Modal */}
      <ResponsiveModal
        isOpen={showPassphraseModal}
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
    </>
  );
};

export default MultiCloudManager;
