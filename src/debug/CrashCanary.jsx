/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 *
 * CrashCanary — DEV/E2E-only. Throws during render when a `vetrate:e2e-crash`
 * window event fires, so the Playwright suite can prove ErrorBoundary recovery
 * in the real running app. Mounted only under `import.meta.env.DEV`, so it is
 * dead code (and tree-shaken) in production builds. Never user-facing.
 */

import { useState, useEffect } from "react";

const CRASH_FLAG = "__VETRATE_E2E_CRASH__";

export default function CrashCanary() {
  // The window flag is the single source of truth, persisted across remounts.
  // The dev server (React StrictMode + Fast Refresh) auto-recovers a crashed
  // boundary by remounting its subtree; a one-shot crash held in component state
  // would be lost on that remount and the fallback would vanish before the e2e
  // can act on it. Reading the flag on every render makes each remount re-throw,
  // so the fallback stays put — exactly how a real, non-transient render bug
  // behaves. `forceRender` only nudges an already-mounted instance to re-read
  // the flag the moment the event fires (setting a window prop alone wouldn't).
  // To recover, a test clears `window.__VETRATE_E2E_CRASH__` then triggers the
  // boundary's "Try again". Production builds tree-shake this whole module out.
  const [, forceRender] = useState(0);

  useEffect(() => {
    const trigger = () => {
      window[CRASH_FLAG] = true;
      forceRender((n) => n + 1);
    };
    window.addEventListener("vetrate:e2e-crash", trigger);
    return () => window.removeEventListener("vetrate:e2e-crash", trigger);
  }, []);

  if (typeof window !== "undefined" && window[CRASH_FLAG] === true)
    throw new Error("E2E canary crash");
  return null;
}
