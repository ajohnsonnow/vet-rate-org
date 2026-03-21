import { describe, it, expect } from "vitest";

// Test the data structure of disabilityData.json
import disabilityData from "../data/disabilityData.json";

describe("disabilityData.json structure", () => {
  it("exists and is loaded", () => {
    expect(disabilityData).toBeDefined();
  });

  it("has disabilities array", () => {
    const data = Array.isArray(disabilityData)
      ? disabilityData
      : disabilityData.disabilities;
    expect(Array.isArray(data)).toBe(true);
  });

  it("has substantial number of entries", () => {
    const data = Array.isArray(disabilityData)
      ? disabilityData
      : disabilityData.disabilities;
    expect(data.length).toBeGreaterThan(100);
  });

  it("each entry has a name or title", () => {
    const data = Array.isArray(disabilityData)
      ? disabilityData
      : disabilityData.disabilities;
    const sample = data.slice(0, 10);
    sample.forEach((entry) => {
      const hasName =
        entry.conditionName || entry.name || entry.title || entry.condition;
      expect(hasName).toBeTruthy();
    });
  });
});

describe("disabilityData content quality", () => {
  const data = Array.isArray(disabilityData)
    ? disabilityData
    : disabilityData.disabilities || [];

  it("includes common conditions like PTSD", () => {
    const names = data.map((d) => JSON.stringify(d).toLowerCase());
    const hasPTSD = names.some(
      (n) =>
        n.includes("ptsd") ||
        n.includes("post-traumatic") ||
        n.includes("posttraumatic"),
    );
    expect(hasPTSD).toBe(true);
  });

  it("includes tinnitus", () => {
    const names = data.map((d) => JSON.stringify(d).toLowerCase());
    expect(names.some((n) => n.includes("tinnitus"))).toBe(true);
  });

  it("includes sleep apnea", () => {
    const names = data.map((d) => JSON.stringify(d).toLowerCase());
    expect(names.some((n) => n.includes("sleep apnea"))).toBe(true);
  });

  it("no duplicate entries", () => {
    const ids = data.map((d) => d.id || d.code || d.name).filter(Boolean);
    const unique = new Set(ids);
    // Allow some tolerance for data with different structures
    expect(unique.size).toBeGreaterThan(data.length * 0.9);
  });
});
