import { X } from "lucide-react";

/**
 * Small, dismissible "new version" notice. Fixed near the top and clear of
 * Quick Exit (top-left below `sm`, top-right above), under its z-index, and
 * never focus-stealing: it is a polite status message, not a dialog.
 */
const ServiceWorkerUpdateNotice = ({ onReload, onDismiss }) => (
  <div
    role="status"
    aria-live="polite"
    className="pointer-events-none fixed inset-x-0 top-16 z-[60] flex justify-center px-3 sm:top-4"
  >
    <div className="pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-lg border border-blue-300 bg-white p-2 pl-4 text-gray-900 shadow-lg dark:border-blue-700 dark:bg-gray-800 dark:text-gray-100">
      <p className="min-w-0 flex-1 text-sm">
        A new version is ready. Reload to update.
      </p>
      <button
        type="button"
        onClick={onReload}
        className="min-h-[44px] shrink-0 rounded-md bg-blue-700 px-4 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        Reload
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss update notice"
        className="grid min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-md text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  </div>
);

export default ServiceWorkerUpdateNotice;
