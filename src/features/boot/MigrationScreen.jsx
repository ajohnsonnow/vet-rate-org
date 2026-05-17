import LoadingBunker from "../../components/LoadingBunker";

/**
 * MigrationScreen — full-page boot splash shown while
 * useBootSequence is migrating localStorage data into IndexedDB.
 *
 * Renders only when isMigrating is true; replaces the entire app
 * tree until migration completes, so siblings (toasts, modals,
 * shell overlays) intentionally do not mount.
 *
 * Extracted from App.jsx (audit #35, B79).
 */
export default function MigrationScreen() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <LoadingBunker
          size="large"
          message="Migrating to Enhanced Storage..."
        />
        <p className="text-gray-400 mt-4 text-sm">
          Upgrading your data storage. This only happens once.
        </p>
      </div>
    </div>
  );
}
