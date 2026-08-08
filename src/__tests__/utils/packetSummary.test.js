import { describe, it, expect } from "vitest";
import {
  buildDocumentFindings,
  buildAllDocumentFindings,
  buildConditionSynthesis,
  buildPacketTldr,
  buildPacketSummary,
} from "../../utils/packetSummary";

const dd214Doc = {
  id: "doc_1",
  fileName: "williams_dd214.pdf",
  uploadDate: "2026-07-30T18:04:11.000Z",
  pageCount: 2,
  fileSize: 240_000,
  classification: "DD214",
  extractedData: {
    branch: "Army",
    rank: "SGT",
    entryDate: "2010-06-01",
    separationDate: "2015-05-30",
    characterOfService: "Honorable",
    mos: [{ code: "11B", title: "Infantryman" }],
    awards: ["Army Commendation Medal", "Army Commendation Medal"],
  },
};

const cFileDoc = {
  id: "doc_2",
  fileName: "cfile_2018.pdf",
  uploadDate: "2026-07-30T20:00:00.000Z",
  pageCount: 2018,
  classification: "C_FILE_MEDICAL",
  extractedData: {
    summary: "Consolidated claims file.",
    claimNumber: "C-12345678",
    conditions: ["Tinnitus", "Lumbar strain"],
    potential_claims: [{ name: "Sleep apnea secondary to PTSD" }],
    timeline: [{ date: "2016-02-02", description: "C&P exam" }],
    segments: [{ type: "DD214" }, { type: "STR" }, { type: "RATING_DECISION" }],
    inventory: { inventory: [{ id: "segment_1" }, { id: "segment_2" }] },
    codeSheet: { conditions: [{ name: "TINNITUS (SERVICE CONNECTED)" }] },
  },
};

const documentsByCategory = {
  dd214s: {
    label: "DD-214 Service Records",
    icon: "🎖️",
    documents: [dd214Doc],
    count: 1,
  },
  cFiles: {
    label: "VA Claims & Decisions",
    icon: "📋",
    documents: [cFileDoc],
    count: 1,
  },
  blueButtonReports: {
    label: "Blue Button",
    icon: "🏥",
    documents: [],
    count: 0,
  },
};

const vkb = {
  serviceHistory: { separationDate: "2015-05-30" },
  medicalConditions: {
    current: [
      {
        name: "Tinnitus",
        ratedPercentage: 10,
        serviceConnected: true,
        source: "C-File Analysis",
      },
      { name: "Lumbar strain", ratedPercentage: 20, serviceConnected: true },
      { name: "Migraine", source: "Manual entry" },
    ],
  },
  evidenceTimeline: [
    { date: "2016-02-02", eventType: "exam", description: "C&P exam" },
    {
      date: "2017-01-01",
      eventType: "decision",
      description: "Rating decision",
    },
  ],
};

describe("buildDocumentFindings", () => {
  it("extracts scalar fields under stable display labels", () => {
    const findings = buildDocumentFindings(dd214Doc, {
      key: "dd214s",
      label: "DD-214 Service Records",
      icon: "🎖️",
    });
    const byLabel = Object.fromEntries(
      findings.scalars.map((s) => [s.label, s.value]),
    );

    expect(byLabel.Branch).toBe("Army");
    expect(byLabel.Rank).toBe("SGT");
    expect(byLabel["Character of service"]).toBe("Honorable");
    expect(findings.categoryLabel).toBe("DD-214 Service Records");
    expect(findings.analyzedOn).toBe("2026-07-30");
  });

  it("renders object-shaped and string-shaped list items alike, deduped", () => {
    const findings = buildDocumentFindings(dd214Doc);
    const lists = Object.fromEntries(
      findings.lists.map((l) => [l.label, l.values]),
    );

    expect(lists.MOS).toEqual(["11B — Infantryman"]);
    expect(lists.Awards).toEqual(["Army Commendation Medal"]);
  });

  it("omits fields that are absent rather than emitting empty rows", () => {
    const findings = buildDocumentFindings({ fileName: "bare.pdf" });
    expect(findings.scalars).toEqual([]);
    expect(findings.lists).toEqual([]);
    expect(findings.findingCount).toBe(0);
    expect(findings.fileName).toBe("bare.pdf");
  });

  it("merges Code Sheet conditions with narrative conditions without duplicating", () => {
    const findings = buildDocumentFindings(cFileDoc);
    // "Tinnitus" and "TINNITUS (SERVICE CONNECTED)" are distinct raw strings;
    // uniqueLabels is case-insensitive but not parenthetical-aware, so the
    // Code Sheet variant is kept as its own label here.
    expect(findings.conditions).toContain("Tinnitus");
    expect(findings.conditions).toContain("Lumbar strain");
    expect(findings.segmentCount).toBe(3);
    expect(findings.inventoryCount).toBe(2);
    expect(findings.timelineCount).toBe(1);
    expect(findings.potentialClaims).toEqual(["Sleep apnea secondary to PTSD"]);
  });

  it("surfaces a parse failure instead of rendering an empty card", () => {
    const findings = buildDocumentFindings({
      fileName: "broken.pdf",
      extractedData: { raw: "text", parseError: "parseCFileDocument threw" },
    });
    expect(findings.parseError).toBe("parseCFileDocument threw");
  });
});

