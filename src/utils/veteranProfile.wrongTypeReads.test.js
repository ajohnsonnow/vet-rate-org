import { describe, it, expect, afterEach, vi } from "vitest";
import { getMyRatings, getServiceHistory } from "./veteranProfile";

const RATINGS_KEY = "vet_rate_my_ratings";
const HISTORY_KEY = "vet_rate_service_history";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("reads of valid JSON that has the wrong type", () => {
  it("returns an empty list when saved ratings are an object", () => {
    localStorage.setItem(RATINGS_KEY, JSON.stringify({ a: 1 }));
    expect(getMyRatings()).toEqual([]);
  });

  it("does not rewrite a service history that is an array", () => {
    const stored = JSON.stringify([{ id: "p1", branch: "Army" }]);
    localStorage.setItem(HISTORY_KEY, stored);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const history = getServiceHistory();

    expect(history.servicePeriods).toEqual([]);
    expect(localStorage.getItem(HISTORY_KEY)).toBe(stored);
  });

  it("throws in strict mode for a service history that is an array", () => {
    localStorage.setItem(HISTORY_KEY, "[]");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => getServiceHistory({ strict: true })).toThrow();
  });
});
