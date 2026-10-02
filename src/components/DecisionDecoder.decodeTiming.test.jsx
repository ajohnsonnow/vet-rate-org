/**
 * D21-8 / D20-10: a fixed 90 s cut-off failed an on-device decode on an engine
 * that needs longer, with no sign of life while it ran. The budget now scales
 * to the pace measured from the previous decode, the veteran sees elapsed time
 * and a plain "still working" note, and a timed-out retry is given more room.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, renderHook, act } from "@testing-library/react";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const mockDecodeDecision = vi.fn();
vi.mock("../utils/aiStatementHelper", () => ({
  decodeDecision: (...args) => mockDecodeDecision(...args),
  isAIAvailable: () => true,
}));
vi.mock("../utils/unifiedAIService", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getAIStatus: () => ({ anyAvailable: true }) };
});

const timing = await import("../utils/decodeTiming");
const { useDecisionDecode, DecodeProgressNotice } =
  await import("./DecisionDecoder.jsx");

const LETTER =
  "SYNTHETIC TEST DENIAL LETTER. Service connection for tinnitus is denied. " +
  "The evidence does not establish a nexus between the current disability " +
  "and any in-service event.";
const GOOD = {
  success: true,
  data: { decision_type: "Full Denial", plain_english: "Denied." },
};

beforeEach(() => {
  mockDecodeDecision.mockReset();
  timing.resetDecodeSpeed();
  vi.useRealTimers();
});

describe("getDecodeTimeoutMs", () => {
  it("allows 180 s before any decode has been measured", () => {
    expect(timing.getDecodeTimeoutMs()).toBe(180_000);
  });

  it("scales to three times the last measured decode, between 90 s and 300 s", () => {
    timing.recordDecodeDuration(2_000);
    expect(timing.getDecodeTimeoutMs()).toBe(90_000);
    timing.recordDecodeDuration(60_000);
    expect(timing.getDecodeTimeoutMs()).toBe(180_000);
    timing.recordDecodeDuration(200_000);
    expect(timing.getDecodeTimeoutMs()).toBe(300_000);
  });

  it("ignores a zero, negative or non-numeric duration", () => {
    timing.recordDecodeDuration(60_000);
    timing.recordDecodeDuration(0);
    timing.recordDecodeDuration(Number.NaN);
    expect(timing.getDecodeTimeoutMs()).toBe(180_000);
  });
});

describe("useDecisionDecode: time budget follows the engine's pace", () => {
  it("passes the budget to the decode call and shortens it after a fast decode", async () => {
    mockDecodeDecision.mockResolvedValue(GOOD);
    const { result } = renderHook(() => useDecisionDecode());

    await act(async () => {
      await result.current.handleDecode(LETTER);
    });
    expect(mockDecodeDecision).toHaveBeenLastCalledWith(LETTER, {
      timeout: 180_000,
    });

    await act(async () => {
      await result.current.handleDecode(LETTER);
    });
    expect(mockDecodeDecision).toHaveBeenLastCalledWith(LETTER, {
      timeout: 90_000,
    });
  });

  it("gives a retry more room after a timeout, and says how long it waited", async () => {
    mockDecodeDecision
      .mockResolvedValueOnce({
        success: false,
        error: "AI request timed out after 180 seconds.",
      })
      .mockResolvedValueOnce(GOOD);
    const { result } = renderHook(() => useDecisionDecode());

    await act(async () => {
      await result.current.handleDecode(LETTER);
    });
    expect(result.current.error).toMatch(/timed out after 180 seconds/i);

    await act(async () => {
      await result.current.handleDecode(LETTER);
    });
    expect(mockDecodeDecision).toHaveBeenLastCalledWith(LETTER, {
      timeout: 300_000,
    });
    expect(result.current.error).toBeNull();
  });

  it("does not learn a pace from an off-device fallback result", async () => {
    mockDecodeDecision.mockResolvedValue({ ...GOOD, usedFallback: true });
    const { result } = renderHook(() => useDecisionDecode());

    await act(async () => {
      await result.current.handleDecode(LETTER);
    });
    expect(timing.getDecodeTimeoutMs()).toBe(180_000);
  });

  it("reports elapsed time while a decode is running and clears it after", async () => {
    vi.useFakeTimers();
    let finish;
    mockDecodeDecision.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderHook(() => useDecisionDecode());

    let pending;
    act(() => {
      pending = result.current.handleDecode(LETTER);
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.budgetMs).toBe(180_000);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(41_000);
    });
    expect(result.current.elapsedMs).toBeGreaterThanOrEqual(40_000);

    await act(async () => {
      finish(GOOD);
      await pending;
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.elapsedMs).toBe(0);
  });
});

describe("DecodeProgressNotice", () => {
  it("shows elapsed seconds, then a plain still-working note with the total wait", () => {
    const { rerender } = render(
      <DecodeProgressNotice elapsedMs={5_000} budgetMs={180_000} />,
    );
    expect(screen.getByRole("status").textContent).toMatch(/Working\.\.\. 5 s/);
    expect(screen.getByRole("status").textContent).not.toMatch(/Still working/);

    rerender(<DecodeProgressNotice elapsedMs={95_000} budgetMs={180_000} />);
    const text = screen.getByRole("status").textContent;
    expect(text).toMatch(/Still working \(95 s\)/);
    expect(text).toMatch(/up to 180 seconds/);
  });
});
