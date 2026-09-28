/**
 * Vet-Rate.org - Safety Redirect ("Panic Key")
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * 🛡️ Trauma-Informed Safety System
 *
 * Provides instant "escape hatch" functionality for veterans who need to
 * quickly hide the application. This is critical for:
 * - Veterans in unsafe domestic situations
 * - Those discussing sensitive topics (MST, trauma) in shared spaces
 * - Anyone who needs immediate privacy when interrupted
 *
 * Features:
 * - Triple-tap Escape key to trigger
 * - Optional "Quick Exit" button
 * - Silences all audio immediately
 * - Clears session data (not persistent data)
 * - Redirects to neutral site (weather.com)
 */

import { clearBeforeUnloadWarning } from "./beforeUnloadGuard";
import { stopAutoBackup } from "./autoBackup";

// Storage key to track safety feature usage (for UX analytics, no PII)
const SAFETY_USE_KEY = "vetrate_safety_use_count";

// Neutral redirect target
const SAFE_REDIRECT_URL = "https://www.weather.com";

// Escape key tracking
let escapeKeyCount = 0;
let escapeTimer = null;
// Exported so tests can derive correct wait times instead of hardcoding a
// copy of these numbers that could silently drift from the real values.
export const ESCAPE_THRESHOLD = 3;
export const ESCAPE_WINDOW_MS = 600; // Must tap 3 times within 600ms

/**
 * Trigger the panic redirect - silences audio, clears session, redirects
 */
export const triggerPanicRedirect = () => {
  try {
    // 1. IMMEDIATELY silence all AI voice output
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    // 2. Stop any playing audio elements
    const audioElements = document.querySelectorAll("audio, video");
    audioElements.forEach((el) => {
      el.pause();
      el.muted = true;
    });

    // 3. Clear temporary session data (NOT persistent localStorage)
    sessionStorage.clear();

    // 3b. Stop autoBackup's pending debounced backup (D13-8) - a write from
    // moments before this redirect can still be sitting in its 2s debounce
    // window, and navigating away doesn't reliably cancel it (e.g. under
    // test, or if replace() is briefly async) before it would otherwise
    // fire and write a fresh snapshot to IndexedDB after a veteran asked to
    // leave immediately.
    stopAutoBackup();

    // 4. Increment safety use counter (anonymous UX metric)
    incrementSafetyUseCount();

    // 5. Dispatch event for any listeners (e.g., analytics)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("vetrate:panic-triggered"));
    }

    // 6. Disable every beforeunload guard before navigating away. A
    // `beforeunload` handler that calls preventDefault() shows the browser's
    // native "Leave site?" prompt, which blocks location.replace() exactly
    // like any other navigation - the panic redirect must never be
    // blockable, in any state (mid-migration, with unsaved changes, etc).
    // `onbeforeunload = null` is a second, independent guard for any
    // property-style (not addEventListener) registration, present or future.
    clearBeforeUnloadWarning();
    if (typeof window !== "undefined") {
      window.onbeforeunload = null;
    }

    // 7. Redirect to neutral site using replace (no back button)
    window.location.replace(SAFE_REDIRECT_URL);
  } catch (error) {
    // Failsafe: even if something errors, still redirect. Repeats the
    // beforeunload teardown in case the try block failed before reaching it
    // above - a blocked failsafe redirect would defeat the entire point of
    // a failsafe.
    console.error("Panic redirect error (still redirecting):", error);
    try {
      clearBeforeUnloadWarning();
    } catch {
      // already failing; fall through to the property-style guard below
    }
    window.onbeforeunload = null;
    window.location.href = SAFE_REDIRECT_URL;
  }
};

/**
 * Soft exit - clears voice and sensitive UI but stays on page
 * Use this for less urgent "mute everything" needs
 */
export const triggerSoftExit = () => {
  try {
    // Silence voice
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    // Clear any visible sensitive content
    const sensitiveElements = document.querySelectorAll(
      '[data-sensitive="true"]',
    );
    sensitiveElements.forEach((el) => {
      el.style.display = "none";
    });

    // Dispatch event
    window.dispatchEvent(new CustomEvent("vetrate:soft-exit"));
  } catch (error) {
    console.error("Soft exit error:", error);
  }
};

