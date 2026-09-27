import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import {
  getSafetyUseCount,
  hasUsedPanicFeature,
  createQuickExitButton,
  removeQuickExitButton,
  initializePanicKey,
  cleanupPanicKey,
  ESCAPE_THRESHOLD,
  ESCAPE_WINDOW_MS,
} from "../../utils/safetyRedirect";

const PANIC_EVENT = "vetrate:panic-triggered";

function pressEscape({ defaultPrevented = false, repeat = false } = {}) {
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
    repeat,
  });
  if (defaultPrevented) event.preventDefault();
  window.dispatchEvent(event);
}

// Dispatches on a real descendant node (not window) so a listener anywhere
// along the actual capture/bubble path - a dialog's own handler, a document
// capture-phase listener, an intermediate node calling preventDefault - runs
// in its real position relative to window's capture and bubble listeners,
// instead of the artificial "everything is on the target" ordering that
// window.dispatchEvent(event) produces.
function pressEscapeOn(target) {
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
}

function openDialog() {
  const el = document.createElement("div");
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  document.body.appendChild(el);
  return el;
}

function openMenuPopover() {
  const trigger = document.createElement("button");
  trigger.setAttribute("aria-haspopup", "true");
  trigger.setAttribute("aria-expanded", "true");
  document.body.appendChild(trigger);
  return trigger;
}

// Mirrors AccessibilityMenu's useCloseMenuOnEscape / SearchBar's Escape
// handler: a real component that actually closes its own popover.
function openMenuPopoverThatClosesOnEscape() {
  const trigger = openMenuPopover();
  trigger.addEventListener("keydown", (e) => {
    if (e.key === "Escape") trigger.setAttribute("aria-expanded", "false");
  });
  return trigger;
}

// Test safetyRedirect utility
describe("Safety Redirect", () => {
  afterEach(() => {
    localStorage.removeItem("vetrate_safety_use_count");
    removeQuickExitButton();
  });

  it("reports zero uses and hasUsedPanicFeature=false before the panic key is ever triggered", () => {
    expect(getSafetyUseCount()).toBe(0);
    expect(hasUsedPanicFeature()).toBe(false);
  });

  it("hasUsedPanicFeature is true once the usage counter is non-zero", () => {
    localStorage.setItem("vetrate_safety_use_count", "1");
    expect(getSafetyUseCount()).toBe(1);
    expect(hasUsedPanicFeature()).toBe(true);
  });

  it("createQuickExitButton adds an accessible, single-use exit button", () => {
    const button = createQuickExitButton(document.body);
    expect(button.id).toBe("vetrate-quick-exit");
    expect(button.getAttribute("aria-label")).toMatch(/quick exit/i);
    expect(document.getElementById("vetrate-quick-exit")).toBe(button);

    // Calling it again returns the existing button, not a duplicate.
    const again = createQuickExitButton(document.body);
    expect(again).toBe(button);
  });

  it("removeQuickExitButton removes the button from the DOM", () => {
    createQuickExitButton(document.body);
    removeQuickExitButton();
    expect(document.getElementById("vetrate-quick-exit")).toBeNull();
  });
});

