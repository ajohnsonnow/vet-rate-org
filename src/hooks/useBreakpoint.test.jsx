import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBreakpoint, useIsMobile } from "./useBreakpoint";

function setViewport(width, height = 800) {
  window.innerWidth = width;
  window.innerHeight = height;
  window.dispatchEvent(new Event("resize"));
}

afterEach(() => {
  window.innerWidth = 1024;
  window.innerHeight = 768;
});

describe("useBreakpoint", () => {
  it("classifies a desktop width", () => {
    window.innerWidth = 1280;
    window.innerHeight = 800;
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current.isDesktop).toBe(true);
    expect(result.current.isMobile).toBe(false);
    expect(result.current.bp).toBe("xl");
  });

  it("classifies a phone width and updates on resize", () => {
    const { result } = renderHook(() => useBreakpoint());
    act(() => setViewport(360, 740));
    expect(result.current.isMobile).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.bp).toBe("base");
  });

  it("treats 768px as the tablet boundary, not mobile", () => {
    const { result } = renderHook(() => useBreakpoint());
    act(() => setViewport(768, 1024));
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(true);
    expect(result.current.bp).toBe("md");
  });

  it("reports landscape orientation", () => {
    const { result } = renderHook(() => useBreakpoint());
    act(() => setViewport(900, 400));
    expect(result.current.isLandscape).toBe(true);
  });

  it("removes its listeners on unmount", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useBreakpoint());
    unmount();
    expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(remove).toHaveBeenCalledWith(
      "orientationchange",
      expect.any(Function),
    );
    remove.mockRestore();
  });
});

describe("useIsMobile", () => {
  it("mirrors the breakpoint's isMobile flag", () => {
    const { result } = renderHook(() => useIsMobile());
    act(() => setViewport(390, 844));
    expect(result.current).toBe(true);
    act(() => setViewport(1200, 800));
    expect(result.current).toBe(false);
  });
});