describe("buildAllDocumentFindings", () => {
  it("flattens every category and skips empty ones", () => {
    const all = buildAllDocumentFindings(documentsByCategory);
    expect(all).toHaveLength(2);
    expect(all.map((d) => d.categoryKey)).toEqual(["dd214s", "cFiles"]);
  });

  it("returns an empty list when the VKB read has not resolved", () => {
    expect(buildAllDocumentFindings(null)).toEqual([]);
  });
});

describe("buildConditionSynthesis", () => {
  it("links each condition to the documents that mention it", () => {
    const docs = buildAllDocumentFindings(documentsByCategory);
    const conditions = buildConditionSynthesis(vkb, docs);
    const tinnitus = conditions.find((c) => c.key === "tinnitus");

    expect(tinnitus.ratedPercentage).toBe(10);
    expect(tinnitus.serviceConnected).toBe(true);
    expect(tinnitus.documents).toContain("cfile_2018.pdf");
    expect(tinnitus.documentCount).toBe(1);
  });

  it("collapses casing and parenthetical variants onto one condition", () => {
    const conditions = buildConditionSynthesis(vkb, [
      { fileName: "a.pdf", conditions: ["TINNITUS"], categoryLabel: "C-File" },
      {
        fileName: "b.pdf",
        conditions: ["Tinnitus (Service Connected)"],
        categoryLabel: "C-File",
      },
    ]);
    const tinnitus = conditions.filter((c) => c.key === "tinnitus");

    expect(tinnitus).toHaveLength(1);
    expect(tinnitus[0].documentCount).toBe(2);
  });

  it("keeps a stored condition with no supporting document, at zero", () => {
    const conditions = buildConditionSynthesis(vkb, []);
    const migraine = conditions.find((c) => c.key === "migraine");

    expect(migraine).toBeDefined();
    expect(migraine.documentCount).toBe(0);
    expect(migraine.sources).toContain("Manual entry");
  });

  it("sorts most-corroborated first", () => {
    const docs = buildAllDocumentFindings(documentsByCategory);
    const counts = buildConditionSynthesis(vkb, docs).map(
      (c) => c.documentCount,
    );
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });
});

describe("buildPacketTldr", () => {
  it("counts documents, pages, conditions and timeline events from stored data", () => {
    const docs = buildAllDocumentFindings(documentsByCategory);
    const conditions = buildConditionSynthesis(vkb, docs);
    const tldr = buildPacketTldr(vkb, docs, conditions);

    expect(tldr.stats.documents).toBe(2);
    expect(tldr.stats.pages).toBe(2020);
    expect(tldr.stats.timelineEvents).toBe(2);
    expect(tldr.stats.rated).toBe(2);
    expect(tldr.headline).toContain("2 documents");
    expect(tldr.isEmpty).toBe(false);
    expect(tldr.bullets.length).toBeGreaterThan(0);
  });

  it("reports an empty packet honestly rather than inventing a summary", () => {
    const tldr = buildPacketTldr({}, [], []);
    expect(tldr.isEmpty).toBe(true);
    expect(tldr.headline).toBe("No documents analyzed yet.");
    expect(tldr.bullets).toEqual([]);
  });

  it("flags conditions with no supporting document as a gap", () => {
    const conditions = buildConditionSynthesis(vkb, []);
    const tldr = buildPacketTldr(vkb, [], conditions);
    expect(tldr.gaps.join(" ")).toContain("no supporting document");
  });

  it("flags a missing DD-214 and a missing separation date", () => {
    const tldr = buildPacketTldr({}, [], []);
    expect(tldr.gaps).toContain("No DD-214 or service record on file.");
    expect(tldr.gaps).toContain(
      "Separation date is not recorded in your service history.",
    );
  });

  it("does not flag a missing DD-214 when one is on file", () => {
    const docs = buildAllDocumentFindings(documentsByCategory);
    const tldr = buildPacketTldr(vkb, docs, []);
    expect(tldr.gaps).not.toContain("No DD-214 or service record on file.");
  });

  it("counts documents that stored raw text only", () => {
    const docs = buildAllDocumentFindings({
      otherEvidence: {
        label: "Other",
        icon: "📄",
        documents: [
          { fileName: "x.pdf", extractedData: { parseError: "boom" } },
        ],
        count: 1,
      },
    });
    const tldr = buildPacketTldr(vkb, docs, []);
    expect(tldr.stats.unparsed).toBe(1);
    expect(tldr.gaps.join(" ")).toContain("stored raw text only");
  });
});

describe("buildPacketSummary", () => {
  it("returns documents, conditions and tldr in one pass", () => {
    const summary = buildPacketSummary(vkb, documentsByCategory);
    expect(summary.documents).toHaveLength(2);
    expect(summary.conditions.length).toBeGreaterThan(0);
    expect(summary.tldr.stats.documents).toBe(2);
  });

  it("survives a null VKB and a null document map", () => {
    const summary = buildPacketSummary(null, null);
    expect(summary.documents).toEqual([]);
    expect(summary.conditions).toEqual([]);
    expect(summary.tldr.isEmpty).toBe(true);
  });
});
