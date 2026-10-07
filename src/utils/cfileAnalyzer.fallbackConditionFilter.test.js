/**
 * D20-8: the C-File off-device fallback ran the rating-decision parsers'
 * header and "name ... NN%" scans over a whole letter, which also match
 * letter scaffolding. A finding named "Service connection", "Combined
 * evaluation", "Rating", "shows evaluation" or "the condition" is not a
 * condition, and a "(formerly evaluated as 30 percent)" tail is not part of a
 * name. Real conditions must survive, so the assertions are exact lists.
 */
import { describe, it, expect, vi } from "vitest";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

vi.mock("./unifiedAIService", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateAI: vi.fn(),
    getAIStatus: vi.fn(() => ({ effectiveMode: "cloud" })),
    getDocumentAIRouting: vi.fn(() => ({
      onDeviceReady: false,
      onDeviceMode: null,
      blockedProviderLabel: "Cloud AI (Gemini)",
    })),
    isAnyAIAvailable: vi.fn(() => true),
  };
});

const { analyzeCFile, _cleanConditionName } =
  await import("./cfileAnalyzer.js");

const SCAFFOLDED_LETTER = `
Rating Decision
Page 1 of 4

DECISION

1. Service connection for tinnitus is granted with an evaluation of 10 percent
disabling effective January 1, 2020.
2. Service connection for degenerative arthritis of the lumbar spine is
granted with an evaluation of 20 percent disabling effective March 3, 2019.
3. Service connection for obstructive sleep apnea is denied.
4. Evaluation of migraine headaches, which is currently 30 percent disabling,
is continued.
Your combined evaluation is 60 percent effective January 1, 2020.

Tinnitus ......... 10% effective date: January 1, 2020
Service connection - 50 percent effective date January 1, 2020
Combined evaluation - 60 percent effective date January 1, 2020
Rating: 70 percent effective date January 1, 2020
Prior decision dated June 5, 2018 shows evaluation: 30% . Effective date March 3, 2019

We determined that the following conditions were related to your military
service, so service connection has been granted: Medical Description
Percent (%) Assigned Effective Date Panic disorder 30% Jun 30, 2007
Lumbar strain 10% Jun 30, 2008
We have assigned a 50 percent evaluation for your post-traumatic stress disorder (formerly evaluated as 30 percent) based on:
Medical Description Percent (%) 20% 30%
Service connection for the condition is granted with an evaluation of 40 percent effective June 30, 2009.

EVIDENCE
Service treatment records from 2001 to 2005.
`;

const NO_DECISION_LANGUAGE = `
This statement describes a ride along a quiet road past a lake. The weather
was mild and the group stopped for lunch twice before returning home late in
the afternoon. Nothing in this paragraph concerns a claim, a rating or a
decision of any kind, and it is only here to make the document long enough to
analyze at all.
`;

async function conditionsFor(text) {
  const result = await analyzeCFile("fake-api-key", text, () => {}, null, {});
  return result.analysis.potential_claims.map((c) => c.condition);
}

describe("analyzeCFile off-device fallback: non-condition fragments are filtered", () => {
  it("returns exactly the real conditions, none of the scaffolding", async () => {
    expect(await conditionsFor(SCAFFOLDED_LETTER)).toEqual([
      "Tinnitus",
      "degenerative arthritis of the lumbar spine",
      "obstructive sleep apnea",
      "migraine headaches",
      "Panic disorder",
      "Lumbar strain",
      "post-traumatic stress disorder",
    ]);
  });

  it("finds nothing (and says so) in text without decision language", async () => {
    const result = await analyzeCFile(
      "fake-api-key",
      NO_DECISION_LANGUAGE,
      () => {},
      null,
      {},
    );
    expect(result.analysis.potential_claims).toEqual([]);
    expect(result.metadata.foundNothing).toBe(true);
  });
});

const REAL_SHAPES_LETTER = `
Rating Decision
Page 1 of 4

DECISION

1. Service connection for hepatitis A is granted with an evaluation of 10 percent
disabling effective January 1, 2020.
2. Service connection for hemophilia A is granted with an evaluation of 30 percent
disabling effective March 3, 2019.
3. Service connection for lumbosacral strain with degenerative disc disease and intervertebral disc syndrome (claimed as low back pain, back condition, and spine problems, and other spinal complaints) is granted with an evaluation of 20 percent disabling effective March 3, 2019.
4. Service connection for sleep apnea is denied.
5. Service connection for traumatic brain injury (TBI is granted with an evaluation of 40 percent disabling effective March 3, 2019.
6. Service connection for tinnitus 10% is granted effective March 3, 2019.
`;

