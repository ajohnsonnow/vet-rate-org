import { useState } from "react";
import { triggerPanicRedirect, triggerSoftExit } from "../utils/safetyRedirect";
import ResponsiveModal from "./common/ResponsiveModal";

const SubtleExit = ({
  posClass,
  className,
  isHovered,
  setIsHovered,
  showConfirm,
  setShowConfirm,
  handleClick,
  confirmExit,
}) => (
  <>
    <button
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`${posClass} z-[9999] px-3 py-1.5 text-xs
        ${isHovered ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-400"}
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
        This will immediately redirect you to a neutral website (weather.com).
      </p>
    </ResponsiveModal>
  </>
);

const VisibleExit = ({ posClass, className, handleClick }) => (
  <button
    onClick={handleClick}
    className={`${posClass} z-[9999] px-4 py-2
      bg-slate-700 hover:bg-red-600 text-white text-sm font-medium
      rounded-lg transition-all shadow-lg hover:shadow-red-500/20
      ${className}`}
    aria-label="Quick exit - immediately leave this page"
  >
    ✕ Quick Exit
  </button>
);

const FloatingExit = ({
  posClass,
  className,
  isHovered,
  setIsHovered,
  handleClick,
}) => (
  <button
    onClick={handleClick}
    onMouseEnter={() => setIsHovered(true)}
    onMouseLeave={() => setIsHovered(false)}
    className={`${posClass} z-[9999]
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

  // Position styles.
  //
  // "top-right" is mobile-aware: every tool dialog in this app renders
  // full-bleed edge-to-edge below the `sm` breakpoint (ResponsiveModal
  // switches from full-bleed to a centered, padded panel at `sm:`, see
  // ResponsiveModal.jsx) and puts its own close-X in that same top-right
  // corner. A `fixed` top-right Quick Exit sits in front of (higher
  // z-index than) every dialog, so on phones it silently swallowed taps
  // meant for the dialog's own close button (QA S46). Anchoring to
  // top-left below `sm` clears every dialog close-X without touching
  // any of their headers - the same breakpoint ResponsiveModal itself
  // uses to stop being edge-to-edge, so the two rules line up by
  // construction rather than by a guessed pixel offset. Quick Exit
  // itself must never be hidden or removed while a dialog is open (it
  // is the panic-exit safety net), so this repositions it instead of
  // suppressing it the way the AI bubble / bug button are suppressed
  // (see `.above-mobile-nav` in index.css).
  //
  // Moving this swap to `md:` instead (so hand-built dialogs whose own
  // mobile header survives past `sm:` - UserManual, AboutUs - would clear
  // Quick Exit without touching those files) was tried and reverted: it
  // regresses ClaimNavigator, which keeps its title/icon flush at the
  // screen's top-left below `md:` (its own `pt-20 sm:pt-0` assumes Quick
  // Exit is already on the *right* by `sm:`) - measured collision at
  // 640x800 (icon {l:16,t:22,r:40,b:46} inside Quick Exit's top-left
  // {l:12,t:12,r:90,b:60}). Fixing UserManual/AboutUs this way would only
  // trade one dialog's collision for another's; see openIssues.
  //
  // At `sm:` and up this box moves back to top-right and stays fixed there
  // regardless of dialog size - short, wide desktop viewports can still pin a
  // centered dialog's top (and its close-X) close enough to the top-right
  // corner to reach it (measured at 1024x768/1280x720). That side of the fix
  // lives in ResponsiveModal.jsx's shared `sm:!mt-16` gutter instead of a
  // second reposition here, for the same reason the mobile gutter above
  // isn't a title-bar patch: it has to clear whatever a given tool's header
  // renders, and only the shared shell sees every dialog.
  const positions = {
    "top-right": "fixed top-3 left-3 sm:left-auto sm:right-3",
    "top-left": "fixed top-3 left-3",
    "bottom-right": "fixed bottom-3 right-3",
    "bottom-left": "fixed bottom-3 left-3",
    floating: "fixed bottom-28 right-4",
  };
  const posClass = positions[position];

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
      <SubtleExit
        posClass={posClass}
        className={className}
        isHovered={isHovered}
        setIsHovered={setIsHovered}
        showConfirm={showConfirm}
        setShowConfirm={setShowConfirm}
        handleClick={handleClick}
        confirmExit={confirmExit}
      />
    );
  }

  // Visible variant
  if (variant === "visible") {
    return (
      <VisibleExit
        posClass={posClass}
        className={className}
        handleClick={handleClick}
      />
    );
  }

  // Floating variant (larger, more accessible)
  if (variant === "floating") {
    return (
      <FloatingExit
        posClass={posClass}
        className={className}
        isHovered={isHovered}
        setIsHovered={setIsHovered}
        handleClick={handleClick}
      />
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
