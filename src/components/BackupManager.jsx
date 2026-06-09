/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * Backup Manager - "The Bunker"
 * Complete data export/import system with drag-and-drop
 * Prevents catastrophic data loss from cache clearing
 */

import { useState, useRef, useEffect } from "react";
import ResponsiveModal from "./common/ResponsiveModal";
import { useLanguage } from "../contexts/LanguageContext";
import {
  exportData,
  downloadBackup,
  importData,
  parseBackupFile,
  validateBackup,
  getStorageStats,
  clearAllData,
} from "../utils/dataBackup";
import { markBackupCreated } from "../utils/dataPersistence";
import { downloadDossier, previewDossier } from "../utils/dossierExport";
import CloudSyncManager from "./CloudSyncManager";
import AtomicWipe from "./AtomicWipe";
import DbqBrowser from "./DbqBrowser";
import { getCacheStats } from "../utils/dbqOfflineStorage";

export default function BackupManager({ onClose }) {
  const { _t } = useLanguage();

  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success'|'error'|'info', message: '', details: {} }
  const [showStats, setShowStats] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [showDbqBrowser, setShowDbqBrowser] = useState(false);
  const [dbqCacheStats, setDbqCacheStats] = useState(null);

  // Load DBQ cache stats on mount
  useEffect(() => {
    const loadDbqStats = async () => {
      try {
        const stats = await getCacheStats();
        setDbqCacheStats(stats);
      } catch (e) {
        console.error("Error loading DBQ stats:", e);
      }
    };
    loadDbqStats();
  }, []);
  const [showCloudSync, setShowCloudSync] = useState(false);
  const [importMode, setImportMode] = useState("replace"); // 'replace' or 'merge'
  const fileInputRef = useRef(null);

  // Handle export
  const handleExport = async () => {
    try {
      setStatus({ type: "info", message: "Preparing backup..." });

      const backup = exportData();
      downloadBackup(backup);

      // Mark that a backup was created to stop pulse animation
      markBackupCreated();

      setStatus({
        type: "success",
        message: "✅ Backup downloaded successfully!",
        details: {
          keys: backup.metadata.totalKeys,
          date: new Date().toLocaleDateString(),
        },
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: "❌ Export failed: " + error.message,
      });
    }
  };

  // Handle file selection
  const handleFileSelect = async (file) => {
    try {
      setStatus({ type: "info", message: "Reading backup file..." });

      const backup = await parseBackupFile(file);
      const validation = validateBackup(backup);

      if (!validation.success) {
        setStatus({
          type: "error",
          message: "❌ " + validation.message,
        });
        return;
      }

      setStatus({ type: "info", message: "Importing data..." });

      const result = importData(backup, importMode === "merge");

      if (result.success) {
        setStatus({
          type: "success",
          message: "✅ " + result.message,
          details: {
            imported: result.importedKeys,
            skipped: result.skippedKeys,
            exportDate: new Date(result.exportDate).toLocaleDateString(),
          },
        });

        // Reload after 2 seconds to apply changes
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setStatus({
          type: "error",
          message: "❌ " + result.message,
        });
      }
    } catch (error) {
      setStatus({
        type: "error",
        message: "❌ Import failed: " + error.message,
      });
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === "application/json" || file.name.endsWith(".json")) {
        handleFileSelect(file);
      } else {
        setStatus({
          type: "error",
          message: "❌ Please drop in a valid JSON backup file.",
        });
      }
    }
  };

  // File input change handler
  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Clear all data
  const handleClearData = () => {
    const cleared = clearAllData();
    setShowConfirmClear(false);
    setStatus({
      type: "success",
      message: `✅ Cleared ${cleared} data items. Page will reload.`,
    });
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  };

  // View storage stats
  const handleViewStats = () => {
    const stats = getStorageStats();
    setShowStats(stats);
  };

  return (
    <>
      <ResponsiveModal
        isOpen
        onClose={onClose}
        size="xl"
        labelledBy="backup-manager-title"
        header={
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6">
            <div className="flex justify-between items-start">
              <div>
                <h2
                  id="backup-manager-title"
                  className="text-3xl font-bold mb-2"
                >
                  🏰 The Bunker{" "}
                  <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded align-middle">
                    BETA
                  </span>
                </h2>
                <p className="text-blue-100">
                  Your data is YOURS. Never lose it again.
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 text-2xl font-bold"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Status Message */}
          {status && (
            <div
              className={`p-4 rounded-lg ${
                status.type === "success"
                  ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                  : status.type === "error"
                    ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                    : "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
              }`}
            >
              <p className="font-semibold">{status.message}</p>
              {status.details && (
                <div className="mt-2 text-sm space-y-1">
                  {Object.entries(status.details).map(([key, value]) => (
                    <p key={key}>
                      <span className="font-medium capitalize">{key}:</span>{" "}
                      {value}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Cloud Sync Section - "The Off-Site Bunker" */}
          <div className="border-2 border-blue-400 dark:border-blue-600 rounded-lg p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                  ☁️ Google Drive Sync
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  <strong>Encrypted backup to YOUR Google Drive.</strong> We
                  never see your data.
                </p>
              </div>
              <button
                onClick={() => setShowCloudSync(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors shadow-lg flex items-center gap-2"
              >
                <span>☁️</span> Connect Drive
              </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mt-4">
              <h4 className="font-semibold text-gray-800 dark:text-white mb-2">
                Why Cloud Sync?
              </h4>
              <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                <li>
                  🔐 <strong>Your Cloud, Your Keys:</strong> Data goes to YOUR
                  Google Drive, not ours
                </li>
                <li>
                  🔄 <strong>Auto-Backup:</strong> Never lose progress again
                  (computer crashes, cache clears)
                </li>
                <li>
                  📱 <strong>Cross-Device:</strong> Start on desktop, continue
                  on mobile
                </li>
                <li>
                  🏠 <strong>Always Available:</strong> Access your claims from
                  anywhere
                </li>
                <li>
                  🆓 <strong>Free Storage:</strong> 15GB free with every Google
                  account
                </li>
              </ul>
            </div>
          </div>

          {/* Export Section */}
          <div className="border-2 border-green-300 dark:border-green-700 rounded-lg p-6 bg-green-50 dark:bg-green-900/20">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                  📦 Export Your Data
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Download a complete backup of all your claims, forms, and
                  settings.
                </p>
              </div>
              <button
                onClick={handleExport}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors shadow-lg"
              >
                Download Backup
              </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mt-4">
              <h4 className="font-semibold text-gray-800 dark:text-white mb-2">
                What&apos;s Included:
              </h4>
              <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                <li>✓ All saved claims and statements</li>
                <li>✓ Veteran profile and form data</li>
                <li>✓ Ratings and secondary conditions</li>
                <li>✓ App settings and preferences</li>
              </ul>
            </div>
          </div>

          {/* Dossier Export Section - "The Bus Factor" */}
          <div className="border-2 border-purple-300 dark:border-purple-700 rounded-lg p-6 bg-purple-50 dark:bg-purple-900/20">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                  📋 Download Full Dossier (HTML)
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Export everything as a readable report you can open anywhere,
                  forever.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const result = previewDossier();
                    if (!result.success) {
                      setStatus({
                        type: "error",
                        message: "❌ Preview failed: " + result.error,
                      });
                    }
                  }}
                  className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Preview
                </button>
                <button
                  onClick={() => {
                    const result = downloadDossier();
                    if (result.success) {
                      setStatus({
                        type: "success",
                        message: "✅ Dossier downloaded: " + result.filename,
                      });
                    } else {
                      setStatus({
                        type: "error",
                        message: "❌ Export failed: " + result.error,
                      });
                    }
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors shadow-lg"
                >
                  Download Dossier
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mt-4">
              <h4 className="font-semibold text-gray-800 dark:text-white mb-2">
                Why Use This?
              </h4>
              <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                <li>
                  📄 <strong>Human Readable:</strong> Formatted report, not
                  technical JSON
                </li>
                <li>
                  🌐 <strong>Works Offline:</strong> Opens in any browser
                  without internet
                </li>
                <li>
                  🏛️ <strong>VSO Ready:</strong> Share with your Veterans
                  Service Officer
                </li>
                <li>
                  ♿ <strong>Printable:</strong> Print directly from your
                  browser
                </li>
                <li>
                  🔒 <strong>You Own It:</strong> Your data, independent of
                  Vet-Rate
                </li>
              </ul>
            </div>
          </div>

          {/* DBQ Library Section - Offline Forms */}
          <div className="border-2 border-indigo-300 dark:border-indigo-700 rounded-lg p-6 bg-indigo-50 dark:bg-indigo-900/20">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                  📋 DBQ Library (Offline Forms)
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Download Disability Benefits Questionnaires for offline
                  access. Pre-fill your information before doctor visits.
                </p>
              </div>
              <button
                onClick={() => setShowDbqBrowser(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors shadow-lg flex items-center gap-2"
              >
                <span>📋</span> Open Library
              </button>
            </div>

            {/* DBQ Cache Stats */}
            {dbqCacheStats && (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4 flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">💾</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">
                      {dbqCacheStats.cachedCount} forms
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      saved offline
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📦</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">
                      {dbqCacheStats.totalSizeMB} MB
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      storage used
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 dark:text-white mb-2">
                Features:
              </h4>
              <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                <li>
                  📱 <strong>Works Offline:</strong> Access forms without
                  internet
                </li>
                <li>
                  ✏️ <strong>Pre-Fill Drafts:</strong> Enter subjective info
                  before appointments
                </li>
                <li>
                  🔐 <strong>Secure Sharing:</strong> Download, encrypt, or
                  AirDrop to doctor
                </li>
                <li>
                  📋 <strong>69+ DBQs:</strong> All official VA questionnaires
                  available
                </li>
                <li>
                  ⚠️ <strong>Draft Watermarks:</strong> All pre-filled docs
                  clearly marked
                </li>
              </ul>
            </div>
          </div>

          {/* Import Section */}
          <div className="border-2 border-blue-300 dark:border-blue-700 rounded-lg p-6 bg-blue-50 dark:bg-blue-900/20">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
              📥 Import Backup
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Restore your data from a backup file (works on any device).
            </p>

            {/* Import Mode Selection */}
            <div className="mb-4 space-y-2">
              {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
              <label className="font-semibold text-gray-700 dark:text-gray-300">
                Import Mode:
              </label>
              <div className="flex gap-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    value="replace"
                    checked={importMode === "replace"}
                    onChange={(e) => setImportMode(e.target.value)}
                    className="mr-2"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    Replace (Overwrite all existing data)
                  </span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    value="merge"
                    checked={importMode === "merge"}
                    onChange={(e) => setImportMode(e.target.value)}
                    className="mr-2"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    Merge (Keep existing, add new)
                  </span>
                </label>
              </div>
            </div>

            {/* Drag and Drop Zone */}
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-4 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-blue-600 bg-blue-100 dark:bg-blue-900/40"
                  : "border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500"
              }`}
            >
              <div className="text-5xl mb-3">📂</div>
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {isDragging
                  ? "Drop your backup file here!"
                  : "Drag & Drop backup file here"}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                or click to browse (.json files only)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Utilities Section */}
          <div className="border-2 border-gray-300 dark:border-gray-600 rounded-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
              🔧 Utilities
            </h3>

            <div className="flex gap-4 flex-wrap">
              <button
                onClick={handleViewStats}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                View Storage Stats
              </button>

              <button
                onClick={() => setShowConfirmClear(true)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Clear All Data
              </button>

              <AtomicWipe compact />
            </div>

            {/* Storage Stats Display */}
            {showStats && (
              <div className="mt-4 bg-gray-100 dark:bg-gray-900 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 dark:text-white mb-3">
                  Storage Statistics:
                </h4>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Total Keys:
                    </p>
                    <p className="text-lg font-bold text-gray-800 dark:text-white">
                      {showStats.totalKeys}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Total Size:
                    </p>
                    <p className="text-lg font-bold text-gray-800 dark:text-white">
                      {showStats.totalSizeKB} KB
                    </p>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto">
                  <h5 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">
                    Breakdown by Key:
                  </h5>
                  <div className="space-y-1">
                    {showStats.keys.map((item) => (
                      <div
                        key={item.key}
                        className="flex justify-between text-xs text-gray-600 dark:text-gray-400"
                      >
                        <span className="truncate flex-1">{item.key}</span>
                        <span className="font-mono ml-2">{item.sizeKB} KB</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setShowStats(false)}
                  className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Close Stats
                </button>
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 rounded">
            <h4 className="font-bold text-yellow-800 dark:text-yellow-300 mb-2">
              💡 Pro Tips:
            </h4>
            <ul className="space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
              <li>• Export your data regularly (weekly recommended)</li>
              <li>
                • Store backups in cloud storage (Dropbox, Google Drive, etc.)
              </li>
              <li>• You can transfer backups between computers and browsers</li>
              <li>
                • Your backup file is plain JSON - you can inspect it in any
                text editor
              </li>
            </ul>
          </div>
        </div>
      </ResponsiveModal>

      {/* Confirm Clear Dialog */}
      {showConfirmClear && (
        <ResponsiveModal
          isOpen
          onClose={() => setShowConfirmClear(false)}
          size="sm"
          zIndex={70}
          labelledBy="backup-clear-title"
          footer={
            <div className="flex gap-4">
              <button
                onClick={() => setShowConfirmClear(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearData}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
              >
                Yes, Clear Everything
              </button>
            </div>
          }
        >
          <h3
            id="backup-clear-title"
            className="text-xl font-bold text-red-600 dark:text-red-400 mb-4"
          >
            ⚠️ Clear All Data?
          </h3>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            This will permanently delete ALL your data from this browser. This
            cannot be undone.
          </p>
          <p className="text-gray-700 dark:text-gray-300 font-semibold">
            Make sure you have exported a backup first!
          </p>
        </ResponsiveModal>
      )}

      {/* Cloud Sync Modal */}
      {showCloudSync && (
        <CloudSyncManager onClose={() => setShowCloudSync(false)} />
      )}

      {/* DBQ Browser Modal */}
      {showDbqBrowser && (
        <DbqBrowser
          onClose={async () => {
            setShowDbqBrowser(false);
            // Refresh DBQ cache stats when closing
            try {
              const stats = await getCacheStats();
              setDbqCacheStats(stats);
            } catch (e) {
              console.error("Error refreshing DBQ stats:", e);
            }
          }}
        />
      )}
    </>
  );
}
