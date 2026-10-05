import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import useClaimProgress from "./useClaimProgress";

afterEach(() => vi.restoreAllMocks());

describe("useClaimProgress when storage throws on read", () => {
  it("shows no progress instead of crashing the page", () => {
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });

    const { result } = renderHook(() => useClaimProgress());

    expect(result.error).toBeUndefined();
    expect(result.current).toBeTruthy();
  });
});
