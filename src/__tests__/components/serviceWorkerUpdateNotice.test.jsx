/**
 * The "a new version is ready" notice. It appears only when the service
 * worker registration reports a waiting worker (`sw-update-available`), never
 * reloads by itself, waits while an import, a dialog or a text field is in
 * use, and goes away for good once the panic key has fired.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

const importState = vi.hoisted(() => ({ id: null }));
vi.mock("../../utils/importProgressMarker", () => ({
  readActiveImportMarker: () =>
    importState.id ? { id: importState.id } : null,
}));
vi.mock("../../utils/updateChecker", () => ({
  startUpdateChecker: vi.fn(),
  stopUpdateChecker: vi.fn(),
  applyUpdate: vi.fn(),
}));
vi.mock("../../utils/changelogGenerator", () => ({
  generateWhatsNewChangelog: () => null,
}));

const { useUpdateOrchestrator } =
  await import("../../features/update/useUpdateOrchestrator.jsx");

const TEXT = "A new version is ready. Reload to update.";

function Harness() {
  const { updateBanner } = useUpdateOrchestrator();
  return <div>{updateBanner}</div>;
}

const announce = (accept) =>
  act(() => {
    window.dispatchEvent(
      new CustomEvent("sw-update-available", {
        detail: accept === undefined ? undefined : { accept },
      }),
    );
  });
const tick = (ms) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

let reload;
beforeEach(() => {
  vi.useFakeTimers();
  importState.id = null;
  localStorage.clear();
  reload = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, reload },
  });
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("service worker update notice", () => {
  it("shows nothing until a new version is waiting", () => {
    render(<Harness />);
    expect(screen.queryByText(TEXT)).toBeNull();
  });

  it("shows the notice with a Reload button and a dismiss button", () => {
    render(<Harness />);
    announce(vi.fn());
    expect(screen.getByRole("status").textContent).toContain(TEXT);
    expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Dismiss update notice" }),
    ).toBeTruthy();
  });

  it("never activates or reloads on its own", () => {
    const accept = vi.fn();
    render(<Harness />);
    announce(accept);
    tick(10 * 60 * 1000);
    expect(accept).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByText(TEXT)).toBeTruthy();
  });

  it("does not take focus when it appears", () => {
    render(<Harness />);
    const before = document.activeElement;
    announce(vi.fn());
    expect(document.activeElement).toBe(before);
  });

  it("asks the waiting worker to take over only when Reload is clicked", () => {
    const accept = vi.fn();
    render(<Harness />);
    announce(accept);
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(accept).toHaveBeenCalledTimes(1);
  });

  it("falls back to a plain reload if the worker never takes over", () => {
    render(<Harness />);
    announce(vi.fn());
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(reload).not.toHaveBeenCalled();
    tick(5000);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads on click when the event carries no accept function", () => {
    render(<Harness />);
    announce(undefined);
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("goes away when dismissed and does not come back on its own", () => {
    render(<Harness />);
    announce(vi.fn());
    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss update notice" }),
    );
    expect(screen.queryByText(TEXT)).toBeNull();
    tick(60_000);
    expect(screen.queryByText(TEXT)).toBeNull();
  });
});

describe("service worker update notice is held back", () => {
  it("while an import is running, then appears when it ends", () => {
    importState.id = "import-1";
    render(<Harness />);
    announce(vi.fn());
    expect(screen.queryByText(TEXT)).toBeNull();
    importState.id = null;
    tick(2000);
    expect(screen.getByText(TEXT)).toBeTruthy();
  });

  it("while a dialog is open, then appears when it closes", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);
    render(<Harness />);
    announce(vi.fn());
    expect(screen.queryByText(TEXT)).toBeNull();
    dialog.remove();
    tick(2000);
    expect(screen.getByText(TEXT)).toBeTruthy();
  });

  it("while an alert dialog (the safety screens) is open", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "alertdialog");
    document.body.appendChild(dialog);
    render(<Harness />);
    announce(vi.fn());
    tick(10_000);
    expect(screen.queryByText(TEXT)).toBeNull();
  });

  it("while a text field has focus", () => {
    const field = document.createElement("textarea");
    document.body.appendChild(field);
    field.focus();
    render(<Harness />);
    announce(vi.fn());
    expect(screen.queryByText(TEXT)).toBeNull();
    field.blur();
    tick(2000);
    expect(screen.getByText(TEXT)).toBeTruthy();
  });

  it("is not held back by a focused button", () => {
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();
    render(<Harness />);
    announce(vi.fn());
    expect(screen.getByText(TEXT)).toBeTruthy();
  });
});

describe("service worker update notice and the panic key", () => {
  it("disappears and stays gone once the panic key has fired", () => {
    render(<Harness />);
    announce(vi.fn());
    act(() => {
      window.dispatchEvent(new CustomEvent("vetrate:panic-triggered"));
    });
    expect(screen.queryByText(TEXT)).toBeNull();
    announce(vi.fn());
    expect(screen.queryByText(TEXT)).toBeNull();
  });

  it("does not use storage, so nothing it does can touch the wipe", () => {
    const setItem = vi.spyOn(localStorage, "setItem");
    render(<Harness />);
    setItem.mockClear();
    announce(vi.fn());
    tick(10_000);
    expect(setItem).not.toHaveBeenCalled();
  });
});
