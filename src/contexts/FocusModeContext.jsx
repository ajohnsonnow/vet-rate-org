/**
 * Vet-Rate.org - Focus Mode Context
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * "The Blinders" - Reduces cognitive load for TBI/ADHD users
 *
 * Many veterans have Traumatic Brain Injury or ADHD. A cluttered screen is their enemy.
 * This context provides a Focus Mode that dims everything except the current input field.
 */

import { createContext, useContext, useState, useEffect } from "react";

const FocusModeContext = createContext();

export function useFocusMode() {
  const context = useContext(FocusModeContext);
  if (!context) {
    throw new Error("useFocusMode must be used within FocusModeProvider");
  }
  return context;
}

export function FocusModeProvider({ children }) {
  const [focusMode, setFocusMode] = useState(() => {
    // Load from localStorage
    const saved = localStorage.getItem("vetrate-focus-mode");
    return saved === "true";
  });

  const [focusedElement, setFocusedElement] = useState(null);

  // Save to localStorage when changed
  useEffect(() => {
    localStorage.setItem("vetrate-focus-mode", focusMode.toString());
  }, [focusMode]);

  // Apply CSS class to body
  useEffect(() => {
    if (focusMode) {
      document.body.classList.add("focus-mode");
    } else {
      document.body.classList.remove("focus-mode");
    }
  }, [focusMode]);

  // ESC key to exit focus mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && focusMode) {
        // eslint-disable-next-line no-console
        console.log("🎯 ESC pressed - exiting focus mode");
        setFocusMode(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [focusMode]);

  const toggleFocusMode = () => {
    // eslint-disable-next-line no-console
    console.log(
      "🎯 Toggle clicked, current:",
      focusMode,
      "-> new:",
      !focusMode,
    );
    setFocusMode((prev) => !prev);
  };

  const setFocus = (elementId) => {
    setFocusedElement(elementId);
  };

  const clearFocus = () => {
    setFocusedElement(null);
  };

  return (
    <FocusModeContext.Provider
      value={{
        focusMode,
        toggleFocusMode,
        focusedElement,
        setFocus,
        clearFocus,
      }}
    >
      {children}
    </FocusModeContext.Provider>
  );
}

/**
 * FocusWrapper Component
 * Wrap any input/textarea with this to enable focus mode dimming
 *
 * @example
 * <FocusWrapper id="claim-description">
 *   <textarea />
 * </FocusWrapper>
 */
export function FocusWrapper({ id, children }) {
  const { focusMode, focusedElement, setFocus, clearFocus } = useFocusMode();

  const isFocused = focusedElement === id;
  const isDimmed = focusMode && focusedElement && !isFocused;

  return (
    <div
      className={`transition-opacity duration-300 ${isDimmed ? "opacity-10" : "opacity-100"}`}
      onFocus={() => focusMode && setFocus(id)}
      onBlur={() => focusMode && clearFocus()}
    >
      {children}
    </div>
  );
}

/**
 * FocusToggle Component
 * Modal header focus toggle with variant support
 */
export function FocusToggle({ variant = "dark", className = "" }) {
  const { focusMode, toggleFocusMode } = useFocusMode();

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // eslint-disable-next-line no-console
    console.log("🎯 Focus toggle clicked, current mode:", focusMode);
    toggleFocusMode();
  };

  const styles =
    variant === "light"
      ? "text-white/90 hover:text-white hover:bg-white/20"
      : "text-gray-400 hover:text-white hover:bg-gray-700";

  return (
    <button
      onClick={handleClick}
      onMouseDown={(e) => e.stopPropagation()}
      className={`focus-exempt p-2 rounded-lg transition-all duration-200 ${styles} ${className} ${
        focusMode ? "ring-2 ring-blue-400 bg-blue-600/20" : ""
      }`}
      aria-label={focusMode ? "Disable Focus Mode" : "Enable Focus Mode"}
      style={{ zIndex: 9999, position: "relative" }}
    >
      <span className="text-lg">{focusMode ? "🔍" : "👁️"}</span>
      {focusMode && (
        <span className="sr-only">Focus mode active - Press ESC to exit</span>
      )}
    </button>
  );
}

/**
 * FocusModeToggle Component
 * Button to toggle focus mode on/off
 */
export function FocusModeToggle() {
  const { focusMode, toggleFocusMode } = useFocusMode();

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // eslint-disable-next-line no-console
    console.log("🎯 Focus toggle button clicked!");
    toggleFocusMode();
  };

  // When focus mode is ON, show a prominent EXIT button at top-right
  // When OFF, show subtle toggle at bottom-right
  return (
    <button
      onClick={handleClick}
      onMouseDown={(e) => e.stopPropagation()}
      className={`focus-mode-toggle fixed p-3 rounded-full shadow-lg transition-all ${
        focusMode
          ? "top-24 right-4 bg-red-600 hover:bg-red-500 text-white ring-4 ring-red-300 ring-opacity-70 animate-pulse"
          : "top-24 right-4 bg-gray-700 hover:bg-gray-600 text-gray-300"
      }`}
      style={{
        zIndex: 99999,
        pointerEvents: "auto",
        opacity: 1,
        position: "fixed",
      }}
      aria-label={focusMode ? "Disable Focus Mode" : "Enable Focus Mode"}
    >
      <div className="flex items-center gap-2 pointer-events-none">
        <span className="text-2xl">{focusMode ? "❌" : "👁️"}</span>
        <span
          className={`text-sm font-bold ${focusMode ? "inline" : "hidden sm:inline"}`}
        >
          {focusMode ? "EXIT FOCUS" : "Focus"}
        </span>
      </div>
    </button>
  );
}

/**
 * Add CSS for focus mode to your global CSS:
 *
 * .focus-mode {
 *   // Base dimming for all elements
 * }
 *
 * .focus-mode .focus-exempt {
 *   // Elements that should never be dimmed
 *   opacity: 1 !important;
 * }
 */

export default FocusModeContext;
