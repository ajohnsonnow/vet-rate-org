import { describe, it, expect } from "vitest";
import { buildMetaRecord } from "../../../../scripts/eval/lib/goldenRecord.js";
import { parseArgs, USAGE } from "../../../../scripts/eval/lib/cliArgs.js";

describe("--frequency-penalty", () => {
  it("is not set by default, so production's per-model value applies", () => {
    expect(parseArgs(["--dry-run"]).frequencyPenalty).toBeNull();
  });

  it.each([
    ["0", 0],
    ["0.3", 0.3],
    ["2", 2],
  ])("accepts %s", (raw, value) => {
    expect(parseArgs(["--frequency-penalty", raw]).frequencyPenalty).toBe(
      value,
    );
  });

  it.each(["-0.1", "2.1", "abc", "", "NaN", "Infinity"])(
    "rejects %j with a message that names the range",
    (raw) => {
      expect(() => parseArgs(["--frequency-penalty", raw])).toThrow(
        /--frequency-penalty needs a number from 0 to 2/,
      );
    },
  );

  it("is documented in the usage text", () => {
    expect(USAGE).toMatch(/--frequency-penalty <n>/);
  });

  it("appears in the meta settings record as given", () => {
    const meta = buildMetaRecord({
      engine: "e",
      modelIdRequested: "M",
      modelIdLoaded: "M",
      device: {},
      settings: { temperature: 0, frequencyPenalty: 0.3 },
      personaFingerprints: {},
    });
    expect(meta.settings.frequencyPenalty).toBeCloseTo(0.3);
  });
});
