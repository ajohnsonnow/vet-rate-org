import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ChoiceDialog from "./ChoiceDialog.jsx";

function open(handlers = {}) {
  const onKeep = handlers.onKeep ?? vi.fn();
  const onReplace = handlers.onReplace ?? vi.fn();
  const view = render(
    <>
      <button type="button">Opener</button>
      <ChoiceDialog
        title="You edited this draft"
        keepLabel="Keep my edited draft"
        onKeep={onKeep}
        replaceLabel="Rebuild from my answers"
        onReplace={onReplace}
      >
        Your answers changed after you edited the draft.
      </ChoiceDialog>
    </>,
  );
  return { onKeep, onReplace, ...view };
}

describe("ChoiceDialog", () => {
  it("is a named, described alert dialog with focus on the keeping choice", () => {
    open();
    const dialog = screen.getByRole("alertdialog", {
      name: "You edited this draft",
    });

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription(
      "Your answers changed after you edited the draft.",
    );
    expect(
      screen.getByRole("button", { name: "Keep my edited draft" }),
    ).toHaveFocus();
  });

  it("keeps Tab inside, and Escape keeps the veteran's words", () => {
    const { onKeep, onReplace } = open();
    const dialog = screen.getByRole("alertdialog");
    const keep = screen.getByRole("button", { name: "Keep my edited draft" });
    const replace = screen.getByRole("button", {
      name: "Rebuild from my answers",
    });

    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(replace).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(keep).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(onReplace).not.toHaveBeenCalled();
  });

  it("each button does what it says", () => {
    const { onKeep, onReplace } = open();
    fireEvent.click(
      screen.getByRole("button", { name: "Rebuild from my answers" }),
    );
    expect(onReplace).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole("button", { name: "Keep my edited draft" }),
    );
    expect(onKeep).toHaveBeenCalledTimes(1);
    for (const button of screen.getAllByRole("button").slice(1)) {
      expect(button.className).toMatch(/min-h-\[44px\]/);
    }
  });

  it("gives focus back to where it was when it closes", () => {
    function Toggle() {
      const [asking, setAsking] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setAsking(true)}>
            Regenerate
          </button>
          {asking && (
            <ChoiceDialog
              title="You edited this draft"
              keepLabel="Keep"
              onKeep={() => setAsking(false)}
              replaceLabel="Rebuild"
              onReplace={() => setAsking(false)}
            >
              Body
            </ChoiceDialog>
          )}
        </>
      );
    }
    render(<Toggle />);
    const opener = screen.getByRole("button", { name: "Regenerate" });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole("button", { name: "Keep" })).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
