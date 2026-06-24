/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Custom hook to lock body scroll when modals are open.
 * Fixes mobile scroll issues with modals.
 */

import { useEffect } from "react";

// Module-level lock state so nested modals (a ResponsiveModal opened from
// inside another) share one lock: the body unlocks only when the last one
// closes, and the scroll position captured at the first lock is restored.
let lockCount = 0;
let savedScrollX = 0;
let savedScrollY = 0;
let savedPaddingRight = "";

/**
 * useBodyScrollLock - Locks body scroll when a modal is open
 *
 * Features:
 * - Prevents background page from scrolling when modal is open
 * - Preserves scroll position when modal closes
 * - Works on iOS Safari (which requires position:fixed hack)
 * - Handles multiple modals (only unlocks when all close)
 *
 * @param {boolean} isLocked - Whether to lock the body scroll
 */
export const useBodyScrollLock = (isLocked) => {
  useEffect(() => {
    if (!isLocked) return;

    if (lockCount === 0) {
      savedScrollX = window.scrollX;
      savedScrollY = window.scrollY;
      savedPaddingRight = document.body.style.paddingRight;

      // Compensate for scrollbar width to prevent layout shift
      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;

      document.body.classList.add("modal-open");
      document.body.style.top = `-${savedScrollY}px`;
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
    }
    lockCount += 1;

    // Cleanup - restore scroll only when the last open modal closes
    return () => {
      lockCount -= 1;
      if (lockCount > 0) return;

      document.body.classList.remove("modal-open");
      document.body.style.top = "";
      document.body.style.paddingRight = savedPaddingRight;
      window.scrollTo(savedScrollX, savedScrollY);
    };
  }, [isLocked]);
};

export default useBodyScrollLock;