describe("Triple-Escape panic key counter", () => {
  let panicSpy;

  beforeEach(() => {
    vi.useFakeTimers();
    initializePanicKey();
    panicSpy = vi.fn();
    window.addEventListener(PANIC_EVENT, panicSpy);
  });

  afterEach(() => {
    window.removeEventListener(PANIC_EVENT, panicSpy);
    // Flush any pending reset timeout so the counter starts at 0 for the
    // next test regardless of what this test left it at.
    vi.advanceTimersByTime(ESCAPE_WINDOW_MS + 100);
    vi.useRealTimers();
    cleanupPanicKey();
    document
      .querySelectorAll('[role="dialog"], [aria-haspopup]')
      .forEach((el) => el.remove());
    localStorage.removeItem("vetrate_safety_use_count");
  });

  it(`${ESCAPE_THRESHOLD} deliberate Escapes with nothing open trigger the panic redirect`, () => {
    for (let i = 0; i < ESCAPE_THRESHOLD; i++) pressEscape();
    expect(panicSpy).toHaveBeenCalledTimes(1);
  });

  it("fewer than the threshold does not trigger", () => {
    for (let i = 0; i < ESCAPE_THRESHOLD - 1; i++) pressEscape();
    expect(panicSpy).not.toHaveBeenCalled();
  });

  it("an Escape that closes an open dialog is never counted, even 3+ in a row", () => {
    for (let i = 0; i < ESCAPE_THRESHOLD + 1; i++) {
      const dialog = openDialog();
      pressEscape();
      // Simulate the dialog's own Escape handler removing it - the guard
      // must have already read "dialog open" before this happens, which is
      // exactly what registering on the capture phase guarantees in the
      // real app (see handleEscapeKey's doc comment).
      dialog.remove();
    }
    expect(panicSpy).not.toHaveBeenCalled();
  });

  it("an Escape that actually closes an aria-haspopup menu/popover is not counted", () => {
    const trigger = openMenuPopoverThatClosesOnEscape();
    pressEscapeOn(trigger);
    vi.advanceTimersByTime(0);
    expect(panicSpy).not.toHaveBeenCalled();
    trigger.remove();
  });

  // REGRESSION GUARD: an earlier version of this exemption treated every
  // open aria-haspopup+aria-expanded menu as "will be handled elsewhere",
  // full stop - which left the panic key completely dead for as long as a
  // menu that doesn't respond to Escape (Header's Tools/Resources dropdowns)
  // stayed open, since nothing ever closed it and every Escape was swallowed
  // forever. It must fall back to counting once it's clear the menu isn't
  // actually going to close.
  it("an Escape while an aria-haspopup menu/popover stays expanded (nothing closes it) is still counted, so the panic key isn't swallowed forever", () => {
    const trigger = openMenuPopover();
    for (let i = 0; i < ESCAPE_THRESHOLD; i++) {
      pressEscape();
      vi.advanceTimersByTime(0);
    }
    expect(panicSpy).toHaveBeenCalledTimes(1);
    trigger.remove();
  });

  it("a plain expanded accordion (aria-expanded with no aria-haspopup) does NOT suppress the panic key", () => {
    const trigger = document.createElement("button");
    trigger.setAttribute("aria-expanded", "true");
    document.body.appendChild(trigger);
    for (let i = 0; i < ESCAPE_THRESHOLD; i++) pressEscape();
    expect(panicSpy).toHaveBeenCalledTimes(1);
    trigger.remove();
  });

  it("event.defaultPrevented suppresses counting", () => {
    for (let i = 0; i < ESCAPE_THRESHOLD; i++)
      pressEscape({ defaultPrevented: true });
    expect(panicSpy).not.toHaveBeenCalled();
  });

  it("mixed sequence: dialog-closes don't count, but 3 real ones afterward still fire", () => {
    const dialog = openDialog();
    pressEscape(); // closes dialog - not counted
    dialog.remove();

    for (let i = 0; i < ESCAPE_THRESHOLD; i++) pressEscape();
    expect(panicSpy).toHaveBeenCalledTimes(1);
  });

  it("cleanupPanicKey stops future Escapes from being counted at all", () => {
    cleanupPanicKey();
    for (let i = 0; i < ESCAPE_THRESHOLD; i++) pressEscape();
    expect(panicSpy).not.toHaveBeenCalled();
  });
});

