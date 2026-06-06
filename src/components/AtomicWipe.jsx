/**
 * Vet-Rate.org - Atomic Wipe (Panic Button)
 * Copyright (c) 2024-2026 Anthony Johnson
 *
 * AAAAA Design System - "The Panic Button"
 *
 * A single-click feature that immediately clears all local storage,
 * IndexedDB, and cache, restoring the app to a clean state for maximum privacy.
 *
 * Use cases:
 * - User needs to quickly clear sensitive data
 * - Shared/public computer usage
 * - Privacy-conscious data clearing
 */

import React, { useState } from "react";
import { useTheme } from "../contexts/ThemeContext";
import ResponsiveModal from "./common/ResponsiveModal";

export default function AtomicWipe({ compact = false, onWipeComplete }) {
  const { isDark, isTbiComfort } = useTheme();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

  const handleAtomicWipe = async () => {
    setIsWiping(true);

    try {
      // 1. Clear all localStorage
      console.log("🔥 Clearing localStorage...");
      localStorage.clear();

      // 2. Clear all sessionStorage
      console.log("🔥 Clearing sessionStorage...");
      sessionStorage.clear();

      // 3. Clear cookies
      console.log("Clearing cookies...");
      document.cookie.split(";").forEach((c) => {
        const cookieName = c.replace(/^ +/, "").replace(/=.*/, "");
        // Expire cookie with all security attributes to ensure deletion
        document.cookie =
          cookieName +
          "=;expires=" +
          new Date(0).toUTCString() +
          ";path=/;Secure;SameSite=Lax";
      });

      // 4. Clear IndexedDB (Vector Store, AI Models, etc.)
      console.log("🔥 Clearing IndexedDB...");
      if (window.indexedDB) {
        try {
          // Try modern API first
          if (window.indexedDB.databases) {
            const databases = await window.indexedDB.databases();
            const deletePromises = databases.map((db) => {
              if (db.name) {
                console.log(`  Deleting database: ${db.name}`);
                return new Promise((resolve) => {
                  const req = window.indexedDB.deleteDatabase(db.name);
                  req.onsuccess = () => resolve();
                  req.onerror = () => resolve();
                  req.onblocked = () => {
                    console.log(`  Database ${db.name} blocked, forcing...`);
                    setTimeout(resolve, 100);
                  };
                });
              }
            });
            await Promise.all(deletePromises);
          } else {
            // Fallback: delete known database names
            console.log("  Using fallback database deletion...");
            const knownDbs = [
              "vetrate-storage",
              "vetrate-ai-models",
              "vetrate-vectors",
              "voy-vectors",
              "transformers-cache",
              "onnx-models",
              "webllm-cache",
              "vet-rate-cache",
              "keyval-store",
            ];
            const deletePromises = knownDbs.map((dbName) => {
              return new Promise((resolve) => {
                try {
                  const req = window.indexedDB.deleteDatabase(dbName);
                  req.onsuccess = () => {
                    console.log(`  Deleted: ${dbName}`);
                    resolve();
                  };
                  req.onerror = () => resolve();
                  req.onblocked = () => {
                    setTimeout(resolve, 100);
                  };
                } catch (err) {
                  resolve();
                }
              });
            });
            await Promise.all(deletePromises);
          }
        } catch (e) {
          console.error("  IndexedDB cleanup error:", e);
        }
      }

      // 5. Clear Cache Storage (PWA caches)
      console.log("🔥 Clearing Cache Storage...");
      if ("caches" in window) {
        try {
          const cacheNames = await caches.keys();
          const deletePromises = cacheNames.map((cacheName) => {
            console.log(`  Deleting cache: ${cacheName}`);
            return caches.delete(cacheName);
          });
          await Promise.all(deletePromises);
        } catch (e) {
          console.error("  Cache cleanup error:", e);
        }
      }

      // 6. Unregister Service Workers
      console.log("🔥 Unregistering Service Workers...");
      if ("serviceWorker" in navigator) {
        try {
          const registrations =
            await navigator.serviceWorker.getRegistrations();
          const unregisterPromises = registrations.map((registration) => {
            console.log("  Unregistering service worker");
            return registration.unregister();
          });
          await Promise.all(unregisterPromises);
        } catch (e) {
          console.error("  Service worker cleanup error:", e);
        }
      }

      console.log("✅ Atomic Wipe complete!");

      // Notify completion
      if (onWipeComplete) {
        onWipeComplete();
      }

      // Force hard reload with cache bypass
      setTimeout(() => {
        window.location.href =
          window.location.href.split("#")[0] + "?nocache=" + Date.now();
      }, 500);
    } catch (error) {
      console.error("Error during atomic wipe:", error);
      // Still try to reload with cache bypass
      window.location.href =
        window.location.href.split("#")[0] + "?nocache=" + Date.now();
    }
  };

  if (compact) {
    return (
      <>
        <button
          onClick={() => setShowConfirm(true)}
          className={`
            text-xs font-bold uppercase tracking-tight px-2 py-1 rounded border
            ${
              isDark || isTbiComfort
                ? "text-red-400 border-red-800 hover:bg-red-900/30 hover:border-red-600"
                : "text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            }
            focus:outline-none focus:ring-2 focus:ring-red-500
            transition-colors
          `}
          aria-label="Clear all local data"
        >
          🔥 Clear Data
        </button>

        {showConfirm && (
          <ConfirmModal
            isWiping={isWiping}
            onConfirm={handleAtomicWipe}
            onCancel={() => setShowConfirm(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className={`
          flex items-center gap-2 px-4 py-3 rounded-xl font-bold min-h-touch
          ${
            isDark || isTbiComfort
              ? "bg-red-900/30 border border-red-800 text-red-400 hover:bg-red-900/50 hover:border-red-600"
              : "bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 hover:border-red-300"
          }
          focus:outline-none focus:ring-3 focus:ring-red-500 focus:ring-offset-2
          transition-colors
        `}
        aria-label="Clear all local data"
      >
        <span className="text-xl">🔥</span>
        <div className="text-left">
          <span className="block text-sm font-bold">Atomic Wipe</span>
          <span
            className={`block text-xs ${isDark || isTbiComfort ? "text-red-400" : "text-red-500"}`}
          >
            Clear All Local Data
          </span>
        </div>
      </button>

      {showConfirm && (
        <ConfirmModal
          isDark={isDark || isTbiComfort}
          isWiping={isWiping}
          onConfirm={handleAtomicWipe}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
}

function ConfirmModal({ isWiping, onConfirm, onCancel }) {
  return (
    <ResponsiveModal
      isOpen
      onClose={onCancel}
      dismissable={false}
      size="sm"
      zIndex={100}
      labelledBy="atomic-wipe-title"
      header={
        <div className="p-6 bg-red-50 dark:bg-red-900/30 border-b border-red-100 dark:border-red-900">
          <div className="flex items-center gap-4">
            <span className="text-4xl">⚠️</span>
            <div>
              <h2
                id="atomic-wipe-title"
                className="text-xl font-black text-red-700 dark:text-red-400"
              >
                ATOMIC WIPE
              </h2>
              <p className="text-sm text-red-600 dark:text-red-300/70">
                This action cannot be undone
              </p>
            </div>
          </div>
        </div>
      }
      footer={
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isWiping}
            className="flex-1 px-4 py-3 rounded-xl font-medium min-h-touch bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 dark:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isWiping}
            className="flex-1 px-4 py-3 rounded-xl font-bold min-h-touch bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-3 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isWiping ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Wiping...
              </span>
            ) : (
              "🔥 Confirm Wipe"
            )}
          </button>
        </div>
      }
    >
      <p className="text-sm text-slate-700 dark:text-gray-300 mb-4">
        This will permanently delete:
      </p>

      <ul className="text-sm text-slate-600 dark:text-gray-400 space-y-2 mb-6">
        <li className="flex items-center gap-2">
          <span className="text-red-500">✗</span>
          All saved conditions and claims data
        </li>
        <li className="flex items-center gap-2">
          <span className="text-red-500">✗</span>
          Local AI models and vector databases
        </li>
        <li className="flex items-center gap-2">
          <span className="text-red-500">✗</span>
          All preferences and settings
        </li>
        <li className="flex items-center gap-2">
          <span className="text-red-500">✗</span>
          Cached files and offline data
        </li>
      </ul>

      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/30 dark:border-amber-800">
        <p className="text-xs text-amber-700 dark:text-amber-300">
          <strong>Note:</strong> If you want to keep your data, use "Export
          Backup" in The Bunker first.
        </p>
      </div>
    </ResponsiveModal>
  );
}

/**
 * Privacy Notice for The Bunker
 */
export function BunkerPrivacyNotice() {
  const { isDark, isTbiComfort } = useTheme();

  return (
    <div
      className={`
      p-4 rounded-xl border
      ${isDark || isTbiComfort ? "bg-gray-800/50 border-gray-700" : "bg-slate-50 border-slate-200"}
    `}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">🔒</span>
        <div>
          <h3
            className={`font-bold ${isDark || isTbiComfort ? "text-white" : "text-slate-900"}`}
          >
            Security Protocol
          </h3>
          <p
            className={`text-sm ${isDark || isTbiComfort ? "text-gray-400" : "text-slate-600"} mt-1`}
          >
            Your data is currently stored in your browser's local sandbox.
            Exporting a backup creates a private file on your computer.
            Vet-Rate.org never sees, stores, or transmits this data.
          </p>
        </div>
      </div>
    </div>
  );
}
