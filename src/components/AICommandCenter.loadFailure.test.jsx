import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const ai = vi.hoisted(() => ({ model: null, init: vi.fn() }));
vi.mock("../utils/unifiedAIService", () => ({
  getAIStatus: () => ({
    effectiveMode: ai.model ? "swarm" : "cloud",
    cloudAvailable: false,
    localAvailable: false,
    swarmAvailable: Boolean(ai.model),
    wllamaAvailable: false,
    localServerAvailable: false,
    swarmStatus: { model: ai.model },
    localModelName: "Local AI",
    isPrivate: true,
    anyAvailable: Boolean(ai.model),
  }),
  unloadLocalAI: vi.fn(),
  registerLocalAIEngine: vi.fn(),
  checkWebGPUSupport: async () => ({ supported: true }),
  AI_PRESETS: { BALANCED: { label: "Balanced", temperature: 0.7 } },
}));
vi.mock("../utils/diamondSwarm", () => ({
  initializeSwarm: ai.init,
  generateWithSwarm: vi.fn(),
  isSwarmReady: () => Boolean(ai.model),
  getSwarmStatus: () => ({ model: ai.model }),
}));
vi.mock("../utils/deviceLabels", async (importOriginal) => ({
  ...(await importOriginal()),
  useDeviceProfile: () => ({
    tier: "desktop-high",
    hasWebGPU: true,
    gpuTier: "high",
    isMobile: false,
    isTablet: false,
    recommendedModels: [
      "Qwen3.5-4B-q4f16_1-MLC",
      "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    ],
  }),
}));
vi.mock("./GPUSelector", () => ({ default: () => null }));
vi.mock("./AIModeSelector", () => ({ AIStatusBadge: () => null }));

import AICommandCenter from "./AICommandCenter";

const CACHE_ERROR =
  "UnknownError: Failed to execute 'open' on 'CacheStorage': Unexpected internal error.";

beforeEach(() => {
  ai.model = null;
  ai.init.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  Object.defineProperty(navigator, "gpu", {
    configurable: true,
    value: {
      requestAdapter: async () => ({ info: { vendor: "t", device: "GPU" } }),
    },
  });
});
afterEach(() => {
  delete navigator.gpu;
  vi.restoreAllMocks();
});

const renderAndLoad = async () => {
  render(<AICommandCenter onClose={() => {}} onReportBug={() => {}} />);
  fireEvent.click(
    await screen.findByRole("button", { name: /Download & Activate Local AI/ }),
  );
};

describe("loading from the Command Center when every model fails", () => {
  beforeEach(() => {
    ai.init.mockImplementation(async ({ onError }) => {
      onError?.(
        Object.assign(new Error("All WebLLM models failed to load."), {
          failures: ["a", "b", "c", "d"].map((modelId) => ({
            modelId,
            reason: CACHE_ERROR,
          })),
        }),
      );
      return false;
    });
  });

  it("shows a plain error and never says AI Active", async () => {
    await renderAndLoad();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/No on-device AI model could be loaded/);
    expect(alert.textContent).toMatch(/would not store the model files/);
    expect(alert.textContent).toMatch(/calculator/i);
    expect(screen.queryByText(/AI Active & Private/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Unload/ })).toBeNull();
    expect(screen.queryByText(/Test Your AI/i)).toBeNull();
  });

  it("offers a retry that tries again", async () => {
    await renderAndLoad();
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(ai.init).toHaveBeenCalledTimes(2));
  });
});

describe("loading from the Command Center when a model loads", () => {
  const FALLBACK = "Qwen2.5-3B-Instruct-q4f16_1-MLC";
  const FIRST = "Qwen3.5-4B-q4f16_1-MLC";

  it("the first fails and the fallback loads: Active, with the fallback notice", async () => {
    ai.init.mockImplementation(async () => {
      ai.model = FALLBACK;
      return true;
    });
    await renderAndLoad();
    await screen.findByText(/AI Active & Private/);
    expect(screen.getByText(/meant to load Qwen 3\.5 4B/)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("the first loads: Active, no notice, no error", async () => {
    ai.init.mockImplementation(async () => {
      ai.model = FIRST;
      return true;
    });
    await renderAndLoad();
    await screen.findByText(/AI Active & Private/);
    expect(screen.queryByText(/meant to load/)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a load that reports success but leaves no model answering is not Active", async () => {
    ai.init.mockResolvedValue(true);
    await renderAndLoad();
    await waitFor(() => expect(ai.init).toHaveBeenCalled());
    expect(screen.queryByText(/AI Active & Private/)).toBeNull();
  });
});
