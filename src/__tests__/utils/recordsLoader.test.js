/**
 * WS-7: VKB/claims → calculator bridge.
 * buildConditionCandidates is the pure core behind "Load from My Records" —
 * it must dedup across sources, exclude what's already in My Ratings, and
 * never emit an unusable rating.
 */
import { describe, it, expect } from "vitest";
import {
  normalizeConditionName,
  buildConditionCandidates,
  buildVkbMergeFromCFile,
} from "../../utils/veteranContextProvider";

describe("normalizeConditionName", () => {
  it("collapses case, parentheticals, punctuation and whitespace", () => {
    expect(normalizeConditionName("Tinnitus (Service Connected)")).toBe(
      "tinnitus",
    );
    expect(normalizeConditionName("  TINNITUS.  ")).toBe("tinnitus");
    expect(
      normalizeConditionName("Post-Traumatic Stress Disorder (PTSD)"),
    ).toBe("post traumatic stress disorder");
  });

  it("returns empty string for non-strings", () => {
    expect(normalizeConditionName(null)).toBe("");
    expect(normalizeConditionName(42)).toBe("");
  });
});

describe("buildConditionCandidates", () => {
  const claims = [
    {
      conditionName: "Post-Traumatic Stress Disorder (PTSD)",
      selectedRating: 50,
    },
    { conditionName: "Tinnitus", selectedRating: 10 },
    { conditionName: "Lumbosacral Strain", ratingPercent: 20 },
  ];

  it("maps claims to calculator-shaped conditions", () => {
    const out = buildConditionCandidates({ claims });
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ rating: 50, side: "none" });
    expect(out[0].name).toContain("PTSD");
  });

  it("excludes conditions already in My Ratings (normalized match)", () => {
    const out = buildConditionCandidates({
      excludeNames: ["TINNITUS (bilateral)"],
      claims,
    });
    expect(out.map((c) => c.name)).not.toContain("Tinnitus");
    expect(out).toHaveLength(2);
  });

  it("dedups across claims and VKB analyzer output", () => {
    const out = buildConditionCandidates({
      claims,
      vkbClaims: [
        { condition: "tinnitus", rating: 10 },
        { condition: "Pes Planus", rating: 10 },
      ],
    });
    expect(out.filter((c) => /tinnitus/i.test(c.name))).toHaveLength(1);
    expect(out.map((c) => c.name)).toContain("Pes Planus");
  });

  it("drops unusable ratings instead of guessing", () => {
    const out = buildConditionCandidates({
      claims: [
        { conditionName: "No Rating Yet" },
        { conditionName: "Out of Range", selectedRating: 150 },
        { conditionName: "Stringy", selectedRating: "50" },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: "Stringy", rating: 50 });
  });

  it("handles empty input", () => {
    expect(buildConditionCandidates()).toEqual([]);
  });
});

const CFILE_ANALYSIS_FIXTURE = {
  summary: "Veteran with tinnitus and lumbar strain.",
  potential_claims: [
    {
      condition: "Tinnitus",
      diagnosticCode: "6260",
      likelihood: "high",
      inServiceEvent: "Artillery noise exposure",
      missing_element: "Nexus letter",
      recommendation: "Get an audiology nexus opinion",
    },
    { condition: "Lumbar Strain", diagnosticCode: "5237" },
  ],
  timeline: [
    {
      date: "2005-06-01",
      category: "injury",
      description: "Back injury during PT",
      significance: "high",
    },
  ],
  exposures: [
    {
      type: "Burn Pits",
      location: "Balad",
      timeframe: "2004",
      presumptive_conditions: ["Asthma", "Rhinitis"],
    },
    "Noise exposure",
  ],
  mentalHealth: { diagnoses: ["PTSD"] },
  actionItems: ["File tinnitus claim"],
};

describe("buildVkbMergeFromCFile — C-File → canonical VKB merge shape", () => {
  const analysis = CFILE_ANALYSIS_FIXTURE;
  const merge = buildVkbMergeFromCFile(analysis, {
    method: "text",
    ocrUsed: false,
    confidence: 0.9,
  });

  it("keeps the legacy off-schema arrays for dual-write back-compat", () => {
    expect(merge.claims).toHaveLength(2);
    expect(merge.claims[0]).toMatchObject({
      condition: "Tinnitus",
      source: "C-File Analysis",
      status: "identified",
    });
    expect(merge.evidence).toHaveLength(1);
    expect(merge.aiInsights.cfileAnalysisSummary).toContain("tinnitus");
    expect(merge.aiInsights.cfileExtraction.ocrMethod).toBe("text");
  });

  it("maps potential_claims + mentalHealth.diagnoses → medicalConditions.current, source-tagged and unrated", () => {
    const names = merge.medicalConditionsCurrent.map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining(["Tinnitus", "Lumbar Strain", "PTSD"]),
    );
    // Suggestions carry NO rating so buildConditionCandidates excludes them
    // from calculator input, and are never marked service-connected.
    merge.medicalConditionsCurrent.forEach((c) => {
      expect(c.source).toBe("C-File Analysis");
      expect(c.serviceConnected).toBe(false);
      expect(c.ratedPercentage).toBeUndefined();
    });
  });

  it("maps missing_element + recommendation → aiInsights.missingEvidence", () => {
    expect(merge.missingEvidence).toHaveLength(1);
    expect(merge.missingEvidence[0]).toMatchObject({
      condition: "Tinnitus",
      evidenceType: "Nexus letter",
      howToObtain: "Get an audiology nexus opinion",
      priority: "high",
    });
  });

  it("maps timeline → evidenceTimeline with eventType + source", () => {
    expect(merge.evidenceTimeline[0]).toMatchObject({
      date: "2005-06-01",
      eventType: "injury",
      description: "Back injury during PT",
      source: "C-File Analysis",
      significance: "high",
    });
  });

  it("maps exposures (object + string) → environmental, and presumptive_conditions → presumptive", () => {
    const types = merge.environmentalExposures.map((e) => e.type);
    expect(types).toEqual(
      expect.arrayContaining(["Burn Pits", "Noise exposure"]),
    );
    expect(merge.environmentalExposures.find((e) => e.type === "Burn Pits")).toMatchObject(
      { location: "Balad", dates: "2004" },
    );
    const presumptiveConds = merge.presumptiveConditions.map((p) => p.condition);
    expect(presumptiveConds).toEqual(
      expect.arrayContaining(["Asthma", "Rhinitis"]),
    );
    expect(merge.presumptiveConditions[0]).toMatchObject({
      exposureType: "Burn Pits",
      eligibleUnder: "Burn Pits",
    });
  });

  it("never routes suggestions into vaClaimsHistory.claims (that field is untouched)", () => {
    // The mapper emits no vaClaimsHistory key at all — filed-claim store is
    // reserved for decision/denial letters, not C-File suggestions.
    expect(merge).not.toHaveProperty("vaClaimsHistory");
  });

  it("tolerates an empty / partial analysis without throwing", () => {
    const empty = buildVkbMergeFromCFile({}, {});
    expect(empty.claims).toEqual([]);
    expect(empty.medicalConditionsCurrent).toEqual([]);
    expect(empty.evidenceTimeline).toEqual([]);
    expect(empty.missingEvidence).toEqual([]);
    expect(empty.environmentalExposures).toEqual([]);
    expect(empty.presumptiveConditions).toEqual([]);
  });
});
