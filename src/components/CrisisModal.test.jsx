/**
 * CrisisModal is non-dismissible by design (useFocusTrap is wired with no
 * onEscape - see CrisisModal.jsx's own comment), which is correct: a single
 * Escape must never close it. But the app-wide triple-Escape panic key is a
 * separate safety system with its own standing requirement (decision (2)):
 * it must ALWAYS work, on every screen, crisis included. Before this fix,
 * safetyRedirect.js's dialog guard trusted any open [role="dialog"/
 * "alertdialog"] to close on its own Escape handler and never re-checked -
 * so a modal that (correctly) never closes on Escape left the panic key
 * permanently swallowed for as long as it stayed open.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CrisisModal from "./CrisisModal";
import { LanguageProvider } from "../contexts/LanguageContext";
import {
  initializePanicKey,
  cleanupPanicKey,
  ESCAPE_THRESHOLD,
} from "../utils/safetyRedirect";

const PANIC_EVENT = "vetrate:panic-triggered";

function renderCrisisModal(props = {}) {
  return render(
    <LanguageProvider>
      <CrisisModal severity="high" {...props} />
    </LanguageProvider>,
  );
}

function pressEscapeOnFocusedElement() {
  fireEvent.keyDown(document.activeElement, {
    key: "Escape",
    bubbles: true,
  });
}

describe("CrisisModal keyboard panic exit", () => {
  let panicSpy;

  beforeEach(() => {
    initializePanicKey();
    panicSpy = vi.fn();
    window.addEventListener(PANIC_EVENT, panicSpy);
  });

  afterEach(() => {
    window.removeEventListener(PANIC_EVENT, panicSpy);
    cleanupPanicKey();
  });

  it("does not dismiss on a single Escape - non-dismissible by design", () => {
    renderCrisisModal();

    pressEscapeOnFocusedElement();

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(panicSpy).not.toHaveBeenCalled();
  });

  it("triple-Escape still fires the panic redirect while the crisis modal is open and never closes", () => {
    renderCrisisModal();

    for (let i = 0; i < ESCAPE_THRESHOLD; i++) pressEscapeOnFocusedElement();

    expect(panicSpy).toHaveBeenCalledTimes(1);
    // Still non-dismissible - the modal itself never closed; it was the
    // panic key (a separate system) that fired.
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
