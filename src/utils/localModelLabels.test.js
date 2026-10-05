import { describe, it, expect } from "vitest";
import { describeDeviceModel } from "./deviceCapabilityDetector";
import {
  buildPanelRoleModels,
  buildCommandCenterModels,
  getLocalModelLabels,
  getDeviceModelSummary,
} from "./localModelLabels";
import { roleFromModelId } from "./diamondSwarm";

const DESKTOP_HIGH = {
  recommendedModels: [
    "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    "Qwen2.5-3B-Instruct-q4f32_1-MLC",
  ],
};
const LAPTOP = { recommendedModels: ["Qwen2.5-1.5B-Instruct-q4f16_1-MLC"] };
const MOBILE = { recommendedModels: [] };
const DESKTOP_QWEN35 = {
  recommendedModels: [
    "Qwen3.5-4B-q4f16_1-MLC",
    "Qwen2.5-3B-Instruct-q4f16_1-MLC",
  ],
};
const LAPTOP_QWEN35 = { recommendedModels: ["Qwen3.5-2B-q4f16_1-MLC"] };

const FALSE_CLAIMS = /fine-tun|trained|7B|1\.7B|4\.0 GB|GGUF/i;
const visibleText = (entry) =>
  [
    entry.name,
    entry.description,
    entry.bestFor,
    entry.contextInfo,
    entry.size,
    entry.vramRequired,
    entry.baseModel,
    entry.trainingFocus,
  ]
    .filter(Boolean)
    .join(" ");

describe("describeDeviceModel", () => {
  it("reports the first model of the device profile with its footprint", () => {
    expect(describeDeviceModel(DESKTOP_HIGH)).toEqual({
      modelId: "Qwen2.5-3B-Instruct-q4f16_1-MLC",
      displayName: "Qwen 2.5 3B",
      downloadGB: 1.8,
      vramGB: 2.5,
    });
    expect(describeDeviceModel(LAPTOP)).toMatchObject({
      displayName: "Qwen 2.5 1.5B",
      downloadGB: 0.9,
    });
  });

  it("returns null when the profile is missing or the tier has no on-device model", () => {
    expect(describeDeviceModel(null)).toBeNull();
    expect(describeDeviceModel(MOBILE)).toBeNull();
  });

  it("keeps an unrecognised model id visible instead of guessing sizes", () => {
    expect(
      describeDeviceModel({ recommendedModels: ["Some-New-Model-MLC"] }),
    ).toEqual({
      modelId: "Some-New-Model-MLC",
      displayName: "Some-New-Model-MLC",
      downloadGB: null,
      vramGB: null,
    });
  });
});

describe("getLocalModelLabels / getDeviceModelSummary", () => {
  it("derives size and model name from the device model", () => {
    const labels = getLocalModelLabels(describeDeviceModel(DESKTOP_HIGH));
    expect(labels).toMatchObject({
      size: "~1.8 GB",
      vramRequired: "~2.5 GB",
      baseModel: "Qwen 2.5 3B",
    });
  });

  it("states the published download size and the memory separately for the Qwen3.5 models", () => {
    const labels = getLocalModelLabels(describeDeviceModel(DESKTOP_QWEN35));
    expect(labels).toMatchObject({
      size: "~2.4 GB",
      vramRequired: "~3.9 GB",
      baseModel: "Qwen 3.5 4B",
    });
    expect(getLocalModelLabels(describeDeviceModel(LAPTOP_QWEN35)).size).toBe(
      "~1.1 GB",
    );
    expect(
      getLocalModelLabels(describeDeviceModel(LAPTOP_QWEN35)).vramRequired,
    ).toBe("~2.2 GB");
  });

  it("says the size varies for a model it has no published size for", () => {
    const unknown = describeDeviceModel({
      recommendedModels: ["Some-New-Model-MLC"],
    });
    expect(getLocalModelLabels(unknown).size).toBe("varies");
    expect(getDeviceModelSummary(unknown)).toMatch(/download size varies/);
  });

  it("falls back to a range before the device is probed", () => {
    const labels = getLocalModelLabels(null);
    expect(labels.size).toBe("varies");
    expect(labels.vramRequired).toBe("varies");
    expect(labels.baseModel).toBe("Chosen for your device");
  });

  it("names the model the device will load", () => {
    expect(getDeviceModelSummary(describeDeviceModel(LAPTOP))).toContain(
      "Qwen 2.5 1.5B (about 0.9 GB)",
    );
    expect(getDeviceModelSummary(null)).toContain("picked for your device");
    expect(getDeviceModelSummary(null)).not.toMatch(/\d GB/);
  });

  it("states the size, and that it is a one-time download kept on the device", () => {
    const summary = getDeviceModelSummary(describeDeviceModel(DESKTOP_QWEN35));
    expect(summary).toContain("Qwen 3.5 4B (about 2.4 GB)");
    expect(summary).toMatch(/one-time download/);
    expect(summary).toMatch(/kept on your device/);
  });
});

