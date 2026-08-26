/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * useFocusTrap — keep keyboard focus inside an overlay while it is open,
 * close on Escape, and restore focus to the opener on teardown. WCAG 2.2
 * 2.4.3 (Focus Order) + 2.1.2 (No Keyboard Trap, the escape hatch).
 */

import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "details",
  "summary",
  "iframe",
  "[contenteditable='true']",
].join(",");

/**
 * @param {{current: HTMLElement|null}} ref - container to trap focus within
 * @param {{active?: boolean, onEscape?: (e: KeyboardEvent) => void,
 *   autoFocus?: boolean}} [options]
 */
export function useFocusTrap(
  ref,
  { active = true, onEscape, autoFocus = true } = {},
) {
  const restoreRef = useRef(null);
  const onEscapeRef = useRef(onEscape);

  // Read onEscape through a ref so it is NOT an effect dependency. Callers
  // overwhelmingly pass an inline arrow (`onEscape={() => setOpen(false)}`),
  // which changes identity on every parent render. As a dependency that tore
  // the trap down and rebuilt it mid-life, and each rebuild re-captured
  // restoreRef from the live activeElement - by then an element *inside* the
  // dialog - so closing restored focus to a detached node and dropped it to
  // <body>. The effect must run on open and clean up on close, nothing else.
  useEffect(() => {
    onEscapeRef.current = onEscape;
  });

  useEffect(() => {
    const node = ref.current;
    if (!active || !node) return undefined;

    restoreRef.current =
      typeof document !== "undefined" ? document.activeElement : null;

    const focusables = () =>
      Array.from(node.querySelectorAll(FOCUSABLE)).filter(
        (el) =>
          !el.hasAttribute("disabled") &&
          el.getAttribute("aria-hidden") !== "true",
      );

    if (autoFocus) {
      const items = focusables();
      (items[0] || node).focus?.();
    }

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        onEscapeRef.current?.(e);
        return;
      }
      if (e.key !== "Tab") return;

      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        node.focus?.();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;

      if (e.shiftKey) {
        if (current === first || !node.contains(current)) {
          e.preventDefault();
          last.focus();
        }
      } else if (current === last || !node.contains(current)) {
        e.preventDefault();
        first.focus();
      }
    };

    node.addEventListener("keydown", onKeyDown);
    return () => {
      node.removeEventListener("keydown", onKeyDown);
      const opener = restoreRef.current;
      if (opener && typeof opener.focus === "function") opener.focus();
    };
  }, [ref, active, autoFocus]);
}

export default useFocusTrap;
