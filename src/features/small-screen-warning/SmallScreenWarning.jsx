import { useState } from "react";

/**
 * Small Screen Warning — modal shown on first load when window.innerWidth
 * < 640px. Dismissal is persisted in sessionStorage so the warning only
 * appears once per browser session.
 *
 * Extracted from App.jsx (audit #35, B60).
 */
export default function SmallScreenWarning() {
  const [dismissed, setDismissed] = useState(
    sessionStorage.getItem("vetrate-small-screen-dismissed") === "true",
  );

  if (dismissed || window.innerWidth >= 640) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-amber-500 rounded-lg p-6 max-w-md shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          <svg
            className="w-8 h-8 text-amber-500 flex-shrink-0 mt-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <h3 className="text-xl font-bold text-amber-400 mb-2">
              Screen Size Warning
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-3">
              VetRate is optimized for tablet and desktop screens. Some features
              may not work properly on smaller devices.
            </p>
            <p className="text-slate-400 text-xs leading-relaxed">
              For the best experience, please use a device with a screen width
              of at least 640px, or switch to landscape mode.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              setDismissed(true);
              sessionStorage.setItem("vetrate-small-screen-dismissed", "true");
            }}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 px-4 rounded transition-colors"
          >
            I Understand, Continue Anyway
          </button>
          <a
            href="mailto:support@vetrate.org?subject=Mobile%20Support%20Request"
            className="w-full text-center bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white font-semibold py-2 px-4 rounded transition-colors"
          >
            Email Us About Mobile Support
          </a>
        </div>
      </div>
    </div>
  );
}
