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
 */
export default function HeaderCloseSlot({ children, close, className = "" }) {
  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        {children}
      </div>
      <div className="shrink-0">{close}</div>
    </div>
  );
}