// Modal dialogs/alertdialogs (incl. the aria-modal-only kind, which also
// covers the mobile nav drawer). MOST close synchronously in response to
// their own Escape handler (useFocusTrap's onEscape or equivalent) - a
// dialog that does is never counted (see the dialog-count comparison in
// handleEscapeKey). But "a dialog is open" must not mean "trust it forever,
// no matter what": some dialogs never respond to Escape at all - a
// non-dismissible one by design (CrisisModal has no onEscape - it must not
// close), or one whose useFocusTrap never got a chance to trap focus in the
// first place (a loading/initializing state with no focusable content -
// VKBViewer and TheTribunal both render a bare ResponsiveModal shell with no
// header/footer while their data loads - so a keydown fired at whatever had
// focus before the dialog opened never bubbles through the dialog's own
// element-scoped keydown listener at all: that listener lives on the panel
// node, not window/document, and only sees events that pass through it).
// Either way, the panic key must not go dead for as long as that dialog
// happens to be open - so "closed" is verified after the fact, not assumed.
// Owner decision C: ONLY an Escape that closes a tool dialog (role="dialog" /
// role="alertdialog" / aria-modal="true") is exempt from the panic count.
// Escapes that close (or fail to close) a popup, menu, tooltip, or combobox
// still count, same as one that closes nothing - so this selector is
// deliberately scoped to dialogs only, not every dismissible overlay.
const DIALOG_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [aria-modal="true"]';

// Snapshot of what was open at the moment an Escape was pressed, taken
// during the capture phase (see snapshotEscapeContext) and read back during
// the bubble-phase decision (see handleEscapeKey). Safe as shared module
// state: capture always runs before bubble for the same dispatched event,
// and the next Escape's capture call always overwrites these before its own
// bubble call would read them, so there is no cross-event leakage.
let pendingDialogCount = 0;

/**
 * Capture-phase snapshot of "what's open right now". Registered on window's
 * CAPTURE phase (see initializePanicKey), which is load-bearing: a dialog's
 * own Escape handler (e.g. useFocusTrap's onEscape) closes it via a React
 * state update, and — verified live against the real app, not assumed — the
 * DOM has already been updated to remove that dialog's `role="dialog"` node
 * by the time a *bubble*-phase listener on window would run, so a query for
 * "is a dialog open right now" at that point reads a false "no". Capture
 * fires on window before the event even reaches the dialog's own bubble-phase
 * listener, so this always observes the true pre-close DOM state instead of
 * racing it. Counting (not just a boolean) is what lets handleEscapeKey tell
 * "a dialog closed" (count went down) apart from "nothing closed" (count
 * unchanged) when more than one dialog is stacked - closing the top one of
 * two must not count, but leaving both open when neither responds to Escape
 * must.
 * @param {KeyboardEvent} event
 */
const snapshotEscapeContext = (event) => {
  if (event.key !== "Escape" || event.repeat) return;
  pendingDialogCount = document.querySelectorAll(DIALOG_SELECTOR).length;
};

const recordEscapePress = () => {
  escapeKeyCount++;

  // Clear existing timer
  if (escapeTimer) {
    clearTimeout(escapeTimer);
  }

  // Check if threshold reached. Reset before firing (not just relying on
  // triggerPanicRedirect's own navigation to blow away this module's state):
  // clearTimeout above cancels whatever reset timer was pending without
  // scheduling a new one, so without this the counter would otherwise stay
  // stuck at/above the threshold forever - re-firing on every subsequent
  // Escape, single deliberate presses included, in any context where the
  // redirect doesn't actually unload the page (e.g. navigation blocked).
  if (escapeKeyCount >= ESCAPE_THRESHOLD) {
    escapeKeyCount = 0;
    triggerPanicRedirect();
    return;
  }

  // Reset count after window expires
  escapeTimer = setTimeout(() => {
    escapeKeyCount = 0;
  }, ESCAPE_WINDOW_MS);
};