describe("analyzeCFile off-device fallback: real condition shapes survive", () => {
  it("keeps names ending in A, long names, two-letter acronyms and repairs an unclosed parenthesis", async () => {
    const names = await conditionsFor(REAL_SHAPES_LETTER);
    expect(names).toContain("hepatitis A");
    expect(names).toContain("hemophilia A");
    expect(names).toContain("traumatic brain injury (TBI)");
    expect(
      names.some((n) => n.startsWith("lumbosacral strain with degenerative")),
    ).toBe(true);
    expect(names.filter((n) => /^tinnitus/i.test(n))).toEqual(["tinnitus"]);
  });
});

const PREFIXED_LETTER = `
Rating Decision
Page 1 of 4

DECISION

1. Service connection for a skin condition is granted with an evaluation of 10 percent
disabling effective January 1, 2020.
2. Service connection for May 1, 2021 service connected disability of the right knee is granted with an evaluation of 20 percent
disabling effective March 3, 2019.
3. Service connection for tinnitus tinnitus is granted with an evaluation of 10 percent
disabling effective March 3, 2019.
4. Service connection for the migraine headaches is granted with an evaluation of 30 percent
disabling effective March 3, 2019.
`;

describe("analyzeCFile off-device fallback: prefixes, fragments, duplicates", () => {
  it("normalises prefixed names and merges run-together duplicates into an exact list", async () => {
    expect(await conditionsFor(PREFIXED_LETTER)).toEqual([
      "skin condition",
      "right knee",
      "tinnitus",
      "migraine headaches",
    ]);
  });
});

describe("_cleanConditionName normalisation", () => {
  it("strips date, article and boilerplate prefixes", () => {
    expect(
      _cleanConditionName(
        "May 1, 2021 service connected disability of the right knee",
      ),
    ).toBe("right knee");
    expect(_cleanConditionName("a skin condition")).toBe("skin condition");
    expect(_cleanConditionName("03/04/2019 - the lumbar strain")).toBe(
      "lumbar strain",
    );
    expect(_cleanConditionName("2019-03-04 hearing loss")).toBe("hearing loss");
  });

  it("collapses run-together duplicates", () => {
    expect(_cleanConditionName("Tinnitus Tinnitus")).toBe("Tinnitus");
    expect(_cleanConditionName("tinnitustinnitus")).toBe("tinnitus");
    expect(_cleanConditionName("left knee strain left knee strain")).toBe(
      "left knee strain",
    );
  });

  it("drops fragments but keeps real conditions that look similar", () => {
    expect(_cleanConditionName("of the right knee")).toBeNull();
    expect(_cleanConditionName("due to service")).toBeNull();
    expect(_cleanConditionName("and degenerative disc")).toBeNull();
    expect(_cleanConditionName("lumbar strain with")).toBeNull();
    expect(_cleanConditionName("Secondary hyperparathyroidism")).toBe(
      "Secondary hyperparathyroidism",
    );
    expect(_cleanConditionName("Intestinal bacterial overgrowth")).toBe(
      "Intestinal bacterial overgrowth",
    );
  });
});

describe("_cleanConditionName", () => {
  it("keeps two-letter acronyms and repairs or rejects unbalanced parentheses", () => {
    expect(_cleanConditionName("ED")).toBe("ED");
    expect(_cleanConditionName("MS")).toBe("MS");
    expect(_cleanConditionName("Tinnitus 10%")).toBe("Tinnitus");
    expect(_cleanConditionName("PTSD 70%, effective")).toBe("PTSD");
    expect(_cleanConditionName("migraines)")).toBe("migraines");
    expect(_cleanConditionName("of")).toBeNull();
  });
});

