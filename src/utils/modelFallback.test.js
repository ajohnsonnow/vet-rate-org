import { describe, it, expect } from "vitest";
import { describeModelFallback } from "./modelFallback";

const profile = (list) => ({ recommendedModels: list });
const status = (model, extra = {}) => ({
  effectiveMode: "swarm",
  swarmAvailable: true,
  swarmStatus: { model },
  ...extra,
});
const DESKTOP = ["Qwen3.5-4B-q4f16_1-MLC", "Qwen2.5-3B-Instruct-q4f16_1-MLC"];

describe("describeModelFallback", () => {
  it("is null when the first choice is the loaded model", () => {
    expect(
      describeModelFallback(status(DESKTOP[0]), profile(DESKTOP)),
    ).toBeNull();
  });

  it("is null when nothing is loaded, cloud is answering, or the device is unprobed", () => {
    expect(describeModelFallback(status(null), profile(DESKTOP))).toBeNull();
    expect(
      describeModelFallback(
        status(DESKTOP[1], { swarmAvailable: false }),
        profile(DESKTOP),
      ),
    ).toBeNull();
    expect(describeModelFallback(status(DESKTOP[1]), null)).toBeNull();
    expect(describeModelFallback(status(DESKTOP[1]), profile([]))).toBeNull();
  });

  it("names the intended model, the loaded model, and says the loaded one is older with weaker answers", () => {
    const out = describeModelFallback(status(DESKTOP[1]), profile(DESKTOP));
    expect(out.text).toContain("Qwen 3.5 4B");
    expect(out.text).toMatch(/could not be loaded/);
    expect(out.text).toContain("Qwen 2.5 3B is loaded instead");
    expect(out.text).toMatch(/older model/);
    expect(out.text).toMatch(/weaker in our tests/);
  });

  it("does not claim weaker answers for a fallback that was never graded", () => {
    const out = describeModelFallback(
      status("Llama-3.2-3B-Instruct-q4f32_1-MLC"),
      profile([...DESKTOP, "Llama-3.2-3B-Instruct-q4f32_1-MLC"]),
    );
    expect(out.text).toContain("Llama 3.2 3B is loaded instead");
    expect(out.text).toMatch(/older model/);
    expect(out.text).not.toMatch(/weaker in our tests/);
    expect(out.text).toMatch(/not been tested/);
  });
});
