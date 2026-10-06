import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  cachedProfile: vi.fn(),
  initializeSwarm: vi.fn(),
  getAIStatus: vi.fn(),
}));

vi.mock("./deviceCapabilityDetector", async (importOriginal) => ({
  ...(await importOriginal()),
  getCachedDeviceProfile: mocks.cachedProfile,
}));
vi.mock("./persistentStorage", () => ({
  isMobilePhone: () => false,
  isTabletDevice: () => false,
}));
vi.mock("./unifiedAIService", () => ({
  getAIStatus: mocks.getAIStatus,
  registerLocalAIEngine: vi.fn(),
}));
vi.mock("./diamondSwarm", () => ({
  initializeSwarm: mocks.initializeSwarm,
  unloadSwarm: vi.fn(),
  generateWithSwarm: vi.fn(),
  isSwarmReady: () => true,
  getSwarmStatus: () => ({}),
}));

const { checkModelMatch, getRecommendedModelForDevice, smartLoadAI } =
  await import("./smartAILoader");
const { TABLET_UNTESTED_SENTENCE } = await import("./deviceLabels");

const DESKTOP = {
  hasWebGPU: true,
  recommendedModels: ["Qwen3.5-4B-q4f16_1-MLC"],
};
const LAPTOP = {
  hasWebGPU: true,
  recommendedModels: ["Qwen3.5-2B-q4f16_1-MLC"],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cachedProfile.mockReturnValue(DESKTOP);
  mocks.getAIStatus.mockReturnValue({});
  mocks.initializeSwarm.mockResolvedValue(true);
});

describe("smartAILoader takes its model from the device profile", () => {
  it.each([
    ["a tool with a recommendation", "dd214-analyzer"],
    ["an unknown tool", "no-such-tool"],
  ])("names the device's first model and size for %s", (_label, toolId) => {
    const rec = getRecommendedModelForDevice(toolId);
    expect(rec.id).toMatch(/^diamond-/);
    expect(rec.deviceModel.modelId).toBe("Qwen3.5-4B-q4f16_1-MLC");
    expect(rec.reason).toContain("Qwen 3.5 4B (about 2.4 GB)");
  });

  it("follows the tier: a laptop profile names the 2B", () => {
    mocks.cachedProfile.mockReturnValue(LAPTOP);
    const rec = getRecommendedModelForDevice("no-such-tool");
    expect(rec.reason).toContain("Qwen 3.5 2B (about 1.1 GB)");
  });

  it("hard-codes no model of its own for an unknown tool", () => {
    const rec = getRecommendedModelForDevice("no-such-tool");
    expect(`${rec.id} ${rec.name} ${rec.reason}`).not.toMatch(
      /Qwen2\.5|3B\)|f32/,
    );
  });

  it("still works before the device has been probed", () => {
    mocks.cachedProfile.mockReturnValue(null);
    const rec = getRecommendedModelForDevice("no-such-tool");
    expect(rec.deviceModel).toBeNull();
    expect(rec.reason).not.toMatch(/\d GB/);
  });

  it("loads through initializeSwarm with a role id, so the swarm picks the model from the same tier list", async () => {
    await expect(smartLoadAI("no-such-tool")).resolves.toBe(true);
    const { modelId } = mocks.initializeSwarm.mock.calls[0][0];
    expect(modelId).toMatch(/^diamond-/);
  });

  it("says nothing of a model on a tablet whose browser has no WebGPU", () => {
    mocks.cachedProfile.mockReturnValue({
      hasWebGPU: false,
      recommendedModels: ["Qwen2.5-1.5B-Instruct-q4f16_1-MLC"],
    });
    const rec = getRecommendedModelForDevice("no-such-tool");
    expect(rec.deviceModel).toBeNull();
    expect(rec.reason).not.toMatch(/Qwen|\d GB/);
  });

  it("adds the untested-on-tablets sentence for a tablet with WebGPU, from the shared source", () => {
    mocks.cachedProfile.mockReturnValue({
      hasWebGPU: true,
      isTablet: true,
      recommendedModels: ["Qwen2.5-1.5B-Instruct-q4f16_1-MLC"],
    });
    const rec = getRecommendedModelForDevice("no-such-tool");
    expect(rec.reason).toContain(TABLET_UNTESTED_SENTENCE);
  });

  it("does not add it on a desktop", () => {
    const rec = getRecommendedModelForDevice("no-such-tool");
    expect(rec.reason).not.toMatch(/tablet/i);
  });
});

// getAIStatus has no isLocal or modelId field. checkModelMatch read both, so
// it answered "load" whatever was loaded and the button never showed ready.
describe("checkModelMatch reads the fields getAIStatus has", () => {
  const swarm = (model) => ({
    effectiveMode: "swarm",
    swarmAvailable: true,
    swarmStatus: { model },
  });

  it("says ready when the swarm holds the model this device should run", () => {
    mocks.getAIStatus.mockReturnValue(swarm("Qwen3.5-4B-q4f16_1-MLC"));
    expect(checkModelMatch("no-such-tool")).toMatchObject({
      isCorrect: true,
      action: "none",
      currentModel: "Qwen3.5-4B-q4f16_1-MLC",
    });
  });

  it("asks to switch when the swarm holds a different model", () => {
    mocks.getAIStatus.mockReturnValue(swarm("Qwen3.5-2B-q4f16_1-MLC"));
    expect(checkModelMatch("no-such-tool")).toMatchObject({
      isCorrect: false,
      action: "switch",
      currentModel: "Qwen3.5-2B-q4f16_1-MLC",
    });
  });

  it.each([
    ["nothing is loaded", {}],
    ["the swarm is not ready", { swarmAvailable: false, swarmStatus: {} }],
    [
      "only the cloud is available",
      { effectiveMode: "cloud", cloudAvailable: true, swarmAvailable: false },
    ],
  ])("asks to load when %s", (_name, status) => {
    mocks.getAIStatus.mockReturnValue(status);
    expect(checkModelMatch("no-such-tool")).toMatchObject({
      isCorrect: false,
      action: "load",
      currentModel: null,
    });
  });

  it("says ready, and does not guess a switch, when it cannot compare models", () => {
    mocks.getAIStatus.mockReturnValue(swarm(null));
    expect(checkModelMatch("no-such-tool").isCorrect).toBe(true);
    mocks.cachedProfile.mockReturnValue(null);
    mocks.getAIStatus.mockReturnValue(swarm("Qwen3.5-4B-q4f16_1-MLC"));
    expect(checkModelMatch("no-such-tool").isCorrect).toBe(true);
  });

  it("does not reload a model that is already the right one", async () => {
    mocks.getAIStatus.mockReturnValue(swarm("Qwen3.5-4B-q4f16_1-MLC"));
    await expect(smartLoadAI("no-such-tool")).resolves.toBe(true);
    expect(mocks.initializeSwarm).not.toHaveBeenCalled();
  });
});
