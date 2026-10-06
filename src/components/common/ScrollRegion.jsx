/**
 * A horizontally scrolling wrapper that a keyboard user can reach: a named
 * region in the tab order with a visible focus ring, so a wide table that
 * scrolls inside it (narrow screens) can be scrolled without a mouse.
 */
export default function ScrollRegion({ label, children, className = "" }) {
  return (
    <section
      aria-label={label}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      className={`overflow-x-auto rounded focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${className}`}
    >
      {children}
    </section>
  );
}
