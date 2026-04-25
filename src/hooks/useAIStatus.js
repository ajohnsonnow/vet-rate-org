/**
 * useAIStatus
 * ----------------------------------------------------------------------
 * React hook that returns the current AI status snapshot from
 * `unifiedAIService.getAIStatus()` and re-renders only when the status
 * actually changes.
 *
 * Replaces the legacy pattern that ran inside almost every AI-aware
 * component:
 *
 *   useEffect(() => {
 *     const interval = setInterval(() => setStatus(getAIStatus()), 1000);
 *     return () => clearInterval(interval);
 *   }, []);
 *
 * That polled the main thread once per second per mounted tool — adding
 * up to 30+ wakeups/sec when several tools were open in tabs. The new
 * hook subscribes to `subscribeAIStatus` (event-driven) and to the
 * existing `local-ai-status-change` DOM event so updates are pushed,
 * not polled.
 *
 * Memoised by shallow-string compare to skip renders when the status
 * payload has not meaningfully changed (e.g. the same `mode`/`ready`
 * fields after a no-op event).
 */

import { useEffect, useState } from "react";
import { getAIStatus, subscribeAIStatus } from "../utils/unifiedAIService";

const shallowEqualStatus = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  // getAIStatus() returns a flat object of primitives + nested `engines`
  // map. Stringify is safe & cheap (~10 fields) and avoids per-key
  // boilerplate that drifts when fields are added.
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

export const useAIStatus = () => {
  const [status, setStatus] = useState(() => getAIStatus());

  useEffect(() => {
    let mounted = true;

    const refresh = () => {
      if (!mounted) return;
      const next = getAIStatus();
      setStatus((prev) => (shallowEqualStatus(prev, next) ? prev : next));
    };

    const unsubscribeService = subscribeAIStatus(refresh);

    // Legacy event already dispatched by registerLocalAIEngine() and a
    // few other call-sites — keep listening so older code paths still
    // wake the hook even before they're migrated.
    if (typeof window !== "undefined") {
      window.addEventListener("local-ai-status-change", refresh);
      // Tab-visibility flip → resync once. Cheaper than a 1-second poll
      // and catches state changes that happened in the background.
      document.addEventListener("visibilitychange", refresh);
    }

    // One initial sync in case the status changed between the
    // useState initializer and effect attachment.
    refresh();

    return () => {
      mounted = false;
      unsubscribeService();
      if (typeof window !== "undefined") {
        window.removeEventListener("local-ai-status-change", refresh);
        document.removeEventListener("visibilitychange", refresh);
      }
    };
  }, []);

  return status;
};

export default useAIStatus;
