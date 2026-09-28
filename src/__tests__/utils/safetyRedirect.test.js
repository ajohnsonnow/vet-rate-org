import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import {
  getSafetyUseCount,
  hasUsedPanicFeature,
  createQuickExitButton,
  removeQuickExitButton,
  initializePanicKey,
  cleanupPanicKey,
  triggerPanicRedirect,
  ESCAPE_THRESHOLD,
  ESCAPE_WINDOW_MS,
} from "../../utils/safetyRedirect";
import {
  setupBeforeUnloadWarning,
  removeBeforeUnloadWarning,
} from "../../utils/dataPersistence";

function dispatchBeforeUnload() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

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

// Mirrors a real dialog whose useFocusTrap onEscape removes it from the DOM
// synchronously, in direct response to the same Escape event (not a separate
// step afterward) - the only way a dialog's own dismissal actually reaches
// window's bubble-phase listener before it decides whether to count this
// Escape.
function openDialogThatClosesOnEscape() {
  const el = openDialog();
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape") el.remove();
  });
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

describe("triggerPanicRedirect vs. the beforeunload unsaved-changes guard", () => {
  afterEach(() => {
    removeBeforeUnloadWarning();
    localStorage.removeItem("saved_claims");
    localStorage.removeItem("vetrate_data_hash");
  });

  // REGRESSION GUARD: a beforeunload handler that calls preventDefault()
  // makes the browser show a native "Leave site?" prompt that blocks
  // location.replace() the same as any other navigation. The panic redirect
  // must never be blockable by it, in any state - including with genuinely
  // unsaved changes pending, which is exactly when a veteran is most likely
  // to be mid-task when they need Quick Exit.
  it("removes the beforeunload guard before redirecting, even with unsaved changes pending", () => {
    localStorage.setItem("saved_claims", '[{"id":1}]'); // never backed up - unsaved
    setupBeforeUnloadWarning();

    // Sanity: the guard is really armed before the panic redirect runs.
    expect(dispatchBeforeUnload().defaultPrevented).toBe(true);

    triggerPanicRedirect();

    expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
  });

  it("clears window.onbeforeunload (property-style registration) too", () => {
    window.onbeforeunload = () => "unsaved";

    triggerPanicRedirect();

    expect(window.onbeforeunload).toBeNull();
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

  // Owner decision C: only an Escape that closes a tool DIALOG is exempt -
  // a popup/menu closing on Escape still counts toward the panic threshold.
  it("an Escape that closes an aria-haspopup menu/popover still counts (decision C)", () => {
    const trigger = openMenuPopoverThatClosesOnEscape();
    for (let i = 0; i < ESCAPE_THRESHOLD; i++) {
      pressEscapeOn(trigger);
      vi.advanceTimersByTime(0);
    }
    expect(panicSpy).toHaveBeenCalledTimes(1);
    trigger.remove();
  });

  it("an Escape while an aria-haspopup menu/popover stays expanded (nothing closes it) also counts", () => {
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

  it("cleanupPanicKey stops future Escapes from being counted at all", () => {
    cleanupPanicKey();
    for (let i = 0; i < ESCAPE_THRESHOLD; i++) pressEscape();
    expect(panicSpy).not.toHaveBeenCalled();
  });
});

// Split from the describe block above to stay under max-lines-per-function -
// same setup/teardown, just the dialog-vs-panic-key dead-zone cases (item 3):
// a dialog that closes on its own Escape is never counted, but one that
// doesn't (non-dismissible by design, or a focus trap that never actually
// caught this keydown) must not swallow the panic key forever, stacked or not.
describe("Triple-Escape panic key counter - dialog dead zones", () => {
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

  it("an Escape that closes an open dialog is never counted, even 3+ in a row", () => {
    for (let i = 0; i < ESCAPE_THRESHOLD + 1; i++) {
      const dialog = openDialogThatClosesOnEscape();
      // Dispatch on the dialog itself so its own listener actually runs (and
      // removes it) as part of the same event dispatch that window's
      // bubble-phase listener observes - pressEscape() targets window
      // directly, which no real dialog-closing keydown handler ever sees.
      pressEscapeOn(dialog);
    }
    expect(panicSpy).not.toHaveBeenCalled();
  });

  // REGRESSION GUARD: a dialog that is open but does NOT actually respond to
  // Escape - a non-dismissible one by design (CrisisModal has no onEscape),
  // or one whose useFocusTrap never trapped focus in the first place (a
  // loading-state dialog with no focusable content, so this event never
  // reaches its element-scoped keydown listener at all) - must not swallow
  // the panic key for as long as it stays open. Plain openDialog() (no
  // listener) stands in for either root cause; the observable behavior -
  // "still present after the Escape" - is identical either way.
  it("an Escape while a dialog is open but does not close counts toward the panic sequence", () => {
    const dialog = openDialog();
    for (let i = 0; i < ESCAPE_THRESHOLD; i++) {
      pressEscapeOn(dialog);
      vi.advanceTimersByTime(0);
    }
    expect(panicSpy).toHaveBeenCalledTimes(1);
    dialog.remove();
  });

  // Stacked dialogs: closing the top one must not count (something WAS
  // dismissed), even though the one underneath is still open.
  it("an Escape that closes the top dialog of a stack is not counted, even with another dialog still open underneath", () => {
    const base = openDialog();
    for (let i = 0; i < ESCAPE_THRESHOLD + 1; i++) {
      const top = openDialogThatClosesOnEscape();
      pressEscapeOn(top);
    }
    expect(panicSpy).not.toHaveBeenCalled();
    base.remove();
  });

  // Stacked dialogs, neither responding: the count never decreases, so this
  // must not be swallowed either.
  it("an Escape while two stacked dialogs are both unresponsive still counts", () => {
    const base = openDialog();
    const top = openDialog();
    for (let i = 0; i < ESCAPE_THRESHOLD; i++) {
      pressEscapeOn(top);
      vi.advanceTimersByTime(0);
    }
    expect(panicSpy).toHaveBeenCalledTimes(1);
    base.remove();
    top.remove();
  });

  // REGRESSION GUARD: StressReliefDivision's Doom-easter-egg overlay and
  // AdminAuthContext both close on Escape via their own window-level BUBBLE
  // listener, added only once activated - well after boot's
  // initializePanicKey() registers this module's. A synchronous recount
  // read the dialog as still present (that later listener hadn't run yet)
  // and counted the very press that closed it - so closing the overlay and
  // pressing Escape twice more fired the panic redirect by accident.
  // Deferring the recount lets every same-phase listener, including one
  // registered after this module's own, finish first.
  it("an Escape closed by a later-registered window bubble listener (StressReliefDivision/AdminAuthContext pattern) is not counted", () => {
    const dialog = openDialog();
    const closeOnEscape = (e) => {
      if (e.key === "Escape") dialog.remove();
    };
    window.addEventListener("keydown", closeOnEscape);

    pressEscape(); // closes the dialog via the later listener - not counted
    vi.advanceTimersByTime(0);
    pressEscape();
    vi.advanceTimersByTime(0);
    pressEscape();
    vi.advanceTimersByTime(0);

    expect(panicSpy).not.toHaveBeenCalled();
    window.removeEventListener("keydown", closeOnEscape);
  });

  it("mixed sequence: dialog-closes don't count, but 3 real ones afterward still fire", () => {
    const dialog = openDialogThatClosesOnEscape();
    pressEscapeOn(dialog); // closes dialog - not counted

    for (let i = 0; i < ESCAPE_THRESHOLD; i++) pressEscape();
    expect(panicSpy).toHaveBeenCalledTimes(1);
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

  // REGRESSION GUARD: holding Escape sends OS auto-repeat keydowns
  // (event.repeat === true) after the initial press. A keyboard user with a
  // tremor or slow key release holding Escape to close a single dialog must
  // not have those repeats add up to an accidental panic redirect.
  it("auto-repeat keydowns (holding Escape) are never counted", () => {
    pressEscape(); // one genuine press
    for (let i = 0; i < 5; i++) pressEscape({ repeat: true });
    expect(panicSpy).not.toHaveBeenCalled();
  });

  // The rule (decided here, not just implicitly relied on): auto-repeat is
  // recognized by the native event.repeat flag - the same signal the browser
  // itself sets while a key is held - and is filtered unconditionally at the
  // very top of both the capture snapshot and the bubble decision, before
  // either touches the dialog/menu state or the panic counter. It is
  // identity-based (is this keydown a repeat?), not time-based (a debounce
  // window would either need to guess how long a "real" double-press can
  // take, or risk swallowing a second genuine press that lands quickly after
  // the first) - so holding Escape for any length of time after it closes a
  // dialog can never contribute to the panic count, not just "not within
  // some window". Advancing well past ESCAPE_WINDOW_MS/2 (300ms of a 600ms
  // window - comfortably past the "within half a second" a held key's OS
  // auto-repeat delay/rate would produce) with the redirect still never
  // having fired demonstrates that directly.
  it("holding Escape after it closes a dialog never misfires the panic redirect, no matter how long the key stays down", () => {
    const dialog = openDialogThatClosesOnEscape();
    pressEscapeOn(dialog); // real press: closes the dialog, not counted

    for (let i = 0; i < ESCAPE_THRESHOLD + 2; i++) {
      pressEscape({ repeat: true }); // OS auto-repeat while the key stays held
    }
    vi.advanceTimersByTime(ESCAPE_WINDOW_MS / 2);

    expect(panicSpy).not.toHaveBeenCalled();
  });
});

// Split from the describe block above to stay under max-lines-per-function -
// same setup/teardown, just the Tooltip/stopPropagation-swallow cases
// (decision C: only a dialog-closing Escape is exempt, so one a tooltip
// merely swallows via stopPropagation must still count).
describe("Triple-Escape panic key counter - tooltip/stopPropagation swallow (decision C)", () => {
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

  // REGRESSION GUARD (decision C): Tooltip.jsx dismisses on Escape via a
  // document capture-phase listener that calls stopPropagation (not
  // preventDefault). window's capture-phase snapshot still runs first
  // (window is above document in the capture order) - stopPropagation halts
  // the event before it ever reaches window's BUBBLE-phase listener
  // (handleEscapeKey), but decision C exempts only a dialog-closing Escape,
  // not one a tooltip (or anything else) merely swallows - so this must
  // still count. snapshotEscapeContext's own deferred capture-phase fallback
  // is what makes that true even though handleEscapeKey never runs at all
  // for this Escape.
  it("an Escape swallowed by a document capture-phase stopPropagation handler (e.g. Tooltip dismissing on Escape) still counts (decision C)", () => {
    const stopper = (e) => {
      if (e.key === "Escape") e.stopPropagation();
    };
    document.addEventListener("keydown", stopper, true);
    try {
      for (let i = 0; i < ESCAPE_THRESHOLD; i++) {
        pressEscapeOn(document.body);
        vi.advanceTimersByTime(0);
      }
      expect(panicSpy).toHaveBeenCalledTimes(1);
    } finally {
      // In a `try/finally`, not trailing code: a failed assertion above must
      // not leave this listener registered for every later test in the file
      // - it stops propagation for ANY Escape, so a leak here would silently
      // fail unrelated tests instead of just this one.
      document.removeEventListener("keydown", stopper, true);
    }
  });

  // REGRESSION GUARD (decision C): the same stopPropagation swallow, but with
  // a real dialog open underneath - e.g. a tooltip inside an open tool
  // dialog. The dialog itself never closes, so the fallback's dialog-count
  // comparison must not mistake "a tooltip closed" for "the dialog closed"
  // and wrongly exempt it.
  it("an Escape swallowed by stopPropagation while a dialog stays open still counts, without mistaking it for a dialog close", () => {
    const dialog = openDialog();
    const stopper = (e) => {
      if (e.key === "Escape") e.stopPropagation();
    };
    document.addEventListener("keydown", stopper, true);
    try {
      for (let i = 0; i < ESCAPE_THRESHOLD; i++) {
        pressEscapeOn(dialog);
        vi.advanceTimersByTime(0);
      }
      expect(panicSpy).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener("keydown", stopper, true);
      dialog.remove();
    }
  });

  // REGRESSION GUARD: live-browser-caught race, not reachable by the two
  // tests above (both flush each deferred fallback with
  // vi.advanceTimersByTime(0) before the next press, so only ever one is
  // in flight at a time). Reproduced live: hover the Report-a-Bug button,
  // press Escape 3 times as fast as Playwright can send them (~1ms apart,
  // well inside a single setTimeout(0) tick) - no redirect. Tooltip closes
  // (and its document capture-phase listener unmounts) on the FIRST Escape,
  // so presses 2 and 3 reach window's bubble phase normally while press 1's
  // fallback is still pending. A shared module-level "did this reach
  // bubble" flag was the cause: press 3's capture phase reset it to false,
  // then press 3's OWN bubble set it back to true - and by the time press
  // 1's deferred fallback finally read it, it saw press 3's `true`, not its
  // own outcome, and wrongly treated press 1 as already handled. Only 2 of
  // 3 presses ever counted. Tracking reachability on each event object
  // instead (not shared state) is what fixes it.
  it("three rapid Escapes, only the first swallowed by a self-removing stopPropagation handler (Tooltip closing on its own Escape), still redirect", () => {
    const stopper = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      document.removeEventListener("keydown", stopper, true);
    };
    document.addEventListener("keydown", stopper, true);
    try {
      for (let i = 0; i < ESCAPE_THRESHOLD; i++) pressEscapeOn(document.body);
      vi.advanceTimersByTime(0);
      expect(panicSpy).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener("keydown", stopper, true);
    }
  });
});

// Split out to stay under max-lines-per-function - owner decision C's exact
// exemption scope: only a dialog-closing Escape is exempt, so a non-dialog
// overlay (crisis modal is a dialog that never closes; a combobox is not a
// dialog at all) counts either way.
describe("Triple-Escape panic key counter - decision C exemption scope", () => {
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
      .querySelectorAll(
        '[role="dialog"], [role="alertdialog"], [aria-haspopup]',
      )
      .forEach((el) => el.remove());
    localStorage.removeItem("vetrate_safety_use_count");
  });

  // The crisis modal (role="alertdialog" + aria-modal, no onEscape by design
  // - see CrisisModal.jsx) never closes on Escape, so its Escapes count like
  // any other unhandled press.
  it("an Escape while the crisis modal is open (alertdialog, non-dismissible) counts toward the panic sequence", () => {
    const crisisModal = document.createElement("div");
    crisisModal.setAttribute("role", "alertdialog");
    crisisModal.setAttribute("aria-modal", "true");
    document.body.appendChild(crisisModal);
    for (let i = 0; i < ESCAPE_THRESHOLD; i++) {
      pressEscapeOn(crisisModal);
      vi.advanceTimersByTime(0);
    }
    expect(panicSpy).toHaveBeenCalledTimes(1);
    crisisModal.remove();
  });

  // A combobox (SearchBar's search suggestions - role=combobox +
  // aria-haspopup=listbox + aria-expanded) is not a dialog, so an Escape
  // that closes it still counts, unlike a dialog-closing Escape.
  it("an Escape that closes a search combobox's suggestion list still counts", () => {
    const combobox = document.createElement("input");
    combobox.setAttribute("role", "combobox");
    combobox.setAttribute("aria-haspopup", "listbox");
    combobox.setAttribute("aria-expanded", "true");
    combobox.addEventListener("keydown", (e) => {
      if (e.key === "Escape") combobox.setAttribute("aria-expanded", "false");
    });
    document.body.appendChild(combobox);
    for (let i = 0; i < ESCAPE_THRESHOLD; i++) {
      pressEscapeOn(combobox);
      vi.advanceTimersByTime(0);
    }
    expect(panicSpy).toHaveBeenCalledTimes(1);
    combobox.remove();
  });

  // Header.jsx's mobile nav drawer: role="dialog" aria-modal="true" (real
  // accessibility semantics - focus trap, background inertness) PLUS the
  // data-vetrate-nav-menu marker that tells DIALOG_SELECTOR it is a
  // navigation menu, not a tool dialog. Decision C is explicit that a menu/
  // drawer's Escape counts - unlike CrisisModal/combobox above (which count
  // for other reasons), this one matches every DIALOG_SELECTOR token
  // (role="dialog" AND aria-modal="true") and would be wrongly exempted
  // without the marker + the :not() exclusion in safetyRedirect.js.
  function openNavMenuDrawerThatClosesOnEscape() {
    const drawer = document.createElement("div");
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");
    drawer.setAttribute("data-vetrate-nav-menu", "true");
    drawer.addEventListener("keydown", (e) => {
      if (e.key === "Escape") drawer.remove();
    });
    document.body.appendChild(drawer);
    return drawer;
  }

  it("3 Escapes that each close the mobile nav drawer still redirect (decision C: menu, not a tool dialog)", () => {
    for (let i = 0; i < ESCAPE_THRESHOLD; i++) {
      const drawer = openNavMenuDrawerThatClosesOnEscape();
      pressEscapeOn(drawer);
      vi.advanceTimersByTime(0);
    }
    expect(panicSpy).toHaveBeenCalledTimes(1);
  });

  it("1 Escape that closes the mobile nav drawer closes it without redirecting", () => {
    const drawer = openNavMenuDrawerThatClosesOnEscape();
    pressEscapeOn(drawer);
    vi.advanceTimersByTime(0);
    expect(document.body.contains(drawer)).toBe(false);
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
