import {
  useId,
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  cloneElement,
  Children,
} from "react";

const SHOW_DELAY_MS = 200;
const HIDE_DELAY_MS = 80;
// Small breathing room from the viewport/safe-area edge so a clamped
// tooltip doesn't sit pixel-flush against a notch or screen edge.
const VIEWPORT_EDGE_PADDING = 4;

/**
 * `env(safe-area-inset-*)` isn't directly readable from JS - probing a
 * throwaway element's computed padding is the standard workaround. The
 * `,0px` fallback means jsdom (no `env()` support) always measures 0,
 * which is the correct no-op for unit tests.
 */
function getSafeAreaInsets() {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
    "padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);";
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const insets = {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
  probe.remove();
  return insets;
}

function clipsOverflow(overflowValue) {
  return (
    overflowValue === "hidden" ||
    overflowValue === "auto" ||
    overflowValue === "scroll" ||
    overflowValue === "clip"
  );
}

// jsdom's getComputedStyle doesn't expand the `overflow` shorthand into
// `overflow-x`/`overflow-y` (real browsers always populate both), so the
// shorthand is checked as a fallback rather than assuming the longhands
// are set.
function axisOverflow(style, longhand) {
  return style[longhand] || style.overflow;
}

/**
 * D14-3 follow-up: the viewport isn't the only box that can clip a tooltip -
 * ResponsiveModal's `.modal-content` (and any other ancestor with
 * overflow:hidden/auto/scroll) clips it first whenever the dialog panel is
 * narrower than the viewport (e.g. 640px). Walks up from the bubble looking
 * for the nearest overflow-clipping ancestors and intersects all of their
 * boxes, so the clamp below targets whichever box is actually smaller.
 * Stops at `document.body` - this app has no clipping ancestor above it.
 */
function getClippingRect(el) {
  let rect = null;
  let node = el.parentElement;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    if (
      clipsOverflow(axisOverflow(style, "overflowX")) ||
      clipsOverflow(axisOverflow(style, "overflowY"))
    ) {
      const nodeRect = node.getBoundingClientRect();
      rect = rect
        ? {
            left: Math.max(rect.left, nodeRect.left),
            right: Math.min(rect.right, nodeRect.right),
            top: Math.max(rect.top, nodeRect.top),
            bottom: Math.min(rect.bottom, nodeRect.bottom),
          }
        : {
            left: nodeRect.left,
            right: nodeRect.right,
            top: nodeRect.top,
            bottom: nodeRect.bottom,
          };
    }
    node = node.parentElement;
  }
  return rect;
}

function computeSafeRect(insets, pad, clip) {
  return {
    left: Math.max(insets.left + pad, clip ? clip.left + pad : -Infinity),
    right: Math.min(
      window.innerWidth - insets.right - pad,
      clip ? clip.right - pad : Infinity,
    ),
    top: Math.max(insets.top + pad, clip ? clip.top + pad : -Infinity),
    bottom: Math.min(
      window.innerHeight - insets.bottom - pad,
      clip ? clip.bottom - pad : Infinity,
    ),
  };
}

function clampAxisDelta(start, end, safeStart, safeEnd) {
  let delta = 0;
  if (end + delta > safeEnd) delta -= end + delta - safeEnd;
  if (start + delta < safeStart) delta += safeStart - (start + delta);
  return delta;
}

/**
 * Root-cause fix for D14-3: the tooltip bubble is centred/anchored off its
 * trigger via Tailwind's translate utilities, with no awareness of the
 * viewport edge - a trigger near the left/right/top/bottom edge renders a
 * bubble that runs off-screen (first word cut off). Measures the real
 * rendered rect and, only when it actually overflows, layers a pixel
 * correction onto the same translate the placement already uses (rather
 * than fighting Tailwind's classes with a competing positioning scheme).
 * A zero-size rect (jsdom, or not yet laid out) is a no-op - nothing to
 * clamp against.
 *
 * The safe box is the viewport intersected with the nearest clipping
 * ancestor (see getClippingRect) - a translate alone can't help once the
 * bubble is wider than that box, so it's also given an explicit max-width
 * and allowed to wrap onto a second line instead of running off-screen.
 */
