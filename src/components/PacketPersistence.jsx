/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Unauthorized copying, use, or distribution is strictly prohibited.
 *
 * PacketPersistence Component
 *
 * UI component that handles:
 * - "Save My Packet" button (creates file on user's device)
 * - "Resume Packet" button (loads existing file)
 * - Auto-save status indicator
 * - Unsaved changes warning
 * - Mobile download prompt
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import {
  initPersistentStorage,
  openExistingPacket,
  manualSave,
  downloadPacketFile,
  loadFromUploadedFile,
  gatherPacketData,
  restorePacketData,
  addSaveListener,
  supportsFileSystemAccess,
  isMobileDevice,
  isTabletDevice,
  isMobilePhone,
  checkHasUnsavedChanges,
  getOrientationInfo,
} from "../utils/persistentStorage";

// ============================================================================
// SAVE INDICATOR COMPONENT
// ============================================================================

const SaveIndicator = ({ status, lastSaved }) => {
  const getStatusDisplay = () => {
    switch (status) {
      case "saving":
        return {
          icon: "💾",
          text: "Saving...",
          color: "text-blue-600 dark:text-blue-400",
        };
      case "saved":
        return {
          icon: "✅",
          text: "Saved",
          color: "text-green-600 dark:text-green-400",
        };
      case "unsaved":
        return {
          icon: "⚠️",
          text: "Unsaved changes",
          color: "text-amber-600 dark:text-amber-400",
        };
      case "error":
        return {
          icon: "❌",
          text: "Save failed",
          color: "text-red-600 dark:text-red-400",
        };
      default:
        return {
          icon: "💾",
          text: "Ready",
          color: "text-gray-500 dark:text-gray-400",
        };
    }
  };

  const { icon, text, color } = getStatusDisplay();
  const timeAgo = lastSaved ? getTimeAgo(lastSaved) : null;

  return (
    <div className={`flex items-center gap-2 text-sm ${color}`}>
      <span className="text-lg">{icon}</span>
      <span className="font-medium">{text}</span>
      {timeAgo && status === "saved" && (
        <span className="text-xs text-gray-400">({timeAgo})</span>
      )}
    </div>
  );
};

function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function _storageStrategyTitle(storageInfo) {
  if (storageInfo?.supportsFileSystem && !storageInfo?.isPhone) {
    return "💾 File System Storage";
  }
  if (storageInfo?.isTablet) return "📱💻 Tablet Storage + Easy Backups";
  return "📱 Browser Storage + Downloads";
}

function _storageStrategyDescription(storageInfo) {
  if (storageInfo?.supportsFileSystem && !storageInfo?.isPhone) {
    return 'Click "Save My Packet" to create a file on your device. Your data will auto-save to this file as you work - even if you clear your browser cache or crash, your file is safe!';
  }
  if (storageInfo?.isTablet) {
    return "Great choice using a tablet! Your data saves automatically in your browser. For extra protection, download backups to your Files app or cloud storage (iCloud, Google Drive, Dropbox).";
  }
  return 'Your data is saved in your browser. Use "Download Backup" before closing to ensure your data is safe from cache clears.';
}

export default function PacketPersistence({
  onPacketLoaded,
  onSaveComplete,
  // eslint-disable-next-line no-unused-vars
  showFloatingIndicator: _showFloatingIndicator = true,
  compact = false,
}) {
  const { t: _t } = useLanguage();
  const [initialized, setInitialized] = useState(false);
  const [saveStatus, setSaveStatus] = useState("ready");
  const [lastSaved, setLastSaved] = useState(null);
  const [storageInfo, setStorageInfo] = useState(null);
  const [_showMobilePrompt, setShowMobilePrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);

  // Initialize persistent storage on mount
  useEffect(() => {
    async function init() {
      try {
        const result = await initPersistentStorage();
        const orientation = getOrientationInfo();

        setStorageInfo({
          strategy: result.strategy,
          hasFileHandle: false,
          isMobile: isMobileDevice(),
          isTablet: isTabletDevice(),
          isPhone: isMobilePhone(),
          supportsFileSystem: supportsFileSystemAccess(),
          orientation: orientation,
        });

        if (result.hasUnsavedChanges) {
          setSaveStatus("unsaved");
        }

        setInitialized(true);
      } catch (err) {
        console.error("Failed to initialize persistent storage:", err);
        setError("Failed to initialize storage system");
      }
    }

    init();

    // Listen for orientation changes
    const handleOrientationChange = () => {
      setStorageInfo((prev) => ({
        ...prev,
        orientation: getOrientationInfo(),
      }));
    };

    window.addEventListener("resize", handleOrientationChange);
    window.addEventListener("orientationchange", handleOrientationChange);

    return () => {
      window.removeEventListener("resize", handleOrientationChange);
      window.removeEventListener("orientationchange", handleOrientationChange);
    };
  }, []);

  // Listen for save events
  useEffect(() => {
    const unsubscribe = addSaveListener((eventType, data) => {
      switch (eventType) {
        case "saving":
          setSaveStatus("saving");
          break;
        case "saved":
        case "downloaded":
        case "file-created":
          setSaveStatus("saved");
          setLastSaved(Date.now());
          setStorageInfo((prev) => ({ ...prev, hasFileHandle: true }));
          onSaveComplete?.(data);
          break;
        case "save-error":
          setSaveStatus("error");
          setError("Save failed - data backed up to browser");
          break;
        case "loaded":
        case "restored":
          setSaveStatus("saved");
          setLastSaved(Date.now());
          onPacketLoaded?.(data);
          break;
      }
    });

    return unsubscribe;
  }, [onPacketLoaded, onSaveComplete]);

  // Track unsaved changes
  useEffect(() => {
    const interval = setInterval(() => {
      if (checkHasUnsavedChanges() && saveStatus !== "saving") {
        setSaveStatus("unsaved");
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [saveStatus]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleSavePacket = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSaveStatus("saving");

    try {
      const success = await manualSave();
      if (success) {
        setSaveStatus("saved");
        setLastSaved(Date.now());
      }
    } catch (err) {
      console.error("Save error:", err);
      setError("Failed to save packet");
      setSaveStatus("error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDownloadPacket = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await gatherPacketData();
      downloadPacketFile(data);
      setSaveStatus("saved");
      setLastSaved(Date.now());
      setShowMobilePrompt(false);
    } catch (err) {
      console.error("Download error:", err);
      setError("Failed to download packet");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleResumePacket = useCallback(async () => {
    if (supportsFileSystemAccess()) {
      // Desktop: Use File System Access API
      setIsLoading(true);
      setError(null);

      try {
        const data = await openExistingPacket();
        if (data) {
          await restorePacketData(data);
          onPacketLoaded?.(data);
        }
      } catch (err) {
        if (err.message !== "User cancelled file selection") {
          console.error("Resume error:", err);
          setError("Failed to load packet file");
        }
      } finally {
        setIsLoading(false);
      }
    } else {
      // Mobile: Trigger file input
      fileInputRef.current?.click();
    }
  }, [onPacketLoaded]);

  const handleFileUpload = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setIsLoading(true);
      setError(null);

      try {
        const data = await loadFromUploadedFile(file);
        await restorePacketData(data);
        onPacketLoaded?.(data);
        setSaveStatus("saved");
        setLastSaved(Date.now());
      } catch (err) {
        console.error("File upload error:", err);
        setError("Invalid packet file");
      } finally {
        setIsLoading(false);
        event.target.value = ""; // Reset input
      }
    },
    [onPacketLoaded],
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!initialized) {
    return (
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
        <span className="text-sm">Initializing storage...</span>
      </div>
    );
  }

  // Compact mode for headers/toolbars
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <SaveIndicator status={saveStatus} lastSaved={lastSaved} />

        <button
          onClick={handleSavePacket}
          disabled={isLoading}
          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
          aria-label="Save packet to your device"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
            />
          </svg>
          Save
        </button>

        {/* Hidden file input for mobile */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>
    );
  }

  // Full panel mode
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-2xl">🛡️</span>
            Packet Protection
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {storageInfo?.isMobile
              ? "Your data is safe in your browser. Download backups regularly!"
              : "Your data is saved directly to your device - crash and cache proof!"}
          </p>
        </div>
        <SaveIndicator status={saveStatus} lastSaved={lastSaved} />
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
          <span>⚠️</span>
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-auto hover:text-red-900"
          >
            ✕
          </button>
        </div>
      )}

      {/* Storage Strategy Info */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <h3 className="font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2 mb-2">
          {_storageStrategyTitle(storageInfo)}
        </h3>
        <p className="text-sm text-blue-800 dark:text-blue-300">
          {_storageStrategyDescription(storageInfo)}
        </p>
        {storageInfo?.isTablet && (
          <div className="mt-3 text-xs text-blue-700 dark:text-blue-400 flex items-center gap-2">
            <span>💡</span>
            <span>
              Tip:{" "}
              {storageInfo?.orientation?.isLandscape
                ? "Landscape mode - perfect for detailed work!"
                : "Rotate to landscape for more workspace"}
            </span>
          </div>
        )}
      </div>

      {/* Main Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Save Button */}
        <button
          onClick={handleSavePacket}
          disabled={isLoading}
          className="flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl font-semibold transition-all disabled:opacity-50 shadow-lg hover:shadow-xl"
        >
          {isLoading ? (
            <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
              />
            </svg>
          )}
          <div className="text-left">
            <div className="text-lg">💾 Save My Packet</div>
            <div className="text-xs opacity-80">
              {storageInfo?.supportsFileSystem
                ? "Save to your device"
                : "Download backup file"}
            </div>
          </div>
        </button>

        {/* Resume Button */}
        <button
          onClick={handleResumePacket}
          disabled={isLoading}
          className="flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-semibold transition-all disabled:opacity-50 shadow-lg hover:shadow-xl"
        >
          {isLoading ? (
            <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
          )}
          <div className="text-left">
            <div className="text-lg">📂 Resume Packet</div>
            <div className="text-xs opacity-80">Load from existing file</div>
          </div>
        </button>
      </div>

      {/* Mobile/Tablet Download Reminder */}
      {(storageInfo?.isMobile || storageInfo?.isTablet) &&
        saveStatus === "unsaved" && (
          <div
            className={`p-4 border rounded-lg ${
              storageInfo?.isTablet
                ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700"
                : "bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">
                {storageInfo?.isTablet ? "📲" : "⚠️"}
              </span>
              <div className="flex-1">
                <h4
                  className={`font-semibold ${
                    storageInfo?.isTablet
                      ? "text-blue-900 dark:text-blue-200"
                      : "text-amber-900 dark:text-amber-200"
                  }`}
                >
                  {storageInfo?.isTablet
                    ? "Save Your Progress!"
                    : "Don't Lose Your Progress!"}
                </h4>
                <p
                  className={`text-sm mt-1 ${
                    storageInfo?.isTablet
                      ? "text-blue-800 dark:text-blue-300"
                      : "text-amber-800 dark:text-amber-300"
                  }`}
                >
                  {storageInfo?.isTablet
                    ? "Download a backup to your Files app or cloud storage. You can easily restore your packet later!"
                    : "You have unsaved changes. On mobile, clearing your browser data will erase your work. Download a backup now to keep your packet safe!"}
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleDownloadPacket}
                    className={`px-4 py-2 text-white rounded-lg font-medium text-sm ${
                      storageInfo?.isTablet
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-amber-600 hover:bg-amber-700"
                    }`}
                  >
                    📥 Download Backup Now
                  </button>
                  {storageInfo?.isTablet && (
                    <button
                      onClick={() => {
                        // Provide instructions for saving to cloud
                        alert(
                          "After downloading, you can:\n\n📁 Save to Files app\n☁️ Upload to iCloud/Google Drive/Dropbox\n📧 Email to yourself\n\nThis ensures your data is safe even if you clear browser data!",
                        );
                      }}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium text-sm"
                    >
                      ℹ️ Storage Tips
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      {/* How It Works */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
          🔒 Your Data Stays With You
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="font-medium text-gray-900 dark:text-white mb-1">
              💻 On Computer
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Click &quot;Save Packet&quot; once, then we auto-save to your file
              as you type
            </p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="font-medium text-gray-900 dark:text-white mb-1">
              📱 On Phone/Tablet
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              We save to your browser. Download backups to Files app or cloud
              storage
            </p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="font-medium text-gray-900 dark:text-white mb-1">
              🔄 Coming Back?
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Click &quot;Resume Packet&quot; to pick up exactly where you left
              off
            </p>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
}

// ============================================================================
// FLOATING SAVE BUTTON (For bottom of screen)
// ============================================================================

export function FloatingSaveButton({ onSave }) {
  const [saveStatus, setSaveStatus] = useState("ready");
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    const unsubscribe = addSaveListener((eventType) => {
      if (eventType === "saving") setSaveStatus("saving");
      else if (eventType === "saved" || eventType === "downloaded")
        setSaveStatus("saved");
      else if (eventType === "save-error") setSaveStatus("error");
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (checkHasUnsavedChanges()) {
        setSaveStatus("unsaved");
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleClick = async () => {
    setSaveStatus("saving");
    await manualSave();
    onSave?.();
  };

  const statusColors = {
    ready: "bg-gray-600 hover:bg-gray-700",
    saving: "bg-blue-600",
    saved: "bg-green-600 hover:bg-green-700",
    unsaved: "bg-amber-600 hover:bg-amber-700 animate-pulse",
    error: "bg-red-600 hover:bg-red-700",
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        disabled={saveStatus === "saving"}
        className={`${statusColors[saveStatus]} text-white p-4 rounded-full shadow-lg transition-all transform hover:scale-105 disabled:opacity-75`}
      >
        {saveStatus === "saving" ? (
          <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" />
        ) : (
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
            />
          </svg>
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap">
          {saveStatus === "unsaved"
            ? "Click to save your packet!"
            : "Save My Packet"}
          <div className="absolute top-full right-4 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MOBILE SAVE REMINDER BANNER
// ============================================================================

export function MobileSaveReminder({ onDismiss }) {
  const [visible, setVisible] = useState(false);
  const [_hasUnsaved, setHasUnsaved] = useState(false);

  useEffect(() => {
    // Only show on mobile with unsaved changes
    if (isMobileDevice()) {
      const interval = setInterval(() => {
        if (checkHasUnsavedChanges()) {
          setHasUnsaved(true);
          setVisible(true);
        }
      }, 30000); // Check every 30 seconds

      return () => clearInterval(interval);
    }
  }, []);

  const handleDownload = async () => {
    const data = await gatherPacketData();
    downloadPacketFile(data);
    setVisible(false);
    onDismiss?.();
  };

  const handleDismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  if (!visible || !isMobileDevice()) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-4 bg-amber-500 text-white shadow-lg">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <div className="font-semibold">Unsaved Changes</div>
            <div className="text-sm opacity-90">
              Download a backup to keep your data safe
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-white text-amber-600 rounded-lg font-semibold text-sm"
          >
            📥 Download
          </button>
          <button
            onClick={handleDismiss}
            className="p-2 hover:bg-amber-600 rounded-lg"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
