import { describe, it, expect } from "vitest";
import { buildDKBIndex, searchIndexedDKB } from "./dkbSearchIndex";

/**
 * PROOF (D16-7): the trigram-indexed searchIndexedDKB returns
 * byte-identical entries, in byte-identical order, to the pre-D16-7
 * full-scan algorithm (scoreTermMatches/scoreDKBEntry/searchDKB, as they
 * existed in aiSystemPrompts.js before this fix - reproduced verbatim
 * below as `referenceSearchDKB`, never imported from the real module) for
 * every query in REPRESENTATIVE_QUERIES - including the pathological case
 * that motivated this fix: a large (~15,000-character) raw-text "query"
 * (musterCallProcessor.js's analyzeCFileWithAI hands searchDKB a C-File
 * excerpt of roughly this size), which the old algorithm scored at
 * O(entries x queryTerms) and this fix does not.
 *
 * The fixture below is synthetic (no real veteran data, and not the real
 * public/data/diamond_knowledge.json corpus - this test is self-contained
 * and has no network/file dependency) but is shaped to exercise every
 * scoring path the reference algorithm has: instruction/output substring
 * matches, the diagnostic-code boost (including its pre-existing quirk of
 * scaling with queryTerms.length rather than being a flat bonus - see
 * referenceScoreTermMatches), the condition-name boost, every source boost
 * multiplier, and every query-intent boost multiplier.
 */

function referenceScoreTermMatches(entry, queryTerms, query, isDCQuery) {
  const instruction = (entry.instruction || "").toLowerCase();
  const output = (entry.output || "").toLowerCase();
  let score = 0;
  for (const term of queryTerms) {
    if (instruction.includes(term)) score += 2;
    if (output.includes(term)) score += 1;
    if (isDCQuery && entry.metadata?.dc && query.includes(entry.metadata.dc)) {
      score += 10;
    }
    if (entry.metadata?.condition_name?.toLowerCase().includes(term)) {
      score += 3;
    }
  }
  return score;
}

function referenceApplySourceBoost(score, source) {
  let boosted = score;
  if (source === "eCFR_OFFICIAL") boosted *= 1.3;
  if (source === "OGC_PRECEDENT_OPINION") boosted *= 1.4;
  if (source === "BVA_DECISIONS" || source === "BVA_REPORTS_OFFICIAL") {
    boosted *= 1.2;
  }
  return boosted;
}

function referenceApplyIntentBoost(score, source, type, intent) {
  let boosted = score;
  if (intent.isSecondaryQuery && source === "SECONDARY_CONDITIONS_MATRIX") {
    boosted *= 2.5;
  }
  if (intent.isPACTQuery && source === "PACT_ACT_OFFICIAL") boosted *= 2.5;
  if (intent.isRatingQuery && type === "rating_criteria") boosted *= 2;
  if (intent.isBVAQuery && (source.includes("BVA") || source.includes("OGC"))) {
    boosted *= 2;
  }
  return boosted;
}

function referenceScoreDKBEntry(entry, query, queryTerms, isDCQuery, intent) {
  const source = entry.metadata?.source || "";
  const type = entry.metadata?.type || "";
  let score = referenceScoreTermMatches(entry, queryTerms, query, isDCQuery);
  score = referenceApplySourceBoost(score, source);
  score = referenceApplyIntentBoost(score, source, type, intent);
  return { entry, score };
}

function referenceSearchDKB(entries, query, topK) {
  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);
  const queryLower = query.toLowerCase();
  const intent = {
    isSecondaryQuery:
      queryLower.includes("secondary") ||
      queryLower.includes("nexus") ||
      queryLower.includes("caused by"),
    isPACTQuery:
      queryLower.includes("pact") ||
      queryLower.includes("toxic") ||
      queryLower.includes("burn pit"),
    isRatingQuery:
      queryLower.includes("rating") ||
      queryLower.includes("percentage") ||
      queryLower.includes("criteria"),
    isBVAQuery:
      queryLower.includes("bva") ||
      queryLower.includes("appeal") ||
      queryLower.includes("board"),
  };
  const isDCQuery = /\b\d{4}\b/.test(query);
  const scored = entries.map((entry) =>
    referenceScoreDKBEntry(entry, query, queryTerms, isDCQuery, intent),
  );
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => s.entry);
}

