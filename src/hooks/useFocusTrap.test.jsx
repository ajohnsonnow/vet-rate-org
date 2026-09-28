import { describe, it, expect, vi } from "vitest";
import { useRef, useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useFocusTrap } from "./useFocusTrap";

function Harness({ onEscape }) {
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const ref = useRef(null);
  useFocusTrap(ref, {
    active: open,
    onEscape: onEscape || (() => setOpen(false)),
  });
  return (
    <div>
      <button data-testid="opener" onClick={() => setOpen(true)}>
        open
      </button>
      <button data-testid="rerender" onClick={() => setTick(tick + 1)}>
        rerender {tick}
      </button>
      {open && (
        <div ref={ref} data-testid="trap">
          <button data-testid="first">first</button>
          <button data-testid="second">second</button>
          <button data-testid="last" onClick={() => setOpen(false)}>
            last
          </button>
        </div>
      )}
    </div>
  );
}

// VKBViewer/TheTribunal activate the trap while still loading, rendering a
// bare dialog shell with nothing focusable inside it - `open` never toggles
// again for the loading->loaded transition, only the dialog's own children
// change once data arrives.
function LoadingHarness() {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const ref = useRef(null);
  useFocusTrap(ref, { active: open, onEscape: () => setOpen(false) });
  return (
    <div>
      <button data-testid="opener" onClick={() => setOpen(true)}>
        open
      </button>
      <button data-testid="finish-load" onClick={() => setReady(true)}>
        finish load
      </button>
      {open && (
        <div ref={ref} data-testid="trap">
          {ready && <button data-testid="loaded">loaded</button>}
        </div>
      )}
    </div>
  );
}

// Models Muster Call's Intelligence Briefing (D13-1): ResponsiveModal portals
// every dialog straight to document.body, so a "nested" dialog is a DOM
// *sibling* of its opener, not a descendant - both traps here are siblings
// too, exercising the same document-level escapeTrapStack real nested
// dialogs go through. The outer trap's "opener" button can be removed
// independently of the inner trap closing, modeling Muster Call swapping its
// formation view out from under a still-open Intelligence Briefing.
function NestedHarness({ onOuterEscape, onInnerEscape }) {
  const [openerPresent, setOpenerPresent] = useState(true);
  const [innerOpen, setInnerOpen] = useState(false);
  const outerRef = useRef(null);
  const innerRef = useRef(null);

  useFocusTrap(outerRef, { active: true, onEscape: onOuterEscape });
  useFocusTrap(innerRef, {
    active: innerOpen,
    onEscape: (e) => {
      setInnerOpen(false);
      onInnerEscape?.(e);
    },
  });

  return (
    <div>
      <div ref={outerRef} role="dialog" data-testid="outer">
        {openerPresent && (
          <button data-testid="opener" onClick={() => setInnerOpen(true)}>
            open inner
          </button>
        )}
        <button data-testid="outer-fallback-target">fallback target</button>
      </div>
      {innerOpen && (
        <div ref={innerRef} role="dialog" data-testid="inner">
          <button data-testid="inner-btn">inner content</button>
        </div>
      )}
      <button
        data-testid="remove-opener"
        onClick={() => setOpenerPresent(false)}
      >
        remove opener
      </button>
      <button
        data-testid="close-inner-directly"
        onClick={() => setInnerOpen(false)}
      >
        close inner (not via Escape)
      </button>
    </div>
  );
}

