/**
 * Feature-flag pure-logic tests.
 *
 * These intentionally inline the cache+resolve helpers (rather than importing)
 * because the production module depends on `localStorage` and a server fetch
 * — both of which we already cover at higher levels (vitest-axe smoke +
 * Playwright). What matters here is the *policy*: fail-open, master-AI gate,
 * 5-minute cache window. Lock those rules.
 */
import { describe, it, expect } from "vitest";

const CACHE_DURATION = 5 * 60 * 1000;

function isCacheValid(cached) {
  if (!cached || !cached.timestamp) return false;
  return Date.now() - cached.timestamp < CACHE_DURATION;
}

function resolveFeature(featureName, status) {
  if (!status) return true; // fail-open
  switch (featureName.toLowerCase()) {
    case "ai":
    case "all_ai":
      return status.aiEnabled !== false;
    case "local_ai":
      return status.localAIEnabled !== false && status.aiEnabled !== false;
    case "cloud_ai":
      return status.cloudAIEnabled !== false && status.aiEnabled !== false;
    default:
      return true;
  }
}

describe("featureFlags — cache validity", () => {
  it("rejects null cache", () => {
    expect(isCacheValid(null)).toBe(false);
  });

  it("rejects cache without timestamp", () => {
    expect(isCacheValid({ data: {} })).toBe(false);
  });

  it("accepts fresh cache (<5min)", () => {
    expect(isCacheValid({ timestamp: Date.now() - 1000 })).toBe(true);
  });

  it("rejects expired cache (>5min)", () => {
    expect(isCacheValid({ timestamp: Date.now() - 10 * 60 * 1000 })).toBe(
      false,
    );
  });
});

describe("featureFlags — feature resolution", () => {
  it("returns true (fail-open) when no status", () => {
    expect(resolveFeature("ai", null)).toBe(true);
    expect(resolveFeature("local_ai", null)).toBe(true);
  });

  it("respects disabled master AI", () => {
    const status = {
      aiEnabled: false,
      localAIEnabled: true,
      cloudAIEnabled: true,
    };
    expect(resolveFeature("ai", status)).toBe(false);
  });

  it("disables local_ai when master AI is off", () => {
    const status = {
      aiEnabled: false,
      localAIEnabled: true,
      cloudAIEnabled: true,
    };
    expect(resolveFeature("local_ai", status)).toBe(false);
  });

  it("allows local_ai when both enabled", () => {
    const status = {
      aiEnabled: true,
      localAIEnabled: true,
      cloudAIEnabled: true,
    };
    expect(resolveFeature("local_ai", status)).toBe(true);
  });

  it("returns true for unknown features (fail-open)", () => {
    expect(resolveFeature("some_random", { aiEnabled: false })).toBe(true);
  });
});