function clampTooltipToViewport(el, placement) {
  if (!el) return;
  el.style.transform = "";
  el.style.maxWidth = "";
  el.style.whiteSpace = "";
  let rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return;

  const insets = getSafeAreaInsets();
  const safe = computeSafeRect(
    insets,
    VIEWPORT_EDGE_PADDING,
    getClippingRect(el),
  );

  const safeWidth = safe.right - safe.left;
  if (safeWidth > 0 && rect.width > safeWidth) {
    el.style.maxWidth = `${safeWidth}px`;
    el.style.whiteSpace = "normal";
    rect = el.getBoundingClientRect();
  }

  const deltaX = clampAxisDelta(rect.left, rect.right, safe.left, safe.right);
  const deltaY = clampAxisDelta(rect.top, rect.bottom, safe.top, safe.bottom);
  if (deltaX === 0 && deltaY === 0) return;

  const horizontalCenter = placement === "top" || placement === "bottom";
  const verticalCenter = placement === "left" || placement === "right";
  const tx = horizontalCenter ? `calc(-50% + ${deltaX}px)` : `${deltaX}px`;
  const ty = verticalCenter ? `calc(-50% + ${deltaY}px)` : `${deltaY}px`;
  el.style.transform = `translate(${tx}, ${ty})`;
}

function useTooltipVisibility(delay) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const showTimer = useRef(null);
  const hideTimer = useRef(null);

  const clearTimers = () => {
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const show = () => {
    clearTimers();
    showTimer.current = setTimeout(() => setOpen(true), delay);
  };

  const hide = () => {
    if (pinned) return;
    clearTimers();
    hideTimer.current = setTimeout(() => setOpen(false), HIDE_DELAY_MS);
  };

  const hideImmediate = () => {
    clearTimers();
    setOpen(false);
    setPinned(false);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        hideImmediate();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => clearTimers(), []);

  return { open, pinned, setPinned, show, hide, hideImmediate, clearTimers };
}

export function Tooltip({
  content,
  children,
  placement = "top",
  delay = SHOW_DELAY_MS,
  className = "",
}) {
  const id = useId();
  const wrapperRef = useRef(null);
  const tooltipRef = useRef(null);
  const { open, setPinned, show, hide, hideImmediate, clearTimers } =
    useTooltipVisibility(delay);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const recompute = () =>
      clampTooltipToViewport(tooltipRef.current, placement);
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
    // `content` is intentionally a dep, not just used inside: callers like
    // AIStatusBadge poll status every second and change this prop while the
    // tooltip is still open (e.g. "AI is warming up..." -> the ready
    // string), which resizes/repositions the bubble. Without this dep the
    // clamp computed for the old text goes stale until the next resize/blur.
  }, [open, placement, content]);

  const placementClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const child = Children.only(children);
  const trigger = cloneElement(child, {
    "aria-describedby": open ? id : child.props["aria-describedby"],
    onMouseEnter: (e) => {
      child.props.onMouseEnter?.(e);
      show();
    },
    onMouseLeave: (e) => {
      child.props.onMouseLeave?.(e);
      hide();
    },
    onFocus: (e) => {
      child.props.onFocus?.(e);
      show();
    },
    onBlur: (e) => {
      child.props.onBlur?.(e);
      hideImmediate();
    },
  });

  return (
    <span ref={wrapperRef} className="relative inline-flex">
      {trigger}
      {open && (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- mouse-only hover-pin so the bubble stays open while the pointer is over it; keyboard users already get show/hide via the trigger's onFocus/onBlur and Escape (hideImmediate above)
        <span
          ref={tooltipRef}
          id={id}
          role="tooltip"
          onMouseEnter={() => {
            clearTimers();
            setPinned(true);
          }}
          onMouseLeave={() => {
            setPinned(false);
            hide();
          }}
          className={`pointer-events-auto absolute z-50 px-2 py-1 text-xs font-medium text-white bg-gray-900 dark:bg-gray-700 rounded shadow-lg whitespace-nowrap ${placementClasses[placement]} ${className}`}
        >
          {content}
        </span>
      )}
    </span>
  );
}

export default Tooltip;
