/**
 * Vet-Rate.org - Device Passphrase Keystore Panel
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * "THE KEY VAULT" — opt-in device-passphrase custody for the encryption keys
 * this browser stores for passphrase-less cloud backups (S16, commit G).
 *
 * Honest scope (see docs/audit/S16_ROTATION_DEAUTH_DESIGN.md §2-3):
 * - Enable / unlock / lock / change passphrase re-protect keys AT REST going
 *   forward. They do not retroactively un-leak a key already exfiltrated.
 * - "Deauthorize this device" is a real, cryptographically-enforced wipe of THIS
 *   browser's key material plus provider sign-out. It cannot reach other devices,
 *   delete files already in the user's cloud, or recall already-synced backups.
 * - The recovery bundle is user-held and passphrase-protected; we never keep a
 *   copy and it is not escrow.
 */

import { useState } from "react";
import {
  isDevicePassphraseEnabled,
  isKeystoreUnlocked,
  enableDevicePassphrase,
  unlockDeviceKeystore,
  lockDeviceKeystore,
  rotateDevicePassphrase,
  wipeLocalKeystore,
  listBackupKeyIds,
  exportRecoveryBundle,
  importRecoveryBundle,
} from "../utils/cloudEncryption";

const MIN_PASSPHRASE = 8;
const DEAUTH_CONFIRM_WORD = "DEAUTHORIZE";

const inputClass =
  "w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white";
const cardClass =
  "rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800";

const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");

