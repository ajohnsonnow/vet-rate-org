import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const ai = vi.hoisted(() => ({ model: null }));
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
  AI_PRESETS: {
    BALANCED: { label: "Balanced", temperature: 0.7 },
  },
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

const FIRST = "Qwen3.5-4B-q4f16_1-MLC";
const FALLBACK = "Qwen2.5-3B-Instruct-q4f16_1-MLC";
const NOTICE = /meant to load Qwen 3\.5 4B/;

beforeEach(() => {
  ai.model = null;
  Object.defineProperty(navigator, "gpu", {
    configurable: true,
    value: {
      requestAdapter: async () => ({
        info: { vendor: "test", device: "Test GPU" },
      }),
    },
  });
});

afterEach(() => {
  delete navigator.gpu;
});

describe("the fallback-model notice in the Command Center", () => {
  it("shows beside the loaded model on the Setup tab when a fallback is loaded", async () => {
    ai.model = FALLBACK;
    render(<AICommandCenter onClose={() => {}} onReportBug={() => {}} />);
    await screen.findByText(/AI Active & Private/);
    expect(screen.getByText(NOTICE)).toBeTruthy();
    expect(screen.getByText(/Qwen 2\.5 3B is loaded instead/)).toBeTruthy();
  });

  it("shows on the Advanced tab beside Current Model", async () => {
    ai.model = FALLBACK;
    render(<AICommandCenter onClose={() => {}} onReportBug={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Advanced/ }));
    await screen.findByText(/Current Model/);
    expect(screen.getByText(NOTICE)).toBeTruthy();
  });

  it("shows nothing when the first-choice model is loaded", async () => {
    ai.model = FIRST;
    render(<AICommandCenter onClose={() => {}} onReportBug={() => {}} />);
    await screen.findByText(/AI Active & Private/);
    expect(screen.queryByText(NOTICE)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Advanced/ }));
    await screen.findByText(/Current Model/);
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  it("is not in the not-ready model picker, where no model is loaded", async () => {
    render(<AICommandCenter onClose={() => {}} onReportBug={() => {}} />);
    await screen.findByText(/Select AI Role/);
    expect(screen.queryByText(NOTICE)).toBeNull();
    expect(screen.queryByText(/AI Active & Private/)).toBeNull();
  });
});
