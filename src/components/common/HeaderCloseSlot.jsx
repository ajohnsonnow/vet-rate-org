/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Pins a dialog header's close control in the top-right corner at every
 * width (WCAG 3.2.4 consistent identification - users expect the × there,
 * every tool, every time). `children` (title, badges, "Bug?"/share/AI-status,
 * etc.) live in their own wrapping, min-w-0 column that drops to additional
 * lines when the header is too narrow; `close` sits outside that column so it
 * never wraps or moves off the header's first line.
 *
 * `items-start` below `sm` pins close to the header's first line regardless
 * of how many lines the title/badge column wraps to on a narrow phone - the
 * reason this primitive exists (N12/N13). At `sm` and up the fixed Quick Exit
 * button (QuickExitButton.jsx) sits `top-3 right-3` - the same corner - so
 * `sm:items-center` re-centers close against the title block's full height
 * there instead, restoring the vertical clearance from Quick Exit's box that
 * `items-start` collapses (N14: centre-hit regression at 1024x768/1280x720).
 * Titles reliably fit one line at `sm`+ width, so this doesn't reintroduce
 * the wrapped-title drift `items-start` was added to fix.
 *
 * `justify-between` on the children column spreads a title block and a
 * trailing actions cluster (Share/"Bug?"/AI-status - passed as a second
 * `children` element) to opposite ends of the available width, so the
 * cluster sits next to `close` on a single line instead of drifting to
 * wherever the title's own width happens to end (N14: previously-`ml-auto`
 * clusters, e.g. TacticalCalculator's Share/Bug? row, lost that anchor when
 * their headers moved onto this primitive). A single child (no trailing
 * cluster) is unaffected - `justify-content` is a no-op with one flex item.
 */
export default function HeaderCloseSlot({ children, close, className = "" }) {
  return (
    <div
      className={`flex items-start justify-between gap-3 sm:items-center ${className}`}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
        {children}
      </div>
      <div className="shrink-0">{close}</div>
    </div>
  );
}
