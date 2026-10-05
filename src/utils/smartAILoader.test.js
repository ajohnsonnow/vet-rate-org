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

const { getRecommendedModelForDevice, smartLoadAI } =
  await import("./smartAILoader");

const DESKTOP = { recommendedModels: ["Qwen3.5-4B-q4f16_1-MLC"] };
const LAPTOP = { recommendedModels: ["Qwen3.5-2B-q4f16_1-MLC"] };

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
});
