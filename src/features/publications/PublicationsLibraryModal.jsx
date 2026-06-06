import { lazy, Suspense, useState, useEffect } from "react";
import ResponsiveModal from "../../components/common/ResponsiveModal";

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
    <ResponsiveModal
      isOpen
      onClose={() => setOpen(false)}
      size="2xl"
      labelledBy="publications-library-title"
      header={
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center">
          <h2
            id="publications-library-title"
            className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"
          >
            📚 Publications Library{" "}
            <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded">
              BETA
            </span>
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      }
    >
      <Suspense fallback={null}>
        <PublicationsLibrary />
      </Suspense>
    </ResponsiveModal>
  );
}
