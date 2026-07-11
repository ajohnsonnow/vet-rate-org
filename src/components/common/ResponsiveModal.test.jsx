import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ResponsiveModal from "./ResponsiveModal";

afterEach(() => {
  document.body.classList.remove("modal-open");
});

function renderModal(props = {}, children = "content") {
  return render(
    <ResponsiveModal isOpen onClose={() => {}} title="T" {...props}>
      {children}
    </ResponsiveModal>,
  );
}

describe("ResponsiveModal", () => {
  it("renders nothing when closed", () => {
    renderModal({ isOpen: false, title: "Hidden" }, "body");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders a labelled dialog and locks body scroll when open", () => {
    renderModal({ title: "My Title" });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute(
      "aria-labelledby",
      screen.getByText("My Title").id,
    );
    expect(document.body.classList.contains("modal-open")).toBe(true);
  });

  it("renders footer content", () => {
    renderModal({ footer: <button>Save</button> });
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  it("calls onClose from the close button, Escape, and backdrop", () => {
    const onClose = vi.fn();
    renderModal({ onClose });

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
    renderModal({ onClose, closeOnBackdrop: false });
    const overlay = screen.getByRole("dialog").parentElement;
    fireEvent.mouseDown(overlay);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("hides the default close button when showClose is false", () => {
    renderModal({ showClose: false });
    expect(screen.queryByLabelText("Close dialog")).toBeNull();
    expect(screen.getByText("T")).toBeInTheDocument();
  });

  it("renders a custom header instead of the default bar and labels via labelledBy", () => {
    renderModal({
      title: undefined,
      labelledBy: "gate-title",
      header: <h2 id="gate-title">Consent Required</h2>,
    });
    expect(screen.queryByLabelText("Close dialog")).toBeNull();
    expect(screen.getByText("Consent Required")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAttribute(
      "aria-labelledby",
      "gate-title",
    );
  });

  it("ignores Escape and backdrop when dismissable is false", () => {
    const onClose = vi.fn();
    renderModal({ onClose, title: "Gate", dismissable: false });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("applies the zIndex prop to the overlay", () => {
    renderModal({ zIndex: 100 });
    expect(screen.getByRole("dialog").parentElement).toHaveStyle({
      zIndex: "100",
    });
  });

  it("uses backdropClassName instead of the default scrim when provided", () => {
    renderModal({
      backdropClassName: "bg-gradient-to-br from-va-blue/95 to-green-900/95",
    });
    const overlay = screen.getByRole("dialog").parentElement;
    expect(overlay.className).toContain("from-va-blue/95");
    expect(overlay.className).not.toContain("bg-black/60");
  });
});
