/**
 * The Local AI panel's role list must show the model and download size the
 * device profile will actually load, not a hard-coded fine-tuned 7B claim.
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("@mlc-ai/web-llm", () => ({
  CreateMLCEngine: vi.fn(),
  CreateWebWorkerMLCEngine: vi.fn(),
  WebWorkerMLCEngineHandler: class {},
  ModelType: {},
  hasModelInCache: vi.fn().mockResolvedValue(false),
  prebuiltAppConfig: { model_list: [] },
}));

vi.mock("../utils/deviceCapabilityDetector", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getCachedDeviceProfile: vi.fn(() => null),
    detectDeviceCapabilities: vi.fn().mockResolvedValue({
      tier: "laptop",
      recommendedModels: ["Qwen2.5-1.5B-Instruct-q4f16_1-MLC"],
    }),
  };
});

const { useLocalAIProviderState } = await import("./useLocalAIProviderState");

describe("useLocalAIProviderState availableModels", () => {
  it("keeps the diamond-* ids and picks up the device model once probed", async () => {
    const { result } = renderHook(() => useLocalAIProviderState());

    expect(result.current.availableModels.map((m) => m.id)).toEqual([
      "diamond-auditor",
      "diamond-writer",
      "diamond-rater",
    ]);

    await waitFor(() =>
      expect(result.current.availableModels[0].baseModel).toBe("Qwen 2.5 1.5B"),
    );
    for (const model of result.current.availableModels) {
      expect(model.size).toBe("~1 GB");
      expect(model.baseModelInfo).not.toMatch(/fine-tuned from/i);
    }
  });
});
