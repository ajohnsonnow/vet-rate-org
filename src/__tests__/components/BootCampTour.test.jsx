/**
 * BootCampTour — accessibility regressions
 *
 * Two WCAG 2.2 expectations that were drifting before PR5:
 *  1. SC 2.1.2 (No keyboard trap): Escape must dismiss the tour. Driver.js
 *     handles this via `allowClose: true`, so we verify we still pass that
 *     option and we wire the OS-level shortcut.
 *  2. SC 2.3.3 (Animation from interactions): if the OS reports
 *     `prefers-reduced-motion: reduce`, popover transitions and smooth
 *     scroll must be disabled.
 *
 * We run the test against the real driver(...) factory but stub the
 * `drive()` call so no DOM popover is actually shown.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import React from "react";

// Driver.js is loaded as an ESM module; we mock the named export so we can
// inspect what config the component passes in.
const driverFactory = vi.fn();
vi.mock("driver.js", () => ({
  driver: (cfg) => {
    driverFactory(cfg);
    return {
      drive: vi.fn(),
      destroy: vi.fn(),
    };
  },
}));

vi.mock("driver.js/dist/driver.css", () => ({}));

vi.mock("../../contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: (_section, key) => key }),
}));

vi.mock("../../data/toolkitData", () => ({
  getTotalToolCount: () => 42,
}));

vi.mock("../../data/projectStats", () => ({
  PROJECT_STATS: { disabilitiesValidated: "1,000+" },
}));

import BootCampTour from "../../components/BootCampTour";

const setMatchMedia = (reduced) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: query.includes("prefers-reduced-motion") ? reduced : false,
      media: query,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

describe("BootCampTour accessibility", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    driverFactory.mockReset();
    localStorage.clear();
    // Pretend TOS was accepted so the tour proceeds straight to startTour().
    localStorage.setItem("vet-rate-tos-accepted", "true");
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("disables popover animation + smooth scroll when prefers-reduced-motion: reduce", () => {
    setMatchMedia(true);
    render(<BootCampTour forceShow />);

    // Walk through the chained setTimeouts the component uses (500ms TOS
    // wait → 300ms Whats-New wait → 100ms Navigator-close wait).
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(driverFactory).toHaveBeenCalledTimes(1);
    const cfg = driverFactory.mock.calls[0][0];
    expect(cfg.animate).toBe(false);
    expect(cfg.smoothScroll).toBe(false);
    // Escape must still dismiss the tour.
    expect(cfg.allowClose).toBe(true);
  });

  it("enables animation when prefers-reduced-motion is not set", () => {
    setMatchMedia(false);
    render(<BootCampTour forceShow />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(driverFactory).toHaveBeenCalledTimes(1);
    const cfg = driverFactory.mock.calls[0][0];
    expect(cfg.animate).toBe(true);
    expect(cfg.smoothScroll).toBe(true);
    expect(cfg.allowClose).toBe(true);
  });
});
