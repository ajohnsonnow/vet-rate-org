import { describe, it, expect } from "vitest";
import { renderSummary } from "../../../../scripts/eval/lib/goldenReport.js";

describe("run summary header", () => {
  const header = (settings, cases = []) =>
    renderSummary({
      meta: { settings, device: {} },
      runInfo: {
        modelId: "M",
        date: "d",
        gitCommit: "c",
        transcriptFile: "t",
        legalIndexNote: "n",
      },
      goldenCases: [],
      cases,
      grades: [],
    });

  it("shows the temperature and an overridden frequency penalty", () => {
    const text = header({ temperature: 0.3, frequencyPenalty: 0.3 });
    expect(text).toMatch(/temperature 0\.3/);
    expect(text).toMatch(
      /frequency penalty 0\.3 \(set by --frequency-penalty\)/,
    );
  });

  it("says the per-model default applied when no override was given, and shows what was sent", () => {
    const text = header({ temperature: 0, frequencyPenalty: null }, [
      { id: "a01", frequencyPenalty: 0.3 },
      { id: "a02", frequencyPenalty: 0.3 },
    ]);
    expect(text).toMatch(/frequency penalty per-model default/);
    expect(text).toMatch(/sent 0\.3/);
  });
});
