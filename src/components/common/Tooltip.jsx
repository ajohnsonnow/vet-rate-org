import {
  useId,
  useState,
  useRef,
  useEffect,
  cloneElement,
  Children,
} from "react";

const SHOW_DELAY_MS = 200;
const HIDE_DELAY_MS = 80;

export function Tooltip({
  content,
  children,
  placement = "top",
  delay = SHOW_DELAY_MS,
  className = "",
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const showTimer = useRef(null);
  const hideTimer = useRef(null);
  const wrapperRef = useRef(null);
  const tooltipRef = useRef(null);

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
  }, [open]);

  useEffect(() => () => clearTimers(), []);

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
