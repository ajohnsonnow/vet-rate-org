import LoadingBunker from "../../components/LoadingBunker";
import QuickExitButton from "../../components/QuickExitButton";

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
 * isMigrating distinguishes "still deciding" (every load pays this,
 * including first-ever visits and already-migrated returning users) from
 * "actively copying" (only returning users with pre-migration data) - the
 * "This only happens once" copy is only true for the latter, so it only
 * renders when isMigrating is true.
 *
 * QuickExitButton is rendered here too: useBootSequence.js races the
 * migration decision against a timeout and fails open, but until that
 * either settles or times out, this is the only thing on screen, and Quick
 * Exit must stay one tap away no matter how long that takes.
 *
 * Extracted from App.jsx (audit #35, B79).
 */
export default function MigrationScreen({ isMigrating = false }) {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <LoadingBunker
          size="large"
          message={
            isMigrating ? "Migrating to Enhanced Storage..." : "Loading..."
          }
        />
        {isMigrating && (
          <p className="text-gray-400 mt-4 text-sm">
            Upgrading your data storage. This only happens once.
          </p>
        )}
      </div>
      <QuickExitButton position="top-right" variant="subtle" />
    </div>
  );
}
