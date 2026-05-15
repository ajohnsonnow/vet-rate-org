import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  isFeatureEnabled,
  refreshSystemStatus,
} from "../../utils/featureFlags";

const CACHE_KEY = "vetrate_system_status";

function seedCache(data, ageMs = 0) {
  localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ data, timestamp: Date.now() - ageMs }),
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("isFeatureEnabled — fail-open semantics", () => {
  it("returns true when no cache exists (fail-open)", () => {
    expect(isFeatureEnabled("ai")).toBe(true);
    expect(isFeatureEnabled("local_ai")).toBe(true);
    expect(isFeatureEnabled("cloud_ai")).toBe(true);
  });

  it("returns true when cache is expired (fail-open)", () => {
    seedCache({ aiEnabled: false }, 10 * 60 * 1000);
    expect(isFeatureEnabled("ai")).toBe(true);
  });

  it("returns true for unknown feature names", () => {
    seedCache({ aiEnabled: false });
    expect(isFeatureEnabled("does_not_exist")).toBe(true);
    expect(isFeatureEnabled("random_string")).toBe(true);
  });

  it("returns true when localStorage throws (fail-open)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => {
      throw new Error("storage unavailable");
    });
    expect(isFeatureEnabled("ai")).toBe(true);
  });
});

describe("isFeatureEnabled — kill-switch semantics", () => {
  it("blocks AI when master flag is false in fresh cache", () => {
    seedCache({
      aiEnabled: false,
      localAIEnabled: true,
      cloudAIEnabled: true,
    });
    expect(isFeatureEnabled("ai")).toBe(false);
    expect(isFeatureEnabled("all_ai")).toBe(false);
  });

  it("blocks local_ai when master AI is off", () => {
    seedCache({
      aiEnabled: false,
      localAIEnabled: true,
      cloudAIEnabled: true,
    });
    expect(isFeatureEnabled("local_ai")).toBe(false);
  });

  it("blocks cloud_ai when master AI is off", () => {
    seedCache({
      aiEnabled: false,
      localAIEnabled: true,
      cloudAIEnabled: true,
    });
    expect(isFeatureEnabled("cloud_ai")).toBe(false);
  });

  it("blocks local_ai when only localAIEnabled is false", () => {
    seedCache({
      aiEnabled: true,
      localAIEnabled: false,
      cloudAIEnabled: true,
    });
    expect(isFeatureEnabled("local_ai")).toBe(false);
    expect(isFeatureEnabled("cloud_ai")).toBe(true);
  });

  it("blocks cloud_ai when only cloudAIEnabled is false", () => {
    seedCache({
      aiEnabled: true,
      localAIEnabled: true,
      cloudAIEnabled: false,
    });
    expect(isFeatureEnabled("cloud_ai")).toBe(false);
    expect(isFeatureEnabled("local_ai")).toBe(true);
  });

  it("is case-insensitive for feature names", () => {
    seedCache({ aiEnabled: false });
    expect(isFeatureEnabled("AI")).toBe(false);
    expect(isFeatureEnabled("Local_AI")).toBe(false);
  });
});

describe("refreshSystemStatus — fetch path", () => {
  it("returns parsed status on 200 OK", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          ai_enabled: true,
          features: { local_ai: true, cloud_ai: false },
          system_status: "degraded",
          maintenance_message: "Cloud LLM down",
        }),
    });

    const result = await refreshSystemStatus();
    expect(result).toEqual({
      aiEnabled: true,
      localAIEnabled: true,
      cloudAIEnabled: false,
      warning: "Cloud LLM down",
      systemStatus: "degraded",
    });
  });

  it("returns null when response is not OK", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({}),
    });
    const result = await refreshSystemStatus();
    expect(result).toBeNull();
  });

  it("returns null when fetch throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error("network"));
    const result = await refreshSystemStatus();
    expect(result).toBeNull();
  });

  it("clears cached status before refetching", async () => {
    seedCache({ aiEnabled: false });
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await refreshSystemStatus();
    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it("defaults to nominal status when fields are absent", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const result = await refreshSystemStatus();
    expect(result.aiEnabled).toBe(true);
    expect(result.localAIEnabled).toBe(true);
    expect(result.cloudAIEnabled).toBe(true);
    expect(result.systemStatus).toBe("nominal");
    expect(result.warning).toBeNull();
  });
});
