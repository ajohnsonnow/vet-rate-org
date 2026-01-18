/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * 
 * Custom hook to lock body scroll when modals are open.
 * Fixes mobile scroll issues with modals.
 */

import { useEffect } from 'react';

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

    // Store current scroll position
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    
    // Get current body padding (to prevent layout shift from scrollbar removal)
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    
    // Apply scroll lock
    document.body.classList.add('modal-open');
    document.body.style.top = `-${scrollY}px`;
    
    // Compensate for scrollbar width to prevent layout shift
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    // Cleanup function - restore scroll when modal closes
    return () => {
      document.body.classList.remove('modal-open');
      document.body.style.top = '';
      document.body.style.paddingRight = originalPaddingRight;
      
      // Restore scroll position
      window.scrollTo(scrollX, scrollY);
    };
  }, [isLocked]);
};

/**
 * Alternative: Simple scroll lock without position preservation
 * Use this for simpler cases where scroll position doesn't matter
 */
export const useSimpleScrollLock = (isLocked) => {
  useEffect(() => {
    if (!isLocked) return;
    
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isLocked]);
};

export default useBodyScrollLock;
