/**
 * FIX-6: two writers previously appended a record per DD214 import —
 * addDocumentToVKB pushed a `doc_...` entry and mergeDD214Documentation
 * (inside mergeDD214IntoVKB) pushed a SECOND `dd214-...` entry for the
 * same file, inflating vkb.metadata.documentCount and every downstream
 * count assertion. mergeDD214Documentation now skips filing a second
 * record when a doc_ entry with the same fileName is already present
 * (already fixed, verified against the real implementation) —
 * addDocumentToVKB itself gained an independent (fileName, fileSize)
 * idempotency guard for the separate re-upload-of-the-same-file case.
 */
import { describe, it, expect } from "vitest";
import {
  mergeDD214IntoVKB,
  initializeVKB,
} from "../../utils/veteranKnowledgeBase";

const seedDocEntry = (vkb, { id, fileName }) => {
  vkb.documentation.dd214s.push({
    id,
    fileName,
    uploadDate: new Date().toISOString(),
    pageCount: 2,
    classification: "DD214",
    extractedText: "",
    extractedData: {},
    ocrUsed: false,
    method: "text",
    version: 1,
    mostRecent: true,
    category: "dd214s",
  });
  vkb.metadata.documentCount = vkb.documentation.dd214s.length;
};

describe("FIX-6: mergeDD214IntoVKB does not double-write document records", () => {
  it("does not push a second dd214-... record when a doc_ entry for the same fileName already exists", () => {
    const vkb = initializeVKB();
    seedDocEntry(vkb, { id: "doc_123_abc", fileName: "williams_dd214.pdf" });

    mergeDD214IntoVKB(
      vkb,
      {
        branch: "Army",
        rank: "SGT",
        entryDate: "06/01/2010",
        separationDate: "05/30/2015",
      },
      { fileName: "williams_dd214.pdf" },
    );

    expect(vkb.documentation.dd214s).toHaveLength(1);
    expect(vkb.documentation.dd214s[0].id).toBe("doc_123_abc");
  });

  it("is idempotent across repeated merges of the same document", () => {
    const vkb = initializeVKB();
    seedDocEntry(vkb, { id: "doc_789_ghi", fileName: "doe_dd214.pdf" });

    const dd214Data = {
      branch: "Air Force",
      rank: "SSgt",
      entryDate: "01/01/2008",
      separationDate: "01/01/2012",
    };
    mergeDD214IntoVKB(vkb, dd214Data, { fileName: "doe_dd214.pdf" });
    mergeDD214IntoVKB(vkb, dd214Data, { fileName: "doe_dd214.pdf" });

    expect(vkb.documentation.dd214s).toHaveLength(1);
  });

  it("falls back to creating a new record only when no matching doc_ entry exists for that fileName", () => {
    const vkb = initializeVKB();

    mergeDD214IntoVKB(
      vkb,
      { branch: "Marine Corps", rank: "Cpl" },
      { fileName: "orphaned.pdf" },
    );

    expect(vkb.documentation.dd214s).toHaveLength(1);
    expect(vkb.documentation.dd214s[0].fileName).toBe("orphaned.pdf");
    expect(vkb.documentation.dd214s[0].branch).toBe("Marine Corps");
  });

  it("a genuinely different document (different fileName) still gets its own record", () => {
    const vkb = initializeVKB();
    seedDocEntry(vkb, { id: "doc_1", fileName: "period1.pdf" });

    mergeDD214IntoVKB(
      vkb,
      { branch: "Navy", rank: "PO2" },
      { fileName: "period2.pdf" },
    );

    expect(vkb.documentation.dd214s).toHaveLength(2);
  });
});

describe("FIX-6: addDocumentToVKB idempotency guard (unit-level, no IndexedDB)", () => {
  // addDocumentToVKB itself requires IndexedDB (loadVKB/saveVKB), which
  // isn't available in this test environment — its (fileName, fileSize)
  // duplicate-detection logic is verified by code review only. See the
  // final report for this gap.
  // Intentionally empty: this records a coverage gap, not a test. A placeholder
  // assertion added purely to satisfy the rule would assert nothing while
  // reading as real coverage.
  // eslint-disable-next-line sonarjs/assertions-in-tests
  it.skip("re-uploading the same (fileName, fileSize) updates the existing entry instead of duplicating", () => {});
});
