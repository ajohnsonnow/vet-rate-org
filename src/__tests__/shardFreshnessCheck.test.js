import { describe, it, expect } from "vitest";
import { computeStaleness } from "../../scripts/dkb-sharding/check-shard-freshness.mjs";

// Fixed reference date for deterministic testing across every describe below.
const referenceDate = new Date("2026-08-15");

describe("computeStaleness — weekly cadence (21-day threshold)", () => {
  it("returns ok for recent date (1 day old)", () => {
    expect(computeStaleness("2026-08-14", "weekly", referenceDate)).toBe("ok");
  });

  it("returns ok for date at threshold (21 days old)", () => {
    expect(computeStaleness("2026-07-25", "weekly", referenceDate)).toBe("ok");
  });

  it("returns stale for date past threshold (22 days old)", () => {
    expect(computeStaleness("2026-07-24", "weekly", referenceDate)).toBe(
      "stale",
    );
  });
});

describe("computeStaleness — monthly cadence (45-day threshold)", () => {
  it("returns ok for recent date (30 days old)", () => {
    expect(computeStaleness("2026-07-16", "monthly", referenceDate)).toBe("ok");
  });

  it("returns ok for date at threshold (45 days old)", () => {
    expect(computeStaleness("2026-07-01", "monthly", referenceDate)).toBe("ok");
  });

  it("returns stale for date past threshold (46 days old)", () => {
    expect(computeStaleness("2026-06-30", "monthly", referenceDate)).toBe(
      "stale",
    );
  });
});

describe("computeStaleness — quarterly cadence (120-day threshold)", () => {
  it("returns ok for recent date (60 days old)", () => {
    expect(computeStaleness("2026-06-16", "quarterly", referenceDate)).toBe(
      "ok",
    );
  });

  it("returns ok for date at threshold (120 days old)", () => {
    expect(computeStaleness("2026-04-17", "quarterly", referenceDate)).toBe(
      "ok",
    );
  });

  it("returns stale for date past threshold (121 days old)", () => {
    expect(computeStaleness("2026-04-16", "quarterly", referenceDate)).toBe(
      "stale",
    );
  });
});

describe("computeStaleness — annual cadence (400-day threshold)", () => {
  it("returns ok for recent date (200 days old)", () => {
    expect(computeStaleness("2026-02-04", "annual", referenceDate)).toBe("ok");
  });

  it("returns ok for date at threshold (400 days old)", () => {
    expect(computeStaleness("2025-07-11", "annual", referenceDate)).toBe("ok");
  });

  it("returns stale for date past threshold (401 days old)", () => {
    expect(computeStaleness("2025-07-10", "annual", referenceDate)).toBe(
      "stale",
    );
  });
});

describe("computeStaleness — error handling", () => {
  it("returns error for invalid date string", () => {
    expect(computeStaleness("not-a-date", "weekly", referenceDate)).toBe(
      "error",
    );
  });

  it("returns error for unknown cadence", () => {
    expect(
      computeStaleness("2026-08-14", "unknown-cadence", referenceDate),
    ).toBe("error");
  });
});
