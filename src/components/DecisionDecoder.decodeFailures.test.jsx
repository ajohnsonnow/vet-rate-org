/**
 * D20-10 / D20-8: a decode that fails (a timeout, an unreadable AI reply) must
 * end in a plain message with a retry - never a blank results pane - and a
 * document the built-in reader can read nothing from must say so plainly.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  renderHook,
  act,
  fireEvent,
} from "@testing-library/react";

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
  return {
    ...actual,
    getAIStatus: () => ({ anyAvailable: true }),
  };
});

const {
  default: DecisionDecoder,
  useDecisionDecode,
  applyOffDeviceFallback,
  EMPTY_RESULT_MESSAGE,
  NOTHING_FOUND_MESSAGE,
} = await import("./DecisionDecoder.jsx");

const LETTER =
  "SYNTHETIC TEST DENIAL LETTER. Service connection for tinnitus is denied. " +
  "The evidence does not establish a nexus between the current disability " +
  "and any in-service event.";

const GOOD_RESPONSE = {
  success: true,
  data: {
    decision_type: "Full Denial",
    plain_english: "Your tinnitus claim was denied.",
  },
};

beforeEach(() => {
  mockDecodeDecision.mockReset();
});

describe("useDecisionDecode: a failure is never a blank result", () => {
  it("shows a plain timeout message when the AI request times out", async () => {
    mockDecodeDecision.mockRejectedValue(
      new Error("AI request timed out after 90 seconds. Please try again."),
    );
    const { result } = renderHook(() => useDecisionDecode());

    await act(async () => {
      await result.current.handleDecode(LETTER);
    });

    expect(result.current.results).toBeNull();
    expect(result.current.error).toMatch(/timed out after 90 seconds/i);
    expect(result.current.error).not.toMatch(/An error occurred during/i);
  });

  it.each([
    ["an empty object", {}],
    ["an empty array", []],
    [
      "an object with only empty fields",
      { plain_english: "", action_plan: [] },
    ],
  ])("reports %s as an error, not an empty result", async (_label, data) => {
    mockDecodeDecision.mockResolvedValue({ success: true, data });
    const { result } = renderHook(() => useDecisionDecode());

    await act(async () => {
      await result.current.handleDecode(LETTER);
    });

    expect(result.current.results).toBeNull();
    expect(result.current.error).toBe(EMPTY_RESULT_MESSAGE);
  });

  it("accepts a result that carries at least one readable field", async () => {
    mockDecodeDecision.mockResolvedValue(GOOD_RESPONSE);
    const { result } = renderHook(() => useDecisionDecode());

    await act(async () => {
      await result.current.handleDecode(LETTER);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.results.decision_type).toBe("Full Denial");
  });
});

describe("DecisionDecoder: error banner offers a retry", () => {
  it("shows an alert with Try again, and Try again decodes successfully", async () => {
    mockDecodeDecision
      .mockRejectedValueOnce(
        new Error("AI request timed out after 90 seconds."),
      )
      .mockResolvedValueOnce(GOOD_RESPONSE);
    render(<DecisionDecoder onClose={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /Paste Text/i }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: LETTER },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Decode This Decision/i }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/timed out after 90 seconds/i);

    fireEvent.click(screen.getByRole("button", { name: /Try again/i }));

    expect(
      await screen.findByText(/Your tinnitus claim was denied/i),
    ).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(mockDecodeDecision).toHaveBeenCalledTimes(2);
  });
});

describe("applyOffDeviceFallback: says plainly when nothing was found", () => {
  const NO_DECISION_TEXT =
    "This page lists the hours of a community center, the parking rules, and " +
    "the dates of the monthly potluck, with nothing about any claim at all.";

  it("sets the plain nothing-found message when no decision language exists", () => {
    const setResults = vi.fn();
    applyOffDeviceFallback(NO_DECISION_TEXT, "Cloud AI (Gemini)", setResults);

    const shown = setResults.mock.calls[0][0];
    expect(shown.plain_english).toBe(NOTHING_FOUND_MESSAGE);
    expect(shown._fallbackReason).toBe("off_device_blocked");
  });

  it("does not claim nothing was found when a real denial is present", () => {
    const setResults = vi.fn();
    applyOffDeviceFallback(LETTER, "Cloud AI (Gemini)", setResults);

    const shown = setResults.mock.calls[0][0];
    expect(shown.plain_english).not.toBe(NOTHING_FOUND_MESSAGE);
    expect(shown.decision_type).toBeTruthy();
  });
});
