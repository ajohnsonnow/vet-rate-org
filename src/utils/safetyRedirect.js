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

    // 4. Increment safety use counter (anonymous UX metric)
    incrementSafetyUseCount();

    // 5. Dispatch event for any listeners (e.g., analytics)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("vetrate:panic-triggered"));
    }

    // 6. Redirect to neutral site using replace (no back button)
    window.location.replace(SAFE_REDIRECT_URL);
  } catch (error) {
    // Failsafe: even if something errors, still redirect
    console.error("Panic redirect error (still redirecting):", error);
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
// covers the mobile nav drawer) always close synchronously in response to
// their own Escape handler (useFocusTrap's onEscape or equivalent) - trust
// that and never count an Escape that lands while one is open.
const DIALOG_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [aria-modal="true"]';

// Open disclosure menus/popovers (Header's Tools/Resources dropdowns,
// AccessibilityMenu, SearchBar's combobox — this repo's convention is
// `aria-haspopup` + `aria-expanded="true"` together on the trigger). Unlike
// dialogs, NOT every one of these actually closes on Escape - Header's Tools
// and Resources dropdowns only close on blur or a second trigger click, and
// have no Escape handler at all. Treating "open" as automatically "will be
// handled elsewhere" left the panic key permanently dead for as long as one
// of those was open (see safetyRedirect.test.js). So this selector only gets
// a deferred, verified exemption (see handleEscapeKey) rather than an
// immediate one. Deliberately narrower than every `aria-expanded="true"` in
// the app: a plain accordion/disclosure section (VersionDropdown's
// changelog, SystemRequirementsNotice's ExpandSection) sets `aria-expanded`
// with no `aria-haspopup` and must NOT suppress a genuine panic Escape just
// because a veteran left an unrelated accordion open somewhere on the page.
const MENU_POPOVER_SELECTOR = '[aria-haspopup][aria-expanded="true"]';

// Snapshot of what was open at the moment an Escape was pressed, taken
// during the capture phase (see snapshotEscapeContext) and read back during
// the bubble-phase decision (see handleEscapeKey). Safe as shared module
// state: capture always runs before bubble for the same dispatched event,
// and the next Escape's capture call always overwrites these before its own
// bubble call would read them, so there is no cross-event leakage.
let pendingDialogOpen = false;
let pendingMenuTrigger = null;

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
 * racing it.
 * @param {KeyboardEvent} event
 */
const snapshotEscapeContext = (event) => {
  if (event.key !== "Escape" || event.repeat) return;
  pendingDialogOpen = !!document.querySelector(DIALOG_SELECTOR);
  pendingMenuTrigger = pendingDialogOpen
    ? null
    : document.querySelector(MENU_POPOVER_SELECTOR);
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

  // Don't count ESC presses already handled by something else (a dialog
  // dismissing itself, or any handler that called preventDefault or stopped
  // propagation before this listener ran). Only rapid ESC presses with
  // nothing open - or open behind a menu/popover that doesn't actually
  // respond to Escape - count toward the panic threshold.
  if (event.defaultPrevented) return;
  if (pendingDialogOpen) return;

  if (pendingMenuTrigger) {
    const trigger = pendingMenuTrigger;
    // Give the menu one tick to actually close in response to this Escape.
    // If it's still expanded afterward, nothing consumed the keypress, so
    // count it like any other unhandled Escape instead of swallowing it
    // forever.
    setTimeout(() => {
      if (
        trigger.isConnected &&
        trigger.getAttribute("aria-expanded") === "true"
      ) {
        recordEscapePress();
      }
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
