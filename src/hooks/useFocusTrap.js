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

// Excludes descendants the browser won't actually let focus() land on - most
// commonly a `hidden sm:flex` toggle that's `display:none` below the
// dialog's own responsive breakpoint. `display` isn't inherited, so checking
// only the candidate's own computed style misses the common case where the
// *candidate itself* has no display override but an ancestor wrapper (the
// `hidden sm:flex` div, not the button inside it) does - this walks from the
// candidate up to `node` checking each ancestor. Not `offsetParent`, which
// jsdom always reports as null with no real layout engine, breaking this
// same check under vitest; `getComputedStyle` reads the resolved style
// instead, so an unstyled test fixture still measures as visible.
function isRendered(el, node) {
  for (let current = el; current; current = current.parentElement) {
    const style = window.getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    if (current === node) break;
  }
  return true;
}

function getFocusables(node) {
  return Array.from(node.querySelectorAll(FOCUSABLE)).filter(
    (el) =>
      !el.hasAttribute("disabled") &&
      el.getAttribute("aria-hidden") !== "true" &&
      isRendered(el, node),
  );
}

/**
 * Some callers (VKBViewer, TheTribunal) activate the trap while still
 * loading, rendering a bare shell with nothing focusable yet, so the initial
 * autoFocus attempt lands on `node` itself (no tabindex here, so it silently
 * no-ops) and leaves focus on whatever opened the dialog. `active` never
 * flips for a loading->loaded transition (it's the same open dialog
 * throughout), so without this, focus would never move in once real content
 * renders - and the Escape handler below is bound to `node` and relies on
 * bubbling, so it never sees a keydown fired at focus sitting outside
 * `node`. Watching for content gives autoFocus a second, later chance
 * instead of only the one at activation. Skipped once focus is already
 * meaningfully inside `node` (not `node` itself) so a veteran who tabbed to
 * a real field doesn't get yanked back by an unrelated re-render.
 */
function watchForFocusableContent(node) {
  const observer = new MutationObserver(() => {
    if (
      node.contains(document.activeElement) &&
      document.activeElement !== node
    ) {
      return;
    }
    const items = getFocusables(node);
    if (items.length > 0) {
      items[0].focus();
      observer.disconnect();
    }
  });
  observer.observe(node, { childList: true, subtree: true });
  return observer;
}

function handleTabKey(e, node) {
  const items = getFocusables(node);
  if (items.length === 0) {
    e.preventDefault();
    node.focus?.();
    return;
  }

  const first = items[0];
  const last = items.at(-1);
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
}

const DIALOG_CONTAINER_SELECTOR = '[role="dialog"], [aria-modal="true"]';

// Every trap that's currently active, in activation order (push on mount,
// splice out on unmount) — last entry is the topmost/innermost dialog.
// Module-scoped, not per-hook-instance: ResponsiveModal portals every dialog
// straight to document.body, so a "nested" dialog (e.g. Muster Call's
// Intelligence Briefing opened on top of Muster Call itself) is a DOM
// *sibling* of its opener, not a descendant — a bubbling keydown listener on
// the briefing's own node never reaches Muster Call's node and vice versa.
// Escape is handled once, centrally, for whichever trap is topmost, instead
// of per-node — see the document-level listener below.
const escapeTrapStack = [];

function handleTopmostEscape(e) {
  if (e.key !== "Escape") return;
  escapeTrapStack.at(-1)?.onEscapeRef.current?.(e);
}

function pushEscapeTrap(entry) {
  if (typeof document === "undefined") return;
  escapeTrapStack.push(entry);
  if (escapeTrapStack.length === 1) {
    document.addEventListener("keydown", handleTopmostEscape);
  }
}

function popEscapeTrap(entry) {
  if (typeof document === "undefined") return;
  const index = escapeTrapStack.indexOf(entry);
  if (index !== -1) escapeTrapStack.splice(index, 1);
  if (escapeTrapStack.length === 0) {
    document.removeEventListener("keydown", handleTopmostEscape);
  }
}

// Same-tree bubbling handles Escape for whichever trap is topmost even when
// focus never made it past `document` (e.g. a loading-state dialog with no
// focusable content yet) — but the deciding case this exists for is teardown
// focus landing on <body>, which is *inside* `document` and so still reaches
// this listener, unlike the old node-scoped one.
function findNearestMountedDialog(excludeNode) {
  const dialogs = document.querySelectorAll(DIALOG_CONTAINER_SELECTOR);
  for (let i = dialogs.length - 1; i >= 0; i--) {
    if (dialogs[i] !== excludeNode) return dialogs[i];
  }
  return null;
}

function restoreFocusOnTeardown(node, restoreRef) {
  const opener = restoreRef.current;
  // A nested dialog's opener can legitimately leave the DOM before the
  // nested dialog itself closes (e.g. Muster Call swaps its whole formation
  // view out from under the Intelligence Briefing while it's still open) —
  // calling .focus() on a detached element silently no-ops, dropping focus
  // to <body> instead of restoring it anywhere useful.
  //
  // <body>/<html> are excluded even though both pass `document.contains` and
  // have a real `.focus`: this trap activating while focus had already
  // fallen to <body> (e.g. a still-mounted outer dialog whose last focused
  // control just unmounted) is not a real "opener" worth restoring to - the
  // fallback below, into the nearest still-mounted dialog, is strictly
  // better than leaving/returning focus to the page body while that dialog
  // is still open.
  if (
    opener &&
    opener !== document.body &&
    opener !== document.documentElement &&
    document.contains(opener) &&
    typeof opener.focus === "function"
  ) {
    opener.focus();
    return;
  }
  const fallback = findNearestMountedDialog(node);
  if (!fallback) return;
  const items = getFocusables(fallback);
  (items[0] || fallback).focus?.();
}

function attachFocusTrap(node, { autoFocus, onEscapeRef, restoreRef }) {
  restoreRef.current =
    typeof document !== "undefined" ? document.activeElement : null;

  if (autoFocus) {
    const items = getFocusables(node);
    (items[0] || node).focus?.();
  }

  const contentObserver = autoFocus ? watchForFocusableContent(node) : null;

  const onKeyDown = (e) => {
    if (e.key !== "Tab") return;
    handleTabKey(e, node);
  };

  node.addEventListener("keydown", onKeyDown);
  const trapEntry = { onEscapeRef };
  pushEscapeTrap(trapEntry);

  return () => {
    contentObserver?.disconnect();
    node.removeEventListener("keydown", onKeyDown);
    popEscapeTrap(trapEntry);
    restoreFocusOnTeardown(node, restoreRef);
  };
}

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
    return attachFocusTrap(node, { autoFocus, onEscapeRef, restoreRef });
  }, [ref, active, autoFocus]);
}

export default useFocusTrap;
