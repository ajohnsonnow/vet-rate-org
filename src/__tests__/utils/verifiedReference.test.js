import { describe, it, expect } from "vitest";
import {
  buildVerifiedReferenceBlock,
  detectReferenceTopics,
  selectVerifiedEntries,
  VERIFIED_REFERENCE_TOPICS,
} from "../../utils/verifiedReference";
import reference from "../../data/verifiedReference.json";

const ids = (question, options) =>
  selectVerifiedEntries(question, { maxChars: 100000, ...options }).map(
    (e) => e.id,
  );

describe("detectReferenceTopics", () => {
  it.each([
    [
      "What is an intent to file and how long does it last?",
      ["intent-to-file"],
    ],
    ["Should I submit an ITF first?", ["intent-to-file"]],
    [
      "Generate a nexus letter linking my sleep apnea (secondary) to my service-connected PTSD.",
      ["secondary"],
    ],
    ["My knee pain is caused by my service-connected back", ["secondary"]],
    [
      "Is depression secondary to my TBI presumed?",
      ["secondary", "secondary-presumed"],
    ],
    ["Can I file a supplemental claim with new evidence?", ["supplemental"]],
    ["Can I qualify for TDIU with only one 60% rating?", ["tdiu"]],
    ["I can't work. Is individual unemployability an option?", ["tdiu"]],
    ["Does the bilateral factor apply to my knees?", ["bilateral-factor"]],
    ["Both knees are rated 10% each", ["bilateral-factor"]],
    ["How is my combined rating worked out?", ["combined-rating"]],
    ["Do burn pits qualify me for anything?", ["toxic-exposure"]],
    ["I was exposed to Agent Orange", ["herbicide"]],
    ["Which presumptive conditions exist?", ["pact-act"]],
    ["Which form do I use to appeal?", ["claim-forms"]],
  ])("%s", (question, expected) => {
    expect(detectReferenceTopics(question)).toEqual(expected);
  });
});

describe("detectReferenceTopics beyond single keywords", () => {
  it("uses the tool the question came from", () => {
    expect(detectReferenceTopics("Am I eligible?", "tdiu-builder")).toEqual([
      "tdiu",
    ]);
    expect(
      detectReferenceTopics("What applies to me?", "pact-navigator"),
    ).toEqual(["pact-act"]);
  });
});

describe("detectReferenceTopics for combined ratings", () => {
  it("does not attach the combined-rating text on a rating tool's id alone", () => {
    for (const toolId of [
      "calculator",
      "rating-calculator",
      "rating-analyzer",
    ]) {
      expect(detectReferenceTopics("Explain this to me", toolId)).toEqual([]);
    }
    expect(
      detectReferenceTopics(
        "Skip the calculation and write me a personal statement for my back claim instead.",
        "calculator",
      ),
    ).toEqual([]);
  });

  it("attaches it when the call carries structured conditions", () => {
    const conditions = [
      { name: "PTSD", rating: 50, side: "none", bodyPart: "mental" },
    ];
    expect(
      detectReferenceTopics("Explain this to me", "calculator", { conditions }),
    ).toEqual(["combined-rating"]);
    expect(
      detectReferenceTopics("Explain this to me", null, { conditions: [] }),
    ).toEqual([]);
    expect(
      selectVerifiedEntries("Explain this to me", {
        toolId: "calculator",
        maxChars: 3400,
        conditions,
      }).map((e) => e.id),
    ).toEqual(["cfr-4.25-b", "cfr-4.25"]);
  });

  it("still attaches it on the question's own wording", () => {
    expect(
      detectReferenceTopics("Analyze my 80% combined rating and the math."),
    ).toEqual(["combined-rating"]);
  });
});

describe("detectReferenceTopics across topics", () => {
  it("reads a service location as a PACT topic only in a PACT question", () => {
    expect(
      detectReferenceTopics(
        "Am I eligible for any PACT Act presumptive conditions based on my Iraq deployment?",
        "pact-navigator",
      ),
    ).toEqual(["toxic-exposure"]);
    expect(
      detectReferenceTopics(
        "Vietnam veteran with chronic respiratory issues — what PACT conditions apply?",
        "pact-navigator",
      ),
    ).toEqual(["herbicide"]);
    expect(
      detectReferenceTopics(
        "I served with John in Iraq 2008-2009. I witnessed him struck by IED debris.",
        "buddy-statement",
      ),
    ).toEqual([]);
  });

  it("finds several topics in one question", () => {
    expect(
      detectReferenceTopics(
        "Calculate combined rating with bilateral factor for both knees, and am I eligible for TDIU?",
      ),
    ).toEqual(["tdiu", "bilateral-factor", "combined-rating"]);
  });

  it.each([
    "Help me write a personal statement describing how PTSD affects my daily life.",
    "Please review my DD214 for accuracy and identify any missing service information.",
    "How do I claim sleep apnea?",
    "Decode my denial",
    "My asthma was aggravated by service in the Navy.",
    "We formed up at 0600 from 08-2009 until I left.",
    "",
  ])("selects nothing for: %s", (question) => {
    expect(detectReferenceTopics(question)).toEqual([]);
  });

  it("tolerates a missing question", () => {
    expect(detectReferenceTopics(undefined)).toEqual([]);
    expect(detectReferenceTopics(null, "tdiu-builder")).toEqual(["tdiu"]);
  });
});

