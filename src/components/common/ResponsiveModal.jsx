/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * ResponsiveModal — the mobile-first modal shell for the S9–S17 cycle.
 *
 * Phones: full-bleed sheet at 100dvh (the dynamic viewport keeps the footer
 * CTA above the URL bar). >=640px: centered, rounded, capped by `size`.
 * Single scroll region (body) with sticky header + sticky footer so the
 * primary action is always reachable without scrolling. Body scroll lock +
 * focus trap + dialog semantics are wired in.
 *
 * Two header modes: pass `title` for the default bar (heading + close-X), or
 * `header` for a custom full-bleed bar (gradient gates, urgency states) — then
 * pass `labelledBy` pointing at the heading id inside it. `showClose` hides the
 * default close-X, `dismissable={false}` removes ESC/backdrop close (mandatory
 * consent gates), `zIndex` lifts nested children above their parent shell, and
 * `backdropClassName` overrides the default scrim (e.g. a branded gradient).
 *
 * Migration target for the legacy `max-w-* + max-h-[90vh]` modals
 * (docs/SPRINT_PLAN_S9-S17.md, Layer 3).
 */

import { useEffect, useRef, useState, useId } from "react";
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

// Tracks whether the modal body actually overflows so the scroll-region
// tabIndex is only applied when content overflows (see the tabIndex comment
// below).
function useBodyScrollable(bodyRef, isOpen, children) {
  const [bodyScrollable, setBodyScrollable] = useState(false);

  useEffect(() => {
    const el = bodyRef.current;
    if (!isOpen || !el) return undefined;
    const measure = () => setBodyScrollable(el.scrollHeight > el.clientHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isOpen, children, bodyRef]);

  return bodyScrollable;
}

function ModalHeader({ header, title, titleId, showClose, onClose }) {
  if (header) {
    // Custom full-bleed bar. `.modal-header` exempts it from the <768px
    // `.modal-content > div` body-padding rule in index.css; `!p-0` clears
    // the mobile `.modal-header` padding so the bar reaches every edge.
    return <div className="modal-header sticky top-0 z-10 !p-0">{header}</div>;
  }

  if (!title) return null;

  return (
    <header className="modal-header sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
      <h2
        id={titleId}
        className="text-lg font-semibold text-gray-900 dark:text-white"
      >
        {title}
      </h2>
      {showClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </header>
  );
}

export default function ResponsiveModal({
  isOpen,
  onClose,
  title,
  header,
  showClose = true,
  dismissable = true,
  zIndex = 60,
  size = "lg",
  children,
  footer,
  closeOnBackdrop = true,
  labelledBy,
  className = "",
  backdropClassName = "",
}) {
  const panelRef = useRef(null);
  const bodyRef = useRef(null);
  const generatedId = useId();
  const titleId = labelledBy || `responsive-modal-${generatedId}`;
  const bodyScrollable = useBodyScrollable(bodyRef, isOpen, children);

  useBodyScrollLock(isOpen);
  useFocusTrap(panelRef, {
    active: isOpen,
    onEscape: dismissable ? onClose : undefined,
  });

  if (!isOpen) return null;

  const modal = (
    <div /* eslint-disable-line jsx-a11y/no-static-element-interactions */
      className={`fixed inset-0 flex items-stretch justify-center backdrop-blur-sm sm:items-center sm:p-4 ${
        backdropClassName || "bg-black/60"
      }`}
      style={{ zIndex }}
      onMouseDown={(e) => {
        if (dismissable && closeOnBackdrop && e.target === e.currentTarget)
          onClose?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title || labelledBy ? titleId : undefined}
        className={`modal-content relative flex w-full max-w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-gray-900 h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[90dvh] sm:rounded-2xl ${
          SIZE[size] || SIZE.lg
        } ${className}`}
      >
        <ModalHeader
          header={header}
          title={title}
          titleId={titleId}
          showClose={showClose}
          onClose={onClose}
        />

        {/* tabIndex=0 gives keyboard users arrow-key access to the scroll region
            even when a modal's body holds no focusable control (axe
            scrollable-region-focusable). Applied only when content actually
            overflows so fitting content adds no pointless tab stop. */}
        <div
          ref={bodyRef}
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={bodyScrollable ? 0 : undefined}
          className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
        >
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
