import { lazy, Suspense, useState, useEffect } from "react";

const PublicationsLibrary = lazy(
  () => import("../../components/PublicationsLibrary"),
);

/**
 * Publications Library modal — beta reference-library viewer opened from the
 * App footer. Owns its open/close state and the modal-overlay chrome
 * (sticky header + close button) that App.jsx previously hand-rolled.
 *
 * Opens on `openPublicationsLibrary` window event.
 *
 * Extracted from App.jsx (audit #35, B36).
 */
export default function PublicationsLibraryModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("openPublicationsLibrary", handler);
    return () => window.removeEventListener("openPublicationsLibrary", handler);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            📚 Publications Library{" "}
            <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded">
              BETA
            </span>
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            ✕
          </button>
        </div>
        <div className="p-6">
          <Suspense fallback={null}>
            <PublicationsLibrary />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
