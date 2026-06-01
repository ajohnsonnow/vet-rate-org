/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 *
 * useBreakpoint — the single source of truth for viewport size decisions.
 *
 * Replaces ~13 scattered `window.innerWidth < 640|768` / `matchMedia`
 * checks that disagreed on where "mobile" ends. Reads the same thresholds
 * as tailwind.config.js `screens`. SSR-safe: returns a neutral
 * (desktop-leaning) snapshot when `window` is absent, then corrects on
 * mount.
 */

import { useState, useEffect } from "react";

// Aligned with tailwind.config.js `screens` (px). `md` (768) is the
// phone/tablet boundary used across the app.
export const BREAKPOINTS = {
  xs: 475,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
};

const MOBILE_MAX = BREAKPOINTS.md; // < 768 === phone
const DESKTOP_MIN = BREAKPOINTS.lg; // >= 1024 === desktop

function readViewport() {
  if (typeof window === "undefined") {
    return { width: 0, height: 0, isTouch: false };
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    isTouch:
      "ontouchstart" in window ||
      (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0),
  };
}

function computeState({ width, height, isTouch }) {
  let bp = "base";
  if (width >= BREAKPOINTS["2xl"]) bp = "2xl";
  else if (width >= BREAKPOINTS.xl) bp = "xl";
  else if (width >= BREAKPOINTS.lg) bp = "lg";
  else if (width >= BREAKPOINTS.md) bp = "md";
  else if (width >= BREAKPOINTS.sm) bp = "sm";
  else if (width >= BREAKPOINTS.xs) bp = "xs";

  return {
    width,
    height,
    bp,
    isTouch,
    isMobile: width > 0 && width < MOBILE_MAX,
    isTablet: width >= MOBILE_MAX && width < DESKTOP_MIN,
    isDesktop: width >= DESKTOP_MIN,
    isLandscape: width > 0 && width >= height,
  };
}

/**
 * @returns {{width:number, height:number, bp:string, isTouch:boolean,
 *   isMobile:boolean, isTablet:boolean, isDesktop:boolean,
 *   isLandscape:boolean}}
 */
export function useBreakpoint() {
  const [state, setState] = useState(() => computeState(readViewport()));

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const update = () => setState(computeState(readViewport()));
    update(); // reconcile in case the SSR/first-paint snapshot was neutral

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return state;
}

/** Convenience: true when the viewport is a phone (< 768px). */
export function useIsMobile() {
  return useBreakpoint().isMobile;
}

export default useBreakpoint;
