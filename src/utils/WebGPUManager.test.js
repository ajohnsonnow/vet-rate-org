import { describe, it, expect, vi, afterEach } from "vitest";
import { gpuManager } from "./WebGPUManager";

// Lock-in tests for the autoSelectBest / estimateVRAM cognitive-complexity
// extraction (_tryRestoreSavedAdapter / _selectBestAdapter /
// estimateVRAMFromMaxBuffer) — pure code motion, no behavior change intended.

afterEach(() => {
  vi.restoreAllMocks();
  gpuManager.device = null;
  gpuManager.adapters = new Map();
  localStorage.clear();
});

describe("WebGPUManager: estimateVRAM", () => {
  it("prefers WebGL-reported VRAM when present", () => {
    expect(gpuManager.estimateVRAM({ webglInfo: { vram: 12 } })).toBe("12 GB");
  });

  it("estimates from the adapter's own limits.maxBufferSize", () => {
    const result = gpuManager.estimateVRAM({
      adapter: { limits: { maxBufferSize: 8 * 1024 ** 3 } },
    });
    expect(result).toBe("~8+ GB");
  });

  it("falls back to info.limits.maxBufferSize when the adapter has no limits", () => {
    const result = gpuManager.estimateVRAM({
      adapter: {},
      info: { limits: { maxBufferSize: 4 * 1024 ** 3 } },
    });
    expect(result).toBe("~4+ GB");
  });

  it("returns Unknown when nothing usable is present", () => {
    expect(gpuManager.estimateVRAM(null)).toBe("Unknown");
    expect(gpuManager.estimateVRAM({ adapter: {} })).toBe("Unknown");
    expect(
      gpuManager.estimateVRAM({ adapter: { limits: { maxBufferSize: 0 } } }),
    ).toBe("Unknown");
  });
});

describe("WebGPUManager: autoSelectBest", () => {
  it("reuses an already-initialized device without scanning", async () => {
    gpuManager.device = { fake: "device" };
    const scanSpy = vi.spyOn(gpuManager, "scanForAdapters");
    const result = await gpuManager.autoSelectBest();
    expect(result).toBe(gpuManager.device);
    expect(scanSpy).not.toHaveBeenCalled();
  });

  it("restores a saved adapter selection when present", async () => {
    gpuManager.adapters = new Map([["gpu-1", { id: "gpu-1" }]]);
    localStorage.setItem("vet_rate_selected_gpu", "gpu-1");
    vi.spyOn(gpuManager, "selectAdapter").mockResolvedValue({
      fake: "device-1",
    });
    const result = await gpuManager.autoSelectBest();
    expect(result).toEqual({ fake: "device-1" });
  });

  it("rescans and auto-selects when the saved adapter was consumed", async () => {
    const highPerf = { id: "gpu-2", tier: "High Performance" };
    gpuManager.adapters = new Map([["gpu-1", { id: "gpu-1" }]]);
    localStorage.setItem("vet_rate_selected_gpu", "gpu-1");
    const scanSpy = vi
      .spyOn(gpuManager, "scanForAdapters")
      .mockResolvedValue([highPerf]);
    vi.spyOn(gpuManager, "selectAdapter").mockImplementation(async (id) => {
      if (id === "gpu-1") throw new Error("adapter was consumed");
      return { fake: `device-${id}` };
    });
    const result = await gpuManager.autoSelectBest();
    expect(scanSpy).toHaveBeenCalled();
    expect(result).toEqual({ fake: "device-gpu-2" });
  });

  it("auto-selects the High Performance adapter when nothing was saved", async () => {
    const lowPerf = { id: "gpu-low", tier: "Low Performance" };
    const highPerf = { id: "gpu-high", tier: "High Performance" };
    gpuManager.adapters = new Map([
      ["gpu-low", lowPerf],
      ["gpu-high", highPerf],
    ]);
    vi.spyOn(gpuManager, "selectAdapter").mockImplementation(async (id) => ({
      fake: `device-${id}`,
    }));
    const result = await gpuManager.autoSelectBest();
    expect(result).toEqual({ fake: "device-gpu-high" });
  });

  it("throws when no adapters are available at all", async () => {
    gpuManager.adapters = new Map();
    vi.spyOn(gpuManager, "scanForAdapters").mockResolvedValue([]);
    await expect(gpuManager.autoSelectBest()).rejects.toThrow(
      "No GPU adapters found",
    );
  });

  it("propagates a non-'consumed' selectAdapter failure", async () => {
    gpuManager.adapters = new Map([["gpu-1", { id: "gpu-1" }]]);
    localStorage.setItem("vet_rate_selected_gpu", "gpu-1");
    vi.spyOn(gpuManager, "selectAdapter").mockRejectedValue(
      new Error("permission denied"),
    );
    await expect(gpuManager.autoSelectBest()).rejects.toThrow(
      "permission denied",
    );
  });
});
