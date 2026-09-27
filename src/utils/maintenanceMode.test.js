/**
 * maintenanceMode.js owns two things: a synchronous read of the last-known
 * maintenance flag (so useBootSequence.js can decide whether to even start
 * a migration without waiting on the network) and the live /version.json
 * check that keeps that cache fresh and trips a kill switch the instant
 * maintenance turns on.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetchVersionJson = vi.fn();

vi.mock("./version", () => ({
  fetchVersionJson: (...args) => mockFetchVersionJson(...args),
}));

const {
  checkMaintenanceMode,
  readCachedMaintenanceMode,
  MAINTENANCE_MODE_CACHE_KEY,
  MAINTENANCE_MODE_CACHE_TIMESTAMP_KEY,
  MAINTENANCE_MODE_CACHE_TTL_MS,
} = await import("./maintenanceMode");

beforeEach(() => {
  mockFetchVersionJson.mockReset();
  localStorage.clear();
});

describe("readCachedMaintenanceMode", () => {
  it("returns false when nothing has ever been cached", () => {
    expect(readCachedMaintenanceMode()).toBe(false);
  });

  it("returns true once a successful fetch has cached maintenance as on", async () => {
    mockFetchVersionJson.mockResolvedValue({
      ok: true,
      data: { maintenance_mode: true, maintenance_message: "Down." },
    });

    await checkMaintenanceMode(vi.fn(), vi.fn());

    expect(readCachedMaintenanceMode()).toBe(true);
  });

  it("returns false again once a later successful fetch confirms maintenance is off", async () => {
    localStorage.setItem(MAINTENANCE_MODE_CACHE_KEY, "true");

    mockFetchVersionJson.mockResolvedValue({
      ok: true,
      data: { maintenance_mode: false },
    });
    await checkMaintenanceMode(vi.fn(), vi.fn());

    expect(readCachedMaintenanceMode()).toBe(false);
  });

  it("fails open (false) without throwing when localStorage.getItem throws", () => {
    // setup.js installs a plain-object localStorage shim (not a real Storage
    // instance) so every test runtime is spy-able the same way; spying on
    // Storage.prototype instead silently no-ops here, and the mutant this
    // regressed to (readCachedMaintenanceMode's catch failing closed) still
    // passed 9/9 with that spy target.
    const getItemSpy = vi
      .spyOn(localStorage, "getItem")
      .mockImplementation(() => {
        throw new Error("SecurityError: storage disabled");
      });

    expect(() => readCachedMaintenanceMode()).not.toThrow();
    expect(readCachedMaintenanceMode()).toBe(false);

    getItemSpy.mockRestore();
  });

  it("still trusts a cached 'on' flag while inside its TTL window", () => {
    localStorage.setItem(MAINTENANCE_MODE_CACHE_KEY, "true");
    localStorage.setItem(
      MAINTENANCE_MODE_CACHE_TIMESTAMP_KEY,
      String(Date.now()),
    );

    expect(readCachedMaintenanceMode()).toBe(true);
  });

  it("treats a cached 'on' flag as stale once its TTL has elapsed, so a device whose network keeps failing eventually retries the migration instead of skipping it forever", () => {
    localStorage.setItem(MAINTENANCE_MODE_CACHE_KEY, "true");
    localStorage.setItem(
      MAINTENANCE_MODE_CACHE_TIMESTAMP_KEY,
      String(Date.now() - MAINTENANCE_MODE_CACHE_TTL_MS - 1),
    );

    expect(readCachedMaintenanceMode()).toBe(false);
  });

  it("treats a cached 'on' flag with no timestamp (e.g. from before the TTL was added) as stale", () => {
    localStorage.setItem(MAINTENANCE_MODE_CACHE_KEY, "true");

    expect(readCachedMaintenanceMode()).toBe(false);
  });
});

describe("checkMaintenanceMode", () => {
  it("does not cache and returns false when the fetch itself is not ok", async () => {
    mockFetchVersionJson.mockResolvedValue({ ok: false, data: null });

    const result = await checkMaintenanceMode(vi.fn(), vi.fn());

    expect(result).toBe(false);
    expect(readCachedMaintenanceMode()).toBe(false);
  });

  it("fails open (false) without throwing when the fetch rejects", async () => {
    mockFetchVersionJson.mockRejectedValue(new Error("network down"));

    await expect(checkMaintenanceMode(vi.fn(), vi.fn())).resolves.toBe(false);
  });

  it("calls onMaintenanceOn and the setters, and returns true, when maintenance is on", async () => {
    mockFetchVersionJson.mockResolvedValue({
      ok: true,
      data: { maintenance_mode: true, maintenance_message: "Down for work." },
    });
    const setMaintenanceMode = vi.fn();
    const setMaintenanceMessage = vi.fn();
    const onMaintenanceOn = vi.fn();

    const result = await checkMaintenanceMode(
      setMaintenanceMode,
      setMaintenanceMessage,
      onMaintenanceOn,
    );

    expect(result).toBe(true);
    expect(onMaintenanceOn).toHaveBeenCalledTimes(1);
    expect(setMaintenanceMode).toHaveBeenCalledWith(true);
    expect(setMaintenanceMessage).toHaveBeenCalledWith("Down for work.");
  });

  it("never calls onMaintenanceOn when maintenance is off", async () => {
    mockFetchVersionJson.mockResolvedValue({
      ok: true,
      data: { maintenance_mode: false },
    });
    const onMaintenanceOn = vi.fn();

    const result = await checkMaintenanceMode(
      vi.fn(),
      vi.fn(),
      onMaintenanceOn,
    );

    expect(result).toBe(false);
    expect(onMaintenanceOn).not.toHaveBeenCalled();
  });

  it("still resolves normally when caching the result throws (fails open, no data loss)", async () => {
    mockFetchVersionJson.mockResolvedValue({
      ok: true,
      data: { maintenance_mode: true },
    });
    // See the getItem test above: spy on localStorage itself, not
    // Storage.prototype - setup.js's shim is a plain object, not a Storage
    // instance.
    const setItemSpy = vi
      .spyOn(localStorage, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
    const setMaintenanceMode = vi.fn();

    await expect(
      checkMaintenanceMode(setMaintenanceMode, vi.fn()),
    ).resolves.toBe(true);
    expect(setMaintenanceMode).toHaveBeenCalledWith(true);

    setItemSpy.mockRestore();
  });
});
