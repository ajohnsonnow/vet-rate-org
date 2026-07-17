/**
 * Wave 2b: one-time off-schema → canonical VKB migration.
 * migrateOffSchemaVKB must move legacy vkb.claims → medicalConditions.current
 * and vkb.evidence → evidenceTimeline, dedup against anything already there,
 * leave the legacy arrays in place (dual-read), set the run-once flag, and be
 * idempotent when run twice.
 */
import { describe, it, expect } from "vitest";
import {
  migrateOffSchemaVKB,
  initializeVKB,
} from "../../utils/veteranKnowledgeBase";

const seededVkb = () => {
  const vkb = initializeVKB();
  vkb.claims = [
    { condition: "Tinnitus", ratingPercent: 10, diagnosticCode: "6260" },
    { condition: "PTSD" }, // no rating — suggestion-like legacy entry
  ];
  vkb.evidence = [
    {
      date: "2005-06-01",
      type: "injury",
      description: "Back injury during PT",
      source: "C-File",
    },
  ];
  return vkb;
};

describe("migrateOffSchemaVKB", () => {
  it("moves legacy claims into medicalConditions.current, preserving rating + DC", () => {
    const { vkb, changed } = migrateOffSchemaVKB(seededVkb());
    expect(changed).toBe(true);

    const current = vkb.medicalConditions.current;
    const tinnitus = current.find((c) => c.name === "Tinnitus");
    expect(tinnitus).toMatchObject({
      name: "Tinnitus",
      ratedPercentage: 10,
      diagnosticCode: "6260",
    });
    // Unrated legacy entry migrates with NO ratedPercentage (calculators skip it)
    const ptsd = current.find((c) => c.name === "PTSD");
    expect(ptsd).toBeDefined();
    expect(ptsd.ratedPercentage).toBeUndefined();
  });

  it("moves legacy evidence into evidenceTimeline with eventType mapped from type", () => {
    const { vkb } = migrateOffSchemaVKB(seededVkb());
    expect(vkb.evidenceTimeline).toHaveLength(1);
    expect(vkb.evidenceTimeline[0]).toMatchObject({
      date: "2005-06-01",
      eventType: "injury",
      description: "Back injury during PT",
    });
  });

  it("leaves the legacy arrays in place for dual-read and sets the run-once flag", () => {
    const { vkb } = migrateOffSchemaVKB(seededVkb());
    expect(vkb.claims).toHaveLength(2);
    expect(vkb.evidence).toHaveLength(1);
    expect(vkb.metadata.migratedOffSchema).toBe(true);
  });

  it("is idempotent: running twice adds nothing and reports no change", () => {
    const first = migrateOffSchemaVKB(seededVkb());
    const currentLen = first.vkb.medicalConditions.current.length;
    const timelineLen = first.vkb.evidenceTimeline.length;

    const second = migrateOffSchemaVKB(first.vkb);
    expect(second.changed).toBe(false);
    expect(second.vkb.medicalConditions.current).toHaveLength(currentLen);
    expect(second.vkb.evidenceTimeline).toHaveLength(timelineLen);
  });

  it("does not duplicate a condition already present in medicalConditions.current", () => {
    const vkb = seededVkb();
    vkb.medicalConditions.current = [
      { name: "Tinnitus", source: "C-File Analysis" },
    ];
    const { vkb: out } = migrateOffSchemaVKB(vkb);
    const tinnitusEntries = out.medicalConditions.current.filter(
      (c) => c.name === "Tinnitus",
    );
    expect(tinnitusEntries).toHaveLength(1);
    // The pre-existing suggestion is preserved (not overwritten by the legacy claim)
    expect(tinnitusEntries[0].source).toBe("C-File Analysis");
  });

  it("no-ops on an empty VKB but still records the flag", () => {
    const { vkb, changed } = migrateOffSchemaVKB(initializeVKB());
    expect(changed).toBe(false);
    expect(vkb.metadata.migratedOffSchema).toBe(true);
    expect(vkb.medicalConditions.current).toEqual([]);
  });

  it("tolerates a null/garbage argument without throwing", () => {
    expect(migrateOffSchemaVKB(null)).toEqual({ vkb: null, changed: false });
    expect(migrateOffSchemaVKB(undefined).changed).toBe(false);
  });
});
