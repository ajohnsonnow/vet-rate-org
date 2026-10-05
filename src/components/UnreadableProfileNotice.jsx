/**
 * Vet-Rate.org - Unreadable saved profile notice
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * A saved profile that cannot be read is told to the veteran once, in plain
 * words: what happened, that their other data is untouched, and what they can
 * do. It is never replaced or deleted for them; starting a new profile is
 * their own, confirmed choice, and even then the unreadable value is kept
 * under its own key. The app keeps working with an empty profile meanwhile.
 */

import { useCallback, useEffect, useState } from "react";
import {
  PROFILE_CHANGED_EVENT,
  PROFILE_UNREADABLE_EVENT,
} from "../utils/profileEvents";
import {
  UNREADABLE_PROFILE_COPY_KEY,
  readVeteranProfileQuiet,
  startNewProfileInPlaceOfUnreadable,
} from "../utils/veteranProfile";

const BUTTON =
  "min-h-[44px] rounded-lg px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700";
const PRIMARY = `${BUTTON} bg-amber-600 text-white hover:bg-amber-500`;
const SECONDARY = `${BUTTON} border border-gray-400 text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800`;

const hasPreservedCopy = () => {
  try {
    return localStorage.getItem(UNREADABLE_PROFILE_COPY_KEY) !== null;
  } catch {
    return false;
  }
};

const openBackupManager = () =>
  window.dispatchEvent(new CustomEvent("openBackupManager"));

const TEXT = {
  unreadable:
    "Your saved profile could not be read. Nothing was deleted or changed, and the rest of your data (records, claims, documents) is untouched. You can restore a backup, or start a new profile. Until then the app works without your profile details.",
  confirm:
    "Starting a new profile takes the unreadable one out of your profile. Nothing else is deleted, and a copy of the unreadable profile stays on this device.",
  replaced:
    "Your saved profile could not be read, so a new profile was started when something was saved. The unreadable copy is still on this device. You can restore a backup if you have one.",
};

function useProfileNoticeMode() {
  const [mode, setMode] = useState(() =>
    readVeteranProfileQuiet().ok ? null : "unreadable",
  );

  const recheck = useCallback(() => {
    const readable = readVeteranProfileQuiet().ok;
    setMode((current) => {
      if (!readable) return current;
      if (current === "unreadable" || current === "confirm") {
        return hasPreservedCopy() ? "replaced" : null;
      }
      return current;
    });
  }, []);

  useEffect(() => {
    const onUnreadable = () => setMode((current) => current ?? "unreadable");
    window.addEventListener(PROFILE_UNREADABLE_EVENT, onUnreadable);
    window.addEventListener(PROFILE_CHANGED_EVENT, recheck);
    window.addEventListener("storage", recheck);
    return () => {
      window.removeEventListener(PROFILE_UNREADABLE_EVENT, onUnreadable);
      window.removeEventListener(PROFILE_CHANGED_EVENT, recheck);
      window.removeEventListener("storage", recheck);
    };
  }, [recheck]);

  return [mode, setMode];
}

function NoticeActions({ mode, setMode }) {
  if (mode === "confirm") {
    return (
      <>
        <button
          type="button"
          className={PRIMARY}
          onClick={() => {
            startNewProfileInPlaceOfUnreadable();
            setMode(null);
          }}
        >
          Yes, start a new profile
        </button>
        <button
          type="button"
          className={SECONDARY}
          onClick={() => setMode("unreadable")}
        >
          Cancel
        </button>
      </>
    );
  }
  return (
    <>
      <button type="button" className={PRIMARY} onClick={openBackupManager}>
        Restore a backup
      </button>
      {mode === "unreadable" && (
        <button
          type="button"
          className={SECONDARY}
          onClick={() => setMode("confirm")}
        >
          Start a new profile
        </button>
      )}
      <button type="button" className={SECONDARY} onClick={() => setMode(null)}>
        {mode === "unreadable" ? "Not now" : "Dismiss"}
      </button>
    </>
  );
}

export default function UnreadableProfileNotice() {
  const [mode, setMode] = useProfileNoticeMode();

  if (!mode) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="unreadable-profile-notice"
      className="fixed left-1/2 top-[30%] z-[55] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-amber-500 bg-white p-4 shadow-2xl dark:bg-gray-900"
    >
      <p className="text-sm text-gray-900 dark:text-gray-100">{TEXT[mode]}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <NoticeActions mode={mode} setMode={setMode} />
      </div>
    </div>
  );
}
