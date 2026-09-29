/**
 * D15-3 (final15 QA review, 2026-09-28): DD214Analyzer.jsx classifies EVERY
 * service-record upload as PACKET_DOC_TYPES.DD214 regardless of which form
 * it actually is - saveDocumentToPacket's classification field is
 * hardcoded, never derived from the analyzed form type. An NGB-22 the
 * analyzer processed therefore lands in the packet's DD214 group, and its
 * AI-context label read "DD-214 (Service Record) (#1)" instead of "NGB-22
 * (Guard Service Record) (#1)". _neutralDocLabel now prefers the
 * document's OWN extracted form type (masterRecordType, or
 * documentTypes[0] as a fallback - both already present in
 * doc.extractedData since DD214Analyzer's AI schema always returns them)
 * over the packet group's label.
 *
 * Fixture identifiers are synthetic.
 */
import { describe, it, expect } from "vitest";
import { _formatServiceRecordDoc } from "./myPacketManager";

function ngb22DocMisclassifiedAsDD214(overrides = {}) {
  return {
    uploadDate: "2026-02-01T00:00:00.000Z",
    fileName: "ngb22-scan.pdf",
    extractedData: {
      masterRecordType: "NGB22",
      documentTypes: ["NGB22"],
      branch: "Army",
      component: "ARNG",
      entryDate: "2005-01-10",
      ...overrides,
    },
  };
}

function realDD214Doc(overrides = {}) {
  return {
    uploadDate: "2026-02-05T00:00:00.000Z",
    fileName: "dd214-scan.pdf",
    extractedData: {
      masterRecordType: "DD214",
      documentTypes: ["DD214"],
      branch: "Army",
      component: "RA",
      entryDate: "2010-03-15",
      ...overrides,
    },
  };
}

describe("D15-3: service-record document labels use the document's own extracted form type", () => {
  it("labels an NGB-22 doc as NGB-22, even though it is grouped under the DD-214 type label", () => {
    const doc = ngb22DocMisclassifiedAsDD214();
    // Same call shape _formatServiceRecordSection uses for a doc grouped
    // under PACKET_DOC_TYPES.DD214 - the group's own label is passed in as
    // `typeLabel`, exactly as it would be misclassified in production.
    const out = _formatServiceRecordDoc(doc, "DD-214 (Service Record)", 0);
    expect(out).toContain("NGB-22 (Guard Service Record) 2026-02-01 (#1)");
    expect(out).not.toContain("DD-214 (Service Record) 2026-02-01");
  });

  it("still labels a real DD-214 doc correctly when grouped under the DD-214 type label", () => {
    const doc = realDD214Doc();
    const out = _formatServiceRecordDoc(doc, "DD-214 (Service Record)", 0);
    expect(out).toContain("DD-214 (Service Record) 2026-02-05 (#1)");
  });

  it("falls back to the group label when the document carries no extracted form type (Muster Call's own correctly-classified import path)", () => {
    const doc = {
      uploadDate: "2026-02-01T00:00:00.000Z",
      fileName: "ngb22-musterball.pdf",
      extractedData: { branch: "Army", component: "ARNG" },
    };
    const out = _formatServiceRecordDoc(
      doc,
      "NGB-22 (Guard Service Record)",
      0,
    );
    expect(out).toContain("NGB-22 (Guard Service Record) 2026-02-01 (#1)");
  });

  it("uses documentTypes[0] when masterRecordType is absent", () => {
    const doc = ngb22DocMisclassifiedAsDD214({ masterRecordType: undefined });
    const out = _formatServiceRecordDoc(doc, "DD-214 (Service Record)", 0);
    expect(out).toContain("NGB-22 (Guard Service Record) 2026-02-01 (#1)");
  });

  it.each([
    [
      "NGB-22 imported first, then a real DD-214",
      ngb22DocMisclassifiedAsDD214(),
      realDD214Doc(),
    ],
    [
      "DD-214 imported first, then an NGB-22",
      realDD214Doc(),
      ngb22DocMisclassifiedAsDD214(),
    ],
  ])(
    "labels both documents correctly regardless of import order: %s",
    (_label, first, second) => {
      // Import order only changes which document lands at index 0 vs 1 in
      // the group - the label resolution itself reads only each
      // document's own extractedData, so it must be correct either way.
      const outFirst = _formatServiceRecordDoc(
        first,
        "DD-214 (Service Record)",
        0,
      );
      const outSecond = _formatServiceRecordDoc(
        second,
        "DD-214 (Service Record)",
        1,
      );

      const outByType = {
        [first.extractedData.masterRecordType]: outFirst,
        [second.extractedData.masterRecordType]: outSecond,
      };

      expect(outByType.NGB22).toContain("NGB-22 (Guard Service Record)");
      expect(outByType.NGB22).not.toContain("DD-214 (Service Record)");
      expect(outByType.DD214).toContain("DD-214 (Service Record)");
      expect(outByType.DD214).not.toContain("NGB-22");
    },
  );
});