const downloadJson = (filename, obj) => {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const DeviceKeystorePanel = ({ onDeauthorize }) => {
  // Snapshot of the module-level keystore state, refreshed after each action.
  const [enabled, setEnabled] = useState(isDevicePassphraseEnabled());
  const [unlocked, setUnlocked] = useState(isKeystoreUnlocked());
  const [keyIds, setKeyIds] = useState(() => listBackupKeyIds());

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [unlockPass, setUnlockPass] = useState("");
  const [rotatePass, setRotatePass] = useState("");
  const [rotateConfirm, setRotateConfirm] = useState("");

  const [showDeauth, setShowDeauth] = useState(false);
  const [deauthText, setDeauthText] = useState("");

  const refresh = () => {
    setEnabled(isDevicePassphraseEnabled());
    setUnlocked(isKeystoreUnlocked());
    setKeyIds(listBackupKeyIds());
  };

  // Shared busy/error/refresh wrapper. The action returns a success message (or
  // nothing); a thrown error becomes the visible error and stops the action.
  const run = async (fn) => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const out = await fn();
      refresh();
      if (out) setMsg(out);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleEnable = () =>
    run(async () => {
      if (newPass.length < MIN_PASSPHRASE) {
        throw new Error(
          `Passphrase must be at least ${MIN_PASSPHRASE} characters.`,
        );
      }
      if (newPass !== confirmPass) throw new Error("Passphrases do not match.");
      await enableDevicePassphrase(newPass);
      setNewPass("");
      setConfirmPass("");
      return "Device passphrase enabled. Your saved backup keys are now protected at rest.";
    });

  const handleUnlock = () =>
    run(async () => {
      await unlockDeviceKeystore(unlockPass);
      setUnlockPass("");
      return "Keystore unlocked for this session.";
    });

  const handleLock = () =>
    run(async () => {
      lockDeviceKeystore();
      return "Keystore locked.";
    });

  const handleRotate = () =>
    run(async () => {
      if (rotatePass.length < MIN_PASSPHRASE) {
        throw new Error(
          `Passphrase must be at least ${MIN_PASSPHRASE} characters.`,
        );
      }
      if (rotatePass !== rotateConfirm) {
        throw new Error("Passphrases do not match.");
      }
      await rotateDevicePassphrase(rotatePass);
      setRotatePass("");
      setRotateConfirm("");
      return "Device passphrase changed. Every saved key was re-protected under the new passphrase.";
    });

  const handleExport = () =>
    run(async () => {
      const bundle = await exportRecoveryBundle();
      downloadJson(`vetrate-keystore-recovery-${stamp()}.json`, bundle);
      return "Recovery bundle downloaded. Keep it safe — it is protected by your device passphrase, and we never hold a copy.";
    });

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so re-picking the same file fires onChange
    if (!file) return;
    run(async () => {
      const text = await file.text();
      let bundle;
      try {
        bundle = JSON.parse(text);
      } catch {
        throw new Error("That file is not valid JSON.");
      }
      const n = await importRecoveryBundle(bundle);
      return `Imported ${n} key(s). Unlock with the bundle's device passphrase to use them.`;
    });
  };

  const handleDeauthorize = () =>
    run(async () => {
      if (deauthText.trim().toUpperCase() !== DEAUTH_CONFIRM_WORD) {
        throw new Error(`Type ${DEAUTH_CONFIRM_WORD} to confirm.`);
      }
      const removed = wipeLocalKeystore();
      if (onDeauthorize) await onDeauthorize();
      setShowDeauth(false);
      setDeauthText("");
      return `Device deauthorized: ${removed} key item(s) erased from this browser and connected providers signed out.`;
    });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-cyan-300 bg-cyan-50 p-4 dark:border-cyan-400/30 dark:bg-cyan-500/10">
        <h4 className="mb-1 font-semibold text-cyan-800 dark:text-cyan-200">
          🔑 Device Passphrase Keystore
        </h4>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Passphrase-less backups keep their encryption key on this device.
          Enabling a device passphrase wraps those keys at rest, so they are
          useless to anyone who reads this browser&apos;s storage without your
          passphrase.
        </p>
      </div>

      {/* Status line + per-action messages */}
      <div className={cardClass}>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span
            className={`rounded px-2 py-1 ${
              enabled
                ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300"
                : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            {enabled ? "Passphrase enabled" : "Passphrase not set"}
          </span>
          {enabled && (
            <span
              className={`rounded px-2 py-1 ${
                unlocked
                  ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
              }`}
            >
              {unlocked ? "🔓 Unlocked" : "🔒 Locked"}
            </span>
          )}
          <span className="rounded bg-gray-200 px-2 py-1 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
            {keyIds.length} stored key{keyIds.length === 1 ? "" : "s"}
          </span>
        </div>

        {(msg || err) && (
          <p
            className={`mt-3 text-sm ${
              err
                ? "text-red-700 dark:text-red-300"
                : "text-green-700 dark:text-green-300"
            }`}
            role={err ? "alert" : "status"}
          >
            {err ? `⚠️ ${err}` : msg}
          </p>
        )}
      </div>

      {/* Enable (not yet set) + import a recovery bundle */}
      {!enabled && (
        <div className={cardClass}>
          <h5 className="mb-2 font-medium text-gray-900 dark:text-white">
            Set a device passphrase
          </h5>
          <div className="space-y-2">
            <label htmlFor="ks-new" className="sr-only">
              New device passphrase
            </label>
            <input
              id="ks-new"
              type="password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder={`New passphrase (min ${MIN_PASSPHRASE} characters)`}
              className={inputClass}
              autoComplete="new-password"
            />
            <label htmlFor="ks-confirm" className="sr-only">
              Confirm device passphrase
            </label>
            <input
              id="ks-confirm"
              type="password"
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              placeholder="Confirm passphrase"
              className={inputClass}
              autoComplete="new-password"
            />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              ⚠️ If you forget this passphrase, the keys it protects cannot be
              recovered. There is no reset — by design, we never see it.
            </p>
            <button
              type="button"
              onClick={handleEnable}
              disabled={busy || !newPass || !confirmPass}
              className="w-full rounded-lg bg-cyan-600 py-2 font-medium text-white hover:bg-cyan-500 disabled:bg-gray-300 dark:disabled:bg-gray-600"
            >
              Enable device passphrase
            </button>
          </div>

          <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
            <h5 className="mb-1 font-medium text-gray-900 dark:text-white">
              Restore from a recovery bundle
            </h5>
            <p className="mb-2 text-xs text-gray-600 dark:text-gray-400">
              Importing a bundle you exported elsewhere puts its wrapped keys on
              this device. You will then unlock with that bundle&apos;s
              passphrase.
            </p>
            <label htmlFor="ks-import" className="sr-only">
              Recovery bundle file
            </label>
            <input
              id="ks-import"
              type="file"
              accept="application/json,.json"
              onChange={handleImportFile}
              disabled={busy}
              className="block w-full text-sm text-gray-700 file:mr-3 file:rounded file:border-0 file:bg-cyan-600 file:px-3 file:py-2 file:text-white hover:file:bg-cyan-500 dark:text-gray-300"
            />
          </div>
        </div>
      )}

      {/* Unlock (enabled but locked) */}
      {enabled && !unlocked && (
        <div className={cardClass}>
          <h5 className="mb-2 font-medium text-gray-900 dark:text-white">
            Unlock the keystore
          </h5>
          <div className="space-y-2">
            <label htmlFor="ks-unlock" className="sr-only">
              Device passphrase
            </label>
            <input
              id="ks-unlock"
              type="password"
              value={unlockPass}
              onChange={(e) => setUnlockPass(e.target.value)}
              placeholder="Device passphrase"
              className={inputClass}
              autoComplete="current-password"
              onKeyDown={(e) => {
                if (e.key === "Enter" && unlockPass && !busy) handleUnlock();
              }}
            />
            <button
              type="button"
              onClick={handleUnlock}
              disabled={busy || !unlockPass}
              className="w-full rounded-lg bg-cyan-600 py-2 font-medium text-white hover:bg-cyan-500 disabled:bg-gray-300 dark:disabled:bg-gray-600"
            >
              Unlock
            </button>
          </div>
        </div>
      )}

      {/* Change passphrase + lock (enabled and unlocked) */}
      {enabled && unlocked && (
        <div className={cardClass}>
          <div className="mb-3 flex items-center justify-between">
            <h5 className="font-medium text-gray-900 dark:text-white">
              Change device passphrase
            </h5>
            <button
              type="button"
              onClick={handleLock}
              disabled={busy}
              className="rounded bg-gray-200 px-3 py-1 text-xs text-gray-800 hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
            >
              🔒 Lock now
            </button>
          </div>
          <div className="space-y-2">
            <label htmlFor="ks-rotate" className="sr-only">
              New device passphrase
            </label>
            <input
              id="ks-rotate"
              type="password"
              value={rotatePass}
              onChange={(e) => setRotatePass(e.target.value)}
              placeholder={`New passphrase (min ${MIN_PASSPHRASE} characters)`}
              className={inputClass}
              autoComplete="new-password"
            />
            <label htmlFor="ks-rotate-confirm" className="sr-only">
              Confirm new device passphrase
            </label>
            <input
              id="ks-rotate-confirm"
              type="password"
              value={rotateConfirm}
              onChange={(e) => setRotateConfirm(e.target.value)}
              placeholder="Confirm new passphrase"
              className={inputClass}
              autoComplete="new-password"
            />
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Re-wraps every saved key under the new passphrase. Your cloud
              backups are not re-uploaded or changed.
            </p>
            <button
              type="button"
              onClick={handleRotate}
              disabled={busy || !rotatePass || !rotateConfirm}
              className="w-full rounded-lg bg-cyan-600 py-2 font-medium text-white hover:bg-cyan-500 disabled:bg-gray-300 dark:disabled:bg-gray-600"
            >
              Change passphrase
            </button>
          </div>
        </div>
      )}

      {/* Recovery export (available whenever a passphrase is enabled) */}
      {enabled && (
        <div className={cardClass}>
          <h5 className="mb-1 font-medium text-gray-900 dark:text-white">
            Recovery bundle
          </h5>
          <p className="mb-2 text-xs text-gray-600 dark:text-gray-400">
            Download a passphrase-protected copy of this device&apos;s wrapped
            keys so you can restore them on another device or after a wipe.
            {!unlocked && " Unlock first to include every key."}
          </p>
          <button
            type="button"
            onClick={handleExport}
            disabled={busy}
            className="rounded-lg border border-cyan-500 px-4 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-50 disabled:opacity-50 dark:text-cyan-300 dark:hover:bg-cyan-500/10"
          >
            ⬇️ Export recovery bundle
          </button>
        </div>
      )}

      {/* Deauthorize this device */}
      {enabled && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-400/30 dark:bg-red-500/10">
          <h5 className="mb-1 font-semibold text-red-700 dark:text-red-300">
            Deauthorize this device
          </h5>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Erases every encryption key this browser holds and signs out your
            connected cloud providers. This is enforced on{" "}
            <strong>this device only</strong> — it cannot delete files already
            in your cloud or recall backups that were already synced.
          </p>
          {keyIds.length > 0 && (
            <p className="mt-2 rounded bg-red-100 p-2 text-xs text-red-800 dark:bg-red-500/20 dark:text-red-200">
              ⚠️ {keyIds.length} backup key{keyIds.length === 1 ? "" : "s"} live
              only on this device. Any passphrase-less backup whose only key is
              here becomes <strong>permanently unrecoverable everywhere</strong>{" "}
              after deauthorization. Export a recovery bundle first if you might
              need them.
            </p>
          )}

          {!showDeauth ? (
            <button
              type="button"
              onClick={() => {
                setShowDeauth(true);
                setErr("");
                setMsg("");
              }}
              disabled={busy}
              className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              Deauthorize this device…
            </button>
          ) : (
            <div className="mt-3 space-y-2">
              <label
                htmlFor="ks-deauth"
                className="block text-sm text-gray-700 dark:text-gray-300"
              >
                Type <strong>{DEAUTH_CONFIRM_WORD}</strong> to confirm:
              </label>
              <input
                id="ks-deauth"
                type="text"
                value={deauthText}
                onChange={(e) => setDeauthText(e.target.value)}
                placeholder={DEAUTH_CONFIRM_WORD}
                className={inputClass}
                autoComplete="off"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeauth(false);
                    setDeauthText("");
                  }}
                  disabled={busy}
                  className="flex-1 rounded-lg bg-gray-200 py-2 text-sm text-gray-800 hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeauthorize}
                  disabled={
                    busy ||
                    deauthText.trim().toUpperCase() !== DEAUTH_CONFIRM_WORD
                  }
                  className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:bg-gray-300 dark:disabled:bg-gray-600"
                >
                  Erase keys & sign out
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DeviceKeystorePanel;