/**
 * Bubble-phase decision of whether this Escape counts toward the panic
 * threshold. Registered on window's BUBBLE phase (see initializePanicKey),
 * which is load-bearing for two reasons a capture-phase decision can't
 * satisfy: `event.defaultPrevented` and whether propagation was stopped are
 * only meaningful once every other handler along the dispatch path (a
 * dialog's own handler, a document capture-phase listener like Tooltip's,
 * etc.) has had a chance to run - guaranteed by the time a bubble-phase
 * listener on window runs, since window is the last stop in the bubble
 * phase. Reading them during the capture-phase snapshot above would always
 * see false/not-stopped, since capture runs before any of those handlers
 * exist yet.
 * @param {KeyboardEvent} event
 */
const handleEscapeKey = (event) => {
  if (event.key !== "Escape" || event.repeat) return;

  // Don't count ESC presses already handled by a dialog dismissing itself
  // (or any handler that called preventDefault before this listener ran).
  // Owner decision C: only a dialog-closing Escape is exempt - a popup,
  // menu, tooltip, or combobox closing (or failing to close) still counts,
  // same as one that closes nothing, so there is no equivalent exemption
  // for them below.
  if (event.defaultPrevented) return;

  if (pendingDialogCount > 0) {
    const countAtCapture = pendingDialogCount;
    // Defer the recount a tick instead of reading it synchronously here.
    // Verified live against the real app, not assumed: a dialog's own
    // Escape handler closes it via a React state update, and browsers
    // differ on whether that update - and the DOM removal of its
    // `role="dialog"` node - has already flushed by the time a bubble-phase
    // listener on window runs for the SAME event. Chromium's has; Firefox's
    // hasn't, so reading synchronously here saw the dialog as still open and
    // counted a genuinely dialog-closing Escape as a panic press. A
    // macrotask always runs after the full synchronous dispatch (and any
    // microtask flush) completes in both engines, so it sees the true
    // post-close state either way. It also gives a *later*-registered window
    // bubble listener (e.g. a component that closes its own overlay on
    // Escape, registered after this module's listener during boot) a chance
    // to run first, instead of this recount running before that listener
    // even gets a turn and treating its dialog as still open too.
    setTimeout(() => {
      // Fewer dialogs now than at capture time means this Escape actually
      // dismissed one - don't count it, even if others remain stacked
      // underneath. The same count (or more) means nothing closed - a
      // non-dismissible dialog (CrisisModal), or one whose element-scoped
      // Escape handler never saw this event because focus never made it
      // inside (a loading-state dialog with no focusable content) - so this
      // Escape counts like any other unhandled one instead of being
      // swallowed for as long as that dialog stays open.
      if (document.querySelectorAll(DIALOG_SELECTOR).length < countAtCapture) {
        return;
      }
      recordEscapePress();
    }, 0);
    return;
  }

  recordEscapePress();
};

/**
 * Initialize the panic key listener
 * Should be called once at app startup
 */
export const initializePanicKey = () => {
  if (typeof window === "undefined") return;

  // Remove any existing listeners to prevent duplicates.
  window.removeEventListener("keydown", snapshotEscapeContext, true);
  window.removeEventListener("keydown", handleEscapeKey);

  // Capture-phase snapshot, then bubble-phase decision (see each handler's
  // doc comment for why they're split this way).
  window.addEventListener("keydown", snapshotEscapeContext, true);
  window.addEventListener("keydown", handleEscapeKey);

  // eslint-disable-next-line no-console
  console.log("🛡️ Panic key initialized (triple-tap Escape to exit)");
};

/**
 * Cleanup the panic key listener
 * Call on app unmount if needed
 */
export const cleanupPanicKey = () => {
  if (typeof window === "undefined") return;

  window.removeEventListener("keydown", snapshotEscapeContext, true);
  window.removeEventListener("keydown", handleEscapeKey);

  if (escapeTimer) {
    clearTimeout(escapeTimer);
  }
};

/**
 * Track anonymous safety feature usage
 */
