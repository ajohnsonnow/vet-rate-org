import { useCallback, useEffect, useState } from "react";
import { activeImportId } from "../../utils/importProgressMarker";

const RECHECK_MS = 1500;
const DIALOG_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog[open]';
const FIELD_SELECTOR =
  'input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable=""], [contenteditable="true"]';
const FALLBACK_RELOAD_MS = 4000;

// The notice is held back, not dropped, while anything the veteran is in the
// middle of could be disturbed: an import this tab is running, any open
// dialog (every tool and form lives in one, and the safety screens are
// dialogs too), or a field they are typing in.
function somethingIsInProgress() {
  if (activeImportId()) return true;
  if (document.querySelector(DIALOG_SELECTOR)) return true;
  const focused = document.activeElement;
  return Boolean(
    focused && focused !== document.body && focused.matches(FIELD_SELECTOR),
  );
}

/**
 * State for the "a new version is ready" notice. Listens for the
 * `sw-update-available` event main.jsx dispatches when a new service worker
 * has installed and is waiting. Nothing here reloads the page by itself:
 * `apply` runs only from the veteran's own click.
 */
export function useServiceWorkerUpdate() {
  const [waiting, setWaiting] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const onUpdate = (event) => {
      const accept = event.detail?.accept;
      setWaiting({ accept: typeof accept === "function" ? accept : null });
      setDismissed(false);
    };
    const onPanic = () => setLeaving(true);
    window.addEventListener("sw-update-available", onUpdate);
    window.addEventListener("vetrate:panic-triggered", onPanic);
    return () => {
      window.removeEventListener("sw-update-available", onUpdate);
      window.removeEventListener("vetrate:panic-triggered", onPanic);
    };
  }, []);

  const pending = waiting !== null && !dismissed && !leaving;

  useEffect(() => {
    if (!pending) return undefined;
    const check = () => setHeld(somethingIsInProgress());
    check();
    const timer = setInterval(check, RECHECK_MS);
    return () => clearInterval(timer);
  }, [pending]);

  const apply = useCallback(() => {
    try {
      if (waiting?.accept) {
        waiting.accept();
        // main.jsx reloads once the new worker takes over. This only covers a
        // worker that never does, so the click is never a silent no-op.
        setTimeout(() => window.location.reload(), FALLBACK_RELOAD_MS);
        return;
      }
    } catch {
      // fall through to a plain reload
    }
    window.location.reload();
  }, [waiting]);

  const dismiss = useCallback(() => setDismissed(true), []);

  return { visible: pending && !held, apply, dismiss };
}
