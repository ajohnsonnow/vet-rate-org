import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import UnreadableProfileNotice from "./UnreadableProfileNotice";
import { getVeteranProfile, saveVeteranProfile } from "../utils/veteranProfile";

const PROFILE_KEY = "vet_rate_veteran_profile";
const COPY_KEY = "vet_rate_veteran_profile_unreadable_copy";
const BROKEN = "{oops-not-json";

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("UnreadableProfileNotice", () => {
  it("shows nothing for a readable or absent profile", () => {
    localStorage.setItem(PROFILE_KEY, '{"city":"Springfield"}');

    render(<UnreadableProfileNotice />);

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("says what happened, that other data is untouched, and what can be done", () => {
    localStorage.setItem(PROFILE_KEY, BROKEN);

    render(<UnreadableProfileNotice />);

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("could not be read");
    expect(notice).toHaveTextContent("Nothing was deleted or changed");
    expect(notice).toHaveTextContent("untouched");
    expect(
      screen.getByRole("button", { name: "Restore a backup" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Start a new profile" }),
    ).toBeVisible();
    expect(notice).not.toHaveTextContent("oops");
  });

  it("never deletes or replaces the profile on its own", () => {
    localStorage.setItem(PROFILE_KEY, BROKEN);

    render(<UnreadableProfileNotice />);
    getVeteranProfile();

    expect(localStorage.getItem(PROFILE_KEY)).toBe(BROKEN);
  });

  it("opens the backup manager from Restore a backup", () => {
    localStorage.setItem(PROFILE_KEY, BROKEN);
    const opened = vi.fn();
    window.addEventListener("openBackupManager", opened);
    render(<UnreadableProfileNotice />);

    fireEvent.click(screen.getByRole("button", { name: "Restore a backup" }));

    window.removeEventListener("openBackupManager", opened);
    expect(opened).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PROFILE_KEY)).toBe(BROKEN);
  });
});

describe("UnreadableProfileNotice choices", () => {
  it("asks before starting a new profile, and Cancel changes nothing", () => {
    localStorage.setItem(PROFILE_KEY, BROKEN);
    render(<UnreadableProfileNotice />);

    fireEvent.click(
      screen.getByRole("button", { name: "Start a new profile" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("a copy");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(localStorage.getItem(PROFILE_KEY)).toBe(BROKEN);
    expect(screen.getByRole("status")).toHaveTextContent("could not be read");
  });

  it("starts a new profile only after confirmation and keeps a copy", () => {
    localStorage.setItem(PROFILE_KEY, BROKEN);
    render(<UnreadableProfileNotice />);

    fireEvent.click(
      screen.getByRole("button", { name: "Start a new profile" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Yes, start a new profile" }),
    );

    expect(screen.queryByRole("status")).toBeNull();
    expect(localStorage.getItem(PROFILE_KEY)).toBeNull();
    expect(localStorage.getItem(COPY_KEY)).toBe(BROKEN);
  });

  it("Not now hides it without touching the profile", () => {
    localStorage.setItem(PROFILE_KEY, BROKEN);
    render(<UnreadableProfileNotice />);

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(screen.queryByRole("status")).toBeNull();
    expect(localStorage.getItem(PROFILE_KEY)).toBe(BROKEN);
  });

  it("tells the veteran when a save started a new profile over the unreadable one", () => {
    localStorage.setItem(PROFILE_KEY, BROKEN);
    render(<UnreadableProfileNotice />);

    act(() => {
      saveVeteranProfile({ city: "Springfield" });
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "a new profile was started",
    );
    expect(localStorage.getItem(COPY_KEY)).toBe(BROKEN);
  });

  it("appears when a read finds the profile unreadable after the app loaded", () => {
    getVeteranProfile();
    render(<UnreadableProfileNotice />);
    expect(screen.queryByRole("status")).toBeNull();

    act(() => {
      localStorage.setItem(PROFILE_KEY, BROKEN);
      getVeteranProfile();
    });

    expect(screen.getByRole("status")).toHaveTextContent("could not be read");
  });
});

describe("UnreadableProfileNotice after Not now", () => {
  it("still tells the veteran when a later save replaced the unreadable profile", () => {
    localStorage.setItem(PROFILE_KEY, BROKEN);
    render(<UnreadableProfileNotice />);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("status")).toBeNull();

    act(() => {
      saveVeteranProfile({ city: "Springfield" });
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "a new profile was started",
    );
    expect(localStorage.getItem(COPY_KEY)).toBe(BROKEN);
  });

  it("says so, and changes nothing, when a copy cannot be kept", () => {
    localStorage.setItem(PROFILE_KEY, BROKEN);
    render(<UnreadableProfileNotice />);
    const realSetItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, "setItem").mockImplementation((key, value) => {
      if (String(key).startsWith(COPY_KEY)) throw new Error("full");
      return realSetItem(key, value);
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Start a new profile" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Yes, start a new profile" }),
    );

    expect(screen.getByRole("status")).toHaveTextContent("was not started");
    expect(localStorage.getItem(PROFILE_KEY)).toBe(BROKEN);
  });
});
