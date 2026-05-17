import { useCallback } from "react";

/**
 * useAppStateSnapshot — returns a memoized getter that captures the
 * App-level state surface a bug report or feature request needs at
 * the moment the user opens the modal.
 *
 * Consumers: SystemToolsCluster (BugSquasher) and FeedbackHub
 * (FeatureRequest). Both call getAppState() lazily inside their
 * `open*` window-event handlers, so the snapshot reflects the
 * current state at the click, not the state when AppModals
 * mounted.
 *
 * The getter is referentially stable as long as none of the listed
 * dependencies change, so AppModals does not re-render on every
 * App.jsx re-render.
 *
 * Extracted from App.jsx (audit #35, B80).
 */
export function useAppStateSnapshot({
  searchTerm,
  results,
  selectedResult,
  hasSearched,
  error,
  userConditions,
}) {
  return useCallback(
    () => ({
      searchTerm,
      results,
      selectedResult,
      hasSearched,
      error,
      userConditions,
      currentModule: selectedResult
        ? "Disability Details View"
        : "Disability Search",
    }),
    [searchTerm, results, selectedResult, hasSearched, error, userConditions],
  );
}
