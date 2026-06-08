import { useState } from "react";
import { triggerPanicRedirect, triggerSoftExit } from "../utils/safetyRedirect";
import ResponsiveModal from "./common/ResponsiveModal";

/**
 * QuickExitButton Component
 *
 * Persistent "escape hatch" button for trauma-informed safety.
 * Provides instant access to hide the app when needed.
 */
const QuickExitButton = ({
  position = "top-right", // top-right, top-left, bottom-right, bottom-left, floating
  variant = "subtle", // subtle, visible, floating
  _showTooltip = true,
  className = "",
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Position styles
  const positions = {
    "top-right": "fixed top-3 right-3",
    "top-left": "fixed top-3 left-3",
    "bottom-right": "fixed bottom-3 right-3",
    "bottom-left": "fixed bottom-3 left-3",
    floating: "fixed bottom-28 right-4",
  };

  // Handle click - show confirm for subtle variant, immediate for others
  const handleClick = () => {
    if (variant === "subtle") {
      setShowConfirm(true);
    } else {
      triggerPanicRedirect();
    }
  };

  // Confirm exit
  const confirmExit = () => {
    setShowConfirm(false);
    triggerPanicRedirect();
  };

  // Subtle variant
  if (variant === "subtle") {
    return (
      <>
        <button
          onClick={handleClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={`${positions[position]} z-[9999] px-3 py-1.5 text-xs 
            ${isHovered ? "bg-slate-700 text-white" : "bg-slate-800/50 text-slate-400"}
            border border-slate-700 rounded-md transition-all hover:border-slate-600
            ${className}`}
          aria-label="Quick exit - immediately leave this page"
        >
          {isHovered ? "✕ Exit Now" : "Quick Exit"}
        </button>

        {/* Confirmation Modal */}
        <ResponsiveModal
          isOpen={showConfirm}
          onClose={() => setShowConfirm(false)}
          labelledBy="quick-exit-confirm-title"
          size="sm"
          zIndex={99999}
          footer={
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={confirmExit}
                className="flex-1 rounded-lg bg-red-600 py-2 text-white transition-colors hover:bg-red-700"
              >
                Exit
              </button>
            </div>
          }
        >
          <h3
            id="quick-exit-confirm-title"
            className="mb-3 font-bold text-gray-900 dark:text-white"
          >
            Exit Now?
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This will immediately redirect you to a neutral website
            (weather.com).
          </p>
        </ResponsiveModal>
      </>
    );
  }

  // Visible variant
  if (variant === "visible") {
    return (
      <button
        onClick={handleClick}
        className={`${positions[position]} z-[9999] px-4 py-2 
          bg-slate-700 hover:bg-red-600 text-white text-sm font-medium
          rounded-lg transition-all shadow-lg hover:shadow-red-500/20
          ${className}`}
        aria-label="Quick exit - immediately leave this page"
      >
        ✕ Quick Exit
      </button>
    );
  }

  // Floating variant (larger, more accessible)
  if (variant === "floating") {
    return (
      <button
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`${positions[position]} z-[9999] 
          ${isHovered ? "w-auto px-4" : "w-12"} h-12
          bg-slate-800 hover:bg-red-600 text-white
          rounded-full transition-all duration-200 shadow-xl
          border border-slate-700 hover:border-red-500
          flex items-center justify-center overflow-hidden
          ${className}`}
        aria-label="Quick exit - immediately leave this page"
      >
        <span className="text-lg">{isHovered ? "✕" : "🚪"}</span>
        {isHovered && (
          <span className="ml-2 text-sm font-medium whitespace-nowrap">
            Exit Now
          </span>
        )}
      </button>
    );
  }

  return null;
};

/**
 * Hook to programmatically control quick exit behavior
 */
export const useQuickExit = () => {
  const exit = () => triggerPanicRedirect();
  const softExit = () => triggerSoftExit();

  return { exit, softExit };
};

export default QuickExitButton;
