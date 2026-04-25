/**
 * clickableProps — turn an arbitrary element into a WCAG 2.2 AA-compliant
 * pseudo-button.
 *
 * Why this exists:
 *   axe-core flags `<div onClick>` because the element is not focusable and
 *   does not respond to Enter/Space (WCAG 2.1.1 Keyboard, 4.1.2 Name/Role/Value).
 *   The historically correct fix is to use a real `<button>`, but many of
 *   the legacy card components in this codebase rely on a clickable wrapper
 *   `<div>` for layout reasons (block-level, full grid cell, etc.) and
 *   replacing the tag would cascade into Tailwind/grid changes.
 *
 *   This helper returns the minimum-viable set of props that turns an
 *   element into a screen-reader-and-keyboard-accessible button without
 *   touching its tag or styles.
 *
 *   It is intentionally NOT a React hook (no useState / useEffect calls),
 *   so it can be invoked inside `.map(...)` or anywhere that does not honor
 *   the rules of hooks. The legacy alias `useClickable` is kept for
 *   call-sites that already adopted it; both names point to the same
 *   pure helper.
 *
 * Usage:
 *   const props = clickableProps(handleClick, { label: "Open claim card", expanded: open });
 *   return <div {...props} className="card">…</div>;
 *
 * @param {(event: MouseEvent | KeyboardEvent) => void} onActivate
 * @param {object} [opts]
 * @param {string} [opts.label]    aria-label
 * @param {boolean} [opts.expanded] aria-expanded (toggle/disclosure cards)
 * @param {boolean} [opts.disabled] when true, sets aria-disabled and skips activation
 * @param {string}  [opts.role]    override role (default: "button")
 * @returns {object}
 */
export const clickableProps = (onActivate, opts = {}) => {
  const { label, expanded, disabled, role = "button" } = opts;

  const handleKeyDown = (event) => {
    if (disabled) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate(event);
    }
  };

  const handleClick = (event) => {
    if (disabled) return;
    onActivate(event);
  };

  const props = {
    role,
    tabIndex: disabled ? -1 : 0,
    onClick: handleClick,
    onKeyDown: handleKeyDown,
  };

  if (label !== undefined) props["aria-label"] = label;
  if (expanded !== undefined) props["aria-expanded"] = expanded;
  if (disabled !== undefined) props["aria-disabled"] = disabled;

  return props;
};

// Legacy alias so existing call-sites that imported `useClickable` keep
// working. New code should prefer `clickableProps`.
export const useClickable = clickableProps;

export default clickableProps;
