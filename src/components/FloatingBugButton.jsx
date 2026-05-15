import React, { useState, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { Tooltip } from "./common/Tooltip";

/**
 * Floating Bug Report Button
 * A fixed-position button that's accessible from anywhere in the app
 */
function FloatingBugButton({ onClick }) {
  const { t } = useLanguage();
  const [showTooltip, setShowTooltip] = useState(false);

  // Show tooltip on first visit
  useEffect(() => {
    const hasSeenTooltip = sessionStorage.getItem("bugButtonTooltipSeen");
    if (!hasSeenTooltip) {
      const timer = setTimeout(() => {
        setShowTooltip(true);
        setTimeout(() => {
          setShowTooltip(false);
          sessionStorage.setItem("bugButtonTooltipSeen", "true");
        }, 5000);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Keyboard shortcut: Ctrl/Cmd + Shift + B
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "b"
      ) {
        e.preventDefault();
        onClick();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClick]);

  return (
    <div className="fixed bottom-24 left-4 z-50 flex flex-col items-start gap-2">
      {/* Tooltip */}
      {showTooltip && (
        <div className="bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-lg animate-fade-in max-w-xs">
          <p>🐛 Found a bug? Click here to report it!</p>
          <p className="text-xs text-gray-400 mt-1">Or press Ctrl+Shift+B</p>
          <div className="absolute bottom-0 left-6 transform translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
        </div>
      )}

      {/* Bug Button */}
      <Tooltip content="Report a Bug (Ctrl+Shift+B)" placement="right">
        <button
          onClick={onClick}
          className="group bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-red-300 dark:focus:ring-red-800"
          aria-label="Report a bug (Ctrl+Shift+B)"
        >
          <svg
            className="w-6 h-6 transform group-hover:rotate-12 transition-transform"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>

          {/* Bug Icon Overlay */}
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center">
            <span className="text-xs">🐛</span>
          </span>
        </button>
      </Tooltip>
    </div>
  );
}

export default FloatingBugButton;
