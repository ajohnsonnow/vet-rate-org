/**
 * D24-1: a saved profile that cannot be read is reported once, with a neutral
 * code and none of the stored value, every reader gets the same safe empty
 * result, and nothing replaces or deletes the unreadable value unless the
 * veteran chooses to start a new profile.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const PROFILE_KEY = "vet_rate_veteran_profile";
const COPY_KEY = "vet_rate_veteran_profile_unreadable_copy";
const SECRET = "Zebulon-Quillfeather-512-34-9876";

let profile;
let errors;
let events;
const onUnreadable = (e) => events.push(e.detail.code);

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
  events = [];
  window.addEventListener("vetrate:profile-unreadable", onUnreadable);
  profile = await import("./veteranProfile");
});

afterEach(() => {
  window.removeEventListener("vetrate:profile-unreadable", onUnreadable);
  vi.restoreAllMocks();
});

describe("readVeteranProfileQuiet", () => {
  it("never writes to the console, whatever the stored value is", () => {
    for (const stored of [SECRET, "[1]", "null", "7", '{"a":']) {
      localStorage.setItem(PROFILE_KEY, stored);
      expect(profile.readVeteranProfileQuiet().ok).toBe(false);
    }
    expect(errors).not.toHaveBeenCalled();
  });

  it.each([
    ["not JSON", SECRET, "PROFILE_NOT_JSON"],
    ["an array", "[1]", "PROFILE_WRONG_TYPE"],
    ["null", "null", "PROFILE_WRONG_TYPE"],
    ["a number", "7", "PROFILE_WRONG_TYPE"],
  ])("calls %s unreadable with a neutral code", (_n, stored, code) => {
    localStorage.setItem(PROFILE_KEY, stored);

    const result = profile.readVeteranProfileQuiet();

    expect(result).toMatchObject({ status: "unreadable", ok: false, code });
    expect(result.profile).toEqual({});
    expect(JSON.stringify(result.code)).not.toContain(SECRET);
  });

  it("calls a storage that throws unreadable", () => {
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });

    expect(profile.readVeteranProfileQuiet()).toMatchObject({
      status: "unreadable",
      code: "PROFILE_STORAGE_UNAVAILABLE",
    });
  });

  it("tells an absent profile and a readable one apart", () => {
    expect(profile.readVeteranProfileQuiet().status).toBe("absent");
    localStorage.setItem(PROFILE_KEY, '{"city":"Springfield"}');
    expect(profile.readVeteranProfileQuiet()).toMatchObject({
      status: "ok",
      profile: { city: "Springfield" },
    });
  });
});

describe("getVeteranProfile on an unreadable profile", () => {
  beforeEach(() => localStorage.setItem(PROFILE_KEY, SECRET));

  it("returns an empty profile and reports once, never echoing the value", () => {
    for (let i = 0; i < 500; i += 1) {
      expect(profile.getVeteranProfile()).toEqual({});
    }

    expect(errors).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(errors.mock.calls)).not.toContain(SECRET);
    expect(events).toEqual(["PROFILE_NOT_JSON"]);
  });

  it("reports again only after a read succeeded in between", () => {
    profile.getVeteranProfile();
    localStorage.setItem(PROFILE_KEY, '{"city":"Springfield"}');
    profile.getVeteranProfile();
    localStorage.setItem(PROFILE_KEY, "[]");
    profile.getVeteranProfile();

    expect(errors).toHaveBeenCalledTimes(2);
  });

  it("throws a neutral error to a caller that must know", () => {
    expect(() => profile.getVeteranProfile({ strict: true })).toThrow(
      "PROFILE_NOT_JSON",
    );
    expect(() => profile.getVeteranProfile({ strict: true })).not.toThrow(
      SECRET,
    );
  });

  it("lets the other profile tools run without throwing", () => {
    expect(() => profile.hasVeteranProfile()).not.toThrow();
    expect(() => profile.getServiceHistory()).not.toThrow();
  });
});

describe("a save onto an unreadable profile", () => {
  it("keeps the unreadable value under its own key instead of losing it", () => {
    localStorage.setItem(PROFILE_KEY, SECRET);

    expect(profile.saveVeteranProfile({ city: "Springfield" })).toBe(true);

    expect(localStorage.getItem(COPY_KEY)).toBe(SECRET);
    expect(JSON.parse(localStorage.getItem(PROFILE_KEY))).toMatchObject({
      city: "Springfield",
    });
  });

  it("keeps the first unreadable copy when a later one appears", () => {
    localStorage.setItem(PROFILE_KEY, SECRET);
    profile.saveVeteranProfile({ city: "Springfield" });
    localStorage.setItem(PROFILE_KEY, "[]");
    profile.saveVeteranProfile({ city: "Shelbyville" });

    expect(localStorage.getItem(COPY_KEY)).toBe(SECRET);
  });

  it("writes no copy when the profile was readable", () => {
    profile.saveVeteranProfile({ city: "Springfield" });
    profile.saveVeteranProfile({ city: "Shelbyville" });

    expect(localStorage.getItem(COPY_KEY)).toBeNull();
  });

  it("announces the change so the console capture rebuilds its list", () => {
    const changed = vi.fn();
    window.addEventListener("vetrate:profile-changed", changed);

    profile.saveVeteranProfile({ city: "Springfield" });
    profile.clearVeteranProfile();

    window.removeEventListener("vetrate:profile-changed", changed);
    expect(changed).toHaveBeenCalledTimes(2);
  });
});

describe("starting a new profile in place of an unreadable one", () => {
  it("removes it from the profile key and keeps a copy", () => {
    localStorage.setItem(PROFILE_KEY, SECRET);

    expect(profile.startNewProfileInPlaceOfUnreadable()).toBe(true);

    expect(localStorage.getItem(PROFILE_KEY)).toBeNull();
    expect(localStorage.getItem(COPY_KEY)).toBe(SECRET);
    expect(profile.readVeteranProfileQuiet().status).toBe("absent");
  });
});
