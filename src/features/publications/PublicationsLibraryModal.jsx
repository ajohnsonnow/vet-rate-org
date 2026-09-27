import { lazy, Suspense, useState, useEffect } from "react";
import ResponsiveModal from "../../components/common/ResponsiveModal";
import HeaderCloseSlot from "../../components/common/HeaderCloseSlot";

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
        // `sm:pr-28` reserves the same fixed Quick Exit gutter as
        // ClaimNavigator.jsx's header: at `size="2xl"` (max-w-6xl), the
        // panel is still viewport-width-bound (not cap-bound) at every
        // required desktop width up to ~1568px, so its close-X sits close
        // enough to the physical top-right corner to reach Quick Exit's
        // fixed box there (measured at 1024x768/1280x720).
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-4 sm:pr-28">
          <HeaderCloseSlot
            close={
              <button
                onClick={() => setOpen(false)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Close"
              >
                ✕
              </button>
            }
          >
            <h2
              id="publications-library-title"
              className="min-w-0 text-xl font-bold text-gray-900 dark:text-white"
            >
              📚 Publications Library{" "}
              <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded">
                BETA
              </span>
            </h2>
          </HeaderCloseSlot>
        </div>
      }
    >
      <Suspense fallback={null}>
        <PublicationsLibrary />
      </Suspense>
    </ResponsiveModal>
  );
}
