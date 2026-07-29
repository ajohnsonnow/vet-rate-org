import { describe, it, expect, vi } from "vitest";
import { answer, _internals } from "../../services/legalAnswerer.js";

const { expandChunksWithSiblings } = _internals;

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

describe("legalAnswerer — citation attribution (Ab-H03)", () => {
  it("attributes the applicable fact to its own chunk, not the Nth chunk", async () => {
    // chunk #0 is NOT applicable, chunk #1 IS — the buggy filtered-index mapping
    // attributed chunk #0's citation to the first applicable fact.
    const twoChunks = [
      {
        id: "c0",
        citation: "38 CFR § 3.999 (WRONG)",
        title: "Non-applicable",
        text: "Administrative boilerplate, not responsive.",
        source_url: "https://www.ecfr.gov/wrong",
        fetched_at: "2026-05-15T00:00:00Z",
        score: 0.4,
      },
      {
        id: "c1",
        citation: "38 CFR § 4.71a (RIGHT)",
        title: "Applicable",
        text: "Limitation of flexion of the leg to 30 degrees warrants 20 percent.",
        source_url: "https://www.ecfr.gov/right",
        fetched_at: "2026-05-15T00:00:00Z",
        score: 0.9,
      },
    ];

    const generateAI = vi
      .fn()
      // extractor → one fact per chunk; only the second is applicable
      .mockResolvedValueOnce(
        JSON.stringify([
          { applicable: false, rule_summary: "n/a", supporting_quote: "n/a" },
          {
            applicable: true,
            rule_summary: "Flexion to 30 deg → 20%",
            supporting_quote:
              "Limitation of flexion of the leg to 30 degrees warrants 20 percent.",
          },
        ]),
      )
      .mockResolvedValueOnce("Knee flexion to 30 degrees rates at 20%.");

    const r = await answer("knee flexion rating", {
      generateAI,
      retrieve: fakeRetrieve(twoChunks),
    });

    expect(r.refusal).toBe(false);
    expect(r.citations).toHaveLength(1);
    expect(r.citations[0].citation).toBe("38 CFR § 4.71a (RIGHT)");
    expect(r.citations[0].source_url).toMatch(/right/);
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

describe("legalAnswerer — parent-child expansion (expandChunksWithSiblings)", () => {
  const family = [
    { id: "X0", citation: "X", title: "t", text: "AAAA" }, // pos 0
    { id: "X1", citation: "X", title: "t", text: "BBBB" }, // pos 1 (retrieved)
    { id: "X2", citation: "X", title: "t", text: "CCCC" }, // pos 2
    { id: "X3", citation: "X", title: "t", text: "DDDD" }, // pos 3
  ];
  const getSiblings = () => family;

  it("expands nearest-first, following chunk before preceding on ties", () => {
    const out = expandChunksWithSiblings([family[1]], getSiblings, 1000);
    // X1 (pos1): X2(d1) & X0(d1) tie → X2 (higher pos) first; then X3(d2).
    expect(out[0].text).toBe("BBBB\n\nCCCC\n\nAAAA\n\nDDDD");
  });

  it("keeps the retrieved chunk whole and caps at the budget", () => {
    const out = expandChunksWithSiblings([family[1]], getSiblings, 11);
    // "BBBB" (4) + "\n\n" (2) + "CCCC" (4) = 10 ≤ 11; next would be 16 > 11.
    expect(out[0].text).toBe("BBBB\n\nCCCC");
    expect(out[0].text.length).toBeLessThanOrEqual(11);
  });

  it("skips an oversized nearer sibling but still fits a smaller farther one", () => {
    const fam = [
      { id: "Y0", citation: "Y", title: "t", text: "R" }, // pos 0 (retrieved)
      { id: "Y1", citation: "Y", title: "t", text: "TOOBIGGGGGG" }, // pos 1 (nearest, too big)
      { id: "Y2", citation: "Y", title: "t", text: "ok" }, // pos 2 (fits)
    ];
    // budget: "R"(1) + "\n\n"(2) + "ok"(2) = 5; the pos1 sibling (11) never fits.
    const out = expandChunksWithSiblings([fam[0]], () => fam, 5);
    expect(out[0].text).toBe("R\n\nok");
  });

  it("excludes siblings that are themselves in the retrieved set", () => {
    // X0 and X1 both retrieved → X1's block must not re-pack X0.
    const out = expandChunksWithSiblings(
      [family[1], family[0]],
      getSiblings,
      1000,
    );
    expect(out[0].id).toBe("X1");
    expect(out[0].text).toBe("BBBB\n\nCCCC\n\nDDDD"); // X0 omitted (retrieved)
    expect(out[1].id).toBe("X0");
    expect(out[1].text).toBe("AAAA\n\nCCCC\n\nDDDD"); // X1 omitted (retrieved)
  });

  it("returns the chunk unchanged when the section has no other chunks", () => {
    const solo = { id: "Z0", citation: "Z", title: "t", text: "only" };
    const out = expandChunksWithSiblings([solo], () => [solo], 1000);
    expect(out[0]).toBe(solo); // same object reference — no expansion
  });

  it("is a no-op when the budget is 0 or non-finite", () => {
    const chunks = [family[1]];
    expect(expandChunksWithSiblings(chunks, getSiblings, 0)).toBe(chunks);
    expect(expandChunksWithSiblings(chunks, getSiblings, NaN)).toBe(chunks);
  });
});

const expansionWiringRetrieved = [
  {
    id: "a0",
    citation: "38 CFR § 4.14",
    title: "Pyramiding",
    text: "primary A",
    source_url: "urlA",
    fetched_at: "fa",
    score: 0.5,
  },
  {
    id: "b0",
    citation: "38 CFR § 4.22",
    title: "Aggravation",
    text: "primary B",
    source_url: "urlB",
    fetched_at: "fb",
    score: 0.4,
  },
];
const expansionWiringFamilies = {
  "38 CFR § 4.14": [
    expansionWiringRetrieved[0],
    {
      id: "a1",
      citation: "38 CFR § 4.14",
      title: "Pyramiding",
      text: "SIBLING-A-DETAIL",
      source_url: "urlA",
      fetched_at: "fa",
    },
  ],
  "38 CFR § 4.22": [
    expansionWiringRetrieved[1],
    {
      id: "b1",
      citation: "38 CFR § 4.22",
      title: "Aggravation",
      text: "SIBLING-B-DETAIL",
      source_url: "urlB",
      fetched_at: "fb",
    },
  ],
};
const getExpansionWiringSiblings = (citation) =>
  expansionWiringFamilies[citation] || [];

async function expansionWiringExpandsSiblingTextTest() {
  const retrieved = expansionWiringRetrieved;
  const getSiblings = getExpansionWiringSiblings;
  const generateAI = vi
    .fn()
    // extractor → one applicable fact per block; quotes are PARAPHRASES
    // (not raw text) so we can prove no raw/expanded text leaks to synth.
    .mockResolvedValueOnce(
      JSON.stringify([
        {
          applicable: true,
          rule_summary: "rule from A block",
          supporting_quote: "quote-A",
        },
        {
          applicable: true,
          rule_summary: "rule from B block",
          supporting_quote: "quote-B",
        },
      ]),
    )
    .mockResolvedValueOnce("Synthesized answer.");

  const r = await answer("some question", {
    generateAI,
    retrieve: async () => ({ chunks: retrieved }),
    getSiblings,
  });

  const extractorPrompt = generateAI.mock.calls[0][0];
  const synthPrompt = generateAI.mock.calls[1][0];

  // Expanded sibling text DID reach the extractor's untrusted blob.
  expect(extractorPrompt).toContain("SIBLING-A-DETAIL");
  expect(extractorPrompt).toContain("SIBLING-B-DETAIL");
  expect(extractorPrompt).toContain("[#0]");
  expect(extractorPrompt).toContain("primary A");

  // Synthesizer saw ONLY structured facts — no raw blob, no expanded text.
  expect(synthPrompt).not.toContain("SIBLING-A-DETAIL");
  expect(synthPrompt).not.toContain("SIBLING-B-DETAIL");
  expect(synthPrompt).not.toContain("primary A");
  expect(synthPrompt).not.toContain("[#0]");
  expect(synthPrompt).toContain("quote-A"); // extractor-selected fact only

  // Citation attribution survives expansion (Ab-H03 guard): each fact maps
  // back to its own retrieved chunk's citation/source_url, not the other's.
  expect(r.refusal).toBe(false);
  expect(r.citations).toHaveLength(2);
  expect(r.citations[0].citation).toBe("38 CFR § 4.14");
  expect(r.citations[0].source_url).toBe("urlA");
  expect(r.citations[1].citation).toBe("38 CFR § 4.22");
  expect(r.citations[1].source_url).toBe("urlB");
}

async function expansionWiringNoExpandWhenDisabledTest() {
  const retrieved = expansionWiringRetrieved;
  const getSiblings = getExpansionWiringSiblings;
  const generateAI = vi
    .fn()
    .mockResolvedValueOnce(
      JSON.stringify([{ applicable: false }, { applicable: false }]),
    );
  await answer(
    "q",
    {
      generateAI,
      retrieve: async () => ({ chunks: retrieved }),
      getSiblings,
    },
    { expandContext: false },
  );
  const extractorPrompt = generateAI.mock.calls[0][0];
  expect(extractorPrompt).not.toContain("SIBLING-A-DETAIL");
  expect(extractorPrompt).toContain("primary A");
}

async function expansionWiringNonAdjacentAttributionTest() {
  const retrieved = expansionWiringRetrieved;
  const getSiblings = getExpansionWiringSiblings;
  // block #0 not applicable, block #1 IS — the fact must attribute to b0's
  // citation, not a0's, even though both blocks were sibling-expanded.
  const generateAI = vi
    .fn()
    .mockResolvedValueOnce(
      JSON.stringify([
        { applicable: false, rule_summary: "n/a", supporting_quote: "n/a" },
        {
          applicable: true,
          rule_summary: "B applies",
          supporting_quote: "quote-B",
        },
      ]),
    )
    .mockResolvedValueOnce("Answer B.");
  const r = await answer("q", {
    generateAI,
    retrieve: async () => ({ chunks: retrieved }),
    getSiblings,
  });
  expect(r.citations).toHaveLength(1);
  expect(r.citations[0].citation).toBe("38 CFR § 4.22");
  expect(r.citations[0].source_url).toBe("urlB");
}

describe("legalAnswerer — expansion wiring + security invariant", () => {
  it(
    "expands sibling text into the extractor only; attributes facts to the right citation",
    expansionWiringExpandsSiblingTextTest,
  );

  it(
    "does not expand when opts.expandContext is false",
    expansionWiringNoExpandWhenDisabledTest,
  );

  it(
    "still attributes correctly when only a non-adjacent block's fact is applicable (Ab-H03 under expansion)",
    expansionWiringNonAdjacentAttributionTest,
  );
});