const incrementSafetyUseCount = () => {
  try {
    const count = Number.parseInt(
      localStorage.getItem(SAFETY_USE_KEY) || "0",
      10,
    );
    localStorage.setItem(SAFETY_USE_KEY, String(count + 1));
  } catch (e) {
    // Silently fail - this is just UX analytics
    console.warn("Failed to update safety usage counter:", e);
  }
};

/**
 * Get safety feature usage count (for UX improvement purposes)
 * @returns {number}
 */
export const getSafetyUseCount = () => {
  try {
    return Number.parseInt(localStorage.getItem(SAFETY_USE_KEY) || "0", 10);
  } catch (e) {
    console.warn("Failed to read safety usage counter:", e);
    return 0;
  }
};

/**
 * Check if user has ever used the panic feature
 * (To potentially show additional support resources)
 * @returns {boolean}
 */
export const hasUsedPanicFeature = () => {
  return getSafetyUseCount() > 0;
};

/**
 * Mobile support: handle shake gesture for exit
 * @param {number} threshold - Shake intensity threshold
 */
export const initializeShakeToExit = (threshold = 15) => {
  if (typeof window === "undefined" || !window.DeviceMotionEvent) return;

  let lastX = 0,
    lastY = 0,
    lastZ = 0;
  let shakeCount = 0;
  let shakeTimer = null;

  const handleMotion = (event) => {
    const { x, y, z } = event.accelerationIncludingGravity || {};

    if (x === undefined) return;

    const deltaX = Math.abs(x - lastX);
    const deltaY = Math.abs(y - lastY);
    const deltaZ = Math.abs(z - lastZ);

    if (deltaX + deltaY + deltaZ > threshold) {
      shakeCount++;

      if (shakeTimer) clearTimeout(shakeTimer);

      if (shakeCount >= 3) {
        triggerPanicRedirect();
        return;
      }

      shakeTimer = setTimeout(() => {
        shakeCount = 0;
      }, 1000);
    }

    lastX = x;
    lastY = y;
    lastZ = z;
  };

  window.addEventListener("devicemotion", handleMotion);

  return () => {
    window.removeEventListener("devicemotion", handleMotion);
  };
};

/**
 * Add a visible "Quick Exit" button to the page
 * @param {HTMLElement} container - Container element to append button to
 * @returns {HTMLElement} - The created button element
 */
export const createQuickExitButton = (container = document.body) => {
  if (typeof document === "undefined") return null;

  // Check if button already exists
  const existing = document.getElementById("vetrate-quick-exit");
  if (existing) return existing;

  const button = document.createElement("button");
  button.id = "vetrate-quick-exit";
  button.textContent = "Quick Exit";
  button.setAttribute("aria-label", "Quick exit - immediately leave this page");
  button.setAttribute(
    "title",
    "Click to quickly exit this page (or press Escape 3 times)",
  );

  // Styling
  Object.assign(button.style, {
    position: "fixed",
    top: "10px",
    right: "10px",
    zIndex: "99999",
    padding: "8px 16px",
    backgroundColor: "#64748b",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    opacity: "0.7",
    transition: "opacity 0.2s",
  });

  // Hover effect
  button.addEventListener("mouseenter", () => {
    button.style.opacity = "1";
  });
  button.addEventListener("mouseleave", () => {
    button.style.opacity = "0.7";
  });

  // Click handler
  button.addEventListener("click", triggerPanicRedirect);

  container.appendChild(button);

  return button;
};

/**
 * Remove the quick exit button
 */
export const removeQuickExitButton = () => {
  const button = document.getElementById("vetrate-quick-exit");
  if (button) {
    button.remove();
  }
};

// Auto-initialize panic key when module loads (browser only)
if (typeof window !== "undefined") {
  // Wait for DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializePanicKey);
  } else {
    initializePanicKey();
  }
}

export default {
  triggerPanicRedirect,
  triggerSoftExit,
  initializePanicKey,
  cleanupPanicKey,
  getSafetyUseCount,
  hasUsedPanicFeature,
  initializeShakeToExit,
  createQuickExitButton,
  removeQuickExitButton,
};
