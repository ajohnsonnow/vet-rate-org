import { describe, it, expect } from "vitest";
import { parseArgs } from "../../../../scripts/eval/lib/cliArgs.js";
import { renderSummary } from "../../../../scripts/eval/lib/goldenReport.js";

describe("--thinking option", () => {
  it("defaults to off and accepts on and off", () => {
    expect(parseArgs([]).thinking).toBe(false);
    expect(parseArgs(["--thinking", "on"]).thinking).toBe(true);
    expect(parseArgs(["--thinking", "off"]).thinking).toBe(false);
  });

  it("rejects anything else", () => {
    expect(() => parseArgs(["--thinking", "maybe"])).toThrow(/on or off/);
    expect(() => parseArgs(["--thinking"])).toThrow(/needs a value/);
  });

  it("is shown in the run summary's settings line", () => {
    const render = (settings) =>
      renderSummary({
        meta: { settings, modelIdLoaded: "m", device: null },
        runInfo: {
          modelId: "m",
          date: "d",
          gitCommit: "c",
          gitDirty: false,
          legalIndexNote: "n",
          transcriptFile: "t",
        },
        goldenCases: [],
        cases: [],
        grades: [],
      });
    expect(render({ thinking: true })).toContain("thinking on");
    expect(render({ thinking: false })).toContain("thinking off");
    expect(render({})).toContain("thinking ?");
  });
});
