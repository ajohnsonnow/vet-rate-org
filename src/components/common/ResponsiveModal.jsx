/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 *
 * ResponsiveModal — the mobile-first modal shell for the S9–S17 cycle.
 *
 * Phones: full-bleed sheet at 100dvh (the dynamic viewport keeps the footer
 * CTA above the URL bar). >=640px: centered, rounded, capped by `size`.
 * Single scroll region (body) with sticky header + sticky footer so the
 * primary action is always reachable without scrolling. Body scroll lock +
 * focus trap + dialog semantics are wired in.
 *
 * Migration target for the legacy `max-w-* + max-h-[90vh]` modals
 * (docs/SPRINT_PLAN_S9-S17.md, Layer 3).
 */

import { useRef, useId } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import useBodyScrollLock from "../../utils/useBodyScrollLock";
import useFocusTrap from "../../hooks/useFocusTrap";

// Desktop ceiling only — phones are always full width.
const SIZE = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
  "2xl": "sm:max-w-6xl",
  full: "sm:max-w-[95vw]",
};

export default function ResponsiveModal({
  isOpen,
  onClose,
  title,
  size = "lg",
  children,
  footer,
  closeOnBackdrop = true,
  labelledBy,
  className = "",
}) {
  const panelRef = useRef(null);
  const generatedId = useId();
  const titleId = labelledBy || `responsive-modal-${generatedId}`;

  useBodyScrollLock(isOpen);
  useFocusTrap(panelRef, { active: isOpen, onEscape: onClose });

  if (!isOpen) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={`modal-content relative flex w-full max-w-full flex-col bg-white shadow-2xl dark:bg-gray-900 h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[90dvh] sm:rounded-2xl ${
          SIZE[size] || SIZE.lg
        } ${className}`}
      >
        {title && (
          <header className="modal-header sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
            <h2
              id={titleId}
              className="text-lg font-semibold text-gray-900 dark:text-white"
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </header>
        )}

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {children}
        </div>

        {footer && (
          <footer
            className="modal-footer sticky bottom-0 z-10 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95"
            style={{
              paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
            }}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
