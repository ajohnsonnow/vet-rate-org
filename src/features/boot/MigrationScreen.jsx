import LoadingBunker from "../../components/LoadingBunker";

/**
 * MigrationScreen — full-page boot splash shown while useBootSequence is
 * still deciding whether a localStorage → IndexedDB migration is needed,
 * and while running it if so.
 *
 * Renders only while isBooting is true (App.jsx); the interactive tree -
 * and every dialog/listener inside it - does not mount until this resolves,
 * so a migration can never swap an already-open dialog out from under a
 * veteran or drop a dispatch aimed at a not-yet-mounted listener.
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
