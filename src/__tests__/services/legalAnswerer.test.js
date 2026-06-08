import { describe, it, expect, vi } from "vitest";
import { answer } from "../../services/legalAnswerer.js";

const fixtureChunks = [
  {
    id: "ecfr/4.71a/0",
    source: "ecfr",
    citation: "38 CFR § 4.71a",
    title: "Schedule of ratings—musculoskeletal",
    text: "Limitation of flexion of the leg to 30 degrees warrants a 20 percent evaluation.",
    source_url: "https://www.ecfr.gov/section-4.71a",
    fetched_at: "2026-05-15T00:00:00Z",
    score: 0.82,
  },
];

function fakeRetrieve(chunks) {
  return async () => ({ chunks });
}

describe("legalAnswerer — refusal paths", () => {
  it("refuses when retrieval returns zero chunks", async () => {
    const generateAI = vi.fn();
    const r = await answer("any question", {
      generateAI,
      retrieve: fakeRetrieve([]),
    });
    expect(r.refusal).toBe(true);
    expect(r.retrieved).toBe(0);
    expect(r.citations).toEqual([]);
    expect(r.answer).toMatch(/don't have a current citation/i);
    expect(generateAI).not.toHaveBeenCalled();
  });

  it("refuses when no fact is applicable", async () => {
    const generateAI = vi
      .fn()
      // extractor call returns one fact, applicable=false
      .mockResolvedValueOnce(
        JSON.stringify({
          applicable: false,
          rule_summary: "n/a",
          supporting_quote: "n/a",
        }),
      );

    const r = await answer("unrelated question", {
      generateAI,
      retrieve: fakeRetrieve(fixtureChunks),
    });
    expect(r.refusal).toBe(true);
    expect(r.injectionAttempt).toBe(false);
    expect(generateAI).toHaveBeenCalledTimes(1); // extractor only, no synth
  });

  it("refuses when the extractor reports an injection attempt", async () => {
    const generateAI = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify({ _injection_attempt: true }));

    const r = await answer("any question", {
      generateAI,
      retrieve: fakeRetrieve(fixtureChunks),
    });
    expect(r.injectionAttempt).toBe(true);
    expect(r.refusal).toBe(true);
    expect(r.citations).toEqual([]);
    expect(generateAI).toHaveBeenCalledTimes(1);
  });
});

describe("legalAnswerer — happy path", () => {
  it("synthesizes a cited answer when ≥1 fact is applicable", async () => {
    const generateAI = vi
      .fn()
      // 1) extractor → applicable fact
      .mockResolvedValueOnce(
        JSON.stringify({
          applicable: true,
          rule_summary: "Flexion limited to 30 deg → 20% rating",
          supporting_quote:
            "Limitation of flexion of the leg to 30 degrees warrants a 20 percent evaluation.",
        }),
      )
      // 2) synthesizer → answer
      .mockResolvedValueOnce(
        "Knee flexion limited to 30 degrees rates at 20% (38 CFR § 4.71a).",
      );

    const r = await answer(
      "what is the rating for knee flexion limited to 30 degrees",
      {
        generateAI,
        retrieve: fakeRetrieve(fixtureChunks),
      },
    );

    expect(r.refusal).toBe(false);
    expect(r.injectionAttempt).toBe(false);
    expect(r.retrieved).toBe(1);
    expect(r.citations).toHaveLength(1);
    expect(r.citations[0].citation).toBe("38 CFR § 4.71a");
    expect(r.citations[0].source_url).toMatch(/ecfr\.gov/);
    expect(r.answer).toContain("38 CFR § 4.71a");
    expect(generateAI).toHaveBeenCalledTimes(2);
  });

  it("strips PII from the query before retrieval", async () => {
    let receivedQuery = null;
    const retrieve = async (q) => {
      receivedQuery = q;
      return { chunks: fixtureChunks };
    };
    const generateAI = vi
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify({
          applicable: true,
          rule_summary: "x",
          supporting_quote:
            "Limitation of flexion of the leg to 30 degrees warrants a 20 percent evaluation.",
        }),
      )
      .mockResolvedValueOnce("synthesized.");

    await answer(
      "My SSN is 123-45-6789 and I want to know about knee ratings",
      { generateAI, retrieve },
    );

    expect(receivedQuery).toBeTruthy();
    expect(receivedQuery).not.toContain("123-45-6789");
  });
});

describe("legalAnswerer — argument validation", () => {
  it("throws when generateAI is not provided", async () => {
    await expect(answer("q", {})).rejects.toThrow(TypeError);
    await expect(answer("q", { generateAI: "not-a-fn" })).rejects.toThrow(
      TypeError,
    );
  });
});
