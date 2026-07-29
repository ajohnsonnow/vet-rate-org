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
const ESCAPE_THRESHOLD = 3;
const ESCAPE_WINDOW_MS = 600; // Must tap 3 times within 600ms

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

/**
 * Handle keydown events for triple-escape detection
 * @param {KeyboardEvent} event
 */
const handleEscapeKey = (event) => {
  if (event.key !== "Escape") return;

  // Don't count ESC presses that are dismissing an open dialog/modal.
  // Those are consumed by the dialog — not a panic-exit gesture.
  // Only rapid ESC presses with NO modal open count toward the threshold.
  if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return;

  escapeKeyCount++;

  // Clear existing timer
  if (escapeTimer) {
    clearTimeout(escapeTimer);
  }

  // Check if threshold reached
  if (escapeKeyCount >= ESCAPE_THRESHOLD) {
    triggerPanicRedirect();
    return;
  }

  // Reset count after window expires
  escapeTimer = setTimeout(() => {
    escapeKeyCount = 0;
  }, ESCAPE_WINDOW_MS);
};

/**
 * Initialize the panic key listener
 * Should be called once at app startup
 */
export const initializePanicKey = () => {
  if (typeof window === "undefined") return;

  // Remove any existing listener to prevent duplicates
  window.removeEventListener("keydown", handleEscapeKey);

  // Add listener
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
    const count = parseInt(localStorage.getItem(SAFETY_USE_KEY) || "0", 10);
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
    return parseInt(localStorage.getItem(SAFETY_USE_KEY) || "0", 10);
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
