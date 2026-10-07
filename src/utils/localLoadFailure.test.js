import { describe, it, expect } from "vitest";
import { describeLoadFailure } from "./localLoadFailure";

const CACHE =
  "UnknownError: Failed to execute 'open' on 'CacheStorage': Unexpected internal error.";

describe("describeLoadFailure", () => {
  it("says no on-device model could be loaded, and what still works without AI", () => {
    const out = describeLoadFailure([{ modelId: "a", reason: "device lost" }]);
    expect(out.title).toBe("No on-device AI model could be loaded.");
    expect(out.stillWorks).toMatch(/calculator/i);
    expect(out.stillWorks).toMatch(/form tools/i);
    expect(out.stillWorks).toMatch(/Decision Decoder/);
  });

  it("explains a storage error in plain words", () => {
    const out = describeLoadFailure([
      { modelId: "a", reason: CACHE },
      { modelId: "b", reason: CACHE },
    ]);
    expect(out.storage).toBe(true);
    expect(out.reason).toBe(
      "Your browser would not store the model files. This can happen in private windows, or when storage is full or blocked.",
    );
  });

  it.each([
    ["a quota error", "QuotaExceededError: The quota has been exceeded."],
    ["a cache write error", "Cache.add() encountered a network error"],
  ])("treats %s as a storage error", (_n, reason) => {
    expect(describeLoadFailure([{ modelId: "a", reason }]).storage).toBe(true);
  });

  it("gives a general reason for anything else, without the raw message", () => {
    const out = describeLoadFailure([
      { modelId: "a", reason: "GPUPipelineError: out of memory at 0x7f3" },
    ]);
    expect(out.storage).toBe(false);
    expect(out.reason).not.toMatch(/0x7f3|GPUPipelineError/);
    expect(out.reason).toMatch(/could not be loaded/);
  });

  it("copes with no failure detail", () => {
    expect(describeLoadFailure(undefined).title).toMatch(
      /No on-device AI model/,
    );
    expect(describeLoadFailure([]).storage).toBe(false);
  });
});