describe("_cleanConditionName: real catalogue and free-text names survive", () => {
  it("does not halve a real doubled-letter catalogue condition", () => {
    expect(_cleanConditionName("beriberi")).toBe("beriberi");
    expect(_cleanConditionName("Beriberi heart disease")).toBe(
      "Beriberi heart disease",
    );
  });

  it("keeps names that begin with a hyphenated or acronym fragment word", () => {
    for (const name of [
      "in-service ankle injury residuals",
      "in-grown toenail",
      "In situ carcinoma of the bladder",
      "AS",
      "At-rest tremor",
      "On-the-job hearing loss",
      "Secondary to diabetes mellitus, peripheral neuropathy",
    ]) {
      expect(_cleanConditionName(name)).toBe(name);
    }
  });

  it("still drops the plain clause fragments", () => {
    expect(_cleanConditionName("in service")).toBeNull();
    expect(_cleanConditionName("on the right")).toBeNull();
    expect(_cleanConditionName("as noted above")).toBeNull();
    expect(_cleanConditionName("secondary to diabetes")).toBeNull();
  });
});

describe("_cleanConditionName: partial duplicates, headings and truncations", () => {
  it("collapses a repeated word or phrase that is not an exact half", () => {
    expect(_cleanConditionName("Bilateral hearing loss hearing loss")).toBe(
      "Bilateral hearing loss",
    );
    expect(_cleanConditionName("Tinnitus, tinnitus")).toBe("Tinnitus");
    expect(_cleanConditionName("left left knee")).toBe("left knee");
    expect(_cleanConditionName("chronic chronic pain")).toBe("chronic pain");
  });

  it("drops page, heading and form-reference text", () => {
    for (const name of [
      "Page 3 of 7",
      "Enclosure",
      "Reasons for Decision",
      "Evidence",
      "VA Form 21-526EZ",
    ]) {
      expect(_cleanConditionName(name)).toBeNull();
    }
  });

  it("keeps a real condition whose name contains a digit", () => {
    expect(_cleanConditionName("COVID-19")).toBe("COVID-19");
    expect(_cleanConditionName("Vitamin B12 deficiency")).toBe(
      "Vitamin B12 deficiency",
    );
  });

  it("drops a name cut off in the middle of a catalogue word", () => {
    expect(_cleanConditionName("post-traumatic stress disor")).toBeNull();
    expect(_cleanConditionName("obstructive sleep ap")).toBeNull();
    expect(_cleanConditionName("obstructive sleep apnea")).toBe(
      "obstructive sleep apnea",
    );
  });

  it("keeps real free-text conditions whose last word is not a catalogue word", () => {
    for (const name of [
      "Gulf War illness",
      "right shin splint",
      "plantar fasciitis",
      "left hip bursitis",
    ]) {
      expect(_cleanConditionName(name)).toBe(name);
    }
  });

  it("stops a name at a trailing which/that clause", () => {
    expect(
      _cleanConditionName(
        "migraine headaches, which is currently 30 percent disabling",
      ),
    ).toBe("migraine headaches");
    expect(_cleanConditionName("migraine headaches, which is currently")).toBe(
      "migraine headaches",
    );
  });
});

describe("_cleanConditionName across the whole 38 CFR catalogue", () => {
  it("returns every plain catalogue condition name unchanged", async () => {
    const { getAllConditions } = await import("../services/knowledgeQuery");
    const all = getAllConditions();
    expect(all.length).toBeGreaterThan(700);
    // The inverted "Hand, loss of use of" entries end in a dangling "of" and
    // were already dropped as fragments before this rule set.
    const plain = all.filter((d) => !d.conditionName.includes(","));
    expect(plain.length).toBeGreaterThan(300);
    const changed = plain
      .map((d) => [d.conditionName, _cleanConditionName(d.conditionName)])
      .filter(([raw, cleaned]) => cleaned !== raw);
    expect(changed).toEqual([]);
  });
});

const REAL_NAMES_LETTER = `
Rating Decision
Page 1 of 4

DECISION

1. Service connection for beriberi is granted with an evaluation of 10 percent
disabling effective January 1, 2020.
2. Service connection for in-service ankle injury residuals is granted with an evaluation of 20 percent
disabling effective March 3, 2019.
`;

describe("analyzeCFile off-device fallback: hyphenated and doubled-letter names", () => {
  it("lists beriberi and an in-service injury instead of dropping or halving them", async () => {
    expect(await conditionsFor(REAL_NAMES_LETTER)).toEqual([
      "beriberi",
      "in-service ankle injury residuals",
    ]);
  });
});
