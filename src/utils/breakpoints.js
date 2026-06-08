/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 *
 * breakpoints — the single source of truth for viewport px thresholds.
 *
 * Framework-agnostic so the React `useBreakpoint` hook and the non-React
 * device utilities (`useDeviceCapability`, `dkbIndexedDB`) read the SAME
 * numbers instead of each hardcoding its own `< 640|768`. Aligned with
 * tailwind.config.js `screens`.
 */

// px, aligned with tailwind.config.js `screens`.
export const BREAKPOINTS = {
  xs: 475,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
};

export const MOBILE_MAX = BREAKPOINTS.md; // < 768 === phone
export const DESKTOP_MIN = BREAKPOINTS.lg; // >= 1024 === desktop

/** True for phone-width viewports (< 768px). Pure; pass a measured width. */
export const isMobileWidth = (width) => width > 0 && width < MOBILE_MAX;
