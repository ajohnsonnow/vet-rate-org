import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ResponsiveModal from "./ResponsiveModal";

afterEach(() => {
  document.body.classList.remove("modal-open");
});

describe("ResponsiveModal", () => {
  it("renders nothing when closed", () => {
    render(
      <ResponsiveModal isOpen={false} onClose={() => {}} title="Hidden">
        body
      </ResponsiveModal>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders a labelled dialog and locks body scroll when open", () => {
    render(
      <ResponsiveModal isOpen onClose={() => {}} title="My Title">
        content
      </ResponsiveModal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute(
      "aria-labelledby",
      screen.getByText("My Title").id,
    );
    expect(document.body.classList.contains("modal-open")).toBe(true);
  });

  it("renders footer content", () => {
    render(
      <ResponsiveModal
        isOpen
        onClose={() => {}}
        title="T"
        footer={<button>Save</button>}
      >
        content
      </ResponsiveModal>,
    );
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  it("calls onClose from the close button, Escape, and backdrop", () => {
    const onClose = vi.fn();
    render(
      <ResponsiveModal isOpen onClose={onClose} title="T">
        content
      </ResponsiveModal>,
    );

    fireEvent.click(screen.getByLabelText("Close dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);

    const overlay = screen.getByRole("dialog").parentElement;
    fireEvent.mouseDown(overlay);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("does not close on backdrop when closeOnBackdrop is false", () => {
    const onClose = vi.fn();
    render(
      <ResponsiveModal
        isOpen
        onClose={onClose}
        title="T"
        closeOnBackdrop={false}
      >
        content
      </ResponsiveModal>,
    );
    const overlay = screen.getByRole("dialog").parentElement;
    fireEvent.mouseDown(overlay);
    expect(onClose).not.toHaveBeenCalled();
  });
});