describe("buildPanelRoleModels", () => {
  it("keeps the persisted diamond-* ids and the three roles", () => {
    expect(buildPanelRoleModels(null).map((m) => m.id)).toEqual([
      "diamond-auditor",
      "diamond-writer",
      "diamond-rater",
    ]);
  });

  it("shows the model and size the device profile will actually load", () => {
    const models = buildPanelRoleModels(describeDeviceModel(DESKTOP_HIGH));
    for (const model of models) {
      expect(model.size).toBe("~1.8 GB");
      expect(model.vramRequired).toBe("~2.5 GB");
      expect(model.baseModel).toBe("Qwen 2.5 3B");
    }
  });

  it.each([null, describeDeviceModel(DESKTOP_HIGH)])(
    "makes no fine-tuning or 7B claims (%#)",
    (deviceModel) => {
      for (const model of buildPanelRoleModels(deviceModel)) {
        expect(visibleText(model)).not.toMatch(FALSE_CLAIMS);
        expect(model.baseModelInfo).toMatch(/not custom-trained/);
        expect(model.baseModelInfo).not.toMatch(/fine-tun/i);
      }
    },
  );
});

describe("buildCommandCenterModels", () => {
  it("lists one entry per role and drops the duplicate mobile entries", () => {
    const ids = buildCommandCenterModels(null).map((m) => m.id);
    expect(ids).toEqual([
      "vetrate-auditor-7b-v2",
      "vetrate-writer-7b-v2",
      "vetrate-rater-7b-v2",
    ]);
  });

  it("uses the device model's sizes", () => {
    for (const model of buildCommandCenterModels(describeDeviceModel(LAPTOP))) {
      expect(model.size).toBe("~0.9 GB");
      expect(model.vramRequired).toBe("~1.6 GB");
    }
  });

  it("makes no fine-tuning, JAG-trained or 7B claims", () => {
    for (const model of buildCommandCenterModels(null)) {
      expect(visibleText(model)).not.toMatch(FALSE_CLAIMS);
    }
  });
});

describe("every picker id, including retired ones, still resolves to a role", () => {
  it.each([
    ["vetrate-auditor-7b-v2", "auditor"],
    ["vetrate-writer-7b-v2", "writer"],
    ["vetrate-rater-7b-v2", "rater"],
    ["vetrate-auditor-1.7b-mobile-v1", "auditor"],
    ["vetrate-writer-1.7b-mobile-v1", "writer"],
    ["vetrate-rater-1.7b-mobile-v1", "rater"],
    ["diamond-auditor", "auditor"],
    ["diamond-writer", "writer"],
    ["diamond-rater", "rater"],
  ])("%s -> %s", (modelId, role) => {
    expect(roleFromModelId(modelId)).toBe(role);
  });
});