function buildFixtureEntries() {
  const entries = [];
  let id = 0;
  const add = (instruction, output, metadata = {}) => {
    entries.push({ id: `FX-${id++}`, instruction, output, metadata });
  };

  add(
    "What are the rating criteria for tinnitus, diagnostic code 6260?",
    "Tinnitus is rated 10 percent under DC 6260, recurrent or persistent.",
    {
      source: "eCFR_OFFICIAL",
      type: "rating_criteria",
      dc: "6260",
      condition_name: "tinnitus",
    },
  );
  add(
    "Is PTSD secondary to a service-connected knee condition?",
    "Secondary service connection for PTSD may be granted where a nexus exists.",
    { source: "SECONDARY_CONDITIONS_MATRIX", condition_name: "ptsd secondary" },
  );
  add(
    "What is 38 CFR 3.310 about?",
    "3.310 governs secondary service connection - a disability proximately due to a service-connected condition.",
    { source: "eCFR_OFFICIAL", condition_name: "secondary service connection" },
  );
  add(
    "PACT Act presumptive burn pit exposure conditions",
    "The PACT Act adds presumptive conditions for burn pit and toxic exposure.",
    { source: "PACT_ACT_OFFICIAL", condition_name: "burn pit exposure" },
  );
  add(
    "BVA decision on knee instability rating",
    "The Board found the veteran's knee instability warranted a 20 percent rating under DC 5257.",
    { source: "BVA_DECISIONS", dc: "5257", condition_name: "knee instability" },
  );
  add(
    "OGC precedent opinion on bilateral factor",
    "OGC precedent opinion 4-2020 addresses the bilateral factor calculation.",
    { source: "OGC_PRECEDENT_OPINION", condition_name: "bilateral factor" },
  );
  add(
    "VA medical center progress note - chronic back pain",
    "Veteran presented with chronic lumbar back pain, moderate, rated at 4.71a.",
    { source: "BVA_REPORTS_OFFICIAL", condition_name: "moderate back pain" },
  );
  add(
    "How is hearing loss rated?",
    "Hearing loss is rated under the rating criteria tables based on puretone average.",
    {
      source: "eCFR_OFFICIAL",
      type: "rating_criteria",
      condition_name: "hearing loss",
    },
  );
  add(
    "Migraine headache rating percentage",
    "Migraines are rated based on frequency and severity of prostrating attacks.",
    { condition_name: "migraine headache" },
  );
  add(
    "Sleep apnea nexus to deployment exposure",
    "A nexus opinion may link sleep apnea to in-service exposure or weight gain.",
    { condition_name: "sleep apnea" },
  );
  // Deliberately no metadata at all - exercises the empty/no-boost path.
  add(
    "Generic entry about surgery and treatment.",
    "No special boosts here.",
    {},
  );
  // Shares a condition_name with another entry - exercises the
  // group-by-distinct-condition-name path.
  add("Another tinnitus question", "See DC 6260 for tinnitus rating.", {
    condition_name: "tinnitus",
    dc: "6260",
  });
  // Neither field contains "xerostomia" - this entry can ONLY score > 0 via
  // the condition_name boost. If that path were broken (wrong multiplier
  // aside - actually removed, or its candidate generation missing a real
  // match), this entry silently drops out of every result set instead of
  // just reordering, which a magnitude-only mutation would not catch.
  add(
    "Dry mouth and dental complications in veterans",
    "Reduced saliva production can cause dental decay over time.",
    { condition_name: "xerostomia" },
  );
  // Neither field contains "9999" - can ONLY score > 0 via the diagnostic
  // code boost (isDCQuery + query.includes(metadata.dc)).
  add(
    "An entry with an isolated diagnostic code",
    "This text does not mention the code at all.",
    { dc: "9999" },
  );

  return entries;
}

function synthLargeQuery(charLength, seed) {
  const words = [
    "service",
    "connection",
    "ptsd",
    "tinnitus",
    "knee",
    "pain",
    "examination",
    "diagnosis",
    "rating",
    "veteran",
    "disability",
    "claim",
    "medical",
    "record",
    "treatment",
    "chronic",
    "condition",
    "nexus",
    "opinion",
    "evidence",
    "3.310",
    "4.71a",
    "6260",
    "burn pit",
    "moderate",
  ];
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  let text = "";
  while (text.length < charLength) {
    text += words[Math.floor(rand() * words.length)] + " ";
  }
  return text;
}

const REPRESENTATIVE_QUERIES = [
  "What is the rating criteria for tinnitus DC 6260?",
  "PACT act burn pit exposure presumptive conditions",
  "BVA decision nexus opinion for knee instability",
  "secondary service connection under 3.310",
  "bilateral factor OGC precedent",
  "",
  "a an of to",
  "6260",
  "moderate back pain 4.71a",
  "xerostomia",
  "9999",
  synthLargeQuery(15000, 7),
  synthLargeQuery(15000, 42),
  synthLargeQuery(500, 3),
];

describe("D16-7: searchIndexedDKB matches the pre-fix full-scan algorithm exactly", () => {
  it("returns byte-identical entries and order for every representative query", async () => {
    const entries = buildFixtureEntries();
    const index = await buildDKBIndex(entries);

    for (const query of REPRESENTATIVE_QUERIES) {
      const expected = referenceSearchDKB(entries, query, 10).map((e) => e.id);
      const actual = searchIndexedDKB(index, query, 10).map((e) => e.id);
      expect(actual, `query=${JSON.stringify(query.slice(0, 60))}`).toEqual(
        expected,
      );
    }
  });

  it("respects topK", async () => {
    const entries = buildFixtureEntries();
    const index = await buildDKBIndex(entries);
    const result = searchIndexedDKB(index, "tinnitus rating DC 6260", 1);
    expect(result).toHaveLength(1);
  });

  it("returns [] for a query with no matches", async () => {
    const entries = buildFixtureEntries();
    const index = await buildDKBIndex(entries);
    const result = searchIndexedDKB(index, "zzz_no_such_term_zzz", 10);
    expect(result).toEqual([]);
  });

  // Structural presence checks: these two entries can ONLY score > 0 via
  // one specific boost path each (see buildFixtureEntries's comments). If
  // either path were broken or never wired up, the entry would silently
  // drop out of the result set entirely - a much louder failure signature
  // than a re-ordering, and one the full-list order comparison above could
  // miss if the broken entry never has a close competitor in that query.
  it("finds an entry that can only match via the condition_name boost", async () => {
    const entries = buildFixtureEntries();
    const index = await buildDKBIndex(entries);
    const result = searchIndexedDKB(index, "xerostomia", 10);
    expect(result.map((e) => e.id)).toContain(
      entries.find((e) => e.metadata.condition_name === "xerostomia").id,
    );
  });

  it("finds an entry that can only match via the diagnostic-code boost", async () => {
    const entries = buildFixtureEntries();
    const index = await buildDKBIndex(entries);
    const result = searchIndexedDKB(index, "9999", 10);
    expect(result.map((e) => e.id)).toContain(
      entries.find((e) => e.metadata.dc === "9999").id,
    );
  });
});
