import { describe, it, expect, vi } from "vitest";
import { useRef, useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { useFocusTrap } from "./useFocusTrap";

function Harness({ onEscape }) {
  const [open, setOpen] = useState(false);
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
});
