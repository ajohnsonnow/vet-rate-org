import { describe, it, expect, vi } from "vitest";
import { useRef, useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
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
});
