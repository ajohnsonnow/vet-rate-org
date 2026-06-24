/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See COPYRIGHT.js for full license terms.
 */

/**
 * UPDATE BANNER - "The Alert"
 *
 * Non-intrusive notification when an update is available.
 * Appears at the top of the screen, doesn't block work.
 */

import { RefreshCw, X } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";

const UpdateBanner = ({ onApplyUpdate, onDismiss, updateInfo }) => {
  const { _t } = useLanguage();
  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg animate-slideDown"
      role="status"
      aria-live="polite"
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <RefreshCw className="w-5 h-5 animate-spin-slow" />
          <div>
            <p className="font-semibold text-sm">🆕 New Update Available!</p>
            <p className="text-xs text-blue-100">
              Version {updateInfo?.serverVersion} is ready. Click to refresh and
              get the latest features.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onApplyUpdate}
            className="bg-white text-blue-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-50 transition-colors"
          >
            Update Now
          </button>

          <button
            onClick={onDismiss}
            className="p-2 hover:bg-blue-800 rounded-md transition-colors"
            aria-label="Dismiss update notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateBanner;
