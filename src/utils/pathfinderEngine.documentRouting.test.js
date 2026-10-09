/**
 * ADR-009 / spec item 5: pathfinderEngine.analyzeStrategy was hard-classed
 * "document" unconditionally, so a cloud-only veteran who never uploaded
 * anything - just typed ratings and notes - got a dead-end
 * DocumentOffDeviceBlockedError with no result, where before ADR-009 they
 * got a real answer. additionalContextIsDocument lets the caller
 * (Pathfinder.jsx) say whether the current additionalContext text actually
 * came from an uploaded document, so the common no-document case is
 * classed "context" (never blocked) while a genuine document upload stays
 * "document" (on-device only, fail-closed default when the caller omits
 * the option entirely).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("./unifiedAIService", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateAI: vi.fn(),
    isAnyAIAvailable: vi.fn(() => true),
    getAIStatus: vi.fn(() => ({ effectiveMode: "cloud" })),
  };
});

const unifiedAIService = await import("./unifiedAIService.js");
const { analyzeStrategy } = await import("./pathfinderEngine.js");
const { AI_DATA_CLASS, DocumentOffDeviceBlockedError } =
  await import("./aiDataClassPolicy.js");

const RATINGS = [{ condition: "Tinnitus", rating: "10" }];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("analyzeStrategy: dataClass follows additionalContextIsDocument", () => {
  it("no document involved (additionalContextIsDocument: false): declares CONTEXT and succeeds for a cloud-only veteran", async () => {
    unifiedAIService.generateAI.mockResolvedValue({
      text: JSON.stringify({ opportunities: [] }),
    });

    const result = await analyzeStrategy(
      "fake-key",
      RATINGS,
      "typed symptom notes",
      { additionalContextIsDocument: false },
    );

    expect(result.success).toBe(true);
    expect(unifiedAIService.generateAI.mock.calls[0][1].dataClass).toBe(
      AI_DATA_CLASS.CONTEXT,
    );
  });

  it("additionalContext came from an uploaded document: declares DOCUMENT, and a cloud-only/off-device-only setup throws the typed error instead of silently leaking", async () => {
    unifiedAIService.generateAI.mockImplementation(async (_prompt, options) => {
      if (options.dataClass === AI_DATA_CLASS.DOCUMENT) {
        throw new DocumentOffDeviceBlockedError("Cloud AI (Gemini)");
      }
      return { text: JSON.stringify({ opportunities: [] }) };
    });

    await expect(
      analyzeStrategy("fake-key", RATINGS, "OCR'd document text", {
        additionalContextIsDocument: true,
      }),
    ).rejects.toThrow(DocumentOffDeviceBlockedError);

    expect(unifiedAIService.generateAI.mock.calls[0][1].dataClass).toBe(
      AI_DATA_CLASS.DOCUMENT,
    );
  });

  it("caller omits the option entirely: fails closed to DOCUMENT (safe default for any other caller)", async () => {
    unifiedAIService.generateAI.mockResolvedValue({
      text: JSON.stringify({ opportunities: [] }),
    });

    await analyzeStrategy("fake-key", RATINGS, "some context");

    expect(unifiedAIService.generateAI.mock.calls[0][1].dataClass).toBe(
      AI_DATA_CLASS.DOCUMENT,
    );
  });
});
