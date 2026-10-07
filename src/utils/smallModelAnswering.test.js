import { describe, it, expect } from "vitest";
import { smallModelAnswering } from "./smallModelAnswering";

const swarm = (model, extra = {}) => ({
  effectiveMode: "swarm",
  swarmAvailable: true,
  swarmStatus: { model },
  ...extra,
});

describe("smallModelAnswering keys off the model actually loaded", () => {
  it("is true when a fallback to a weak model loaded instead of the first choice", () => {
    expect(smallModelAnswering(swarm("Qwen2.5-3B-Instruct-q4f16_1-MLC"))).toBe(
      true,
    );
    expect(smallModelAnswering(swarm("Qwen2.5-3B-Instruct-q4f32_1-MLC"))).toBe(
      true,
    );
  });

  it("is true for a fallback to a small-class model", () => {
    expect(
      smallModelAnswering(swarm("Qwen2.5-1.5B-Instruct-q4f16_1-MLC")),
    ).toBe(true);
  });

  it("is false when the first-choice 4B is the one loaded", () => {
    expect(smallModelAnswering(swarm("Qwen3.5-4B-q4f16_1-MLC"))).toBe(false);
  });

  it("is false with cloud answering, nothing loaded, or no status", () => {
    expect(
      smallModelAnswering(
        swarm("Qwen2.5-3B-Instruct-q4f16_1-MLC", { effectiveMode: "cloud" }),
      ),
    ).toBe(false);
    expect(smallModelAnswering(swarm(null))).toBe(false);
    expect(smallModelAnswering(undefined)).toBe(false);
  });
});
