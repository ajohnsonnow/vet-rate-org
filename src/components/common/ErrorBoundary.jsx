/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 *
 * ErrorBoundary — catches render/lifecycle crashes in a subtree and shows a
 * mobile-first, offline-safe fallback instead of a blank white screen.
 *
 * Two levels:
 *   level="app"      full-screen fallback with "Reload app" (a top-level crash
 *                    means the whole tree is gone, so re-mounting won't help).
 *   level="cluster"  inline card with "Try again" (resets the boundary so the
 *                    cluster re-mounts) — the default; siblings stay interactive.
 *
 * On catch it lands the error in the bug-report console log (so the BugSquasher
 * picks it up) and offers a one-tap "Report this problem" that persists a full
 * sanitized crash report to IndexedDB via saveBugReport, surfacing a Toast.
 *
 * Error boundaries must be class components — getDerivedStateFromError /
 * componentDidCatch have no hook equivalent. Toast is read through
 * `static contextType` (the single context this class needs); it is null-safe
 * so the component still renders outside a ToastProvider (e.g. in unit tests).
 *
 * Part of the S9–S17 cycle (docs/SPRINT_PLAN_S9-S17.md, S11).
 */

import { Component } from "react";
import { AlertTriangle } from "lucide-react";
import { ToastContext } from "../../contexts/ToastContext";
import { saveBugReport } from "../../utils/bugReportStorage";
import {
  logConsoleError,
  getSystemInfo,
  BUG_SEVERITY,
  BUG_CATEGORIES,
} from "../../utils/bugReportUtils";

export default class ErrorBoundary extends Component {
  static contextType = ToastContext;

  state = { hasError: false, error: null, reportState: "idle" };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.componentStack = errorInfo?.componentStack || null;
    // Land the crash in the same session log the BugSquasher reads, so a
    // manual report later still carries this stack even if the user never
    // taps "Report this problem".
    logConsoleError({
      type: "error",
      message: `[ErrorBoundary:${this.props.name || "app"}] ${
        error?.message || String(error)
      }`,
      stack: error?.stack || this.componentStack,
    });
  }

  resetBoundary = () => {
    this.componentStack = null;
    this.setState({ hasError: false, error: null, reportState: "idle" });
  };

  handleReport = async () => {
    const { name } = this.props;
    const { error } = this.state;
    const toast = this.context;
    this.setState({ reportState: "saving" });
    try {
      const saved = await saveBugReport({
        error_message: error?.message || String(error),
        stack_trace: error?.stack || this.componentStack || "",
        severity: BUG_SEVERITY.CRITICAL.value,
        category: BUG_CATEGORIES.FEATURE_BROKEN,
        module: name || "Application",
        userDescription:
          "Automatic crash report captured by the app's error boundary.",
        actualBehavior: `"${name || "The app"}" stopped responding: ${
          error?.message || "Unknown error"
        }`,
        additionalContext: this.componentStack || "",
        systemInfo: getSystemInfo(),
      });
      this.setState({ reportState: "saved" });
      toast?.success?.(
        `Problem reported${
          saved?.report_id ? ` (${saved.report_id})` : ""
        }. Thank you — this helps us fix it.`,
      );
    } catch {
      this.setState({ reportState: "failed" });
      toast?.error?.(
        "Couldn't save the report. Your data is safe on this device — please try again.",
      );
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isApp = this.props.level === "app";
    const { name } = this.props;
    const { reportState } = this.state;
    const reportBusy = reportState === "saving" || reportState === "saved";

    return (
      <div
        role="alert"
        data-testid="error-boundary-fallback"
        className={
          isApp
            ? "min-h-screen flex items-center justify-center bg-gray-50 dark:bg-emerald-950 px-4 py-8 pb-[calc(env(safe-area-inset-bottom)+2rem)]"
            : "flex items-center justify-center p-4"
        }
      >
        <div className="w-full max-w-md text-center bg-white dark:bg-emerald-900 border border-gray-200 dark:border-emerald-800 rounded-2xl shadow-lg p-6">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
            <AlertTriangle
              className="h-7 w-7 text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            />
          </div>

          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {isApp
              ? "Something went wrong"
              : `${name || "This tool"} hit a snag`}
          </h2>

          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            {isApp
              ? "The app ran into an unexpected error. Your saved data is stored on this device and is safe."
              : "This part of the app stopped responding. The rest of Vet-Rate.org still works, and your data is safe on this device."}
          </p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {isApp ? (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="min-h-[44px] rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Reload app
              </button>
            ) : (
              <button
                type="button"
                onClick={this.resetBoundary}
                className="min-h-[44px] rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Try again
              </button>
            )}

            <button
              type="button"
              onClick={this.handleReport}
              disabled={reportBusy}
              className="min-h-[44px] rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-60 dark:border-emerald-700 dark:text-gray-200 dark:hover:bg-emerald-800"
            >
              {reportState === "saved"
                ? "Reported ✓"
                : reportState === "saving"
                  ? "Reporting…"
                  : "Report this problem"}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