describe("VERIFIED_REFERENCE_TOPICS", () => {
  it("only names entries that are in the bundle", () => {
    const known = new Set(reference.entries.map((e) => e.id));
    for (const topic of VERIFIED_REFERENCE_TOPICS) {
      for (const id of topic.entries) expect(known.has(id), id).toBe(true);
    }
  });

  it("reaches every bundled entry from some topic", () => {
    const reachable = new Set(
      VERIFIED_REFERENCE_TOPICS.flatMap((topic) => topic.entries),
    );
    for (const e of reference.entries) {
      expect(reachable.has(e.id), e.id).toBe(true);
    }
  });
});

describe("selectVerifiedEntries", () => {
  it("returns a topic's entries in its priority order", () => {
    expect(ids("Am I eligible for TDIU?")).toEqual([
      "cfr-4.16-a",
      "cfr-4.16-b",
      "cfr-4.16-a-employment",
    ]);
  });

  it("alternates between topics so one topic cannot use the whole budget", () => {
    expect(ids("TDIU and the bilateral factor")).toEqual([
      "cfr-4.16-a",
      "cfr-4.26",
      "cfr-4.16-b",
      "cfr-4.26-a-b-d",
      "cfr-4.16-a-employment",
    ]);
  });

  it("lists an entry once when two topics name it", () => {
    const picked = ids("TDIU, unemployability and 38 CFR 4.16");
    expect(picked).toEqual([...new Set(picked)]);
  });

  it("returns nothing when no topic applies", () => {
    expect(ids("How do I claim sleep apnea?")).toEqual([]);
  });
});

describe("buildVerifiedReferenceBlock", () => {
  it("is empty when no topic applies", () => {
    expect(
      buildVerifiedReferenceBlock("How do I claim sleep apnea?", {
        maxChars: 3400,
      }),
    ).toBe("");
  });

  it("wraps the quoted entries in the block markers with one header sentence", () => {
    const block = buildVerifiedReferenceBlock(
      "Is sleep apnea secondary to PTSD possible?",
      { maxChars: 3400 },
    );
    expect(block.startsWith("\n\n=== VERIFIED REFERENCE ===\n")).toBe(true);
    expect(block.endsWith("=== END VERIFIED REFERENCE ===\n")).toBe(true);
    const header = block.split("\n")[3];
    expect(header).toMatch(/quoted/);
    expect(header).toMatch(/remember/);
    expect(header.match(/[.!?](?:\s|$)/g)).toHaveLength(1);
    expect(block).toContain("[38 CFR § 3.310(a)] (eCFR, retrieved 2026-07-10)");
    expect(block).toContain(
      "disability which is proximately due to or the result of a service-connected disease or injury shall be service connected",
    );
  });

  it("names the manual, its dates and the abbreviations an entry uses", () => {
    const block = buildVerifiedReferenceBlock("burn pit presumptives", {
      maxChars: 8000,
    });
    expect(block).toContain(
      "(VA manual M21-1, changed June 6, 2025, retrieved 2026-07-19)",
    );
    expect(block).toContain(
      "Abbreviations: SC = service connection; BPOT = burn pits and other toxins, including fine particulate matter.",
    );
  });
});

describe("buildVerifiedReferenceBlock budget", () => {
  it("never exceeds the budget and never cuts an entry short", () => {
    const question =
      "PACT Act burn pits, Agent Orange, TDIU, bilateral factor, combined rating, intent to file, supplemental claim, secondary to TBI, which form";
    for (const maxChars of [900, 1500, 3400, 5000, 6500]) {
      const block = buildVerifiedReferenceBlock(question, { maxChars });
      expect(block.length).toBeLessThanOrEqual(maxChars);
      const picked = selectVerifiedEntries(question, { maxChars });
      for (const e of picked) expect(block).toContain(e.text);
    }
  });

  it("skips an entry that does not fit and still takes a later one that does", () => {
    const picked = ids("How is my combined rating worked out?", {
      maxChars: 2000,
    });
    expect(picked).toEqual(["cfr-4.25-b", "cfr-4.25"]);
  });

  it("is empty when not even one entry fits", () => {
    expect(
      buildVerifiedReferenceBlock("Am I eligible for TDIU?", { maxChars: 300 }),
    ).toBe("");
  });

  it("fits the on-device budget for the questions the evaluation got wrong", () => {
    const cases = [
      [
        "Am I eligible for TDIU with one 60% rating and three 20% ratings?",
        "tdiu-builder",
      ],
      [
        "Calculate combined rating with bilateral factor for both knees at 10% each plus 30% back.",
        "rating-calculator",
      ],
      [
        "Am I eligible for any PACT Act presumptive conditions based on my Iraq deployment?",
        "pact-navigator",
      ],
      [
        "Generate a nexus letter linking my sleep apnea (secondary) to my service-connected PTSD.",
        "nexus-builder",
      ],
    ];
    for (const [question, toolId] of cases) {
      const block = buildVerifiedReferenceBlock(question, {
        toolId,
        maxChars: 3400,
      });
      expect(block.length).toBeGreaterThan(500);
      expect(block.length).toBeLessThanOrEqual(3400);
    }
  });
});
