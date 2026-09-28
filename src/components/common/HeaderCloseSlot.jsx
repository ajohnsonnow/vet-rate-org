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
 * `items-start` pins close to the header's first line regardless of how many
 * lines the title/badge column wraps to - the reason this primitive exists
 * (N12/N13). N14 briefly special-cased this to `sm:items-center` (>=640px)
 * on the theory that titles reliably fit one line by `sm` and that
 * items-start's vertical clearance from the fixed Quick Exit button
 * (QuickExitButton.jsx, `top-3 right-3` at `sm`+) needed restoring there -
 * both premises were wrong: ~25 dialogs' title/badge clusters still wrap
 * well past 640px (some past 700px), which `sm:items-center` answered by
 * centring close-x against the now-taller wrapped block, dropping it below
 * the title's first line instead (the exact defect N12/N13 fixed
 * `items-start` to prevent). Four dialogs (ClaimNavigator, NexusBuilder's
 * condition picker, MusterCall, ConsistencyEngine - each with a header
 * taller than one line regardless of width) had to override N14's default
 * back to `sm:!items-start` individually to stay correct. The real Quick
 * Exit clearance N14 was chasing is provided at the ResponsiveModal level
 * (`sm:!mt-16` reserves a gutter for every dialog regardless of header
 * height/shape - see ResponsiveModal.jsx), not by this component's
 * cross-axis alignment - confirmed by MusterCall's own unconditional
 * `sm:!items-start` already having been verified live at 1024x768/1280x720
 * with no regression. `items-start` unconditionally is therefore the actual
 * root fix: correct for every wrap width with no separate Quick-Exit
 * special case needed, which is what made the four per-dialog overrides
 * above redundant (removed alongside this).
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
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
        {children}
      </div>
      <div className="shrink-0">{close}</div>
    </div>
  );
}
