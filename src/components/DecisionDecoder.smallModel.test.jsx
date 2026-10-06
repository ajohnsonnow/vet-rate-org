/**
 * ADR-010 section 9: while a small-class on-device model is the one that
 * would answer, the Decision Decoder does not send it the letter. It shows
 * the pattern-match reading and the review options, and says why.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, renderHook, act } from "@testing-library/react";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({
  default: "pdf.worker.min.mjs",
}));

const mockDecodeDecision = vi.fn();
vi.mock("../utils/aiStatementHelper", () => ({
  decodeDecision: (...args) => mockDecodeDecision(...args),
  isAIAvailable: () => true,
}));
const status = vi.hoisted(() => ({ value: null }));
vi.mock("../utils/unifiedAIService", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getAIStatus: () => status.value };
});

const { isSmallModel } = await import("../utils/deviceCapabilityDetector");
const { resetDecodeSpeed } = await import("../utils/decodeTiming");
const { ResultsContent, useDecisionDecode, SMALL_MODEL_FALLBACK_NOTE } =
  await import("./DecisionDecoder.jsx");

const SMALL = "Qwen3.5-2B-q4f16_1-MLC";
const LARGER = "Qwen3.5-4B-q4f16_1-MLC";
const swarm = (model) => ({
  anyAvailable: true,
  effectiveMode: "swarm",
  swarmAvailable: true,
  swarmStatus: { model },
});
const CLOUD = {
  anyAvailable: true,
  effectiveMode: "cloud",
  swarmAvailable: false,
  cloudAvailable: true,
  swarmStatus: { model: null },
};

const LETTER =
  "SYNTHETIC TEST DECISION LETTER. Service connection for left knee strain is denied. " +
  "The evidence does not establish a nexus between the current disability " +
  "and any in-service event.";
const NOT_A_LETTER =
  "The quick brown fox jumps over the lazy dog, again and again and again.";

const GOOD_RESPONSE = {
  success: true,
  data: { decision_type: "Full Denial", plain_english: "Denied." },
};

async function decode(text) {
  const { result } = renderHook(() => useDecisionDecode());
  await act(async () => {
    await result.current.handleDecode(text);
  });
  return result.current;
}

beforeEach(() => {
  mockDecodeDecision.mockReset();
  mockDecodeDecision.mockResolvedValue(GOOD_RESPONSE);
  resetDecodeSpeed();
});

describe("Decision Decoder with a small-class model loaded", () => {
  it("uses the table's own small class, not a model id", () => {
    expect(isSmallModel(SMALL)).toBe(true);
    expect(isSmallModel(LARGER)).toBe(false);
  });

  it("does not send the letter to the model and shows the pattern reading", async () => {
    status.value = swarm(SMALL);
    const { results, error } = await decode(LETTER);

    expect(mockDecodeDecision).not.toHaveBeenCalled();
    expect(error).toBeNull();
    expect(results._usedFallback).toBe(true);
    expect(results._fallbackReason).toBe("small_model");
    expect(results._fallbackNote).toBe(SMALL_MODEL_FALLBACK_NOTE);
    expect(results.plain_english).toBeTruthy();
  });

  it("says why in plain words", () => {
    expect(SMALL_MODEL_FALLBACK_NOTE).toBe(
      "This device's AI model is too small to read a decision letter reliably, so it was not used. Below is what the app can match by pattern in the text you gave, and the review options as the regulations state them.",
    );
  });

  it("still gives a result, with the reason, when no pattern matches", async () => {
    status.value = swarm(SMALL);
    const { results, error } = await decode(NOT_A_LETTER);

    expect(mockDecodeDecision).not.toHaveBeenCalled();
    expect(error).toBeNull();
    expect(results._fallbackReason).toBe("small_model");
    expect(results.plain_english).toMatch(/found no decision language/);
    expect(results.plain_english).not.toMatch(/load an on-device AI/);
  });

  it("shows the notice and the review options from the regulations", async () => {
    status.value = swarm(SMALL);
    const { results } = await decode(LETTER);
    render(<ResultsContent results={results} />);

    const notice = screen.getByRole("note", {
      name: "Pattern-match reading: this device's AI model was not used",
    });
    expect(notice.textContent).toContain(SMALL_MODEL_FALLBACK_NOTE);
    expect(
      screen.getAllByText(/38 CFR § 3\.2500\(a\)\(1\)/).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/VA Form 20-0995/)).toBeTruthy();
    expect(screen.queryByText(/No AI Loaded/)).toBeNull();
  });
});

describe("Decision Decoder with other AI", () => {
  it.each([
    ["the larger on-device model", swarm(LARGER)],
    ["cloud AI", CLOUD],
    [
      "a small model that is loaded but not the one answering",
      {
        ...CLOUD,
        swarmStatus: { model: SMALL },
      },
    ],
  ])("is unchanged with %s: the model is asked", async (_label, aiStatus) => {
    status.value = aiStatus;
    const { results } = await decode(LETTER);

    expect(mockDecodeDecision).toHaveBeenCalledTimes(1);
    expect(results._fallbackReason).toBeUndefined();
    expect(results.plain_english).toBe("Denied.");
  });
});