// Split from the describe block above to stay under max-lines-per-function -
// same setup/teardown, just the bubble-phase-decision edge cases (defect:
// defaultPrevented/stopPropagation were unobservable from a capture-only
// listener; event.repeat wasn't checked at all).
describe("Triple-Escape panic key counter - bubble-phase decision edge cases", () => {
  let panicSpy;

  beforeEach(() => {
    vi.useFakeTimers();
    initializePanicKey();
    panicSpy = vi.fn();
    window.addEventListener(PANIC_EVENT, panicSpy);
  });

  afterEach(() => {
    window.removeEventListener(PANIC_EVENT, panicSpy);
    vi.advanceTimersByTime(ESCAPE_WINDOW_MS + 100);
    vi.useRealTimers();
    cleanupPanicKey();
    document
      .querySelectorAll('[role="dialog"], [aria-haspopup]')
      .forEach((el) => el.remove());
    localStorage.removeItem("vetrate_safety_use_count");
  });

  // REGRESSION GUARD: a capture-phase-only listener always reads
  // event.defaultPrevented as false, because it runs before any other
  // handler on the dispatch path (a component's own keydown handler in
  // particular) has had a chance to call preventDefault(). Dispatching on a
  // real descendant with its own handler reproduces the actual app path -
  // window(capture) -> ... -> child(target, calls preventDefault) -> ... ->
  // window(bubble) - which only a bubble-phase decision observes correctly.
  it("a handler elsewhere on the dispatch path calling preventDefault suppresses counting", () => {
    const child = document.createElement("button");
    document.body.appendChild(child);
    child.addEventListener("keydown", (e) => {
      if (e.key === "Escape") e.preventDefault();
    });
    for (let i = 0; i < ESCAPE_THRESHOLD; i++) pressEscapeOn(child);
    expect(panicSpy).not.toHaveBeenCalled();
    child.remove();
  });

  // REGRESSION GUARD: Tooltip.jsx dismisses on Escape via a document
  // capture-phase listener that calls stopPropagation (not preventDefault).
  // window's capture-phase snapshot still runs first (window is above
  // document in the capture order), but stopPropagation halts the event
  // before it ever reaches window's bubble-phase listener, so it must not be
  // counted - matching pre-existing behavior for that interaction.
  it("a document capture-phase handler that stops propagation (e.g. Tooltip dismissing on Escape) is not counted", () => {
    const stopper = (e) => {
      if (e.key === "Escape") e.stopPropagation();
    };
    document.addEventListener("keydown", stopper, true);
    for (let i = 0; i < ESCAPE_THRESHOLD; i++) pressEscapeOn(document.body);
    expect(panicSpy).not.toHaveBeenCalled();
    document.removeEventListener("keydown", stopper, true);
  });

  // REGRESSION GUARD: holding Escape sends OS auto-repeat keydowns
  // (event.repeat === true) after the initial press. A keyboard user with a
  // tremor or slow key release holding Escape to close a single dialog must
  // not have those repeats add up to an accidental panic redirect.
  it("auto-repeat keydowns (holding Escape) are never counted", () => {
    pressEscape(); // one genuine press
    for (let i = 0; i < 5; i++) pressEscape({ repeat: true });
    expect(panicSpy).not.toHaveBeenCalled();
  });
});

describe("Crisis Keywords Detection", () => {
  const CRISIS_KEYWORDS = [
    "suicide",
    "suicidal",
    "kill myself",
    "end my life",
    "want to die",
    "self harm",
    "self-harm",
    "hurt myself",
  ];

  function detectCrisis(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
  }

  it('detects "suicide" keyword', () => {
    expect(detectCrisis("I am thinking about suicide")).toBe(true);
  });

  it('detects "kill myself"', () => {
    expect(detectCrisis("I want to kill myself")).toBe(true);
  });

  it("detects self-harm", () => {
    expect(detectCrisis("thoughts of self-harm")).toBe(true);
  });

  it("does not flag normal text", () => {
    expect(detectCrisis("I want to file my VA claim")).toBe(false);
  });

  it("handles null input", () => {
    expect(detectCrisis(null)).toBe(false);
  });

  it("handles empty string", () => {
    expect(detectCrisis("")).toBe(false);
  });

  it("is case insensitive", () => {
    expect(detectCrisis("SUICIDAL thoughts")).toBe(true);
  });
});