describe("useFocusTrap: nested traps (Muster Call / Intelligence Briefing shape)", () => {
  it("Escape closes only the topmost (inner) trap while both are active", () => {
    const onOuterEscape = vi.fn();
    const onInnerEscape = vi.fn();
    render(
      <NestedHarness
        onOuterEscape={onOuterEscape}
        onInnerEscape={onInnerEscape}
      />,
    );

    screen.getByTestId("opener").focus();
    fireEvent.click(screen.getByTestId("opener"));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onInnerEscape).toHaveBeenCalledTimes(1);
    expect(onOuterEscape).not.toHaveBeenCalled();
  });

  it("after the inner trap closes, Escape closes the outer trap (stack correctly pops)", () => {
    const onOuterEscape = vi.fn();
    const onInnerEscape = vi.fn();
    render(
      <NestedHarness
        onOuterEscape={onOuterEscape}
        onInnerEscape={onInnerEscape}
      />,
    );

    fireEvent.click(screen.getByTestId("opener"));
    fireEvent.click(screen.getByTestId("close-inner-directly"));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onOuterEscape).toHaveBeenCalledTimes(1);
  });

  it("teardown falls back to the nearest still-mounted dialog when the opener has left the DOM", () => {
    render(<NestedHarness onOuterEscape={() => {}} onInnerEscape={() => {}} />);

    fireEvent.click(screen.getByTestId("opener"));
    fireEvent.click(screen.getByTestId("remove-opener"));
    expect(screen.queryByTestId("opener")).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" }); // closes inner

    expect(document.activeElement).not.toBe(document.body);
    expect(screen.getByTestId("outer").contains(document.activeElement)).toBe(
      true,
    );
  });

  it("Escape closes the topmost trap even when focus has fallen to <body>", () => {
    const onInnerEscape = vi.fn();
    render(
      <NestedHarness onOuterEscape={() => {}} onInnerEscape={onInnerEscape} />,
    );

    fireEvent.click(screen.getByTestId("opener"));
    document.body.focus?.();
    document.activeElement?.blur?.();
    expect(document.activeElement).toBe(document.body);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onInnerEscape).toHaveBeenCalledTimes(1);
  });
});

describe("useFocusTrap", () => {
  it("auto-focuses the first focusable when activated", () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("opener"));
    expect(document.activeElement).toBe(screen.getByTestId("first"));
  });

  it("wraps focus from last back to first on Tab", () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("opener"));
    const last = screen.getByTestId("last");
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByTestId("first"));
  });

  it("wraps focus from first back to last on Shift+Tab", () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("opener"));
    const first = screen.getByTestId("first");
    first.focus();
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByTestId("last"));
  });

  it("invokes onEscape when Escape is pressed", () => {
    const onEscape = vi.fn();
    render(<Harness onEscape={onEscape} />);
    fireEvent.click(screen.getByTestId("opener"));
    fireEvent.keyDown(screen.getByTestId("first"), { key: "Escape" });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("restores focus to the opener when deactivated", () => {
    render(<Harness />);
    const opener = screen.getByTestId("opener");
    opener.focus();
    fireEvent.click(opener); // activates trap; restore target = opener
    fireEvent.click(screen.getByTestId("last")); // closes -> deactivates
    expect(document.activeElement).toBe(opener);
  });

  // Regression: the effect used to list onEscape in its dependency array.
  // Callers pass an inline arrow (`onEscape={() => setOpen(false)}`), so every
  // parent re-render gave it a new identity, tearing the trap down and
  // rebuilding it. Teardown focuses the opener and the rebuild re-runs
  // autoFocus, so a user who had tabbed to the third field got yanked back to
  // the first one whenever anything re-rendered - a real focus-management bug
  // (WCAG 3.2.2), not just churn.
  it("does not steal focus back to the top of the dialog when the parent re-renders", () => {
    render(<Harness />);
    const opener = screen.getByTestId("opener");
    opener.focus();
    fireEvent.click(opener);

    screen.getByTestId("second").focus();
    expect(document.activeElement).toBe(screen.getByTestId("second"));

    // A parent re-render that does not change `open` or the trap's config.
    fireEvent.click(screen.getByTestId("rerender"));

    expect(document.activeElement).toBe(screen.getByTestId("second"));
  });

  it("still restores focus to the opener after a parent re-render", () => {
    render(<Harness />);
    const opener = screen.getByTestId("opener");
    opener.focus();
    fireEvent.click(opener);

    screen.getByTestId("second").focus();
    fireEvent.click(screen.getByTestId("rerender"));
    fireEvent.click(screen.getByTestId("last")); // close

    expect(document.activeElement).toBe(opener);
  });

  // Dead-zone regression: a dialog that activates before it has any
  // focusable content (VKBViewer/TheTribunal while loading) used to never
  // get a second autoFocus attempt once real content rendered, so focus
  // stayed on whatever opened it - and Escape, bound to the dialog node
  // itself, never bubbled through to close it.
  it("moves focus into content that appears after the dialog activates empty (loading dead zone)", async () => {
    render(<LoadingHarness />);
    const opener = screen.getByTestId("opener");
    opener.focus();
    fireEvent.click(opener);

    expect(document.activeElement).toBe(opener);

    fireEvent.click(screen.getByTestId("finish-load"));

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId("loaded"));
    });
  });
});
