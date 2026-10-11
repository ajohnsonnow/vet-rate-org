/**
 * With site storage blocked, touching localStorage or sessionStorage throws.
 * The app must say so plainly instead of rendering a blank page, and Quick
 * Exit must keep working. Storage access is made to throw here.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const panic = vi.hoisted(() => ({ trigger: vi.fn() }));
vi.mock("../../utils/safetyRedirect", () => ({
  triggerPanicRedirect: panic.trigger,
  triggerSoftExit: vi.fn(),
}));

const { isStorageBlocked } = await import("../../utils/storageAvailability");
const { default: StorageBlockedNotice } =
  await import("../../components/StorageBlockedNotice.jsx");

const realLocal = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const realSession = Object.getOwnPropertyDescriptor(
  globalThis,
  "sessionStorage",
);

function blockStorage(name, how) {
  const value = {
    throwsOnAccess: undefined,
    throwsOnRead: {
      getItem() {
        throw new DOMException("denied", "SecurityError");
      },
    },
    isNull: null,
  }[how];
  Object.defineProperty(globalThis, name, {
    configurable: true,
    get() {
      if (how === "throwsOnAccess") {
        throw new DOMException("denied", "SecurityError");
      }
      return value;
    },
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (realLocal) Object.defineProperty(globalThis, "localStorage", realLocal);
  if (realSession)
    Object.defineProperty(globalThis, "sessionStorage", realSession);
  panic.trigger.mockClear();
});

describe("isStorageBlocked", () => {
  it("is false when storage works, and writes nothing to find out", () => {
    const setItem = vi.spyOn(localStorage, "setItem");
    expect(isStorageBlocked()).toBe(false);
    expect(setItem).not.toHaveBeenCalled();
  });

  it.each([
    ["localStorage", "throwsOnAccess"],
    ["sessionStorage", "throwsOnAccess"],
    ["localStorage", "throwsOnRead"],
    ["sessionStorage", "throwsOnRead"],
    ["localStorage", "isNull"],
    ["sessionStorage", "isNull"],
  ])("is true when %s is blocked (%s)", (name, how) => {
    blockStorage(name, how);
    expect(isStorageBlocked()).toBe(true);
  });
});

describe("StorageBlockedNotice", () => {
  it("explains the problem in plain words with storage throwing", () => {
    blockStorage("localStorage", "throwsOnAccess");
    blockStorage("sessionStorage", "throwsOnAccess");
    render(<StorageBlockedNotice />);
    expect(
      screen.getByRole("heading", { name: /blocking storage/i }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /stores your information only on this device, and this browser is blocking storage/,
      ),
    ).toBeTruthy();
  });

  it("keeps Quick Exit working with one tap", () => {
    blockStorage("localStorage", "throwsOnAccess");
    render(<StorageBlockedNotice />);
    fireEvent.click(screen.getByRole("button", { name: /quick exit/i }));
    expect(panic.trigger).toHaveBeenCalledTimes(1);
  });
});
